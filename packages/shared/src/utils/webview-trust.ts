// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WebView 落点信任判定 —— 跨端唯一实现(2026-11-01 安全强化)。
 *
 * 为什么要收进共享层:这条判据原先只有一份,住在小程序端
 * (`apps/miniapp-taro/src/utils/webview-trust.ts`)。RN 的 `WebViewScreen` 拿的是
 * **路由参数 `url`**,流程是"已登录 ⇒ 为该 url 的 origin 签一枚 sso_code ⇒
 * 把 code 与 redirect 一起拼进 `${origin}/sso/mobile-auth`"。
 * 也就是说:**任何**送进来的 origin 都会拿到一枚刚签出的会话授权码。
 * 小程序那侧有信任闸、RN 那侧没有 —— 同一件事两份实现,漂移的那一侧永远是安静的那一侧
 * (AGENTS §22c / §0.6)。
 *
 * 判据本身(逐条,与小程序端既有语义逐字一致):
 *  - 解析不出 URL ⇒ 不信任(不猜"应该没问题");
 *  - 尾点与大小写先归一(`AIZHS.TOP.` 与 `aizhs.top` 同权);
 *  - `http:` 仅允许回环三形态(开发态);
 *  - `https:` 要求 host ∈ (第一方集 ∪ 端侧追加集) 或落在第一方域后缀下;
 *  - 其它协议(`file:` / `data:` / `intent:` / `javascript:` / 自定义 scheme)一律不信任:
 *    它们既不该带会话,也不该被当成"站内落点"。
 *
 * 端侧策略(哪些第三方域可额外信任)由各端自己注入,机制只有这一份。
 */

/** 第一方主机集(与站内门户口径一致;新增子域请同时登记到本表)。 */
export const FIRST_PARTY_WEBVIEW_HOSTS: readonly string[] = [
  'aizhs.top',
  'www.aizhs.top',
  'api.aizhs.top',
  'ai.aizhs.top',
  'bsm.aizhs.top',
  'file.aizhs.top',
  'mcp.aizhs.top',
  'sso.aizhs.top',
]

/** 第一方域后缀:子域默认同权(与小程序端既有 `endsWith('.aizhs.top')` 同语义)。 */
export const FIRST_PARTY_WEBVIEW_DOMAIN_SUFFIX = '.aizhs.top'

/** 仅开发态放行的回环主机(http 也只在这里被允许)。 */
const LOOPBACK_WEBVIEW_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1']

export interface WebviewTrustPolicy {
  /** 端侧追加信任的第三方域(精确主机名,不做子域通配)。 */
  extraHosts?: readonly string[]
  /** 覆盖第一方域后缀(测试与非本站部署形态用)。 */
  firstPartySuffix?: string
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, '')
}

/** 该落点是否值得带上本站会话(精确判定,失败方向恒为"不信任")。 */
export function isTrustedWebviewUrl(raw: string, policy: WebviewTrustPolicy = {}): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  const host = normalizeHost(parsed.hostname)
  if (!host) return false
  if (parsed.protocol === 'http:') return LOOPBACK_WEBVIEW_HOSTS.includes(host)
  if (parsed.protocol !== 'https:') return false

  const firstPartySuffix = policy.firstPartySuffix ?? FIRST_PARTY_WEBVIEW_DOMAIN_SUFFIX
  const extras = (policy.extraHosts ?? []).map((h) => normalizeHost(h))
  if (FIRST_PARTY_WEBVIEW_HOSTS.includes(host)) return true
  if (extras.includes(host)) return true
  return host.length > firstPartySuffix.length && host.endsWith(firstPartySuffix)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
