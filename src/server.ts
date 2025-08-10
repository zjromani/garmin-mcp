// Garmin webhook receiver + MCP server for ChatGPT integration

import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { Database } from "./database.js";

const {
  PORT = "8080",
  MCP_API_TOKEN,
  GARMIN_WEBHOOK_SECRET,
  GARMIN_API_KEY,
  GARMIN_API_SECRET,
} = process.env;

export function createServer(database?: Database, options = { skipAuth: false }) {
  const db = database || new Database();
  const app = express();
  app.use(bodyParser.json({ limit: "2mb" }));

// Rate limiting for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many webhook requests from this IP"
});

app.use('/garmin/webhook', webhookLimiter);

app.get("/healthz", (_req: Request, res: Response) => res.status(200).send("ok"));

app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
  if (!options.skipAuth) {
    const auth = req.headers.authorization || "";
    if (!MCP_API_TOKEN || auth !== `Bearer ${MCP_API_TOKEN}`) {
      return res.status(401).send("unauthorized");
    }
  }
  next();
});

function verifyGarmin(req: Request): boolean {
  if (!GARMIN_WEBHOOK_SECRET) return true;
  const sig = req.header("X-Garmin-Signature") || "";
  const expected = crypto
    .createHmac("sha256", GARMIN_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("base64");
  return Boolean(sig && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

app.post("/garmin/webhook", async (req: Request, res: Response) => {
  if (!verifyGarmin(req)) return res.status(401).send("bad signature");

  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const ev of events) {
    const userId = ev.userId || ev.user_id || "unknown";
    const dayStr: string =
      (ev.calendarDate || ev.date || new Date().toISOString()).slice(0, 10);

    const steps = ev.steps ?? ev.summary?.steps ?? null;
    const resting_hr = ev.restingHeartRate ?? ev.summary?.restingHeartRate ?? null;
    const calories = ev.activeKilocalories ?? ev.summary?.calories ?? null;
    const sleep_seconds = ev.sleepDurationInSeconds ?? ev.summary?.sleepSeconds ?? null;
    const bbMin = ev.bodyBatteryMin ?? null;
    const bbMax = ev.bodyBatteryMax ?? ev.bodyBattery?.max ?? null;

    await db.upsertHealthData({
      user_id: userId,
      day: dayStr,
      steps,
      resting_hr,
      calories,
      sleep_seconds,
      body_battery_min: bbMin,
      body_battery_max: bbMax,
      payload: ev
    });
  }

  res.status(200).send("ok");
});



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

app.post("/mcp/tools/call", async (req: Request, res: Response) => {
  const { name, arguments: args } = req.body;
  
  try {
    if (name === "garmin.getDailySummary") {
      if (!args.user_id) {
        return res.status(400).json({ error: "Missing required argument: user_id" });
      }
      const user = String(args.user_id);
      const date = (args.date as string) || new Date().toISOString().slice(0, 10);
      
      const dbData = await db.getHealthData(user, date);
      
      if (dbData) {
        return res.json({ content: [{ type: "json", json: dbData }] });
      }
      
      return res.json({ content: [{ type: "text", text: "no data available" }] });
      
    } else if (name === "garmin.getRecentDays") {
      if (!args.user_id) {
        return res.status(400).json({ error: "Missing required argument: user_id" });
      }
      const user = String(args.user_id);
      const days = Number(args.days || 7);
      
      const recentData = await db.getRecentHealthData(user, days);
      
      return res.json({ content: [{ type: "json", json: recentData }] });
      
    } else {
      return res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    console.error("Tool execution error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/mcp/sse", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  res.write(`data: ${JSON.stringify({ type: "connection", status: "connected" })}\n\n`);
  
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "ping" })}\n\n`);
  }, 30000);
  
  req.on("close", () => {
    clearInterval(interval);
  });
});

  return app;
}

// Only start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createServer();
  app.listen(Number(PORT), () => {
    console.log(`HTTP up on :${PORT}`);
  });
}
