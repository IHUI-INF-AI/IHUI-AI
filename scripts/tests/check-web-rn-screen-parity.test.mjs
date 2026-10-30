// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-web-rn-screen-parity.mjs 的镜像测试(§22c:判据 import 源脚本 __test__,测试里零复算)。
//
// 两族用例:
//  · P1–P8 「门户承载识别」。立因:门户表除了静态 `path: '/x'` 条目,还住着详情 URL 组装出口
//    (`buildWebMemoryDetailUrl` ⇒ `${webBase}/memory/${encodeURIComponent(id)}`)。那条出口就是 web
//    侧 `/memory/[id]` 的承载体,而尺子原先只按静态 path 判 ⇒ 台账里这条明明有承载的行被读成
//    "RN 零承载"的 gap,自动收敛腿也结构性打不到它。本族钉的是**形状解析**本身:
//    阳性对照喂构造面(不依赖真仓现状),反向对照证明不猜。P8 于 2026-10-30 改判(原断言替
//    "假 rev 回落工作树"这一旧行为背书,现取材层已不回落,改成钉"不回落")。
//  · X/C/E/R/J「段级豁免三维」(2026-10-30 立)。立因:登记表 10 枚段级豁免前缀豁免掉 450 条 web 路由,
//    而 contradicted 只比逐条在册行 ⇒ `admin/**` 说"App 不承载"同时门户表承载 18 条 /admin*,
//    尺子照样输出 contradicted=0(盲绿);另两格是 reason 自述计数腐烂与豁免不会到期。
//    每一维成对夹具(正例必命中 + 合法行不命中),R 族是真 HEAD 面的**等式锁**(点名数 == 同一把尺
//    复算的重叠数,不硬写当前存量 ⇒ 机主修完台账它照绿,判据被摘掉它必红,已用变异试验验过牙:
//    摘门户腿 ⇒ X1/X4/X6/R2 红,摘计数维 ⇒ C1/C5 红,摘到期维 ⇒ E4/R1 红)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { __test__ as RULER } from '../check-web-rn-screen-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const GATE = join(ROOT, 'scripts', 'check-web-rn-screen-parity.mjs')

const shapes = (txt) => RULER.portalRouteShapesFrom(txt).map((r) => r.route)

test('P1 阳性对照:详情 URL 组装模板折成参数路由形状', () => {
  const txt = 'export const f = (webBase, id) => `${webBase}/memory/${encodeURIComponent(id)}`'
  assert.deepEqual(shapes(txt), ['memory/[id]'])
})

test('P2 静态 path 条目不重复计入派生集(派生只认模板)', () => {
  assert.deepEqual(shapes("const e = { path: '/rules' }"), [])
})

test('P3 首段即插值的模板不猜形状(拿不到路径就不能算承载)', () => {
  assert.deepEqual(shapes('const u = (b, p) => `${b}${p.path}`'), [])
})

test('P4 api/ 前缀是传输口不是页面承载', () => {
  assert.deepEqual(shapes('const u = (b, id) => `${b}/api/things/${id}`'), [])
})

test('P5 无插值的纯静态模板不产参数路由(它已在 path: 清单里)', () => {
  assert.deepEqual(shapes('const u = (b) => `${b}/feature-center`'), [])
})

test('P6 查询串与锚点剥掉后按路径形状归一', () => {
  assert.deepEqual(
    shapes('const u = (webBase, id) => `${webBase}/memory/${encodeURIComponent(id)}?from=app#top`'),
    ['memory/[id]'],
  )
})

test('P7 真 HEAD 面:派生集确实含 memory/[id],且静态面仍数得出上百条', () => {
  const p = RULER.collectPortalRoutes('HEAD')
  assert.notEqual(p.set, null, '门户表取不到 ⇒ 应给 null(未判定),不该冒充判过')
  assert.ok(p.rows.some((r) => r.derived && r.route === 'memory/[id]'))
  assert.ok(p.rows.filter((r) => !r.derived).length > 100)
})

