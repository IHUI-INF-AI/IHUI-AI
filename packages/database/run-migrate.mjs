import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// 安全:不硬编码密码,强制从环境变量读取(本地开发从 .env 加载)
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('错误:未设置 DATABASE_URL 环境变量。请在 .env 中配置(参考 .env.example)。');
  process.exit(1);
}
console.log('Connecting to:', url.replace(/:[^:@]+@/, ':****@'));

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed successfully!');
} catch (err) {
  console.error('Migration failed:', err.message);
  console.error('Full error:', err);
  process.exit(1);
} finally {
  await sql.end();
}
