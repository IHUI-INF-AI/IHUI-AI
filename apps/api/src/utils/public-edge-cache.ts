// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开只读接口的缓存头(2026-10-21 立,承 outputs/PUBLIC-ACCESS-PERF-AUDIT-2026-10-21.md
 * §P1.3「GET 类 API 加缓存:模型列表、站点配置、公开内容」;2026-11-13 按 F-289 改 `private`)。
 *
 * 立因:公网链路根治后 HTML 类公开页已带边缘缓存,唯独公开 GET 接口每次穿透源站 + 数据库
 * (实测 2026-10-21 两臂 `Cache-Control` 恒为缺省、`EO-Cache-Status: MISS`)。
 *
 * **为什么不再开 `public`(F-289,2026-11-13 收口)**:边缘缓存键**不含 Origin**,只要存在一条
 * 按 URL 命中的共享条目,任何异源访客都可能命中别人建立的 ACAO —— 2026-10-28 实测同 URL 先由
 * `Origin: tauri.localhost` 建立条目,本站 Origin 请求全部 `HIT` 并拿到上一位访客的 ACAO;反向
 * 同理,本站建的无 ACAO 条目会让桌面端拿不到自己的 ACAO 而被浏览器拦下。上一版只让"跨源响应
 * 不写缓存头"挡不住这条(同源/无 Origin 建的条目照样被跨源命中)。CORS 插件确实发 `Vary: Origin`,
 * 但 EdgeOne 的 Vary 特性**默认关闭、只能在规则引擎里手动启用**,源站加头不生效;缓存键又只能在
 * EO 控制台配置,源站没有任何手段把 Origin 拼进边缘键。于是「按访客 Origin 回显 ACAO」与
 * 「共享边缘缓存」不可共存,这里退到 `private`:只允许访客自己的浏览器缓存,其缓存键天然按
 * (URL, Origin) 分区,边缘/代理一律不存 ⇒ 不存在可被异源命中的共享条目。
 * 若将来在 EO 控制台启用 Vary 且把 Origin 纳入缓存键,可把本档改回 `public, s-maxage=60`。
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
 *  5. 任何响应都不得进共享缓存(见文件头 F-289 与 `isCrossOriginForEdgeCache`)。
 */
/**
 * 统一 60 秒档:与上游内容自身的服务端缓存/ISR 周期同量级(如 status 页 Redis 30s、
 * Next `revalidate = 60`),再长就会让"改了不生效"变成人工排障;再短则命中率不涨。
 * 所有入选接口共用这一个数值 —— 逐接口自定档就是逐接口漂移。
 *
 * 取值是 `private`:只允许访客自己的浏览器缓存,边缘不存(见文件头 F-289)。
 */
export const PUBLIC_READ_CACHE_CONTROL = 'private, max-age=60, stale-while-revalidate=60'

/**
 * 异源请求的响应档:里面嵌着这一位访客的 ACAO,连浏览器私有缓存也不该留下它。
 * (EdgeOne 缓存键不含 Origin ⇒ 一旦留下就可能被下一位异源访客原样收到。)
 */
export const CROSS_ORIGIN_CACHE_CONTROL = 'private, no-store'

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
 * 该请求是不是跨源(2026-10-28 立,实测承因;2026-11-13 F-289 后只决定"连浏览器缓存也关掉")。
 *
 * 实测:EdgeOne 免费版的缓存键**不含 Origin** —— 先以 `Origin: http://tauri.localhost` 打
 * www.aizhs.top/api/carousels 建缓存,再以 `Origin: https://www.aizhs.top` 连发三请求全部命中同一条目
 * (`EO-Cache-Status: HIT`、`Age: 4/6/8` 递增),并把上一位访客的
 * `Access-Control-Allow-Origin: http://tauri.localhost` 原样喂给本站;反向同理,本站建的无 ACAO 条目
 * 会让桌面端拿不到它自己的 ACAO 而被浏览器拦下。源站确实发了 `Vary: Origin`,但这一档在免费额度下不被遵守。
 *
 * 于是「按访客 Origin 回显 ACAO」与「进共享缓存」只能留一个。全局 CORS 是 `credentials: true` 的
 * 按 Origin 回显,而 api-client 默认带 `credentials:'include'` —— 把 ACAO 固定成 `*` 会让**所有**跨源
 * 请求被浏览器直接拒(比原缺陷更大),所以留 CORS、砍缓存。
 * 2026-11-13(F-289)进一步收口:共享档整个撤掉(同源/无 Origin 也不再 `public`,见文件头),
 * 本判据现在只负责把异源响应压到 `private, no-store`。
 *
 * host 取不到或 Origin 形态解析不出时一律算跨源:少缓存一次 ≪ 把别人的凭据域喂给本站。
 */
function isCrossOriginForEdgeCache(request?: CacheHeaderTarget['request']): boolean {
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

/**
 * 在成功响应上打缓存头;非 2xx 一律不加(准入纪律第 4 条)。
 *
 * 函数名沿用(9 个路由的调用点与本票无关,不因改名扩大改动面),但**不再开共享边缘缓存**:
 * 异源 → `private, no-store`;无 Origin / 同源 → `private, max-age=60`(F-289,见文件头)。
 * 返回 reply 以便链式 send。
 */
export function withPublicEdgeCache<T extends CacheHeaderTarget>(reply: T): T {
  if (reply.statusCode < 400)
    reply.header(
      'Cache-Control',
      isCrossOriginForEdgeCache(reply.request)
        ? CROSS_ORIGIN_CACHE_CONTROL
        : PUBLIC_READ_CACHE_CONTROL,
    )
  return reply
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
