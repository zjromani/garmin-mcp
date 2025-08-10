import { TestServer } from './helpers/test-server.js';
import crypto from 'crypto';

describe('Webhook Security', () => {
  let server: TestServer;

  beforeEach(() => {
    server = new TestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('Signature Verification', () => {
    it('accepts webhook without signature when secret not configured', async () => {
      // Current behavior - no GARMIN_WEBHOOK_SECRET set
      const payload = { userId: 'test', steps: 1000 };

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);
    });

    it('handles malformed JSON gracefully', async () => {
      await server.request
        .post('/garmin/webhook')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('handles empty payload', async () => {
      await server.request
        .post('/garmin/webhook')
        .send({})
        .expect(200);
    });

    it('handles array of events', async () => {
      const payload = [
        { userId: 'user1', steps: 1000 },
        { userId: 'user2', steps: 2000 }
      ];

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);

      // Verify both events were stored
      const user1Data = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: { user_id: 'user1' }
        })
        .expect(200);

      const user2Data = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: { user_id: 'user2' }
        })
        .expect(200);

      expect(user1Data.body.content[0].json.steps).toBe(1000);
      expect(user2Data.body.content[0].json.steps).toBe(2000);
    });
  });

  describe('Data Parsing Edge Cases', () => {
    it('handles missing userId gracefully', async () => {
      const payload = {
        steps: 1000,
        calendarDate: '2025-01-01'
        // No userId
      };

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);

      // Should default to "unknown" user
      const data = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: { user_id: 'unknown', date: '2025-01-01' }
        })
        .expect(200);

      expect(data.body.content[0].json.steps).toBe(1000);
    });

    it('handles missing date gracefully', async () => {
      const payload = {
        userId: 'test',
        steps: 1000
        // No calendarDate
      };

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);

      // Should use current date
      const today = new Date().toISOString().slice(0, 10);
      const data = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: { user_id: 'test', date: today }
        })
        .expect(200);

      expect(data.body.content[0].json.steps).toBe(1000);
    });

    it('handles various field name variations', async () => {
      const payload = {
        user_id: 'test', // underscore version
        date: '2025-01-01', // date instead of calendarDate
        summary: {
          steps: 5000,
          restingHeartRate: 65,
          calories: 300,
          sleepSeconds: 25200
        },
        bodyBattery: {
          max: 90
        }
      };

      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);

      const data = await server.request
        .post('/mcp/tools/call')
        .send({
          name: 'garmin.getDailySummary',
          arguments: { user_id: 'test', date: '2025-01-01' }
        })
        .expect(200);

      const result = data.body.content[0].json;
      expect(result.steps).toBe(5000);
      expect(result.resting_hr).toBe(65);
      expect(result.calories).toBe(300);
      expect(result.sleep_seconds).toBe(25200);
      expect(result.body_battery_max).toBe(90);
    });
  });

  describe('Rate Limiting', () => {
    it('allows requests within rate limit', async () => {
      // Make several requests under the limit
      for (let i = 0; i < 5; i++) {
        await server.request
          .post('/garmin/webhook')
          .send({ userId: 'test', steps: i })
          .expect(200);
      }
    });

    // Note: Full rate limiting test (100+ requests) would be slow
    // In practice, you might want to create a separate test server
    // with lower rate limits for testing
  });
});
