import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
export function createDb(url) {
    const client = postgres(url, { max: 10, prepare: false });
    return drizzle(client, { schema });
}
//# sourceMappingURL=client.js.map