test('P8 面 token 不在册 ⇒ 该面读不到(null),不回落另一个面(§0.4;2026-10-30 实测改判)', () => {
  // 本例原先钉的是「faceRead("nope-rev-x") 不报 null 而是回落盘上内容」,2026-10-30 现读已不成立:
  //   · `git cat-file --batch` 对 `nope-rev-x:<path>` 回 `missing`(实测);
  //   · 取材层把 missing 折成 null,scripts/check-cross-end-screen-coverage.mjs 的 faceRead 头注
  //     明写「读不到 = null(该面没有这份件,不回落另一个面)」。
  // 也就是说**回落那行为本身已经没了**,而它本就不该有(§0.4 取不到不回落另一个面)。
  // 所以这里改钉"不回落":哪天有人把回落接回来,这一例翻红 —— 而不是让测试继续替旧 bug 背书。
  const p = RULER.collectPortalRoutes('nope-rev-x')
  assert.equal(p.unreadable, true)
  assert.equal(p.set, null)
  assert.deepEqual(p.rows, [])
  // 同一条判据对登记表也成立(不是门户表特例),且点名给得出 why
  const m = RULER.loadMapDetailed('nope-rev-x')
  assert.equal(m.unreadable, true)
  assert.match(m.why, /web-rn-screen-map\.jsonl/)
})

/* ===================== 段级豁免三维(2026-10-30 立) =====================
 * 成对夹具纪律:每一维都有「喂一条必然命中的构造行」的正例 + 「喂合法行不命中」的反向对照,
 * 外加一枚真 HEAD 面的**等式锁**(点名数 == 同一把尺复算出的重叠数)——
 * 等式锁不硬写当前存量数字,所以机主修完台账它照样绿,而判据被人摘掉时它必翻红。
 * 判据一律 import 源脚本 __test__(§22c:测试里不许复制第二份判据)。
 */

/** 构造 web 路由集(rel 只为形状,三维判据不读它) */
const routes = (list) => list.map((route) => ({ route, rel: `apps/web/app/${route}/page.tsx` }))

const ADMIN_SCOPE = routes(['admin', 'admin/users', 'admin/orders', 'admin/ticket', 'models'])
/** 段级豁免行:reason 刻意不带自述计数,免得维一/维二两例互相牵动 */
const ADMIN_PREFIX = {
  web: 'admin/**',
  status: 'excluded',
  reason: '管理后台整段,App/小程序不承载',
  line: 1,
}

/* ---------- 维一 prefixContradicted ---------- */

test('X1 维一阳性对照:段级豁免射程内确有门户承载 ⇒ 逐条点名(前缀/行号/路由/出处)', () => {
  const got = RULER.evaluatePrefixContradictions({
    webRoutes: ADMIN_SCOPE,
    prefixRows: [ADMIN_PREFIX],
    // models 在射程外:证明点名走的是射程判据,不是"整表交集"
    portalCarried: new Set(['admin/users', 'models']),
    perRowRows: new Map(),
  })
  assert.equal(got.items.length, 1, JSON.stringify(got))
  assert.equal(got.items[0].prefix, 'admin/**')
  assert.equal(got.items[0].line, 1)
  assert.equal(got.items[0].route, 'admin/users')
  assert.equal(got.items[0].rowStatus, null)
  assert.match(got.items[0].sources.join('|'), /web-portal\.ts/)
  assert.deepEqual(got.undetermined, [])
})

test('X2 维一反向对照:射程内谁都不承载 ⇒ 零点名(维一不是"有段级行就红"的恒红面)', () => {
  const got = RULER.evaluatePrefixContradictions({
    webRoutes: ADMIN_SCOPE,
    prefixRows: [ADMIN_PREFIX],
    portalCarried: new Set(['models']),
    perRowRows: new Map(),
  })
  assert.deepEqual(got.items, [])
  assert.deepEqual(got.undetermined, [])
})

test('X3 维一:门户表取不到 ⇒ 一枚都判不出,items 必须为空且 undetermined 点名(§0.3 不记绿)', () => {
  const got = RULER.evaluatePrefixContradictions({
    webRoutes: ADMIN_SCOPE,
    prefixRows: [ADMIN_PREFIX],
    portalCarried: null,
    perRowRows: new Map([['admin/orders', { status: 'aligned', line: 77 }]]),
  })
  assert.deepEqual(got.items, [], JSON.stringify(got))
  assert.equal(got.undetermined.length, 1)
  assert.match(got.undetermined[0], /门户表取不到/)
})

