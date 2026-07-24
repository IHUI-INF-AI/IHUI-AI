# ============================================================================
# Uninstall G:\ root guardian scheduled task
# ============================================================================
# Stops any running guardian processes and removes the scheduled task.
# Only kills PowerShell processes whose command line contains
# 'g-root-guardian'; other PowerShell processes are left alone.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\uninstall-g-root-guardian.ps1
#
# Idempotent: re-running is safe (skips if task not registered).
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Stop'

$TaskName = 'IHUI-AI-G-Root-Guardian'

Write-Host "[uninstall-g-root-guardian] Uninstalling G:\ root guardian service" -ForegroundColor Cyan

# ---- 1. Stop running guardian processes ----
Write-Host "[uninstall-g-root-guardian] Stopping guardian processes..."
# PowerShell 5 Get-Process has no CommandLine property; use WMI to filter.
# Exclude the current process ($PID) because this script's own command line
# also contains 'g-root-guardian' (uninstall-g-root-guardian.ps1).
$guardianProcs = Get-WmiObject Win32_Process |
    Where-Object { $_.CommandLine -like '*g-root-guardian*' -and $_.ProcessId -ne $PID }

if ($guardianProcs) {
    foreach ($p in $guardianProcs) {
        Write-Host ("  Stopping PID " + $p.ProcessId + " (" + $p.Name + ")")
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
    Write-Host "[uninstall-g-root-guardian] Guardian processes stopped." -ForegroundColor Green
} else {
    Write-Host "[uninstall-g-root-guardian] No running guardian processes found."
}

# ---- 2. Unregister scheduled task (if registered) ----
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[uninstall-g-root-guardian] Removing scheduled task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[uninstall-g-root-guardian] Scheduled task removed." -ForegroundColor Green
} else {
    Write-Host "[uninstall-g-root-guardian] Scheduled task '$TaskName' not registered, skipping."
}

# ---- 3. Output result ----
Write-Host ""
Write-Host "==== Uninstall Result ====" -ForegroundColor Green
$stillExists = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($stillExists) {
    Write-Host "  State: STILL REGISTERED (removal failed)" -ForegroundColor Red
} else {
    Write-Host "  State: REMOVED"
}
$stillRunning = Get-WmiObject Win32_Process |
    Where-Object { $_.CommandLine -like '*g-root-guardian*' -and $_.ProcessId -ne $PID }
if ($stillRunning) {
    Write-Host ("  Processes: " + @($stillRunning).Count + " still running") -ForegroundColor Yellow
} else {
    Write-Host "  Processes: none running"
}
Write-Host ""
Write-Host "G:\ root guardian has been uninstalled. Re-run install script to re-enable." -ForegroundColor Cyan
