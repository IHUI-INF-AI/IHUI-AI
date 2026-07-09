import { createDb, type Database } from '@ihui/database';
import { config } from '../config/index.js';

export const db: Database = createDb(config.DATABASE_URL);

export type { Database };
