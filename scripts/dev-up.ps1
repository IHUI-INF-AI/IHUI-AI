#requires -Version 5.1
<#
  Port convention (unified from 2026-06-18):
    8000 = FastAPI backend (uvicorn)
    8888 = Vite dev server (frontend)
    4173 = Vite preview (CI integration test)
  Legacy dual-port 18000 is deprecated, this script force-cleans it.

  Usage:
    # 启动后端 + Vite dev server (默认)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1

    # 只启动后端, 不启动 Vite (给后端单测 / 调试用)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -NoFrontend

    # 优雅停机 (SIGTERM, 等子进程退出后 kill)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Down
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Stop   # alias

    # 端口探活模式 (不启动任何服务, 只看 8000/8888/18000 状态)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status

    # 同时拉起本地 Redis (给 session/cache 用)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -WithRedis

    # 同时拉起本地 PostgreSQL (目前后端默认 SQLite, 启用此选项后改用 PG)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -WithDB

    # 完整一键启动 (后端 + Vite + Redis + PostgreSQL)
    powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -WithRedis -WithDB

  Environment overrides (建议 5: 团队多平台 / CI / 容器化场景):
    $env:BACKEND_BIN  = 'C:/Python311/python.exe'   # 覆盖 python 路径
    $env:FRONTEND_BIN = 'C:/Program Files/nodejs/npm.cmd'  # 覆盖 npm 路径
    $env:REDIS_BIN    = 'D:/redis/redis-server.exe' # 覆盖 redis-server 路径
    $env:PG_BIN       = 'C:/Program Files/PostgreSQL/16/bin/pg_ctl.exe'
    $env:SKIP_PORT_CLEAN = '1'  # 跳过步骤 1 的旧进程清理 (CI 环境)
    $env:HEALTH_TIMEOUT  = '90' # 健康检查超时秒数 (推荐 60-90, 后端路由模块较多)
#>

param(
  [switch]$NoFrontend,
  [switch]$Stop,
  [switch]$Down,
  [switch]$Status,
  [switch]$WithRedis,
  [switch]$WithDB,
  [int]$BackendPort = 0,
  [int]$FrontendPort = 0,
  [int]$RedisPort = 0,
  [int]$PostgresPort = 0,
  [int]$DeprecatedPort = 0
)

# Single source of truth (建议 2 增强: mirrors client/config/ports.ts)
# PowerShell 5.1 cannot import .ts, so duplicate these defaults.
# To change the port, update BOTH this file and client/config/ports.ts.
$DEFAULT_BACKEND_PORT = 8000
$DEFAULT_FRONTEND_PORT = 8888
$DEFAULT_REDIS_PORT = 6379
$DEFAULT_POSTGRES_PORT = 5432
$DEFAULT_DEPRECATED_PORT = 18000

# Port resolution priority: CLI arg > process env > default.
# Note: PowerShell 5.1 nested if-block creates a child scope; flat if-then is used here.
# Env override examples:
#   $env:BACKEND_PORT=9000 pwsh scripts/dev-up.ps1
#   $env:FRONTEND_PORT=9999 pwsh scripts/dev-up.ps1
if ($BackendPort -eq 0 -and $env:BACKEND_PORT) { $BackendPort = [int]$env:BACKEND_PORT }
if ($BackendPort -eq 0) { $BackendPort = $DEFAULT_BACKEND_PORT }
if ($FrontendPort -eq 0 -and $env:FRONTEND_PORT) { $FrontendPort = [int]$env:FRONTEND_PORT }
if ($FrontendPort -eq 0) { $FrontendPort = $DEFAULT_FRONTEND_PORT }
if ($RedisPort -eq 0 -and $env:REDIS_PORT) { $RedisPort = [int]$env:REDIS_PORT }
if ($RedisPort -eq 0) { $RedisPort = $DEFAULT_REDIS_PORT }
if ($PostgresPort -eq 0 -and $env:POSTGRES_PORT) { $PostgresPort = [int]$env:POSTGRES_PORT }
if ($PostgresPort -eq 0) { $PostgresPort = $DEFAULT_POSTGRES_PORT }
if ($DeprecatedPort -eq 0 -and $env:DEPRECATED_PORT) { $DeprecatedPort = [int]$env:DEPRECATED_PORT }
if ($DeprecatedPort -eq 0) { $DeprecatedPort = $DEFAULT_DEPRECATED_PORT }