test('X4 维一:台账已逐条认领 ⇒ 更具体的判定赢,不判互斥,只以 overlaps 报数(2026-10-30 收窄)', () => {
  const got = RULER.evaluatePrefixContradictions({
    webRoutes: ADMIN_SCOPE,
    prefixRows: [ADMIN_PREFIX],
    portalCarried: new Set(['admin/ticket']),
    perRowRows: new Map([['admin/ticket', { status: 'portal', line: 8 }]]),
  })
  assert.deepEqual(got.items, [], '已逐条承认承载的路由不得再算互斥(否则本维没有合法修复出口)')
  assert.equal(got.overlaps.length, 1)
  assert.equal(got.overlaps[0].route, 'admin/ticket')
  assert.equal(got.overlaps[0].rowStatus, 'portal')
  assert.equal(got.overlaps[0].rowLine, 8)
})

test('X4b 维一出口锁:把那条逐条 portal 行摘掉 ⇒ 同输入立刻翻成 1 条互斥(证明牙还在)', () => {
  const input = {
    webRoutes: ADMIN_SCOPE,
    prefixRows: [ADMIN_PREFIX],
    portalCarried: new Set(['admin/ticket']),
  }
  const withRow = RULER.evaluatePrefixContradictions({
    ...input,
    perRowRows: new Map([['admin/ticket', { status: 'portal', line: 8 }]]),
  })
  const withoutRow = RULER.evaluatePrefixContradictions({ ...input, perRowRows: new Map() })
  assert.equal(withRow.items.length, 0)
  assert.equal(withoutRow.items.length, 1, '摘掉逐条认领必须翻红,否则"承认承载"这条出路是假的')
  assert.equal(withoutRow.items[0].route, 'admin/ticket')
})

test('X5 维一:零候选不记绿(表取不到 / 表里没有段级行,两型分别点名)', () => {
  const base = {
    webRoutes: ADMIN_SCOPE,
    prefixRows: [],
    portalCarried: new Set(),
    perRowRows: new Map(),
  }
  assert.match(
    RULER.evaluatePrefixContradictions({ ...base, mapUnreadable: true }).undetermined.join('|'),
    /登记表取不到/,
  )
  assert.match(
    RULER.evaluatePrefixContradictions({ ...base, mapUnreadable: false }).undetermined.join('|'),
    /没有段级豁免行/,
  )
})

test('X6 维一接线锁:门户腿必须用 evaluateMap 手里那枚承载集(伪 portal 喂进去要能点名 ⇒ 没有偷偷再读一次表)', () => {
  const ev = RULER.evaluateMap(ADMIN_SCOPE, [ADMIN_PREFIX], [], 'head', {
    set: new Set(['admin/orders']),
    rows: [],
    unreadable: false,
  })
  assert.equal(ev.prefixContradiction.items.length, 1)
  assert.equal(ev.prefixContradiction.items[0].route, 'admin/orders')
  // 同一枚承载集也必须喂给逐条维(contradicted)与维一,故 portalCarried 键就是它
  assert.equal(ev.portalCarried.has('admin/orders'), true)
})

test('X7 维一口径锁:台账对该路由有**任何**逐条登记(哪怕是 excluded)⇒ 不判互斥,只报数;同一冲突由逐条维点名,不双报', () => {
  // 口径原话是「台账对该路由没有任何逐条认领」⇒ 逐条 excluded 行同样算"认领"
  // (它就是对这一条承载状态的判定:说"不承载")。段级维若把它再判成互斥 ⇒ 同一冲突双报,
  // 且段级维给的出路「补 status:portal 行」会造出本尺自己的维四(同一 web 键两行)红点。
  const map = [
    ADMIN_PREFIX,
    { web: 'admin/users', status: 'excluded', reason: '管理端,App 不承载', line: 2 },
  ]
  const ev = RULER.evaluateMap(ADMIN_SCOPE, map, [], 'head', {
    set: new Set(['admin/users']),
    rows: [],
    unreadable: false,
  })
  // 逐条维:门户表说承载 vs 逐条 excluded 说不承载 ⇒ 逐条维点名前缀矛盾(这一枚冲突只在这里点名)
  assert.equal(ev.contradicted.length, 1, JSON.stringify(ev.contradicted))
  assert.equal(ev.contradicted[0].web, 'admin/users')
  assert.equal(ev.contradicted[0].by, 'excluded')
  // 段级维:该路由已被逐条认领 ⇒ 不判互斥(段级只覆盖其余),只以 overlaps 报数
  assert.deepEqual(ev.prefixContradiction.items, [], '已逐条认领的路由不得再进段级互斥面')
  assert.equal(ev.prefixContradiction.overlaps.length, 1)
  assert.equal(ev.prefixContradiction.overlaps[0].route, 'admin/users')
  assert.equal(ev.prefixContradiction.overlaps[0].rowStatus, 'excluded')
  assert.equal(ev.prefixContradiction.overlaps[0].rowLine, 2)
  // 反向对照(出口锁):把那枚逐条行摘掉 ⇒ 同输入立刻翻成 1 条段级互斥(证明牙还在)
  const ev2 = RULER.evaluateMap(ADMIN_SCOPE, [ADMIN_PREFIX], [], 'head', {
    set: new Set(['admin/users']),
    rows: [],
    unreadable: false,
  })
  assert.equal(ev2.prefixContradiction.items.length, 1, '摘掉逐条登记必须翻红')
  assert.equal(ev2.prefixContradiction.items[0].route, 'admin/users')
})

