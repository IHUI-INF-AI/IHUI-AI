// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试(toRpx 表达式族)—— `check-cross-end-ui-parity.test.mjs` 的补集,专钉 2026-10-24
// 立的那两条采集支(换算器包数字字面量 / 包文件内对象常量成员)。
// 为什么单独成件:主镜像套件里 T8 一类用例跑真仓 git 面,单件耗时 >280s(实测被 timeout 打成假红);
// 这把尺子只判内存表达式 + 三枚真仓 blob,秒级可复跑,派单与收尾都能当场取证。
// 判据一律 import 源脚本的 `__test__` 与共享 lib 出口,本件零复制(§0.6/§22c)。
//
// 五条用例的来源:取证报告 `.ihui-agent/tmp/goal-concurrency-2026-10-24/gate128-css.md`
// —— ScreenStates 族 5 枚几何(8/12/16/44/92)+ 1 枚 RD(4)全是假分叉,而 `200` 是唯一真差异。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as src } from '../check-cross-end-ui-parity.mjs'
import { lengthConstsOf, radiusItemsInLine, radiusSetOf } from '../lib/radius-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-cross-end-ui-parity.mjs')
const LIB = join(ROOT, 'scripts', 'lib', 'radius-tokens.mjs')

/** 真仓 ScreenStates 两腿(HEAD blob):假分叉的取证面必须是真文件,不是手搓夹具。 */
function headBlob(rel) {
  const r = spawnSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(r.status, 0, `HEAD 面取不到 ${rel}(取不到就判不了,不得拿夹具冒充真仓结论)`)
  return r.stdout
}

const MINI = 'apps/miniapp-taro/src/components/ScreenStates.taro.tsx'
const MINI_CSS = 'apps/miniapp-taro/src/components/ScreenStates.taro.css'
const RN = 'packages/app/src/components/ScreenStates.tsx'

const tbl = { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16, DEFAULT: 6 }
/** 小程序腿 = 组件正文 + 它自己 import 的伴生样式表(与门内 `withLocalStyles` 同形)。 */
const miniText = () => headBlob(MINI) + headBlob(MINI_CSS)
/** 换算支的"未判定"清单:走门自己的出口,测试不复算判据。 */
const unread = (file, side = 'miniapp', tiers = {}) => src.readGeometry(file, side, tiers).unreadable

test('C1 正例:toRpx(44) 与 RN 侧的 44 判为同值 —— 假分叉消失', () => {
  const g = src.readGeometry(miniText(), 'miniapp')
  const r = src.readGeometry(headBlob(RN), 'rn')
  const d = src.diffValues(g.values, r.values)
  assert.ok(g.values.has(44) && g.values.has(92), '换算器包字面量没进几何集合(采集支未接上)')
  assert.equal(d.onlyRn.includes(44), false, '端上真有 44 却仍报成"仅 RN 档"')
  assert.equal(d.onlyRn.includes(92), false)
  assert.equal(d.onlyRn.includes(12), false)
})

test('C2 正例:toRpx(SP.md) 成员解析成功并参与比对;RD 的 toRpx(RD.sm) 走同一把尺', () => {
  const g = src.readGeometry(miniText(), 'miniapp')
  const r = src.readGeometry(headBlob(RN), 'rn')
  const d = src.diffValues(g.values, r.values)
  assert.equal(d.onlyRn.length, 0, `仍有"仅 RN 档"假分叉:${d.onlyRn.join('/')}`)
  assert.ok(g.values.has(16) && g.values.has(8), 'SP.lg=16 / SP.sm=8 未经成员解析进集合')
  const consts = lengthConstsOf(miniText(), {})
  assert.deepEqual(
    radiusItemsInLine('  borderRadius: toRpx(RD.sm)', tbl, consts).map((it) => it.px),
    [4],
    'toRpx(RD.sm) 的 RD 读数不是 4(倍率或成员取值判错)',
  )
  assert.ok(radiusSetOf(miniText(), tbl).includes(4), 'RD 维仍读不到 4 ⇒ "RD 仅 RN 4"没清')
})

