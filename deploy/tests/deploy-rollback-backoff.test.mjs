// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 回滚退避行为验收(2026-11-07)
//
// 三条要求各自一条可证伪的断言:
//   ① 持久化:phase first 写盘 → **换一个 pwsh 进程** phase read 仍读到 3 次;
//   ② 有界:第 3 次回滚 ⇒ halted=true、gate=false、日志亮 FAIL 并点名状态文件;
//   ③ 按原因:三种病因 ⇒ 三个不同指纹,日志逐次标"新原因指纹";清零后 gate 才放行。
// 变异自证:
//   mutant-gate  摘掉 halted 判定 ⇒ gate-after-3 必翻 true(T2 应红);
//   mutant-persist 摘掉落盘 Move-Item ⇒ restart 读到 0 次(T1 应红)。
//
// 跑法:node --test deploy/tests/deploy-rollback-backoff.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LOOP = join(REPO, 'deploy', 'win', 'ihui-deploy-loop.ps1')
const HARNESS = join(HERE, 'deploy-rollback-backoff-harness.ps1')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

function runPhase(scratch, phase, mode = 'normal') {
  const pwsh = findPwsh()
  assert.ok(pwsh, '未判定:取不到 powershell 7 ⇒ 不能据此判绿')
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS, '-Phase', phase, '-Scratch', scratch, '-Mode', mode], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  assert.equal(r.status, 0, `harness(${mode}/${phase}) 退出码 ${r.status}:\n${out}`)
  const rows = out
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => JSON.parse(l))
  return new Map(rows.map((x) => [x.case, x.result]))
}

function newScratch() {
  return mkdtempSync(join(tmpdir(), 'ihui-rollback-'))
}

test('T0 前置:部署环与夹具都在位', () => {
  assert.ok(existsSync(LOOP), 'ihui-deploy-loop.ps1 不在位')
  assert.ok(existsSync(HARNESS), 'deploy-rollback-backoff-harness.ps1 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7')
})

test('T1 绿:三次回滚 ⇒ 有界停摆 + 状态跨进程仍在 + 新原因指纹逐次可见', () => {
  const scratch = newScratch()
  try {
    const first = runPhase(scratch, 'first')

    const a1 = first.get('after-1')
    assert.equal(a1.consecutive, 1)
    assert.equal(a1.halted, false)
    assert.ok(a1.fingerprint, '第 1 次回滚没算出原因指纹 ⇒ 告警无法按原因分槽')
    assert.ok(String(a1.nextEligibleAt).length > 0, '退避时间没落盘 ⇒ 下一轮会立刻重试')
    assert.match(first.get('log-1'), /新原因指纹/)

    const a2 = first.get('after-2')
    assert.equal(a2.consecutive, 2)
    assert.notEqual(a2.fingerprint, a1.fingerprint, '不同病因算出了同一指纹 ⇒ 新原因会被旧窗压住')
    assert.match(first.get('log-2'), /新原因指纹/)

    assert.equal(first.get('gate-after-2'), false, '退避窗口内仍放行 ⇒ 退避是假的')
    assert.ok(String(a2.nextEligibleAt).length > 0)

    const a3 = first.get('after-3')
    assert.equal(a3.consecutive, 3)
    assert.equal(a3.halted, true, '连续 3 次回滚仍未停摆 ⇒ 只是把死循环放慢')
    assert.equal(a3.nextEligibleAt, '', '停摆后仍有下一次时间 ⇒ 会自行重启')
    assert.match(first.get('log-3'), /FAIL/)
    assert.equal(first.get('gate-after-3'), false, '停摆后 gate 仍放行 ⇒ 红不起来')

    const read = runPhase(scratch, 'read')
    const rs = read.get('restart-state')
    assert.equal(rs.consecutive, 3, '换进程后计数归零 ⇒ 状态只在内存里')
    assert.equal(rs.halted, true)
    assert.equal(read.get('restart-gate'), false)

    const reset = runPhase(scratch, 'reset')
    const rState = reset.get('reset-state')
    assert.equal(rState.consecutive, 0)
    assert.equal(rState.halted, false)
    assert.equal(reset.get('reset-gate'), true, '人工清零后仍被挡 ⇒ 没有恢复出口')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('T2 变异自证:摘掉 halted 判定 ⇒ 停摆不再挡住部署', () => {
  const scratch = newScratch()
  try {
    const m = runPhase(scratch, 'first', 'mutant-gate')
    assert.equal(m.get('gate-after-3'), true, '变异臂仍返回 false ⇒ 夹具抓不到"无界退避"')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('T3 变异自证:摘掉落盘 ⇒ 换进程后状态归零', () => {
  const scratch = newScratch()
  try {
    runPhase(scratch, 'first', 'mutant-persist')
    const read = runPhase(scratch, 'read')
    assert.equal(read.get('restart-state').consecutive, 0, '变异臂仍读到 3 次 ⇒ 夹具没验证持久化')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('T4 接线:告警身份按原因指纹转传(不是常量 canary-regression)', () => {
  const loop = readFileSync(LOOP, 'utf8')
  const child = readFileSync(join(REPO, 'deploy', 'win', 'ihui-deploy.ps1'), 'utf8')
  assert.match(loop, /Get-RollbackFingerprint -Reason \$script:LastCanaryFailReason/, '环侧没把原因折成指纹')
  assert.match(loop, /'-CanaryRollbackReason', \$rbFp/, '环侧没把指纹传给子脚本')
  assert.match(child, /\[string\]\$CanaryRollbackReason/, '子脚本没有接收原因的入口')
  assert.match(child, /canary-regression:\$CanaryRollbackReason/, '子脚本仍发常量原因 ⇒ 新病因会被旧 4h 窗口压住')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
