// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问埋点的「页面路径」**唯一归一判据**(2026-10-26 立)。
 *
 * 立因(生产实测,不是推测):
 *  - `visit_logs.url` 此前直接存客户端上报的原始串 ⇒ **同一页面因 query 不同被拆成多行**
 *    (`/chat` 与 `/chat?conversationId=xxx` 各占一行)。「每个页面被用了多少次」这个
 *    读数因此既虚高(页面数 235 vs 真实 ~30)又失真(排行里塞满会话级 URL)。
 *  - 历史行里留着**授权凭据**:`/?sso_code=…`、`/callback?platform=wechat&code=…&state=…`
 *    —— 它们会原样出现在管理端「页面访问排行」上,任何人登录后台就能读到授权码。
 *
 * 归一规则(逐条都有理由;新增规则请连理由一起写,别默默加一行正则):
 *  1. 空 ⇒ `null`(无可归一);
 *  2. 绝对 URL ⇒ 只取它的 path(否则 `https://host/admin/x` 这类值会让访问面分桶失准);
 *  3. 剥 fragment(`#…`):片段不是页面身份的一部分;
 *  4. 剥 query(`?…`):**同一页面的不同 query 是同一页面**(页面维度口径);
 *     凭据段(query 里的 `code` / `state` / `sig` / `sso_code`)随之一并去掉,
 *     不再落库、不再上屏;
 *  5. 去首尾空白;缺前导斜杠的补上(访问面分桶靠 `startsWith('/admin')` 这类前缀判定);
 *  6. 去尾部斜杠(根路径 `/` 保留);
 *  7. 去尾部脏分隔符(`,` `;` `、`):手工输入 / 复制粘贴噪声(`/agents,` ⇒ `/agents`);
 *  8. Next.js 路由组形态(`/(main)`、`/(marketing)`)⇒ `null`:路由组不进 URL,不是页面;
 *  9. 静态资源后缀 ⇒ `null`:不是页面(`.md/.txt/.xml/.json/.png/...`);
 * 10. 端前缀 `/rn/` `/mp/` `/ex/` **保留**:端身份的一部分(分桶靠它),不剥;
 * 11. **动态段归一**:路径里的 UUID 段与纯数字段 ⇒ `:id`。
 *     `/workspace/8cc904a4-…`、`/agents/a54b86a8-…` 是「工作区页」「智能体页」两个页面**模板**,
 *     不是 6 个页面;不归一的话,每建一个资源就多一行排行,页面数会随使用量一路虚涨。
 *     资源 id 也不该留在分析表里(与授权码同一条处置口径);要查某一行的原始 URL
 *     请看 `api_logs`(HTTP 访问日志保留完整路径)。
 *     slug 段(`/articles/my-slug`)**不归一** —— slug 是页面身份的一部分。
 *
 * 「归一不出来 ⇒ `null`」的含义是「**这不是一次页面访问**」,调用方据此:
 *  - 写入面:落库时 url 置 `null`(行仍写 ⇒ PV 不丢,但不进页面排行);
 *  - 存量清洗:同样置 `null`,而不是把噪声路径留在库里。
 *
 * 单一真相源:写入面(`apps/api/src/db/visit-tracking-queries.ts`)、存量清洗脚本
 * (`apps/api/scripts/normalize-visit-paths.mts`)与只读覆盖面尺
 * (`scripts/lib/analytics-coverage.mjs`)都从这里取,不再各写一份。
 */

import { firstIndexOfAny } from './sanitize-url'

/** 绝对 URL 的 scheme 段(`https://` / `http://`);协议相对(`//host/path`)另见下。 */
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//

/** 协议相对 URL 的开头(`//host/path`)。 */
const PROTOCOL_RELATIVE_RE = /^\/\//

/** 静态资源后缀:这些不是页面,归一判为 null。 */
const STATIC_SUFFIX_RE =
  /\.(?:png|jpe?g|gif|webp|svg|ico|css|m?js|map|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf|txt|md|xml|json|ya?ml|csv|zip|gz|webmanifest)$/i

