# ============================================================================
# Uninstall IHUI-AI Zombie Process Guardian
# ============================================================================
# Stops and removes the IHUI-AI-Zombie-Guardian scheduled task.
# Does NOT delete the cleanup scripts (they remain in scripts/ for manual use).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File d:\桌面\项目\IHUI-AI\scripts\uninstall-zombie-guardian.ps1
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

$TaskName = 'IHUI-AI-Zombie-Guardian'

Write-Host "[uninstall-zombie-guardian] Removing Zombie Process Guardian service" -ForegroundColor Cyan

# ---- 1. Stop the task if running ----
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "[uninstall-zombie-guardian] Task '$TaskName' not found - nothing to uninstall." -ForegroundColor Yellow
    exit 0
}

Write-Host "  Stopping task if running..."
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

# ---- 2. Unregister the task ----
Write-Host "  Unregistering task..."
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "[uninstall-zombie-guardian] Task '$TaskName' removed successfully." -ForegroundColor Green

# ---- 3. Confirm ----
$stillThere = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($stillThere) {
    Write-Host "[uninstall-zombie-guardian] WARNING: task still present after uninstall!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==== Uninstall Result ====" -ForegroundColor Green
Write-Host "  Task removed:    $TaskName"
Write-Host "  Scripts retained: cleanup-zombie-processes.ps1 (manual use still available)"
Write-Host ""
Write-Host "To re-install: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\install-zombie-guardian.ps1`""
