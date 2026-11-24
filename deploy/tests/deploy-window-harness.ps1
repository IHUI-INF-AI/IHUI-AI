# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 行为验证:deploy-window-common.ps1 的显式部署窗口判定(全部跑临时状态文件,绝不碰生产状态文件)

#requires -Version 7
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\win\deploy-window-common.ps1'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ('ihui-deploy-window-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$tmp = Join-Path $tmpDir 'ihui-deploy-window.json'
$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function Fresh { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
function Read-Raw { [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8) }
function Set-StateField([string]$field, $value) {
    # 沿模块的原子写回路径改一格,模拟"外部读者看到的时间被回拨"
    $r = Read-IhuiDeployWindowState -Path $tmp
    if (-not $r.Ok) { throw "改字段前状态文件读不出:$($r.Error)" }
    $s = $r.State
    $s[$field] = $value
    $w = Write-IhuiDeployWindowState -Path $tmp -State $s
    if (-not $w.Ok) { throw "改字段后写不回:$($w.Error)" }
}

Write-Output '[1] 文件不存在:不权威、不可用、不抑制'
Fresh
$g1 = Get-IhuiDeployWindowState -Path $tmp
T '1a Authoritative=false' ($g1.Authoritative -eq $false) "Authoritative=$($g1.Authoritative)"
T '1b Available=false' ($g1.Available -eq $false) "Available=$($g1.Available)"
T '1c Suppress=false' ($g1.Suppress -eq $false) "Suppress=$($g1.Suppress)"

Write-Output '[2] 启动窗口:活动且抑制,schema=1'
Fresh
$null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
$g2 = Get-IhuiDeployWindowState -Path $tmp
T '2a Suppress=true' ($g2.Suppress -eq $true) "Suppress=$($g2.Suppress)"
T '2b Active=true' ($g2.Active -eq $true) "Active=$($g2.Active)"
T '2c Phase=merge' ($g2.Phase -eq 'merge') "Phase=$($g2.Phase)"
T '2d RunId=run-A' ($g2.RunId -eq 'run-A') "RunId=$($g2.RunId)"
T '2e Reason 含"部署窗口进行中"' ($g2.Reason -match '部署窗口进行中') $g2.Reason
$raw2 = Read-Raw | ConvertFrom-Json
T '2f 原始 JSON schema=1' ([int]$raw2.schema -eq 1) "schema=$($raw2.schema)"

Write-Output '[3] 心跳过期 20 分钟 ⇒ Stale 且放行'
Set-StateField 'heartbeatAt' ([datetimeoffset]::Now.AddMinutes(-20))
$g3 = Get-IhuiDeployWindowState -Path $tmp -StaleMinutes 10
T '3a Stale=true' ($g3.Stale -eq $true) "Stale=$($g3.Stale)"
T '3b Suppress=false' ($g3.Suppress -eq $false) "Suppress=$($g3.Suppress)"
T '3c Active=false' ($g3.Active -eq $false) "Active=$($g3.Active)"

Write-Output '[4] success + settle 未到 ⇒ 仍抑制'
Fresh
$null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
$null = Close-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Result 'success' -SettleMinutes 15
$g4 = Get-IhuiDeployWindowState -Path $tmp
T '4a Settle=true' ($g4.Settle -eq $true) "Settle=$($g4.Settle)"
T '4b Suppress=true' ($g4.Suppress -eq $true) "Suppress=$($g4.Suppress)"
T '4c Result=success' ($g4.Result -eq 'success') "Result=$($g4.Result)"
T '4d SettleUntil 在未来' (($g4.SettleUntil -ne $null) -and ($g4.SettleUntil -gt [datetimeoffset]::Now)) "SettleUntil=$($g4.SettleUntil)"

Write-Output '[5] success + settle 已过 ⇒ 放行'
Set-StateField 'settleUntil' ([datetimeoffset]::Now.AddMinutes(-1))
$g5 = Get-IhuiDeployWindowState -Path $tmp
T '5a Suppress=false' ($g5.Suppress -eq $false) "Suppress=$($g5.Suppress)"
T '5b Settle=false' ($g5.Settle -eq $false) "Settle=$($g5.Settle)"

Write-Output '[6] failed / rolledback / noop 三种收口立即放行'
foreach ($res in @('failed', 'rolledback', 'noop')) {
    Fresh
    $null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
    $null = Close-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Result $res
    $g6 = Get-IhuiDeployWindowState -Path $tmp
    T "6-$res Suppress=false" ($g6.Suppress -eq $false) "Suppress=$($g6.Suppress) Result=$($g6.Result)"
    T "6-$res Result=$res" ($g6.Result -eq $res) "Result=$($g6.Result)"
}

Write-Output '[7] runId 守卫:一个部署轮不得动另一个轮次的窗口'
Fresh
$null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
$uPhaseB = Update-IhuiDeployWindowPhase -Path $tmp -RunId 'run-B' -Phase 'build'
T '7a UpdatePhase run-B ⇒ Ok=false' ($uPhaseB.Ok -eq $false) "Ok=$($uPhaseB.Ok) Error=$($uPhaseB.Error)"
$uHbB = Update-IhuiDeployWindowHeartbeat -Path $tmp -RunId 'run-B' -MinIntervalSeconds 0
T '7b UpdateHeartbeat run-B ⇒ Ok=false' ($uHbB.Ok -eq $false) "Ok=$($uHbB.Ok) Error=$($uHbB.Error)"
$cB = Close-IhuiDeployWindow -Path $tmp -RunId 'run-B' -Result 'failed'
T '7c Close run-B ⇒ Skipped=true' ($cB.Skipped -eq $true) "Skipped=$($cB.Skipped) Ok=$($cB.Ok)"
$g7 = Get-IhuiDeployWindowState -Path $tmp
T '7d 窗口仍 Active' ($g7.Active -eq $true) "Active=$($g7.Active) Suppress=$($g7.Suppress)"
T '7e 窗口 RunId 仍是 run-A' ($g7.RunId -eq 'run-A') "RunId=$($g7.RunId)"
$uPhaseA = Update-IhuiDeployWindowPhase -Path $tmp -RunId 'run-A' -Phase 'build'
T '7f 换回 run-A 更新成功' ($uPhaseA.Ok -eq $true) "Ok=$($uPhaseA.Ok) Error=$($uPhaseA.Error)"
$cA = Close-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Result 'success' -SettleMinutes 15
T '7g run-A 成功收口' (($cA.Ok -eq $true) -and ($cA.Skipped -eq $false)) "Ok=$($cA.Ok) Skipped=$($cA.Skipped)"
$cA2 = Close-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Result 'failed'
T '7h 已收口后再次 Close ⇒ Skipped=true' ($cA2.Skipped -eq $true) "Skipped=$($cA2.Skipped) Ok=$($cA2.Ok)"
$raw7 = Read-Raw | ConvertFrom-Json
T '7i 文件里 result 仍是 success' ([string]$raw7.result -eq 'success') "result=$($raw7.result)"

Write-Output '[8] JSON 损坏:权威但不可用,且不抑制'
Fresh
[System.IO.File]::WriteAllText($tmp, '{ "schema": 1, "runId": "run-A", ', [System.Text.UTF8Encoding]::new($false))
$g8 = Get-IhuiDeployWindowState -Path $tmp
T '8a Authoritative=true' ($g8.Authoritative -eq $true) "Authoritative=$($g8.Authoritative)"
T '8b Available=false' ($g8.Available -eq $false) "Available=$($g8.Available)"
T '8c Suppress=false' ($g8.Suppress -eq $false) "Suppress=$($g8.Suppress)"
T '8d Error 非空' (-not [string]::IsNullOrWhiteSpace($g8.Error)) "Error=$($g8.Error)"

Write-Output '[9] 多次启动/更新/收口后无 *.tmp-* 残留'
Fresh
$null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
$null = Update-IhuiDeployWindowPhase -Path $tmp -RunId 'run-A' -Phase 'build'
$null = Update-IhuiDeployWindowHeartbeat -Path $tmp -RunId 'run-A' -MinIntervalSeconds 0
$null = Close-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Result 'success' -SettleMinutes 15
$left = @(Get-ChildItem -LiteralPath $tmpDir -Filter '*.tmp-*' -ErrorAction SilentlyContinue)
T '9a 临时目录无 *.tmp-* 残留' ($left.Count -eq 0) "残留 $(($left | ForEach-Object { $_.Name }) -join ',')"

Write-Output '[10] 心跳节流:MinIntervalSeconds=0 必写,随后 15s 内第二次不写'
Fresh
$null = Start-IhuiDeployWindow -Path $tmp -RunId 'run-A' -Phase 'merge'
$h1 = Update-IhuiDeployWindowHeartbeat -Path $tmp -MinIntervalSeconds 0
$h2 = Update-IhuiDeployWindowHeartbeat -Path $tmp -MinIntervalSeconds 15
T '10a 第一次 Written=true' ($h1.Written -eq $true) "Written=$($h1.Written) Ok=$($h1.Ok)"
T '10b 连续第二次 Written=false' ($h2.Written -eq $false) "Written=$($h2.Written) Ok=$($h2.Ok)"

if (Test-Path -LiteralPath $tmpDir) { Remove-Item -LiteralPath $tmpDir -Recurse -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
