#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ui-routes-follow.mjs —— 三端路由「跟随」报告的唯一实现。
 *
 * 三端的路由表不是同一个命名空间,不能也不该由同一张表直接导出:
 *   - web:Next app 目录的 page.tsx 即真相(URL 形态 /foo/bar);
 *   - RN:RootNavigator.tsx 的 Screen name 即真相(标识符形态 Wallet);
 *   - 小程序:app.config.ts 的 pages 即真相(路径形态 /pages/index/index)。
 * 「跟随」的真实含义是两件事同时成立:
 *   ① 每端产物都能从本端真相重新生成(由 --check 证明);
 *   ② 跨端的对应关系(rn-route-map)由声明式真源(cross-end-screen-registry)生成,
 *      新增页面若没有对应关系会被本报告点名,并由 baseline 棘轮拦住「悄悄不回填」。
 *
 * 本模块只读、只计算,不做任何落盘;写盘只发生在各端生成器里。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from './face-reader.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const ARTIFACTS = [
  {
    id: 'web',
    label: 'Web ui-routes',
    rel: 'apps/web/src/lib/ui-routes.generated.ts',
    generatorRel: 'apps/web/scripts/generate-ui-routes.mjs',
    truth: 'apps/web/app/**/page.tsx',
  },
  {
    id: 'rn',
    label: 'RN ui-routes',
    rel: 'apps/mobile-rn/src/constants/ui-routes.generated.ts',
    generatorRel: 'apps/mobile-rn/scripts/generate-ui-routes.mjs',
    truth: 'apps/mobile-rn/src/navigation/RootNavigator.tsx',
  },
  {
    id: 'taro',
    label: '小程序 ui-routes',
    rel: 'apps/miniapp-taro/src/constants/ui-routes.generated.ts',
    generatorRel: 'apps/miniapp-taro/scripts/generate-ui-routes.mjs',
    truth: 'apps/miniapp-taro/src/app.config.ts',
  },
  {
    id: 'ext',
    label: 'Extension ui-routes',
    rel: 'apps/extension/lib/ext-ui-routes.generated.ts',
    generatorRel: 'apps/extension/scripts/generate-ext-ui-routes.mjs',
    truth: 'apps/extension/entrypoints/sidepanel/SidepanelApp.tsx',
  },
  {
    id: 'rn-route-map',
    label: 'RN→小程序 route-map',
    rel: 'apps/miniapp-taro/src/rn-compat/route-map.generated.ts',
    generatorRel: 'scripts/gen-rn-compat.mjs',
    truth: 'apps/mobile-rn/src/navigation/RootNavigator.tsx + scripts/data/cross-end-screen-registry.json',
  },
]

const ROUTE_MAP_SOURCE = 'scripts/data/cross-end-screen-registry.json'
const ROUTE_MAP_SUPPLEMENT = 'scripts/data/rn-route-supplement.json'
const WEB_RN_MAP = 'scripts/data/web-rn-screen-map.jsonl'

/**
 * 读仓库内文件(不存在返回 null,由调用方表态「未判定」而不是猜)。
 * face='head' 读 HEAD blob —— 基线必须记在 HEAD 面,避免把别人暂存/未提交的脏面记进账。
 */
export function readRepoFile(rel, face = 'worktree') {
  if (face === 'head') {
    try {
      // HEAD 面读取收口到共享层 gitRaw(层内统一 windowsHide + 有界 timeout + stdio 接管 +
      // 64MB 缓冲,优于裸 execFileSync 的 1MB 默认)。文件在 HEAD 不存在 ⇒ git 非零退出,
      // 照旧 catch 成 null,由调用方表态「未判定」而不是猜 —— 导出契约逐字未改。
      return gitRaw(['show', `HEAD:${rel}`], repoRoot)
    } catch {
      return null
    }
  }
  const abs = resolve(repoRoot, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}

/** 该文件在指定面上是否存在(HEAD 面用 git cat-file,工作树面用 fs) */
export function existsRepoFile(rel, face = 'worktree') {
  if (face === 'head') {
    try {
      // 存在性探测同样收口到 gitRaw:存在 ⇒ 返回真,不存在/取不到 ⇒ false,
      // 与原裸 execFileSync 的 catch 语义逐字一致(仅派生经由共享层)。
      gitRaw(['cat-file', '-e', `HEAD:${rel}`], repoRoot)
      return true
    } catch {
      return false
    }
  }
  return existsSync(resolve(repoRoot, rel))
}

/** @returns {string[]} web 端 UI_ROUTES 的 path 列表 */
export function parseWebRoutes(text) {
  return [...text.matchAll(/\{ path: '([^']+)', param: (?:true|false), group: '[^']*' \}/g)].map((m) => m[1])
}

