import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export interface DatabaseConfig {
  url: string;
  readReplicaUrl?: string;
  max?: number;
  idleTimeoutMillis?: number;
}

export function createReadWriteDb(config: DatabaseConfig) {
  const writerClient = postgres(config.url, {
    max: config.max ?? 20,
    idle_timeout: config.idleTimeoutMillis ?? 30_000,
    prepare: false,
  });

  const readerClient = config.readReplicaUrl
    ? postgres(config.readReplicaUrl, {
        max: config.max ?? 20,
        idle_timeout: config.idleTimeoutMillis ?? 30_000,
        prepare: false,
      })
    : writerClient; // 无从库时回退到主库

  const dbWriter = drizzle(writerClient, { schema });
  const dbReader = drizzle(readerClient, { schema });

  return { dbWriter, dbReader, writerClient, readerClient };
}

export type ReadWriteDb = ReturnType<typeof createReadWriteDb>;
