# ============================================================================
# Check G:\ root guardian status
# ============================================================================
# Reports: scheduled task registration, running processes, recent log
# entries, and BLOCKED/ALLOWED/ERROR counts.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\g-root-guardian-status.ps1
#
# Read-only: does not modify any state.
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

$TaskName = 'IHUI-AI-G-Root-Guardian'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogPath = Join-Path $ProjectRoot '.trae-cn\tmp\g-root-guardian.log'

Write-Host "==== G:\ Root Guardian Status ====" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Scheduled task registration ----
Write-Host "[Scheduled Task]" -ForegroundColor Yellow
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "  Registered:  YES"
    Write-Host ("  TaskName:    " + $task.TaskName)
    Write-Host ("  State:       " + $task.State)
    Write-Host ("  LastRunTime: " + $taskInfo.LastRunTime)
    Write-Host ("  NextRunTime: " + $taskInfo.NextRunTime)
    Write-Host ("  LastResult:  " + $taskInfo.LastTaskResult)
} else {
    Write-Host "  Registered:  NO (not registered)"
}
Write-Host ""

# ---- 2. Running guardian processes ----
Write-Host "[Guardian Process]" -ForegroundColor Yellow
# Exclude the current process ($PID) because this script's own command line
# also contains 'g-root-guardian' (g-root-guardian-status.ps1).
$procs = Get-WmiObject Win32_Process |
    Where-Object { $_.CommandLine -like '*g-root-guardian*' -and $_.ProcessId -ne $PID }
if ($procs) {
    foreach ($p in $procs) {
        Write-Host ("  Running: YES (PID: " + $p.ProcessId + ")")
        Write-Host ("    Name:    " + $p.Name)
        Write-Host ("    Started: " + $p.CreationDate)
    }
} else {
    Write-Host "  Running: NO (not running)"
}
Write-Host ""

# ---- 3. Recent log entries (last 10 lines) ----
Write-Host "[Recent Log (last 10 lines)]" -ForegroundColor Yellow
if (Test-Path $LogPath) {
    $logContent = Get-Content $LogPath -Tail 10 -ErrorAction SilentlyContinue
    if ($logContent) {
        foreach ($line in $logContent) {
            Write-Host ("  " + $line)
        }
    } else {
        Write-Host "  (log file exists but is empty)"
    }
} else {
    Write-Host "  (log file not found: $LogPath)"
}
Write-Host ""

# ---- 4. Log statistics ----
Write-Host "[Log Statistics]" -ForegroundColor Yellow
if (Test-Path $LogPath) {
    $allLog = Get-Content $LogPath -ErrorAction SilentlyContinue
    if ($allLog) {
        $blocked = ($allLog | Select-String '\[BLOCKED\]').Count
        $allowed = ($allLog | Select-String '\[ALLOWED\]').Count
        # NOTE: cannot use $error (read-only automatic variable); use $errorCount
        $errorCount = ($allLog | Select-String '\[ERROR\]').Count
        Write-Host ("  BLOCKED: " + $blocked)
        Write-Host ("  ALLOWED: " + $allowed)
        Write-Host ("  ERROR:   " + $errorCount)
        Write-Host ("  Total:   " + $allLog.Count + " lines")
    } else {
        Write-Host "  (log file is empty, no statistics)"
    }
} else {
    Write-Host "  (log file not found, no statistics)"
}
Write-Host ""

# ---- 5. Summary ----
Write-Host "==== Summary ====" -ForegroundColor Cyan
$taskRegistered = $task -ne $null
$procRunning = $procs -ne $null
if ($taskRegistered -and $procRunning) {
    Write-Host "  Status: HEALTHY (task registered + process running)" -ForegroundColor Green
} elseif ($taskRegistered -and -not $procRunning) {
    Write-Host "  Status: WARNING (task registered but process not running)" -ForegroundColor Yellow
    Write-Host "          The guardian may have crashed. It should auto-restart within 1 minute." -ForegroundColor Yellow
    Write-Host "          If not, run: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Yellow
} elseif (-not $taskRegistered -and $procRunning) {
    Write-Host "  Status: WARNING (process running but task not registered)" -ForegroundColor Yellow
    Write-Host "          The guardian is running but won't survive a reboot." -ForegroundColor Yellow
    Write-Host "          Run install script to register the scheduled task." -ForegroundColor Yellow
} else {
    Write-Host "  Status: NOT INSTALLED (task not registered + process not running)" -ForegroundColor Red
    Write-Host "          Run install script to enable G:\ root guardian." -ForegroundColor Cyan
}
