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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