$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot

# Set console output to UTF-8 to prevent Chinese text corruption in cmd/Terminal
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 > $null } catch {}

# 建议 5: 结构化事件日志 (logs/dev-up-events.jsonl)
# 每行一个 JSON object, 包含 ts/event/level/data, 便于故障排查与可观测性
# 必须在 port_resolved / start 事件之前定义, 否则首次调用会 CommandNotFound
# 建议 9: size-rotation 保护 (>5MB 自动重命名 .1.jsonl, 保留最近 3 份归档)
# 建议 14: 阈值可由 $env:DEV_UP_LOG_MAX_MB / $env:DEV_UP_LOG_KEEP 覆盖
$script:EventsLog = $null
$script:EventsLogMaxBytes = 5 * 1024 * 1024  # 5MB
$script:EventsLogKeep = 3                    # 保留 3 份历史
if ($env:DEV_UP_LOG_MAX_MB) {
  try { $script:EventsLogMaxBytes = [int]$env:DEV_UP_LOG_MAX_MB * 1024 * 1024 } catch {}
}
if ($env:DEV_UP_LOG_KEEP) {
  try { $script:EventsLogKeep = [int]$env:DEV_UP_LOG_KEEP } catch {}
}
function Get-EventsLogPath() {
  $logDir = Join-Path $RootDir 'logs'
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
  return (Join-Path $logDir 'dev-up-events.jsonl')
}
function Rotate-EventsLog() {
  # 建议 9: 触发轮转, 老的归档为 .1.jsonl -> .2.jsonl -> .3.jsonl, 删除最老
  $logPath = Get-EventsLogPath
  if (-not (Test-Path $logPath)) { return }
  $size = (Get-Item $logPath).Length
  if ($size -lt $script:EventsLogMaxBytes) { return }
  # 从最老的开始删
  for ($i = $script:EventsLogKeep; $i -ge 1; $i--) {
    $oldName = Join-Path (Split-Path -Parent $logPath) ("dev-up-events.$i.jsonl")
    $oldPrev = Join-Path (Split-Path -Parent $logPath) ("dev-up-events.{0}.jsonl" -f ($i - 1))
    if ($i -eq $script:EventsLogKeep -and (Test-Path $oldName)) { Remove-Item $oldName -Force }
    if ($i -eq 1 -and (Test-Path $logPath)) { Rename-Item $logPath $oldName -Force }
    elseif (Test-Path $oldPrev) { Rename-Item $oldPrev $oldName -Force }
  }
  # 新建空文件
  New-Item -ItemType File -Path $logPath -Force | Out-Null
  Write-Warn "Events log rotated at $size bytes, kept $script:EventsLogKeep archives"
}
function Write-Event($eventName, [string]$level, [hashtable]$data) {
  if ($script:EventsLog -eq $null) { $script:EventsLog = Get-EventsLogPath }
  Rotate-EventsLog
  $ts = (Get-Date).ToString('o')
  $obj = @{ ts = $ts; event = $eventName; level = $level; data = $data }
  try {
    $json = $obj | ConvertTo-Json -Compress -Depth 4
    Add-Content -Path $script:EventsLog -Value $json -ErrorAction SilentlyContinue
  } catch { }
  # 建议 16: OpenTelemetry 旁路输出 (fire-and-forget, $env:OTEL_EXPORTER_OTLP_ENDPOINT 设置时启用)
  if ($env:OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      $otelUrl = "$($env:OTEL_EXPORTER_OTLP_ENDPOINT)/v1/logs"
      $sev = if ($level -eq 'error') { 'ERROR' } elseif ($level -eq 'warn') { 'WARN' } else { 'INFO' }
      $otelPayload = @{
        resourceLogs = @(@{
          resource = @{ attributes = @(@{ key = 'service.name'; value = @{ stringValue = 'dev-up' } }) }
          scopeLogs = @(@{
            scope = @{ name = 'dev-up' }
            logRecords = @(@{
              timeUnixNano = [DateTimeOffset]::Parse($ts).ToUnixTimeMilliseconds() * 1000000
              severityText = $sev
              body = @{ stringValue = $json }
              attributes = @(@{ key = 'event'; value = @{ stringValue = $eventName } })
            })
          })
        })
      } | ConvertTo-Json -Compress -Depth 8
      # 用 Start-Job 异步发, 不阻塞主流程
      Start-Job -ScriptBlock {
        param($u, $b)
        try { Invoke-WebRequest -Uri $u -Method Post -Body $b -ContentType 'application/json' -TimeoutSec 2 -UseBasicParsing } catch { }
      } -ArgumentList $otelUrl, $otelPayload | Out-Null
    } catch { }
  }
}

