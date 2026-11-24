// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:仅依赖站内生成的路由表(ui-routes.generated),不适合共享
/**
 * 全站路由检索索引(2026-09-21 立)
 *
 * 背景:879 条路由此前只用于 navigate 校验、从不进上下文,模型对未列出的页面只能猜路径
 * (实测先猜 open-model-market 失败再猜中 /capability-market)。但把 879 条全铺进
 * web_ui_describe 回执是令牌灾难,故本模块提供"摘要常驻 + 按需检索"两段式:
 * - buildRouteIndex()           → total/navigable + 按顶级前缀的计数摘要(≤25 桶,不含任何完整路径)
 * - buildRouteIndex(query, n)   → 追加 top-N(≤40)命中路径,模型拿 path 再 web_ui_navigate
 * login/sso/api 等禁跳前缀(NAVIGATE_DENY_RE)从检索面整体剔除,与 navigate 校验共用同一正则。
 */
import type { UiRouteGroupCount, UiRouteIndex, UiRouteMatch } from '@ihui/types'

import { UI_ROUTES } from '@/lib/ui-routes.generated'

/** 登录/SSO/API 路径涉及凭据流转,永不允许 AI 代为跳转(ui-action-registry 与检索共用) */
export const NAVIGATE_DENY_RE = /^\/(login|sso|api)(\/|$)/i

/** 单次检索最多回传的路径条数(令牌成本硬约束) */
export const MAX_ROUTE_QUERY_RESULTS = 40

/** 摘要最多列出的前缀桶数,其余并入 '…others' 尾桶 */
const MAX_DIGEST_GROUPS = 24

/** 可导航路由子集(剔除禁跳前缀;含 :param 路由,由 matches[].param 标注) */
const navigableRoutes: typeof UI_ROUTES = UI_ROUTES.filter(
  (route) => !NAVIGATE_DENY_RE.test(route.path),
)

function buildDigestGroups(): UiRouteGroupCount[] {
  const counts = new Map<string, number>()
  for (const route of navigableRoutes) {
    const prefix = route.group || 'root'
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  const groups: UiRouteGroupCount[] = sorted
    .slice(0, MAX_DIGEST_GROUPS)
    .map(([prefix, count]) => ({ prefix, count }))
  const rest = sorted.slice(MAX_DIGEST_GROUPS)
  if (rest.length > 0) {
    groups.push({ prefix: '…others', count: rest.reduce((sum, [, c]) => sum + c, 0) })
  }
  return groups
}

/** 静态生成表 → 摘要只算一次(模块级缓存,幂等无副作用) */
const DIGEST_GROUPS: UiRouteGroupCount[] = buildDigestGroups()

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return MAX_ROUTE_QUERY_RESULTS
  return Math.max(1, Math.min(MAX_ROUTE_QUERY_RESULTS, Math.trunc(limit)))
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
}

function scoreRoute(path: string, group: string, query: string, tokens: string[]): number {
  const haystack = path.toLowerCase()
  const groupLower = (group || 'root').toLowerCase()
  let score = 0
  if (haystack === query || haystack === `/${query}`) score += 100
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 15
      if (haystack.split('/').includes(token)) score += 25
      if (haystack.startsWith(`/${token}`)) score += 20
    }
    if (groupLower === token) score += 10
  }
  if (score === 0 && query.length > 1 && haystack.includes(query)) score += 40
  return score
}

/**
 * 构建路由检索回执。
 * @param query 可选检索词(关键词/路径片段,大小写不敏感);缺省只回摘要(零完整路径)
 * @param limit 命中上限,默认且封顶 MAX_ROUTE_QUERY_RESULTS
 */
export function buildRouteIndex(query?: string, limit?: number): UiRouteIndex {
  const base: UiRouteIndex = {
    total: UI_ROUTES.length,
    navigable: navigableRoutes.length,
    groups: DIGEST_GROUPS,
    queryable: true,
  }
  const q = query?.trim().toLowerCase()
  if (!q) return base
  const tokens = tokenize(q)
  const hits: { path: string; group: string; param: boolean; score: number }[] = []
  for (const route of navigableRoutes) {
    const score = scoreRoute(route.path, route.group, q, tokens)
    if (score > 0) hits.push({ ...route, score })
  }
  hits.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1))
  const matches: UiRouteMatch[] = hits
    .slice(0, normalizeLimit(limit))
    .map(({ path, group, param }) => ({ path, group, param }))
  return { ...base, query: q, matches, matchTotal: hits.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
