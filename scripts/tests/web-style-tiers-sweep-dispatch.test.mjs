// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 生产判据 `sweepWebStyleTiers`,不复制。
//
// 钉三件事:
//  ① 自愈腿的失效方向:没跑到 / 没判出结论 / 孩子被信号掐死 / 有文件被回滚 —— 一律不得记绿。
//  ② **argv 形状锁(本条腿独有的安全边界)**:落档器头注用编译取证写明,具名档是三元组
//     (size / line-height / **font-weight**),`text-xl → text-heading` 会把没有 `font-*` 伴随的
//     元素从 400 顶到 700 ⇒ **不带 `--only-weight-locked` 的 `--apply` 会静默改全站字重**。
//     所以这一旗必须由代码写死,不能留成可被环境变量调掉的口子。注入假 runner 的自测走不到
//     真 spawn,因此这里按"同一函数体内 argv 字面量"结构核对,并带一条反向对照证明核对有牙。
//  ③ 接线锁:本腿必须真挂在守护健康轮里(web → RN → 小程序 → 汇总驾驶舱),且在 `__test__` 在册。
//
// 用法:node scripts/tests/web-style-tiers-sweep-dispatch.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN_SRC = readFileSync(resolve(ROOT, 'scripts/git-guardian.mjs'), 'utf8')
const { __test__: G } = await import(pathToFileURL(resolve(ROOT, 'scripts/git-guardian.mjs')).href)
const sweepWebStyleTiers = G.sweepWebStyleTiers

const TICK_DIR = resolve(ROOT, '.ihui-agent/tmp/goal-crossend-auto')
let seq = 0
const tick = () => resolve(TICK_DIR, `web-tiers-${process.pid}-${seq++}.json`)

function run(out, opts = {}) {
  const logs = []
  const res = sweepWebStyleTiers({
    intervalMs: 0,
    now: Date.now() + seq * 1000,
    tickFile: tick(),
    logger: (s) => logs.push(String(s)),
    runner: () => ({ status: opts.status ?? 0, out, signal: opts.signal }),
  })
  return { res, logs }
}

/** 形状判据:本函数体内必须存在 `[script, '--apply', '--only-weight-locked']` 这一枚 argv 字面量。 */
const hasWeightLockedArgv = (s) =>
  /\[\s*script,\s*'--apply',\s*'--only-weight-locked'\s*\]/.test(s)

test('① 有改动 ⇒ ok,并把 files/changes/held/failed 现读出来', () => {
  const { res } = run('结论:LAND-WEB-TIERS state=applied files=3 changes=9 held=2 failed=0 groups[a]\n')
  assert.equal(res.ok, true)
  assert.equal(res.state, 'applied')
  assert.deepEqual([res.files, res.changes, res.held, res.failed], [3, 9, 2, 0])
})

test('② failed>0 ⇒ ok:false 并点名"未落地,不等于已对齐"(那批文件被逐字节回滚)', () => {
  const { res, logs } = run(
    '结论:LAND-WEB-TIERS state=applied files=0 changes=0 held=0 failed=2 groups[]\n',
  )
  assert.equal(res.ok, false)
  assert.equal(res.failed, 2)
  assert.match(logs.join('\n'), /回滚/)
})

test('③ truncated=1 必须原样带出(触到上限 ≠ 缺口清零)', () => {
  const { res, logs } = run(
    '结论:LAND-WEB-TIERS state=applied files=5 changes=8 held=0 failed=0 truncated=1 groups[]\n',
  )
  assert.equal(res.truncated, true)
  assert.match(logs.join('\n'), /上限/)
})

test('④ 没有结论行 ⇒ 未判定,不得记绿(rc=0 也不算成功)', () => {
  const { res } = run('随便什么输出\n', { status: 0 })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
})

test('⑤ 孩子被信号掐死 ⇒ 未判定并点名信号', () => {
  const { res, logs } = run('', { status: null, signal: 'SIGTERM' })
  assert.equal(res.ok, false)
  assert.equal(res.state, 'undetermined')
  assert.match(logs.join('\n'), /SIGTERM/)
})

test('⑥ argv 形状锁:必须恒带 --only-weight-locked,且不接受 env 调口子', () => {
  const iStart = GUARDIAN_SRC.indexOf('export function sweepWebStyleTiers')
  assert.ok(iStart > 0, '本腿函数体读不到')
  const iEnd = GUARDIAN_SRC.indexOf('\nexport function', iStart + 10)
  const body = GUARDIAN_SRC.slice(iStart, iEnd > iStart ? iEnd : GUARDIAN_SRC.length)
  assert.ok(hasWeightLockedArgv(body), 'spawn 的 argv 少了 --only-weight-locked ⇒ 会静默改全站字重')
  // 反向对照:摘掉这一旗,同一判据必须翻红(否则这条锁是空转的)。
  assert.ok(
    !hasWeightLockedArgv(body.replace("'--only-weight-locked'", "''")),
    '形状锁没有牙:缺旗仍被判成通过',
  )
  // 也不能把它降级成可调项(§0.10:失效方向必须是"多要一次说明",不能是"多放一次")。
  assert.ok(!/process\.env\.IHUI_WEB_STYLE_TIERS_ARGS/.test(body), '不得留 argv 环境变量口子')
  // 阳性对照:器物与旗都在器物自己的用法行里(拼错旗名同样会静默失效)。
  const lander = readFileSync(resolve(ROOT, 'scripts/land-web-style-tiers.mjs'), 'utf8')
  assert.match(lander, /'--only-weight-locked'/, "落档器侧不认识这枚旗 ⇒ 传了也等于没传")
})

test('⑦ 接线锁:三端落档腿按 web → RN → 小程序 → 汇总驾驶舱挂在健康轮上', () => {
  const at = (s) => {
    const i = GUARDIAN_SRC.indexOf(s)
    assert.ok(i > 0, `调用点读不到:${s}`)
    return i
  }
  const iWeb = at('if (!CHECK_ONLY) sweepWebStyleTiers()')
  const iRn = at('if (!CHECK_ONLY) sweepRnStyleTiers()')
  const iMp = at('if (!CHECK_ONLY) sweepMiniappStyleTiers()')
  const iCockpit = at('if (!CHECK_ONLY) sweepParityCockpit()')
  assert.ok(iWeb < iRn && iRn < iMp && iMp < iCockpit, `派发顺序须 web→RN→小程序→汇总,现读 ${iWeb}/${iRn}/${iMp}/${iCockpit}`)
  assert.equal(typeof sweepWebStyleTiers, 'function', '必须从 __test__ 出口在册(§22c 镜像只吃本体)')
})

console.log('\n✅ web 落档自愈派发锁已跑 7 例(① - ⑦)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