/** Next.js 路由组段(`/(main)`):路由组不进 URL,真实路径里出现它就是噪声。 */
const ROUTE_GROUP_SEGMENT_RE = /\/\([^)]*\)/

/** 尾部脏分隔符:复制粘贴 / 手工输入的尾巴。 */
const TRAILING_NOISE_RE = /[,;、\s]+$/

/** UUID 形态段(8-4-4-4-12 hex):资源 id,不是页面身份。 */
const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 纯数字段(≥2 位):资源 id。单数字段不归一(可能是版本号之类)。 */
const NUMERIC_SEGMENT_RE = /^\d{2,}$/

/** 动态段归一后的占位符。 */
const ID_PLACEHOLDER = ':id'

/** 路径里的动态段(UUID / 纯数字)⇒ `:id`;其余段原样。 */
function collapseDynamicSegments(path: string): string {
  if (!path.includes('/')) return path
  return path
    .split('/')
    .map((segment) =>
      UUID_SEGMENT_RE.test(segment) || NUMERIC_SEGMENT_RE.test(segment) ? ID_PLACEHOLDER : segment,
    )
    .join('/')
}

/**
 * 归一一次页面路径。返回 `null` 表示「这不是一次页面访问」。
 *
 * @param raw 客户端上报的原始 url(可能是路径、也可能是带 query 的完整串)
 */
export function normalizeVisitPath(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  let value = String(raw).trim()
  if (!value) return null

  // ② 绝对 URL ⇒ 只取 path
  if (ABSOLUTE_URL_RE.test(value)) {
    const afterScheme = value.indexOf('//') + 2
    const rest = value.slice(afterScheme)
    const slashAt = rest.indexOf('/')
    value = slashAt === -1 ? '/' : rest.slice(slashAt)
  } else if (PROTOCOL_RELATIVE_RE.test(value)) {
    const rest = value.slice(2)
    const slashAt = rest.indexOf('/')
    value = slashAt === -1 ? '/' : rest.slice(slashAt)
  }

  // ③ fragment
  const hashAt = value.indexOf('#')
  if (hashAt !== -1) value = value.slice(0, hashAt)
  // ④ query(凭据段随之而去)
  const queryAt = value.indexOf('?')
  if (queryAt !== -1) value = value.slice(0, queryAt)

  value = value.trim()
  if (!value) return null

  // ⑤ 前导斜杠
  if (!value.startsWith('/')) value = `/${value}`

  // ⑦ 尾部脏分隔符(在剥尾斜杠之前,免得 `/agents,/` 留下 `,`)
  value = value.replace(TRAILING_NOISE_RE, '')

  // ⑥ 尾部斜杠(根路径 `/` 保留)
  if (value.length > 1) {
    let trimmed = value
    while (trimmed.length > 1 && trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1)
    value = trimmed
  }

  if (!value || value === '/') return '/'

  // ⑧ 路由组形态
  if (ROUTE_GROUP_SEGMENT_RE.test(value)) return null
  // ⑨ 静态资源后缀
  if (STATIC_SUFFIX_RE.test(value)) return null
  // ⑩⑪ 动态段归一(UUID / 纯数字 ⇒ :id)
  return collapseDynamicSegments(value)
}

/**
 * 判断一个上报串「是否值得落成页面访问」——`normalizeVisitPath` 的布尔壳,
 * 供调用方少写一次 `!== null`。
 */
export function isVisitPathReportable(raw: string | null | undefined): boolean {
  return normalizeVisitPath(raw) !== null
}

// =============================================================================
// 访问来源判据(2026-10-26 立)
// =============================================================================

