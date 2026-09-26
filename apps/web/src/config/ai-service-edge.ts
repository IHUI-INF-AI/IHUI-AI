// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 公网边缘反代接线(O20 公网拓扑 · ai-service 对外能力)
//
// 为什么需要这一层(2026-09-26 实测前提,不是推测):
//   Cloudflare Tunnel 的 ingress 把 `aizhs.top/api/*` 直接送到 Fastify(apps/api 8802),
//   **其余路径才由 Next.js(apps/web 8801)承接**。所以 next.config.ts 里既有的
//   `/api/mcp/*`、`/api/connectors/*` 等 rewrites 对公网流量结构性不可见 —— 它们只在
//   「Next 是前门」的形态(dev / 服务端同源)生效。ai-service 的对外能力要公网可达,
//   就必须落在一个**不在 `/api` 之下**的命名空间,这正是本文件的 `/ai-service/*`。
//
// 白名单纪律(与 AGENTS.md §5「鉴权面公开化必须显式列举」同一条):
//   1. 逐条登记,不用前缀通配。表里每一行都对应 `packages/types/src/capability-catalog.ts`
//      里一个 `host: 'ai-service'` 且 `thirdPartyEligible: true` 的条目。
//   2. **同一 path 上若存在不可公开的方法,整条路径都不放行** —— Next.js rewrites 结构上
//      不能按 HTTP 方法分流(route match 只有 header/cookie/query/host 四种),所以
//      「GET 可公开 / POST 不可公开」的同一路径无法安全暴露,只能整条不放。
//   3. 含 `*` 或 `{param}` 的模式不放行(会静默扩成前缀匹配,正是 §5 点名的失效型)。
//   4. 默认拒绝:两个开关都不满足时返回**空数组**,即一条 rewrite 都不注册 ——
//      请求打进来由 Next 自己 404,不存在「路径通了但任何人都能调」。
//
// 鉴权边界:本层**不做任何身份判断**,只把 `Authorization` / `X-API-Key` 等凭据头原样
//   透传给上游,由 apps/ai-service 的 `JWTAuthMiddleware` + `capability_gate` 决定放行。
//   在 Next 里再实现一套「看起来像鉴权」的东西就是第二套真相(本仓最高频失效型)。
//   本文件也不得出现任何凭据值 —— 它只描述路径与环境变量名。

/** 公网边缘命名空间前缀(不得改:`.well-known` 发现卡片里对外入口按此前缀推导)。 */
export const AI_SERVICE_EDGE_PREFIX = '/ai-service'

/** 总开关环境变量名(值为 `'true'` 才接线;缺省/其他值一律不接线)。 */
export const AI_SERVICE_EDGE_ENABLED_ENV = 'IHUI_AI_SERVICE_EDGE_ENABLED'

/** 上游基址环境变量名(**刻意不给默认值** —— 给了默认值就等于默认放行)。 */
export const AI_SERVICE_EDGE_BASE_URL_ENV = 'IHUI_AI_SERVICE_EDGE_BASE_URL'

export type EdgeHttpMethod = 'GET' | 'POST'

export interface AiServiceEdgeRoute {
  /** 目录条目 scope,逐字对应 capability-catalog.ts 的 `scope` 字段。 */
  readonly scope: string
  /** 上游方法(仅记录用途:Next rewrites 不按方法分流,见上方纪律 2)。 */
  readonly method: EdgeHttpMethod
  /** ai-service 侧路径,逐字取自目录 `routes` 字段(不含方法)。 */
  readonly upstreamPath: string
  /** 为什么允许它从公网到达 —— 审阅与后来人需要的不是「行不行」,是「凭什么」。 */
  readonly rationale: string
}

/**
 * 放行的边缘路由表。
 *
 * 这张表是 `capability-catalog.ts` 的**派生态**,不是第二份决策:
 * `apps/web/tests/ai-service-edge.test.ts` 从目录现算期望集合并与本表双向对账,
 * 任何人往这里多塞一行(或目录里新增一条符合判据的能力却没同步这里)都会判红。
 */
