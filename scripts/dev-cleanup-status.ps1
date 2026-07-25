#requires -Version 5.1
# Show status of IHUI-AI Dev Process Cleanup v2.0
# - Scheduled task state + next/last run
# - Recent cleanup log (last 20 lines)
# - Current node process summary
#
# Usage:
#   powershell -File scripts\dev-cleanup-status.ps1

$taskName = 'IHUI-AI-DevProcessCleanup'
$projectRoot = (Split-Path $PSScriptRoot -Parent)
$logFile = Join-Path $projectRoot '.trae-cn\tmp\dev-process-cleanup.log'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " IHUI-AI Dev Process Cleanup - Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Scheduled task state ---
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $taskName
  Write-Host "[Scheduled Task]" -ForegroundColor Yellow
  Write-Host "  Name:      $($task.TaskName)"
  Write-Host "  State:     $($task.State)"
  Write-Host "  Next run:  $($info.NextRunTime)"
  Write-Host "  Last run:  $($info.LastRunTime)"
  Write-Host "  Last result: $($info.LastTaskResult)"
  Write-Host ""
} else {
  Write-Host "[Scheduled Task] NOT INSTALLED" -ForegroundColor Red
  Write-Host "  Run: powershell -ExecutionPolicy Bypass -File scripts\install-dev-cleanup.ps1"
  Write-Host ""
}

# --- Current node process summary ---
$nodeProcs = @(Get-Process node -ErrorAction SilentlyContinue)
$totalMem = 0
if ($nodeProcs) {
  $totalMem = [math]::Round(($nodeProcs | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
}
Write-Host "[Current Node Processes]" -ForegroundColor Yellow
Write-Host "  Count:    $($nodeProcs.Count)"
Write-Host "  Memory:   ${totalMem} MB"
Write-Host ""

if ($nodeProcs.Count -gt 0) {
  Write-Host "  Top 5 by memory:" -ForegroundColor Gray
  $nodeProcs | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 |
    ForEach-Object {
      $mem = [math]::Round($_.WorkingSet64 / 1MB, 1)
      $age = [math]::Round(((Get-Date) - $_.StartTime).TotalHours, 1)
      Write-Host ("    PID {0,-6} {1,8} MB  {2,6}h" -f $_.Id, $mem, $age)
    }
  Write-Host ""
}

# --- Recent cleanup log ---
if (Test-Path $logFile) {
  Write-Host "[Recent Cleanup Log (last 15 lines)]" -ForegroundColor Yellow
  Get-Content $logFile -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
  Write-Host "[Recent Cleanup Log] No log file yet" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
