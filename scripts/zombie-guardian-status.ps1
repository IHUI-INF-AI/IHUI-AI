# ============================================================================
# IHUI-AI Zombie Process Guardian - Status Check
# ============================================================================
# Shows current status of the zombie guardian scheduled task, recent log
# entries, and a live memory/process snapshot.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File d:\桌面\项目\IHUI-AI\scripts\zombie-guardian-status.ps1
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptsDir
$LogFile = Join-Path $ProjectRoot '.trae-cn\tmp\zombie-guardian.log'
$TaskName = 'IHUI-AI-Zombie-Guardian'

Write-Host ""
Write-Host "==== IHUI-AI Zombie Process Guardian - Status ====" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Scheduled task status ----
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "[Task] $TaskName" -ForegroundColor Green
    Write-Host ("  State:          " + $task.State)
    Write-Host ("  LastRunTime:    " + $taskInfo.LastRunTime)
    Write-Host ("  NextRunTime:    " + $taskInfo.NextRunTime)
    Write-Host ("  LastResult:     " + $taskInfo.LastTaskResult)
} else {
    Write-Host "[Task] $TaskName - NOT INSTALLED" -ForegroundColor Yellow
    Write-Host "  Install with: powershell -ExecutionPolicy Bypass -File `"$ScriptsDir\install-zombie-guardian.ps1`""
}
Write-Host ""

# ---- 2. Current memory snapshot ----
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$usedGB = [math]::Round($totalGB - $freeGB, 1)
$pct = [math]::Round($usedGB / $totalGB * 100, 1)
Write-Host "[Memory]" -ForegroundColor Cyan
Write-Host ("  Total:          " + $totalGB + " GB")
Write-Host ("  Used:           " + $usedGB + " GB (" + $pct + "%)")
Write-Host ("  Free:           " + $freeGB + " GB")
$memColor = if ($pct -gt 90) { 'Red' } elseif ($pct -gt 80) { 'Yellow' } else { 'Green' }
Write-Host ("  Status:         " + $(if ($pct -gt 90) { 'CRITICAL' } elseif ($pct -gt 80) { 'HIGH' } else { 'OK' })) -ForegroundColor $memColor
Write-Host ""

# ---- 3. Trae process counts ----
$traeCN = (Get-Process -Name 'Trae CN' -ErrorAction SilentlyContinue | Measure-Object).Count
$traeSolo = (Get-Process -Name 'TRAE SOLO CN' -ErrorAction SilentlyContinue | Measure-Object).Count
$sandbox = (Get-Process -Name 'trae-sandbox' -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "[Trae Process Counts]" -ForegroundColor Cyan
Write-Host ("  Trae CN:        " + $traeCN + $(if ($traeCN -gt 25) { '  (WARN: > 25, restart IDE)' } else { '' }))
Write-Host ("  TRAE SOLO CN:   " + $traeSolo + $(if ($traeSolo -gt 30) { '  (WARN: > 30, restart IDE)' } else { '' }))
Write-Host ("  trae-sandbox:   " + $sandbox)
Write-Host ""

# ---- 4. Top 10 memory consumers ----
Write-Host "[Top 10 Memory Consumers]" -ForegroundColor Cyan
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 |
    Select-Object @{N='Name';E={$_.Name}}, Id, @{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB,0)}}, @{N='CPUs';E={[math]::Round($_.CPU,0)}} |
    Format-Table -AutoSize
Write-Host ""

# ---- 5. Recent log (last 20 lines) ----
Write-Host "[Recent Guardian Log (last 20 lines)]" -ForegroundColor Cyan
if (Test-Path $LogFile) {
    Get-Content $LogFile -Tail 20 | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "  (no log file yet at $LogFile - guardian has not run)"
}
Write-Host ""
