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
function extractFn(name) {
  const marker = `function ${name}`
  const start = monitorSrc.indexOf(marker)
  if (start < 0) assert.fail(`未判定:ihui-monitor.ps1 源码里抽不到 function ${name}(函数被改名/删除 ⇒ 本测试失去输入,判红不判绿)`)
  let i = monitorSrc.indexOf('{', start)
  if (i < 0) assert.fail(`未判定:function ${name} 找不到起始大括号`)
  let depth = 0
  for (let j = i; j < monitorSrc.length; j++) {
    const ch = monitorSrc[j]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return monitorSrc.slice(start, j + 1)
    }
  }
  assert.fail(`未判定:function ${name} 大括号不配平`)
}
const FNS = [
  'Get-DiskFreeTier',
  'Get-BackupMissedShifts',
  'Get-DiskAlertSig',
  'Get-UrlAlertSig',
  'Get-CloudflaredAlertSig',
  'Get-BackupAlertSig',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
