#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 仓库根唯一解析 deploy\win\ihui-root-common.ps1 的判据(2026-10-12 立)。
//
// 为什么判据必须真跑 PowerShell:根解析是"部署面去硬编码盘符"改造的唯一出口,
// 在 JS 里抄一份实现来测 = 抄实现测抄实现,真实脚本哪天回归了判据照样绿。
// 这里的子进程全部跑真实的 powershell.exe / pwsh.exe,读真实的 helper 文件。
//
// 三个既有基线决定用例形状(实测踩出来的,记在这免得后人再踩):
//   1. PS5.1 把无 BOM 的 UTF-8 中文 ps1 按系统 GBK 解码 ⇒ 直接语法错(helper 在
//      PS5.1 下报 4 个 parse 错,老文件 deploy-lock-common.ps1 报 22 个,全仓既有)。
//      所以 PS5.1 的**测试脚本本体**一律走 -EncodedCommand(UTF-16LE→base64)传入:
//      不落文件、不经任何代码页,编码问题污染不了判据。helper 自身的 PS5.1 parse
//      行为只做记录(R7b),不判红 —— 那是既有编码基线,不是本票的判据。
//   2. helper **刻意不带** `#requires -Version 7`(AGENTS §27 规则 2 的 deploy/** 适用面
//      例外;2026-10-12 主会话裁定落盘):pragma 在 5.1 上是运行期直接拒绝执行
//      (ScriptRequiresUnmatchedPSVersion, exit=1),而 helper 的调用方全是 nssm 服务与
//      计划任务拉起的运维脚本 —— 5.1 机器上加回去 = 备份/监控/部署服务整体停摆。
//      因此这条判据是**反向**的:首 5 行不得出现行首 `#requires -Version 7` 指令
//      (PowerShell 只认行首形态;立因注释里**提到**该串不算指令,模式必须锚 ^ 才不误伤),
//      另拿仍带 pragma 的 deploy/win/deploy-lock-common.ps1 做阳性对照,证明这把尺子
//      看得见 #requires 序列(防恒真);运行期再在 PS5.1 真 dot-source 一次,断言失败
//      绝不能是版本门 —— GBK 基线的 parse 假错(见第 1 条)不判红。
//   3. 子进程一律 spawnSync + 参数数组 + encoding:'utf8' + windowsHide + timeout,
//      绝不 shell 拼接 —— PowerShell 的引号与 $ 经 shell 一层就是事故源(实测:
//      外层 shell 向原生命令传 -Command '…\"x\"…' 时内层双引号会被吃掉,判据变形)。
//
// 跑法:node --test deploy/tests/root-resolution.test.mjs
//
// 临时现场放 os.tmpdir()/ihui-root-res-<pid>,**不放仓内**:.ihui-agent/tmp 自己就
// 在 git 仓里,git toplevel 分支会把 R4"非 git 仓"的前提顶掉,回退/throw 就测不到了。
// 结束后 after() 整树删除。
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const HELPER = join(REPO, 'deploy', 'win', 'ihui-root-common.ps1')

// 两代宿主都覆盖;缺哪个就 skip 哪个宿主的用例(不判红)。
const PS51 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const PWSH7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const SKIP_51 = existsSync(PS51) ? false : '本机没有 Windows PowerShell 5.1,跳过该宿主用例'
const SKIP_7 = existsSync(PWSH7) ? false : '本机没有 pwsh7,跳过该宿主用例'

// ── 派生真实现场(全部在 git 仓之外)────────────────────────────────────────
const SCRATCH = join(tmpdir(), `ihui-root-res-${process.pid}`)
const VALID_ROOT = join(SCRATCH, 'valid-root') // R2a:IHUI_ROOT 的合法值
const NO_PKG = join(SCRATCH, 'no-pkg') // R2b:存在但无 package.json / R4 起点
const CAP = join(SCRATCH, 'cap') // R5:有 package.json 的中途根(cap\a\b\c 深树)
const LOOK_LONG = join(SCRATCH, 'lookalike', 'IHUI-AI-git-repo') // R8:长前缀根
const LOOK_SHORT = join(SCRATCH, 'lookalike', 'IHUI-AI') // R8:短前缀兄弟(无 pkg)

