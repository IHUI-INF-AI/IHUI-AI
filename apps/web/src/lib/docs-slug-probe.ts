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
 * 四态绝不并桶(AGENTS.md §0.3:取不到不猜,更不用「没查到」冒充「不存在」):
 *   'found'   —— 后端 2xx 且信封里带着这篇文档;
 *   'missing' —— 后端**明确**答复没有(HTTP 404 / 信封 code 404 / 2xx+code 0 但 data 里没这篇)
 *                ⇒ 只有它能被落成 404(见 docProbeHttpStatus);
 *   'unknown' —— 问不到(网络错误、超时、5xx、响应体解析不出)⇒ 绝不判 404:2026-11-03
 *                生产实测,若把它当 200 放行会掩盖后端故障,故落 500 显形。
 *                GET /api/docs 现读回 {"list":[]}(库里没内容)与后端不可达都不等于「这篇 slug
 *                不存在」—— 前者落 missing,后者落 unknown,两桶永不互换。
 *
 * 取数靶址与 next.config rewrites 的 /api 代理同源同靶(IHUI_API_PROXY_TARGET,默认
 * http://127.0.0.1:8802)⇒ 服务端探针与浏览器同源取数问的是同一个后端,不会两边判出两个答案。
 */
import type { DocDetail } from './content'

/**
 * 探针取数缓存窗口(秒),页面 fetch 级 revalidate 用它(段配置 revalidate 已摘除,见 page.tsx)。
 *
 * 为什么取数必须可缓存(2026-11-03 生产 500 的根因就在这):`cache:'no-store'` 的 fetch 在
 * 预渲染上下文里会让 Next 抛 DYNAMIC_SERVER_USAGE /「Page changed from static to dynamic」并
 * 把整次预渲染判死 ⇒ 生产 500(实测 digest=DYNAMIC_SERVER_USAGE)。
 * 60 秒:文档编辑最长 60s 可见(客户端 useQuery 仍会即时回源校正正文),同时避免爬虫扫未知
 * slug 把 ISR 缓存无限撑大。
 */
export const DOC_PROBE_REVALIDATE_SECONDS = 60

/**
 * 四态。'unauthorized' 单列的理由:兜底鉴权闸(auth-default-deny)在 enforce 下会把
 * `/api/docs/:slug` 拦成 401(线上 2026-11-03 实测),那是「判不出」而不是「后端坏了」,
 * 更不是「文档不存在」——单独一桶,才能既不给匿名访客假 404,也不把鉴权面伪装成 500。
 */
export type DocProbeState = 'found' | 'missing' | 'unknown' | 'unauthorized'

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
  /**
   * 是否让取数进 Next 数据缓存。RSC 面(页面)必须 true —— 预渲染上下文里 no-store 会抛
   * DYNAMIC_SERVER_USAGE 把整条路由打成 500。Proxy 面必须 false:middleware 的 fetch 没有
   * Next 数据缓存,且同一 slug 的状态要按当次请求实时判,不该被上一次请求的答复带偏。
   */
  dataCache?: boolean
}

/** 后端基址:与 next.config 的 IHUI_API_PROXY_TARGET 同一取值口径。 */
export function serverApiOrigin(env: Record<string, string | undefined> = process.env): string {
  return env.IHUI_API_PROXY_TARGET ?? 'http://127.0.0.1:8802'
}

/**
 * 纯判据:HTTP 状态码 + 响应体 → 四态。零 IO,测试直接 import 这一份(AGENTS.md §22c)。
 * 后端信封形态实测:命中 = {code:0,message:'success',data:{doc,…}};
 * 未命中 = HTTP 404 + {code:404,message:'文档不存在'};
 * 无凭据 = HTTP 401 + {code:401,…}(兜底鉴权闸,不可当成「不存在」)。
 */
export function classifyDocResponse(status: number, payload: unknown): DocProbeState {
  const envelope = (payload ?? {}) as { code?: unknown; data?: { doc?: unknown } }
  if (status === 401 || status === 403) return 'unauthorized'
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
  const {
    fetchImpl = globalThis.fetch,
    origin = serverApiOrigin(),
    timeoutMs = 5000,
    dataCache = true,
  } = options
  try {
    const res = await fetchImpl(`${origin}/api/docs/${encodeURIComponent(slug)}`, {
      // 必须可缓存:no-store 会把预渲染上下文的 DYNAMIC_SERVER_USAGE 变成生产 500
      // (2026-11-03 实测),理由见 DOC_PROBE_REVALIDATE_SECONDS 注释。超时信号照旧保留。
      ...(dataCache
        ? { cache: 'force-cache' as const, next: { revalidate: DOC_PROBE_REVALIDATE_SECONDS } }
        : {}),
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

/**
 * 四态 → HTTP 状态码的唯一判据(Proxy 面与 page 面共用,测试直接钉这一份):
 *   'found'        ⇒ null(放行,页面 200);
 *   'missing'      ⇒ 404;
 *   'unknown'      ⇒ 500(后端故障必须可见,绝不伪装成 404);
 *   'unauthorized' ⇒ null(判不出就不冒充任何结论:既不放 404,也不放 500)。
 *
 * 为什么由 Proxy 落状态码而不是 page:本应用根段/`(main)` 段都有 loading.tsx,请求期渲染的
 * notFound() 与抛错都会被流式外壳吞成 200(2026-11-03 探针矩阵 v-b/c/d/g 实测)。Proxy 在响应
 * 头发出之前就能改写状态码(rewrite 带 status 已实测生效),是唯一能给硬 404/500 的位置。
 */
export function docProbeHttpStatus(state: DocProbeState): 404 | 500 | null {
  if (state === 'missing') return 404
  if (state === 'unknown') return 500
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