/** @returns {string[]} RN 端 RN_UI_ROUTES 的 Screen name 列表(含多行条目,故只认 name: 字段) */
export function parseRnScreens(text) {
  return [...text.matchAll(/\bname: '([^']+)'/g)].map((m) => m[1])
}

/** @returns {string[]} 小程序端 TARO_UI_ROUTES 的 path 列表(含 / 前缀) */
export function parseTaroPages(text) {
  return [...text.matchAll(/\bpath: '([^']+)'/g)].map((m) => m[1])
}

/** @returns {string[]} 扩展端路由 path 列表 */
export function parseExtRoutes(text) {
  return [...text.matchAll(/^[ \t]*'([^']+)',?$/gm)].map((m) => m[1])
}

/** @returns {Array<{name:string, path:string}>} RN Screen → 小程序页面 */
export function parseRouteMap(text) {
  return [...text.matchAll(/^  ([A-Za-z0-9_]+): '([^']+)',?$/gm)].map((m) => ({ name: m[1], path: m[2] }))
}

/** @returns {{entries:Array<{shared:string,rn:string,miniapp:string}>, comment?:string}} */
export function parseRegistry(text) {
  const data = JSON.parse(text)
  return { entries: Array.isArray(data.entries) ? data.entries : [], comment: data.comment }
}

