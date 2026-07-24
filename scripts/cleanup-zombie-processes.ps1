# ============================================================================
# IHUI-AI Zombie Process Guardian - Cleanup Core
# ============================================================================
# Detects and cleans up runaway/zombie processes that cause memory exhaustion:
#   1. Runaway install processes (pip/npm/pnpm/yarn/cargo install > 30 min)
#   2. High-CPU low-memory zombies (CPU > 1h AND mem < 10MB = busy-loop stuck)
#   3. Orphan dev servers (node next/vite/tsx dev running > 4h, no parent IDE)
#   4. Working-set trim (reclaim physical RAM from bloated processes)
#   5. Trae process count alert (Trae CN > 25 / TRAE SOLO CN > 30 -> warn only)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File cleanup-zombie-processes.ps1            # dry-run (preview)
#   powershell -ExecutionPolicy Bypass -File cleanup-zombie-processes.ps1 -AutoClean # execute cleanup
#   powershell -ExecutionPolicy Bypass -File cleanup-zombie-processes.ps1 -AutoClean -Quiet  # scheduled task
#
# Exit codes: 0 = clean / nothing to do, 1 = cleanup performed, 2 = error
#
# Root cause history (2026-07-24):
#   - python -m pip install ruff ran 10.6h CPU (38353s) with only 2MB memory
#     (busy-loop stuck install). Burned CPU + blocked memory reclaim.
#   - Next.js dev server :8801 left running 818MB while not developing.
#   - TRAE SOLO CN accumulated 46-48 processes (zombie subprocess buildup).
# ============================================================================

#Requires -Version 5.0

param(
    [switch]$DryRun,
    [switch]$AutoClean,
    [switch]$Quiet,
    [int]$ThresholdInstallMins = 30,
    [int]$ThresholdHighCpuSecs = 3600,
    [int]$ThresholdLowMemMB    = 10,
    [int]$ThresholdOrphanDevMins = 240,
    [int]$ThresholdTraeCN      = 25,
    [int]$ThresholdTraeSolo    = 30,
    [int]$ThresholdTrimMemMB   = 150
)

$ErrorActionPreference = 'Continue'

# ---- Dry-run is default if neither -AutoClean nor explicit -DryRun given ----
if (-not $AutoClean) { $DryRun = $true }

# ---- Paths (derive from script location, never hardcode) ----
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptsDir
$LogDir = Join-Path $ProjectRoot '.trae-cn\tmp'
if (-not (Test-Path $LogDir)) {
    try { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null } catch {}
}
$LogFile = Join-Path $LogDir 'zombie-guardian.log'
$LogFileBak = Join-Path $LogDir 'zombie-guardian.log.bak'

