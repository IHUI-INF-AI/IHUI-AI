// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// =============================================================================
// 部署窗口状态模块(deploy/win/deploy-window-common.ps1)的行为测试包装
// =============================================================================
// 判据本体只有一份(在模块里),本档一律通过跑 deploy-window-harness.ps1 来验,
// 不在 JS 里重写判定。T2 单独证明 PowerShell 5.1(监控侧宿主)也能加载模块 ——
// 加载失败的症状是监控静默退回旧启发式,比报错更隐蔽。
//
// 跑法:node --test deploy/tests/deploy-window-harness.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const HARNESS = join(HERE, 'deploy-window-harness.ps1')
const MODULE = join(REPO, 'deploy', 'win', 'deploy-window-common.ps1')
const PS51 = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

function findPwsh() {
  const cands = [process.env.PWSH_PATH, 'C:/Program Files/PowerShell/7/pwsh.exe', 'C:/Program Files (x86)/PowerShell/7/pwsh.exe'].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

test('T0 前置:harness 与模块都在位(取不到就判未判定,不判绿)', () => {
  assert.ok(existsSync(HARNESS), 'deploy-window-harness.ps1 不在位')
  assert.ok(existsSync(MODULE), 'deploy-window-common.ps1 不在位')
  assert.ok(findPwsh(), '未判定:取不到 powershell 7 ⇒ 不能据此判绿')
})

test('T1 判据本体:harness 必须零 FAIL 且退出码为 0', () => {
  const pwsh = findPwsh()
  const r = spawnSync(pwsh, ['-NoProfile', '-File', HARNESS], { encoding: 'utf8', windowsHide: true, timeout: 300_000 })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  const m = out.match(/pass=(\d+)\s+fail=(\d+)/)
  assert.ok(m, `harness 没打印计数行 ⇒ 它可能崩在半路。输出头:\n${out.slice(0, 500)}`)
  const [, p, f] = m
  assert.equal(Number(f), 0, `harness 有 ${f} 条 FAIL(通过 ${p} 条):\n${out}`)
  assert.ok(Number(p) >= 25, `用例数掉到 ${p} 条(<25)⇒ 覆盖面在缩水`)
  assert.equal(r.status, 0, `harness 退出码 ${r.status} 而非 0`)
})

test('T2 PowerShell 5.1 也能加载模块并给出判定', () => {
  assert.ok(existsSync(PS51), '取不到 Windows PowerShell 5.1 ⇒ 本条未判定')
  const missing = join(HERE, 'no-such-deploy-window-state.json').replace(/\\/g, '/')
  const mod = MODULE.replace(/\\/g, '/')
  const cmd = [
    `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8`,
    `. '${mod}'`,
    `$g = Get-IhuiDeployWindowState -Path '${missing}'`,
    `Write-Output ("Authoritative=" + $g.Authoritative + " Suppress=" + $g.Suppress)`,
  ].join('; ')
  const r = spawnSync(PS51, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  assert.equal(r.status, 0, `5.1 加载模块失败(exit=${r.status}):\n${out.slice(0, 600)}`)
  assert.match(out, /False/, `5.1 下判定输出没出现 False(模块未生效?):\n${out.slice(0, 600)}`)
})
