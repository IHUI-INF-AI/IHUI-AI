// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门户维收敛「候选集编排」的镜像测试(2026-10-31 立)。
//
// 立因:门户收敛腿的候选集以前只看**逐条**行,段级豁免罩着的路由进不了候选 —— 机器永远补不了
// 那 28 条"被门户表推翻的段级豁免"(2026-10-30 只能人工逐条补)。2026-10-31 把这段编排抽成
// scripts/lib/cross-end-portal-plan.mjs 纯函数,本文件用**构造面**把它钉住。
//
// 判据零复算(§0.6 / §22c):本文件不自己写一遍"哪条路由落在哪枚段级豁免射程内"的匹配式。
// 段级候选由**尺子那一份**判据产出 —— scripts/check-web-rn-screen-parity.mjs 导出的
// evaluatePrefixContradictions(纯函数)—— 本文件只调它,不复制它。
// 被审对象是 lib 的编排(谁该被补/谁该让位/幂等),不是射程匹配本身。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as parity } from '../check-web-rn-screen-parity.mjs'
import { __test__ as portalPlan } from '../lib/cross-end-portal-plan.mjs'

const TODAY = '2026-10-31'

/** 构造一枚段级行(通配 web 键 + status=excluded + reason)—— 形状与台账现读一致。 */
const prefixRow = (web, reason = '段级豁免') => ({
  web,
  status: 'excluded',
  reason,
  line: 1,
})
/** 构造一枚逐条行。 */
const perRow = (web, status, extra = {}) => ({ web, status, line: 1, ...extra })

/**
 * 用**尺子那一份**判据产出段级互斥候选(§0.6:测试不复制射程匹配)。
 * @param {object} p
 * @param {string[]} p.routes 路由集
 * @param {object[]} p.prefixRows 段级行
 * @param {Set<string>} p.portalCarried 门户承载集
 * @param {Map<string,{status:string,line:number}>} p.perRowRows 逐条认领索引
 */
const prefixItemsOf = ({ routes, prefixRows, portalCarried, perRowRows }) =>
  parity.evaluatePrefixContradictions({
    webRoutes: routes.map((r) => ({ route: r })),
    prefixRows,
    portalCarried,
    perRowRows,
    mapUnreadable: false,
  }).items

test('M1 段级互斥被看见:门户承载 ∧ 落在段级射程内 ∧ 台账零逐条认领 ⇒ 产出候选', () => {
  const routes = ['admin/users', 'admin/orders', 'other/page']
  const portalCarried = new Set(['admin/users', 'admin/orders'])
  const items = prefixItemsOf({
    routes,
    prefixRows: [prefixRow('admin/**')],
    portalCarried,
    perRowRows: new Map(),
  })
  assert.equal(items.length, 2, '两条门户承载的 admin 路由都应被看见')
  assert.deepEqual(
    items.map((i) => i.route).sort(),
    ['admin/orders', 'admin/users'],
    '候选集只含门户表承载的那些路由',
  )
  const out = portalPlan.planPrefixFamily({
    prefixItems: items,
    effectiveAnyWebs: new Set(),
    today: TODAY,
  })
  assert.equal(out.plan.length, 2, '两条都进候选')
  assert.equal(out.plan[0].family, portalPlan.PORTAL_FAMILY_PREFIX, '族名可追责')
  for (const p of out.plan) {
    assert.equal(p.row.status, 'portal', '补出来的必须是 portal 行')
    assert.match(p.row.reason, /段级豁免 admin\/\*\*/, 'reason 点名是哪枚段级豁免罩着它')
    assert.equal(p.row.at, TODAY)
  }
})

test('M2 补行正确且段级行逐字未变:段级豁免行只读,本腿只产逐条 portal 行', () => {
  const routes = ['admin/users']
  const items = prefixItemsOf({
    routes,
    prefixRows: [prefixRow('admin/**')],
    portalCarried: new Set(['admin/users']),
    perRowRows: new Map(),
  })
  const out = portalPlan.planPrefixFamily({ prefixItems: items, effectiveAnyWebs: new Set(), today: TODAY })
  // 本族产出的每一行都是**逐条** portal 行,web 键是真实路由名(不是通配串)
  for (const p of out.plan) {
    assert.equal(p.row.web, 'admin/users')
    assert.ok(!p.row.web.endsWith('/**'), '段级行自己绝不能被当成候选行补出来')
    assert.equal(p.row.status, 'portal')
  }
  // 段级行本身不在产出里(只读):它的措辞与射程是人的裁决(§0.10)
  assert.ok(
    !out.plan.some((p) => p.row.web === 'admin/**'),
    '段级豁免行绝不能出现在候选里',
  )
})