# ---- Log rotation (1MB -> .bak) ----
function Rotate-Log {
    try {
        if (Test-Path $LogFile) {
            $size = (Get-Item $LogFile).Length
            if ($size -gt 1MB) {
                if (Test-Path $LogFileBak) { Remove-Item $LogFileBak -Force -ErrorAction SilentlyContinue }
                Rename-Item -Path $LogFile -NewName 'zombie-guardian.log.bak' -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
}

function Write-Log {
    param([string]$Level, [string]$Message)
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "$ts [$Level] $Message"
    if (-not $Quiet) {
        switch ($Level) {
            'KILLED'  { Write-Host $line -ForegroundColor Red }
            'WARN'    { Write-Host $line -ForegroundColor Yellow }
            'INFO'    { Write-Host $line -ForegroundColor Cyan }
            'TRIMMED' { Write-Host $line -ForegroundColor Green }
            default   { Write-Host $line }
        }
    }
    try { Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

# ---- P/Invoke for EmptyWorkingSet (reclaim physical RAM) ----
# Use -TypeDefinition (not -MemberDefinition) for PowerShell 5 compatibility.
# Guard against double-load by checking if type already exists.
if (-not ('ZombieGuardian.MemUtil' -as [type])) {
    try {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace ZombieGuardian {
    public class MemUtil {
        [DllImport("psapi.dll", SetLastError = true)]
        public static extern int EmptyWorkingSet(IntPtr hProcess);
    }
}
'@ -ErrorAction Stop
    } catch {
        Write-Log 'ERROR' "Add-Type failed for EmptyWorkingSet P/Invoke: $($_.Exception.Message)"
    }
}
$memType = 'ZombieGuardian.MemUtil' -as [type]

function Trim-WorkingSet {
    param([System.Diagnostics.Process]$Process)
    if (-not $memType) { return 0 }
    try {
        $before = $Process.WorkingSet64
        [void]$memType::EmptyWorkingSet($Process.Handle)
        $after = (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue).WorkingSet64
        if ($after) { return [math]::Round(($before - $after) / 1MB, 0) }
    } catch {}
    return 0
}

# ---- Helper: get process age in minutes ----
function Get-ProcessAgeMins {
    param($Process)
    try {
        if ($Process.StartTime) {
            return [math]::Round(((Get-Date) - $Process.StartTime).TotalMinutes, 1)
        }
    } catch {}
    return 0
}

# ---- Helper: safe kill ----
function Kill-Process {
    param([int]$Id, [string]$Reason)
    try {
        $p = Get-Process -Id $Id -ErrorAction SilentlyContinue
        if (-not $p) { return $false }
        if ($DryRun) {
            Write-Log 'DRYRUN' "Would kill PID $Id ($Reason) - dry-run, skipped"
            return $false
        }
        Stop-Process -Id $Id -Force -ErrorAction Stop
        Write-Log 'KILLED' "PID $Id ($Reason) - terminated"
        return $true
    } catch {
        Write-Log 'ERROR' "Failed to kill PID $Id ($Reason): $($_.Exception.Message)"
        return $false
    }
}

# ============================================================================
# MAIN
# ============================================================================

Rotate-Log
$mode = if ($DryRun) { 'DRY-RUN (preview)' } else { 'AUTOCLEAN (execute)' }
Write-Log 'INFO' "==== Zombie Guardian run start | Mode: $mode ===="
if (-not $Quiet) {
    Write-Host ""
    Write-Host "==== IHUI-AI Zombie Process Guardian ====" -ForegroundColor Cyan
    Write-Host "  Mode:              $mode"
    Write-Host "  ProjectRoot:       $ProjectRoot"
    Write-Host "  LogFile:           $LogFile"
    Write-Host "  Install threshold: ${ThresholdInstallMins} min"
    Write-Host "  HighCPU threshold: ${ThresholdHighCpuSecs}s AND mem < ${ThresholdLowMemMB}MB"
    Write-Host "  Orphan dev threshold: ${ThresholdOrphanDevMins} min"
    Write-Host ""
}

$cleanupPerformed = $false
$killedCount = 0
$trimmedTotal = 0

# ---- Snapshot all processes with command line ----
$allProcs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine }

# ---- Dev-tool process names: ONLY these are eligible for install/zombie kill.
# IDE processes (Trae CN, TRAE SOLO CN, trae-sandbox, Code, explorer) and user
# apps (Feishu, GameViewer, Edge) are NEVER killed by this guardian.
$devToolNames = @(
    'python.exe','python3.exe','pythonw.exe','pip.exe','pip3.exe','uv.exe',
    'node.exe','npm.exe','npx.exe','pnpm.exe','pnpx.exe','yarn.exe',
    'cargo.exe','go.exe','rustc.exe','tsc.exe','tsx.exe'
)

# ============================================================================
# Rule 1: Runaway install processes (pip/npm/pnpm/yarn/cargo/go/uv install)
# ============================================================================
Write-Log 'INFO' "Rule 1: scanning runaway install processes (>${ThresholdInstallMins} min)"
$installRegex = '(?i)(\bpip\b|\bpip3\b|\buv\b)\s+install|\bnpm\b\s+install|\bpnpm\b\s+install|\byarn\b\s+install|\bcargo\b\s+install|\bgo\b\s+install'
foreach ($p in $allProcs) {
    if ($p.Name -notin $devToolNames) { continue }
    if ($p.CommandLine -notmatch $installRegex) { continue }
    $ageMins = 0
    try {
        $startTime = $p.CreationDate
        if ($startTime) { $ageMins = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1) }
    } catch {}
    if ($ageMins -gt $ThresholdInstallMins) {
        $cmdShort = if ($p.CommandLine.Length -gt 80) { $p.CommandLine.Substring(0,80) + '...' } else { $p.CommandLine }
        Write-Log 'WARN' "Runaway install: PID $($p.ProcessId) $($p.Name) age=${ageMins}min cmd=$cmdShort"
        if (Kill-Process -Id $p.ProcessId -Reason "runaway install ${ageMins}min: $cmdShort") {
            $killedCount++
            $cleanupPerformed = $true
        }
    }
}

# ============================================================================
# Rule 2: High-CPU low-memory zombies (busy-loop stuck processes)
# ============================================================================
Write-Log 'INFO' "Rule 2: scanning high-CPU low-memory zombies (CPU>${ThresholdHighCpuSecs}s AND mem<${ThresholdLowMemMB}MB)"
foreach ($p in $allProcs) {
    if ($p.Name -notin $devToolNames) { continue }
    $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
    if (-not $proc) { continue }
    $memMB = [math]::Round($proc.WorkingSet64 / 1MB, 0)
    $cpuSec = if ($proc.CPU) { [math]::Round($proc.CPU, 0) } else { 0 }
    if ($cpuSec -gt $ThresholdHighCpuSecs -and $memMB -lt $ThresholdLowMemMB) {
        $cmdShort = if ($p.CommandLine.Length -gt 80) { $p.CommandLine.Substring(0,80) + '...' } else { $p.CommandLine }
        Write-Log 'WARN' "Zombie busy-loop: PID $($p.ProcessId) $($p.Name) cpu=${cpuSec}s mem=${memMB}MB cmd=$cmdShort"
        if (Kill-Process -Id $p.ProcessId -Reason "high-CPU low-mem zombie $($p.Name) cpu=${cpuSec}s mem=${memMB}MB") {
            $killedCount++
            $cleanupPerformed = $true
        }
    }
}

# ============================================================================
# Rule 3: Orphan dev servers (node next/vite/tsx dev running > 4h)
# ============================================================================
Write-Log 'INFO' "Rule 3: scanning orphan dev servers (>${ThresholdOrphanDevMins} min) - WARN ONLY, no auto-kill"
$devServerRegex = '(?i)next(\.exe)?\s+(dev|start)|--turbopack|\bvite\b\s+(dev|serve)|\btsx\b\s+watch|\bturbopack\b'
foreach ($p in $allProcs) {
    if ($p.Name -ne 'node.exe' -and $p.Name -ne 'next.exe') { continue }
    if ($p.CommandLine -notmatch $devServerRegex) { continue }
    $ageMins = 0
    try {
        $startTime = $p.CreationDate
        if ($startTime) { $ageMins = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1) }
    } catch {}
    if ($ageMins -gt $ThresholdOrphanDevMins) {
        $cmdShort = if ($p.CommandLine.Length -gt 80) { $p.CommandLine.Substring(0,80) + '...' } else { $p.CommandLine }
        Write-Log 'WARN' "Long-running dev server (review): PID $($p.ProcessId) age=${ageMins}min cmd=$cmdShort - NOT auto-killed (may be in use)"
    }
}

# ============================================================================
# Rule 4: Trae process count alert (warn only, never auto-kill IDE processes)
# ============================================================================
Write-Log 'INFO' "Rule 4: checking Trae process counts"
$traeCNCount = (Get-Process -Name 'Trae CN' -ErrorAction SilentlyContinue | Measure-Object).Count
$traeSoloCount = (Get-Process -Name 'TRAE SOLO CN' -ErrorAction SilentlyContinue | Measure-Object).Count
$sandboxCount = (Get-Process -Name 'trae-sandbox' -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Log 'INFO' "Process counts: Trae CN=$traeCNCount / TRAE SOLO CN=$traeSoloCount / trae-sandbox=$sandboxCount"
if ($traeCNCount -gt $ThresholdTraeCN) {
    Write-Log 'WARN' "Trae CN process count ($traeCNCount) exceeds threshold ($ThresholdTraeCN) - consider restarting IDE to clear zombies"
}
if ($traeSoloCount -gt $ThresholdTraeSolo) {
    Write-Log 'WARN' "TRAE SOLO CN process count ($traeSoloCount) exceeds threshold ($ThresholdTraeSolo) - consider restarting IDE to clear zombies"
}

# ============================================================================
# Rule 5: Working-set trim (reclaim physical RAM from bloated processes)
# ============================================================================
if ($AutoClean) {
    Write-Log 'INFO' "Rule 5: trimming working sets (processes > ${ThresholdTrimMemMB}MB)"
    $trimCandidates = Get-Process | Where-Object { $_.WorkingSet64 -gt ($ThresholdTrimMemMB * 1MB) }
    foreach ($proc in $trimCandidates) {
        $freed = Trim-WorkingSet -Process $proc
        if ($freed -gt 5) {
            Write-Log 'TRIMMED' "PID $($proc.Id) ($($proc.Name)) trimmed ${freed}MB"
            $trimmedTotal += $freed
            $cleanupPerformed = $true
        }
    }
    if ($trimmedTotal -gt 0) {
        Write-Log 'INFO' "Total working-set trimmed: ${trimmedTotal}MB across all processes"
    }
} else {
    Write-Log 'INFO' "Rule 5: skipped (dry-run, no working-set trim)"
}

# ============================================================================
# Summary + memory snapshot
# ============================================================================
$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$usedGB = [math]::Round($totalGB - $freeGB, 1)
$pct = [math]::Round($usedGB / $totalGB * 100, 1)

$summary = "Killed=$killedCount / Trimmed=${trimmedTotal}MB / Mem=${usedGB}GB ($pct%) / Free=${freeGB}GB"
Write-Log 'INFO' "==== Run complete | $summary ===="

if (-not $Quiet) {
    Write-Host ""
    Write-Host "==== Summary ====" -ForegroundColor Cyan
    Write-Host "  Processes killed:     $killedCount"
    Write-Host "  Working-set trimmed:  ${trimmedTotal} MB"
    Write-Host "  Memory used:          ${usedGB}GB / ${totalGB}GB ($pct%)"
    Write-Host "  Memory free:          ${freeGB}GB"
    Write-Host "  Trae counts:          CN=$traeCNCount / SOLO=$traeSoloCount / sandbox=$sandboxCount"
    Write-Host "  Log:                  $LogFile"
    Write-Host ""
    if ($DryRun) {
        Write-Host "  (dry-run: no changes made. Run with -AutoClean to execute.)" -ForegroundColor Yellow
    }
}

# Exit codes: 0 = success (clean or cleanup performed, both are normal),
#             2 = error. We do NOT use exit 1 for "cleanup performed" because
#             Task Scheduler treats non-zero as failure and shows the task as
#             failed in the UI, which would alarm users.
exit 0
