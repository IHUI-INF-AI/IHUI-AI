#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-screen-registration-sync.mjs —— 提交期「加了屏/路由却没登记」只读检查(2026-11-08 立)。
 *
 * 立因(结构洞,不是假想):302p 的跨端漂移门只在 push 阶段跑。提交期没有任何东西会拦住
 * 「新加一个屏幕/路由,却没在登记文件里落一行」—— 于是脏登记可以先入库,等到 push 才被
 * 漂移门按"存量"报出来,而那时的修复成本已经摊到整条链上。本门把这一格前移到提交期。
 *
 * 判据(双向同步,全部只读):
 *  ① **加了屏没登记 ⇒ 红**:本笔改动新增/改名的
 *     · web 路由页(`apps/web/app/**\/page.tsx`,登记表 `web` 键的来源面)
 *     · 共享屏 / RN 屏(`packages/app/src/features/**\/*Screen.tsx`、`apps/mobile-rn/src/screens/*Screen.tsx`)
 *     必须能在 `scripts/data/web-rn-screen-map.jsonl` 找到认领(逐条键或 `x/**` 段级豁免;
 *     RN 屏按 `rn` 字段的路径/文件名认领)。找不到 ⇒ `unregistered-web-route` / `unregistered-rn-screen`。
 *  ② **登记了幽灵键 ⇒ 红**:本笔新加的登记表键必须真有来源路由(精确键要有同名 `page.tsx`;
 *     `x/**` 段级键射程内至少一条路由)⇒ `phantom-map-key`。防"为了过门先写一行"。
 *  ③ **pages 注册面不同步 ⇒ 红**:新增的小程序页面文件必须出现在 `app.config.ts` 的 pages /
 *     subPackages 里(`unregistered-miniapp-page`);新增的 pages 条目必须有页面文件
 *     (`missing-miniapp-page`)。
 *
 * fail-closed(§0.3):登记表取不到 / JSON 解析失败 / HEAD 面登记表取不到(算不出"新加了哪些键")/
 * 路由键推导不出 ⇒ **exit 2 未判定**,绝不把"判不了"读成"通过"。
 *
 * 取材面(§0.4):默认 `--staged`(提交期判索引,本门的本职);`--worktree` 仅人工逃生舱。
 * 本文件**未接入 .husky / guardian-runner** —— 按机主指令,门全停期间只落实现与夹具,
 * 接入位置与档位等统一恢复时再定。
 *
 * 口径与 302p 同源(§0.6,零复算):web 路由的形态、语言镜像段、段级豁免射程、登记表路径
 * 一律 import 自 `check-web-rn-screen-parity.mjs` 的 `__test__`;屏/小程序面的目录常量与
 * 文件名正则 import 自 `check-cross-end-screen-coverage.mjs` 的 `__test__`。
 *
 * 运行:
 *   node scripts/check-screen-registration-sync.mjs            # 判 --staged(默认)
 *   node scripts/check-screen-registration-sync.mjs --worktree # 人工逃生舱
 *   node scripts/check-screen-registration-sync.mjs --self-test
 *   node scripts/check-screen-registration-sync.mjs --json
 * 退出码:0 同步 / 1 判红 / 2 未判定。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, Undetermined } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = join(HERE, '..')

const MAP_PATH = parity.MAP_PATH
const WEB_APP_DIR = 'apps/web/app'
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'
const MP_SRC = cov.MP_SRC
const SHARED_DIR = cov.SHARED_DIR
const RN_SCREENS = 'apps/mobile-rn/src/screens'
const SHARED_SCREEN_RE = new RegExp(`^${SHARED_DIR}/(.+)/([A-Z][A-Za-z0-9_]*Screen)\\.tsx$`)
const RN_SCREEN_RE = cov.RN_SCREEN_RE
const LANG_SEGS = parity.LANG_SEGS
const { prefixScopeOf, routeInScope } = parity

const IO_OPTS = { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }

/* ============================== 纯判据(可被夹具直接喂构造面) ============================== */

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
const base = (p) => norm(p).split('/').pop()