mkdirSync(VALID_ROOT, { recursive: true })
writeFileSync(join(VALID_ROOT, 'package.json'), '{}\n')
mkdirSync(NO_PKG, { recursive: true })
mkdirSync(join(CAP, 'a', 'b', 'c'), { recursive: true })
writeFileSync(join(CAP, 'package.json'), '{}\n')
mkdirSync(join(LOOK_LONG, 'deep'), { recursive: true })
writeFileSync(join(LOOK_LONG, 'package.json'), '{}\n')
mkdirSync(LOOK_SHORT, { recursive: true }) // 故意不放 package.json

after(() => {
  rmSync(SCRATCH, { recursive: true, force: true })
})

// ── 真实宿主调用 ────────────────────────────────────────────────────────────
// -EncodedCommand 把判据文本以 UTF-16LE→base64 直接喂给宿主:不经过文件(绕开
// PS5.1 对无 BOM UTF-8 的 GBK 误读),也不经过 shell(绕开引号转义事故)。
function runPs(host, script, envOverride) {
  const env = { ...process.env }
  delete env.IHUI_ROOT // 判据必须自己控制覆盖值,不继承本机可能残留的环境变量
  Object.assign(env, envOverride || {})
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const res = spawnSync(host, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
    env,
  })
  if (res.error) throw res.error
  return res
}

// 每支探针只回一行 OK:<base64(UTF-8 结果)> / THROW:<base64(UTF-8 异常信息)>。
// 走 base64 是因为 PS5.1 重定向输出按控制台代码页写字,中文直接断言必花;
// base64 是纯 ASCII,JS 侧解码回 UTF-8 后可以逐字精确比对。
function resolveProbe(startDir, extra = '') {
  return [
    `$ErrorActionPreference = 'Stop'`,
    `. '${HELPER}'`,
    'try {',
    `  $r = Resolve-IhuiProjectRoot -StartDir '${startDir}'${extra}`,
    `  Write-Output ('OK:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$r)))`,
    '} catch {',
    `  Write-Output ('THROW:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message)))`,
    '}',
  ].join('\n')
}

// R3b 专用:不传 -StartDir,断言 Mandatory 参数绑定失败(反向护栏:没有默认值可依赖)。
function missingStartDirProbe() {
  return [
    `$ErrorActionPreference = 'Stop'`,
    `. '${HELPER}'`,
    'try {',
    '  $r = Resolve-IhuiProjectRoot',
    `  Write-Output ('OK:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$r)))`,
    '} catch {',
    `  Write-Output ('THROW:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message)))`,
    '}',
  ].join('\n')
}

// R7 用:调用真实 Parser::ParseFile 读 helper,回 COUNT=<n> 与每条错误的 base64。
function parseProbe() {
  return [
    '$tokens = $null',
    '$errs = $null',
    `[void][System.Management.Automation.Language.Parser]::ParseFile('${HELPER}', [ref]$tokens, [ref]$errs)`,
    `Write-Output ('COUNT=' + $errs.Count)`,
    `$errs | ForEach-Object { Write-Output ('E:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Extent.StartLineNumber + '|' + $_.Message))) }`,
  ].join('\n')
}

function parseMarker(res) {
  const text = (res.stdout || '').replace(/^\uFEFF/, '')
  const line = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .reverse()
    .find((s) => /^(OK|THROW):/.test(s))
  assert.ok(
    line,
    `子进程没有输出 OK/THROW 标记(exit=${res.status})\nstdout=${res.stdout}\nstderr=${res.stderr}`,
  )
  const i = line.indexOf(':')
  return { kind: line.slice(0, i), payload: Buffer.from(line.slice(i + 1), 'base64').toString('utf8') }
}

// 大小写与斜杠归一后比较:git toplevel 给 G:/IHUI-AI,Resolve-Path 给 G:\IHUI-AI。
function normPath(p) {
  return String(p).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
}

