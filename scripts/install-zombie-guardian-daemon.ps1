# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

#requires -Version 7
# ============================================================================
# Install IHUI-AI Zombie Guardian Daemon v2.0 (real-time, replaces v1.0)
# ============================================================================
# Uninstalls the old v1.0 30-minute periodic task and registers a long-running
# daemon that monitors memory every 60 seconds with threshold-based response.
#
# Daemon guarantees: memory never exceeds 85% for more than ~60 seconds.
#   > 80% -> trim processes > 100MB
#   > 88% -> trim > 50MB + kill runaway install
#   > 92% -> emergency: kill zombies + trim all
#
# Task config: AtLogon trigger, RestartCount 999 (auto-restart on crash),
# wscript.exe + VBS launcher for zero window popup.
#
# Usage:
#   pwsh -ExecutionPolicy Bypass -File <repo-root>\scripts\install-zombie-guardian-daemon.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

$TaskName = 'IHUI-AI-Zombie-Guardian'
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$DaemonScript = Join-Path $ScriptsDir 'zombie-guardian-daemon.ps1'
$VbsLauncher  = Join-Path $ScriptsDir 'zombie-guardian-daemon-hidden.vbs'

Write-Host "[install-daemon] Upgrading to Zombie Guardian v2.0 (real-time daemon)" -ForegroundColor Cyan

# ---- 1. Verify prerequisites ----
if (-not (Test-Path $DaemonScript)) {
    Write-Error "[install-daemon] Daemon script not found: $DaemonScript"
    exit 1
}
if (-not (Test-Path $VbsLauncher)) {
    Write-Error "[install-daemon] VBS launcher not found: $VbsLauncher"
    exit 1
}
Write-Host "  DaemonScript: $DaemonScript"
Write-Host "  VbsLauncher:  $VbsLauncher"
Write-Host "  TaskName:     $TaskName"
Write-Host "  Mode:         real-time daemon (60s interval, threshold ladder)"

# ---- 2. Refuse to hijack an existing registration (G-266 conflict fix) ----
# Both installers used to claim the SAME task name and each one's step 2 was
# "unregister whatever is there" - running either silently un-installs the
# other. The approved recovery is the v1.0 PERIODIC 30-minute task
# (install-zombie-guardian.ps1), so THIS installer is now explicitly the
# second writer: if the task already exists it must be removed first via
# uninstall-zombie-guardian.ps1. No silent unregister here.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Error @"
[install-daemon] Task '$TaskName' is ALREADY registered (state: $($existing.State)).
This installer will NOT unregister another installer's task. If you really want
the v2.0 daemon here, run first:
  pwsh -ExecutionPolicy Bypass -File `"$ScriptsDir\uninstall-zombie-guardian.ps1`"
"@
    exit 1
}

# Also kill any lingering daemon PowerShell processes from prior install
Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*zombie-guardian-daemon.ps1*' } |
    ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "  Killed stale daemon PID $($_.ProcessId)" } catch {}
    }

# ---- 3. Build task components ----
$action = New-ScheduledTaskAction `
    -Execute 'wscript.exe' `
    -Argument ('"' + $VbsLauncher + '"')

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew

# 2026-09-23: Interactive -> S4U. An S4U task runs in session 0, which has no desktop,
# so no process in that session can create a window on screen at all. The wscript.exe +
# VBS wrapper above is therefore redundant from now on, it is no longer the popup
# defense line (kept as-is on purpose; removing it is a separate decision).
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

$description = 'IHUI-AI Zombie Guardian v2.0 daemon - real-time memory monitor (60s interval). Threshold ladder: >80% trim, >88% aggressive trim+kill install, >92% emergency kill+trim. Auto-restarts on failure (999 retries). Replaces v1.0 30-minute periodic task.'

Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description $description `
    -Force | Out-Null

Write-Host "[install-daemon] Daemon v2.0 task registered!" -ForegroundColor Green

# ---- 4. Start the daemon immediately ----
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

# ---- 5. Verify daemon is running ----
$daemonProcs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*zombie-guardian-daemon.ps1*' }
$task = Get-ScheduledTask -TaskName $TaskName
$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName

Write-Host ""
Write-Host "==== Install Result ====" -ForegroundColor Green
Write-Host ("  TaskName:        " + $task.TaskName)
Write-Host ("  State:           " + $task.State)
Write-Host ("  Daemon running:  " + $(if ($daemonProcs) { "YES (PID $($daemonProcs.ProcessId -join ','))" } else { "NO - check log" }))
Write-Host ("  LastRunTime:     " + $taskInfo.LastRunTime)
Write-Host ""
Write-Host "Daemon behavior:" -ForegroundColor Cyan
Write-Host "  - Checks memory every 60 seconds"
Write-Host "  - > 80% : trim processes > 100MB"
Write-Host "  - > 88% : aggressive trim > 50MB + kill runaway install"
Write-Host "  - > 92% : emergency kill zombies + trim all"
Write-Host "  - Every ~30 min: full cleanup pass"
Write-Host ""
Write-Host "Manage:" -ForegroundColor Cyan
Write-Host "  Status:    pwsh -ExecutionPolicy Bypass -File `"$ScriptsDir\zombie-guardian-status.ps1`""
Write-Host "  Uninstall: pwsh -ExecutionPolicy Bypass -File `"$ScriptsDir\uninstall-zombie-guardian.ps1`""
Write-Host "  Log:       $ProjectRoot\.ihui-agent\tmp\zombie-guardian.log"