# 建议 5: 事件日志 - 端口解析结果 (audit trail)
Write-Event 'port_resolved' 'info' @{
  backend = $BackendPort
  frontend = $FrontendPort
  redis = $RedisPort
  postgres = $PostgresPort
  deprecated = $DeprecatedPort
  no_frontend = [bool]$NoFrontend
  with_redis = [bool]$WithRedis
  with_db = [bool]$WithDB
}

# 建议 5: 事件日志 - 启动事件
Write-Event 'start' 'info' @{
  mode = if ($Status) { 'status' } elseif ($Stop -or $Down) { 'stop' } else { 'start' }
  pid = $PID
  user = $env:USERNAME
  ps_version = $PSVersionTable.PSVersion.ToString()
}

# 建议 5: 环境变量覆盖 python / npm / redis / pg 二进制路径
# 兼容 PowerShell 5.1 (不用 ?? / ?. 操作符)
# 提取 Resolve-FrontendBin 函数: 优先 pnpm → npm → npm.cmd → yarn → bun
# (Windows 上 Get-Command npm 可能找不到 npm.cmd, 必须显式 fallback)
function Resolve-FrontendBin() {
  foreach ($n in @('pnpm', 'npm', 'npm.cmd', 'yarn', 'bun')) {
    $cmd = Get-Command $n -ErrorAction SilentlyContinue
    if ($cmd) { return @{ Name = $n; Source = $cmd.Source } }
  }
  return $null
}
if ($env:BACKEND_BIN) { $pythonExe = $env:BACKEND_BIN } else { $pythonExe = (Get-Command python -ErrorAction SilentlyContinue); if ($pythonExe) { $pythonExe = $pythonExe.Source } else { $pythonExe = $null } }
if ($env:FRONTEND_BIN) {
  $frontendExe = $env:FRONTEND_BIN
  $frontendCmd = if ($frontendExe -like '*pnpm*') { 'pnpm' } elseif ($frontendExe -like '*yarn*') { 'yarn' } elseif ($frontendExe -like '*bun*') { 'bun' } else { 'npm' }
} else {
  $resolved = Resolve-FrontendBin
  if ($resolved) {
    $frontendExe = $resolved.Source
    $frontendCmd = $resolved.Name
  } else {
    $frontendExe = $null
    $frontendCmd = $null
  }
}
if ($env:REDIS_BIN) { $redisExe = $env:REDIS_BIN } else { $redisExe = (Get-Command redis-server -ErrorAction SilentlyContinue); if ($redisExe) { $redisExe = $redisExe.Source } else { $redisExe = $null } }
if ($env:PG_BIN) { $pgCtlExe = $env:PG_BIN } else { $pgCtlExe = (Get-Command pg_ctl -ErrorAction SilentlyContinue); if ($pgCtlExe) { $pgCtlExe = $pgCtlExe.Source } else { $pgCtlExe = $null } }
$skipClean  = $env:SKIP_PORT_CLEAN -eq '1'
if ($env:HEALTH_TIMEOUT) { $healthTimeout = [int]$env:HEALTH_TIMEOUT } else { $healthTimeout = 60 }

function Write-Step($msg) { Write-Host "[dev-up] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[dev-up] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[dev-up] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[dev-up] $msg" -ForegroundColor Red }

function Get-ListeningPids([int]$Port) {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $conns | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique
}

