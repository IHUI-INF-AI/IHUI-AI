// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 造页器「壳承载形制」两条新拒则的镜像测试(§22c:import 源 __test__,零复制判据)。
 *
 * 立因(2026-10-26 实测,weapp 构建输出里的两条 ModuleDependencyWarning):
 *   ① export 'default' (imported as 'DashboardScreenShell') was not found in
 *      '@rn-shells/DashboardScreen' (possible exports: DashboardScreen)
 *      —— 造页器无条件写默认导入,而 5 枚已落壳承载页里 4 枚的壳只有具名导出。
 *      webpack 对此只给**警告**:页面编译得过、运行时组件是 undefined,账面全绿而屏幕空白。
 *   ② 同名 RN 壳文件不存在(上一轮 ConsoleTableScreen / SwitchPrefsScreen 两枚),
 *      Taro 解析别名后当场 "…ConsoleTableScreen.vue doesn't exist",整条构建停摆。
 * 两条都不是"人忘了改",是造页器自己产出的形态没有对过壳的现读出口 ⇒ 修在器物里。
 *
 * 钉死四件事:
 *   B1 壳只有具名导出 ⇒ 产出**具名**取用(绝不再写默认导入);
 *   B2 壳有默认导出 ⇒ 产出默认取用(反控:B1 的修法不得把好端端的形态也改掉);
 *   B3 两种都不认 ⇒ 返回 error(上层转 refuse),不产出"猜一个"的页面;
 *   B4 接线与单一真相源:同名壳校验在射程内、壳文来自现读面、导出形态判据 import lib/rn-shell-refs。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G, planGeneration } from '../gen-miniapp-mirror.mjs'

const REPO = resolve(import.meta.dirname, '..', '..')
const SRC = readFileSync(resolve(import.meta.dirname, '..', 'gen-miniapp-mirror.mjs'), 'utf8')
const shell = (name) => ({ spec: `packages/app/src/features/x/${name}Screen.tsx`, base: name })

test('B1 壳只有具名导出 ⇒ 产出具名取用(默认导入会让运行时组件变 undefined)', () => {
  const out = G.buildShellPage({
    ...shell('Dashboard'),
    shellText: 'export function DashboardScreen() {}\n',
  })
  assert.equal(typeof out, 'string')
  assert.match(out, /import \{ DashboardScreen as DashboardScreenShell \} from '@rn-shells\/DashboardScreen'/)
  assert.equal(/^import DashboardScreenShell from/m.test(out), false, '壳没有默认导出时不得再写默认导入')
  assert.match(out, /<DashboardScreenShell \/>/, 'JSX 必须引用实际绑定到的那个名字')
})

test('B2 壳有默认导出 ⇒ 产出默认取用(反控:别把对的形态一起改掉)', () => {
  const out = G.buildShellPage({
    ...shell('DomainHub'),
    shellText: 'export default function DomainHubScreen() {}\n',
  })
  assert.match(out, /^import DomainHubScreenShell from '@rn-shells\/DomainHubScreen'$/m)
})

test('B3 两种都不认 ⇒ error(交上层 refuse),不猜一个能编过的空壳', () => {
  const r = G.buildShellPage({ ...shell('Login'), shellText: 'export const unrelated = 1\n' })
  assert.equal(typeof r, 'object')
  assert.match(r.error, /既无 default 导出也没有具名 LoginScreen/)
  assert.match(r.error, /unrelated/, '点名现读到的真实出口,人才有可能一眼修壳')
})

