# ============================================================================
# Install G:\ root guardian as a Windows Scheduled Task
# ============================================================================
# Registers a scheduled task that auto-starts g-root-guardian.ps1 on user
# logon, runs hidden, and auto-restarts on failure (999 retries, 1 min
# interval). No admin privileges required (runs as current user).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\install-g-root-guardian.ps1
#
# Idempotent: re-running unregisters the old task and registers a new one.
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Stop'

# ---- Configuration ----
$TaskName = 'IHUI-AI-G-Root-Guardian'
$ScriptsDir = $PSScriptRoot
$GuardianScript = Join-Path $ScriptsDir 'g-root-guardian.ps1'
$BlacklistFile = Join-Path $ScriptsDir 'g-root-blacklist.json'

Write-Host "[install-g-root-guardian] Installing G:\ root guardian service" -ForegroundColor Cyan

# ---- 1. Verify prerequisites ----
if (-not (Test-Path $GuardianScript)) {
    Write-Error "[install-g-root-guardian] Guardian script not found: $GuardianScript"
    exit 1
}
if (-not (Test-Path $BlacklistFile)) {
    Write-Error "[install-g-root-guardian] Blacklist config not found: $BlacklistFile"
    exit 1
}
Write-Host "  GuardianScript: $GuardianScript"
Write-Host "  BlacklistFile:  $BlacklistFile"
Write-Host "  TaskName:       $TaskName"
Write-Host "  User:           $env:USERNAME"

# ---- 2. Remove existing task if present (idempotent) ----
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[install-g-root-guardian] Existing task found, removing old one..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# ---- 3. Build task components ----
# Action: run guardian hidden with execution policy bypass
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument ('-WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $GuardianScript + '"')

# Trigger: on user logon (current user only)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings: run on battery, retry on failure, no time limit, ignore new instances
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -MultipleInstances IgnoreNew

# Principal: current user, interactive logon, no admin (Limited)
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

$description = 'IHUI-AI G:\ root guardian - blocks junk files/dirs from being created in G:\ root. Auto-restarts on failure.'

# ---- 4. Register the task ----
Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description $description `
    -Force | Out-Null

Write-Host "[install-g-root-guardian] Task registered successfully!" -ForegroundColor Green

# ---- 5. Start the task immediately ----
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

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
Write-Host "  Status:    powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian-status.ps1"
Write-Host "  Uninstall: powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\uninstall-g-root-guardian.ps1"