/** page.tsx → 登记表 web 键(与 parity.collectWebRoutes 同一形态:剥 route group、剔语言镜像)。
 * 不是 page.tsx / 落在语言镜像段 ⇒ null(调用侧区分"镜像页合法跳过"与"推不出键 ⇒ 未判定")。 */
export function routeKeyOfPage(rel) {
  const p = norm(rel)
  if (p !== `${WEB_APP_DIR}/page.tsx` && !p.endsWith('/page.tsx')) return null
  if (!p.startsWith(`${WEB_APP_DIR}/`)) return null
  const segs = p.slice(WEB_APP_DIR.length + 1, -'/page.tsx'.length).split('/').filter(Boolean)
  if (segs.some((s) => LANG_SEGS.has(s))) return null
  return segs.filter((s) => !/^\([a-z-]+\)$/.test(s)).join('/') || '(root)'
}

/** 语言镜像页是同一路由的五语复制品,不是独立屏(parity 同一口径),合法跳过 */
export function isLangMirrorPage(rel) {
  const p = norm(rel)
  if (!p.startsWith(`${WEB_APP_DIR}/`) || !p.endsWith('/page.tsx')) return false
  return p
    .slice(WEB_APP_DIR.length + 1, -'/page.tsx'.length)
    .split('/')
    .some((s) => LANG_SEGS.has(s))
}

/** 登记表是否覆盖该路由:逐条键精确相等,或 `x/**` 段级豁免的射程内(单源 prefixScopeOf/routeInScope) */
export function mapCoversRoute(route, mapRows) {
  for (const r of mapRows || []) {
    if (!r || typeof r.web !== 'string') continue
    if (r.web === route) return true
    if (r.web.endsWith('/**') && routeInScope(route, prefixScopeOf(r.web))) return true
  }
  return false
}

/** RN/共享屏是否被登记表认领:行内 `rn` 路径精确相等,或同文件名(台账允许指向共享屏或薄壳任一层) */
export function mapClaimsScreen(rel, mapRows) {
  const p = norm(rel)
  return (mapRows || []).some(
    (r) => r && typeof r.rn === 'string' && r.rn && (norm(r.rn) === p || base(r.rn) === base(p)),
  )
}

/** 新加的登记表键是否有来源:精确键要有同名路由;`x/**` 段级键射程内至少一条路由 */
export function mapKeyHasSource(key, webRoutes) {
  const routes = (webRoutes || []).map((r) => (typeof r === 'string' ? r : r.route))
  if (String(key).endsWith('/**')) {
    const scope = prefixScopeOf(key)
    return routes.some((route) => routeInScope(route, scope))
  }
  return routes.includes(key)
}

/** app.config.ts → 在册页面路由(pages + subPackages;与 coverage.collectMiniapp 同一解析式) */
export function parseMiniappRoutes(txt) {
  const text = String(txt ?? '')
  const start = text.indexOf('pages: [')
  const end = text.indexOf('subPackages')
  if (start < 0 || end < 0 || end < start) return null
  const pages = []
  for (const m of text.slice(start, end).matchAll(/'([^']+)'/g)) {
    if (m[1].startsWith('pages/')) pages.push(m[1])
  }
  for (const m of text.matchAll(/root:\s*'([^']+)',\s*pages:\s*\[([\s\S]*?)\]/g)) {
    for (const p of m[2].matchAll(/'([^']+)'/g)) pages.push(`${m[1]}/${p[1]}`)
  }
  return pages
}

