# ============================================================================
# IHUI-AI Zombie Process Guardian - Real-time Daemon (v2.0)
# ============================================================================
# Long-running background daemon that monitors memory every 60 seconds and
# responds to thresholds in real-time. Replaces the v1.0 30-minute periodic
# task with continuous protection - memory NEVER exceeds 85% for long.
#
# Threshold response ladder:
#   > 80% -> TRIM all processes > 100MB working set
#   > 88% -> TRIM all processes > 50MB + kill runaway install processes
#   > 92% -> EMERGENCY: above + kill high-CPU low-mem zombies + trim ALL
#   every 30 loops (~30 min) -> full cleanup pass (install/zombie/dev scan)
#
# Launched via VBS (zero window) + Task Scheduler (AtLogon + RestartCount 999).
# Robust: every loop is wrapped in try/catch, daemon never exits on error.
#
# Usage (normally via scheduled task, but can run manually):
#   powershell -ExecutionPolicy Bypass -File zombie-guardian-daemon.ps1
# ============================================================================

#Requires -Version 5.0

param(
    [int]$CheckIntervalSec = 60,
    [int]$TrimThresholdPct  = 80,
    [int]$AggressivePct     = 88,
    [int]$EmergencyPct      = 92,
    [int]$FullCleanEveryN   = 30,
    [int]$TrimCandidateMB   = 100,
    [int]$AggressiveTrimMB  = 50
)

$ErrorActionPreference = 'Continue'

# ---- Paths ----
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptsDir
$LogDir = Join-Path $ProjectRoot '.trae-cn\tmp'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile = Join-Path $LogDir 'zombie-guardian.log'
$LogFileBak = Join-Path $LogDir 'zombie-guardian.log.bak'
$CleanupScript = Join-Path $ScriptsDir 'cleanup-zombie-processes.ps1'

# ---- Dev-tool process names (only these are eligible for kill) ----
$devToolNames = @(
    'python.exe','python3.exe','pythonw.exe','pip.exe','pip3.exe','uv.exe',
    'node.exe','npm.exe','npx.exe','pnpm.exe','pnpx.exe','yarn.exe',
    'cargo.exe','go.exe','rustc.exe','tsc.exe','tsx.exe'
)

