# ============================================================================
# Uninstall IHUI-AI Zombie Process Guardian (v1.0 periodic + v2.0 daemon)
# ============================================================================
# Stops and removes the IHUI-AI-Zombie-Guardian scheduled task AND kills any
# lingering daemon PowerShell process (v2.0 daemon runs as a long-running
# background process that survives task stop). Does NOT delete the cleanup
# scripts (they remain in scripts/ for manual use).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File d:\桌面\项目\IHUI-AI\scripts\uninstall-zombie-guardian.ps1
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Continue'

$TaskName = 'IHUI-AI-Zombie-Guardian'

Write-Host "[uninstall-zombie-guardian] Removing Zombie Process Guardian (task + daemon)" -ForegroundColor Cyan

# ---- 1. Stop the scheduled task if present ----
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Write-Host "  Stopping scheduled task..."
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Host "  Unregistering task..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
} else {
    Write-Host "  Task '$TaskName' not found (already removed or never installed)." -ForegroundColor Yellow
}

# ---- 2. Kill any lingering daemon PowerShell process (v2.0) ----
# The daemon survives task stop because it's a detached powershell.exe child.
# Find by command line match and force-kill.
Write-Host "  Scanning for lingering daemon processes..."
$daemonProcs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*zombie-guardian-daemon.ps1*' }
if ($daemonProcs) {
    foreach ($dp in $daemonProcs) {
        try {
            Stop-Process -Id $dp.ProcessId -Force -ErrorAction Stop
            Write-Host "  Killed daemon PID $($dp.ProcessId)" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to kill daemon PID $($dp.ProcessId): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  No lingering daemon processes found."
}

# Also kill any stale v1.0 cleanup processes (just in case)
$staleCleanup = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*cleanup-zombie-processes.ps1*' -and $_.CommandLine -like '*-Quiet*' }
foreach ($sc in $staleCleanup) {
    try { Stop-Process -Id $sc.ProcessId -Force -ErrorAction Stop; Write-Host "  Killed stale cleanup PID $($sc.ProcessId)" } catch {}
}

# ---- 3. Confirm ----
$stillTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$stillDaemon = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*zombie-guardian-daemon.ps1*' }

Write-Host ""
Write-Host "==== Uninstall Result ====" -ForegroundColor Green
if ($stillTask) {
    Write-Host "  Task:     STILL PRESENT (may need manual removal)" -ForegroundColor Red
} else {
    Write-Host "  Task:     removed" -ForegroundColor Green
}
if ($stillDaemon) {
    Write-Host "  Daemon:   STILL RUNNING (PID $($stillDaemon.ProcessId))" -ForegroundColor Red
} else {
    Write-Host "  Daemon:   terminated" -ForegroundColor Green
}
Write-Host "  Scripts:  retained in scripts/ (manual use still available)"
Write-Host ""
Write-Host "To re-install v2.0 daemon: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\install-zombie-guardian-daemon.ps1`""
