import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).default('a'.repeat(32)),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),

  // AI 回调共享密钥(可选,为空则不校验;配置后 ai-service 回调需带 X-Internal-Secret 头)
  AI_CALLBACK_SECRET: z.string().default(''),

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
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
export type Config = typeof config
