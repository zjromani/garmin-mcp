// Purpose: single process hosting a Garmin webhook and an MCP server
// Docs in comments:
// MCP quickstart https://modelcontextprotocol.io/quickstart/server
// OpenAI Remote MCP https://platform.openai.com/docs/guides/tools-remote-mcp
// MCP SDK https://www.npmjs.com/package/@modelcontextprotocol/sdk
// Garmin Health overview https://developer.garmin.com/gc-developer-program/health-api/

import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

const {
  PORT = "8080",
  MCP_API_TOKEN,                 // bearer for ChatGPT Remote MCP client
  GARMIN_WEBHOOK_SECRET,         // only if Garmin provides one
  GARMIN_API_KEY,                // for querying historical data
  GARMIN_API_SECRET,             // for Garmin Health API
} = process.env;

// In-memory cache for recent data (survives container restarts)
const healthDataCache = new Map<string, any>();

// Express
const app = express();
app.use(bodyParser.json({ limit: "2mb" }));

// Rate limiting for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many webhook requests from this IP"
});

app.use('/garmin/webhook', webhookLimiter);

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

    // Store in memory cache
    const cacheKey = `${userId}-${dayStr}`;
    healthDataCache.set(cacheKey, {
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
      
      // Check cache first
      const cacheKey = `${user}-${date}`;
      const cachedData = healthDataCache.get(cacheKey);
      
      if (cachedData) {
        return res.json({ content: [{ type: "json", json: cachedData }] });
      }
      
      // If not in cache, query Garmin API (placeholder for now)
      return res.json({ content: [{ type: "text", text: "no data available" }] });
      
    } else if (name === "garmin.getRecentDays") {
      const user = String(args.user_id);
      const days = Number(args.days || 7);
      
      // Get recent days from cache
      const recentData = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const cacheKey = `${user}-${dateStr}`;
        const cachedData = healthDataCache.get(cacheKey);
        
        if (cachedData) {
          recentData.push(cachedData);
        }
      }
      
      return res.json({ content: [{ type: "json", json: recentData }] });
      
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