export const AI_SERVICE_EDGE_ROUTES: readonly AiServiceEdgeRoute[] = [
  {
    scope: 'mcp:connect',
    method: 'POST',
    upstreamPath: '/api/mcp',
    rationale: '官方 MCP JSON-RPC 入口,外部 agent 凭自身凭据连接(上游 O1 已撤匿名豁免)',
  },
  {
    scope: 'mcp:connect',
    method: 'POST',
    upstreamPath: '/api/mcp/export/streamable',
    rationale: 'MCP streamable-http transport,同属 mcp:connect 声明面',
  },
  {
    scope: 'mcp:connect',
    method: 'GET',
    upstreamPath: '/api/mcp/export/sse',
    rationale: 'MCP SSE transport,同属 mcp:connect 声明面',
  },
  {
    scope: 'connectors:read',
    method: 'GET',
    upstreamPath: '/api/connectors',
    rationale: '只读连接器清单(risk=low、thirdPartyEligible=true)',
  },
]

/**
 * 因「同路径上存在不可公开方法」而被排除的上游路径(派生态,同样由测试对账)。
 *
 * 登记它而不是静默不放行:静默会让后来人以为是漏配,顺手「补上」就是造一个敞口。
 * `/api/mcp/external/servers` 的 GET 属 `connectors:read`(可公开),但同路径的 POST 属
 * `connectors:write`(thirdPartyEligible=false,语义是「注册外部 MCP server = 注入可执行
 * 工具」)。rewrites 无法按方法分流 ⇒ 整条不放。
 */
export const AI_SERVICE_EDGE_BLOCKED_PATHS: readonly string[] = ['/api/mcp/external/servers']

export interface EdgeRewrite {
  readonly source: string
  readonly destination: string
}

export type EdgeRejectReason = 'disabled-by-env' | 'base-url-unset' | 'base-url-invalid'

export type EdgeBaseResolution =
  | { readonly ok: true; readonly baseUrl: string }
  | { readonly ok: false; readonly reason: EdgeRejectReason }

/**
 * 解析上游基址。三条硬性要求,任一不满足即判「不放行」而不是「猜一个」:
 *  - 必须是绝对 http(s) URL(`new URL` 解析失败即拒);
 *  - 不得携带 userinfo(`user:pass@host` 会随 destination 进路由表,凭据面);
 *  - 不得带查询串/哈希(它们会被拼进 destination 造成语义错位)。
 * 返回去掉尾斜杠的基址,供与 upstreamPath 直接拼接。
 */
export function resolveEdgeBaseUrl(rawBaseUrl: string | undefined): EdgeBaseResolution {
  const trimmed = (rawBaseUrl ?? '').trim()
  if (!trimmed) return { ok: false, reason: 'base-url-unset' }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'base-url-invalid' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'base-url-invalid' }
  }
  if (parsed.username || parsed.password) return { ok: false, reason: 'base-url-invalid' }
  if (parsed.search || parsed.hash) return { ok: false, reason: 'base-url-invalid' }
  return { ok: true, baseUrl: trimmed.replace(/\/+$/, '') }
}

/**
 * 由环境变量决定要注册的 rewrites。
 *
 * 判序刻意为「先开关、再基址」:开关未开时连基址都不解析,避免「配了基址忘了关」
 * 这种半配置状态被读成已启用。返回空数组 = 一条都不注册 = 默认拒绝。
 */
export function buildAiServiceEdgeRewrites(
  env: Readonly<Record<string, string | undefined>>,
): readonly EdgeRewrite[] {
  if (env[AI_SERVICE_EDGE_ENABLED_ENV] !== 'true') return []
  const base = resolveEdgeBaseUrl(env[AI_SERVICE_EDGE_BASE_URL_ENV])
  if (!base.ok) return []
  return AI_SERVICE_EDGE_ROUTES.map((route) => ({
    source: `${AI_SERVICE_EDGE_PREFIX}${route.upstreamPath}`,
    destination: `${base.baseUrl}${route.upstreamPath}`,
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