/* ---------- 维四 duplicateWebKeys(同一键多行) ---------- */

test('D1 维四阳性对照:同一 web 键落两行 ⇒ 点名并给出行号/状态/载体;同状态标"副本",状态不一标"互斥"', () => {
  const ev = RULER.evaluateMap(ADMIN_SCOPE, [
    { web: 'admin/users', status: 'excluded', reason: 'A', line: 1 },
    { web: 'admin/users', status: 'excluded', reason: 'B', line: 2 },
    { web: 'admin/orders', status: 'excluded', reason: 'C', reviewBy: '2027-01-01', line: 3 },
    { web: 'admin/ticket', status: 'excluded', reason: 'D', reviewBy: '2027-01-01', line: 4 },
    { web: 'admin/ticket', status: 'gap', note: 'E', line: 5 },
  ], [], 'head', { set: null, rows: [], unreadable: false })
  const dup = ev.duplicateWebKeys
  assert.equal(dup.length, 2, JSON.stringify(dup))
  const users = dup.find((d) => d.web === 'admin/users')
  assert.deepEqual(users.lines, [1, 2])
  assert.equal(users.conflicting, false, '同状态副本不该标互斥')
  const ticket = dup.find((d) => d.web === 'admin/ticket')
  assert.equal(ticket.conflicting, true, 'excluded 与 gap 同键 = 两种互斥说法')
})

test('D2 维四反向对照:一键一行 ⇒ 零点名(维四不是"有表就红"的恒红面)', () => {
  const ev = RULER.evaluateMap(ADMIN_SCOPE, [
    { web: 'admin/users', status: 'excluded', reason: 'A', reviewBy: '2027-01-01', line: 1 },
    { web: 'admin/orders', status: 'excluded', reason: 'B', reviewBy: '2027-01-01', line: 2 },
    { web: 'admin/ticket', status: 'excluded', reason: 'C', reviewBy: '2027-01-01', line: 3 },
  ], [], 'head', { set: null, rows: [], unreadable: false })
  assert.deepEqual(ev.duplicateWebKeys, [])
})

test('D3 维四真 HEAD 面等式锁:点名数 == 按 web 键分组后 >1 的组数(独立复算,防判据被摘或虚高)', () => {
  const { ev } = headSnapshot()
  const rows = RULER.loadMap('head').filter((r) => !r.bad && r.web)
  const counts = new Map()
  for (const r of rows) counts.set(r.web, (counts.get(r.web) ?? 0) + 1)
  const recomputed = [...counts.values()].filter((n) => n > 1).length
  assert.equal(ev.duplicateWebKeys.length, recomputed, '判据读数与独立复算不等 ⇒ 有一边是坏的')
  for (const d of ev.duplicateWebKeys) {
    assert.ok(d.lines.length > 1, JSON.stringify(d))
    assert.equal(new Set(d.lines).size, d.lines.length, '同一行号不该出现两次')
    assert.equal(d.lines.length, counts.get(d.web))
  }
})

/* ---------- 维二 staleCountAssertions ---------- */

test('C1 维二阳性对照:reason 自述页数 ≠ 该段现读命中数 ⇒ 点名给登记值/现读值', () => {
  const row = { ...ADMIN_PREFIX, reason: '管理后台(5 页),App 不承载' }
  const got = RULER.evaluateStaleCounts({ webRoutes: ADMIN_SCOPE, rows: [row] })
  assert.equal(got.items.length, 1, JSON.stringify(got))
  assert.equal(got.items[0].asserted, 5)
  assert.equal(got.items[0].present, 4) // admin + admin/users + admin/orders + admin/ticket
  assert.equal(got.items[0].unit, '页')
  assert.equal(got.items[0].kind, 'prefix')
})

