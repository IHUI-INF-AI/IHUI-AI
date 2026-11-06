// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// ihui-firewall-hardening.ps1 RDP 重启可见性(2026-11-07)
// =============================================================================
// 立因:迁移到 53389 后 `Restart-Service ... -ErrorAction SilentlyContinue`,
// 重启失败仍无条件往下走并打印绿色完成。此时 WAN 封 3389/53389、LAN 只放 53389,
// RDP 实际不可达,脚本却报绿。
// 判据:重启失败 ⇒ Invoke-RdpPortMigration 返回 Ok=$false 且函数外 exit 1。
// 跑法:node --test deploy/tests/firewall-rdp-restart.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'ihui-firewall-hardening.ps1')
const HARNESS = join(HERE, 'firewall-rdp-restart-harness.ps1')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

function runHarness(mode) {
  const pwsh = findPwsh()
  assert.ok(pwsh, '未判定:取不到 powershell 7 ⇒ 不能据此判绿')
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS, '-Mode', mode], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  assert.equal(r.status, 0, `harness(${mode}) 退出码 ${r.status}:\n${out}`)
  return out
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => JSON.parse(l))
}

test('T0 前置:脚本与 harness 都在位', () => {
  assert.ok(existsSync(SCRIPT), 'ihui-firewall-hardening.ps1 不在位')
  assert.ok(existsSync(HARNESS), 'harness 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7')
})

test('T1 修复后绿:TermService 重启失败必须报 Ok=false 且点名 TermService', () => {
  const rows = runHarness('normal')
  const fail = rows.find((r) => r.case === 'restart-fails')
  assert.ok(fail, '缺 restart-fails 用例')
  assert.equal(fail.ok, false, '重启失败仍报 Ok=true ⇒ 旧吞错形态回来了')
  assert.equal(fail.restart, 'failed')
  assert.match(fail.error, /TermService 重启失败/, '失败话术没点名 TermService,无法据此定位')
  assert.equal(fail.setPortCalls, 1, '应当先改注册表再重启')

  const ok = rows.find((r) => r.case === 'restart-ok')
  assert.equal(ok.ok, true)
  assert.equal(ok.restart, 'Running')

  const migrated = rows.find((r) => r.case === 'already-migrated')
  assert.equal(migrated.ok, true)
  assert.equal(migrated.changed, false)
  assert.equal(migrated.restartCalls, 0, '端口已迁移时不得再重启,否则每轮踢断活动 RDP 会话')
})

test('T2 变异自证:退回 -ErrorAction SilentlyContinue ⇒ restart-fails 必须翻红', () => {
  const rows = runHarness('mutant')
  const fail = rows.find((r) => r.case === 'restart-fails')
  assert.ok(fail, '变异臂缺 restart-fails 用例')
  assert.equal(fail.ok, true, '变异臂仍报 Ok=false ⇒ 夹具抓不到旧行为,今天这条修复没有回归锁')
})

test('T3 装车证明:主脚本把结果接到可见失败与 exit 1', () => {
  const s = readFileSync(SCRIPT, 'utf8')
  assert.match(
    s,
    /Invoke-RdpPortMigration -VerifyOnly:\$Verify/,
    '主流程没调用迁移函数 ⇒ 修复成孤儿',
  )
  assert.match(s, /-not \$rdpResult\.Ok[\s\S]{0,160}\$HardeningFailures \+=/, '失败结果没进累积器')
  assert.match(
    s,
    /\$HardeningFailures\.Count -gt 0[\s\S]{0,240}exit 1/,
    '有失败却没有非零退出 ⇒ 定时任务仍看不到红',
  )
  assert.doesNotMatch(
    s,
    /Restart-Service -Name TermService -Force -ErrorAction SilentlyContinue/,
    '旧静默重启仍在脚本里',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