test('M3 幂等:生效面上已有该路由的逐条陈述 ⇒ 不重复补', () => {
  const routes = ['admin/users']
  const items = prefixItemsOf({
    routes,
    prefixRows: [prefixRow('admin/**')],
    portalCarried: new Set(['admin/users']),
    perRowRows: new Map(),
  })
  // 生效面上已有逐条陈述(上一轮补过 / 他席在飞)
  for (const effective of [
    new Set(['admin/users']),
    new Set(['admin/users']) /* 同键不同状态:让位闸看的是"有任何逐条陈述" */,
  ]) {
    const out = portalPlan.planPrefixFamily({ prefixItems: items, effectiveAnyWebs: effective, today: TODAY })
    assert.equal(out.plan.length, 0, `生效面已有 ${[...effective]} ⇒ 不重复补`)
    assert.equal(out.skips.length, 1, '让位必须被点名(§0.10:失效方向是点名,不是静默跳过)')
    assert.match(out.skips[0], /让位/, '让位文案要说清是让给谁')
  }
})

test('M4 逐条族不退化:gap/excluded 逐条行与门户表互斥 ⇒ 仍产出改写候选', () => {
  const out = portalPlan.planPerRowFamily({
    mapRows: [perRow('docs/old', 'gap'), perRow('docs/old2', 'gap'), perRow('x/aligned', 'aligned')],
    portalCarried: new Set(['docs/old', 'docs/old2']),
    effectivePortalWebs: new Set(),
    today: TODAY,
  })
  assert.equal(out.plan.length, 2, '两枚互斥的逐条行都要改写成 portal')
  for (const p of out.plan) {
    assert.equal(p.row.status, 'portal')
    assert.equal(p.row.family, undefined, 'row 上不挂族名(族名只在追责视图里)')
    assert.match(p.row.reason, /原在册 gap/, 'reason 保留"原在册什么"这一句')
  }
  assert.ok(
    !out.plan.some((p) => p.row.web === 'x/aligned'),
    'aligned 行不被门户收敛腿动',
  )
})

test('M5 未判定不折成 0:门户表取不到 ⇒ 一条都不补,且显式未判定', () => {
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('docs/old', 'gap')],
    portalCarried: null,
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    prefixItems: [],
    today: TODAY,
  })
  assert.equal(out.rows.length, 0, '未判定 ⇒ 候选为零')
  assert.ok(out.undetermined.length > 0, '必须显式未判定,绝不折成"零命中"冒充验过(§0.3)')
  assert.match(out.undetermined.join(' '), /门户表/, '未判定理由要点名是哪个输入取不到')
})

test('M6 干跑不写:候选集编排是纯函数,不碰文件系统', () => {
  // 本文件只测编排;写盘与否由调用方的 --apply 闸决定。形状锁:调用侧只在 applyMode 里写盘。
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('docs/old', 'gap')],
    portalCarried: new Set(['docs/old']),
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    prefixItems: [],
    today: TODAY,
  })
  assert.equal(out.rows.length, 1, '纯函数只算候选,不写盘')
  assert.equal(out.rows[0].status, 'portal')
  // 幂等:同一输入同一输出(纯函数契约)
  const again = portalPlan.planPortalConverge({
    mapRows: [perRow('docs/old', 'gap')],
    portalCarried: new Set(['docs/old']),
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    prefixItems: [],
    today: TODAY,
  })
  assert.deepEqual(out.rows, again.rows, '同一输入同一输出(幂等/纯函数契约)')
  // 写盘闸在调用侧:形状锁钉住"写盘只发生在 applyMode 块内"。
  const src = readFileSync(resolve(import.meta.dirname, '..', 'auto-register-cross-end.mjs'), 'utf8')
  const applyBlock = src.slice(
    src.indexOf('if (applyMode) {'),
    src.indexOf('if (applyMode) {') + 4000,
  )
  assert.ok(applyBlock.includes('appendMapRows'), '台账写盘必须发生在 applyMode 块内')
})

test('M7 结论行 state 判定树:闸是"门户表取不到",不是"有未判定理由"(与 HEAD 逐字同形)', () => {
  // 这条锁的是**档位语义**:2026-10-31 重构时一度把闸改成 portalUndet.length > 0,
  // 于是"登记表读不到"也会报 undetermined —— 守护腿会把"台账瞎了"读成"门户表瞎了",是两种病。
  // 形状锁:PORTAL 结论行里 state 的档位闸必须逐字是 portalCarried === null。
  const src = readFileSync(resolve(import.meta.dirname, '..', 'auto-register-cross-end.mjs'), 'utf8')
  const line = src.slice(src.indexOf('AUTO-REGISTER-PORTAL face='), src.indexOf('AUTO-REGISTER-PORTAL face=') + 400)
  assert.match(
    line,
    /portalCarried === null/,
    'PORTAL 结论行的 undetermined 闸必须是「门户表取不到」',
  )
  assert.doesNotMatch(
    line,
    /portalUndet\.length/,
    '闸若改成"有未判定理由"⇒ 读不到台账会被报成门户表瞎了(两种病混报)',
  )
})