test('B4 接线:承载体选择在射程内、判据是"真的以 JSX 渲染"、找不到就拒造', () => {
  assert.match(
    SRC,
    /opts\.form === 'shell' && !rnRels\.includes\(sameNameShell\)/,
    '缺同名壳时的承载体选择被摘掉 ⇒ 又能产出悬空页',
  )
  assert.match(
    SRC,
    /rendersSharedIn\(rnMap\.get\(r\) \?\? '', `\$\{shape\.base\}Screen`\)/,
    '承载体必须按「具名导入的本地绑定出现在 JSX」判,不得只看文件里出现过名字',
  )
  assert.match(
    SRC,
    /kind: 'refuse'[\s\S]{0,240}数据腿无从继承/,
    '找不到真承载体时必须拒造(失效方向只能是多要一次说明,不是多放一次 dangling 页)',
  )
  assert.match(SRC, /shellText: rnMap\.get\(shellRel\)/, '壳文必须来自现读面,不许留空串默认值')
  assert.match(SRC, /from '\.\/lib\/rn-shell-refs\.mjs'/, '导出形态判据不得在本器里再写一份')
  assert.equal(/function shellExportShapeOf\s*\(/.test(SRC), false, '本器不得自带第二份壳出口形态判据')
})

/**
 * 判决台账接线(2026-10-26 立)。这张 jsonl 早就在判「不承载」,但**只有缺口报告器读它,
 * 造页器不读** ⇒ 人判过不该由小程序单独承载的屏(通用杠杆屏、机主定档"端上不该有登录页")
 * 被一轮轮再造回来:实测摘掉的 login / dashboard / domain-hub / mcp-store 四枚,
 * 下一轮就会凭"缺口还在"重新产出。判过的结论必须有消费者,否则等于没判(§0.9)。
 */
test('B5 判过「不承载」的屏不许被重造;没有判决时不走这一支(不把"没判"当"判过")', () => {
  const spec = 'packages/app/src/features/login/LoginScreen.tsx'
  const base = {
    miniapp: { pages: [], cfgText: '' },
    regText: '{"entries":[]}',
    rnRels: [],
    rnMap: new Map(),
    indexText: '',
    packObjs: {},
    packError: null,
    closureCache: new Map(),
    taroCfgText: '',
  }
  const r = planGeneration(REPO, { screenRel: spec, form: 'shell' }, {
    ...base,
    verdicts: new Map([[spec, { shared: spec, verdict: 'not-applicable', evidence: '机主定档:端上不该有登录页' }]]),
  })
  assert.equal(r.kind, 'refuse')
  assert.match(r.why, /不承载/)
  assert.match(r.why, /机主定档/, '拒绝理由必须把台账里的证据带出来,人才复核得了')

  const r2 = planGeneration(REPO, { screenRel: spec, form: 'shell' }, { ...base, verdicts: new Map() })
  assert.doesNotMatch(String(r2.why ?? ''), /不承载/, '无判决时不许凭空拒这一支')
})

/**
 * 并键档(mergeJsonMembers)的四条对照。
 * 立因(2026-10-26 实测):旧档以"本档只并顶层直接子键"为由,把**新增嵌套子树**整支拒写,
 * 于是待产队列的最后一枚(home,缺键落在 profile 的子对象里)每轮都 blocked ——
 * 而"新增既有块里不存在的键"与"新增一棵子树"在同一条不变式(一律不覆盖既有值)上是同一件事。
 * 现在只有**同路径类型打架**才拒,并把打架的键路径点名出来。
 */
const canon = (o) => `${JSON.stringify(o, null, 2)}\n`

test('M1 并键档:新增顶层标量键并入,既有值一律不动', () => {
  const text = canon({ profile: { title: '既有标题', keep: 1 } })
  const r = G.mergeJsonMembers(text, [{ ns: 'profile', obj: { title: '新标题会被忽略', addedKey: '新值' } }])
  assert.equal(r.ok, true, r.why)
  const out = JSON.parse(r.text)
  assert.equal(out.profile.title, '既有标题', '既有键不许被覆盖')
  assert.equal(out.profile.addedKey, '新值')
})

test('M2 并键档:新增嵌套子树(旧档正是卡死在这一支)⇒ 现在并入且仍可解析', () => {
  const text = canon({ profile: { home: { existing: 'a' } } })
  const r = G.mergeJsonMembers(text, [{ ns: 'profile', obj: { home: { existing: 'b', fresh: { deep: 'v' } } } }])
  assert.equal(r.ok, true, `不该再因"嵌套不并"而拒:${r.why}`)
  const out = JSON.parse(r.text)
  assert.equal(out.profile.home.existing, 'a', '既有叶子不许被覆盖')
  assert.equal(out.profile.home.fresh.deep, 'v', '缺的嵌套子树必须补进来')
})

test('M3 反向对照:同路径类型打架仍拒,并把键路径点名', () => {
  const text = canon({ profile: { banner: '我是字符串' } })
  const r = G.mergeJsonMembers(text, [{ ns: 'profile', obj: { banner: { title: '我要变成对象' } } }])
  assert.equal(r.ok, false, '类型打架必须拒,不能静默覆盖')
  assert.match(r.why, /profile\.banner/, '拒写要能指出是哪一条路径打架')
})

test('M4 幂等与形态闸:键全在册⇒内容不变;非 canonical 输入⇒拒写', () => {
  const text = canon({ profile: { a: 1 } })
  const idem = G.mergeJsonMembers(text, [{ ns: 'profile', obj: { a: 2 } }])
  assert.equal(idem.ok, true)
  assert.equal(idem.text, text, '幂等档必须逐字节不改写')
  const notCanon = '{ "profile": { "a": 1 } }'
  assert.equal(G.mergeJsonMembers(notCanon, [{ ns: 'profile', obj: { b: 2 } }]).ok, false, '非 canonical 形态重渲染会排他人文件,须拒')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('B5 页已落判据:只有「文件在 ∧ 路由在册」才算真落地', () => {
  assert.equal(G.pageSeamVerdict({ pageOnDisk: true, routeRegistered: true }), 'skip')
  assert.equal(
    G.pageSeamVerdict({ pageOnDisk: true, routeRegistered: false }),
    'plan',
    '页在而路由没进 app.config = 旧轮次半落地,必须继续补接缝(2026-10-27 实测 5 枚)',
  )
  assert.equal(G.pageSeamVerdict({ pageOnDisk: false, routeRegistered: true }), 'plan', '路由在册但文件没了 ⇒ 重新造页')
  assert.equal(G.pageSeamVerdict({ pageOnDisk: false, routeRegistered: false }), 'plan')
})

test('B6 接线锁:planGeneration 必须走同一判据,不得回退成「文件在就整屏跳过」', () => {
  assert.match(
    SRC,
    /pageSeamVerdict\(\{ pageOnDisk: alreadyOnDisk, routeRegistered: registeredRoutes\.has\(route\) \}\)/,
    '判据只许这一个出口(§0.6)',
  )
  assert.equal(
    /if \(alreadyOnDisk\) return \{ kind: 'skip'/.test(SRC),
    false,
    '无条件跳过那版让「页在而链路不通」的 5 枚页永远补不上接缝',
  )
})


test('B7 承载体判据只认「具名导入的本地绑定出现在 JSX」,不认「文件里出现过这个名字」', () => {
  // 正例:平台侧薄壳给共享屏起别名,再用别名渲染
  assert.equal(
    G.rendersSharedIn(
      "import { PlanListScreen as SharedPlanListScreen } from '@ihui/rn-app'\nexport function P(){return <SharedPlanListScreen />}",
      'PlanListScreen',
    ),
    true,
  )
  // 正例:同名直接用
  assert.equal(
    G.rendersSharedIn(
      "import { SquareScreen } from '@ihui/rn-app'\nexport function P(){return <SquareScreen items={[]} />}",
      'SquareScreen',
    ),
    true,
  )
  // 反例:只 import 不渲染(console-table / switch-prefs 那两枚的形态)
  assert.equal(
    G.rendersSharedIn(
      "import { ConsoleTableScreen } from '@ihui/rn-app'\nexport const x = ConsoleTableScreen",
      'ConsoleTableScreen',
    ),
    false,
  )
  // 反例:渲染的是另一个组件(前缀相同也不算)
  assert.equal(
    G.rendersSharedIn(
      "import { SquareScreen as S } from '@ihui/rn-app'\nexport function P(){return <SquareScreenOther />}",
      'SquareScreen',
    ),
    false,
  )
})

test('B8 不同名承载体:页面按壳名取用,并用壳的真导出形态', () => {
  const out = G.buildShellPage({
    spec: 'packages/app/src/features/plan/PlanListScreen.tsx',
    base: 'PlanList',
    shellText: 'export function PlanScreen() {}\n',
    shellName: 'PlanScreen',
  })
  assert.equal(typeof out, 'string', '不同名承载体必须能产出页面')
  assert.match(out, /import \{ PlanScreen as PlanScreenShell \} from '@rn-shells\/PlanScreen'/)
  assert.match(out, /<PlanScreenShell \/>/)
  assert.match(out, /RN 壳 apps\/mobile-rn\/src\/screens\/PlanScreen\.tsx/, '头注要写真实承载体文件,不写被承载屏的名字')
})


test('B9 路由占用:同 kebab 路径的页不镜像本屏 ⇒ 改道镜像分包,不判"已落"', () => {
  // 2026-10-27 实测:FavoritesScreen / PublishScreen 都有 RN 承载方,却因 pkg-user/favorites 与
  // publish 两条 kebab 路径被**另一张屏**的页占着,被旧判据当成"已落"永久跳过。
  assert.match(SRC, /occupiedByOther\(subRoot\)/, '必须先问「这个路径上的页是不是本屏的页」')
  assert.match(
    SRC,
    /mirrorRoots\.find\(\(r\) => !occupiedByOther\(r\)\)/,
    '冲突时按固定顺序改道镜像分包(不发明新词、不动既有页)',
  )
  assert.match(SRC, /不产重名路由/, '镜像分包也占满时必须拒造并点名,不得产重名路由')
})

