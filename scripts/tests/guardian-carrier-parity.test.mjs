// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guardian-carrier-parity.test.mjs —— 承载面齐平判据的镜像锁(§22c:import 源判据,零复算)
 *
 * 变异自证在册:
 *   · 把"按函数边界划区"换成"按固定行号划区"⇒ P9(插行后同集)立刻翻红;
 *   · 把"某面枚举到 0 ⇒ unjudged"摘掉 ⇒ P6 会读成"齐平"(正是最危险的假绿);
 *   · 把"被审面取不到 ⇒ unjudged"摘掉 ⇒ P5 会扫别的面顶替。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { __test__ as cp } from '../lib/guardian-carrier-parity.mjs'

const SRC = [
  '// 头注',
  'const X = 1',
  'function helperA() { sweepAlpha(); return 1 }',
  'async function main() {',
  '  dispatchDeployFeedback()',
  '  sweepStaleClosedRows()',
  '  healCrossEndMirror()',
  '  if (!CHECK_ONLY) auditOpsPatrol()',
  '}',
  'function startDaemon() {',
  '  dispatchRelayCapacity()',
  '  sweepStaleClosedRows()',
  '  auditOpsPatrol()',
  '}',
  'export function otherThing() { healNotCalledAnywhere() }',
].join('\n')

test('P1 只在 main 里的腿进 dark,两面都有的不进', () => {
  const r = cp.judgeCarrierParity({ source: SRC })
  assert.equal(r.state, 'drift')
  assert.deepEqual(r.dark, ['dispatchDeployFeedback', 'healCrossEndMirror'])
  assert.ok(!r.dark.includes('sweepStaleClosedRows'), '两面都调用过 ⇒ 不算黑腿')
  assert.ok(!r.dark.includes('auditOpsPatrol'), '被 if 包住的调用也要认(dark 里不该有它)')
})

test('P2 两面齐平 ⇒ ok(反向档:不能恒红)', () => {
  const flat = SRC.replace('function startDaemon() {', 'function startDaemon() {\n  dispatchDeployFeedback()\n  healCrossEndMirror()')
  const r = cp.judgeCarrierParity({ source: flat })
  assert.equal(r.darkCount, 0, JSON.stringify(r.dark))
  assert.equal(r.state, 'ok')
  assert.match(r.why, /已齐平/)
})

test('P3/P4 找不到 main 或 startDaemon ⇒ unjudged(绝不扫整文件顶替)', () => {
  assert.equal(cp.judgeCarrierParity({ source: SRC.replace(/async function main/g, 'async function mant') }).state, 'unjudged')
  assert.equal(cp.judgeCarrierParity({ source: SRC.replace(/function startDaemon/g, 'function startDamon') }).state, 'unjudged')
})

test('P5 被审面空 ⇒ unjudged', () => {
  for (const bad of ['', '   ', null, undefined]) {
    const r = cp.judgeCarrierParity({ source: bad })
    assert.equal(r.state, 'unjudged')
    assert.ok(r.why.length > 5, '未判定必须点名原因')
  }
})

test('P6 某一面枚举到 0 ⇒ unjudged,不读成"齐平"(假绿最贵)', () => {
  const noDaemonCalls = 'async function main() {\n  sweepAlpha()\n}\nfunction startDaemon() {\n  const x = 1\n  return x\n}\n'
  const r = cp.judgeCarrierParity({ source: noDaemonCalls })
  assert.equal(r.state, 'unjudged', r.why)
  assert.equal(r.daemonCount, 0)
})

test('P7 注释里的调用点不计(否则定义与散文会冒充调用)', () => {
  const commented = SRC.replace('  healCrossEndMirror()', '  // healCrossEndMirror() 已摘线,见工单')
  const r = cp.judgeCarrierParity({ source: commented })
  assert.ok(!r.dark.includes('healCrossEndMirror'), '被注释掉的调用不该算作 main 面在跑')
})

test('P9 变异档:在前面插 7 行注释后,dark 集必须一模一样(证明按函数边界而非行号)', () => {
  const shifted = ['// 别人 append 了一行', '// 又一行', '', '/* 块注释 */', '// 第四', '// 第五', '// 第六'].join('\n') + '\n' + SRC
  const a = cp.judgeCarrierParity({ source: SRC })
  const b = cp.judgeCarrierParity({ source: shifted })
  assert.deepEqual(b.dark, a.dark, '行号漂移不得改变判定')
  assert.equal(b.state, a.state)
})

test('P8 现读 HEAD 的 git-guardian:这格是真的,且迁移一条计数就减一', () => {
  const head = execSync('git show HEAD:scripts/git-guardian.mjs', { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  const r = cp.judgeCarrierParity({ source: head })
  assert.equal(r.state, 'drift', `现读应为 drift,实为 ${r.state}:${r.why}`)
  assert.ok(r.darkCount >= 10, `只在 main 里的腿应被量出来,现读 ${r.darkCount}`)
  // 部署自学族是 A8 独立量到 dark 的那三条 ⇒ 这里必须同时出现在承载面缺口里
  for (const n of ['dispatchDeployFeedback', 'dispatchDeployOutcomeIntake', 'dispatchE2eAutofill']) {
    assert.ok(r.dark.includes(n), `${n} 应在黑腿清单里(两把尺子必须互证)`)
  }
  // 反向对照:常驻面确实在跑的腿不得被误列
  assert.ok(!r.dark.includes('dispatchRelayCapacity'), 'relay-capacity 在 daemon tick 里跑,不得算黑腿')
  assert.ok(!r.dark.includes('auditOpsPatrol'), 'auditOpsPatrol 在 daemon tick 里跑,不得算黑腿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
