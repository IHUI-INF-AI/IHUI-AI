// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:deploy/win/alert-dedup.ps1 的 Clear-AlertRecoveredIdentities(监控侧身份恢复清偿档)
// 与 deploy/win/ihui-monitor.ps1 的身份串拼装函数(§22c:判据一律从源文件抽出/装载,测试内不抄)。
//
// 钉住的三条不变量(2026-10-17 交付票:监控侧告警身份的终态/清偿 + 身份抖动三格):
//   I1 同一条磁盘/URL/隧道告警在实时值抖动 N 轮后,台账里只有 1 个身份(旧形把状态码/状态词/
//      实时读数写进签名 ⇒ 每轮换身份 ⇒ 4h 窗结构上永不命中,实测同 URL 的 ERR 与 502 各占一槽)。
//   I2 跨档必须变身份(磁盘 1-10GB→lt1GB、备份缺1班→缺2班 ⇒ 新身份当场可重报)。
//   I3 恢复后该身份不再滞留台账:缺席未超窗 ⇒ 只打 recoveredTs 标记且 4h 抑制仍在(间歇故障不得
//      每轮重寄);缺席且超窗 ⇒ 条目删除(真终态);档案读不出 ⇒ 未判定,不得伪装成已清。
// 装车锁 I4:ihui-monitor.ps1 必须真的接线清偿档、且三格旧抖动形态不得回潮(下一席改回即红)。
// 扩面锁 I5/I6(2026-10-17 同日):备份维射程从"只 glob ihui_dev"扩到逐类(ihui_dev + keycloak),
//   两类各出一条身份;"超龄"与"该类一个文件都没有"是两格,"目录取不到/枚举抛错/时刻读不出"是
//   第三格(未判定,只落日志)—— 旧形用 -ErrorAction SilentlyContinue 把第三格折进第二格。
//   I7 把源码里的逐类循环原文抽出来喂四类临时夹具(未判定/超龄/零文件/正常),四格当场量得出来。
//
// 取材纪律:alert-dedup.ps1 顶层只有函数定义 ⇒ 整模块 dot-source(ihui-monitor.ps1 顶层会起
// 巡检循环,禁止 dot-source ⇒ 用大括号配平从源码抽出目标纯函数原文,抽不到 ⇒ 当场未判定红)。
// 全程只喂临时档案(mkScratch,§15b),绝不触发信路径。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const MODULE = join(repoRoot, 'deploy', 'win', 'alert-dedup.ps1')
const MONITOR = join(repoRoot, 'deploy', 'win', 'ihui-monitor.ps1')

// 解释器候选与 deploy-alert-dedup.test.mjs 同形:5.1 在前(IHUI-MONITOR 服务真身是
// WindowsPowerShell 路径,新代码必须两版通用),7 兜底。取不到 ⇒ 未判定,不得记绿。
function findShell() {
  const cands = [
    process.env.SystemRoot
      ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : null,
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'C:/Program Files/PowerShell/7/pwsh.exe',
  ].filter(Boolean)
  for (const c of cands) if (existsSync(c)) return c
  return null
}
const SHELL = findShell()

// 码页前置(见 deploy-alert-dedup.test.mjs T18:缺这一步时中文断言全体假红)。
const UTF8_PREAMBLE = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; '

function pwsh(cmd) {
  if (!SHELL) return { out: '未判定:本机取不到 PowerShell 可执行文件', status: null, missingShell: true }
  const r = spawnSync(SHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', UTF8_PREAMBLE + cmd], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], // AGENTS 12g:派生进程必须显式 stdio
  })
  if (r.error) return { out: `派生失败: ${r.error.message}`, status: null }
  return { out: (r.stdout || '') + (r.stderr || ''), status: r.status }
}