test('M8 门户表取不到 ⇒ candidates 必为 0(不得读成"零缺口即已收敛")', () => {
  // 守护腿的 clean 档判定是 `state === 'clean' && candidates === 0 && applied === 0`。
  // 未判定时若 candidates 非 0,那一档就永远进不了 clean ⇒ 常态轮一直刷屏。
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('docs/old', 'gap')],
    portalCarried: null,
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    prefixItems: [{ route: 'admin/x', prefix: 'admin/**', line: 1 }],
    enabled: true,
    today: TODAY,
  })
  assert.equal(out.rows.length, 0, '未判定 ⇒ candidates 为 0')
  assert.equal(out.families.length, 0)
  assert.ok(out.undetermined.length > 0, '且必须显式未判定')
})

// ===== 2026-10-31 独立复核(FINDINGS)修复后的回归锁 =====

test('N1 幂等跳过的路由仍须被取代 ⇒ 归并后不落重复 web 键(D1)', () => {
  // D1 场景:HEAD=[gap X, gap Y]、工作树=[portal X]、本批补 Y。
  // 幂等跳过 X ⇒ X 不在本批 ⇒ 若取代集合只由本批派生,HEAD 的 gap X 不被剔除
  // ⇒ 归并后 X 落两行(旧 gap + 工作树 portal)= 尺子维四的重复键。
  const sets = portalPlan.effectiveWebSets([
    perRow('X', 'gap'),
    perRow('Y', 'gap'),
    perRow('X', 'portal'),
  ])
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('X', 'gap'), perRow('Y', 'gap')],
    portalCarried: new Set(['X', 'Y']),
    effectiveAnyWebs: sets.all,
    effectivePortalWebs: sets.portal,
    prefixItems: [],
    enabled: true,
    today: TODAY,
  })
  assert.deepEqual(out.rows.map((r) => r.web), ['Y'], 'X 已被幂等跳过,本批只补 Y')
  assert.ok(out.supersede.includes('X'), '被幂等跳过的 X 必须在取代清单里(否则 HEAD 的旧 gap 行留存)')
  assert.ok(out.supersede.includes('Y'), '本批产出的 Y 也在取代清单里')
  // 归并模拟(与 appendMapRows 同口径):每 web 恰一枚
  const head = [
    { web: 'X', status: 'gap' },
    { web: 'Y', status: 'gap' },
  ]
  const work = [{ web: 'X', status: 'portal' }]
  const supersedeWebs = new Set([
    ...out.rows.map((r) => r.web),
    ...out.supersede,
  ])
  const keep = (o) => !(supersedeWebs.has(o.web) && o.status !== 'portal')
  const seen = new Set()
  const merged = []
  for (const r of [...head, ...work].filter(keep)) {
    const k = `${r.web}::${r.status}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(k)
  }
  // 本批产出的行也要写进去(与 appendMapRows 末段同口径)
  for (const r of out.rows) {
    const k = `${r.web}::${r.status}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(k)
  }
  const counts = {}
  for (const m of merged) {
    const w = m.split('::')[0]
    counts[w] = (counts[w] ?? 0) + 1
  }
  assert.equal(counts.X, 1, `X 落了 ${counts.X} 枚 ⇒ 重复键(尺子维四会点名)`)
  assert.equal(counts.Y, 1, `Y 落了 ${counts.Y} 枚`)
})

test('N2 同一路由被两枚段级豁免罩着且都让位 ⇒ 只点名一次(D2)', () => {
  const out = portalPlan.planPrefixFamily({
    prefixItems: [
      { route: 'x/y', prefix: 'a/**', line: 1 },
      { route: 'x/y', prefix: 'b/**', line: 2 },
    ],
    effectiveAnyWebs: new Set(['x/y']),
    today: TODAY,
  })
  assert.equal(out.plan.length, 0, '让位 ⇒ 不补')
  assert.equal(out.skips.length, 1, '同一件事只点名一次(点名两遍会让读的人以为有两件事)')
})

