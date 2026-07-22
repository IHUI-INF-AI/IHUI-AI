<#
.SYNOPSIS
  IHUI-AI 本地开发一键启动脚本
.DESCRIPTION
  启动顺序: Docker(db+redis) -> 等待就绪 -> 并行启动 API + Web
  按 Ctrl+C 退出时会自动清理子进程
#>
[CmdletBinding()]
param(
  [switch]$SkipDocker,
  [switch]$ApiOnly,
  [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($msg) { Write-Host "`n[*] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERR] $msg" -ForegroundColor Red }

$jobs = @()

function Stop-Jobs {
  foreach ($j in $jobs) {
    if ($j -and -not $j.HasExited) {
      Stop-Process -Id $j.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
trap { Write-Err $_; Stop-Jobs; exit 1 }

# --- 1. Docker (db + redis) ---
if (-not $SkipDocker) {
  Write-Step '启动 Docker 容器 (db + redis)...'
  docker compose up -d db redis 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Docker 启动失败,请确认 Docker Desktop 已运行'
    exit 1
  }
  Write-Ok 'Docker 容器已启动'

  Write-Step '等待 PostgreSQL 就绪...'
  $maxRetry = 30
  for ($i = 1; $i -le $maxRetry; $i++) {
    docker compose exec -T db pg_isready -U ihui 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Ok 'PostgreSQL 就绪'; break }
    if ($i -eq $maxRetry) { Write-Err 'PostgreSQL 启动超时'; exit 1 }
    Start-Sleep -Seconds 1
  }

  Write-Step '等待 Redis 就绪...'
  for ($i = 1; $i -le $maxRetry; $i++) {
    docker compose exec -T redis redis-cli ping 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Ok 'Redis 就绪'; break }
    if ($i -eq $maxRetry) { Write-Err 'Redis 启动超时'; exit 1 }
    Start-Sleep -Seconds 1
  }
}

# --- 2. 数据库迁移 ---
if (-not $WebOnly) {
  Write-Step '运行数据库迁移...'
  pushd apps/api
  npx drizzle-kit migrate 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '  (迁移跳过或已为最新)' -ForegroundColor Yellow
  } else {
    Write-Ok '数据库迁移完成'
  }
  popd
}

# --- 3. 并行启动 API + Web ---
if (-not $WebOnly) {
  Write-Step '启动 API 服务 (Fastify :8801)...'
  $apiProc = Start-Process -FilePath 'pnpm' -ArgumentList '--filter', '@ihui/api', 'dev' `
    -PassThru -NoNewWindow
  $jobs += $apiProc
  Write-Ok "API PID: $($apiProc.Id)"
}

if (-not $ApiOnly) {
  Write-Step '启动 Web 服务 (Next.js :3000)...'
  $webProc = Start-Process -FilePath 'pnpm' -ArgumentList '--filter', '@ihui/web', 'dev' `
    -PassThru -NoNewWindow
  $jobs += $webProc
  Write-Ok "Web PID: $($webProc.Id)"
}

Write-Step '开发环境已启动:'
Write-Host '  Web:  http://localhost:3000' -ForegroundColor White
Write-Host '  API:  http://localhost:8801' -ForegroundColor White
Write-Host '  Docs: http://localhost:8801/docs' -ForegroundColor White
Write-Host "`n按 Ctrl+C 停止所有服务" -ForegroundColor Yellow

# 等待退出
try {
  while ($true) {
    Start-Sleep -Seconds 1
    foreach ($j in $jobs) {
      if ($j.HasExited) {
        Write-Err "进程 $($j.ProcessName) (PID $($j.Id)) 已退出"
        Stop-Jobs
        exit 1
      }
    }
  }
} finally {
  Stop-Jobs
  Write-Host '`n[*] 所有服务已停止' -ForegroundColor Cyan
}