/** 小程序页面文件 → 在册路由形态(只认 `index.tsx|jsx` 与 `pages/<name>.tsx`;组件目录不算页面) */
export function miniappPageRouteOfFile(rel) {
  const p = norm(rel)
  if (!p.startsWith(`${MP_SRC}/`)) return null
  const t = p.slice(MP_SRC.length + 1)
  if (/(^|\/)components\//.test(t)) return null
  const idx = t.match(/^(.*)\/index\.(?:tsx|jsx)$/)
  if (idx) return `${idx[1]}/index`
  if (/^pages\/[^/]+\.tsx$/.test(t)) return t.replace(/\.tsx$/, '')
  return null
}

/** 登记表文本 → {rows, badLines};空表/坏行由调用侧判未判定 */
export function parseMapText(text) {
  const rows = []
  let badLines = 0
  for (const [i, raw] of String(text ?? '').split('\n').entries()) {
    const line = raw.trim()
    if (!line) continue
    try {
      const row = JSON.parse(line)
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('not an object')
      rows.push({ ...row, line: i + 1 })
    } catch {
      badLines += 1
    }
  }
  return { rows, badLines }
}

/**
 * 三面同步判据(纯函数)。
 * @returns {{state:'ok'|'regressed'|'undetermined', problems:{dim:string,detail:string,kind:string}[]}}
 */
export function judgeRegistrationSync({
  changed = [],
  webRoutes = [],
  mapRows = null,
  mapBadLines = 0,
  addedMapKeys = null,
  headMapAvailable = true,
  miniappRoutes = [],
  addedMiniappRoutes = null,
}) {
  const problems = []
  const red = (dim, detail) => problems.push({ dim, detail, kind: 'regressed' })
  const unknown = (dim, detail) => problems.push({ dim, detail, kind: 'undetermined' })

  // 登记面本身取不到/坏了 ⇒ 后面所有"有没有登记"都无从判起,只给这一条未判定。
  if (!Array.isArray(mapRows)) {
    unknown('map-unreadable', `${MAP_PATH} 在判定面取不到 ⇒ 登记面没有判据`)
    return { state: 'undetermined', problems }
  }
  if (mapBadLines > 0) {
    unknown('map-parse-error', `${MAP_PATH} 有 ${mapBadLines} 行不是合法 JSON ⇒ 登记面残缺`)
    return { state: 'undetermined', problems }
  }
  if (mapRows.length === 0) {
    unknown('map-empty', `${MAP_PATH} 是空表 ⇒ 无任何登记可对`)
    return { state: 'undetermined', problems }
  }

  const rows = changed.map((c) => (typeof c === 'string' ? { status: 'M', path: c } : c))

  // ① web 路由页:新增/改名即要求登记表覆盖
  for (const c of rows) {
    const p = norm(c.path)
    if (!p.startsWith(`${WEB_APP_DIR}/`) || !p.endsWith('/page.tsx')) continue
    const route = routeKeyOfPage(p)
    if (route === null) {
      if (!isLangMirrorPage(p)) unknown('web-route-underivable', `推不出路由键:${p}`)
      continue
    }
    if (!mapCoversRoute(route, mapRows)) {
      red(
        'unregistered-web-route',
        `web 路由 ${route}(${p})在 ${MAP_PATH} 没有逐条登记,也不在任何 x/** 段级豁免射程内`,
      )
    }
  }

  // ② RN / 共享屏:新增/改名即要求登记表某行 rn 认领
  for (const c of rows) {
    const p = norm(c.path)
    if (!SHARED_SCREEN_RE.test(p) && !RN_SCREEN_RE.test(p)) continue
    if (!mapClaimsScreen(p, mapRows)) {
      red('unregistered-rn-screen', `屏 ${p} 没有被 ${MAP_PATH} 任何一行的 rn 认领`)
    }
  }

  // ③ 小程序 pages 注册面:文件 ↔ 在册条目双向同步
  const mpEntries = Array.isArray(miniappRoutes)
    ? miniappRoutes.map((r) => (typeof r === 'string' ? { route: r, file: null } : r))
    : null
  const mpRoutes = mpEntries ? new Set(mpEntries.map((r) => r.route)) : null
  for (const c of rows) {
    const route = miniappPageRouteOfFile(c.path)
    if (!route) continue
    if (!mpRoutes) {
      unknown('miniapp-config-unreadable', `本笔触及小程序页面 ${route},但 ${MP_CONFIG} 取不到`)
      continue
    }
    if (!mpRoutes.has(route)) {
      red('unregistered-miniapp-page', `小程序页面 ${route} 未出现在 ${MP_CONFIG} 的 pages/subPackages`)
    }
  }
  for (const route of addedMiniappRoutes || []) {
    const entry = mpEntries?.find((e) => e.route === route)
    if (!entry || !entry.file) {
      red('missing-miniapp-page', `${MP_CONFIG} 新增了 ${route},但判定面上没有对应页面文件`)
    }
  }

  // ④ 反向:新加的登记表键必须有来源路由(防"先写一行过门")
  if (Array.isArray(addedMapKeys)) {
    if (!headMapAvailable) {
      unknown('map-head-unreadable', `HEAD 面 ${MAP_PATH} 取不到 ⇒ 算不出本笔新增了哪些键`)
    } else {
      for (const key of addedMapKeys) {
        if (!mapKeyHasSource(key, webRoutes)) {
          red('phantom-map-key', `登记表新增键 ${key} 在 web 路由集里没有来源(幽灵登记)`)
        }
      }
    }
  }

  const state = problems.some((p) => p.kind === 'undetermined')
    ? 'undetermined'
    : problems.length > 0
      ? 'regressed'
      : 'ok'
  return { state, problems }
}

/* ============================== 取材面(§0.4;层内 git,不自拼裸调用) ============================== */

function faceList(face, dirPrefix, root) {
  if (face === 'worktree') {
    const baseDir = join(root, dirPrefix)
    if (!existsSync(baseDir)) return []
    const out = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, e.name)
        if (e.isDirectory()) walk(abs)
        else out.push(relative(root, abs).replace(/\\/g, '/'))
      }
    }
    walk(baseDir)
    return out.sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '-c', '--', dirPrefix]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dirPrefix]
  try {
    return gitRaw(args, root, IO_OPTS)
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .sort()
  } catch (e) {
    throw new Undetermined(`faceList(${face}, ${dirPrefix}) 取不到:${e?.message ?? e}`)
  }
}

