// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 灰度实例 pid 身份判据(2026-11-07)
// =============================================================================
// 立因:Get-GrayPid 只看 pid 是否存在。pid 被复用后,Stop-GrayProcess 会 taskkill
// 一个完全不相干的进程(与 deploy-lock 记过的 pid 复用同型)。
// 判据:进程启动时刻不得晚于 pid 文件写入时刻 +2s;否则不是我们的实例。
// 跑法:node --test deploy/tests/canary-pid-identity.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'ihui-canary-gray.ps1')
const HARNESS = join(HERE, 'canary-pid-identity-harness.ps1')

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
  const rows = out
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
    .map((l) => JSON.parse(l))
  return new Map(rows.map((r) => [r.case, r.result]))
}

test('T0 前置:脚本与 harness 都在位', () => {
  assert.ok(existsSync(SCRIPT), 'ihui-canary-gray.ps1 不在位')
  assert.ok(existsSync(HARNESS), 'harness 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7')
})

test('T1 修复后绿:pid 复用不得再被认成灰度实例,正常实例仍返回 pid', () => {
  const r = runHarness('normal')
  assert.equal(r.get('pid-reused'), 0, 'pid 复用仍返回旧 pid ⇒ Stop-GrayProcess 会杀错进程')
  assert.equal(r.get('our-process'), 4242, '正常实例被误杀 ⇒ 修复方向反了')
  assert.equal(r.get('process-absent'), 0)
  assert.equal(r.get('pid-file-missing'), 0)
  assert.equal(r.get('pid-file-malformed'), 0)
})

test('T2 变异自证:删掉启动时刻比对 ⇒ pid-reused 必须翻红', () => {
  const r = runHarness('mutant')
  assert.equal(r.get('pid-reused'), 4242, '变异臂仍返回 0 ⇒ 夹具抓不到旧行为')
  assert.equal(r.get('our-process'), 4242)
})

test('T3 装车证明:判据在真实函数里,且 Stop 走同一判据', () => {
  const s = readFileSync(SCRIPT, 'utf8')
  assert.match(s, /Get-GrayPid/, '函数不在位')
  assert.match(s, /\$proc\.StartTime/, '没有读进程启动时刻 ⇒ 仍只凭 pid 存在')
  assert.match(s, /\$startedAt -gt \$writtenAt\.AddSeconds\(2\)/, '没有启动/写入时刻比对')
  assert.match(
    s,
    /Stop-GrayProcess[\s\S]{0,200}Get-GrayPid -Path \$PidFile/,
    '停止路径未走身份判据 ⇒ 杀错仍会发生',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
