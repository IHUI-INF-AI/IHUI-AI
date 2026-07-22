import { z } from 'zod'
import { logger } from '../utils/logger.js'

const optionalUrl = (def: string) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? def : v),
    z.string().refine((v) => v === '' || /^https?:\/\/.+/.test(v), 'Invalid url'),
  )

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8802),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:8801'),

  DATABASE_URL: z.string().url(),
  DATABASE_READ_REPLICA_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  REDIS_URL: z.string().url().default('redis://localhost:8811'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET 必须至少 32 字符')
    .refine(
      (v) => {
        // 仅在生产环境拒绝弱默认值/已知占位符(2026-07-21 安全审计加固)
        // 测试环境允许弱密钥(测试套件历史使用 'test-jwt-secret-...' 占位)
        if (process.env.NODE_ENV !== 'production') return true
        if (v === 'a'.repeat(32)) return false
        if (/^(.)\1+$/.test(v)) return false // 全相同字符
        if (v.toLowerCase() === 'change-me' || v.toLowerCase() === 'changeme') return false
        if (/^test[-_]/i.test(v)) return false // test- 前缀(测试密钥误用)
        if (/^dev[-_]/i.test(v)) return false // dev- 前缀
        if (/^placeholder/i.test(v)) return false
        if (/^your[-_]?secret/i.test(v)) return false // your-secret / your_secret
        return true
      },
      { message: 'JWT_SECRET 不能使用弱默认值/全相同字符/test- 前缀/已知占位符' },
    ),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .min(32, 'CREDENTIALS_ENCRYPTION_KEY 必须至少 32 字符')
    .refine(
      (v) => {
        // 仅在生产环境拒绝弱默认值/已知占位符(2026-07-21 安全审计加固)
        // 测试环境允许弱密钥(测试套件历史使用 'a'.repeat(32) 占位)
        if (process.env.NODE_ENV !== 'production') return true
        if (v === 'a'.repeat(32)) return false
        if (/^(.)\1+$/.test(v)) return false // 全相同字符(如 aaaa...)
        if (v.toLowerCase() === 'change-me' || v.toLowerCase() === 'changeme') return false
        if (/^test[-_]/i.test(v)) return false // test- 前缀(测试密钥误用)
        if (/^dev[-_]/i.test(v)) return false // dev- 前缀
        if (/^placeholder/i.test(v)) return false
        return true
      },
      { message: 'CREDENTIALS_ENCRYPTION_KEY 不能使用弱默认值/全相同字符/已知占位符' },
    ),

  AI_SERVICE_URL: z.string().url().default('http://localhost:8803'),

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

  // 邮件服务商 (auto=按收件域名智能路由国内/国外; smtp/resend/tencent 强制指定)
  MAIL_PROVIDER: z.enum(['auto', 'smtp', 'resend', 'tencent']).default('auto'),
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM: z.string().default(''),
  TENCENT_SES_SECRET_ID: z.string().default(''),
  TENCENT_SES_SECRET_KEY: z.string().default(''),
  TENCENT_SES_FROM: z.string().default(''),
  TENCENT_SES_REGION: z.string().default('ap-hongkong'),
  // 腾讯云 SES 邮件模板 ID(数字,在腾讯云 SES 控制台 → 邮件模板 创建审核通过后获得)
  // 配置后验证码邮件走 Template 模式(腾讯云默认权限);未配置则 fallback Simple(需申请权限)
  TENCENT_SES_TEMPLATE_REGISTER: z.coerce.number().optional(),
  TENCENT_SES_TEMPLATE_LOGIN: z.coerce.number().optional(),
  TENCENT_SES_TEMPLATE_RESET: z.coerce.number().optional(),

  // 微信支付 V3(全部 optional,缺失时降级 mock;wechat-pay.ts 仍直接读 process.env,此处仅校验存在性)
  WX_API_BASE: optionalUrl('https://api.mch.weixin.qq.com'),
  WX_MINI_APPID: z.string().optional().default(''),
  WX_MINI_SECRET: z.string().optional().default(''),
  WX_APP_APPID: z.string().optional().default(''),
  WX_SHOP_ID: z.string().optional().default(''),
  WX_PAY_V3_KEY: z.string().optional().default(''),
  WX_PAY_CERT_SERIAL: z.string().optional().default(''),
  WX_PAY_PRIVATE_KEY: z.string().optional().default(''),
  WX_PAY_PRIVATE_KEY_PATH: z.string().optional().default(''),
  WX_PAY_PLATFORM_CERT: z.string().optional().default(''),
  WX_PAY_PLATFORM_CERT_PATH: z.string().optional().default(''),
  WX_PAY_NOTIFY_URL: optionalUrl(''),
  WX_PAY_COURSE_NOTIFY_URL: optionalUrl(''),
  WX_ANDROID_NOTIFY_URL: optionalUrl(''),

  // 信任代理配置(2026-07-21 安全审计第十轮加固)
  // 严禁 `trustProxy: true` 一刀切 — 任意客户端可伪造 X-Forwarded-For 头绕过 IP 限流/IP 拉黑
  // 生产环境必须显式列出可信代理 IP/CIDR(逗号分隔),如:
  //   TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
  // 留空 = 不信任任何代理(直接用 socket remoteAddress,安全但反向代理场景 IP 全部一样)
  // 开发环境默认信任 127.0.0.1(本地起 nginx/cloudflared 时可识别真实 IP)
  TRUSTED_PROXIES: z.string().default('127.0.0.1,::1'),

  // Swagger / OpenAPI 文档(2026-07-21 安全审计第十轮加固)
  // 生产环境必须 SWAGGER_ENABLED=true 才暴露 /docs 路由,默认 false(避免未授权 schema 泄露)
  SWAGGER_ENABLED: z.coerce.boolean().default(false),

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