function faceRead(face, rel, root) {
  const key = norm(rel)
  if (face === 'worktree') {
    try {
      return readFileSync(join(root, key), 'utf8')
    } catch {
      return null
    }
  }
  const spec = face === 'staged' ? `:${key}` : `HEAD:${key}`
  try {
    return catBatch(root, [spec], IO_OPTS).get(spec) ?? null
  } catch (e) {
    throw new Undetermined(`faceRead(${face}, ${key}) 取不到:${e?.message ?? e}`)
  }
}

/** 本笔改动(只取 A/M/R;删除由 302p 的登记腐烂维管,不在本门重复判) */
function changedOf(face, root) {
  const args = face === 'staged' ? ['diff', '--cached', '--name-status', '-M'] : ['diff', '--name-status', '-M']
  let out
  try {
    out = gitRaw(args, root, IO_OPTS)
  } catch (e) {
    throw new Undetermined(`取不到 ${face} 面改动清单:${e?.message ?? e}`)
  }
  const changed = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const status = parts[0].charAt(0)
    if (status === 'D') continue
    changed.push({ status, path: parts[parts.length - 1].replace(/\\/g, '/') })
  }
  return changed
}

function collectFace(face, root) {
  const webRoutes = faceList(face, WEB_APP_DIR, root)
    .filter((rel) => rel.endsWith('/page.tsx'))
    .map((rel) => ({ rel, route: routeKeyOfPage(rel) }))
    .filter((r) => r.route !== null)
  const mapText = faceRead(face, MAP_PATH, root)
  const parsed = mapText === null ? { rows: null, badLines: 0 } : parseMapText(mapText)
  const mpText = faceRead(face, MP_CONFIG, root)
  const mpRouteNames = mpText === null ? null : parseMiniappRoutes(mpText)
  const miniappRoutes = mpRouteNames === null ? null : resolveMiniappFiles(mpRouteNames, face, root)
  return { webRoutes, mapRows: parsed.rows, mapBadLines: parsed.badLines, miniappRoutes, mpText }
}