// 剥掉整行注释再搜字面量(允许注释里保留 D:\IHUI-AI 作立因说明;rem/:: 覆盖 cmd/bat)。
function stripCommentLines(src) {
  return src
    .split(/\r?\n/)
    .filter((l) => !/^\s*(?:#|rem\b|::)/i.test(l))
    .join('\n')
}

// =============================================================================
// R1 解析正确性:多个不同深度的 StartDir 都必须解析到 git 仓库根
// =============================================================================
test('R1 pwsh7:deploy/win、prod-bundle/svc、scripts 起点都解析到 git 仓库根', { skip: SKIP_7 }, () => {
  const top = spawnSync('git', ['-C', REPO, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
  assert.equal(top.status, 0, `git rev-parse --show-toplevel 失败: ${top.stderr}`)
  const expect = normPath(top.stdout.trim())
  const startDirs = [
    join(REPO, 'deploy', 'win'),
    join(REPO, 'deploy', 'scripts', 'prod-bundle', 'svc'),
    join(REPO, 'scripts'),
  ]
  for (const startDir of startDirs) {
    const m = parseMarker(runPs(PWSH7, resolveProbe(startDir)))
    assert.equal(m.kind, 'OK', `${startDir}: 期望解析成功,实得 ${m.kind}:${m.payload}`)
    assert.equal(normPath(m.payload), expect, `${startDir}: 解析结果与 git toplevel 不一致`)
  }
})

// =============================================================================
// R2 环境变量覆盖:命中即优先;给错则当场响,绝不静默回退
// =============================================================================
test('R2 pwsh7:IHUI_ROOT 指向有效根 ⇒ 覆盖优先于自 StartDir 向上爬', { skip: SKIP_7 }, () => {
  // StartDir 在真仓库里(不设覆盖会解析到仓库根),设了覆盖必须返回临时根 —— 差值即优先级。
  const m = parseMarker(runPs(PWSH7, resolveProbe(join(REPO, 'deploy', 'win')), { IHUI_ROOT: VALID_ROOT }))
  assert.equal(m.kind, 'OK', `期望解析成功,实得 ${m.kind}:${m.payload}`)
  assert.equal(normPath(m.payload), normPath(VALID_ROOT), 'IHUI_ROOT 覆盖没有生效')
})

test('R2 pwsh7:IHUI_ROOT 指向存在但无 package.json 的目录 ⇒ throw 且指名 IHUI_ROOT', { skip: SKIP_7 }, () => {
  const m = parseMarker(runPs(PWSH7, resolveProbe(join(REPO, 'deploy', 'win')), { IHUI_ROOT: NO_PKG }))
  // 带着错根继续跑会操作另一个目录,正是本次改造要根治的事故型 —— 必须响。
  assert.equal(m.kind, 'THROW', `拒绝用错根必须 throw,实得返回: ${m.payload}`)
  assert.match(m.payload, /IHUI_ROOT/, `错误信息应指名 IHUI_ROOT: ${m.payload}`)
  assert.match(m.payload, /package\.json/, `错误信息应说明缺 package.json: ${m.payload}`)
})

// =============================================================================
// R3 负向护栏
// =============================================================================
test('R3 pwsh7:-StartDir 指向不存在的路径 ⇒ throw', { skip: SKIP_7 }, () => {
  const bogus = join(SCRATCH, 'no-such-dir')
  const m = parseMarker(runPs(PWSH7, resolveProbe(bogus)))
  assert.equal(m.kind, 'THROW', `不存在的 StartDir 必须 throw,实得: ${m.payload}`)
  assert.match(m.payload, /-StartDir/, `错误信息应指名 -StartDir: ${m.payload}`)
  assert.ok(m.payload.includes('no-such-dir'), `错误信息应带上问题路径: ${m.payload}`)
})

test('R3 pwsh7:不传 -StartDir ⇒ 参数绑定失败(Mandatory,没有可依赖的默认值)', { skip: SKIP_7 }, () => {
  const m = parseMarker(runPs(PWSH7, missingStartDirProbe()))
  assert.equal(m.kind, 'THROW', `缺 Mandatory 参数必须绑定失败,实得返回: ${m.payload}`)
  assert.match(m.payload, /StartDir/, `应指名缺的参数: ${m.payload}`)
  assert.match(m.payload, /mandatory/i, `应是 Mandatory 绑定失败: ${m.payload}`)
})

// =============================================================================
// R4 -Required 与旧根回退
// =============================================================================
test('R4 pwsh7:临时目录(无 package.json、非 git 仓)下 -Required 必须 throw', { skip: SKIP_7 }, () => {
  const m = parseMarker(runPs(PWSH7, resolveProbe(NO_PKG, ' -Required')))
  assert.equal(m.kind, 'THROW', `-Required 四源全不中必须 throw,实得: ${m.payload}`)
  assert.match(m.payload, /Resolve-IhuiProjectRoot/, `应是本函数的失败信息: ${m.payload}`)
})

test('R4 pwsh7:非 -Required 的回退与 D:\\IHUI-AI 存在性一致(且只认精确路径)', { skip: SKIP_7 }, () => {
  // 期望值不写死:按运行时磁盘状态推导(本机 D:\IHUI-AI 不存在 ⇒ 必 throw;
  // 生产机存在 ⇒ 必返回精确的 D:\IHUI-AI)。两种分支都钉住,前缀兄弟永不合法。
  const legacyExact = existsSync('D:\\IHUI-AI\\package.json')
  const m = parseMarker(runPs(PWSH7, resolveProbe(NO_PKG)))
  if (legacyExact) {
    assert.equal(m.kind, 'OK', `D:\\IHUI-AI 存在时应回退成功,实得 ${m.kind}:${m.payload}`)
    assert.equal(normPath(m.payload), normPath('D:\\IHUI-AI'), '回退只认精确的 D:\\IHUI-AI,不得返回长前缀兄弟目录')
  } else {
    assert.equal(m.kind, 'THROW', `D:\\IHUI-AI 不存在时必须 throw,实得返回: ${m.payload}`)
  }
})

// =============================================================================
// R5 向上探测硬上限(MaxLevels)
// =============================================================================
test('R5 pwsh7:-MaxLevels 截断向上探测,不越过上限(且第 1 级含起点自身)', { skip: SKIP_7 }, () => {
  const deep = join(CAP, 'a', 'b', 'c')
  // 默认 12 级:自 deep 能爬到 cap —— 先证明这条路本身是通的。
  let m = parseMarker(runPs(PWSH7, resolveProbe(deep, ' -Required')))
  assert.equal(m.kind, 'OK', `默认深度应爬到 cap,实得 ${m.kind}:${m.payload}`)
  assert.equal(normPath(m.payload), normPath(CAP))
  // -MaxLevels 1:只准看起点那一层,爬不到 cap ⇒ 截断(非 git 仓挡住 git 分支,-Required 挡住回退)。
  m = parseMarker(runPs(PWSH7, resolveProbe(deep, ' -MaxLevels 1 -Required')))
  assert.equal(m.kind, 'THROW', `MaxLevels=1 必须截断探测,实得返回: ${m.payload}`)
  assert.match(m.payload, /1/, `失败信息应体现上限 1 级: ${m.payload}`)
  // 边界:MaxLevels=1 时起点自身仍在计数内(不是"起点之后只走 1 级")。
  m = parseMarker(runPs(PWSH7, resolveProbe(CAP, ' -MaxLevels 1')))
  assert.equal(m.kind, 'OK', `起点自身带 package.json 时 1 级内应命中,实得 ${m.kind}:${m.payload}`)
  assert.equal(normPath(m.payload), normPath(CAP))
})

// =============================================================================
// R6 调用方接线抽查(纯静态,读文件文本;不依赖宿主)
// =============================================================================
test('R6 静态抽查:11 个调用方 dot-source 唯一实现,全部脚本可执行代码无 D:\\IHUI-AI 字面量', () => {
  // dot-source 形态有两种:直接 `. (Join-Path ... 'ihui-root-common.ps1')` 与
  // 先算变量再 `. $RootCommon`(deploy-loop / run-* 的大声死护栏写法),两者都认。
  const dotSourcePat = /^\s*\.\s+(?:\(Join-Path|\$)/m
  const ps1Callers = [
    'deploy/win/ihui-deploy.ps1',
    'deploy/win/ihui-deploy-loop.ps1',
    'deploy/win/ihui-monitor.ps1',
    'deploy/win/ihui-pg-backup.ps1',
    'deploy/win/ihui-pg-backup-scheduler.ps1',
    'deploy/win/install-deploy-loop-service.ps1',
    'deploy/win/install-auto-deploy-task.ps1',
    'scripts/deploy-online.ps1',
    'deploy/scripts/prod-bundle/svc/run-web.ps1',
    'deploy/scripts/prod-bundle/svc/run-api.ps1',
    'deploy/scripts/prod-bundle/svc/run-ai.ps1',
  ]
  // cmd/bat 的等价护栏(for %%I / rem 规则),只查字面量(它们不 dot-source ps1 函数)。
  const cmdCallers = [
    'deploy/win/install-auto-deploy-task.cmd',
    'deploy/win/run-cdn.bat',
    'scripts/log-prune.cmd',
  ]
  for (const rel of ps1Callers) {
    const src = readFileSync(join(REPO, rel), 'utf8')
    assert.match(src, /ihui-root-common\.ps1/, `${rel}: 未引用唯一解析实现 ihui-root-common.ps1`)
    assert.match(src, dotSourcePat, `${rel}: 未 dot-source helper`)
    assert.match(src, /Resolve-IhuiProjectRoot\s+-StartDir/, `${rel}: 未调用 Resolve-IhuiProjectRoot`)
    const exec = stripCommentLines(src)
    assert.ok(!/D:[\\/]IHUI-AI/i.test(exec), `${rel}: 可执行代码里仍有 D:\\IHUI-AI 字面量(注释外)`)
  }
  for (const rel of cmdCallers) {
    const src = readFileSync(join(REPO, rel), 'utf8')
    const exec = stripCommentLines(src)
    assert.ok(!/D:[\\/]IHUI-AI/i.test(exec), `${rel}: 可执行代码里仍有 D:\\IHUI-AI 字面量(注释外)`)
  }
})

// =============================================================================
// R7 语法洁净
// =============================================================================
test('R7 pwsh7:Parser::ParseFile 解析 helper ⇒ 0 error', { skip: SKIP_7 }, () => {
  const res = runPs(PWSH7, parseProbe())
  const m = (res.stdout || '').match(/COUNT=(\d+)/)
  assert.ok(m, `ParseFile 探针未返回计数(exit=${res.status})\nstdout=${res.stdout}\nstderr=${res.stderr}`)
  assert.equal(Number(m[1]), 0, `helper 存在语法错误:\n${res.stdout}\n${res.stderr}`)
})

test('R7 PS5.1 对照:记录无 BOM UTF-8 中文在 PS5.1 下的 parse 基线(仅记录,不判红)', { skip: SKIP_51 }, (t) => {
  const res = runPs(PS51, parseProbe())
  const m = (res.stdout || '').match(/COUNT=(\d+)/)
  // 只断言探针本身跑通了(基建坏掉才红)。错误计数是全仓既有的 GBK 解码基线,
  // 不是本票的判据 —— 有则记下来供后人对照,不 assert 成 0。
  assert.ok(m, `ParseFile 探针未返回计数(exit=${res.status})\nstdout=${res.stdout}\nstderr=${res.stderr}`)
  const count = Number(m[1])
  t.diagnostic(`PS5.1 parse error count(既有编码基线,不判红)=${count}`)
  for (const line of (res.stdout || '').split(/\r?\n/)) {
    if (!line.startsWith('E:')) continue
    t.diagnostic(`PS5.1 parse error: ${Buffer.from(line.slice(2), 'base64').toString('utf8')}`)
  }
})

test('PS5.1:helper 首 5 行不得含行首 #requires -Version 7 指令(反向断言)+ 阳性对照', () => {
  // 反向断言(2026-10-12 主会话裁定):helper 刻意不写 pragma —— 写回去 =
  // 5.1 机器上备份/监控/部署服务整体停摆(AGENTS §27 规则 2 的 deploy/** 适用面例外段)。
  // 模式必须锚定行首:helper 第 5 行的立因注释本身"提到"了 #requires -Version 7
  // (反引号内),但那是普通注释不是指令;PowerShell 只认行首形态,判据同尺才不误伤。
  const pragmaPat = /^[ \t]*#requires[ \t]+-Version/im
  const head5 = (rel) =>
    readFileSync(join(REPO, rel), 'utf8')
      .split(/\r?\n/)
      .slice(0, 5)
      .join('\n')
  const helperHead = head5('deploy/win/ihui-root-common.ps1')
  assert.ok(
    !pragmaPat.test(helperHead),
    'helper 首 5 行出现行首 `#requires -Version 7` 指令 —— 加回 pragma = 5.1 机器上' +
      '备份/监控/部署服务停摆(AGENTS §27 规则 2 例外段),请删除该指令',
  )
  // 阳性对照:deploy-lock-common.ps1 仍带 pragma,证明上面那条不是恒真断言 ——
  // 同一个模式在同一位置(首 5 行)必须命中,尺子坏了这里先红。
  const controlHead = head5('deploy/win/deploy-lock-common.ps1')
  assert.ok(
    pragmaPat.test(controlHead),
    '阳性对照失效:deploy-lock-common.ps1 首 5 行应含行首 #requires -Version 7,模式失灵?',
  )
})

test('PS5.1 运行期:dot-source helper 不得被 #requires 版本门拦截(反向;GBK parse 基线不判红)', { skip: SKIP_51 }, () => {
  // 真跑一次 PS5.1 dot-source:失败可以(无 BOM 中文的 GBK 基线假错,见事实第 1 条),
  // 但失败的"种类"绝不能是版本门 —— 若有人把 pragma 加回去,实测此处会变成
  // ScriptRequiresUnmatchedPSVersion(版本检查先于 parse 错误上报),本断言当场红。
  const script = [
    `$ErrorActionPreference = 'Stop'`,
    'try {',
    `. '${HELPER}'`,
    `  Write-Output ('OK:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('LOADED')))`,
    '} catch {',
    `  Write-Output ('THROW:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message + ' #' + $_.FullyQualifiedErrorId)))`,
    '}',
  ].join('\n')
  const m = parseMarker(runPs(PS51, script))
  if (m.kind === 'THROW') {
    assert.ok(
      !/ScriptRequires/i.test(m.payload),
      'dot-source 被 #requires 版本门拦截 —— 加回 pragma = 5.1 机器上备份/监控/部署' +
        '服务停摆(AGENTS §27 规则 2 例外段): ' + m.payload,
    )
  } else {
    // kind === 'OK' 合法(例如日后给 helper 加了 BOM,GBK 基线消失、5.1 真加载成功)。
    // 断言 LOADED:成功路径也必须真走到探针终点,不允许空转。
    assert.equal(m.payload, 'LOADED', `意外的加载结果: ${m.payload}`)
  }
})

// =============================================================================
// R8 边界感知:长前缀兄弟目录不得被当成旧根 / 不做前缀匹配
// =============================================================================
test('R8 pwsh7:IHUI-AI-git-repo 这类长前缀目录既不被截断也不被当成旧根', { skip: SKIP_7 }, () => {
  assert.ok(!existsSync(join(LOOK_SHORT, 'package.json')), '前提自检:短前缀兄弟目录不应有 package.json')
  // (1) IHUI_ROOT 指长名根 ⇒ 原样返回整段长路径(前缀截断型 bug 会返回短名)。
  let m = parseMarker(runPs(PWSH7, resolveProbe(join(REPO, 'deploy', 'win'), ' -Required'), { IHUI_ROOT: LOOK_LONG }))
  assert.equal(m.kind, 'OK', `期望解析成功,实得 ${m.kind}:${m.payload}`)
  assert.equal(normPath(m.payload), normPath(LOOK_LONG), '长前缀根被截断或改写')
  // (2) 自长名根深处向上爬 ⇒ 整段长路径;短前缀兄弟(IHUI-AI,无 package.json)不参与判定。
  m = parseMarker(runPs(PWSH7, resolveProbe(join(LOOK_LONG, 'deep'), ' -Required')))
  assert.equal(m.kind, 'OK', `期望解析成功,实得 ${m.kind}:${m.payload}`)
  assert.equal(normPath(m.payload), normPath(LOOK_LONG), '向上爬返回了错误的前缀目录')
  // (3) 静态:helper 不做前缀匹配 —— 旧根判定只能是精确 Test-Path(见其 $legacy 行),
  // 一旦有人改成 StartsWith/-like 这类前缀比较,长前缀兄弟就会被误认成旧根。
  const src = readFileSync(HELPER, 'utf8')
  assert.ok(!/StartsWith\s*\(\s*['"]D:[\\/]/i.test(src), 'helper 不应对旧根做 StartsWith 前缀比较')
  assert.ok(!/-like\s+['"][^'"]*IHUI-AI/i.test(src), 'helper 不应对旧根做 -like 通配比较')
})

test('R8 pwsh7:switch-deploy-root.ps1 若已存在则语法洁净(并行创建中则 skip,不因缺文件判红)', { skip: SKIP_7 }, (t) => {
  const sw = join(REPO, 'deploy', 'win', 'switch-deploy-root.ps1')
  if (!existsSync(sw)) {
    // 该文件由另一并行 agent 创建,此刻尚未落地 —— 缺文件不是本票的失败。
    t.skip('switch-deploy-root.ps1 尚不存在(并行创建中),跳过本用例')
    return
  }
  const res = runPs(
    PWSH7,
    [
      '$tokens = $null',
      '$errs = $null',
      `[void][System.Management.Automation.Language.Parser]::ParseFile('${sw}', [ref]$tokens, [ref]$errs)`,
      `Write-Output ('COUNT=' + $errs.Count)`,
    ].join('\n'),
  )
  const m = (res.stdout || '').match(/COUNT=(\d+)/)
  assert.ok(m, `ParseFile 探针未返回计数(exit=${res.status})\nstdout=${res.stdout}\nstderr=${res.stderr}`)
  assert.equal(Number(m[1]), 0, `switch-deploy-root.ps1 存在语法错误:\n${res.stdout}\n${res.stderr}`)
})
