import sqlite3 from 'sqlite3';

export interface HealthData {
  user_id: string;
  day: string;
  steps?: number;
  resting_hr?: number;
  calories?: number;
  sleep_seconds?: number;
  body_battery_min?: number;
  body_battery_max?: number;
  payload: any;
  created_at: string;
  updated_at: string;
}

export class Database {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string = '/data/garmin_health.db') {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
    this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS health_data (
            user_id TEXT NOT NULL,
            day TEXT NOT NULL,
            steps INTEGER,
            resting_hr INTEGER,
            calories INTEGER,
            sleep_seconds INTEGER,
            body_battery_min INTEGER,
            body_battery_max INTEGER,
            payload TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, day)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating table:', err);
            reject(err);
          } else {
            console.log('Database initialized successfully');
            resolve();
          }
        });
      });
    });
  }

  async upsertHealthData(data: Omit<HealthData, 'created_at' | 'updated_at'>): Promise<void> {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO health_data 
        (user_id, day, steps, resting_hr, calories, sleep_seconds, body_battery_min, body_battery_max, payload, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, day) DO UPDATE SET
          steps = excluded.steps,
          resting_hr = excluded.resting_hr,
          calories = excluded.calories,
          sleep_seconds = excluded.sleep_seconds,
          body_battery_min = excluded.body_battery_min,
          body_battery_max = excluded.body_battery_max,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        data.user_id,
        data.day,
        data.steps,
        data.resting_hr,
        data.calories,
        data.sleep_seconds,
        data.body_battery_min,
        data.body_battery_max,
        JSON.stringify(data.payload),
        now,
        now,
        (err: any) => {
          if (err) {
            console.error('Error upserting health data:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
      stmt.finalize();
    });
  }

  async getHealthData(userId: string, date: string): Promise<HealthData | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM health_data WHERE user_id = ? AND day = ?',
        [userId, date],
        (err: any, row: any) => {
          if (err) {
            console.error('Error getting health data:', err);
            reject(err);
          } else if (row) {
            resolve({
              ...row,
              payload: JSON.parse(row.payload)
            } as HealthData);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async getRecentHealthData(userId: string, days: number): Promise<HealthData[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM health_data WHERE user_id = ? ORDER BY day DESC LIMIT ?',
        [userId, days],
        (err: any, rows: any[]) => {
          if (err) {
            console.error('Error getting recent health data:', err);
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              payload: JSON.parse(row.payload)
            } as HealthData)));
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