test('C3 反例 A(不得变绿):min-height:400rpx(=200) 对 RN flex:1 是真差异,必须仍被报出', () => {
  const g = src.readGeometry(miniText(), 'miniapp')
  const r = src.readGeometry(headBlob(RN), 'rn')
  assert.ok(g.values.has(200), '伴生样式表的 min-height:400rpx 没折进集合(取材面回落)')
  assert.equal(r.values.has(200), false, 'RN 侧根本没写 200 —— 单端结构差异,不是同一元素双值')
  const d = src.diffValues(g.values, r.values)
  assert.deepEqual(d.onlyMiniapp, [200], `真差异被吞或被多报:${JSON.stringify(d.onlyMiniapp)}`)
  assert.deepEqual(d.onlyRn, [], `假分叉未清:${JSON.stringify(d.onlyRn)}`)
})

test('C4 反例 B:成员/算术解析不到 ⇒ 逐枚进"未判定"点名,不记 0、不记同值、不静默', () => {
  const file = [
    'const toRpx = (px) => `${px * 2}rpx`',
    'const SP = { lg: 16, md: 12, sm: 8 }',
    'export const View = () => (',
    '  <View style={{ width: toRpx(44), height: toRpx(MYSTERY.md), padding: toRpx(SP.md + 2) }} />',
    ')',
  ].join('\n')
  const g = src.readGeometry(file, 'miniapp')
  const raws = unread(file).map((u) => u.raw)
  assert.ok(g.values.has(44), '同批里解得到的字面量被连坐丢掉(只该扣解不到的那一枚)')
  assert.ok(raws.some((s) => s.includes('toRpx(MYSTERY.md)')), `成员解析不到未点名:${raws.join('|')}`)
  assert.ok(raws.some((s) => s.includes('SP.md + 2')), `算术包裹式未点名:${raws.join('|')}`)
  assert.equal(raws.length, 2, `未判定枚数与解不到的枚数不等:${raws.join('|')}`)
  assert.equal(
    unread(file).every((u) => u.px === null && typeof u.why === 'string' && u.why.length > 0),
    true,
    '未判定缺"为什么",或干脆带了个读数',
  )
  assert.equal(g.values.has(0), false, '"读不到"以一个假 0 进了比对集合')
  assert.equal(g.values.has(Number.NaN), false, '"读不到"以 NaN 进了比对集合')
})

test('C5 单位口径:折好的 taroGeometry.X 再被 toUnit 包住按双重换算,新增支不重复记账', () => {
  const file = [
    'const toUnit = (px) => rpx(px * TARO_RPX_PER_PX)',
    'export const View = () => <View style={{ width: toUnit(taroGeometry.controlBox) }} />',
  ].join('\n')
  const tiers = { 'geometry.controlBox': 64, TARO_RPX_PER_PX: 2 }
  const g = src.readGeometry(file, 'miniapp', tiers)
  assert.ok(g.values.has(128), '双重换算没折成 128 ⇒ 取错投影入口被判成同值(发合格证)')
  assert.equal(g.values.has(64), false, '同一处既记 128 又记 64 = 把单位错读成"两种写法同值"')
  assert.deepEqual(
    g.unreadable.map((u) => u.raw),
    [],
    '单一源档成员被新增支重复认领(两套口径同时判同一处必漂移)',
  )
})