// 从 ihui-monitor.ps1 源码抽函数原文(大括号配平;函数体内注释与字符串均不含花括号,
// monitor 侧新增函数遵守此纪律,源锁 I4c 把这条也钉上)。抽不到即失败——不得静默少喂。
const monitorSrc = readFileSync(MONITOR, 'utf8')
function extractRegion(marker, label = marker) {
  const start = monitorSrc.indexOf(marker)
  if (start < 0) assert.fail(`未判定:ihui-monitor.ps1 源码里抽不到 ${label}(被改名/删除 ⇒ 本测试失去输入,判红不判绿)`)
  const i = monitorSrc.indexOf('{', start)
  if (i < 0) assert.fail(`未判定:${label} 找不到起始大括号`)
  let depth = 0
  for (let j = i; j < monitorSrc.length; j++) {
    const ch = monitorSrc[j]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return monitorSrc.slice(start, j + 1)
    }
  }
  assert.fail(`未判定:${label} 大括号不配平`)
}
function extractFn(name) {
  return extractRegion(`function ${name}`, `function ${name}`)
}
const FNS = [
  'Get-DiskFreeTier',
  'Get-BackupMissedShifts',
  'Get-DiskAlertSig',
  'Get-UrlAlertSig',
  'Get-CloudflaredAlertSig',
  'Get-BackupAlertSig',
  'Get-BackupAbsentAlertSig',
].map(extractFn)

// 每个用例共用的 PS 头部:装载真模块 + 注入抽出的身份函数。
function psHeader(stateFile) {
  return [
    `$ErrorActionPreference='Stop'`,
    `. '${MODULE.replace(/\\/g, '/')}'`,
    FNS.join('\n'),
    `$sf = '${stateFile.replace(/\\/g, '/')}'`,
  ]
}

function runCase(name, scriptLines, expectFn) {
  const scratch = mkScratch(name)
  try {
    const stateFile = join(scratch, 'state.json')
    const { out, status, missingShell } = pwsh([...psHeader(stateFile), ...scriptLines].join('\n'))
    if (missingShell) assert.fail('本机取不到 PowerShell 可执行文件 ⇒ 未判定,不得当作通过')
    assert.equal(status, 0, `pwsh 非零退出: ${out}`)
    expectFn(out)
  } finally {
    rmScratch(scratch)
  }
}

// ── I1 实时值抖动 N 轮 ⇒ 身份只有 1 个 ────────────────────────────────────────────
test('I1a 磁盘剩余读数在 1-10GB 档内抖 6 轮 ⇒ 台账只有 1 个身份,第 2 轮起全 window-hit', () => {
  runCase('i1a', [
    `$discs = @()`,
    `foreach ($g in @(9.8, 7.5, 4.2, 1.5, 9.9, 8.0)) {`,
    `  $r = Test-AlertDueByIdentity -Sig (Get-DiskAlertSig -Tier (Get-DiskFreeTier $g) -Volume 'D') -StateFile $sf -RepeatHours 4`,
    `  $discs += $r.Decision`,
    `}`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("COUNT=" + $st.Map.Count)`,
    `Write-Output ("DEC=" + ($discs -join ','))`,
  ], (out) => {
    assert.match(out, /COUNT=1/, `同档抖动 6 轮后身份数应=1:\n${out}`)
    assert.match(out, /DEC=due-new,window-hit,window-hit,window-hit,window-hit,window-hit/, `首封后必须全被窗压住:\n${out}`)
  })
})

test('I1b URL 状态码 ERR/502/503/404 交替 5 轮 ⇒ 同一 URL 只有 1 个身份(旧形正是 ERR 与 502 各占一槽)', () => {
  runCase('i1b', [
    `$sigs = @()`,
    `$discs = @()`,
    `foreach ($c in @(502, 'ERR', 503, 404, 'ERR')) {`,
    `  $s = Get-UrlAlertSig -Url 'https://aizhs.top/api/health'`,
    `  $sigs += $s`,
    `  $r = Test-AlertDueByIdentity -Sig $s -StateFile $sf -RepeatHours 4`,
    `  $discs += $r.Decision`,
    `}`,
    `$uniq = @($sigs | Sort-Object -Unique)`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("UNIQ=" + $uniq.Count)`,
    `Write-Output ("COUNT=" + $st.Map.Count)`,
    `Write-Output ("DEC=" + ($discs -join ','))`,
    `Write-Output ("SIG=" + $sigs[0])`,
  ], (out) => {
    assert.match(out, /UNIQ=1/, '身份串必须与状态码无关(码只进正文):', out)
    assert.match(out, /COUNT=1/, '台账只许 1 槽:', out)
    assert.match(out, /DEC=due-new,window-hit,window-hit,window-hit,window-hit/, '首封后全被窗压住:', out)
    const sig = (out.match(/SIG=(.+)/) || [])[1] || ''
    assert.ok(!/502|503|404|ERR/.test(sig), `身份串里不得出现任何状态码读数:${sig}`)
  })
})

