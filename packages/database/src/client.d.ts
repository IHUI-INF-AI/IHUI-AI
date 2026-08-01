import postgres from 'postgres';
import * as schema from './schema/index.js';
export declare function createDb(url: string): import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema> & {
    $client: postgres.Sql<{}>;
};
export type Database = ReturnType<typeof createDb>;
