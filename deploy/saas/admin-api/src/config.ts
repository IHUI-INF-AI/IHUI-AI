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
  // P1-2.2: 允许调用 admin-api 的 web 用户白名单(逗号分隔,默认仅 'admin')
  ADMIN_USER_WHITELIST: z.string().default('admin'),
  // P1-2.2: 是否启用操作审计日志(JSON Lines 写入 admin-api-audit.log)
  ENABLE_AUDIT_LOG: z.coerce.boolean().default(true),
});

export const config = ConfigSchema.parse(process.env);

/**
 * P1-2.2: 审计日志路径
 * 部署侧统一管理,gitignore(每个部署实例一份)
 */
export const AUDIT_LOG_PATH = resolve(config.SAAS_ROOT, 'admin-api-audit.log');

if (!process.env.ADMIN_API_KEY) {
  // 自动生成(仅首次启动)
  const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  config.ADMIN_API_KEY = generated;
  // 2026-07-21 安全审计加固:严禁在 console 中明文打印生成的密钥
  // 风险:若 stdout 被日志聚合系统 / 终端历史 / 监控面板捕获,
  // 攻击者可读取完整 ADMIN_API_KEY 绕过所有 x-admin-api-key 鉴权
  // 修复:仅输出首尾 4 字符指纹,完整密钥首次启动后由用户自行从生成的 .env 读取
  const fingerprint = `${generated.slice(0, 4)}…${generated.slice(-4)}`;
  console.warn(`⚠️  ADMIN_API_KEY 未设置,自动生成(仅本次会话有效):`);
  console.warn(`   fingerprint: ${fingerprint}  (len=${generated.length})`);
  console.warn(`   请将此值写入 deploy/saas/.env 持久化(查看生成值请用 'grep ADMIN_API_KEY .env')`);
}
