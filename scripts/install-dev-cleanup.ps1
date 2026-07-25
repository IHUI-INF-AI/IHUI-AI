#requires -Version 5.1
# Install IHUI-AI Dev Process Cleanup v2.0 as Windows scheduled task.
# Triggers: every 10 minutes + at user logon.
# Hidden window, auto-restart on failure, runs as current user (no admin prompt).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install-dev-cleanup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install-dev-cleanup.ps1 -Uninstall

param([switch]$Uninstall)

$taskName = 'IHUI-AI-DevProcessCleanup'
$scriptPath = Join-Path $PSScriptRoot 'cleanup-dev-processes.ps1'

if (-not (Test-Path $scriptPath)) {
  Write-Host "ERROR: cleanup script not found at $scriptPath" -ForegroundColor Red
  exit 1
}

if ($Uninstall) {
  Write-Host "Uninstalling scheduled task '$taskName'..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Uninstalled." -ForegroundColor Green
  exit 0
}

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "Installing dev process cleanup v2.0..." -ForegroundColor Cyan
Write-Host "  Script: $scriptPath"
Write-Host "  Triggers: every 10 minutes + at logon"
Write-Host ""

# Action: run PowerShell hidden, silent cleanup
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" -Quiet"

# Trigger 1: every 10 minutes (repeat indefinitely)
$trigger10min = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 10)

# Trigger 2: at user logon
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

# Combine triggers
$triggers = @($trigger10min, $triggerLogon)

# Settings
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

# Principal: current user, interactive (no UAC prompt)
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Principal $principal `
  -Description 'IHUI-AI dev process auto cleanup v2.0 - kills duplicate dev servers and redundant PM2 daemons every 10 minutes. Safe: only kills duplicate main processes, keeps newest, skips processes younger than 2 min.' `
  -Force | Out-Null

Write-Host "Installed." -ForegroundColor Green
Write-Host ""

# Verify
$info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Write-Host "=== Task info ===" -ForegroundColor Cyan
  Write-Host "  Name:      $($task.TaskName)"
  Write-Host "  State:     $($task.State)"
  Write-Host "  Next run:  $($info.NextRunTime)"
  Write-Host "  Last run:  $($info.LastRunTime)"
  Write-Host "  Triggers:  $($task.Triggers.Count) (every 10min + at logon)"
} else {
  Write-Host "ERROR: task registration failed" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Quick test (DryRun) ===" -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File $scriptPath -DryRun

Write-Host ""
Write-Host "Done. The cleanup will run automatically every 10 minutes." -ForegroundColor Green
Write-Host "To check status:  powershell -File scripts\cleanup-dev-processes.ps1 -Status"
Write-Host "To uninstall:     powershell -File scripts\install-dev-cleanup.ps1 -Uninstall"
