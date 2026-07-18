# setup-token-refresh-task.ps1
# Register a Windows Scheduled Task to refresh CLI apiKey every Monday 03:00.
# Token validity is 7 days; weekly refresh leaves enough buffer.
#
# Usage:
#   PowerShell -ExecutionPolicy Bypass -File scripts/setup-token-refresh-task.ps1
#   PowerShell -ExecutionPolicy Bypass -File scripts/setup-token-refresh-task.ps1 -TaskName "Custom" -Time 04:00
#
# Verify:
#   Get-ScheduledTask -TaskName "IHUI-RefreshCliToken" | Select-Object TaskName, State
#
# Manual trigger:
#   Start-ScheduledTask -TaskName "IHUI-RefreshCliToken"
#
# Uninstall:
#   Unregister-ScheduledTask -TaskName "IHUI-RefreshCliToken" -Confirm:$false

param(
  [string]$TaskName = 'IHUI-RefreshCliToken',
  [string]$Time = '03:00',
  [string]$ProjectRoot = $(Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Write-Host "[setup-token-refresh] Registering Windows Scheduled Task" -ForegroundColor Cyan
Write-Host "  TaskName:    $TaskName"
Write-Host "  Trigger:     Weekly Monday $Time"
Write-Host "  ProjectRoot: $ProjectRoot"

# 1. Locate node executable
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) {
  Write-Error "[setup-token-refresh] node executable not found in PATH. Please install Node.js first."
  exit 1
}
Write-Host "  node:        $nodeExe"

# 2. Locate refresh-cli-token.mjs
$refreshScript = Join-Path $ProjectRoot 'scripts\refresh-cli-token.mjs'
if (-not (Test-Path $refreshScript)) {
  Write-Error "[setup-token-refresh] scripts/refresh-cli-token.mjs not found under ProjectRoot."
  exit 1
}
Write-Host "  refreshScript: $refreshScript"

# 3. Remove existing task if present (idempotent)
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "[setup-token-refresh] Task already exists, removing old one..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# 4. Build task components
# Trigger: every Monday at $Time
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $Time

# Action: node scripts/refresh-cli-token.mjs with working dir = project root
$action = New-ScheduledTaskAction `
  -Execute $nodeExe `
  -Argument $refreshScript `
  -WorkingDirectory $ProjectRoot

# Settings: run on battery, retry on failure, 30min timeout
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 10) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew

# Principal: current user, interactive logon, highest privileges
$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Highest

# 5. Register the task
$desc = 'Refresh IHUI CLI apiKey weekly (JWT 7-day validity) to keep skills sync working.'
Register-ScheduledTask `
  -TaskName $TaskName `
  -Trigger $trigger `
  -Action $action `
  -Settings $settings `
  -Principal $principal `
  -Description $desc `
  -Force | Out-Null

Write-Host ""
Write-Host "[setup-token-refresh] Task registered successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ("  Status:     Get-ScheduledTask -TaskName '" + $TaskName + "' | Select-Object TaskName, State")
Write-Host ("  Trigger now: Start-ScheduledTask -TaskName '" + $TaskName + "'")
Write-Host ("  Last run:   Get-ScheduledTaskInfo -TaskName '" + $TaskName + "'")
Write-Host ("  Uninstall:  Unregister-ScheduledTask -TaskName '" + $TaskName + "' -Confirm:0")
Write-Host ""
Write-Host "Tip: trigger it once now to verify the refresh script works." -ForegroundColor Yellow
Write-Host ("  Start-ScheduledTask -TaskName '" + $TaskName + "'")
