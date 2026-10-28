// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开只读接口的边缘缓存头(2026-10-21 立,承 outputs/PUBLIC-ACCESS-PERF-AUDIT-2026-10-21.md
 * §P1.3「GET 类 API 加缓存:模型列表、站点配置、公开内容」)。
 *
 * 立因:公网链路根治后 HTML 类公开页已带边缘缓存,唯独公开 GET 接口每次穿透源站 + 数据库
 * (实测 2026-10-21 两臂 `Cache-Control` 恒为缺省、`EO-Cache-Status: MISS`)。
 *
 * 为什么只这一处定义取值:同类判据在仓里出现第二份必然漂移(AGENTS §0.6)。既有 7 处
 * 行内字面量(news.ts / ai-feed.ts)属该票立项前的存量,只减不增,不得再新增副本。
 *
 * 准入纪律(AGENTS §5,调用方必须逐条自证,本模块不代为判断):
 *  1. 游客可读(该路由及其父作用域无任何鉴权 preHandler);
 *  2. 响应与访客身份无关(handler 不消费 request.userId / 凭据 / 个性化参数)——
 *     带身份语义的内容一律不许用本档,否则边缘会把登录视图喂给游客;
 *  3. 数据来自"已发布/已上架"过滤的投影查询,无 PII、无内部列;
 *  4. 只打在 2xx 成功响应上(错误/降级响应不得进共享缓存);
 *  5. 跨源请求不得进共享缓存(见 `isCrossOriginForEdgeCache`)。
 */
/**
 * 统一 60 秒档:与上游内容自身的服务端缓存/ISR 周期同量级(如 status 页 Redis 30s、
 * Next `revalidate = 60`),再长就会让"改了不生效"变成人工排障;再短则边缘命中率不涨。
 * 所有入选接口共用这一个数值 —— 逐接口自定档就是逐接口漂移。
 */
export const PUBLIC_EDGE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=60'

/**
 * 只依赖 reply 的少量成员(而不是整个 FastifyReply),这样用例能直接驱动
 * "4xx 不写头"与"跨源不写头"两档,不必再造一个 Fastify 实例。FastifyReply 天然满足本结构。
 */
export interface CacheHeaderTarget {
  statusCode: number
  header(key: string, value: string): unknown
  request?: { headers: Record<string, string | string[] | undefined> }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * 跨源请求的响应不得进共享边缘缓存(2026-10-28 立,实测承因)。
 *
 * 实测:EdgeOne 免费版的缓存键**不含 Origin** —— 先以 `Origin: http://tauri.localhost` 打
 * www.aizhs.top/api/carousels 建缓存,再以 `Origin: https://www.aizhs.top` 连发三请求全部命中同一条目
 * (`EO-Cache-Status: HIT`、`Age: 4/6/8` 递增),并把上一位访客的
 * `Access-Control-Allow-Origin: http://tauri.localhost` 原样喂给本站;反向同理,本站建的无 ACAO 条目
 * 会让桌面端拿不到它自己的 ACAO 而被浏览器拦下。源站确实发了 `Vary: Origin`,但这一档在免费额度下不被遵守。
 *
 * 于是「按访客 Origin 回显 ACAO」与「进共享缓存」只能留一个。全局 CORS 是 `credentials: true` 的
 * 按 Origin 回显,而 api-client 默认带 `credentials:'include'` —— 把 ACAO 固定成 `*` 会让**所有**跨源
 * 请求被浏览器直接拒(比原缺陷更大),所以留 CORS、砍缓存:跨源请求一律不进共享缓存。
 * 同源浏览器 GET 不发 Origin ⇒ 本站主流量与小程序/服务端臂照旧吃缓存,性能不回退。
 *
 * host 取不到或 Origin 形态解析不出时一律算跨源:少缓存一次 ≪ 把别人的凭据域喂给本站。
 */
export function isCrossOriginForEdgeCache(request?: CacheHeaderTarget['request']): boolean {
  const origin = firstHeader(request?.headers?.origin)
  if (!origin) return false
  const host = firstHeader(request?.headers?.host)
  if (!host) return true
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return true
  }
  return originHost.toLowerCase() !== host.toLowerCase()
}

/** 在成功响应上打公开边缘缓存头;非 2xx 与跨源请求一律不加(见准入纪律第 4、5 条)。返回 reply 以便链式 send。 */
export function withPublicEdgeCache<T extends CacheHeaderTarget>(reply: T): T {
  if (reply.statusCode < 400 && !isCrossOriginForEdgeCache(reply.request))
    reply.header('Cache-Control', PUBLIC_EDGE_CACHE_CONTROL)
  return reply
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
