// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 冷启动分两半：列表和深链各自取证，互不补猜。
 * 列表没量到不得显示成空，深链没量到不得猜上次路径。
 */

export interface ColdStartRow {
  id: string
  title: string
}

export interface ColdStartJudgement {
  list: 'shown' | 'unjudged'
  listReason:
    | 'ready'
    | 'list-unmeasured'
    | 'version-unmeasured'
    | 'time-unmeasured'
    | 'items-unmeasured'
    | 'row-unmeasured'
  items: null | readonly ColdStartRow[]
  route: 'restore' | 'unjudged'
  routeReason: 'ready' | 'route-unmeasured' | 'path-unmeasured' | 'time-unmeasured'
  path: string | null
}

const LIST_VERSION = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** 只承认以单个 / 开头的站内路径；// 与 .. 都不是已取证的深链。 */
function isAppPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('..')) return false
  return true
}

function judgeList(list: unknown): Pick<ColdStartJudgement, 'list' | 'listReason' | 'items'> {
  if (list === null || !isRecord(list)) {
    return { list: 'unjudged', listReason: 'list-unmeasured', items: null }
  }
  if (typeof list.version !== 'number' || list.version !== LIST_VERSION) {
    return { list: 'unjudged', listReason: 'version-unmeasured', items: null }
  }
  if (!isFiniteNumber(list.savedAt)) {
    return { list: 'unjudged', listReason: 'time-unmeasured', items: null }
  }
  if (!Array.isArray(list.items)) {
    return { list: 'unjudged', listReason: 'items-unmeasured', items: null }
  }
  const items: ColdStartRow[] = []
  for (const row of list.items) {
    if (!isRecord(row) || !isFilledText(row.id) || !isFilledText(row.title)) {
      return { list: 'unjudged', listReason: 'row-unmeasured', items: null }
    }
    items.push({ id: row.id, title: row.title })
  }
  return { list: 'shown', listReason: 'ready', items }
}

function judgeRoute(
  route: unknown,
  listShown: boolean,
): Pick<ColdStartJudgement, 'route' | 'routeReason' | 'path'> {
  if (route === null) {
    return { route: 'unjudged', routeReason: 'route-unmeasured', path: null }
  }
  if (!isRecord(route) || !isAppPath(route.path)) {
    return { route: 'unjudged', routeReason: 'path-unmeasured', path: null }
  }
  if (!isFiniteNumber(route.savedAt)) {
    // 时刻没量到一律不恢复路径。列表自己的原因留在 listReason。
    // 列表已经显示时，路由这一侧才单独写成时刻未判定。
    if (listShown) {
      return { route: 'unjudged', routeReason: 'time-unmeasured', path: null }
    }
    return { route: 'unjudged', routeReason: 'route-unmeasured', path: null }
  }
  return { route: 'restore', routeReason: 'ready', path: route.path }
}

export function judgeColdStart(input: { list: unknown; route: unknown }): ColdStartJudgement {
  const list = judgeList(input.list)
  const route = judgeRoute(input.route, list.list === 'shown')
  return {
    list: list.list,
    listReason: list.listReason,
    items: list.items,
    route: route.route,
    routeReason: route.routeReason,
    path: route.path,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
