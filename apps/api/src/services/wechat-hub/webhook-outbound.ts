// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHmac } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'

const WEBHOOK_TIMEOUT_MS = 5_000

function isPrivateIpv4(host: string): boolean {
  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true
  return false
}

function isPrivateHost(host: string): boolean {
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true
  }
  if (normalized === '0.0.0.0' || normalized === '::' || normalized === '::1') return true
  if (isPrivateIpv4(normalized)) return true
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7))
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true
  if (/^fe[89ab][0-9a-f]:/.test(normalized) || /^fe80:/.test(normalized)) return true
  return false
}

/** 空串表示清除；只允许公网 HTTPS，阻断 localhost/内网字面量，降低 SSRF 面。 */
export function normalizeOutboundWebhookUrl(value: string): string {
  const raw = value.trim()
  if (raw.length === 0) return ''
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AppError('出站 Webhook 不是合法 URL', 400, 'WECHAT_WEBHOOK_URL_INVALID')
  }
  if (url.protocol !== 'https:') {
    throw new AppError('出站 Webhook 必须使用 HTTPS', 400, 'WECHAT_WEBHOOK_URL_INSECURE')
  }
  if (url.username || url.password) {
    throw new AppError(
      '出站 Webhook 不允许在 URL 里带账号密码',
      400,
      'WECHAT_WEBHOOK_URL_CREDENTIALS',
    )
  }
  if (isPrivateHost(url.hostname)) {
    throw new AppError('出站 Webhook 不允许指向本机或内网地址', 400, 'WECHAT_WEBHOOK_URL_PRIVATE')
  }
  url.hash = ''
  return url.toString()
}

export function signOutboundWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function buildOutboundWebhookRequest(
  payload: unknown,
  secret?: string | null,
  now = Date.now(),
): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify(payload ?? null)
  const timestamp = String(now)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-ihui-event': 'wechat.inbound',
    'x-ihui-timestamp': timestamp,
  }
  if (secret) headers['x-ihui-signature'] = `sha256=${signOutboundWebhook(secret, timestamp, body)}`
  return { body, headers }
}

/** 单次投递，不重试；失败由调用方记录日志，避免把入站管道拖死。 */
export async function sendOutboundWebhook(
  url: string,
  payload: unknown,
  secret?: string | null,
): Promise<void> {
  const { body, headers } = buildOutboundWebhookRequest(payload, secret)
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`出站 Webhook HTTP ${response.status}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
