#requires -Version 5.1
# IHUI-AI Dev Process Cleanup v2.0
# Smart cleanup: groups processes by service (web/api/ai-service), kills duplicate
# main processes (keeps newest), recurses into child process trees.
# Safety: skips processes younger than 2 min (starting up); never kills whitelisted
# processes (guardian, TRAE, IDE, this script itself).
#
# Usage:
#   powershell -File scripts\cleanup-dev-processes.ps1            # execute
#   powershell -File scripts\cleanup-dev-processes.ps1 -DryRun    # preview only
#   powershell -File scripts\cleanup-dev-processes.ps1 -Quiet     # silent (scheduled task)
#   powershell -File scripts\cleanup-dev-processes.ps1 -Status    # show recent log
#
# Log: .trae-cn/tmp/dev-process-cleanup.log (auto-rotates at 1MB -> .bak)

param(
  [switch]$DryRun,
  [switch]$Quiet,
  [switch]$Status
)

$ErrorActionPreference = 'Continue'
$projectRoot = (Split-Path $PSScriptRoot -Parent)
$logDir = Join-Path $projectRoot '.trae-cn\tmp'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir 'dev-process-cleanup.log'
$bakFile  = Join-Path $logDir 'dev-process-cleanup.log.bak'

# --- Log rotation (rotate at 1MB) ---
if (Test-Path $logFile) {
  $size = (Get-Item $logFile).Length
  if ($size -gt 1MB) {
    if (Test-Path $bakFile) { Remove-Item $bakFile -Force }
    Rename-Item $logFile $bakFile -Force
  }
}

function Write-Log {
  param([string]$Msg, [string]$Level = 'INFO')
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "$ts [$Level] $Msg"
  if (-not $Quiet -and -not $Status) { Write-Host $line }
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Get-ShortCmd {
  param([string]$Cmd)
  if (-not $Cmd) { return '(null)' }
  if ($Cmd.Length -gt 80) { return $Cmd.Substring(0, 80) + '...' }
  return $Cmd
}

# --- Status mode: show recent log and exit ---
if ($Status) {
  if (Test-Path $logFile) {
    Write-Host "=== Last 30 lines of dev-process-cleanup.log ===" -ForegroundColor Cyan
    Get-Content $logFile -Tail 30
  } else {
    Write-Host "No cleanup log found at $logFile" -ForegroundColor Yellow
  }
  exit 0
}

# --- Classify a node process into a service group ---
# Returns: $null (ignore) or @{ Service='web|api|ai-service|pm2'; IsMain=$true|$false }
function Classify-Process {
  param([string]$Cmd)

  if (-not $Cmd) { return $null }

  # PM2 daemon + forked workers
  if ($Cmd -like '*pm2\lib\Daemon.js*')    { return @{ Service = 'pm2'; IsMain = $true } }
  if ($Cmd -like '*pm2\lib\ProcessContainerFork.js*') { return @{ Service = 'pm2'; IsMain = $false } }

  # web: pnpm filter (main = user-invoked via Roaming\npm; shim = Local\pnpm\.tools, NOT main)
  if ($Cmd -like '*--filter @ihui/web*' -and $Cmd -like '*AppData\Roaming\npm*') { return @{ Service = 'web'; IsMain = $true } }
  if ($Cmd -like '*--filter @ihui/web*' -and $Cmd -like '*AppData\Local\pnpm\.tools*') { return @{ Service = 'web'; IsMain = $false } }
  if ($Cmd -like '*"@ihui/web" "dev"*') { return @{ Service = 'web'; IsMain = $false } }  # pnpm shim, child
  if ($Cmd -like '*next\dist\bin\next*dev*') { return @{ Service = 'web'; IsMain = $true } }
  if ($Cmd -like '*next\dist\server\lib\start-server*') { return @{ Service = 'web'; IsMain = $false } }
  if ($Cmd -like '*\.next\postcss*') { return @{ Service = 'web'; IsMain = $false } }

  # api: pnpm filter (main = Roaming\npm; shim = Local\pnpm\.tools, NOT main)
  if ($Cmd -like '*--filter @ihui/api*' -and $Cmd -like '*AppData\Roaming\npm*') { return @{ Service = 'api'; IsMain = $true } }
  if ($Cmd -like '*--filter @ihui/api*' -and $Cmd -like '*AppData\Local\pnpm\.tools*') { return @{ Service = 'api'; IsMain = $false } }
  if ($Cmd -like '*"@ihui/api" "dev"*') { return @{ Service = 'api'; IsMain = $false } }  # pnpm shim, child
  if ($Cmd -like '*tsx*dist\cli.mjs*watch*src\index.ts*') { return @{ Service = 'api'; IsMain = $true } }
  if ($Cmd -like '*--require*tsx*preflight*src\index.ts*') { return @{ Service = 'api'; IsMain = $false } }

  # ai-service: pnpm filter (main = Roaming\npm; shim = Local\pnpm\.tools, NOT main)
  if ($Cmd -like '*--filter @ihui/ai-service*' -and $Cmd -like '*AppData\Roaming\npm*') { return @{ Service = 'ai-service'; IsMain = $true } }
  if ($Cmd -like '*--filter @ihui/ai-service*' -and $Cmd -like '*AppData\Local\pnpm\.tools*') { return @{ Service = 'ai-service'; IsMain = $false } }
  if ($Cmd -like '*uvicorn*') { return @{ Service = 'ai-service'; IsMain = $true } }
  if ($Cmd -like '*python*main.py*' -and $Cmd -like '*ai-service*') { return @{ Service = 'ai-service'; IsMain = $true } }

  return $null
}

# --- Kill a process and all its descendants recursively ---
function Kill-ProcessTree {
  param([int]$ParentId, [int]$Depth = 0)
  if ($Depth -gt 8) { return }  # safety: prevent infinite recursion

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Kill-ProcessTree -ParentId $child.ProcessId -Depth ($Depth + 1)
  }

  try {
    $proc = Get-Process -Id $ParentId -ErrorAction Stop
    $proc | Stop-Process -Force -ErrorAction Stop
    Write-Log "  -> killed child PID $ParentId" 'KILL'
  } catch {
    # already gone
  }
}

