// Purpose: single process hosting a Garmin webhook and an MCP server
// Docs in comments:
// MCP quickstart https://modelcontextprotocol.io/quickstart/server
// OpenAI Remote MCP https://platform.openai.com/docs/guides/tools-remote-mcp
// MCP SDK https://www.npmjs.com/package/@modelcontextprotocol/sdk
// Garmin Health overview https://developer.garmin.com/gc-developer-program/health-api/

import express from "express";
import bodyParser from "body-parser";
import { Pool } from "pg";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const {
  PORT = "8080",
  DATABASE_URL,
  MCP_API_TOKEN,                 // bearer for ChatGPT Remote MCP client
  GARMIN_WEBHOOK_SECRET,         // only if Garmin provides one
} = process.env;

if (!DATABASE_URL) throw new Error("DATABASE_URL required");

// Postgres
const db = new Pool({ connectionString: DATABASE_URL });
await db.query(`
create table if not exists garmin_daily (
  user_id text not null,
  day date not null,
  steps int,
  resting_hr int,
  calories int,
  sleep_seconds int,
  body_battery_min int,
  body_battery_max int,
  payload jsonb not null,
  primary key (user_id, day)
);
`);

// Express
const app = express();
app.use(bodyParser.json({ limit: "2mb" }));

// Healthcheck for load balancers
app.get("/healthz", (_req: Request, res: Response) => res.status(200).send("ok"));

// Simple auth wall for MCP route so the world cannot enumerate tools
app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || "";
  if (!MCP_API_TOKEN || auth !== `Bearer ${MCP_API_TOKEN}`) {
    return res.status(401).send("unauthorized");
  }
  next();
});

// Optional signature verification; confirm the exact header and algorithm in your Garmin onboarding packet
function verifyGarmin(req: Request): boolean {
  if (!GARMIN_WEBHOOK_SECRET) return true;
  const sig = req.header("X-Garmin-Signature") || "";
  const expected = crypto
    .createHmac("sha256", GARMIN_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("base64");
  return Boolean(sig && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

// Webhook receiver. Garmin pushes JSON events. Shapes vary by feed.
// Health API overview https://developer.garmin.com/gc-developer-program/health-api/
app.post("/garmin/webhook", async (req: Request, res: Response) => {
  if (!verifyGarmin(req)) return res.status(401).send("bad signature");

  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const ev of events) {
    // Map common fields. Adjust to your actual payload
    const userId = ev.userId || ev.user_id || "unknown";
    const dayStr: string =
      (ev.calendarDate || ev.date || new Date().toISOString()).slice(0, 10);

    const steps = ev.steps ?? ev.summary?.steps ?? null;
    const resting_hr = ev.restingHeartRate ?? ev.summary?.restingHeartRate ?? null;
    const calories = ev.activeKilocalories ?? ev.summary?.calories ?? null;
    const sleep_seconds = ev.sleepDurationInSeconds ?? ev.summary?.sleepSeconds ?? null;
    const bbMin = ev.bodyBatteryMin ?? null;
    const bbMax = ev.bodyBatteryMax ?? ev.bodyBattery?.max ?? null;

    await db.query(
      `insert into garmin_daily (user_id, day, steps, resting_hr, calories, sleep_seconds, body_battery_min, body_battery_max, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id, day) do update set
         steps=excluded.steps,
         resting_hr=excluded.resting_hr,
         calories=excluded.calories,
         sleep_seconds=excluded.sleep_seconds,
         body_battery_min=excluded.body_battery_min,
         body_battery_max=excluded.body_battery_max,
         payload=excluded.payload`,
      [userId, dayStr, steps, resting_hr, calories, sleep_seconds, bbMin, bbMax, ev]
    );
  }

  res.status(200).send("ok");
});

// Simple MCP-compatible API endpoints for ChatGPT Remote MCP
// OpenAI Remote MCP https://platform.openai.com/docs/guides/tools-remote-mcp

// List available tools
app.get("/mcp/tools", async (_req: Request, res: Response) => {
  const tools = [
    {
      name: "garmin.getDailySummary",
      description: "Get daily summary for a user and date",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD; defaults to today" }
        },
        required: ["user_id"]
      }
    },
    {
      name: "garmin.getRecentDays",
      description: "Get last N days of summaries for a user",
      inputSchema: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          days: { type: "number", default: 7 }
        },
        required: ["user_id"]
      }
    }
  ];
  
  res.json({ tools });
});

// Execute a tool
app.post("/mcp/tools/call", async (req: Request, res: Response) => {
  const { name, arguments: args } = req.body;
  
  try {
    if (name === "garmin.getDailySummary") {
      const user = String(args.user_id);
      const date = (args.date as string) || new Date().toISOString().slice(0, 10);
      const { rows } = await db.query(
        `select user_id, day, steps, resting_hr, calories, sleep_seconds, body_battery_min, body_battery_max
         from garmin_daily where user_id=$1 and day=$2`, [user, date]
      );
      if (!rows.length) {
        return res.json({ content: [{ type: "text", text: "no data" }] });
      }
      return res.json({ content: [{ type: "json", json: rows[0] }] });
      
    } else if (name === "garmin.getRecentDays") {
      const user = String(args.user_id);
      const days = Number(args.days || 7);
      const { rows } = await db.query(
        `select user_id, day, steps, resting_hr, calories, sleep_seconds
         from garmin_daily
         where user_id=$1
         order by day desc
         limit $2`, [user, days]
      );
      return res.json({ content: [{ type: "json", json: rows }] });
      
    } else {
      return res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// MCP SSE endpoint for compatibility
app.get("/mcp/sse", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connection", status: "connected" })}\n\n`);
  
  // Keep connection alive
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  }, 30000);
  
  req.on("close", () => {
    clearInterval(interval);
  });
});

app.listen(Number(PORT), () => {
  console.log(`HTTP up on :${PORT}`);
});
