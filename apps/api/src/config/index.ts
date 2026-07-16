import { z } from 'zod'
import { logger } from '../utils/logger.js'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  DATABASE_READ_REPLICA_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).default('a'.repeat(32)),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // AI 回调共享密钥(可选,为空则不校验;配置后 ai-service 回调需带 X-Internal-Secret 头)
  AI_CALLBACK_SECRET: z.string().default(''),

  // TBox webhook 签名密钥(可选,为空则不校验;配置后设备事件通知需带 X-Signature 头)
  TBOX_WEBHOOK_SECRET: z.string().default(''),

  // 腾讯云直播回调验签密钥(可选,为空时回调端点返回 503;配置后回调需带 X-Signature/X-Timestamp/X-Nonce 头)
  TENCENT_LIVE_CALLBACK_KEY: z.string().default(''),
  // 腾讯云直播 AppID(用于流管理 API,预留)
  TENCENT_LIVE_APP_ID: z.string().default(''),
  // 腾讯云直播 API 密钥(用于流管理 API 签名,预留)
  TENCENT_LIVE_API_KEY: z.string().default(''),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@ihui.ai'),
  SMTP_ENABLED: z.coerce.boolean().default(false),

  API_LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  API_LOG_ENABLED: z.coerce.boolean().default(true),
  API_LOG_BATCH_SIZE: z.coerce.number().int().min(1).default(100),
  API_LOG_FLUSH_INTERVAL_MS: z.coerce.number().int().min(100).default(5000),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  logger.error('❌ Invalid environment variables', { errors: parsed.error.flatten().fieldErrors })
  process.exit(1)
}

export const config = parsed.data
export type Config = typeof config