# ---- Log with rotation ----
function Rotate-Log {
    try {
        if (Test-Path $LogFile) {
            if ((Get-Item $LogFile).Length -gt 1MB) {
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
    switch ($Level) {
        'KILLED'  { Write-Host $line -ForegroundColor Red }
        'WARN'    { Write-Host $line -ForegroundColor Yellow }
        'EMERG'   { Write-Host $line -ForegroundColor Magenta }
        'TRIMMED' { Write-Host $line -ForegroundColor Green }
        'INFO'    { Write-Host $line -ForegroundColor Cyan }
        default   { Write-Host $line }
    }
    try { Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

# ---- P/Invoke EmptyWorkingSet ----
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
        Write-Log 'ERROR' "Add-Type failed: $($_.Exception.Message)"
    }
}
$memType = 'ZombieGuardian.MemUtil' -as [type]

function Trim-ProcessWS {
    param($Process)
    if (-not $memType) { return 0 }
    try {
        $before = $Process.WorkingSet64
        [void]$memType::EmptyWorkingSet($Process.Handle)
        $after = (Get-Process -Id $Process.Id -ErrorAction SilentlyContinue).WorkingSet64
        if ($after) { return [math]::Round(($before - $after) / 1MB, 0) }
    } catch {}
    return 0
}

function Get-MemoryPct {
    $os = Get-CimInstance Win32_OperatingSystem
    $total = $os.TotalVisibleMemorySize
    $free = $os.FreePhysicalMemory
    return [math]::Round(($total - $free) / $total * 100, 1)
}

function Get-FreeMB {
    $os = Get-CimInstance Win32_OperatingSystem
    return [math]::Round($os.FreePhysicalMemory / 1024, 0)
}

# ---- Kill helpers (dev-tools only, never IDE/user apps) ----
function Kill-DevToolZombies {
    Write-Log 'WARN' 'Scanning dev-tool runaway install + high-CPU low-mem zombies'
    $installRegex = '(?i)(\bpip\b|\bpip3\b|\buv\b)\s+install|\bnpm\b\s+install|\bpnpm\b\s+install|\byarn\b\s+install|\bcargo\b\s+install|\bgo\b\s+install'
    $killed = 0
    $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.Name -in $devToolNames }
    foreach ($p in $procs) {
        $shouldKill = $false
        $reason = ''
        # Rule 1: runaway install > 30 min
        if ($p.CommandLine -match $installRegex) {
            try {
                $age = [math]::Round(((Get-Date) - $p.CreationDate).TotalMinutes, 1)
                if ($age -gt 30) { $shouldKill = $true; $reason = "runaway install ${age}min" }
            } catch {}
        }
        # Rule 2: high-CPU low-mem zombie (CPU>3600s AND mem<10MB)
        if (-not $shouldKill) {
            $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
            if ($proc) {
                $memMB = $proc.WorkingSet64 / 1MB
                $cpuSec = if ($proc.CPU) { $proc.CPU } else { 0 }
                if ($cpuSec -gt 3600 -and $memMB -lt 10) {
                    $shouldKill = $true
                    $reason = "high-CPU low-mem zombie cpu=${cpuSec}s mem=${memMB}MB"
                }
            }
        }
        if ($shouldKill) {
            try {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
                Write-Log 'KILLED' "PID $($p.ProcessId) ($($p.Name)) - $reason"
                $killed++
            } catch {
                Write-Log 'ERROR' "Failed kill PID $($p.ProcessId): $($_.Exception.Message)"
            }
        }
    }
    return $killed
}

function Trim-AllProcesses {
    param([int]$MinMemMB)
    $total = 0
    $count = 0
    Get-Process | Where-Object { $_.WorkingSet64 -gt ($MinMemMB * 1MB) } | ForEach-Object {
        $freed = Trim-ProcessWS -Process $_
        if ($freed -gt 5) {
            Write-Log 'TRIMMED' "PID $($_.Id) ($($_.Name)) trimmed ${freed}MB"
            $total += $freed
            $count++
        }
    }
    return @{ Total = $total; Count = $count }
}

# ============================================================================
# MAIN LOOP
# ============================================================================

Rotate-Log
Write-Log 'INFO' "==== Zombie Guardian Daemon v2.0 started (interval=${CheckIntervalSec}s, trim>${TrimThresholdPct}%, aggressive>${AggressivePct}%, emergency>${EmergencyPct}%) ===="

$loopCount = 0

while ($true) {
    try {
        $loopCount++
        $memPct = Get-MemoryPct
        $freeMB = Get-FreeMB

        # Log every 10 loops (~10 min) or on any threshold breach
        if ($loopCount % 10 -eq 0 -or $memPct -gt $TrimThresholdPct) {
            Write-Log 'INFO' "Loop #$loopCount | Mem=$memPct% | Free=${freeMB}MB"
        }

        # ---- Threshold ladder ----
        if ($memPct -gt $EmergencyPct) {
            # EMERGENCY: kill zombies + trim ALL processes > 50MB
            Write-Log 'EMERG' "Memory ${memPct}% > ${EmergencyPct}% emergency threshold - full intervention"
            $killed = Kill-DevToolZombies
            $result = Trim-AllProcesses -MinMemMB $AggressiveTrimMB
            Write-Log 'INFO' "Emergency done: killed=$killed trimmed=$($result.Total)MB ($($result.Count) procs)"
            Rotate-Log
        }
        elseif ($memPct -gt $AggressivePct) {
            # AGGRESSIVE: trim processes > 50MB + kill runaway install
            Write-Log 'WARN' "Memory ${memPct}% > ${AggressivePct}% aggressive threshold"
            $killed = Kill-DevToolZombies
            $result = Trim-AllProcesses -MinMemMB $AggressiveTrimMB
            if ($result.Total -gt 0) {
                Write-Log 'INFO' "Aggressive trim: ${killed} killed, $($result.Total)MB trimmed ($($result.Count) procs)"
            }
        }
        elseif ($memPct -gt $TrimThresholdPct) {
            # TRIM: trim processes > 100MB
            $result = Trim-AllProcesses -MinMemMB $TrimCandidateMB
            if ($result.Total -gt 0) {
                Write-Log 'INFO' "Routine trim at ${memPct}%: $($result.Total)MB trimmed ($($result.Count) procs)"
            }
        }

        # ---- Full cleanup every N loops (~30 min) ----
        if ($loopCount % $FullCleanEveryN -eq 0) {
            Write-Log 'INFO' "Periodic full cleanup pass (loop #$loopCount)"
            if (Test-Path $CleanupScript) {
                try {
                    & powershell.exe -ExecutionPolicy Bypass -NoProfile -File $CleanupScript -AutoClean -Quiet -ErrorAction SilentlyContinue
                    Write-Log 'INFO' 'Full cleanup pass completed'
                } catch {
                    Write-Log 'ERROR' "Full cleanup failed: $($_.Exception.Message)"
                }
            }
            Rotate-Log
        }
    }
    catch {
        Write-Log 'ERROR' "Loop exception (continuing): $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $CheckIntervalSec
}
