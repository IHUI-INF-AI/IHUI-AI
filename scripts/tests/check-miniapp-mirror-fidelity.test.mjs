// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 `scripts/check-miniapp-mirror-fidelity.mjs`(2026-10-25 立)。
// §22c:判据函数**直接 import 源符号**,不在测试里复制第二份实现(复制的那份最先腐烂)。
//
// 这把尺子要治的是「对齐全绿、体验全无」——小程序页首行写着镜像某共享屏,正文却只渲染
// 两行文案。所以成对的取证方向很明确:
//   · 生成器造出来的页**必须能被计到还原度**(T1/T4):键以 PAIR_KEYS 数组字面量声明、
//     JSX 里 t(titleKey) 间接消费,只认 t('…') 字面量会把刚生成的页读成 0% ⇒ 尺子当场失去意义;
//   · 通用键**必须不进分母**(T3):共享屏普遍引用 common.save 之类,算进分母会让还原度恒低,
//     进而逼出恒红门 —— 恒红门的唯一结局是逼人 --no-verify,连带废掉全部守门(§12e/§12f);
//   · 棘轮**只拦倒退**(T5 正面 / T6/T7 反面):存量只报数、HEAD 面尚无镜像对的新增页不拦。
//     方向钉反的话,要么把收口判成倒退(拦死进步),要么把倒退判成收口(形同虚设)。
//   · 真仓冒烟走 `--worktree`(T8):共享工作树常年并行,拿 HEAD 面断言会把别人未提交的改动
//     冒充成本仓债务。T8 只钉「跑得起来、结论行成形」,不钉死任何计数(§0.1 数字一律现读)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-miniapp-mirror-fidelity.mjs'
import { __test__ as cov } from '../check-cross-end-screen-coverage.mjs'
import { shellRefsOf } from '../lib/rn-shell-refs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, '..', 'check-miniapp-mirror-fidelity.mjs')

const SPEC = 'packages/app/src/features/settings/SettingsScreen.tsx'
const ROUTE = 'pages/setting/index'

/** 一行共享屏正文中常见的通用键 + 业务键混合文本。 */
const SHARED_TEXT = `
  const s = t('common.save')
  const c = t('app.cancel')
  const a = t('settings.title')
  const b = t('settings.desc')
`

/** gen-miniapp-mirror 生成形制:键以字符串数组声明,JSX 里间接消费(不在 t('…') 字面量里)。 */
const GENERATED_PAGE = `// 镜像 ${SPEC}
const PAIR_KEYS: readonly (readonly [string, string])[] = [
  ['settings.title', 'settings.desc'],
]
const SINGLE_KEYS: readonly string[] = [
  'settings.extra',
]
export default function P() {
  return PAIR_KEYS.map(([titleKey, bodyKey]) => t(titleKey))
}`

test('T1 通道②:键表数组里声明的键必须被抽到(生成器造的页还原度才不为 0)', () => {
  const keys = gate.extractDeclaredKeys(GENERATED_PAGE)
  assert.deepEqual(keys, ['settings.title', 'settings.desc', 'settings.extra'])
})

test('T2 通道②反面:没有键表块时返回空(合法形态,不是未判定)', () => {
  assert.deepEqual(gate.extractDeclaredKeys("const t = useI18n(); t('a.b')"), [])
  assert.deepEqual(gate.extractDeclaredKeys(''), [])
  assert.deepEqual(gate.extractDeclaredKeys(null), [])
})

test('T3 通用键不进分母(common/app 等 GENERIC_NS 首段被滤)', () => {
  assert.equal(gate.isBusinessKey('common.save'), false)
  assert.equal(gate.isBusinessKey('app.cancel'), false)
  assert.equal(gate.isBusinessKey('settings.title'), true)
  assert.deepEqual(gate.businessKeys(['common.save', 'app.cancel', 'settings.title']), [
    'settings.title',
  ])
})

test('T3b 共享屏正文通用键与业务键混排:分母只剩业务键(还原度才不会被系统性压低)', () => {
  const keys = [...gate.consumedKeys(SHARED_TEXT)]
  assert.deepEqual(gate.businessKeys(keys), ['settings.title', 'settings.desc'])
})

