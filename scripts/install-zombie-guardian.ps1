# ============================================================================
# Install IHUI-AI Zombie Process Guardian as a Windows Scheduled Task
# ============================================================================
# Registers a scheduled task that runs cleanup-zombie-processes.ps1 every
# 30 minutes to clean up runaway install processes, high-CPU low-memory
# zombies, and trim bloated working sets. Auto-starts on user logon.
#
# No admin privileges required (runs as current user, Limited).
# Uses wscript.exe + VBS launcher for ZERO window popup.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File d:\桌面\项目\IHUI-AI\scripts\install-zombie-guardian.ps1
#
# Idempotent: re-running unregisters the old task and registers a new one.
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Stop'

# ---- Configuration ----
$TaskName = 'IHUI-AI-Zombie-Guardian'
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$CleanupScript = Join-Path $ScriptsDir 'cleanup-zombie-processes.ps1'
$VbsLauncher   = Join-Path $ScriptsDir 'zombie-guardian-hidden.vbs'

Write-Host "[install-zombie-guardian] Installing Zombie Process Guardian service" -ForegroundColor Cyan

# ---- 1. Verify prerequisites ----
if (-not (Test-Path $CleanupScript)) {
    Write-Error "[install-zombie-guardian] Cleanup script not found: $CleanupScript"
    exit 1
}
if (-not (Test-Path $VbsLauncher)) {
    Write-Error "[install-zombie-guardian] VBS launcher not found: $VbsLauncher"
    exit 1
}
Write-Host "  CleanupScript: $CleanupScript"
Write-Host "  VbsLauncher:   $VbsLauncher"
Write-Host "  TaskName:      $TaskName"
Write-Host "  User:          $env:USERNAME"
Write-Host "  Interval:      every 30 minutes"

# ---- 2. Remove existing task if present (idempotent) ----
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[install-zombie-guardian] Existing task found, removing old one..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# ---- 3. Build task components ----
# Action: launch via wscript.exe + VBS wrapper for ZERO window popup.
$action = New-ScheduledTaskAction `
    -Execute 'wscript.exe' `
    -Argument ('"' + $VbsLauncher + '"')

# Triggers (two independent triggers, because AtLogon does not support
# Repetition on its own - we need a separate -Once trigger for the repeat):
#   1. AtLogon: start guardian when user logs in (first run of the day)
#   2. Once + Repeat: every 30 minutes for 365 days (periodic cleanup)
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(30) `
    -RepetitionInterval (New-TimeSpan -Minutes 30) `
    -RepetitionDuration ([TimeSpan]::FromDays(365))
# RepetitionDuration upper bound: 365 days (XML limit, 36500 days rejected).
$triggers = @($triggerLogon, $triggerRepeat)

# Settings: run on battery, retry on failure, no time limit, ignore new instances
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew

# Principal: current user, interactive logon, no admin (Limited)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

$description = 'IHUI-AI Zombie Process Guardian - cleans runaway install processes, high-CPU low-memory zombies, and trims bloated working sets every 30 minutes. Prevents memory exhaustion during development.'

# ---- 4. Register the task ----
Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $triggers `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description $description `
    -Force | Out-Null

Write-Host "[install-zombie-guardian] Task registered successfully!" -ForegroundColor Green

# ---- 5. Start the task immediately (first run) ----
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3

# ---- 6. Output result ----
$task = Get-ScheduledTask -TaskName $TaskName
$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host ""
Write-Host "==== Install Result ====" -ForegroundColor Green
Write-Host ("  TaskName:    " + $task.TaskName)
Write-Host ("  State:       " + $task.State)
Write-Host ("  LastRunTime: " + $taskInfo.LastRunTime)
Write-Host ("  NextRunTime: " + $taskInfo.NextRunTime)
Write-Host ""
Write-Host "Manage:" -ForegroundColor Cyan
Write-Host "  Status:    powershell -ExecutionPolicy Bypass -File `"$ScriptsDir\zombie-guardian-status.ps1`""
Write-Host "  Uninstall: powershell -ExecutionPolicy Bypass -File `"$ScriptsDir\uninstall-zombie-guardian.ps1`""
Write-Host "  Manual run: powershell -ExecutionPolicy Bypass -File `"$CleanupScript`" -AutoClean"
