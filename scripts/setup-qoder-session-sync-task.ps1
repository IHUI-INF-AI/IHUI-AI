# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# setup-qoder-session-sync-task.ps1
# Register IHUI-Qoder-Session-Sync: every N minutes run scripts/sync-qoder-client-session.mjs
# as the interactive desktop user, so the Qoder client session is fed back into the relay
# account pool (auto-import when missing + credential refresh when rotated).
#
# Why InteractiveToken and NOT S4U (opposite of scripts/setup-token-refresh-task.ps1):
#   apps/api/scripts/qoder-capture.ps1 reads %APPDATA%\com.qoder[cn].app.* and decrypts
#   auth.v1.dat with DPAPI CurrentUser. An S4U task runs in session 0 without the
#   interactive user profile: APPDATA points at systemprofile and the DPAPI master keys
#   of the signed-in user are unavailable. The capture leg MUST run as the same Windows
#   user that is signed in to Qoder.
#
# Why a task at all:
#   The API service runs as LocalSystem, so the BullMQ qoder-session-sync job can never
#   read the Qoder login state (it logs "未找到 Qoder 数据目录" every 10 minutes and
#   exits 2). This scheduled task is the supported capture leg; the pool-side sweep then
#   covers the account (health checks, expiry refresh, idle keepalive).
#
# Usage:
#   pwsh -File scripts/setup-qoder-session-sync-task.ps1              # register/refresh
#   pwsh -File scripts/setup-qoder-session-sync-task.ps1 -CheckOnly   # read-only check
#   pwsh -File scripts/setup-qoder-session-sync-task.ps1 -RunNow      # register + trigger
#
# Exit codes: 0 ok / 1 drift or failed / 2 undetermined (inputs unavailable).

param(
  [string]$TaskName = 'IHUI-Qoder-Session-Sync',
  [int]$IntervalMinutes = 10,
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$LogDir = 'D:\DevEnv\logs',
  [switch]$CheckOnly,
  [switch]$RunNow
)

$ErrorActionPreference = 'Stop'

function Fail-Undetermined([string]$why) {
  Write-Host "[qoder-sync-task] 未判定: $why" -ForegroundColor Yellow
  exit 2
}

$syncScript = Join-Path $ProjectRoot 'scripts\sync-qoder-client-session.mjs'
if (-not (Test-Path $syncScript)) { Fail-Undetermined "sync script not found: $syncScript" }

$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { Fail-Undetermined 'node not found in PATH' }

$pwshExe = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $pwshExe) { Fail-Undetermined 'pwsh (PowerShell 7) not found in PATH; qoder-capture.ps1 needs it' }
$pwshDir = Split-Path -Parent $pwshExe
$nodeDir = Split-Path -Parent $nodeExe

$wrapperDir = Join-Path $env:USERPROFILE '.ihui-silent-guard'
$cmdPath = Join-Path $wrapperDir 'qoder-session-sync.cmd'
$vbsPath = Join-Path $wrapperDir 'qoder-session-sync-hidden.vbs'

Write-Host "[qoder-sync-task] TaskName     : $TaskName"
Write-Host "[qoder-sync-task] Trigger      : every $IntervalMinutes minute(s)"
Write-Host "[qoder-sync-task] Identity     : $env:USERNAME (InteractiveToken; DPAPI needs the signed-in profile)"
Write-Host "[qoder-sync-task] node         : $nodeExe"
Write-Host "[qoder-sync-task] pwsh dir     : $pwshDir"
Write-Host "[qoder-sync-task] wrapper      : $vbsPath"
Write-Host "[qoder-sync-task] log          : $(Join-Path $LogDir 'qoder-session-sync.log')"

if (-not $CheckOnly) {
  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
  New-Item -ItemType Directory -Path $wrapperDir -Force | Out-Null

  # ASCII-only wrappers: wscript decodes .vbs via the ANSI codepage.
  $cmdLines = @(
    '@echo off',
    'setlocal',
    ('set "PATH=' + $nodeDir + ';' + $pwshDir + ';%PATH%"'),
    ('"' + $nodeExe + '" "' + $syncScript + '" --json >> "' + (Join-Path $LogDir 'qoder-session-sync.log') + '" 2>&1')
  )
  Set-Content -LiteralPath $cmdPath -Value $cmdLines -Encoding ascii

  $vbsLines = @(
    "' Hidden launcher for IHUI-Qoder-Session-Sync (SW_HIDE, zero visible console window).",
    "' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.",
    'Option Explicit',
    'Dim shell',
    'Set shell = CreateObject("WScript.Shell")',
    ('shell.Run "cmd.exe /c ' + $cmdPath + '", 0, False')
  )
  Set-Content -LiteralPath $vbsPath -Value $vbsLines -Encoding ascii

  $tr = 'wscript.exe "' + $vbsPath + '"'
  & schtasks.exe /Create /TN $TaskName /TR $tr /SC MINUTE /MO $IntervalMinutes /RU $env:USERNAME /IT /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[qoder-sync-task] 注册失败 (schtasks exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
  Write-Host "[qoder-sync-task] registered" -ForegroundColor Green
}

# ---- verification: task exists, action is the hidden wrapper, trigger interval reads back ----
$xml = & schtasks.exe /Query /TN $TaskName /XML 2>$null
if ($LASTEXITCODE -ne 0 -or -not $xml) {
  Write-Host "[qoder-sync-task] 未判定: task not queryable ($TaskName)" -ForegroundColor Yellow
  exit 2
}
$text = ($xml | Out-String)
$checks = [ordered]@{
  wrapper_action = $text.Contains('qoder-session-sync-hidden.vbs')
  interactive    = $text.Contains('InteractiveToken')
  every_n_min    = $text.Contains('<Interval>PT' + $IntervalMinutes + 'M</Interval>')
}
$bad = @($checks.Keys | Where-Object { -not $checks[$_] })
foreach ($k in $checks.Keys) {
  Write-Host ("[qoder-sync-task] {0,-14}: {1}" -f $k, $(if ($checks[$k]) { 'ok' } else { 'MISSING' }))
}

if ($RunNow) {
  & schtasks.exe /Run /TN $TaskName | Out-Null
  Start-Sleep -Seconds 20
  $logPath = Join-Path $LogDir 'qoder-session-sync.log'
  if (Test-Path $logPath) {
    Write-Host "[qoder-sync-task] last log lines:" -ForegroundColor Cyan
    Get-Content -LiteralPath $logPath -Tail 4 | ForEach-Object { Write-Host "  $_" }
  } else {
    Write-Host "[qoder-sync-task] log file not created yet: $logPath" -ForegroundColor Yellow
  }
}

if ($bad.Count -gt 0) {
  Write-Host ("[qoder-sync-task] drift: " + ($bad -join ',')) -ForegroundColor Red
  exit 1
}
Write-Host "[qoder-sync-task] ok" -ForegroundColor Green
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
