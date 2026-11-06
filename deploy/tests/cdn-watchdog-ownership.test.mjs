// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cdn-watchdog.ps1 的端口归属判据夹具(B 票 2)。
 *
 * 立因(两处):
 *  ① 旧判据 `if ($listen) { exit 0 }` —— 只问「:80 有没有人听」。IIS 或别的进程占住 80 时
 *    看门狗直接退出 0,真正的 kCDN 已死却永远不再拉起;
 *  ② 拉起后 `$again = Get-NetTCPConnection ...` 取到端口上的**任意** pid 就写
 *    「拉起成功 pid=别人的pid」,把别人的进程记成自己的战果。
 *
 * 修法:按进程身份判 —— 监听者命令行必须含 cdn-server.js;被人占住 ⇒ exit 3 拒绝拉起;
 * 拉起后要求「启动 pid == 端口归属 pid 且是本进程」,否则 exit 2。
 *
 * 夹具把 Get-NetTCPConnection / Get-CimInstance / Start-Process 换成受控桩,dot-source
 * 真脚本跑主流程(不启动真进程、不碰 80 端口):
 *   T1 静态:身份判据与两种非零出口在位,旧 `if ($listen) { exit 0 }` 不得回潮
 *   T2 IIS 占 80 ⇒ exit 3,且不得记「拉起成功」
 *   T3 别的进程占 80 ⇒ exit 3
 *   T4 kCDN 自持 ⇒ exit 0 且不重复拉起
 *   T5 拉起成功 ⇒ pid 与端口归属一致,exit 0
 *   T6 拉起后端口被 IIS 抢走 ⇒ exit 2,不得记「拉起成功」
 *   T7 拉起后无监听 ⇒ exit 2
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
const SCRIPT = join(REPO, 'deploy', 'win', 'cdn-watchdog.ps1')