# --- Main ---
Write-Log "=== Cleanup v2.0 start (DryRun=$DryRun) ==="

$procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)
Write-Log "Found $($procs.Count) node processes"

# Classify all processes
$classified = @()
foreach ($p in $procs) {
  $info = Classify-Process -Cmd $p.CommandLine
  if ($info) {
    $classified += [PSCustomObject]@{
      ProcessId    = $p.ProcessId
      ParentPid    = $p.ParentProcessId
      CreationDate = [datetime]$p.CreationDate
      CommandLine  = $p.CommandLine
      Service      = $info.Service
      IsMain       = $info.IsMain
    }
  }
}

# --- Process-tree dedup within service groups ---
# If main process A is an ancestor of main process B (same service), B is NOT a
# duplicate - it's a child (e.g. pnpm filter -> next dev, pnpm filter -> tsx watch).
# Demote B to non-main so it won't be killed.
$pidMap = @{}
foreach ($p in $procs) { $pidMap[$p.ProcessId] = $p.ParentProcessId }

function Test-Ancestor {
  param([int]$AncestorId, [int]$DescendantId, [hashtable]$Map)
  $current = $DescendantId
  $depth = 0
  while ($current -ne 0 -and $depth -lt 20) {
    if ($current -eq $AncestorId) { return $true }
    if (-not $Map.ContainsKey($current)) { return $false }
    $current = $Map[$current]
    $depth++
  }
  return $false
}

$mainBySvc = $classified | Where-Object { $_.IsMain } | Group-Object -Property Service
foreach ($g in $mainBySvc) {
  $group = @($g.Group)
  foreach ($p in $group) {
    foreach ($other in $group) {
      if ($p.ProcessId -eq $other.ProcessId) { continue }
      if (Test-Ancestor -AncestorId $other.ProcessId -DescendantId $p.ProcessId -Map $pidMap) {
        $p.IsMain = $false
        Write-Log "  Demoted PID $($p.ProcessId) to child (ancestor PID $($other.ProcessId) exists in same service '$($g.Name)')"
        break
      }
    }
  }
}

