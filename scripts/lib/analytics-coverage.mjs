// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 埋点覆盖面判据层(2026-10-26 立,纯函数零 IO)。
 *
 * 要回答的问题:「所有页面都有数据埋点」这句话**凭什么算成立**。
 * 只写埋点代码不算 —— 漏掉一个页面在监控面上的表现是"那个页面没人看",
 * 与"那个页面没人访问"同形,永远读不出来。本层把两件事对齐:
 *   分母 = 仓内声明的页面清单(web 路由文件 / 小程序 app.config / RN 屏名 / 插件侧栏路由)
 *   分子 = visit_logs 里真出现过的 url(按端前缀归一)
 * 差集就是"声明了却没被监控到"的候选缺口。判红权在人,本层只算集合。
 *
 * 端约定与埋点侧同源(唯一真相源在 apps/api/src/db/visit-tracking-queries.ts 的
 * `VISIT_PLATFORM_PATH_PREFIXES`):web 裸路径、RN `/rn/`、小程序 `/mp/`、插件 `/ex/`。
 */

/** 与后端分桶表一致的四档端。 */
export const ENDS = ['web', 'rn', 'mp', 'ex']

/** `/ex/` `/rn/` `/mp/` 前缀 → 端;裸路径 → web。与后端 classifyVisitPlatform 同语义。 */
export function endOfUrl(url) {
  const u = String(url ?? '')
  if (u.startsWith('/rn/')) return 'rn'
  if (u.startsWith('/mp/')) return 'mp'
  if (u.startsWith('/ex/')) return 'ex'
  return 'web'
}

/**
 * 观测 url → 与清单可比的键。
 * - 剥掉 query/hash(web 埋点写的是 `pathname + search`)
 * - 端前缀剥掉后统一成"页面键",避免 `/mp/pages/x` 与清单里的 `pages/x` 对不上
 * - 尾斜杠剥掉;空串归一为 '/'
 */
export function normalizeObservedKey(url) {
  const end = endOfUrl(url)
  let rest = String(url ?? '')
  rest = rest.split('#')[0].split('?')[0]
  if (end !== 'web') rest = rest.slice(4) // 去掉 '/rn/' 这类四字符前缀(含尾斜杠)
  rest = rest.replace(/\/+$/, '')
  if (rest === '') return end === 'web' ? '/' : rest
  return rest
}

/** web 路由文件路径(apps/web/app 之下,正斜杠)→ 路由;不是页面则返回 null。 */
export function webRouteFromFilePath(relPath) {
  if (!/(^|\/)page\.tsx?$/.test(relPath)) return null
  const dir = relPath
    .replace(/(^|\/)page\.tsx?$/, '')
    .split('/')
    .filter((seg) => seg !== '' && !/^\(.*\)$/.test(seg)) // 路由组不进 URL
    .map((seg) => seg.replace(/^\[\.\.\.(.+)\]$/, '$1').replace(/^\[(.+)\]$/, ':$1'))
    .join('/')
  return dir === '' ? '/' : '/' + dir
}

/** 从 app.config.ts 文本取小程序页面全集:主包 pages[] + 分包 root + pages[]。 */
export function miniappPagesFromConfig(text) {
  const src = String(text ?? '')
  const out = new Set()
  // 主包:顶层 `pages: [ ... ]`(取到第一个 `]` 为止,数组内不含嵌套 `]`)
  const main = src.match(/\bpages:\s*\[([^\]]*)\]/)
  if (main) {
    for (const item of main[1].matchAll(/['"]([^'"]+)['"]/g)) out.add(item[1])
  }
  // 分包:`{ root: 'pkg-ai', pages: [...] }`,可能有多段
  for (const seg of src.matchAll(/\broot:\s*['"]([^'"]+)['"]\s*,\s*pages:\s*\[([^\]]*)\]/g)) {
    const root = seg[1].replace(/\/+$/, '')
    for (const item of seg[2].matchAll(/['"]([^'"]+)['"]/g)) out.add(`${root}/${item[1]}`)
  }
  return [...out].sort()
}

/** 从 RN 导航源码取屏名(`name="X"` 形态,去重排序)。 */
export function rnScreensFromSource(text) {
  const out = new Set()
  for (const m of String(text ?? '').matchAll(/\bname="([A-Za-z][\w]*)"/g)) out.add(m[1])
  return [...out].sort()
}

/** 从插件侧栏源码取路由 path(`<Route path="x"`)。返回可直接比对的观测键。 */
export function extensionRoutesFromSource(text) {
  const out = new Set(['sidepanel']) // 根路径(未匹配任何子路由时的落点)
  for (const m of String(text ?? '').matchAll(/<Route\s+path="([^"]+)"/g)) {
    const p = m[1]
    if (!p || p.includes('*')) continue
    const joined = ('sidepanel/' + p.replace(/^\/+/, '').replace(/\/+$/, '')).replace(/\/+$/, '')
    out.add(joined)
  }
  out.add('popup')
  return [...out].sort()
}

/**
 * web 动态段(`:slug`)与实际值(`42`)的配对判据:清单里的 `:x` 段匹配观测里的任意非空段。
 * 长度不同也算不上,只有段数一致且非参数段逐字相等才算命中。
 */
export function webRouteMatches(route, observedKey) {
  const a = route.split('/').filter(Boolean)
  const b = String(observedKey ?? '')
    .split('/')
    .filter(Boolean)
  if (a.length === 0) return b.length === 0
  if (a.length !== b.length) return false
  return a.every((seg, i) => (seg.startsWith(':') ? b[i].length > 0 : seg === b[i]))
}

/**
 * 覆盖面汇总:每个端给 declared / seen / zeroVisit(声明了但窗口内零访问)/ unexpected(观测到但清单没有)。
 * `webInventory` 是路由(可能含 `:slug`),其余端是页面键。
 */
export function buildCoverage({ web = [], rn = [], mp = [], ex = [] }, observedUrls) {
  const keys = [...observedUrls].map((u) => ({
    url: u,
    end: endOfUrl(u),
    key: normalizeObservedKey(u),
  }))
  const byEnd = { web: [], rn: [], mp: [], ex: [] }
  for (const k of keys) byEnd[k.end]?.push(k.key)

  const hitFor = (end, item) => {
    const list = byEnd[end] ?? []
    return end === 'web' ? list.some((k) => webRouteMatches(item, k)) : list.includes(item)
  }

  const inventory = { web, rn, mp, ex }
  const report = {}
  for (const end of ENDS) {
    const items = inventory[end] ?? []
    const seen = new Set()
    const zeroVisit = []
    for (const item of items) {
      if (hitFor(end, item)) seen.add(item)
      else zeroVisit.push(item)
    }
    const declaredSet = new Set(items)
    const unexpected = [...new Set(byEnd[end] ?? [])].filter(
      (k) =>
        (end === 'web'
          ? [...declaredSet].some((r) => webRouteMatches(r, k))
          : declaredSet.has(k)) === false,
    )
    report[end] = {
      declared: items.length,
      seen: seen.size,
      observations: (byEnd[end] ?? []).length,
      zeroVisit: zeroVisit.sort(),
      unexpected: unexpected.sort(),
    }
  }
  return report
}

export const __test__ = {
  ENDS,
  endOfUrl,
  normalizeObservedKey,
  webRouteFromFilePath,
  miniappPagesFromConfig,
  rnScreensFromSource,
  extensionRoutesFromSource,
  webRouteMatches,
  buildCoverage,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
