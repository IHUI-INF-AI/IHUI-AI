// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 生产判据 `sweepMiniappStyleTiers`,不复制。
//
// 钉两件事:
//  ① 自愈腿的**失效方向**:没跑到 / 没判出结论 / 孩子被信号掐死,一律不得记绿
//     (本仓最高频失效型 = 巡检安静地什么都不做,而日志里看起来像"已探测、无异常")。
//  ② **接线锁**:这条腿必须真挂在守护健康轮里(在 RN 那条之后、汇总驾驶舱之前),
//     且在 `__test__` 出口在册 —— "器物在、调度不在"就是本票要治的那一格(RN 侧 2026-10-31
//     已装,小程序侧一直没人派 ⇒ 三端落档节律不齐,同源门每天新长一笔分叉)。
//
// 用法:node scripts/tests/miniapp-style-tiers-sweep-dispatch.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN_SRC = readFileSync(resolve(ROOT, 'scripts/git-guardian.mjs'), 'utf8')
const { __test__: G } = await import(pathToFileURL(resolve(ROOT, 'scripts/git-guardian.mjs')).href)
const sweepMiniappStyleTiers = G.sweepMiniappStyleTiers

const TICK_DIR = resolve(ROOT, '.ihui-agent/tmp/goal-crossend-auto')
let seq = 0
const tick = () => resolve(TICK_DIR, `mp-tiers-${process.pid}-${seq++}.json`)
const OK_LINE = '结论:LAND-MINIAPP-TIERS state=applied files=1 changes=2 held=0\n'

function run(out, opts = {}) {
  const logs = []
  const res = sweepMiniappStyleTiers({
    intervalMs: 0,
    now: Date.now() + seq * 1000,
    tickFile: tick(),
    logger: (s) => logs.push(String(s)),
    runner: () => ({ status: opts.status ?? 0, out, signal: opts.signal }),
  })
  return { res, logs }
}

test('① 有改动 ⇒ ok,并把 files/changes/held 现读出来', () => {
  const { res } = run('结论:LAND-MINIAPP-TIERS state=applied files=3 changes=9 held=2\n')
  assert.equal(res.ok, true)
  assert.equal(res.state, 'applied')
  assert.deepEqual([res.files, res.changes, res.held], [3, 9, 2])
})

test('② 零改动也是 ok(held 是"归属未知不猜",不是失败)', () => {
  const { res } = run('结论:LAND-MINIAPP-TIERS state=dry-run files=0 changes=0 held=214\n')
  assert.equal(res.ok, true)
  assert.equal(res.held, 214)
})

test('③ 没有结论行 ⇒ 未判定,不得记绿(rc=0 也不算成功)', () => {
  const { res } = run('随便什么输出\n', { status: 0 })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
})

test('④ 孩子被信号掐死 ⇒ 未判定并点名信号(超时与"缺口清零"不能同形)', () => {
  const { res, logs } = run('', { status: null, signal: 'SIGTERM' })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
  assert.match(logs.join('\n'), /SIGTERM/)
})

test('⑤ 节流窗口内不重复派发(同 tickFile 第二条必须 ran:false)', () => {
  const tickFile = tick()
  const base = { tickFile, logger: () => {}, runner: () => ({ status: 0, out: OK_LINE }) }
  const a = sweepMiniappStyleTiers({ ...base, now: Date.now(), intervalMs: 60_000 })
  const b = sweepMiniappStyleTiers({ ...base, now: Date.now() + 1000, intervalMs: 60_000 })
  assert.equal(a.ran, true)
  assert.equal(b.ran, false)
  assert.equal(b.why, '未到节流窗口')
})

test('⑥ 缺件分支点名出路路径(不能只说"跳过"——那是本仓记过的哑读数)', () => {
  assert.match(
    GUARDIAN_SRC,
    /器物不在位\(scripts\/land-miniapp-style-tiers\.mjs\)/,
    '缺件分支必须逐字点名器物路径',
  )
  // 阳性对照:器物真在仓里 —— 若哪天被搬走,本锁先于守护日志翻红(而不是静默跳过)。
  readFileSync(resolve(ROOT, 'scripts/land-miniapp-style-tiers.mjs'), 'utf8')
})

test('⑦ 接线锁:本腿真挂在守护健康轮里(RN 那条之后、汇总驾驶舱之前)', () => {
  const iRn = GUARDIAN_SRC.indexOf('if (!CHECK_ONLY) sweepRnStyleTiers()')
  const iMp = GUARDIAN_SRC.indexOf('if (!CHECK_ONLY) sweepMiniappStyleTiers()')
  const iCockpit = GUARDIAN_SRC.indexOf('if (!CHECK_ONLY) sweepParityCockpit()')
  assert.ok(iRn > 0, 'RN 落档腿的调用点读不到 —— 参照物没了,本锁不能凭印象放行')
  assert.ok(iMp > 0, '小程序落档腿没挂在健康轮上(器物在、调度不在 = 本票的病灶)')
  assert.ok(iCockpit > 0, '汇总驾驶舱调用点读不到(链条顺序无法判定)')
  assert.ok(iMp > iRn && iMp < iCockpit, `派发顺序必须是 RN → 小程序 → 汇总,现读 mp=${iMp} rn=${iRn} cockpit=${iCockpit}`)
  assert.equal(typeof sweepMiniappStyleTiers, 'function', '必须从 __test__ 出口在册(§22c 镜像只吃本体)')
})

console.log('\n✅ 小程序落档自愈派发锁已跑 7 例(① - ⑦)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