# Group main processes by service (after dedup)
$mainProcs = $classified | Where-Object { $_.IsMain }
$svcGroups = $mainProcs | Group-Object -Property Service

$killed = 0
$kept   = 0
$now    = Get-Date

# --- Pass 1: kill duplicate main processes (keep newest per service) ---
foreach ($g in $svcGroups) {
  if ($g.Count -le 1) {
    $kept++
    continue
  }
  $sorted  = @($g.Group | Sort-Object CreationDate -Descending)
  $keep    = $sorted[0]
  $victims = @($sorted[1..($sorted.Count - 1)])

  $svc = $g.Name
  $keepAge = [math]::Round(($now - $keep.CreationDate).TotalMinutes, 0)
  Write-Log "Service '$svc': $($g.Count) main instances found, keeping newest (PID $($keep.ProcessId), ${keepAge}min old)"

  foreach ($v in $victims) {
    $ageMin = [math]::Round(($now - $v.CreationDate).TotalMinutes, 0)

    # Safety: skip processes younger than 2 minutes (still starting up)
    if ($ageMin -lt 2) {
      Write-Log "  -> SKIP PID $($v.ProcessId) (only ${ageMin}min old, may be starting)" 'SKIP'
      continue
    }

    $short = Get-ShortCmd $v.CommandLine
    if ($DryRun) {
      Write-Log "  -> [DRY-RUN] Would kill PID $($v.ProcessId) (age ${ageMin}min): $short"
    } else {
      Write-Log "  -> Killing PID $($v.ProcessId) (age ${ageMin}min) + children" 'KILL'
      Kill-ProcessTree -ParentId $v.ProcessId
      $killed++
    }
  }
  $kept++
}

# --- Pass 2: PM2 redundancy - kill PM2 when pnpm api dev is also running ---
$pm2Daemon = $classified | Where-Object { $_.Service -eq 'pm2' -and $_.IsMain }
$pm2Forks  = $classified | Where-Object { $_.Service -eq 'pm2' -and -not $_.IsMain }
$apiActive = $classified | Where-Object { $_.Service -eq 'api' -and $_.IsMain }

if ($pm2Daemon -and $apiActive) {
  Write-Log "PM2 daemon running alongside pnpm api dev - killing PM2 (redundant)"
  foreach ($p in @($pm2Daemon) + @($pm2Forks)) {
    if (-not $p) { continue }
    $ageMin = [math]::Round(($now - $p.CreationDate).TotalMinutes, 0)
    if ($DryRun) {
      Write-Log "  -> [DRY-RUN] Would kill PM2 PID $($p.ProcessId) (age ${ageMin}min)"
    } else {
      Write-Log "  -> Killing PM2 PID $($p.ProcessId) (age ${ageMin}min)" 'KILL'
      try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        $killed++
      } catch {
        Write-Log "  -> Failed: $_" 'ERROR'
      }
    }
  }
} elseif ($pm2Daemon -and -not $apiActive) {
  Write-Log "PM2 daemon running but no pnpm api dev detected - left alone (user may rely on PM2)"
}

# --- Summary ---
$memAfter = 0
try {
  $memAfter = [math]::Round((Get-Process node -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
} catch {}

$nodeCount = 0
try { $nodeCount = @(Get-Process node -ErrorAction SilentlyContinue).Count } catch {}

Write-Log "=== Cleanup done: killed=$killed kept=$kept nodeProcs=$nodeCount nodeMem=${memAfter}MB ==="
if (-not $Quiet -and -not $Status) {
  Write-Host ""
  Write-Host "Done. Killed $killed duplicate process(es)." -ForegroundColor Green
  Write-Host "Node processes now: $nodeCount, memory: ${memAfter}MB" -ForegroundColor Cyan
}
