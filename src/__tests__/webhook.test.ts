import { TestServer } from './helpers/test-server.js';

describe('Garmin Webhook', () => {
  let server: TestServer;

  beforeEach(() => {
    server = new TestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('accepts valid webhook data', async () => {
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

    const response = await server.request
      .post('/garmin/webhook')
      .send(payload)
      .expect(200);

    expect(response.text).toBe('ok');

    // Verify data was stored
    const storedData = await server.request
      .post('/mcp/tools/call')

      .send({
        name: 'garmin.getDailySummary',
        arguments: {
          user_id: 'test-user',
          date: '2025-01-01'
        }
      })
      .expect(200);

    const data = storedData.body.content[0].json;
    expect(data).toMatchObject({
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

  it('handles rate limiting', async () => {
    const payload = { userId: 'test-user' };
    
    // Make 101 requests
    for (let i = 0; i < 100; i++) {
      await server.request
        .post('/garmin/webhook')
        .send(payload)
        .expect(200);
    }

    // 101st request should be rate limited
    await server.request
      .post('/garmin/webhook')
      .send(payload)
      .expect(429);
  });
});
