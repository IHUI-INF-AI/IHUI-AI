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
const unread = (file, side = 'miniapp', tiers = {}, cssVars = null) =>
  src.readGeometry(file, side, tiers, cssVars).unreadable
/** 间距唯一源档表(生产出口原样喂给用例;§22c 测试零复制判据)。 */
const SPACING = 'packages/design-tokens/src/spacing.ts'
const spTiers = src.specTiers({ [SPACING]: headBlob(SPACING) })
assert.equal(spTiers['rnSpacing.md'], 12, 'specTiers 没接间距腿(夹具与门不同形)')
/**
 * 2026-11-01 票 O67 的**档名长度锁**:`{1,6}` 曾把带连字符的档整枚吞掉(`'xs-loose'` 8 字符),
 * 于是 RN 腿对 `rnSpacing['xs-loose']` 失明 —— 与 CSS 变量失明是同一条洞的两个入口。
 */
assert.equal(
  spTiers['rnSpacing.xs-loose'],
  6,
  '带连字符的间距档被档名长度上限吞掉(读不到=造出假分叉)',
)
assert.equal(spTiers['rnSpacing.sm-loose'], 10, '同上:sm-loose 也必须在档表里')
/**
 * CSS 变量解值表:按**真仓被审面**建(与门内 collect 同一条取材路径),测试不复算取值。
 */
const TOKENS = src.TOKENS_CSS_PATH
const COPY = src.MINIAPP_TOKEN_COPY_PATH
const cssVarSources = { [TOKENS]: headBlob(TOKENS), [COPY]: headBlob(COPY) }
const cssVars = src.cssVarTiers(cssVarSources)
assert.equal(cssVars.get('--spacing-xs')?.px, 4, 'tokens.css 受管块的 --spacing-xs 没解成 4px')
assert.equal(cssVars.get('--text-badge')?.px, 10, '--text-badge 没解成 10px')

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