function findPwsh() {
  const cands = [
    process.env.PWSH_PATH,
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'C:/Program Files (x86)/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}

/** 与脚本内同一份稳定位候选;取不到就跳过(机器态未判定,不是代码缺陷)。 */
function hasStableNode() {
  const cands = [
    'C:/Program Files/nodejs/node.exe',
    'C:/PROGRA~1/nodejs/node.exe',
    `${process.env.SystemDrive ?? 'C:'}/DevEnv/runtimes/node/node.exe`,
    'D:/DevEnv/runtimes/node/node.exe',
  ]
  return cands.some((c) => existsSync(c))
}

const HARNESS = String.raw`
#requires -Version 7
param([string]$ScriptPath, [int]$InitialOwner, [int]$AfterOwner, [int]$SpawnPid, [string]$ProcFile)
$global:__netCalls = 0
$procs = Get-Content -LiteralPath $ProcFile -Raw | ConvertFrom-Json
function Get-NetTCPConnection {
  param([int]$LocalPort, [string]$State, [string]$ErrorAction)
  $global:__netCalls++
  $owner = if ($global:__netCalls -eq 1) { $InitialOwner } else { $AfterOwner }
  if ($owner -le 0) { return }
  [pscustomobject]@{ LocalPort = $LocalPort; State = $State; OwiningProcess = $owner; OwningProcess = $owner }
}
function Get-CimInstance {
  param([string]$ClassName, [string]$Filter)
  if ($Filter -match 'ProcessId = (\d+)') {
    $id = $Matches[1]
    $item = $procs.$id
    if ($item) { return [pscustomobject]@{ ProcessId = [int]$id; Name = $item.Name; CommandLine = $item.CommandLine } }
    throw "no such process $id"
  }
  throw "unsupported filter: $Filter"
}
function Start-Process {
  param([string]$FilePath, [object]$ArgumentList, [string]$WorkingDirectory, [string]$WindowStyle,
        [switch]$PassThru, [string]$RedirectStandardOutput, [string]$RedirectStandardError)
  [Console]::Out.WriteLine("__START__ pid=$SpawnPid")
  [pscustomobject]@{ Id = $SpawnPid }
}
function Start-Sleep { param([int]$Seconds) }
function Add-Content { param([string]$Path, [object]$Value, [string]$Encoding) [Console]::Out.WriteLine("__LOG__ $Value") }
& $ScriptPath
exit $LASTEXITCODE
`

function runPwsh(pwsh, args, opts) {
  return new Promise((done) => {
    const child = spawn(pwsh, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    const timer = setTimeout(() => child.kill(), 30_000)
    child.on('close', (status, signal) => {
      clearTimeout(timer)
      done({ status, signal, stdout, stderr })
    })
  })
}

const p = (name, cmdline) => ({ Name: name, CommandLine: cmdline })
const CDN = p('node.exe', 'node.exe cdn-server.js --root server-root --http-port 80')

const CASES = [
  {
    name: 'IIS 占 80',
    initial: 4,
    after: 4,
    spawn: 0,
    procs: { 4: p('W3SVC', 'C:\\Windows\\System32\\svchost.exe -k iis') },
    expect: 3,
    must: [/被非 kCDN 进程占用 pid=4 name=W3SVC/],
    mustNot: [/拉起成功/, /无监听 ⇒ 拉起/],
  },
  {
    name: '别的进程占 80',
    initial: 9999,
    after: 9999,
    spawn: 0,
    procs: { 9999: p('other.exe', 'other.exe --listen 80') },
    expect: 3,
    must: [/被非 kCDN 进程占用 pid=9999 name=other.exe/],
    mustNot: [/拉起成功/, /无监听 ⇒ 拉起/],
  },
  {
    name: 'kCDN 本进程自持',
    initial: 7001,
    after: 7001,
    spawn: 0,
    procs: { 7001: CDN },
    expect: 0,
    must: [/kCDN 本进程持守 pid=7001/],
    mustNot: [/__START__/],
  },
  {
    name: '拉起成功且 pid 与端口归属一致',
    initial: 0,
    after: 7002,
    spawn: 7002,
    procs: { 7002: CDN },
    expect: 0,
    must: [/拉起成功 pid=7002/],
  },
  {
    name: '拉起后端口被 IIS 抢走',
    initial: 0,
    after: 4,
    spawn: 7003,
    procs: { 4: p('W3SVC', 'C:\\Windows\\System32\\svchost.exe -k iis'), 7003: p('node.exe', 'node.exe other.js') },
    expect: 2,
    must: [/拉起失败: spawnedPid=7003 portOwner=4\/W3SVC/],
    mustNot: [/拉起成功/],
  },
  {
    name: '拉起后无监听',
    initial: 0,
    after: 0,
    spawn: 7004,
    procs: {},
    expect: 2,
    must: [/拉起失败: spawnedPid=7004 portOwner=none/],
  },
]

async function runCase(pwsh, dir, c) {
  const procFile = join(dir, `proc-${Math.random().toString(36).slice(2)}.json`)
  const harnessFile = join(dir, 'harness.ps1')
  writeFileSync(harnessFile, HARNESS, 'utf8')
  writeFileSync(procFile, JSON.stringify(c.procs), 'utf8')
  const r = await runPwsh(
    pwsh,
    [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', harnessFile,
      '-ScriptPath', SCRIPT,
      '-InitialOwner', String(c.initial),
      '-AfterOwner', String(c.after),
      '-SpawnPid', String(c.spawn),
      '-ProcFile', procFile,
    ],
    { cwd: REPO, windowsHide: true },
  )
  return { status: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}` }
}

test('T1 静态:端口身份判据与外占出口在位,旧"有人听就 exit 0"不得回潮', () => {
  const s = readFileSync(SCRIPT, 'utf8')
  assert.ok(s.includes('function Test-CdnProcess'), '缺少进程身份判据 ⇒ 又回到「80 有人听就算活着」')
  assert.match(s, /cdn-server\\\.js/, '身份判据没有认 cdn-server.js')
  assert.match(s, /-eq \$spawned\.Id/, '拉起后没有校验新进程 pid 与端口归属')
  assert.match(s, /exit 3/, '端口被非 kCDN 进程占用时没有可见失败出口')
  assert.ok(!/if\s*\(\s*\$listen\s*\)\s*\{\s*exit 0\s*\}/.test(s), '旧的「:80 有人听就 exit 0」回潮了')
})

test('T2 行为:IIS 占 80 ⇒ exit 3,不记"拉起成功"', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[0])
    assert.equal(status, 3, `IIS 占 80 时退出码应为 3(修前是 0):\n${out}`)
    assert.equal((out.match(/__START__/) ? 1 : 0), 0, `IIS 占 80 时仍试图拉起:\n${out}`)
    assert.match(out, /被非 kCDN 进程占用 pid=4 name=W3SVC/, `没有点名端口被谁占:\n${out}`)
    assert.doesNotMatch(out, /拉起成功/, `把 IIS 占端口记成拉起成功:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T3 行为:别的进程占 80 ⇒ exit 3', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[1])
    assert.equal(status, 3, `别的进程占 80 时退出码应为 3(修前是 0):\n${out}`)
    assert.match(out, /被非 kCDN 进程占用 pid=9999 name=other\.exe/, `没有点名端口被谁占:\n${out}`)
    assert.doesNotMatch(out, /拉起成功/, `把别人的进程记成拉起成功:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T4 行为:kCDN 本进程自持 ⇒ 幂等退出、不重复拉起', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[2])
    assert.equal(status, 0, `kCDN 自持时应幂等 exit 0:\n${out}`)
    assert.match(out, /kCDN 本进程持守 pid=7001/, `没有确认是本进程:\n${out}`)
    assert.doesNotMatch(out, /__START__/, `已有 kCDN 持守却重复拉起(cdn-server 双起会互杀):\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T5 行为:拉起后 pid 与端口归属一致 ⇒ 记成功并 exit 0', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[3])
    assert.equal(status, 0, `拉起成功应 exit 0:\n${out}`)
    assert.match(out, /__START__ pid=7002/, '没有发生拉起')
    assert.match(out, /拉起成功 pid=7002/, `没记成功 pid:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T6 行为:拉起后端口被 IIS 抢走 ⇒ exit 2,不得记"拉起成功"', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[4])
    assert.equal(status, 2, `端口归属与启动 pid 不一致时应 exit 2(修前是 0):\n${out}`)
    assert.match(out, /拉起失败: spawnedPid=7003 portOwner=4\/W3SVC/, `没有点明 pid 与归属不一致:\n${out}`)
    assert.doesNotMatch(out, /拉起成功/, `把别人的 pid 记成拉起成功:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('T7 行为:拉起后仍无监听 ⇒ exit 2', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh || process.platform !== 'win32' || !hasStableNode()) {
    t.skip('未判定:非 Windows / 无 pwsh7 / 无稳定位 node ⇒ 机器态未判定(§0.3)')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-cdn-'))
  try {
    const { status, out } = await runCase(pwsh, dir, CASES[5])
    assert.equal(status, 2, `拉起后无监听应 exit 2:\n${out}`)
    assert.match(out, /拉起失败: spawnedPid=7004 portOwner=none/, `没有报无监听:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
