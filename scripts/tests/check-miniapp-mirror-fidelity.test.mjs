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
  assert.deepEqual(gate.businessKeys(['common.save', 'app.cancel', 'settings.title']), ['settings.title'])
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
  const base = { rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 2, missing: ['settings.c'] }] }
  const now = { rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 1, missing: ['settings.c', 'settings.b'] }] }
  const reg = gate.regressions(now, base)
  assert.equal(reg.length, 1)
  assert.deepEqual(reg[0].added, ['settings.b'])
})

test('T6 棘轮反面:缺口与 HEAD 完全一致(存量)⇒ 不得拦', () => {
  const row = { spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 1, missing: ['settings.b', 'settings.c'] }
  assert.deepEqual(gate.regressions({ rows: [row] }, { rows: [row] }), [])
})

test('T7 棘轮反面:HEAD 面尚无镜像对的新增页(收口)⇒ 不得拦', () => {
  const now = { rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 9, covered: 1, missing: ['a', 'b', 'c'] }] }
  assert.deepEqual(gate.regressions(now, { rows: [] }), [])
})

test('T9 还原度单调:补回一个键 ⇒ 缺口减少且不算倒退', () => {
  const base = { rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 1, missing: ['settings.b', 'settings.c'] }] }
  const now = { rows: [{ spec: SPEC, route: ROUTE, sharedKeys: 3, covered: 2, missing: ['settings.c'] }] }
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

test('T11 --base=坏 ref ⇒ 基线护栏出声 exit 2(空基线不得静默冒绿)', () => {
  const r = spawnSync(process.execPath, [GATE, '--base=__definitely_not_a_ref__'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  assert.equal(r.status, 2, `应为未判定 exit 2:${out.slice(0, 400)}`)
  assert.match(out, /未判定:基线面 __definitely_not_a_ref__ 枚举到 0 个共享屏/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
