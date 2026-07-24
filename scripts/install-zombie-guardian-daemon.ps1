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
#   powershell -ExecutionPolicy Bypass -File d:\桌面\项目\IHUI-AI\scripts\install-zombie-guardian-daemon.ps1
# ============================================================================

#Requires -Version 5.0

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

# ---- 2. Stop & remove existing task (v1.0 periodic or any prior install) ----
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[install-daemon] Stopping and removing existing task (v1.0 -> v2.0 upgrade)..." -ForegroundColor Yellow
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Also kill any lingering daemon PowerShell processes from prior install
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
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

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
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
$daemonProcs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
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
Write-Host "  Status:    powershell -ExecutionPolicy Bypass -File `"$ScriptsDir\zombie-guardian-status.ps1`""
Write-Host "  Uninstall: powershell -ExecutionPolicy Bypass -File `"$ScriptsDir\uninstall-zombie-guardian.ps1`""
Write-Host "  Log:       $ProjectRoot\.trae-cn\tmp\zombie-guardian.log"
