// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui-firewall-watchdog.ps1 的"加固脚本缺失"夹具(B 票 3)。
 *
 * 立因:旧实现在加固脚本缺失时只 `Log "FATAL ..."`,随后照常进 while($true):
 * 服务状态仍是 Running,后台每 6h 点源一次不存在的路径、记一行 ERROR 再睡 ——
 * 器件在、台账在、实际没人守。修法:启动时缺失直接 exit 3,运行期缺失同样 exit 3。
 *
 * 夹具行为:
 *   T1 静态:缺失分支必须带 exit 3,且 while 循环前有该闸
 *   T2 行为:把看门狗复制到不含 ihui-firewall-hardening.ps1 的临时目录,直接跑 ——
 *           必须在数秒内 exit 3(修前会挂死在 while + 6h sleep)
 *   T3 正控:临时目录里放一个 no-op 加固脚本,看门狗应正常进入循环(shutdown 前有
 *           "watchdog started" 与 "hardening finished" 日志),防止修正把正常路径也堵死
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'deploy', 'win', 'ihui-firewall-watchdog.ps1')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

function runPwshFile(pwsh, scriptPath, env, killAfterMs) {
  return new Promise((done) => {
    const started = Date.now()
    const child = spawn(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, killAfterMs)
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      done({ status, signal, timedOut, elapsedMs: Date.now() - started, out })
    })
  })
}

/** 把看门狗复制到独立目录:该目录就是脚本的 $PSScriptRoot,决定加固脚本在不在位。 */
function stage(dir, withHardening) {
  const dst = join(dir, 'ihui-firewall-watchdog.ps1')
  writeFileSync(dst, readFileSync(SCRIPT, 'utf8'), 'utf8')
  if (withHardening) {
    writeFileSync(
      join(dir, 'ihui-firewall-hardening.ps1'),
      '# fixture no-op hardening —— 只为验证正常路径不被缺失闸堵死\n',
      'utf8',
    )
  }
  return dst
}

test('T1 静态:缺失分支必须 exit 3,且 while 循环在该闸之后', () => {
  const s = readFileSync(SCRIPT, 'utf8')
  const guard = s.indexOf('-not (Test-Path $script)')
  assert.ok(guard > 0, '找不到加固脚本缺失闸')
  const after = s.slice(guard, guard + 400)
  assert.match(after, /exit\s+3/, '缺失闸只记日志不退出 ⇒ 服务仍会显示 Running')
  const whileIdx = s.indexOf('while ($true)')
  assert.ok(whileIdx > guard, 'while 循环在闸之前 ⇒ 缺失时仍会空转')
  assert.match(s, /FATAL 加固脚本不在位/, '缺失时必须留下可见的 FATAL 台账')
})

test('T2 行为:加固脚本缺失 ⇒ 数秒内 exit 3,不许挂死在循环里', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32') {
    t.skip('未判定:非 Windows / 无 pwsh7 ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-fw-'))
  try {
    const staged = stage(dir, false)
    const logDir = join(dir, 'logs')
    const r = await runPwshFile(pwsh, staged, { IHUI_FW_WATCHDOG_LOG_DIR: logDir }, 20_000)
    assert.equal(r.timedOut, false, `加固脚本缺失时进程没有退出(被 20s 超时杀掉),修前就是这样空转:\n${r.out}`)
    assert.equal(r.status, 3, `缺失时应 exit 3 让服务状态可见地失败,实际 status=${r.status}:\n${r.out}`)
    assert.ok(r.elapsedMs < 10_000, `退出太慢(${r.elapsedMs}ms) ⇒ 服务停机前仍有可观空窗`)
    const log = readFileSync(join(logDir, 'ihui-firewall-watchdog.log'), 'utf8')
    assert.match(log, /FATAL 加固脚本不在位/, `日志里没有可见的 FATAL:\n${log}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T3 正控:加固脚本在位时正常进入循环,不被缺失闸误杀', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32') {
    t.skip('未判定:非 Windows / 无 pwsh7 ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-fw-'))
  try {
    const staged = stage(dir, true)
    const logDir = join(dir, 'logs')
    const r = await runPwshFile(
      pwsh,
      staged,
      { IHUI_FW_WATCHDOG_LOG_DIR: logDir, IHUI_FW_WATCHDOG_INTERVAL_SEC: '1' },
      4_000,
    )
    assert.equal(r.timedOut, true, `加固脚本在位时看门狗应常驻(却被提前退出 status=${r.status}):\n${r.out}`)
    const log = readFileSync(join(logDir, 'ihui-firewall-watchdog.log'), 'utf8')
    assert.match(log, /watchdog started/, `正常路径没有启动日志:\n${log}`)
    assert.match(log, /hardening finished/, `正常路径没有完成一轮重放:\n${log}`)
    assert.doesNotMatch(log, /FATAL 加固脚本不在位/, `在位却被判缺失:\n${log}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
