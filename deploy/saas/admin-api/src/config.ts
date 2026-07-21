/**
 * Admin API 配置
 * 从顶层 deploy/saas/.env 加载
 */
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAAS_ROOT = resolve(__dirname, '../../');

// 加载 .env
const envPath = resolve(SAAS_ROOT, '.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8081),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ADMIN_API_KEY: z.string().min(32, 'ADMIN_API_KEY must be at least 32 chars'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SAAS_ROOT: z.string().default(SAAS_ROOT),
});

export const config = ConfigSchema.parse(process.env);

if (!process.env.ADMIN_API_KEY) {
  // 自动生成(仅首次启动)
  const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  config.ADMIN_API_KEY = generated;
  console.warn(`⚠️  ADMIN_API_KEY 未设置,自动生成(仅本次会话有效):`);
  console.warn(`   ${generated}`);
  console.warn(`   请将此值写入 deploy/saas/.env 持久化`);
}
