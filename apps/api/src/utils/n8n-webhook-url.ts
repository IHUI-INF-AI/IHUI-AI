// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * n8n `webhookPath` 的唯一归一出口（F-117）。
 *
 * 立因：`/n8n/workflow/run` 曾把用户可控的 `webhookPath` 直接拼在基址后面
 * （`` `${base.origin}${body.webhookPath}` ``）。`@169.254.169.254/latest/meta-data/`
 * 会被 URL 解析成「基址=userinfo、主机=169.254.169.254」，请求仍带着
 * `X-N8N-API-KEY` —— 既是云元数据 SSRF，也是平台密钥外泄（`@attacker.example/x` 同型）。
 *
 * 判据只有一份：只接受以 `/` 开头的站内相对路径，禁止 `//`（协议相对）、`\`（URL 解析
 * 会当斜杠）、`@`（userinfo 切换）与控制字符；随后仍按原拼接语义解析，并复核 origin
 * 与凭据字段，任何主机切换一律拒绝。
 */
export class N8nWebhookPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'N8nWebhookPathError'
  }
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/
const MAX_WEBHOOK_PATH_LENGTH = 2048

/** 只判断「是否站内相对路径」，供路由 schema 与 URL 构造共用。 */
export function isSafeN8nWebhookPath(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_WEBHOOK_PATH_LENGTH) {
    return false
  }
  if (!raw.startsWith('/')) return false
  if (raw.startsWith('//')) return false
  if (raw.includes('\\')) return false
  if (raw.includes('@')) return false
  return !CONTROL_CHARS.test(raw)
}

/**
 * 构造 n8n webhook 请求 URL。合法路径保持原拼接语义（基址带路径前缀时仍在其下），
 * 非法或会切换主机的输入一律抛 `N8nWebhookPathError`。
 */
export function buildN8nWebhookUrl(origin: string, webhookPath?: string): string {
  const raw = webhookPath ?? '/webhook'
  if (!isSafeN8nWebhookPath(raw)) {
    throw new N8nWebhookPathError(
      'webhookPath 必须是以 / 开头的站内相对路径（禁止 //、@、反斜杠与绝对 URL）',
    )
  }
  let base: URL
  try {
    base = new URL(origin)
  } catch {
    throw new N8nWebhookPathError(`n8n 基址不是合法 URL: ${origin}`)
  }
  const target = new URL(`${origin}${raw}`)
  if (target.origin !== base.origin || target.username !== '' || target.password !== '') {
    throw new N8nWebhookPathError('webhookPath 不得切换到 n8n 基址以外的主机')
  }
  return target.toString()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
