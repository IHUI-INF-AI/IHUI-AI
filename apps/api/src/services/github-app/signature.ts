// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App webhook 签名校验(HMAC-SHA256 / `X-Hub-Signature-256`)。
 *
 * fail-closed 三条底线(AGENTS §5):
 * 1. webhook secret 未配置 => `secret_not_configured`,**绝不**因为"没配密钥"就放行;
 * 2. 缺签名头 / 头形态非法 / 摘要不匹配 => 一律拒绝,调用方回 401;
 * 3. 本模块只做纯计算,**永不抛异常**(抛给上层会变成 500,而 500 会让 GitHub 持续重投,
 *    也会把"未鉴权"伪装成"服务端故障",比 401 难发现)。
 *
 * 为什么不复用 `services/agent-event-trigger.ts` 里同名的 `verifyGitHubSignature`:
 * 那个模块的 import 链带 `db` 与 agent-runtime(鉴权原语一旦被 DB 依赖污染,单测就得 mock 数据库)。
 * 本文件是 GitHub App 专用的独立原语,零依赖;两者算法逐位一致(HMAC-SHA256 + timingSafeEqual)。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** 签名请求头(GitHub 官方头名) */
export const WEBHOOK_SIGNATURE_HEADER = 'x-hub-signature-256'

/**
 * 允许的 secret 环境变量键,**按优先级显式列举**(不得用 `GITHUB_*_SECRET` 之类的模式去猜)。
 * 第二项是仓库既有键(config.GITHUB_WEBHOOK_SECRET 已被 github-webhook.ts 使用),沿用它可以
 * 让同一套 webhook secret 同时服务"事件唤醒"与"GitHub App"两条链路。
 */
export const WEBHOOK_SECRET_ENV_KEYS = [
  'GITHUB_APP_WEBHOOK_SECRET',
  'GITHUB_WEBHOOK_SECRET',
] as const

/** GitHub 的签名头形态固定为 `sha256=<64 位十六进制>` */
const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i

export type SignatureRejection =
  'secret_not_configured' | 'missing_signature' | 'malformed_signature' | 'mismatch'

export type SignatureVerification = { ok: true } | { ok: false; reason: SignatureRejection }

/**
 * 读取 webhook secret。
 * 空串 / 全空白 / 未设置都算"未配置" => null(调用方据此回 503,而不是放行)。
 */
export function readWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of WEBHOOK_SECRET_ENV_KEYS) {
    const value = env[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

/** 从请求头里取出十六进制摘要;形态不符返回 null(视为无签名) */
export function parseSignatureHeader(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header
  if (typeof raw !== 'string') return null
  const matched = raw.trim().match(SIGNATURE_PATTERN)
  const digest = matched?.[1]
  if (!digest) return null
  return digest.toLowerCase()
}

/** 计算期望摘要(小写十六进制) */
export function computeExpectedDigestHex(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

/**
 * 校验一次 webhook 投递。
 *
 * @param rawBody 原始请求体字符串(**必须**是未解析的字节,Fastify 侧用 parseAs:'string' 保证)
 * @param signatureHeader `x-hub-signature-256` 原值
 * @param secret 已配置的 webhook secret;为空即拒绝
 */
export function verifyWebhookSignature(input: {
  rawBody: string
  signatureHeader: string | string[] | undefined
  secret: string | null
}): SignatureVerification {
  const { rawBody, signatureHeader } = input
  // 与 readWebhookSecret 同一套归一(读侧已 trim),否则"全空白的 secret"会被当成有效密钥去算 HMAC
  const secret = input.secret?.trim() ?? ''
  if (!secret) return { ok: false, reason: 'secret_not_configured' }

  const provided = parseSignatureHeader(signatureHeader)
  if (!provided) {
    const raw = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
    return { ok: false, reason: raw ? 'malformed_signature' : 'missing_signature' }
  }

  const expected = computeExpectedDigestHex(rawBody, secret)
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(provided, 'utf8')
  // timingSafeEqual 在长度不等时会抛 —— 必须先比长度,这既是防崩也是防时序侧信道
  if (expectedBuf.length !== providedBuf.length) return { ok: false, reason: 'mismatch' }
  if (!timingSafeEqual(expectedBuf, providedBuf)) return { ok: false, reason: 'mismatch' }
  return { ok: true }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