test('I1c Cloudflared 状态词 Stopped/Paused 抖动 ⇒ 身份恒为固定类别(旧形状态词进身份占多槽)', () => {
  runCase('i1c', [
    `$s1 = Get-CloudflaredAlertSig`,
    `$r1 = Test-AlertDueByIdentity -Sig $s1 -StateFile $sf -RepeatHours 4`,
    `$s2 = Get-CloudflaredAlertSig`,
    `$r2 = Test-AlertDueByIdentity -Sig $s2 -StateFile $sf -RepeatHours 4`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("COUNT=" + $st.Map.Count)`,
    `Write-Output ("SAME=" + ($s1 -eq $s2))`,
    `Write-Output ("SIG=" + $s1)`,
  ], (out) => {
    assert.match(out, /COUNT=1/, '隧道告警只许 1 个身份槽:', out)
    assert.match(out, /SAME=True/, '身份串必须是常量:', out)
    assert.match(out, /SIG=Cloudflared 服务 档=非Running/, '固定类别写法(档=):', out)
  })
})

// ── I2 跨档必须变身份 ──────────────────────────────────────────────────────────────
test('I2 磁盘跨档(1-10GB→lt1GB)与备份跨班(缺1班→缺2班)都生成新身份并可当场重报', () => {
  runCase('i2', [
    `$d1 = Test-AlertDueByIdentity -Sig (Get-DiskAlertSig -Tier (Get-DiskFreeTier 9.8) -Volume 'D') -StateFile $sf -RepeatHours 4`,
    `$d2 = Test-AlertDueByIdentity -Sig (Get-DiskAlertSig -Tier (Get-DiskFreeTier 0.5) -Volume 'D') -StateFile $sf -RepeatHours 4`,
    `Write-Output ("DISK_NEW=" + ($d2.Decision -eq 'due-new'))`,
    `$b1 = Get-BackupAlertSig -Kind 'ihui_dev' -Shifts (Get-BackupMissedShifts -AgeHours 30)`,
    `$b2 = Get-BackupAlertSig -Kind 'ihui_dev' -Shifts (Get-BackupMissedShifts -AgeHours 60)`,
    `Write-Output ("B1=" + $b1)`,
    `Write-Output ("B2=" + $b2)`,
    `Write-Output ("B_DIFF=" + ($b1 -ne $b2))`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("COUNT=" + $st.Map.Count)`,
  ], (out) => {
    assert.match(out, /DISK_NEW=True/, '跨档必须算新身份(缓解也要让收信人看见):', out)
    assert.match(out, /B_DIFF=True/, '备份缺班号变必须换身份:', out)
    assert.match(out, /B1=备份超龄 类别=ihui_dev 档=缺1 班/, '班号写法:', out)
    assert.match(out, /COUNT=2/, '两档磁盘各占一槽:', out)
  })
})