test('C6 反向锁:两支真接进 readGeometry,判据住在共享 lib 且门体零复制', () => {
  const txt = readFileSync(GATE, 'utf8')
  const at = txt.indexOf('export function readGeometry')
  const body = txt.slice(at, txt.indexOf('\nexport function', at + 10))
  assert.ok(body.includes('geometryItemsInSrc'), '采集支被摘线 ⇒ 门退回对 toRpx 族失明')
  assert.ok(body.includes('lengthConstsOf'), '取源表没走共享出口 ⇒ 门内自建第二张常量表')
  assert.ok(/return \{ values, named, unreadable \}/.test(body), '未判定没接进返回形状')
  assert.ok(txt.includes('geoUnreadable'), '未判定没接进 finding / 打印 / JSON 面')
  const lib = readFileSync(LIB, 'utf8')
  assert.match(lib, /export function geometryItemsInSrc/, '换算器判据不在共享 lib(门内抄第二份)')
  assert.match(lib, /export function pxPreservingWrappersOf/, '模板字面量补集不在共享 lib')
  // 门体不得自带换算器调用式正则(形态识别只住 lib 一处)
  assert.equal(
    /\\bto(?:Rpx|Unit)\\x28|\bto(?:Rpx|Unit)\(/.test(txt.slice(0, at)),
    false,
    '门体顶部另写了换算器调用正则 ⇒ 与 lib 那份必然漂开',
  )
})

test('C7 覆盖面纪律:换算器声明取不到 ⇒ 一条不采;倍率取不到 ⇒ 如实未判定(不按名字猜语义)', () => {
  assert.deepEqual(
    unread('export const View = () => <View style={{ width: mysteryFn(44) }} />').map((u) => u.raw),
    [],
    '没自证过的函数名也被当换算器认领(按名字猜语义)',
  )
  assert.deepEqual(
    src.readGeometry('export const V = () => <V style={{ width: mysteryFn(44) }} />', 'miniapp')
      .values.has(44),
    false,
    '未自证的换算器把 44 记进了几何集合',
  )
  const half = [
    'const toRpx = (px) => `${px * UNKNOWN_COEF}rpx`',
    'export const View = () => <View style={{ width: toRpx(44) }} />',
  ].join('\n')
  assert.deepEqual(
    unread(half).map((u) => u.raw),
    ['toRpx(44)'],
    '系数取不到却被静默丢弃或读成一个数',
  )
  assert.equal(src.readGeometry(half, 'miniapp').values.has(44), false, '取不到倍率却按恒等放过')
})

test('C8 端到端:audit 里 ScreenStates 只剩 200 一枚真差异,未判定同批交回机器面', () => {
  const pairs = { pairs: [{ name: 'ScreenStates', miniapp: MINI, rn: RN }] }
  const text = { [MINI]: headBlob(MINI), [RN]: headBlob(RN), [MINI_CSS]: headBlob(MINI_CSS) }
  const styles = { [MINI]: headBlob(MINI_CSS) }
  const res = src.audit(pairs, text, {}, {}, tbl, styles)
  const f = res.findings.find((x) => x.name === 'ScreenStates')
  assert.ok(f, '这一族从 findings 消失 —— 假分叉清零后真差异也必须留痕(消失不等于销账)')
  assert.deepEqual(f.geometry.onlyMiniapp, [200])
  assert.deepEqual(f.geometry.onlyRn, [])
  assert.deepEqual(f.radius.onlyRn, [], `RD 仍有仅 RN 档:${f.radius.onlyRn.join('/')}`)
  assert.ok(
    Array.isArray(f.geoUnreadable) && f.geoUnreadable.every((s) => typeof s === 'string'),
    'geoUnreadable 没进 finding(未判定只在人读面有、机器面没有 = 下一票看不见)',
  )
})

test('C8b 单源投影:空态徽章圆角两端同取 2xl 档(小程序不得再写 64rpx 真圆)', () => {
  // 形态锁读工作树(与 T7 的台账取材纪律无关):钉的是"两端取同一份源",不是把磁盘数写回锚点。
  const css = readFileSync(join(ROOT, MINI_CSS), 'utf8')
  const rn = readFileSync(join(ROOT, RN), 'utf8')
  const miniBlock = css.match(/\.ihui-state-glyph-circle\s*\{[^}]*\}/)?.[0] ?? ''
  const rnBlock = rn.match(/stateGlyphCircle:\s*\{[^}]*\}/)?.[0] ?? ''
  assert.equal(
    miniBlock.match(/border-radius:\s*([^;]+);/)?.[1]?.trim(),
    'var(--radius-2xl)',
    '小程序徽章圆角没接 2xl 档(仍是一份端内魔数)',
  )
  assert.equal(
    rnBlock.match(/borderRadius:\s*([^,]+),/)?.[1]?.trim(),
    "rnRadius['2xl']",
    'RN 徽章圆角没接 2xl 档',
  )
  assert.deepEqual(
    radiusItemsInLine('  border-radius: var(--radius-2xl);', tbl).map((i) => i.px),
    [16],
  )
  assert.deepEqual(
    radiusItemsInLine("      borderRadius: rnRadius['2xl'],", tbl).map((i) => i.px),
    [16],
    '同一档在两端读成不同值 ⇒ 仍是两份真相',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