test('C2 维二反向对照:自述数 == 现读命中数 ⇒ 零点名(合法行不命中)', () => {
  const row = { ...ADMIN_PREFIX, reason: '管理后台(4 页),App 不承载' }
  assert.deepEqual(RULER.evaluateStaleCounts({ webRoutes: ADMIN_SCOPE, rows: [row] }).items, [])
})

test('C3 维二单位白名单:行号/张/步/状态列/指示代词「这一页」都不当计数(宁漏不误报)', () => {
  for (const reason of [
    '静态 curl 文档页(148 行),与已豁免 docs/** 段同口径',
    '六张产品卡 + hero',
    '6 状态列看板+拖拽流转+工作区锁',
    'App 若要补也是「下发端」而非这一页',
    '子代理判定@2026-10-25: 五步 checklist',
    '「E2E 隔离测试路由(零后端依赖)」',
  ])
    assert.deepEqual(RULER.countAssertionsOf(reason), [], reason)
  assert.deepEqual(RULER.countAssertionsOf(undefined), [])
})

test('C4 维二数词解析:ASCII / 中文带十百 / 组合数词,解不出一律 null 不猜', () => {
  assert.deepEqual(RULER.countAssertionsOf('共 三十七 页'), [
    { raw: '三十七 页', value: 37, unit: '页' },
  ])
  assert.deepEqual(RULER.countAssertionsOf('ai/content/edu 五页均为聚合'), [
    { raw: '五页', value: 5, unit: '页' },
  ])
  assert.deepEqual(RULER.countAssertionsOf('agent/api/manual 六段'), [
    { raw: '六段', value: 6, unit: '段' },
  ])
  assert.equal(RULER.cnNumberToInt('332'), 332)
  assert.equal(RULER.cnNumberToInt('二十'), 20)
  assert.equal(RULER.cnNumberToInt('一百零八'), 108)
  assert.equal(RULER.cnNumberToInt('abc'), null)
})

test('C5 维二「段」单位:只对段级行量下一层目录;逐条行没有段可量 ⇒ 跳过不猜', () => {
  const web = routes(['docs', 'docs/agent', 'docs/api', 'docs/api/x', 'blog'])
  const prefix = { web: 'docs/**', status: 'excluded', reason: '六段', line: 9 }
  const got = RULER.evaluateStaleCounts({ webRoutes: web, rows: [prefix] })
  assert.equal(got.items.length, 1)
  assert.equal(got.items[0].unit, '段')
  assert.equal(got.items[0].asserted, 6)
  assert.equal(got.items[0].present, 2)
  // 逐条行同措辞 ⇒ 一律不点名(否则每条 reason 里漂过"段"字的登记都成了假阳)
  const perRow = { web: 'docs', status: 'excluded', reason: '六段', line: 10 }
  assert.deepEqual(RULER.evaluateStaleCounts({ webRoutes: web, rows: [perRow] }).items, [])
})

/* ---------- 维三 missingExpiry ---------- */

test('E1 维三阳性对照:段级豁免既无 expires 也无 reviewBy ⇒ 点名 missing', () => {
  const got = RULER.evaluateMissingExpiry([ADMIN_PREFIX], '2026-10-30')
  assert.equal(got.items.length, 1)
  assert.equal(got.items[0].why, 'missing')
  assert.equal(got.items[0].web, 'admin/**')
})

test('E2 维三反向对照:未到期(两个字段名任一)⇒ 零点名;expires 优先于 reviewBy', () => {
  assert.deepEqual(
    RULER.evaluateMissingExpiry([{ ...ADMIN_PREFIX, expires: '2999-01-01' }], '2026-10-30').items,
    [],
  )
  assert.deepEqual(
    RULER.evaluateMissingExpiry([{ ...ADMIN_PREFIX, reviewBy: '2999-01-01' }], '2026-10-30').items,
    [],
  )
  // 到期日当天仍算存活(until 语义);次日才红
  assert.deepEqual(
    RULER.evaluateMissingExpiry([{ ...ADMIN_PREFIX, expires: '2026-10-30' }], '2026-10-30').items,
    [],
  )
  assert.equal(RULER.expiryOf({ expires: '2026-10-30', reviewBy: '2025-01-01' }).key, 'expires')
  assert.equal(RULER.expiryOf({ reviewBy: '2025-01-01' }).key, 'reviewBy')
  assert.equal(RULER.expiryOf({ expires: '' }), null)
})