// ── I3 恢复后身份不再滞留台账(终态/清偿) ─────────────────────────────────────────
test('I3a 恢复未超窗 ⇒ 只打 recoveredTs 标记、条目保留、4h 抑制仍在(间歇故障不得每轮重寄)', () => {
  const sig = `磁盘剩余 档=1-10GB 卷=D`
  runCase('i3a', [
    `$sig = '${sig}'`,
    `$r1 = Test-AlertDueByIdentity -Sig $sig -StateFile $sf -RepeatHours 4`,
    `$rc = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `Write-Output ("OK=" + $rc.Ok)`,
    `Write-Output ("CLEARED=" + $rc.Cleared)`,
    `Write-Output ("MARKED=" + $rc.NewlyMarked)`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("KEPT=" + $st.Map.Count)`,
    `Write-Output ("HAS_RECOVTS=" + ([bool]($st.Map.Values | ForEach-Object { $_.recoveredTs } | Where-Object { $_ } | Select-Object -First 1)))`,
    `$r2 = Test-AlertDueByIdentity -Sig $sig -StateFile $sf -RepeatHours 4`,
    `Write-Output ("REFIRE=" + $r2.Decision + "|Due=" + $r2.Due)`,
  ], (out) => {
    assert.match(out, /OK=True/, '清偿档必须判得动:', out)
    assert.match(out, /CLEARED=0/, '未超窗不得删:', out)
    assert.match(out, /MARKED=1/, '必须打上 recoveredTs 标记:', out)
    assert.match(out, /KEPT=1/, '条目保留(抑制仍在):', out)
    assert.match(out, /HAS_RECOVTS=True/, '标记必须落进档案:', out)
    assert.match(out, /REFIRE=window-hit\|Due=False/, '标记期内再抖动不得重寄(消噪不造噪):', out)
  })
})