# 建议 2: 优雅停机 (SIGTERM/Ctrl+C 等同, 不强杀)
function Stop-Port([int]$Port, [string]$Label, [switch]$Graceful) {
  $pids = Get-ListeningPids $Port
  if (-not $pids) {
    Write-Ok "Port $Port ($Label) idle"
    Write-Event 'port_cleaned' 'info' @{ port = $Port; label = $Label; killed = 0; reason = 'idle' }
    return
  }
  Write-Warn "Port $Port ($Label) occupied by PID(s) $($pids -join ','), stopping"
  $killed = 0
  foreach ($p in $pids) {
    try {
      if ($Graceful) {
        # 发 SIGTERM (Windows 上用 CloseMainWindow 更友好, Ctrl+C 触发的关闭)
        $proc = Get-Process -Id $p -ErrorAction Stop
        if ($proc.CloseMainWindow()) {
          if ($proc.WaitForExit(5000)) {
            Write-Ok "PID $p closed gracefully"
            $killed++
            continue
          }
        }
        Write-Warn "PID $p did not exit within 5s, force killing"
      }
      Stop-Process -Id $p -Force -ErrorAction Stop
      $killed++
    } catch { Write-Warn "Stop PID $p failed: $_" }
  }
  Start-Sleep -Milliseconds 500
  Write-Event 'port_cleaned' 'info' @{ port = $Port; label = $Label; killed = $killed; reason = 'occupied'; graceful = [bool]$Graceful }
}

