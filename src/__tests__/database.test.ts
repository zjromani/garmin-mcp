import { Database } from '../database.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    // Use in-memory SQLite for each test
    db = new Database(':memory:');
  });

  afterEach(async () => {
    try {
      await db.close();
    } catch (error) {
      // Ignore errors if database is already closed
    }
  });

  describe('upsertHealthData', () => {
    it('inserts new health data', async () => {
      const healthData = {
        user_id: 'user123',
        day: '2025-01-01',
        steps: 10000,
        resting_hr: 60,
        calories: 500,
        sleep_seconds: 28800,
        body_battery_min: 20,
        body_battery_max: 95,
        payload: { test: 'data' }
      };

      await db.upsertHealthData(healthData);

      const retrieved = await db.getHealthData('user123', '2025-01-01');
      expect(retrieved).toMatchObject(healthData);
      expect(retrieved?.created_at).toBeDefined();
      expect(retrieved?.updated_at).toBeDefined();
    });

    it('updates existing health data', async () => {
      const initialData = {
        user_id: 'user123',
        day: '2025-01-01',
        steps: 5000,
        resting_hr: 65,
        calories: 300,
        sleep_seconds: 25200,
        body_battery_min: 15,
        body_battery_max: 85,
        payload: { version: 1 }
      };

      const updatedData = {
        user_id: 'user123',
        day: '2025-01-01',
        steps: 10000,
        resting_hr: 60,
        calories: 500,
        sleep_seconds: 28800,
        body_battery_min: 20,
        body_battery_max: 95,
        payload: { version: 2 }
      };

      await db.upsertHealthData(initialData);
      const first = await db.getHealthData('user123', '2025-01-01');
      
      // Wait a moment to ensure updated_at changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await db.upsertHealthData(updatedData);
      const second = await db.getHealthData('user123', '2025-01-01');

      expect(second?.steps).toBe(10000);
      expect(second?.payload).toEqual({ version: 2 });
      expect(second?.created_at).toEqual(first?.created_at);
      expect(new Date(second?.updated_at || 0).getTime()).toBeGreaterThan(new Date(first?.updated_at || 0).getTime());
    });

    it('handles undefined values correctly', async () => {
      const healthData = {
        user_id: 'user123',
        day: '2025-01-01',
        steps: undefined,
        resting_hr: undefined,
        calories: undefined,
        sleep_seconds: undefined,
        body_battery_min: undefined,
        body_battery_max: undefined,
        payload: { empty: true }
      };

      await db.upsertHealthData(healthData);
      const retrieved = await db.getHealthData('user123', '2025-01-01');
      
      expect(retrieved?.steps).toBeNull();
      expect(retrieved?.resting_hr).toBeNull();
      expect(retrieved?.calories).toBeNull();
      expect(retrieved?.sleep_seconds).toBeNull();
      expect(retrieved?.body_battery_min).toBeNull();
      expect(retrieved?.body_battery_max).toBeNull();
    });
  });

  describe('getHealthData', () => {
    it('returns null for non-existent data', async () => {
      const result = await db.getHealthData('nonexistent', '2025-01-01');
      expect(result).toBeNull();
    });

    it('returns correct data for existing record', async () => {
      const healthData = {
        user_id: 'user123',
        day: '2025-01-01',
        steps: 10000,
        resting_hr: 60,
        calories: 500,
        sleep_seconds: 28800,
        body_battery_min: 20,
        body_battery_max: 95,
        payload: { test: 'data' }
      };

      await db.upsertHealthData(healthData);
      const retrieved = await db.getHealthData('user123', '2025-01-01');
      
      expect(retrieved).toMatchObject(healthData);
    });
  });

  describe('getRecentHealthData', () => {
    beforeEach(async () => {
      // Insert test data for multiple days
      const dates = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05'];
      
      for (const [index, day] of dates.entries()) {
        await db.upsertHealthData({
          user_id: 'user123',
          day,
          steps: 1000 * (index + 1),
          resting_hr: 60 + index,
          calories: 100 * (index + 1),
          sleep_seconds: 28800,
          body_battery_min: 20,
          body_battery_max: 95,
          payload: { day }
        });
      }
    });

    it('returns correct number of recent days', async () => {
      const recent = await db.getRecentHealthData('user123', 3);
      expect(recent).toHaveLength(3);
    });

    it('returns data in descending order by day', async () => {
      const recent = await db.getRecentHealthData('user123', 5);
      expect(recent[0].day).toBe('2025-01-05');
      expect(recent[1].day).toBe('2025-01-04');
      expect(recent[2].day).toBe('2025-01-03');
      expect(recent[3].day).toBe('2025-01-02');
      expect(recent[4].day).toBe('2025-01-01');
    });

    it('returns empty array for non-existent user', async () => {
      const recent = await db.getRecentHealthData('nonexistent', 7);
      expect(recent).toEqual([]);
    });

    it('handles requesting more days than available', async () => {
      const recent = await db.getRecentHealthData('user123', 10);
      expect(recent).toHaveLength(5); // Only 5 days of data exist
    });
  });

  describe('close', () => {
    it('closes database connection without error', async () => {
      const testDb = new Database(':memory:');
      await expect(testDb.close()).resolves.not.toThrow();
    });
  });
});