test('I3b 恢复且超窗 ⇒ 条目删除,台账零滞留;再犯按新故障重计', () => {
  const sig = `磁盘剩余 档=1-10GB 卷=D`
  runCase('i3b', [
    `$sig = '${sig}'`,
    `$null = Test-AlertDueByIdentity -Sig $sig -StateFile $sf -RepeatHours 4`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `$k = Get-AlertDedupKey -Sig $sig`,
    `$st.Map[$k].sigTs = (Get-Date).AddHours(-5).ToString('o')`,
    `Write-AlertDedupState -StateFile $sf -Map $st.Map | Out-Null`,
    `$rc = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `Write-Output ("CLEARED=" + $rc.Cleared)`,
    `Write-Output ("LABEL=" + ($rc.ClearedLabels -join ' ;; '))`,
    `$st2 = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("REMAIN=" + $st2.Map.Count)`,
    `$r3 = Test-AlertDueByIdentity -Sig $sig -StateFile $sf -RepeatHours 4`,
    `Write-Output ("AGAIN=" + $r3.Decision)`,
  ], (out) => {
    assert.match(out, /CLEARED=1/, '超窗缺席身份必须删:', out)
    assert.match(out, /LABEL=磁盘剩余 档=1-10GB 卷=D/, '删除日志必须点名是哪条身份:', out)
    assert.match(out, /REMAIN=0/, '恢复后该身份不得滞留台账:', out)
    assert.match(out, /AGAIN=due-new/, '清偿后再犯 = 新故障重计(与部署侧同语义):', out)
  })
})

test('I3c 在场身份不动、stall=true 一族不归本档、grace 锚点与身份同退、坏档案=未判定不得伪装已清', () => {
  runCase('i3c', [
    // (a) 在场 ⇒ 台账不动、也不打恢复标记
    `$sig = 'web(8801) 未监听'`,
    `$null = Test-AlertDueByIdentity -Sig $sig -StateFile $sf -RepeatHours 4`,
    `$rc = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @($sig) -RepeatHours 4`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("ACTIVE_TOUCHED=" + ($rc.Cleared + $rc.NewlyMarked))`,
    `Write-Output ("ACTIVE_PRESENT=" + $st.Map.ContainsKey((Get-AlertDedupKey -Sig $sig)))`,
    // (b) stall=true 一族不清(那是部署侧的终态)
    `$s2 = '本轮未切流:有未提交文件挡住 ff'`,
    `$null = Test-AlertDueByIdentity -Sig $s2 -StateFile $sf -RepeatHours 4 -Stall`,
    `$rc2 = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `$st2 = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("STALL_SURVIVES=" + $st2.Map.ContainsKey((Get-AlertDedupKey -Sig $s2)))`,
    // (c) grace 锚点与身份同退(只清身份不清锚点会造出"恢复后秒寄",部署侧 2026-10-10 实测教训)
    `Remove-Item -LiteralPath $sf -Force`,
    `$s3 = 'api(8802) 未监听'`,
    `$null = Test-AlertSuppressionGrace -Sig $s3 -StateFile $sf -GraceMinutes 20`,
    `$null = Test-AlertDueByIdentity -Sig $s3 -StateFile $sf -RepeatHours 4`,
    `$st3 = Read-AlertDedupState -StateFile $sf`,
    `foreach ($kk in @($st3.Map.Keys)) { $st3.Map[$kk].sigTs = (Get-Date).AddHours(-5).ToString('o') }`,
    `Write-AlertDedupState -StateFile $sf -Map $st3.Map | Out-Null`,
    `$rc3 = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `$st4 = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("GRACE_PAIR_CLEARED=" + ($rc3.Cleared -eq 2 -and $st4.Map.Count -eq 0))`,
    // (d) 档案坏 ⇒ Ok=false 点名原因,绝不折成"已清"
    `[System.IO.File]::WriteAllText($sf, '{ \"alerts\": { 坏')`,
    `$rc5 = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `Write-Output ("CORRUPT_NOT_OK=" + (-not $rc5.Ok) + '|ERRMSG=' + [bool]$rc5.Error + '|CLEARED=' + $rc5.Cleared)`,
    // (e) 档案不存在 = 无历史,判 Ok 且零计数(§0.3 三态:没有历史不是判不出)
    `Remove-Item -LiteralPath $sf -Force`,
    `$rc6 = Clear-AlertRecoveredIdentities -StateFile $sf -ActiveSig @() -RepeatHours 4`,
    `Write-Output ("ABSENT_OK=" + $rc6.Ok + '|CLEARED=' + $rc6.Cleared + '|ERR=' + [bool]$rc6.Error)`,
  ], (out) => {
    assert.match(out, /ACTIVE_TOUCHED=0/, '在场身份一格都不许动:', out)
    assert.match(out, /ACTIVE_PRESENT=True/, '在场身份必须在:', out)
    assert.match(out, /STALL_SURVIVES=True/, 'stall=true 归部署侧终态,本档越界即红:', out)
    assert.match(out, /GRACE_PAIR_CLEARED=True/, '缺席身份的锚点必须与身份同窗同退:', out)
    assert.match(out, /CORRUPT_NOT_OK=True\|ERRMSG=True\|CLEARED=0/, '坏档案必须未判定且不称已清:', out)
    assert.match(out, /ABSENT_OK=True\|CLEARED=0\|ERR=False/, '档案不存在=无历史(正常),不得折成判不出:', out)
  })
})

// ── I4 装车锁:ihui-monitor.ps1 真接线,且三格旧抖动形态不得回潮 ──────────────────
test('I4 监控侧接线与旧抖动形态反向锁(下一席改回即红)', () => {
  const src = monitorSrc
  assert.match(src, /Clear-AlertRecoveredIdentities -StateFile \$MonitorStateFile/, '清偿档没接线 ⇒ 本票等于没做')
  assert.match(src, /\$activeSigs = @\(\$alerts/, '在场清单必须逐轮喂给清偿档(含零异常轮)')
  assert.doesNotMatch(src, /\$alerts \+= "\$u → \$code2/, '乙-1 回潮:状态码又进了身份串')
  assert.match(src, /\$alerts \+= \(Get-UrlAlertSig -Url \$u\)/, '乙-1 出路:URL 身份只走 Get-UrlAlertSig')
  assert.doesNotMatch(src, /alerts \+= "Cloudflared 服务状态 \$\(\$/, '乙-2 回潮:服务状态词又进了身份串')
  assert.match(src, /\$alerts \+= Get-CloudflaredAlertSig/, '乙-2 出路:固定类别函数')
  assert.doesNotMatch(src, /Get-PSDrive \(Get-Location\)\.Drive\.Name/, '乙-3 回潮:被检卷又跟进程 cwd 走')
  assert.match(src, /Get-PSDrive \$MonitoredDrive/, '乙-3 出路:被检卷按配置($MonitoredDrive)')
  assert.match(src, /IHUI_MONITOR_DISK_LETTER/, '乙-3 覆盖开关必须登记在配置层')
  assert.match(src, /身份恢复清偿 未判定/, '甲:清偿判不出必须能在日志里点名,不得静默')
})

// ── I5 备份维逐类扩面(2026-10-17:keycloak 从未进射程,停更无人喊)──────────────────
// 判据一律走源文件抽出的函数(§22c:FNS 由 extractFn 从 ihui-monitor.ps1 原文取,测试不抄)。
// 钉四格:①逐类各一条身份且同类同班恒等 ②"超龄"与"该类零文件"是两格不是一格
// ③两格身份里都不带实时量(档=缺N 班是整数班号,零文件那一格压根没有数可抖)
// ④台账面两类各占一槽、同槽重复轮被 4h 窗压住。
test('I5 备份维逐类扩面:ihui_dev/keycloak 各一条身份,"超龄"与"零文件"两格不混且身份不随轮抖', () => {
  runCase('i5', [
    `$k1 = Get-BackupAlertSig -Kind 'keycloak' -Shifts (Get-BackupMissedShifts -AgeHours 30)`,
    `$k2 = Get-BackupAlertSig -Kind 'keycloak' -Shifts (Get-BackupMissedShifts -AgeHours 31)`,
    `$d1 = Get-BackupAlertSig -Kind 'ihui_dev' -Shifts (Get-BackupMissedShifts -AgeHours 30)`,
    `Write-Output ("KC_STABLE=" + ($k1 -eq $k2))`,
    `Write-Output ("KC_KIND_DIFF=" + ($k1 -ne $d1))`,
    `Write-Output ("KC1=" + $k1)`,
    `$a1 = Get-BackupAbsentAlertSig -Kind 'keycloak'`,
    `$a2 = Get-BackupAbsentAlertSig -Kind 'ihui_dev'`,
    `Write-Output ("ABSENT1=" + $a1)`,
    `Write-Output ("ABSENT_KIND_DIFF=" + ($a1 -ne $a2))`,
    `Write-Output ("ABSENT_NO_REALTIME=" + (-not ($a1 -match '档=|班|dump|\.dump')))`,
    `Write-Output ("GRID_SEPARATE=" + ($k1 -ne $a1))`,
    `$null = Test-AlertDueByIdentity -Sig $d1 -StateFile $sf -RepeatHours 4`,
    `$null = Test-AlertDueByIdentity -Sig $k1 -StateFile $sf -RepeatHours 4`,
    `$again = Test-AlertDueByIdentity -Sig $k1 -StateFile $sf -RepeatHours 4`,
    `$st = Read-AlertDedupState -StateFile $sf`,
    `Write-Output ("STALE_COUNT=" + $st.Map.Count)`,
    `Write-Output ("STALE_AGAIN=" + $again.Decision)`,
    `$b1 = Test-AlertDueByIdentity -Sig $a1 -StateFile $sf -RepeatHours 4`,
    `$b2 = Test-AlertDueByIdentity -Sig $a1 -StateFile $sf -RepeatHours 4`,
    `Write-Output ("ABSENT_DEC=" + ($b1.Decision + ',' + $b2.Decision))`,
  ], (out) => {
    assert.match(out, /KC_STABLE=True/, '同类同班号必须恒为一个身份(30h 与 31h 都是缺1班):', out)
    assert.match(out, /KC_KIND_DIFF=True/, '异类必须异身份:两类并一条 = 一类没备份被另一类顶掉:', out)
    assert.match(out, /KC1=备份超龄 类别=keycloak 档=缺1 班/, 'keycloak 那一格的身份串:', out)
    assert.match(out, /ABSENT1=无数据库备份文件 类别=keycloak/, '零文件那一格的身份串:', out)
    assert.match(out, /ABSENT_KIND_DIFF=True/, '零文件那一格也必须逐类分开:', out)
    assert.match(out, /ABSENT_NO_REALTIME=True/, '零文件身份里不得出现任何实时量(文件名/小时数/班号):', out)
    assert.match(out, /GRID_SEPARATE=True/, '超龄与零文件必须是两格身份,不得混判:', out)
    assert.match(out, /STALE_COUNT=2/, '两类各占一个身份槽:', out)
    assert.match(out, /STALE_AGAIN=window-hit/, '同身份第二轮必须被 4h 窗压住:', out)
    assert.match(out, /ABSENT_DEC=due-new,window-hit/, '零文件那一格同样按身份去重:', out)
  })
})

// ── I6 备份维扩面的接线锁:射程、出路、旧形态不得回潮 ─────────────────────────────
test('I6 备份维接线锁:两类都在射程、逐类各一条身份、"读不到"不得折成"没备份"、阈值只有一处', () => {
  const src = monitorSrc
  assert.match(src, /kind = 'ihui_dev'/, '射程必须显式列 ihui_dev(现读既有那一类)')
  assert.match(src, /kind = 'keycloak'/, 'keycloak 没进清单 = 本票等于没做')
  assert.match(src, /Get-BackupAbsentAlertSig -Kind \$t\.kind/, '零文件那一格必须走带类别的身份函数')
  assert.doesNotMatch(src, /\$alerts \+= "无数据库备份文件"/, '旧形回潮:常量身份不带类别 ⇒ 两类并成一格')
  assert.doesNotMatch(src, /Get-ChildItem \$t\.glob -ErrorAction SilentlyContinue/, '旧形回潮:SilentlyContinue 把"读不到"折成"没有文件"')
  assert.match(src, /-ErrorAction Stop/, '枚举必须抛得出错,否则"判不出"那一格结构上不存在')
  assert.match(src, /备份新鲜度维 未判定\(类别=/, '逐类未判定必须点名是哪一类')
  assert.match(src, /\}\s*catch\s*\{\s*Log "备份新鲜度维 未判定\(类别=/, '每一类各自一个 catch:一类判不出不得把另一类一起带走')
  assert.equal((src.match(/Get-BackupMissedShifts -AgeHours/g) || []).length, 1, '档位算法只许一处调用点(第二份必然漂开)')
  assert.equal((src.match(/-gt 26\b/g) || []).length, 1, '26h 阈值只在巡检段出现一次,不抄第二份')
  assert.match(src, /ihui-pg-backup\.ps1:353/, '阈值/节律的出处必须写在注释里(现读行号,不是记忆)')
})

// ── I7 备份维那一轮的四格实测(把源码里的逐类循环原文抽出来喂临时夹具,不抄第二份判据)──
// 四格必须各归各位:①目录取不到 ⇒ 未判定(不红不绿) ②超龄 ⇒ 一条身份 ③枚举成功而零文件 ⇒
// 另一条身份(红) ④正常 ⇒ 什么都不产。四类同排一轮,还要证明"判不出那一类"不会把后面的类带走。
test('I7 备份维四格实测:未判定/超龄/零文件/正常 分得开,一类判不出不带走另一类', () => {
  const loop = extractRegion('foreach ($t in $bakTargets) {', '备份维逐类循环')
  runCase('i7', [
    `$d = Split-Path $sf -Parent`,
    `$stale = Join-Path $d 'pg-stale'`,
    `$zero = Join-Path $d 'pg-zero'`,
    `$fresh = Join-Path $d 'pg-fresh'`,
    `$null = New-Item -ItemType Directory -Path $stale -Force`,
    `$null = New-Item -ItemType Directory -Path $zero -Force`,
    `$null = New-Item -ItemType Directory -Path $fresh -Force`,
    `Set-Content -LiteralPath (Join-Path $stale 'ihui_dev_20260101_030000.dump') -Value 'x' -Encoding ascii`,
    `Set-Content -LiteralPath (Join-Path $fresh 'keycloak_20260101_030000.dump') -Value 'x' -Encoding ascii`,
    `(Get-Item -LiteralPath (Join-Path $stale 'ihui_dev_20260101_030000.dump')).LastWriteTime = (Get-Date).AddHours(-30)`,
    `$alerts = @()`,
    `$alertDetail = @()`,
    `$script:und = @()`,
    `function Log($m) { $script:und += $m }`,
    // nodir 排第一位:它当轮判不出,后面的类仍必须照判(旧写法整维一个 catch,一处抛错全体没判)
    `$bakTargets = @(`,
    `  @{ kind = 'nodir'; dir = (Join-Path $d 'pg-missing'); pattern = 'ihui_dev_*.dump' },`,
    `  @{ kind = 'ihui_dev'; dir = $stale; pattern = 'ihui_dev_*.dump' },`,
    `  @{ kind = 'keycloak'; dir = $zero; pattern = 'keycloak_*.dump' },`,
    `  @{ kind = 'freshone'; dir = $fresh; pattern = 'keycloak_*.dump' }`,
    `)`,
    loop,
    `Write-Output ("ALERT_COUNT=" + @($alerts).Count)`,
    `Write-Output ("ALERTS=" + (@($alerts) -join ' ;; '))`,
    `Write-Output ("UNDET=" + (@($script:und) -join ' ;; '))`,
    `Write-Output ("DETAIL=" + (@($alertDetail) -join ' ;; '))`,
  ], (out) => {
    const alerts = (out.match(/ALERTS=(.+)/) || [])[1] || ''
    const und = (out.match(/UNDET=(.+)/) || [])[1] || ''
    const detail = (out.match(/DETAIL=(.+)/) || [])[1] || ''
    assert.match(out, /ALERT_COUNT=2/, `只许超龄与零文件两格进告警(未判定与正常都不许):${out}`)
    assert.ok(alerts.includes('备份超龄 类别=ihui_dev 档=缺1 班'), `超龄那一格必须有身份:\n${out}`)
    assert.ok(alerts.includes('无数据库备份文件 类别=keycloak'), `零文件那一格必须有身份(且带类别):\n${out}`)
    assert.ok(!alerts.includes('nodir'), `目录取不到那一格不得变成红信(它是判不出,不是没备份):\n${alerts}`)
    assert.ok(!alerts.includes('freshone'), `新鲜备份不得产告警:\n${alerts}`)
    assert.match(und, /^备份新鲜度维 未判定\(类别=nodir/, `判不出必须点名类别落到日志里(不得折成告警也不得折成正常):\n${out}`)
    assert.ok(detail.includes('枚举到 0 个文件'), `零文件那一格的实时正文(目录+匹配式)必须留档:\n${out}`)
    assert.ok(detail.includes('缺 1 班'), '超龄那一格把实测小时数只写进正文:', out)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