/** @returns {Array<{web?:string, rn?:string, status?:string, note?:string}>} */
export function parseWebRnMap(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

const uniqueSorted = (arr) => [...new Set(arr)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/**
 * 计算当前三端路由的全部读数与差集。
 * @returns {{
 *   entries: Record<string, number>,
 *   gaps: Record<string, number>,
 *   lists: Record<string, string[]>,
 *   webRnStatus: Record<string, number>,
 *   missing: string[],
 *   face: 'worktree'|'head',
 * }}
 */
export function computeFollow({ face = 'worktree' } = {}) {
  const texts = {}
  const missing = []
  for (const art of ARTIFACTS) {
    const text = readRepoFile(art.rel, face)
    if (text === null) missing.push(art.rel)
    texts[art.id] = text
  }

  const webRoutes = texts.web ? uniqueSorted(parseWebRoutes(texts.web)) : []
  const rnScreens = texts.rn ? uniqueSorted(parseRnScreens(texts.rn)) : []
  const taroPages = texts.taro ? uniqueSorted(parseTaroPages(texts.taro)) : []
  const extRoutes = texts.ext ? uniqueSorted(parseExtRoutes(texts.ext)) : []
  const routeMap = texts['rn-route-map'] ? parseRouteMap(texts['rn-route-map']) : []

  const mapNames = new Set(routeMap.map((r) => r.name))
  const mapPaths = new Set(routeMap.map((r) => r.path))
  const rnSet = new Set(rnScreens)
  const taroSet = new Set(taroPages)

  const registryText = readRepoFile(ROUTE_MAP_SOURCE, face)
  const supplementText = readRepoFile(ROUTE_MAP_SUPPLEMENT, face)
  const webRnText = readRepoFile(WEB_RN_MAP, face)

  const registry = registryText ? parseRegistry(registryText) : { entries: [] }
  const supplement = supplementText ? JSON.parse(supplementText) : {}
  const webRnRows = webRnText ? parseWebRnMap(webRnText) : []

  const registryMissingTaro = registry.entries
    .map((e) => `/${String(e.miniapp || '').replace(/^\/+/, '')}`)
    .filter((p) => taroSet.size > 0 && !taroSet.has(p))
  const registryMissingRnFile = registry.entries.filter((e) => !existsRepoFile(e.rn, face))

  const webRnStatus = {}
  for (const row of webRnRows) webRnStatus[row.status || '(none)'] = (webRnStatus[row.status || '(none)'] || 0) + 1

  const lists = {
    rnScreensWithoutRouteMap: rnScreens.filter((name) => !mapNames.has(name)),
    routeMapNamesNotInRn: uniqueSorted(routeMap.map((r) => r.name)).filter((name) => !rnSet.has(name)),
    routeMapPathsNotInTaro: uniqueSorted(routeMap.map((r) => r.path)).filter((p) => taroSet.size > 0 && !taroSet.has(p)),
    taroPagesWithoutRouteMap: taroPages.filter((p) => !mapPaths.has(p)),
    registryPagesNotInTaro: uniqueSorted(registryMissingTaro),
    registryRnFilesMissing: uniqueSorted(registryMissingRnFile.map((e) => e.rn)),
  }

  const entries = {
    webRoutes: webRoutes.length,
    rnScreens: rnScreens.length,
    taroPages: taroPages.length,
    extRoutes: extRoutes.length,
    routeMapEntries: routeMap.length,
    registryEntries: registry.entries.length,
    routeMapSupplementEntries: Object.keys(supplement?.entries || supplement || {}).length,
    webRnMapRows: webRnRows.length,
  }

  const gaps = {
    rnScreensWithoutRouteMap: lists.rnScreensWithoutRouteMap.length,
    routeMapNamesNotInRn: lists.routeMapNamesNotInRn.length,
    routeMapPathsNotInTaro: lists.routeMapPathsNotInTaro.length,
    taroPagesWithoutRouteMap: lists.taroPagesWithoutRouteMap.length,
    registryPagesNotInTaro: lists.registryPagesNotInTaro.length,
    registryRnFilesMissing: lists.registryRnFilesMissing.length,
    webRnMapPending: webRnStatus.pending || 0,
  }

  return { entries, gaps, lists, webRnStatus, missing, face }
}

/** 需要棘轮盯住的差集键:只能变少,不能变多 */
export const RATCHET_KEYS = [
    'rnScreensWithoutRouteMap',
    'routeMapNamesNotInRn',
    'routeMapPathsNotInTaro',
    'taroPagesWithoutRouteMap',
    'registryPagesNotInTaro',
    'registryRnFilesMissing',
    'webRnMapPending',
]

/**
 * 与 baseline 比较:任一对账缺口变大 ⇒ 新增未回填的路由,必须人工裁决后更新 baseline。
 * @returns {{ok:boolean, regressions:Array<{key:string, baseline:number, current:number}>}}
 */
export function compareBaseline(current, baseline) {
  const regressions = []
  for (const key of RATCHET_KEYS) {
    const before = baseline?.gaps?.[key]
    const now = current?.gaps?.[key]
    if (typeof before !== 'number' || typeof now !== 'number') continue
    if (now > before) regressions.push({ key, baseline: before, current: now })
  }
  return { ok: regressions.length === 0, regressions }
}

/** 报告固定格式(交付用,避免每次人工重新拼) */
export function formatFollowReport({ entries, gaps, lists, webRnStatus, missing, face = 'worktree' }) {
  const lines = []
  lines.push(`三端路由真源与当前读数[判定面=${face}]:`)
  lines.push(`  Web   UI_ROUTES          = ${entries.webRoutes} 条(源:apps/web/app/**/page.tsx)`)
  lines.push(`  RN    RN_UI_ROUTES       = ${entries.rnScreens} 条(源:RootNavigator.tsx)`)
  lines.push(`  小程序 TARO_UI_ROUTES     = ${entries.taroPages} 条(源:app.config.ts)`)
  lines.push(`  扩展  EXT_UI_ROUTES      = ${entries.extRoutes} 条(源:SidepanelApp.tsx)`)
  lines.push(`  跨端  RN→小程序 route-map = ${entries.routeMapEntries} 条(源:navigator ∪ registry ${entries.registryEntries} 条 ∪ supplement)`)
  lines.push(`  Web→RN 语义映射          = ${entries.webRnMapRows} 行(` +
    Object.entries(webRnStatus).map(([k, v]) => `${k} ${v}`).join(' / ') + ')')
  lines.push('')
  lines.push('当前差集(存量,按 baseline 只许减不许增):')
  lines.push(`  RN Screen 无小程序对应          : ${gaps.rnScreensWithoutRouteMap}`)
  lines.push(`  route-map 键不在 RN 白名单      : ${gaps.routeMapNamesNotInRn}${lists.routeMapNamesNotInRn.length ? ` → ${lists.routeMapNamesNotInRn.join(', ')}` : ''}`)
  lines.push(`  route-map 路径不在小程序页面表   : ${gaps.routeMapPathsNotInTaro}`)
  lines.push(`  小程序页面无 RN 对应            : ${gaps.taroPagesWithoutRouteMap}`)
  lines.push(`  registry 页面不在小程序页面表    : ${gaps.registryPagesNotInTaro}`)
  lines.push(`  registry 的 RN 文件不存在        : ${gaps.registryRnFilesMissing}`)
  lines.push(`  Web→RN 映射 pending             : ${gaps.webRnMapPending}`)
  lines.push('')
  lines.push('注:「route-map 键不在 RN 白名单」含未登录分支屏(桥接挂载时不存在,白名单有意排除,不是漏映射);')
  lines.push('    「小程序页面无 RN 对应」含 tabBar/首页/纯小程序页(平台独有),口径是如实计数而非差评。')
  if (missing.length > 0) lines.push(`  ⚠ 缺产物(未判定): ${missing.join(', ')}`)
  return lines.join('\n')
}

export const __test__ = {
  parseWebRoutes,
  parseRnScreens,
  parseTaroPages,
  parseExtRoutes,
  parseRouteMap,
  parseRegistry,
  parseWebRnMap,
  computeFollow,
  compareBaseline,
  formatFollowReport,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
