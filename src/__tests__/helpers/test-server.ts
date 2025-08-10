import { Express } from 'express';
import request from 'supertest';
import { Database } from '../../database.js';
import { createServer } from '../../server.js';

export class TestServer {
  private app: Express;
  private db: Database;

  constructor() {
    // Use in-memory SQLite for tests
    this.db = new Database(':memory:');
    this.app = createServer(this.db, { skipAuth: true });
  }

  get request() {
    return request(this.app);
  }

  async close() {
    await this.db.close();
  }
}
