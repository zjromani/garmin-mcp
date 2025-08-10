import { TestServer } from './helpers/test-server.js';

describe('MCP Endpoints', () => {
  let server: TestServer;

  beforeEach(() => {
    server = new TestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('GET /mcp/tools', () => {
    it('lists available tools', async () => {
      const response = await server.request
        .get('/mcp/tools')
        .expect(200);

      expect(response.body.tools).toEqual([
        {
          name: 'garmin.getDailySummary',
          description: 'Get daily summary for a user and date',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              date: { type: 'string', description: 'YYYY-MM-DD; defaults to today' }
            },
            required: ['user_id']
          }
        },
        {
          name: 'garmin.getRecentDays',
          description: 'Get last N days of summaries for a user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              days: { type: 'number', default: 7 }
            },
            required: ['user_id']
          }
        }
      ]);
    });
  });

  describe('POST /mcp/tools/call', () => {
    beforeEach(async () => {
      // Seed test data via webhook
      const payload = {
        userId: 'test-user',
        calendarDate: '2025-01-01',
        steps: 10000,
        restingHeartRate: 60,
        activeKilocalories: 500,
        sleepDurationInSeconds: 28800,
        bodyBatteryMin: 20,
        bodyBatteryMax: 95
      };

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);
    });

    it('returns daily summary for a specific date', async () => {
      const response = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: {
            user_id: 'test-user',
            date: '2025-01-01'
          }
        })
        .expect(200);

      expect(response.body.content[0].type).toBe('json');
      expect(response.body.content[0].json).toMatchObject({
        user_id: 'test-user',
        day: '2025-01-01',
        steps: 10000,
        resting_hr: 60,
        calories: 500,
        sleep_seconds: 28800,
        body_battery_min: 20,
        body_battery_max: 95
      });
    });

    it('returns "no data available" for missing date', async () => {
      const response = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: {
            user_id: 'test-user',
            date: '2024-01-01' // Different date than seeded data
          }
        })
        .expect(200);

      expect(response.body.content[0].type).toBe('text');
      expect(response.body.content[0].text).toBe('no data available');
    });

    it('returns recent days of data', async () => {
      const response = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getRecentDays',
          arguments: {
            user_id: 'test-user',
            days: 7
          }
        })
        .expect(200);

      expect(response.body.content[0].type).toBe('json');
      expect(response.body.content[0].json).toHaveLength(1); // Only seeded one day
      expect(response.body.content[0].json[0]).toMatchObject({
        user_id: 'test-user',
        day: '2025-01-01'
      });
    });

    it('handles unknown tool name', async () => {
      const response = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'unknown.tool',
          arguments: {}
        })
        .expect(400);

      expect(response.body.error).toBe('Unknown tool: unknown.tool');
    });

    it('handles invalid arguments', async () => {
      const response = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: {
            // Missing required user_id
            date: '2025-01-01'
          }
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required argument: user_id');
    });
  });
});