/**
 * referer → 主机名(来源分桶的唯一实现)。
 *
 * 立因(生产实测):`visit_logs.referer` 存的是**完整来源串**(路径也在里面),直接按整串
 * 分组会把同一来源拆成多行(`https://github.com/IHUI-INF-AI/IHUI-AI` 与 `https://github.com/`
 * 是两个来源,实测 148 PV 与 88 PV),读数上会读成「两个来源」而不是「一个来源的两条路径」。
 *
 * 要覆盖的形态(生产现读,不是臆想):
 *  - `https://github.com/IHUI-INF-AI/IHUI-AI` —— 常规绝对 URL;
 *  - `http://localhost:8801/chat` —— 带端口的本机;
 *  - `https://aizhs.top/settings` —— 站内;
 *  - `android-app://com.google.android.googlequicksearchbox/` —— **非 http 形态**
 *    (安卓浏览器回传);scheme 正则按 RFC 允许 `-`,故 `android-app://` 也能解析出主机;
 *  - `//host/path` —— 协议相对;
 *  - 无 scheme 的裸 host —— 容错取出。
 *
 * 端口剥掉(`localhost:8801` ⇒ `localhost`):来源按**主机**分桶,端口是本机开发细节。
 */
export function extractVisitRefererHost(referer: string | null | undefined): string | null {
  if (referer === null || referer === undefined) return null
  const value = String(referer).trim()
  if (!value) return null

  let authority: string
  if (ABSOLUTE_URL_RE.test(value)) {
    authority = value.slice(value.indexOf('//') + 2)
  } else if (PROTOCOL_RELATIVE_RE.test(value)) {
    authority = value.slice(2)
  } else {
    authority = value
  }

  // authority 到第一个 `/` `?` `#` 为止
  const cut = firstIndexOfAny(authority, ['/', '?', '#'])
  if (cut !== -1) authority = authority.slice(0, cut)
  if (!authority) return null

  // 去掉 userinfo(`user:pass@host`)
  const at = authority.lastIndexOf('@')
  if (at !== -1) authority = authority.slice(at + 1)
  if (!authority) return null

  // 去掉端口;IPv6(`[::1]`)保留方括号
  let host = authority
  const bracketEnd = authority.indexOf(']')
  if (bracketEnd !== -1) {
    host = authority.slice(0, bracketEnd + 1)
  } else {
    const colon = authority.lastIndexOf(':')
    if (colon !== -1) host = authority.slice(0, colon)
  }

  host = host.trim().toLowerCase()
  return host.length > 0 ? host : null
}

/**
 * 来源类别:
 *  - `direct`   —— 没有 referer(直接访问 / 无来源信息);
 *  - `local`    —— 本机开发流量(`localhost` / `*.localhost` / 回环地址);
 *  - `internal` —— 站内(自有域本身或其子域);
 *  - `external` —— 其它外部来源。
 *
 * `local` 单列的理由(生产实测):本机开发流量占有 referer 行的约三成
 * (`offline.localhost` 110 PV + `localhost:8801` 87 PV),混进「外部来源」会把
 * 真实推广渠道(实测 GitHub 合计 239 PV,是最大入口)的读数带偏。
 *
 * `internal` 依赖**自有域**(`selfHostSuffix`):仓内与生产 env 都**没有**站点基址配置
 * (`PUBLIC_BASE_URL` / `BASE_URL` 均未配),所以调用方必须显式传进来;
 * 传空 ⇒ 一律不判站内(把"没判"与"判过"分开,绝不把站内悄悄说成外部)。
 */
export type VisitSourceKind = 'direct' | 'local' | 'internal' | 'external'

/** 本机开发主机名:回环地址与 `localhost` 域(含 `offline.localhost` 这类)。 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

/** 自有域列表 ⇒ 归一为小写、去前导点的非空数组。 */
function normalizeSelfHosts(self: string | string[] | null | undefined): string[] {
  const list = Array.isArray(self) ? self : self ? [self] : []
  return list
    .map((item) => String(item).trim().toLowerCase().replace(/^\.+/, ''))
    .filter((item) => item.length > 0)
}

export function classifyVisitSource(
  host: string | null | undefined,
  selfHostSuffix?: string | string[] | null,
): VisitSourceKind {
  if (host === null || host === undefined) return 'direct'
  const h = String(host).trim().toLowerCase()
  if (!h) return 'direct'
  if (LOCAL_HOSTS.has(h) || h.endsWith('.localhost')) return 'local'
  for (const suffix of normalizeSelfHosts(selfHostSuffix)) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return 'internal'
  }
  return 'external'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