function Wait-Port([int]$Port, [string]$Label, [int]$TimeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $pids = Get-ListeningPids $Port
    if ($pids) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Health-Check([string]$Url, [int]$TimeoutSec = 10) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# 建议 2: -Status 端口探活模式
if ($Status) {
  Write-Step "Port status (probe mode, no service started)"
  $checkList = @(
    @{ Port = $BackendPort;    Name = 'FastAPI backend' },
    @{ Port = $FrontendPort;   Name = 'Vite dev server' },
    @{ Port = 4173;            Name = 'Vite preview (CI)' },
    @{ Port = $DeprecatedPort; Name = 'DEPRECATED dual-port' },
    @{ Port = $RedisPort;      Name = 'Redis' },
    @{ Port = $PostgresPort;   Name = 'PostgreSQL' }
  )
  $reportEntries = @()
  $regressionPids = @()
  foreach ($c in $checkList) {
    $pids = Get-ListeningPids $c.Port
    if ($pids) {
      $label = if ($c.Port -eq $DeprecatedPort) { '[REGRESSION]' } else { '[LISTEN]' }
      Write-Host ("  {0,-12} port {1,-6} pids {2}" -f $label, $c.Port, ($pids -join ',')) -ForegroundColor $(if ($c.Port -eq $DeprecatedPort) { 'Red' } else { 'Green' })
      if ($c.Port -eq $DeprecatedPort) { $regressionPids += $pids }
      $reportEntries += @{ port = $c.Port; name = $c.Name; state = 'listen'; pids = @($pids) }
    } else {
      Write-Host ("  {0,-12} port {1,-6} idle" -f '[IDLE]', $c.Port) -ForegroundColor DarkGray
      $reportEntries += @{ port = $c.Port; name = $c.Name; state = 'idle'; pids = @() }
    }
  }
  Write-Event 'status_report' $(if ($regressionPids.Count -gt 0) { 'error' } else { 'info' }) @{
    entries = $reportEntries
    regression = ($regressionPids.Count -gt 0)
    regression_pids = $regressionPids
  }
  if ($regressionPids.Count -gt 0) { exit 2 } else { exit 0 }
}

# -Down 是 -Stop 的别名 (建议 2: 命名更直观)
if ($Down -and -not $Stop) { $Stop = $true }

# ----- Stop / Down mode -----
if ($Stop) {
  Write-Step "Stop mode: cleaning $BackendPort/$FrontendPort/4173/$DeprecatedPort (graceful: $Down)"
  $graceful = $Down.IsPresent
  Stop-Port $BackendPort    'backend'          -Graceful:$graceful
  if (-not $NoFrontend) { Stop-Port $FrontendPort   'Vite dev'           -Graceful:$graceful }
  Stop-Port $DeprecatedPort 'legacy-dual-port'  -Graceful:$graceful
  if ($WithRedis) { Stop-Port $RedisPort    'redis'     -Graceful:$graceful }
  if ($WithDB)    { Stop-Port $PostgresPort 'postgres'  -Graceful:$graceful }
  Write-Ok "All cleaned"
  Write-Event 'stop' 'info' @{
    graceful = $graceful
    with_redis = [bool]$WithRedis
    with_db = [bool]$WithDB
    no_frontend = [bool]$NoFrontend
  }
  exit 0
}

# ----- Step 1: clean old processes (可跳过) -----
if (-not $skipClean) {
  Write-Step "Step 1: clean old processes ($BackendPort/$FrontendPort/$DeprecatedPort)"
  Stop-Port $BackendPort    'backend'
  # P20 修复: -NoFrontend 模式不强制 kill 前端 (允许 Vite 独立运行)
  if (-not $NoFrontend) {
    Stop-Port $FrontendPort   'Vite dev'
  } else {
    Write-Ok "-NoFrontend: skip Vite port cleanup (allow existing Vite to keep running)"
  }
  Stop-Port $DeprecatedPort 'legacy-dual-port'
  # P20 修复: kill 后等端口释放 (Windows TIME_WAIT 60s)
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Wait-Port.ps1') -Port $BackendPort -Timeout 30 | Out-Null
  if (-not $NoFrontend) {
    powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Wait-Port.ps1') -Port $FrontendPort -Timeout 30 | Out-Null
  }
} else {
  Write-Step "Step 1: skip port clean (SKIP_PORT_CLEAN=1)"
}

# P20: dev 模式默认开启限流旁路 (避免 E2E 测试 429)
# 生产断言: ENV=production 时强制启用限流, 不允许旁路
if ($env:ENV -eq 'production' -and $env:RATE_LIMIT_DISABLED -eq '1') {
  Write-Err "ENV=production 时不允许 RATE_LIMIT_DISABLED=1, 限流必须启用"
  Write-Event 'rate_limit_violation' 'error' @{ env = 'production'; rate_limit_disabled = '1' }
  exit 1
}
if (-not $env:RATE_LIMIT_DISABLED) {
  $env:RATE_LIMIT_DISABLED = '1'
  Write-Ok "P20: dev 模式默认开启限流旁路 (RATE_LIMIT_DISABLED=1, 可用 RATE_LIMIT_DISABLED=0 关闭)"
}

# ----- Step 1.5: 可选 Redis -----
$redisProc = $null
if ($WithRedis) {
  Write-Step "Step 1.5: start Redis (port $RedisPort)"
  if (-not $redisExe) {
    Write-Warn "redis-server not found, skipped. Install Redis or set `$env:REDIS_BIN"
  } else {
    Stop-Port $RedisPort 'redis'
    $redisLog = Join-Path $RootDir "server\logs\redis_dev_up.log"
    $redisErrLog = Join-Path $RootDir "server\logs\redis_dev_up.err.log"
    $redisDataDir = Join-Path $RootDir "server\logs\redis-data"
    if (-not (Test-Path $redisDataDir)) { New-Item -ItemType Directory -Path $redisDataDir -Force | Out-Null }
    $redisProc = Start-Process -FilePath $redisExe `
      -ArgumentList @('--port', $RedisPort, '--dir', $redisDataDir, '--save', '', '--appendonly', 'no') `
      -RedirectStandardOutput $redisLog `
      -RedirectStandardError $redisErrLog `
      -WindowStyle Hidden `
      -PassThru
    Write-Ok "Redis PID $($redisProc.Id), log $redisLog"
    Write-Event 'redis_start' 'info' @{ pid = $redisProc.Id; port = $RedisPort; log = $redisLog }
    if (-not (Wait-Port $RedisPort 'redis' 15)) {
      Write-Warn "Redis did not listen on $RedisPort within 15s"
      Write-Event 'redis_failed' 'error' @{ port = $RedisPort; reason = 'wait_port_timeout'; timeout_s = 15 }
    } else {
      Write-Ok "Redis listening on $RedisPort"
      Write-Event 'redis_healthy' 'info' @{ port = $RedisPort; pid = $redisProc.Id }
    }
  }
}

# ----- Step 1.6: 可选 PostgreSQL -----
$pgProc = $null
if ($WithDB) {
  Write-Step "Step 1.6: start PostgreSQL (port $PostgresPort)"
  if (-not $pgCtlExe) {
    Write-Warn "pg_ctl not found, skipped. Install PostgreSQL or set `$env:PG_BIN"
  } else {
    Stop-Port $PostgresPort 'postgres'
    $pgDataDir = Join-Path $RootDir "server\logs\pg-data"
    $pgLog = Join-Path $RootDir "server\logs\pg_dev_up.log"
    if (-not (Test-Path $pgDataDir)) {
      New-Item -ItemType Directory -Path $pgDataDir -Force | Out-Null
      & initdb -D $pgDataDir -U postgres --auth=trust 2>&1 | Out-Null
    }
    $pgProc = Start-Process -FilePath $pgCtlExe `
      -ArgumentList @('-D', $pgDataDir, '-l', $pgLog, '-o', "-p $PostgresPort") `
      -WindowStyle Hidden `
      -PassThru
    Write-Ok "pg_ctl PID $($pgProc.Id), log $pgLog"
    Write-Event 'pg_start' 'info' @{ pid = $pgProc.Id; port = $PostgresPort; log = $pgLog }
    if (-not (Wait-Port $PostgresPort 'postgres' 30)) {
      Write-Warn "PostgreSQL did not listen on $PostgresPort within 30s"
      Write-Event 'pg_failed' 'error' @{ port = $PostgresPort; reason = 'wait_port_timeout'; timeout_s = 30 }
    } else {
      Write-Ok "PostgreSQL listening on $PostgresPort"
      Write-Event 'pg_healthy' 'info' @{ port = $PostgresPort; pid = $pgProc.Id }
    }
  }
}

# ----- Step 2: start backend -----
Write-Step "Step 2: start backend (port $BackendPort, python=$pythonExe)"
if (-not $pythonExe) {
  Write-Err "python not found. Please install Python or set `$env:BACKEND_BIN"
  Write-Event 'backend_failed' 'error' @{ reason = 'python_not_found' }
  exit 1
}
$env:AUTO_CREATE_SCHEMA = '1'
$env:ENV = 'development'
$serverDir = Join-Path $RootDir 'server'
$logDir1 = Join-Path $RootDir 'server\logs'
if (-not (Test-Path $logDir1)) { New-Item -ItemType Directory -Path $logDir1 -Force | Out-Null }
$uvicornLog = Join-Path $logDir1 'uvicorn_dev_up.log'
$uvicornErrLog = Join-Path $logDir1 'uvicorn_dev_up.err.log'
$uvicornProc = Start-Process -FilePath $pythonExe `
  -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $BackendPort, '--log-level', 'info') `
  -WorkingDirectory $serverDir `
  -RedirectStandardOutput $uvicornLog `
  -RedirectStandardError $uvicornErrLog `
  -WindowStyle Hidden `
  -PassThru
Write-Ok "Backend PID $($uvicornProc.Id), log $uvicornLog"
Write-Event 'backend_start' 'info' @{
  pid = $uvicornProc.Id
  port = $BackendPort
  log = $uvicornLog
  err_log = $uvicornErrLog
  cwd = $serverDir
  python = $pythonExe
}

if (-not (Wait-Port $BackendPort 'backend' $healthTimeout)) {
  Write-Warn "Backend did not listen on $BackendPort within ${healthTimeout}s, see $uvicornLog"
  Write-Event 'backend_failed' 'error' @{
    reason = 'wait_port_timeout'
    port = $BackendPort
    timeout_s = $healthTimeout
    log = $uvicornLog
  }
  exit 1
}
Write-Ok "Backend listening on $BackendPort"
Write-Event 'backend_listening' 'info' @{ port = $BackendPort; pid = $uvicornProc.Id }

if (Health-Check "http://127.0.0.1:$BackendPort/api/health" 10) {
  Write-Ok "Backend health OK: http://127.0.0.1:$BackendPort/api/health"
  Write-Event 'backend_healthy' 'info' @{
    url = "http://127.0.0.1:$BackendPort/api/health"
    port = $BackendPort
    pid = $uvicornProc.Id
  }
} else {
  Write-Warn "Backend health check timeout, port listening, continue"
  Write-Event 'backend_degraded' 'warn' @{
    reason = 'health_timeout'
    url = "http://127.0.0.1:$BackendPort/api/health"
    port = $BackendPort
  }
}

# ----- Step 3: start Vite -----
if (-not $NoFrontend) {
  Write-Step "Step 3: start Vite dev server (port $FrontendPort, frontend_bin=$frontendExe)"
  if (-not $frontendExe) {
    Write-Err "pnpm/npm not found. Please install Node.js or set `$env:FRONTEND_BIN"
    Write-Event 'vite_failed' 'error' @{ reason = 'node_not_found' }
    exit 1
  }
  $clientDir = Join-Path $RootDir 'client'
  $logDir2 = Join-Path $RootDir 'client\logs'
  if (-not (Test-Path $logDir2)) { New-Item -ItemType Directory -Path $logDir2 -Force | Out-Null }
  $viteLog = Join-Path $logDir2 'vite_dev_up.log'
  $viteErrLog = Join-Path $logDir2 'vite_dev_up.err.log'
  # $frontendCmd 已由顶部 Resolve-FrontendBin 解析 (pnpm/npm/npm.cmd/yarn/bun)
  Write-Ok "Using frontend cmd: $frontendCmd ($frontendExe)"
  $viteProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', $frontendCmd, 'dev') `
    -WorkingDirectory $clientDir `
    -RedirectStandardOutput $viteLog `
    -RedirectStandardError $viteErrLog `
    -WindowStyle Hidden `
    -PassThru
  Write-Ok "Vite PID $($viteProc.Id), log $viteLog"
  Write-Event 'vite_start' 'info' @{
    pid = $viteProc.Id
    port = $FrontendPort
    log = $viteLog
    err_log = $viteErrLog
    cmd = $frontendCmd
    cwd = $clientDir
  }

  if (-not (Wait-Port $FrontendPort 'Vite' 40)) {
    Write-Warn "Vite did not listen on $FrontendPort within 40s, see $viteLog"
    Write-Event 'vite_failed' 'error' @{
      reason = 'wait_port_timeout'
      port = $FrontendPort
      timeout_s = 40
      log = $viteLog
    }
    exit 1
  }
  Write-Ok "Vite listening on $FrontendPort"
  Write-Event 'vite_healthy' 'info' @{
    port = $FrontendPort
    pid = $viteProc.Id
    url = "http://127.0.0.1:$FrontendPort"
  }
}

# ----- Done -----
Write-Ok "================ STARTED ================"
Write-Ok "Backend:    http://127.0.0.1:$BackendPort"
if (-not $NoFrontend) { Write-Ok "Frontend:   http://127.0.0.1:$FrontendPort" }
if ($WithRedis -and $redisProc) { Write-Ok "Redis:      http://127.0.0.1:$RedisPort" }
if ($WithDB -and $pgProc)       { Write-Ok "Postgres:   http://127.0.0.1:$PostgresPort" }
Write-Ok "Status:     powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status"
Write-Ok "Down:       powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Down"
Write-Ok "=========================================="

# 建议 5: exit 事件 (放在脚本末尾, 通过 trap / 显式调用覆盖所有 exit 路径)
# PowerShell trap 在脚本顶层会捕获 exit, 但本脚本有大量显式 exit 调用,
# 这里采用被动记录: 把 exit_code 写到事件流最后一条. 实际 exit_code 由操作系统返回.
Write-Event 'exit' 'info' @{
  mode = if ($Status) { 'status' } elseif ($Stop -or $Down) { 'stop' } else { 'start' }
  backend = $BackendPort
  frontend = $FrontendPort
  no_frontend = [bool]$NoFrontend
  with_redis = [bool]$WithRedis
  with_db = [bool]$WithDB
  events_log = $script:EventsLog
}