function resolveMiniappFiles(routes, face, root) {
  return routes.map((route) => {
    const cands = [`${MP_SRC}/${route}.tsx`, `${MP_SRC}/${route}/index.tsx`, `${MP_SRC}/${route}/index.jsx`]
    const file = cands.find((c) => {
      try {
        return faceRead(face, c, root) !== null
      } catch {
        return false
      }
    })
    return { route, file: file ?? null }
  })
}

/* ============================== 主流程 ============================== */

function parseArgv(argv) {
  const rootArg = argv.find((a) => a.startsWith('--root='))
  return {
    root: rootArg ? rootArg.slice('--root='.length) : DEFAULT_ROOT,
    face: argv.includes('--worktree') ? 'worktree' : 'staged',
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
  }
}

function runGate({ root, face, json }) {
  const changed = changedOf(face, root)
  const touches = (re) => changed.some((c) => re.test(c.path))
  const touchesSurface =
    touches(/^apps\/web\/app\/.*\/page\.tsx$/) ||
    touches(/^packages\/app\/src\/features\/.*Screen\.tsx$/) ||
    touches(/^apps\/mobile-rn\/src\/screens\/.*Screen\.tsx$/) ||
    touches(/^apps\/miniapp-taro\/src\//) ||
    changed.some((c) => c.path === MAP_PATH || c.path === MP_CONFIG)

  if (!touchesSurface) {
    const msg = `✅ 本笔改动不触及屏/路由面(${changed.length} 个文件),无需登记判定`
    if (json) console.log(JSON.stringify({ state: 'ok', skipped: true, changed: changed.length }))
    else console.log(msg)
    return 0
  }

  const faceData = collectFace(face, root)

  // 登记表本笔是否新增了键(需要 HEAD 面作对照)
  let addedMapKeys = null
  let headMapAvailable = true
  if (changed.some((c) => c.path === MAP_PATH)) {
    const headText = faceRead('head', MAP_PATH, root)
    if (headText === null) {
      headMapAvailable = false
      addedMapKeys = []
    } else {
      const before = parseMapText(headText)
      if (before.badLines > 0) throw new Undetermined(`HEAD 面 ${MAP_PATH} 有 ${before.badLines} 行坏 JSON`)
      const beforeKeys = new Set(before.rows.map((r) => r.web).filter((k) => typeof k === 'string'))
      addedMapKeys = (faceData.mapRows || [])
        .map((r) => r.web)
        .filter((k) => typeof k === 'string' && !beforeKeys.has(k))
    }
  }

  // app.config.ts 本笔新增的在册条目(需要 HEAD 面对照)
  let addedMiniappRoutes = null
  if (faceData.miniappRoutes && changed.some((c) => c.path === MP_CONFIG)) {
    const headText = faceRead('head', MP_CONFIG, root)
    if (headText === null) throw new Undetermined(`HEAD 面 ${MP_CONFIG} 取不到 ⇒ 算不出新增在册页`)
    const headRoutes = parseMiniappRoutes(headText)
    if (headRoutes === null) throw new Undetermined(`HEAD 面 ${MP_CONFIG} 解析失败 ⇒ 算不出新增在册页`)
    const before = new Set(headRoutes)
    addedMiniappRoutes = faceData.miniappRoutes.map((r) => r.route).filter((r) => !before.has(r))
  }

  const verdict = judgeRegistrationSync({
    changed,
    webRoutes: faceData.webRoutes,
    mapRows: faceData.mapRows,
    mapBadLines: faceData.mapBadLines,
    addedMapKeys,
    headMapAvailable,
    miniappRoutes: faceData.miniappRoutes,
    addedMiniappRoutes,
  })

  if (json) {
    console.log(JSON.stringify({ state: verdict.state, problems: verdict.problems }, null, 2))
  } else if (verdict.state === 'ok') {
    console.log(`✅ 屏/路由登记同步(${face} 面;改动 ${changed.length} 个文件)`)
  } else if (verdict.state === 'regressed') {
    console.error(`❌ 屏/路由登记不同步(${verdict.problems.length} 项):`)
    for (const p of verdict.problems) console.error(`  · [${p.dim}] ${p.detail}`)
    console.error(`  出路:补齐 ${MAP_PATH} 的登记行(或 app.config.ts 的在册条目),再提交。`)
  } else {
    console.error('⚠️ 未判定(exit 2,不等于通过):')
    for (const p of verdict.problems) console.error(`  · [${p.dim}] ${p.detail}`)
  }

  return verdict.state === 'ok' ? 0 : verdict.state === 'regressed' ? 1 : 2
}

/* ============================== 自检 ============================== */

function selfTest() {
  let pass = 0
  const t = (name, fn) => {
    try {
      fn()
      pass += 1
      console.log(`✓ ${name}`)
    } catch (e) {
      console.error(`✗ ${name}: ${e?.message ?? e}`)
      process.exitCode = 1
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg ?? ''} 期望 ${b},实得 ${a}`)
  }
  const assert = (v, msg) => {
    if (!v) throw new Error(msg)
  }
  const MAP = [{ web: 'home', status: 'aligned', rn: 'apps/mobile-rn/src/screens/HomeScreen.tsx' }]

  t('S1 只加 web 屏不登记 ⇒ regressed 并点名', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/new-feature/page.tsx' }],
      webRoutes: [{ route: 'home', rel: 'apps/web/app/home/page.tsx' }],
      mapRows: MAP,
    })
    eq(r.state, 'regressed')
    assert(r.problems.some((p) => p.dim === 'unregistered-web-route' && p.detail.includes('new-feature')))
  })
  t('S2 加屏且登记 ⇒ ok', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/new-feature/page.tsx' }],
      webRoutes: [{ route: 'new-feature', rel: 'apps/web/app/new-feature/page.tsx' }],
      mapRows: [...MAP, { web: 'new-feature', status: 'gap', note: '判过缺屏' }],
    })
    eq(r.state, 'ok')
  })
  t('S3 登记表取不到 ⇒ undetermined(不是 ok)', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/new-feature/page.tsx' }],
      mapRows: null,
    })
    eq(r.state, 'undetermined')
    eq(r.problems[0].dim, 'map-unreadable')
  })
  t('S4 登记表 JSON 坏行 ⇒ undetermined', () => {
    const r = judgeRegistrationSync({ changed: [], mapRows: MAP, mapBadLines: 1 })
    eq(r.state, 'undetermined')
    eq(r.problems[0].dim, 'map-parse-error')
  })
  t('S5 段级豁免覆盖新路由 ⇒ ok', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/admin/new/page.tsx' }],
      webRoutes: [{ route: 'admin/new', rel: 'apps/web/app/admin/new/page.tsx' }],
      mapRows: [...MAP, { web: 'admin/**', status: 'excluded', reason: '管理端不承载' }],
    })
    eq(r.state, 'ok')
  })
  t('S6 语言镜像页合法跳过 ⇒ ok', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/web/app/en/home/page.tsx' }],
      webRoutes: [],
      mapRows: MAP,
    })
    eq(r.state, 'ok')
  })
  t('S7 新 RN 屏没被 rn 认领 ⇒ regressed', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/mobile-rn/src/screens/NewScreen.tsx' }],
      mapRows: MAP,
    })
    eq(r.state, 'regressed')
    assert(r.problems.some((p) => p.dim === 'unregistered-rn-screen'))
  })
  t('S8 RN 屏被某行 rn 认领 ⇒ ok', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/mobile-rn/src/screens/HomeScreen.tsx' }],
      mapRows: MAP,
    })
    eq(r.state, 'ok')
  })
  t('S9 小程序新页没进 app.config ⇒ regressed', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/miniapp-taro/src/pages/new-page/index.tsx' }],
      mapRows: MAP,
      miniappRoutes: [{ route: 'pages/home/index', file: 'x' }],
    })
    eq(r.state, 'regressed')
    assert(r.problems.some((p) => p.dim === 'unregistered-miniapp-page'))
  })
  t('S10 小程序新页已进 app.config ⇒ ok', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'A', path: 'apps/miniapp-taro/src/pages/new-page/index.tsx' }],
      mapRows: MAP,
      miniappRoutes: [{ route: 'pages/new-page/index', file: 'x' }],
    })
    eq(r.state, 'ok')
  })
  t('S11 app.config 新增条目但页面文件缺失 ⇒ regressed', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'M', path: MP_CONFIG }],
      mapRows: MAP,
      miniappRoutes: [{ route: 'pages/ghost/index', file: null }],
      addedMiniappRoutes: ['pages/ghost/index'],
    })
    eq(r.state, 'regressed')
    assert(r.problems.some((p) => p.dim === 'missing-miniapp-page'))
  })
  t('S12 登记表新增幽灵键 ⇒ regressed', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'M', path: MAP_PATH }],
      webRoutes: [{ route: 'home', rel: 'apps/web/app/home/page.tsx' }],
      mapRows: [...MAP, { web: 'ghost-route', status: 'gap' }],
      addedMapKeys: ['ghost-route'],
    })
    eq(r.state, 'regressed')
    assert(r.problems.some((p) => p.dim === 'phantom-map-key' && p.detail.includes('ghost-route')))
  })
  t('S13 HEAD 面登记表取不到 ⇒ undetermined', () => {
    const r = judgeRegistrationSync({
      changed: [{ status: 'M', path: MAP_PATH }],
      webRoutes: [{ route: 'home', rel: 'apps/web/app/home/page.tsx' }],
      mapRows: MAP,
      addedMapKeys: ['some-key'],
      headMapAvailable: false,
    })
    eq(r.state, 'undetermined')
    eq(r.problems[0].dim, 'map-head-unreadable')
  })
  t('S14 路由键推导与尺子同源(HEAD 面逐条比对 collectWebRoutes)', () => {
    for (const { route, rel } of parity.collectWebRoutes('head')) eq(routeKeyOfPage(rel), route, `${rel} 桶`)
  })
  t('S15 小程序 pages 解析与 coverage 同源(HEAD 面)', () => {
    const text = cov.faceRead('head', MP_CONFIG)
    assert(typeof text === 'string', 'HEAD 面 app.config.ts 读不到')
    const mine = parseMiniappRoutes(text)
    assert(Array.isArray(mine), '本文件解析失败')
    const theirs = cov.collectMiniapp('head').map((r) => r.route)
    eq(JSON.stringify([...mine].sort()), JSON.stringify([...theirs].sort()), '在册页集合')
  })
  t('S16 登记表解析与 parity.loadMapDetailed 同源(HEAD 面)', () => {
    const text = cov.faceRead('head', MAP_PATH)
    assert(typeof text === 'string', 'HEAD 面登记表读不到')
    const mine = parseMapText(text)
    eq(mine.badLines, 0, '坏行')
    const theirs = parity.loadMapDetailed('head')
    eq(JSON.stringify(mine.rows.map((r) => r.web)), JSON.stringify(theirs.rows.map((r) => r.web)), '键序')
  })

  console.log(`SELF-TEST ${pass}/16${pass === 16 ? ' PASS' : ' FAIL'}`)
  return pass === 16 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const opts = parseArgv(process.argv.slice(2))
  if (opts.selfTest) {
    process.exit(selfTest())
  }
  try {
    process.exit(runGate(opts))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 未判定(exit 2,不等于通过):${e.message}`)
      process.exit(2)
    }
    console.error(`⚠️ 未判定(exit 2,不等于通过):${e?.stack ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  judgeRegistrationSync,
  routeKeyOfPage,
  isLangMirrorPage,
  mapCoversRoute,
  mapClaimsScreen,
  mapKeyHasSource,
  parseMiniappRoutes,
  miniappPageRouteOfFile,
  parseMapText,
  MAP_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