test('N3 段级行(通配 web 键)不算逐条陈述 ⇒ 不进生效面逐条集(D4)', () => {
  const sets = portalPlan.effectiveWebSets([
    { web: 'admin/**', status: 'excluded' },
    perRow('admin/users', 'gap'),
  ])
  assert.ok(!sets.all.has('admin/**'), '段级行的通配键不是对某一条路由的陈述')
  assert.ok(sets.all.has('admin/users'), '真逐条行在册')
})

test('N4 同 web 两枚逐条行 ⇒ 只产一条候选(D5:单元层自洽)', () => {
  const out = portalPlan.planPerRowFamily({
    mapRows: [perRow('a/b', 'gap'), perRow('a/b', 'excluded')],
    portalCarried: new Set(['a/b']),
    effectivePortalWebs: new Set(),
    today: TODAY,
  })
  assert.equal(out.plan.length, 1, '同一 web 只补一行(维四:同键不许两行)')
})

test('N5 两族同路由命中 ⇒ 逐条族优先且两视图同源同序', () => {
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('a/b', 'gap')],
    portalCarried: new Set(['a/b']),
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    // 段级族也命中 a/b(构造面:直接喂 items,不去碰尺子)
    prefixItems: [{ route: 'a/b', prefix: 'p/**', line: 1 }],
    enabled: true,
    today: TODAY,
  })
  assert.equal(out.rows.length, 1, '同键只落一行')
  assert.equal(out.families.length, 1, 'families 与 rows 必须同数')
  assert.equal(out.families[0].web, out.rows[0].web, '两视图必须同源同序')
  assert.equal(
    out.families[0].family,
    portalPlan.PORTAL_FAMILY_PER_ROW,
    '逐条族优先(更具体的判定赢)',
  )
})

test('N6 本批为空但有取代清单 ⇒ 仍须清掉旧判定行(D1 边界)', () => {
  // 场景:工作树已有 portal X、HEAD 还有 gap X ⇒ 本批产出为空(幂等跳过 X),
  // 但 X 的旧判定行必须被清掉。若写盘层"本批为空就提前返回",这一轮永远清不掉 ⇒
  // 台账里 X 永远落两行(旧 gap + portal)。
  const sets = portalPlan.effectiveWebSets([
    perRow('X', 'gap'),
    perRow('X', 'portal'),
  ])
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('X', 'gap')],
    portalCarried: new Set(['X']),
    effectiveAnyWebs: sets.all,
    effectivePortalWebs: sets.portal,
    prefixItems: [],
    enabled: true,
    today: TODAY,
  })
  assert.equal(out.rows.length, 0, '本批为空(幂等跳过)')
  assert.deepEqual(out.supersede, ['X'], '但取代清单里必须有 X')
  // 形状锁:写盘层的提前返回条件必须**同时**看本批与取代清单。
  const src = readFileSync(resolve(import.meta.dirname, '..', 'auto-register-cross-end.mjs'), 'utf8')
  const i = src.indexOf('function appendMapRows')
  const body = src.slice(i, i + 1200)
  assert.doesNotMatch(
    body,
    /if \(rows\.length === 0\) return 0/,
    '提前返回只看本批 ⇒ 本批为空时取代清单被丢弃 ⇒ 旧判定行永远清不掉(D1 边界)',
  )
  assert.match(
    body,
    /supersedeOnly/,
    '提前返回条件必须把"只有取代、没有新产出"这一情形也算进来',
  )
})

test('N7 档未开启 ⇒ 不读工作树台账、不带他腿未判定理由(D6)', () => {
  // 「本腿没开启」却报出"工作树台账取不到"这类与门户维无关的理由 ⇒
  // state=off 的腿带非空 undetermined,读的人以为这一格出过事。
  const out = portalPlan.planPortalConverge({
    mapRows: [perRow('a/b', 'gap')],
    portalCarried: new Set(['a/b']),
    effectiveAnyWebs: new Set(),
    effectivePortalWebs: new Set(),
    prefixItems: [],
    enabled: false,
    today: TODAY,
  })
  assert.equal(out.rows.length, 0, '档未开启 ⇒ 不产候选')
  assert.deepEqual(out.undetermined, [], '档未开启 ⇒ 不带未判定理由')
  assert.deepEqual(out.supersede, [], '档未开启 ⇒ 不带取代清单(否则会误删在册行)')
  // 形状锁:调用侧读工作树台账的那段必须在 convergePortal 闸内。
  const src = readFileSync(resolve(import.meta.dirname, '..', 'auto-register-cross-end.mjs'), 'utf8')
  const i = src.indexOf('const workMapRows = (() => {')
  const body = src.slice(i, i + 400)
  assert.match(
    body,
    /if \(!convergePortal\) return \[\]/,
    '档未开启时不得读工作树台账(否则会带出他腿的未判定理由)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