test('C3 反例 A(不得变绿):假分叉被折掉后,真差异 15/200 必须仍被报出', () => {
  /**
   * 夹具前提按**新 HEAD 面**重订(2026-11-01 票 O67;腐烂原因是前提失效,不是本次改动改了语义):
   * 旧断言取的是 `ScreenStates.taro.css` 里的 `min-height:400rpx`(=200)。现读 HEAD 该文件已无这一行
   * —— 族改成 tsx 内联消费单一源 `SCREEN_STATES_STATE_MIN_HEIGHT_PX`(端内注释逐字写着"本表不再手写
   * 这份占位高台"),而两腿的档集已收敛成同一组 ⇒ 真仓面**不再有 15/200 这一对**。
   * 这条反例不能因为真仓没了样本就变绿,所以它的"真差异"部分改在**构造面**上钉(第②段),
   * 真仓部分改成"两腿同集 + 未判定仍点名"(第①段)—— 两段的失效方向都还是"多要一次说明"。
   */
  const g = src.readGeometry(miniText(), 'miniapp', spTiers, cssVars)
  const r = src.readGeometry(headBlob(RN), 'rn', spTiers, cssVars)
  // ① 真仓面:假分叉必须为 0,且两侧共有的 `xs-loose` 这一档两腿都看得见(档名长度修复的装车证明)。
  assert.deepEqual(
    src.diffValues(g.values, r.values),
    { onlyMiniapp: [], onlyRn: [] },
    `真仓两腿现读不同集:${JSON.stringify(src.diffValues(g.values, r.values))}`,
  )
  assert.ok(
    g.values.has(6) && r.values.has(6),
    'xs-loose=6 至少有一侧读不到 ⇒ 档名/解值有一头没接上',
  )
  assert.ok(
    g.unreadable.some((u) => String(u.raw).includes('SCREEN_STATES_STATE_MIN_HEIGHT_PX')),
    '跨文件 import 的常量解不到必须逐枚报名(不折成 0、不折成"该侧无档")',
  )
  // ② 构造面:真差异 15 / 200 在解值能力打开后**仍必须**被判出来。
  //    量纲按小程序 CSS 的真实落地写(rpx):`15px` 会被 pxtransform 1:1 写成 `15rpx` ⇒ 折成 7.5,
  //    那是既有 `facePx` 口径(C3 若把它写成 px 就是在给门造第二条单位规则)。
  const fakeMini = [
    '.a {',
    '  gap: var(--spacing-xs);',
    '  min-height: 400rpx;',
    '  height: 30rpx;',
    '}',
    '.b {',
    '  padding: var(--spacing-sm) 24rpx;',
    '}',
  ].join('\n')
  const fakeRn = [
    'const S = { a: { gap: 4 }, b: { padding: 8, paddingHorizontal: 12 } }',
    'export const V = () => <V className="gap-1 p-2" />',
  ].join('\n')
  const fg = src.readGeometry(fakeMini, 'miniapp', spTiers, cssVars)
  const fr = src.readGeometry(fakeRn, 'rn', spTiers, cssVars)
  const d = src.diffValues(fg.values, fr.values)
  assert.deepEqual(
    d.onlyMiniapp,
    [15, 200],
    `真差异被吞或被假分叉混入:${JSON.stringify(d.onlyMiniapp)}`,
  )
  assert.deepEqual(d.onlyRn, [], `对面独有的假分叉回潮:${JSON.stringify(d.onlyRn)}`)
  // ③ 成对的正例:`var(--spacing-xs)` 与 `gap-1` / `gap: 4` 判同值(这一格不入集就是"凭空多一档")。
  assert.ok(
    fg.values.has(4) && fg.values.has(8) && fg.values.has(12),
    'var 解值没进小程序腿的档集合',
  )
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
  assert.ok(
    raws.some((s) => s.includes('toRpx(MYSTERY.md)')),
    `成员解析不到未点名:${raws.join('|')}`,
  )
  assert.ok(
    raws.some((s) => s.includes('SP.md + 2')),
    `算术包裹式未点名:${raws.join('|')}`,
  )
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
  // 返回形状含 cssVar 覆盖面格(少这一格,"解值一条都没跑"与"本轮没有变量取用"就同形)
  assert.ok(
    /return \{ values, named, unreadable, cssVar \}/.test(body),
    '未判定/解值覆盖面没接进返回形状',
  )
  assert.ok(
    body.includes('cssVarItemsInSrc'),
    'CSS 变量解值支被摘线 ⇒ 端内按 §4 写的 var(--*) 又读成"该侧无档"(2026-11-01 票 O67 立案的那一型)',
  )
  assert.ok(txt.includes('geoUnreadable'), '未判定没接进 finding / 打印 / JSON 面')
  // 两腿的未判定都必须交回机器面:只交小程序那一腿 = 造假的那一腿恰好不报名
  assert.ok(
    /geoUnreadable: \[\.\.\.geoUnreadLines\(ga, '小程序'\), \.\.\.geoUnreadLines\(gb, '(RN|web)'\)\]/.test(
      txt,
    ),
    'RN/web 腿的未判定没并进机器面(单侧报名会让覆盖面变宽后的新盲区无人知)',
  )
  const lib = readFileSync(LIB, 'utf8')
  assert.match(lib, /export function geometryItemsInSrc/, '换算器判据不在共享 lib(门内抄第二份)')
  assert.match(lib, /export function pxPreservingWrappersOf/, '模板字面量补集不在共享 lib')
  assert.match(
    lib,
    /export function cssVarItemsInSrc/,
    'CSS 变量解值判据不在共享 lib(门内抄第二份)',
  )
  // 形态识别只住 lib 一处:门体再抄一条 var() 取值式,两处就会漂成"圆角认得、盒形不认"
  const countOf = (hay, needle) => hay.split(needle).length - 1
  assert.equal(
    txt.includes('CSS_VAR_RE'),
    false,
    '门体自带 var() 形态识别常量 ⇒ 与 lib 那份必然漂开',
  )
  assert.equal(
    countOf(txt, 'cssVarItemsInSrc'),
    2,
    '门体对解值出口的 import 名 + 调用必须恰好两处(第三处 = 又写了一份采集)',
  )
  assert.equal(
    countOf(txt, 'cssVarItemsInSrc('),
    1,
    '解值采集支的调用点必须恰有一处(多处 = 同一件事各算一遍,必漂)',
  )
  assert.equal(
    countOf(txt, 'var\\(\\s*--(?!(?:'),
    1,
    '失明判据那条 lookahead 式必须恰有一处(0=摘线 ⇒ "读不到"会被写成"该侧无档";2=第二把尺)',
  )
  // 解值表只能有一个生产者,且"源取不到"必须能喊死
  assert.ok(
    txt.includes('cssVarTiers(cssVarSources)'),
    '解值表不是由门内唯一出口建的(第二张表必然漂开)',
  )
  assert.ok(txt.includes('几何维判据失明'), '源取不到时的失明判据被摘 ⇒ "读不到"会被写成"该侧无档"')
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
    src
      .readGeometry('export const V = () => <V style={{ width: mysteryFn(44) }} />', 'miniapp')
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

test('C8 端到端:audit 里 ScreenStates 的假分叉清零,真差异仍必须留痕,未判定同批交回机器面', () => {
  /**
   * 夹具前提同样按**新 HEAD 面**重订(腐烂原因与 C3 同一条:端内已摘掉 `min-height:400rpx` 那行手写
   * 高台,改内联消费单一源常量,两腿档集收敛 ⇒ 真仓面上这一族不再有"仅一侧档")。
   * 旧断言 `onlyMiniapp=[15,200]` 的两半都失去取材依据,所以:
   *  ① 真仓面 ⇒ 钉"这一族不再有假分叉记录" + "未判定仍进机器面";
   *  ② 构造面 ⇒ 钉"真差异 15/200 在解值打开后仍必须被 audit 报出"(反例绝不变绿)。
   */
  const pairs = { pairs: [{ name: 'ScreenStates', miniapp: MINI, rn: RN }] }
  const text = { [MINI]: headBlob(MINI), [RN]: headBlob(RN), [MINI_CSS]: headBlob(MINI_CSS) }
  const styles = { [MINI]: headBlob(MINI_CSS) }
  const res = src.audit(pairs, text, {}, spTiers, tbl, styles, {}, cssVars)
  const gone = res.findings.find((x) => x.name === 'ScreenStates')
  assert.equal(
    gone,
    undefined,
    `真仓两腿现读同档集,这一族仍被报出分叉 = 解值/档表有一头没接上:${JSON.stringify(gone?.geometry)}`,
  )
  // ② 构造面:同一条 audit 通道必须还能报出真差异
  const mp = 'apps/miniapp-taro/src/components/Fake.tsx'
  const rn = 'packages/app/src/components/Fake.tsx'
  const fakeText = {
    [mp]: '.a { gap: var(--spacing-xs); min-height: 400rpx; height: 30rpx; }\n',
    [rn]: 'export const S = { a: { gap: 4 } }\n',
  }
  const res2 = src.audit(
    { pairs: [{ name: 'Fake', miniapp: mp, rn }] },
    fakeText,
    {},
    spTiers,
    tbl,
    {},
    {},
    cssVars,
  )
  const f2 = res2.findings.find((x) => x.name === 'Fake')
  assert.ok(f2, '构造面的真差异被 audit 吞掉(解值能力打开后判据变瞎)')
  assert.deepEqual(
    f2.geometry.onlyMiniapp,
    [15, 200],
    `真差异读数错:${JSON.stringify(f2.geometry)}`,
  )
  assert.deepEqual(f2.geometry.onlyRn, [], '对面 4px 与 var(--spacing-xs)=4px 判成了两档')
  assert.ok(
    Array.isArray(f2.geoUnreadable) && f2.geoUnreadable.every((s) => typeof s === 'string'),
    'geoUnreadable 没进 finding(未判定只在人读面有、机器面没有 = 下一票看不见)',
  )
  assert.ok(
    f2.geoUnreadable.every((s) => /^(小程序|RN):/.test(s)),
    `未判定没带腿名(只报"有几枚"不报"哪一腿"= 造假的那一腿恰好不报名):${f2.geoUnreadable.join('|')}`,
  )
  // 覆盖面读数必须跟着进 finding(解值表建好却没跑 vs 本轮没有变量取用,两者不得同形)
  assert.equal(f2.cssVar.miniapp.resolved, 1, 'var 解值覆盖面没进 finding')
})

test('C14 正例:var(--spacing-xs) 解成 4px 后与 web/RN 侧的 gap-1 判同值(假分叉消失)', () => {
  const mp = 'apps/miniapp-taro/src/components/T14.tsx'
  const rn = 'packages/app/src/components/T14.tsx'
  // 同一枚档:小程序按 §4 写成令牌,对面写成 Tailwind 刻度档与 StyleSheet 数字三种形态
  // 书写形态按端内真实样式表(一行一条声明)—— 简写支的提取式要求声明自行首起,单行块不是它的射程
  const a = [
    '.i {',
    '  gap: var(--spacing-xs);',
    '  font-size: var(--text-badge);',
    '}',
    '.p {',
    '  padding: var(--spacing-xs) 24rpx;',
    '}',
    '<View className="gap-[var(--spacing-xs)]" />',
  ].join('\n')
  const b = 'export const S = { gap: 4, fontSize: 10, padding: 4, paddingHorizontal: 12 }'
  const ga = src.readGeometry(a, 'miniapp', spTiers, cssVars)
  const gb = src.readGeometry(b, 'rn', spTiers, cssVars)
  const d = src.diffValues(ga.values, gb.values)
  assert.deepEqual(d, { onlyMiniapp: [], onlyRn: [] }, `同值被读成分叉:${JSON.stringify(d)}`)
  assert.ok(ga.values.has(4) && ga.values.has(10), 'var 档没折进小程序腿的集合')
  assert.ok(
    ga.values.has(12),
    '简写声明里 var + 字面量混排(`padding: var(--spacing-xs) 24rpx`)漏读后半截',
  )
  assert.equal(ga.cssVar.resolved, 4, `覆盖面读数与入账枚数不符:${JSON.stringify(ga.cssVar)}`)
})

test('C15 纪律:档名不在源里 / 受管块取不到 ⇒ 落未判定并点名,绝不折成"该侧无档"', () => {
  const file = [
    '.a { gap: var(--spacing-totally-made-up); }',
    '.b { width: var(--spacing-none); }',
    '.c { color: var(--color-brand); }',
    '.d { box-shadow: 0 2rpx 8rpx var(--color-black-6); }',
  ].join('\n')
  const g = src.readGeometry(file, 'miniapp', spTiers, cssVars)
  // ① 编出来的档名 ⇒ 必须点名,且不得给对面造出"仅 RN 档"
  assert.ok(
    g.unreadable.some(
      (u) => String(u.raw).includes('--spacing-totally-made-up') && u.px === null && u.why,
    ),
    `未知档名被静默吞掉:${JSON.stringify(g.unreadable)}`,
  )
  // ② 0 值档(--spacing-none)按 C4 纪律不入集(0 值引用会造"两侧同值"的假账)
  assert.equal(g.values.has(0), false, '"读不到"或 0 值档进了比对集合')
  // ③ 非长度档不报未判定、但必须留覆盖面读数(静默跳过与"没这一档"同形)
  assert.equal(g.cssVar.notLength, 1, `颜色档没计入覆盖面读数:${JSON.stringify(g.cssVar)}`)
  assert.equal(g.values.has(600), false, '颜色/字重档被当成长度收进几何集')
  // ④ 源取不到 ⇒ 解值表为空 ⇒ 一条都不采(由调用方的失明判据喊死,而不是在这里当作"没有变量")
  const noTable = src.readGeometry(file, 'miniapp', spTiers, null)
  assert.equal(noTable.cssVar.resolved, 0, '没有解值表却报出了解值枚数')
  assert.equal(src.cssVarTiers({}).size, 0, 'cssVarTiers 在源缺失时凭空造表')
  // ⑤ 档表被小程序派生态互证否掉的档 ⇒ 消费侧落未判定(不得挑一个信)
  const bad = src.cssVarTiers({
    [TOKENS]: ':root { --spacing-xxl: 40px; }',
    [COPY]: ':root { --spacing-xxl: 96rpx; }',
  })
  assert.equal(bad.get('--spacing-xxl').px, null, '源与派生态折算不等却仍按源值入账')
  assert.ok(bad.get('--spacing-xxl').why, '互证不等没写为什么')
  const g5 = src.readGeometry('.a { gap: var(--spacing-xxl); }', 'miniapp', {}, bad)
  assert.ok(
    g5.unreadable.some((u) => String(u.raw).includes('--spacing-xxl')),
    '互证不等的档被静默当成"该侧无档"',
  )
})

test('C16 真差异在解值能力打开后仍必须判红(成对反例,不得为绿改判据)', () => {
  const mp = 'apps/miniapp-taro/src/components/T16.tsx'
  const rn = 'packages/app/src/components/T16.tsx'
  // 小程序侧写 30rpx(落地量纲)折 15,RN 侧写 10:两腿都是"能解值的形态",差异必须留在账上
  const text = {
    [mp]: '.a { gap: var(--spacing-xs); height: 30rpx; }\n',
    [rn]: 'export const S = { a: { gap: 4, height: 10 } }\n',
  }
  const res = src.audit(
    { pairs: [{ name: 'T16', miniapp: mp, rn }] },
    text,
    {},
    {},
    null,
    {},
    {},
    cssVars,
  )
  const f = res.findings.find((x) => x.name === 'T16')
  assert.ok(f, '两侧都写了不同档值却零判据')
  assert.deepEqual(f.geometry, { onlyMiniapp: [15], onlyRn: [10] })
  // 棘轮侧:锚点为 0 时这一族必须落红(解值不是"少报"的通道)
  assert.equal(src.verdictOf([f], { counts: { T16: 0 } }).red.length, 1, '真分叉没被锚点问责')
  assert.equal(src.verdictOf([f], { counts: { T16: 2 } }).red.length, 0, '存量被当成新增(判据过头)')
})

test('C17 装车锁:CSS 变量解值的三条腿都在位(建表 / 消费 / 失明)', () => {
  const txt = readFileSync(GATE, 'utf8')
  assert.ok(
    txt.includes("import { collectVars } from './lib/design-token-blocks.mjs'"),
    '取值不走 tokens.css 的唯一取源出口 ⇒ 门内自建第二份块解析',
  )
  // 两条腿(audit 与 webRadiusAudit)都必须把解值表传下去:漏一条 = 那一腿重新失明
  assert.equal(
    (txt.match(/collected\.cssVars \?\? null/g) || []).length,
    2,
    '解值表没同时传给主腿与 web 腿(判据在、没装车 = 没有)',
  )
  assert.ok(
    /TOKENS_CSS_PATH = 'packages\/design-tokens\/src\/styles\/tokens\.css'/.test(txt),
    '源路径漂了',
  )
  assert.ok(txt.includes('cssVarCopyRead'), '"互证没做"这一格被摘 ⇒ 副本读不到会被读成已核对')
})

// ── 间距消费腿(2026-10-27 补)的专属锁:入账 / 包裹不双计 / 病态输入限时 / 档表缺员报名 ──
test('C9 正例:裸成员 dot 与 braket-字符串两形态都按档表 dp 入账,并按命名空间名进 named', () => {
  const file = [
    "import { rnSpacing, rnSpacingFor } from '@ihui/design-tokens'",
    'export const S = {',
    "  a: { padding: rnSpacing.lg, gap: rnSpacing['3xl'] },",
    '  b: { marginBottom: rnSpacingFor.stack },',
    '}',
  ].join('\n')
  const g = src.readGeometry(file, 'rn', spTiers)
  assert.ok(g.values.has(16) && g.values.has(32), `裸成员没入集合:${JSON.stringify([...g.values])}`)
  assert.equal(g.named['rnSpacing.lg'], 16, 'named 表没有按命名空间名登记(单侧具名档对账失明)')
  assert.deepEqual(g.unreadable, [], '在档成员被误报未判定')
})

test('C10 纪律:换算器包住的成员**不由间距腿入账**(归换算采集支报名),同处不得两套口径', () => {
  const file = [
    'const toRpx = (px) => `${px * 2}rpx`',
    "import { rnSpacing } from '@ihui/design-tokens'",
    'export const S = { a: { padding: toRpx(rnSpacing.md) } }',
  ].join('\n')
  const g = src.readGeometry(file, 'rn', spTiers)
  // 入账的只能是"成员解不到"的报名,或换算支自处;12(dp)绝不得静默进 values
  assert.equal(
    g.values.has(12),
    false,
    '被 toRpx 包住的成员被间距腿按 dp 记上 = 真屏 24px 读成 12px(C5 那一型)',
  )
})

test('C11 装车锁(摘了即红):门体必须带间距消费腿与括号配对区间扫描', () => {
  const txt = readFileSync(GATE, 'utf8')
  assert.ok(
    /rnSpacing(?:For)?\s*(?:\.\s*|\[\s*')/.test(txt),
    '间距消费腿被摘线 ⇒ ScreenStates 族假分叉立即回潮',
  )
  assert.ok(txt.includes('wrapRanges'), '包裹区间的括号配对扫描被摘 ⇒ 换算器形态与裸成员双计')
  assert.ok(txt.includes('SPACING_STEPS'), 'specTiers 的间距源解析支被摘 ⇒ 档表整体失明')
  assert.ok(txt.includes('间距维判据'), 'collect 缺表的失明判据被摘 ⇒ "取不到"会被读成"没引用"')
})

test('C12 对抗样本:接近而失败的病理输入必须 O(n) 返回(嵌套量词置换正则的 ReDoS 血案锁)', () => {
  const near = 'const x = rpx(' + 'a'.repeat(200) + ' ' + 'b'.repeat(200) + ' NOTSPACING)'
  const file = [
    near,
    "import { rnSpacing, rnSpacingFor } from '@ihui/design-tokens'",
    'export const View = () => (',
    "  <View style={{ padding: rnSpacing.xl, gap: rnSpacing['sm'], margin: rnSpacingFor.stack, height: toRpx(rnSpacing.md) }} />",
    ')',
  ].join('\n')
  const t0 = performance.now()
  const g = src.readGeometry(file, 'rn', spTiers)
  const dt = performance.now() - t0
  assert.ok(
    dt < 200,
    `病理输入用时 ${dt.toFixed(0)}ms —— 回溯型正则回潮(2026-10-27 实测:单样本冻结 >2 分钟)`,
  )
  assert.ok(
    g.values.has(20) && g.values.has(8) && g.values.has(16),
    `裸成员入账错:${JSON.stringify([...g.values])}`,
  )
  assert.equal(g.values.has(12), false, 'toRpx 包住的 md 被计入')
})

test('C13 档表读不到的成员 ⇒ 报名未判定,不静默入账(§0.3 没判不写判过)', () => {
  const file = [
    "import { rnSpacing } from '@ihui/design-tokens'",
    'export const S = { a: { padding: rnSpacing.renamedYesterday } }',
  ].join('\n')
  const g = src.readGeometry(file, 'rn', spTiers)
  assert.equal(g.values.has(0), false, '读不到的成员被记 0 入账')
  assert.ok(
    g.unreadable.some(
      (u) => String(u.raw).includes('rnSpacing.renamedYesterday') && u.px === null && u.why,
    ),
    `未判定没点名:${JSON.stringify(g.unreadable)}`,
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