test('E3 维三:已到期 / 形态坏 各点一档(§0.7 豁免会到期,判不了形态等同没有)', () => {
  const expired = RULER.evaluateMissingExpiry(
    [{ ...ADMIN_PREFIX, expires: '2020-01-01' }],
    '2026-10-30',
  )
  assert.equal(expired.items.length, 1)
  assert.equal(expired.items[0].why, 'expired')
  assert.equal(expired.items[0].value, '2020-01-01')
  for (const bad of ['forever', '2026-1-5', '2026/10/30', '长期']) {
    const got = RULER.evaluateMissingExpiry([{ ...ADMIN_PREFIX, reviewBy: bad }], '2026-10-30')
    assert.equal(got.items.length, 1, bad)
    assert.equal(got.items[0].why, 'malformed', bad)
  }
})

test('E4 维三射程锁:evaluateMap 只把段级行喂进到期维,逐条 excluded 一枚没挂期也只报数(§12e)', () => {
  const map = [
    ADMIN_PREFIX,
    { web: 'admin', status: 'excluded', reason: '逐条豁免一枚', line: 2 },
    { web: 'models', status: 'excluded', reason: '逐条豁免二枚', line: 3 },
  ]
  const web = routes(['admin', 'admin/users', 'models'])
  const ev = RULER.evaluateMap(web, map, [], 'head', {
    set: new Set(),
    rows: [],
    unreadable: false,
  })
  assert.equal(ev.missingExpiry.items.length, 1, '只该点段级那一枚')
  assert.match(ev.missingExpiry.items[0].web, /\*\*$/)
  assert.equal(ev.missingExpiryPerRowStock, 2) // 逐条缺期:报数,不点名
  // 反向对照:段级行补上存活期 ⇒ 点名归零,而逐条存量照旧只报数
  const healed = [{ ...ADMIN_PREFIX, expires: '2999-01-01' }, ...map.slice(1)]
  const ev2 = RULER.evaluateMap(web, healed, [], 'head', {
    set: new Set(),
    rows: [],
    unreadable: false,
  })
  assert.deepEqual(ev2.missingExpiry.items, [])
  assert.equal(ev2.missingExpiryPerRowStock, 2)
})

test('E5 维三:零候选与量具坏都不记绿', () => {
  assert.match(RULER.evaluateMissingExpiry([], '2026-10-30').undetermined.join('|'), /零候选/)
  assert.match(
    RULER.evaluateMissingExpiry([ADMIN_PREFIX], '2026-10-30T00:00:00Z').undetermined.join('|'),
    /today 形态/,
  )
})

test('E6 登记表空表与取不到同判:都不许读成"三维全绿"(§0.3)', () => {
  const m = RULER.loadMapDetailed('nope-rev-x')
  assert.equal(m.unreadable, true)
  assert.deepEqual(m.rows, [])
})

/* ---------- 真 HEAD 面:等式锁(不硬写当前存量,修完台账照样绿;摘掉判据必翻红) ---------- */

let headSnap = null
function headSnapshot() {
  if (!headSnap) {
    const webRoutes = RULER.collectWebRoutes('head')
    const map = RULER.loadMap('head')
    const rnScreens = RULER.collectRnScreens('head')
    headSnap = { webRoutes, ev: RULER.evaluateMap(webRoutes, map, rnScreens, 'head') }
  }
  return headSnap
}

test('R1 真 HEAD 面:三维输入齐备 ⇒ 两枚 undetermined 全空(取不到时绝不冒绿,取到了要能判)', () => {
  const { ev } = headSnapshot()
  assert.deepEqual(ev.prefixContradiction.undetermined, [])
  assert.deepEqual(ev.missingExpiry.undetermined, [])
  assert.ok(Array.isArray(ev.prefixContradiction.items))
  assert.ok(Array.isArray(ev.staleCount.items))
})