test('T4 两通道并集:t() 直调与键表声明都算消费', () => {
  const keys = gate.consumedKeys(`${GENERATED_PAGE}\nconst z = t('settings.zzz')`)
  for (const k of ['settings.title', 'settings.desc', 'settings.extra', 'settings.zzz']) {
    assert.ok(keys.has(k), `缺键 ${k}`)
  }
})

test('T5 棘轮正面:本次又丢掉一个 HEAD 上已还原的键 ⇒ 必须记倒退', () => {
  const base = {
    rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 2, missing: ['settings.c'] }],
  }
  const now = {
    rows: [
      {
        spec: SPEC,
        route: ROUTE,
        sharedKeys: 3,
        covered: 1,
        missing: ['settings.c', 'settings.b'],
      },
    ],
  }
  const reg = gate.regressions(now, base)
  assert.equal(reg.length, 1)
  assert.deepEqual(reg[0].added, ['settings.b'])
})

test('T6 棘轮反面:缺口与 HEAD 完全一致(存量)⇒ 不得拦', () => {
  const row = {
    spec: SPEC,
    route: ROUTE,
    sharedKeys: 3,
    covered: 1,
    missing: ['settings.b', 'settings.c'],
  }
  assert.deepEqual(gate.regressions({ rows: [row] }, { rows: [row] }), [])
})

test('T7 棘轮反面:HEAD 面尚无镜像对的新增页(收口)⇒ 不得拦', () => {
  const now = {
    rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 9, covered: 1, missing: ['a', 'b', 'c'] }],
  }
  assert.deepEqual(gate.regressions(now, { rows: [] }), [])
})

test('T9 还原度单调:补回一个键 ⇒ 缺口减少且不算倒退', () => {
  const base = {
    rows: [
      {
        spec: SPEC,
        route: ROUTE,
        sharedKeys: 3,
        covered: 1,
        missing: ['settings.b', 'settings.c'],
      },
    ],
  }
  const now = {
    rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 2, missing: ['settings.c'] }],
  }
  assert.deepEqual(gate.regressions(now, base), [])
})

