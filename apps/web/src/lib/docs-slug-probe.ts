// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /docs/[slug] 的服务端存在性探针(2026-11-03 立,根治「不存在的 slug 返回 200 并把
 * slug 字符串原样当标题显示」的软 404)。
 *
 * 为什么判据必须住在服务端:Next 16.4.3 的 `notFound()` 文档
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md)写明
 * 「调用 `notFound()` 于流式响应开始之前才回 404;一旦从 <Suspense> 边界开始流式传输,
 * 响应就保持 200」,且该函数只登记可用于 Server Components / Server Functions / Route
 * Handlers。客户端 useQuery 取到 404 时文档早已 200 落网 ⇒ 换得了 UI 换不了状态码,
 * 爬虫侧仍是软 404。所以这一格判在 page.tsx(服务端)里。
 *
 * 三态绝不并桶(AGENTS.md §0.3:取不到不猜,更不用「没查到」冒充「不存在」):
 *   'found'   —— 后端 2xx 且信封里带着这篇文档;
 *   'missing' —— 后端**明确**答复没有(HTTP 404 / 信封 code 404 / 2xx+code 0 但 data 里没这篇)
 *                ⇒ 调用方才允许 notFound();
 *   'unknown' —— 问不到(网络错误、超时、5xx、401/403、响应体解析不出)⇒ 调用方**不得**据此
 *                判 404,原样回落客户端取数。GET /api/docs 现读回 {"list":[]}(库里没内容)
 *                与后端不可达都不等于「这篇 slug 不存在」,把整片页面打死的写法一律禁止。
 *
 * 取数靶址与 next.config rewrites 的 /api 代理同源同靶(IHUI_API_PROXY_TARGET,默认
 * http://127.0.0.1:8802)⇒ 服务端探针与浏览器同源取数问的是同一个后端,不会两边判出两个答案。
 */
import type { DocDetail } from './content'

export type DocProbeState = 'found' | 'missing' | 'unknown'

export interface DocProbeResult {
  state: DocProbeState
  /** 仅 'found' 时非空;'unknown'/'missing' 恒为 null */
  detail: DocDetail | null
}

/** 探针请求的注入面:测试打桩用,生产调用方一律缺省。 */
export interface DocProbeOptions {
  fetchImpl?: typeof fetch
  origin?: string
  timeoutMs?: number
}

/** 后端基址:与 next.config 的 IHUI_API_PROXY_TARGET 同一取值口径。 */
export function serverApiOrigin(env: Record<string, string | undefined> = process.env): string {
  return env.IHUI_API_PROXY_TARGET ?? 'http://127.0.0.1:8802'
}

/**
 * 纯判据:HTTP 状态码 + 响应体 → 三态。零 IO,测试直接 import 这一份(AGENTS.md §22c)。
 * 后端信封形态实测:命中 = {code:0,message:'success',data:{doc,…}};
 * 未命中 = HTTP 404 + {code:404,message:'文档不存在'}。
 */
export function classifyDocResponse(status: number, payload: unknown): DocProbeState {
  const envelope = (payload ?? {}) as { code?: unknown; data?: { doc?: unknown } }
  if (status === 404 || envelope.code === 404) return 'missing'
  const okRange = status >= 200 && status < 300
  if (!okRange) return 'unknown'
  if (typeof envelope.code === 'number' && envelope.code !== 0) return 'unknown'
  const doc = envelope.data?.doc
  if (doc && typeof doc === 'object') return 'found'
  // 2xx + 成功信封却不含这篇文档 = 后端明确答复「没有」
  return 'missing'
}

/** 响应体解析不出(JSON 坏/空体)⇒ 未判定,不得猜成 404。 */
function parseEnvelope(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/**
 * 按 slug 探一次文档存在性。任何取不到答案的情形(网络抛错、超时、坏 JSON)都落 'unknown',
 * 绝不落 'missing'。
 */
export async function probeDocBySlug(
  slug: string,
  options: DocProbeOptions = {},
): Promise<DocProbeResult> {
  const { fetchImpl = globalThis.fetch, origin = serverApiOrigin(), timeoutMs = 5000 } = options
  try {
    const res = await fetchImpl(`${origin}/api/docs/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text()
    const payload = parseEnvelope(text)
    if (payload === undefined && res.ok) return { state: 'unknown', detail: null }
    const state = classifyDocResponse(res.status, payload)
    if (state !== 'found') return { state, detail: null }
    const detail = (payload as { data: DocDetail }).data
    if (!detail?.doc) return { state: 'unknown', detail: null }
    return { state, detail }
  } catch {
    return { state: 'unknown', detail: null }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