test('R2 盲绿锁:每一枚段级豁免,「射程 ∩ 门户承载」必须被 items+overlaps **恰好全覆盖且不重不漏**(2026-10-30 立因那一格)', () => {
  const { webRoutes, ev } = headSnapshot()
  assert.notEqual(ev.portalCarried, null)
  for (const p of ev.prefixRows) {
    const scope = RULER.prefixScopeOf(p.web)
    const overlap = RULER.routesUnderPrefix(webRoutes, scope).filter((r) => ev.portalCarried.has(r))
    const named = ev.prefixContradiction.items.filter((it) => it.prefix === p.web)
    const acked = ev.prefixContradiction.overlaps.filter((it) => it.prefix === p.web)
    const union = [...named, ...acked].map((it) => it.route).sort()
    assert.deepEqual(
      union,
      [...overlap].sort(),
      `${p.web}:门户承载重叠 ${overlap.length} 条 = 点名 ${named.length} + 已逐条承认 ${acked.length} ⇒ 少一条就是盲绿,多一条就是假阳`,
    )
    assert.equal(
      new Set(union).size,
      union.length,
      `${p.web}:同一路由既进 items 又进 overlaps ⇒ 分母被灌水`,
    )
    // items 里绝不允许出现"台账已逐条认领"的路由(更具体的判定赢;违规则本维没有修复出口)
    for (const it of named)
      assert.equal(it.rowStatus, null, `${it.route} 已逐条在册却仍判互斥:${JSON.stringify(it)}`)
  }
})

test('R3 真 HEAD 面:被点名的每条计数都必须"自述 ≠ 现读"且现读值可用同一把尺复算(防计数造假)', () => {
  const { webRoutes, ev } = headSnapshot()
  for (const it of ev.staleCount.items) {
    assert.notEqual(it.asserted, it.present, JSON.stringify(it))
    if (it.kind !== 'prefix') continue
    const scope = RULER.prefixScopeOf(it.web)
    const hits = RULER.routesUnderPrefix(webRoutes, scope)
    const recomputed =
      it.unit === '段' ? RULER.subSegmentsUnderPrefix(hits, scope).length : hits.length
    assert.equal(it.present, recomputed, `${it.web} ${it.unit} 的现读值复算不等`)
  }
})

test('R4 真 HEAD 面:到期维射程严格锁在段级行(逐条那一档永远只报数,别造恒红面)', () => {
  const { ev } = headSnapshot()
  assert.ok(ev.prefixRows.length > 0, '段级行一枚没有 ⇒ 等式锁失去意义,本例应翻红提醒')
  for (const it of ev.missingExpiry.items) assert.match(it.web, /\/\*\*$/)
  assert.ok(
    ev.missingExpiry.items.length <= ev.prefixRows.length,
    '点名数不可能超过段级行枚数(超了就是把逐条也算进来了)',
  )
  assert.equal(
    ev.missingExpiryPerRowStock,
    ev.excluded.filter((r) => RULER.expiryOf(r) === null).length,
  )
})

/* ---------- CLI 契约:--json 的键与退出码(驾驶舱在解析它) ---------- */

test('J1 CLI --json:exit 0 + 既有键名与类型一个未动 + 新键是数组', () => {
  const out = spawnSync(process.execPath, [GATE, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(out.status, 0, out.stderr.slice(0, 400))
  const json = JSON.parse(out.stdout)
  // 既有契约(类型逐条钉死,驾驶舱按这些解析)
  for (const k of ['webRoutes', 'rnScreens', 'aligned', 'excluded', 'judgedGap', 'contradicted'])
    assert.equal(typeof json[k], 'number', k)
  assert.equal(typeof json.nav, 'object')
  assert.ok(Array.isArray(json.prefixHits))
  assert.ok(Array.isArray(json.contradictedRows))
  assert.equal(typeof json.contradicted, 'number')
  // 新增契约
  for (const k of [
    'prefixContradicted',
    'prefixContradictedUndetermined',
    'staleCountAssertions',
    'missingExpiry',
  ])
    assert.ok(Array.isArray(json[k]), k)
  assert.equal(typeof json.missingExpiryPerRowStock, 'number')
  // alignedUnique(2026-10-30 立):aligned 档按 web 键去重后的承载面枚数,类型 number
  assert.equal(typeof json.alignedUnique, 'number', 'alignedUnique 必须是 number(哨兵按它比承载面)')
  assert.ok(
    json.alignedUnique <= json.aligned,
    `alignedUnique(${json.alignedUnique}) 不得大于 aligned 行数(${json.aligned})`,
  )
})

test('J2 CLI 两面旗同给 ⇒ exit 2 并点名"取材面不明"(§0.4 不允许回落另一个面)', () => {
  const out = spawnSync(process.execPath, [GATE, '--staged', '--worktree'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(out.status, 2)
  assert.match(out.stderr, /取材面不明/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