test('T8 真仓冒烟:--worktree 面跑得起来且结论行成形(不钉死计数)', () => {
  const r = spawnSync(process.execPath, [GATE, '--worktree', '--quiet'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.ok(!/未判定\(异常\)/.test(out), `异常堆栈:${out.slice(0, 400)}`)
  assert.ok(/FIDELITY-RESULT|未判定:/.test(out), `结论行缺失:${out.slice(0, 400)}`)
  assert.ok([0, 1, 2].includes(r.status), `退出码越界:${r.status}`)
})

// —— --base=<ref>(CI 问责腿,2026-10-26 立)——
// 三档面在干净检出上全部退化(staged/worktree==HEAD ⇒ 倒退恒空),CI 必须走显式基线;
// 而 faceList/faceRead 把坏 ref 吞成空清单 ⇒ 若无基线护栏,"基线空 ⇒ 无倒退"会静默冒绿。
// T10/T11 一正一反钉死这两格。
test('T10 --base=HEAD 自比 ⇒ 倒退恒空、exit 0、结论行带 base= 字段', () => {
  const r = spawnSync(process.execPath, [GATE, '--base=HEAD', '--quiet'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 0, `退出码应为 0:${out.slice(0, 400)}`)
  assert.match(out, /FIDELITY-RESULT face=head base=HEAD /)
})

test('T11 --base=坏 ref ⇒ 显式出声 exit 2(不可解析的基线不得回落读盘冒绿)', () => {
  const r = spawnSync(process.execPath, [GATE, '--base=__definitely_not_a_ref__'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 2, `应为未判定 exit 2:${out.slice(0, 400)}`)
  assert.match(out, /未判定:基线面 __definitely_not_a_ref__ 不可解析/)
})

// —— 壳承载形制(2026-10-27 立,治「把委托读成丢失」的量具假分叉)——
// 小程序页 import `@rn-shells/<同名壳>`,壳再 import `@ihui/rn-app` 的共享屏本体 ⇒ 页面自己不写
// 文案是设计如此,分母那份文件就是它渲染的那份文件。旧尺按「页面正文有没有那些键」数,
// 把这批页读成 0% 还原(现读 122 枚承载页撑出 missing=1703),失效方向是逼人回去手抄
// 已经在渲染的文案 —— 与「自动化、减少开发」正相反,所以这一格是必修而不是可选项。
const SHELL_REL = 'apps/mobile-rn/src/screens/SettingsScreen.tsx'
const HOSTED_PAGE = `// 镜像 ${SPEC}
import ThemeRoot from '@/components/ThemeRoot'
import SettingsScreenShell from '@rn-shells/SettingsScreen'
export default function P() {
  return (
    <ThemeRoot>
      <SettingsScreenShell />
    </ThemeRoot>
  )
}`
/** 合格的 RN 壳:同名符号 + 取自 @ihui/rn-app(= cov.rnConsumes 的两条腿)。 */
const GOOD_SHELL = `
import { SettingsScreen as SharedSettingsScreen } from '@ihui/rn-app'
export default function SettingsScreen() {
  return SharedSettingsScreen
}`
const readFrom = (map) => (rel) => map[rel] ?? null

test('T12 承载正例:三腿齐 ⇒ hosted 且无键可缺(旧尺在这一对上报全缺)', () => {
  const f = gate.hostingFormOf({
    spec: SPEC,
    pageText: HOSTED_PAGE,
    readShell: readFrom({ [SHELL_REL]: GOOD_SHELL }),
  })
  assert.equal(f.form, 'hosted')
  assert.equal(f.why, '')
})

test('T13 手写正例:不引壳 ⇒ 仍是 hand,逐键数的判据一分不宽', () => {
  const f = gate.hostingFormOf({ spec: SPEC, pageText: GENERATED_PAGE, readShell: readFrom({}) })
  assert.equal(f.form, 'hand')
})

test('T14 断链反面一:壳在面上不存在 ⇒ broken(引了不存在的壳,编不过)', () => {
  const f = gate.hostingFormOf({ spec: SPEC, pageText: HOSTED_PAGE, readShell: readFrom({}) })
  assert.equal(f.form, 'broken')
  assert.match(f.why, /不存在/)
})

test('T15 断链反面二:壳存在但没消费这一屏 ⇒ broken(壳指错源不顶包)', () => {
  const other = `
import { OtherScreen } from '@ihui/rn-app'
export default function OtherShell() { return OtherScreen }`
  const f = gate.hostingFormOf({
    spec: SPEC,
    pageText: HOSTED_PAGE,
    readShell: readFrom({ [SHELL_REL]: other }),
  })
  assert.equal(f.form, 'broken')
  assert.match(f.why, /未消费共享屏/)
})

test('T16 断链反面三:页面默认导入而壳只有具名导出 ⇒ broken(运行时拿到 undefined)', () => {
  const namedOnly = `
import { SettingsScreen as Shared } from '@ihui/rn-app'
export function SettingsScreen() { return Shared }`
  const f = gate.hostingFormOf({
    spec: SPEC,
    pageText: HOSTED_PAGE,
    readShell: readFrom({ [SHELL_REL]: namedOnly }),
  })
  assert.equal(f.form, 'broken')
  assert.match(f.why, /默认导入/)
})

test('T17 声明与承载不符:引的壳都不消费这一屏 ⇒ other(声明镜像的那一屏并没渲染,旧尺对这一型无感)', () => {
  const page = `// 镜像 ${SPEC}
import NewsShell from '@rn-shells/NewsScreen'
export default function P() { return NewsShell }`
  const otherShell = `
import { OtherScreen } from '@ihui/rn-app'
export default function NewsScreen() { return OtherScreen }`
  const f = gate.hostingFormOf({
    spec: SPEC,
    pageText: page,
    readShell: readFrom({ 'apps/mobile-rn/src/screens/NewsScreen.tsx': otherShell }),
  })
  assert.equal(f.form, 'other')
  assert.match(f.why, /NewsScreen/)
})

test('T17b 壳名与共享屏名不同但真的消费了这一屏 ⇒ hosted(仓内既有形态:NewsScreen 渲染 SquareScreen)', () => {
  const page = `// 镜像 ${SPEC}
import NewsShell from '@rn-shells/NewsScreen'
export default function P() { return NewsShell }`
  const carrier = `
import { SettingsScreen as SharedSettingsScreen } from '@ihui/rn-app'
export default function NewsScreen() { return SharedSettingsScreen }`
  const f = gate.hostingFormOf({
    spec: SPEC,
    pageText: page,
    readShell: readFrom({ 'apps/mobile-rn/src/screens/NewsScreen.tsx': carrier }),
  })
  assert.equal(f.form, 'hosted')
})

test('T17c 引了别的壳而那壳在本面不存在 ⇒ broken(编不过,不是"声明未渲染"这种轻账)', () => {
  const page = `// 镜像 ${SPEC}
import NewsShell from '@rn-shells/NewsScreen'
export default function P() { return NewsShell }`
  const f = gate.hostingFormOf({ spec: SPEC, pageText: page, readShell: readFrom({}) })
  assert.equal(f.form, 'broken')
  assert.match(f.why, /不存在/)
})

test('T17d 直载共享屏(不经壳)且真渲染 ⇒ hosted/ via=direct', () => {
  const page = `// 镜像 ${SPEC}
import { SettingsScreen as SharedSettingsScreen } from '@ihui/rn-app'
export default function P() { return <SharedSettingsScreen t={(k) => k} /> }`
  const f = gate.hostingFormOf({ spec: SPEC, pageText: page, readShell: readFrom({}) })
  assert.equal(f.form, 'hosted')
  assert.equal(f.via, 'direct')
})

test('T17e 只 import 共享屏而没渲染它 ⇒ 仍是 hand(失效方向恒为多算一份手写)', () => {
  const page = `// 镜像 ${SPEC}
import { SettingsScreen } from '@ihui/rn-app'
export default function P() { return <div>自己写的</div> }`
  const f = gate.hostingFormOf({ spec: SPEC, pageText: page, readShell: readFrom({}) })
  assert.equal(f.form, 'hand')
})

test('T21 同 spec 双路由:锚点按 spec+route 配对,一张 hosted 一张 hand 不得报自我倒退', () => {
  const rows = (formA, missA, formB, missB) => ({
    rows: [
      { spec: SPEC, route: 'pages/setting/index', form: formA, missing: missA },
      { spec: SPEC, route: 'pkg-user/setting-shared/index', form: formB, missing: missB },
    ],
  })
  const base = rows('hand', ['settings.title'], 'hosted', [])
  const now = rows('hand', ['settings.title'], 'hosted', [])
  assert.deepEqual(gate.regressions(now, base), [])
  assert.equal(gate.regressions(rows('hand', ['settings.title', 'settings.new'], 'hosted', []), base).length, 1)
})

test('T18 真仓冒烟(HEAD 面):引壳的页一律不得判成手写,且 hosted 桶非空', () => {
  const res = gate.computeFidelity('head')
  assert.ok(res.hosted > 0, `HEAD 面 hosted 桶为空 ⇒ 承载判据没装车(现读 hosted=${res.hosted})`)
  assert.equal(
    res.hosted + res.hand + res.other + res.broken,
    res.pairs,
    '四形制之和必须等于对数(漏分即有形态没人判)',
  )
  const miniapp = cov.collectMiniapp('head')
  const shellRoutes = new Set(
    miniapp.filter((p) => p.file && shellRefsOf(p.text || '').size > 0).map((p) => p.route),
  )
  const misjudged = res.rows.filter((r) => shellRoutes.has(r.route) && r.form === 'hand')
  assert.deepEqual(misjudged, [], '引壳页被判手写 ⇒ 委托又被读成丢失(本门立尺之初的那把坏尺)')
})

test('T19 新棘轮牙:承载页退化回手写 ⇒ 键从 0 缺翻成全缺 ⇒ 必须判倒退', () => {
  const base = {
    rows: [{ spec: SPEC, route: ROUTE, form: 'hosted', sharedKeys: 2, covered: 2, missing: [] }],
  }
  const now = {
    rows: [
      {
        spec: SPEC,
        route: ROUTE,
        form: 'hand',
        sharedKeys: 2,
        covered: 0,
        missing: ['settings.title', 'settings.desc'],
      },
    ],
  }
  const reg = gate.regressions(now, base)
  assert.equal(reg.length, 1)
  assert.deepEqual(reg[0].added, ['settings.title', 'settings.desc'])
})

test('T20 形制桶齐全:结论行必须报出 hosted/hand/other/broken 四维(缺维即有形态没人点名)', () => {
  const r = spawnSync(process.execPath, [GATE, '--worktree', '--quiet'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  for (const dim of ['hosted=', 'hand=', 'other=', 'broken='])
    assert.ok(out.includes(dim), `结论行缺维度 ${dim}:${out.slice(0, 300)}`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
