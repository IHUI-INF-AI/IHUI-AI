<#
.SYNOPSIS
  IHUI-AI 全链路一键启动脚本 (web + api + ai-service + 数据库/Redis 健康检查)
.DESCRIPTION
  解决 agent 在 Trae IDE 内 RunCommand 工具失联时无法启动服务的问题 (参见 project_memory.md "本会话终端工具隔离硬约束").
  本脚本由用户在真实 PowerShell 中执行, 派生独立窗口运行每个服务, 互不干扰.

  用法:
    powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1            # 启动全部
    powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1 -CheckOnly # 仅健康检查
    powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1 -Stop      # 停止所有 dev 服务

  依赖: pnpm, Node.js >=20.10, PostgreSQL (127.0.0.1:5432), Redis (127.0.0.1:6379)
.AUTHOR
  IHUI-AI
.DATE
  2026-07-19
#>

[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$Stop,
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$WebPort = 3000
$ApiPort = 3001
$AiServicePort = 8000
$PgHost = '127.0.0.1'
$PgPort = 5432
$RedisHost = '127.0.0.1'
$RedisPort = 6379

function Write-Section([string]$title) {
  Write-Host ''
  Write-Host ('=' * 70) -ForegroundColor DarkGray
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host ('=' * 70) -ForegroundColor DarkGray
}

function Write-Ok([string]$msg) { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg) { Write-Host "  [ERR]  $msg" -ForegroundColor Red }

function Test-PortOpen([string]$ComputerName, [int]$Port, [int]$TimeoutMs = 800) {
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect($ComputerName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if ($ok) { $tcp.EndConnect($iar); $tcp.Close(); return $true }
    $tcp.Close()
    return $false
  } catch {
    return $false
  }
}

function Test-Http([string]$Url, [int]$TimeoutSec = 3) {
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-DevProcesses {
  # 匹配 next dev / tsx watch / pnpm dev / uvicorn 等开发进程
  $patterns = @('next dev', 'tsx watch', 'pnpm.*dev', 'uvicorn.*8000', 'fastapi.*8000')
  $procs = @()
  foreach ($p in $patterns) {
    $procs += Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='python.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -match $p } |
      Select-Object ProcessId, Name, CommandLine
  }
  return $procs | Sort-Object ProcessId -Unique
}

function Stop-DevProcesses {
  Write-Section '停止所有 dev 服务进程'
  $procs = Get-DevProcesses
  if ($procs.Count -eq 0) {
    Write-Warn '未发现运行中的 dev 服务进程'
    return
  }
  foreach ($p in $procs) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Ok "已停止 PID=$($p.ProcessId) ($($p.Name))"
    } catch {
      Write-Err "停止失败 PID=$($p.ProcessId): $($_.Exception.Message)"
    }
  }
}

function Invoke-HealthCheck {
  Write-Section '环境健康检查'

  Write-Host "`n  [依赖服务]" -ForegroundColor DarkGray
  if (Test-PortOpen $PgHost $PgPort) {
    Write-Ok "PostgreSQL $PgHost`:$PgPort 监听中"
  } else {
    Write-Err "PostgreSQL $PgHost`:$PgPort 未监听 — api 启动会失败"
    Write-Host "       请先启动 PostgreSQL (docker compose up -d postgres 或本机服务)" -ForegroundColor DarkGray
  }
  if (Test-PortOpen $RedisHost $RedisPort) {
    Write-Ok "Redis      $RedisHost`:$RedisPort 监听中"
  } else {
    Write-Err "Redis      $RedisHost`:$RedisPort 未监听 — api 启动会失败或降级"
    Write-Host "       请先启动 Redis (docker compose up -d redis 或本机服务)" -ForegroundColor DarkGray
  }

  Write-Host "`n  [应用服务]" -ForegroundColor DarkGray
  if (Test-Http "http://localhost:$WebPort" 3) {
    Write-Ok "web        http://localhost:$WebPort 响应"
  } else {
    Write-Warn "web        http://localhost:$WebPort 未响应"
  }
  if (Test-PortOpen '127.0.0.1' $ApiPort) {
    Write-Ok "api        http://localhost:$ApiPort 端口监听"
  } else {
    Write-Warn "api        http://localhost:$ApiPort 未监听"
  }
  if (Test-PortOpen '127.0.0.1' $AiServicePort) {
    Write-Ok "ai-service http://localhost:$AiServicePort 端口监听"
  } else {
    Write-Warn "ai-service http://localhost:$AiServicePort 未监听 (可选, 项目当前可能未启用)"
  }
}

function Start-ServiceInNewWindow {
  param(
    [string]$Name,
    [string]$WorkDir,
    [string]$Command,
    [int]$WaitSec = 0
  )
  Write-Host "`n  启动 $Name (独立窗口)..." -ForegroundColor DarkGray
  Write-Host "    WorkDir: $WorkDir" -ForegroundColor DarkGray
  Write-Host "    Command: $Command" -ForegroundColor DarkGray

  if (-not (Test-Path $WorkDir)) {
    Write-Warn "$Name 工作目录不存在, 跳过: $WorkDir"
    return $false
  }

  # 用 here-string 构造内联命令, 避免多层引号嵌套出错
  $innerScript = @"
Set-Location -LiteralPath '$WorkDir'
Write-Host '[$Name] starting in $WorkDir' -ForegroundColor Cyan
Write-Host 'Command: $Command' -ForegroundColor DarkGray
Write-Host ''
$Command
"@
  $encoded = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($innerScript))
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-EncodedCommand', $encoded) -WindowStyle Normal | Out-Null

  if ($WaitSec -gt 0) {
    Write-Host "    等待 $WaitSec 秒让 $Name 初始化..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $WaitSec
  }
  return $true
}

function Start-AllServices {
  Write-Section '启动 IHUI-AI 全链路 dev 服务'

  # 1. 健康检查
  Invoke-HealthCheck

  # 2. 启动 api (后端先起, web 依赖 api)
  Start-ServiceInNewWindow -Name 'api' `
    -WorkDir (Join-Path $Root 'apps\api') `
    -Command 'pnpm dev' `
    -WaitSec 8

  # 3. 启动 web
  Start-ServiceInNewWindow -Name 'web' `
    -WorkDir (Join-Path $Root 'apps\web') `
    -Command 'pnpm dev' `
    -WaitSec 10

  # 4. 启动 ai-service (如果存在)
  $aiServiceDir = Join-Path $Root 'apps\ai-service'
  if (Test-Path $aiServiceDir) {
    Start-ServiceInNewWindow -Name 'ai-service' `
      -WorkDir $aiServiceDir `
      -Command 'pnpm dev' `
      -WaitSec 5
  } else {
    Write-Host "`n  [INFO] apps\ai-service 不存在, 跳过 (user_profile 提到但项目当前未启用)" -ForegroundColor DarkGray
  }

  # 5. 最终健康检查
  Write-Section '启动后健康检查'
  Start-Sleep -Seconds 5
  Invoke-HealthCheck

  Write-Section '完成'
  Write-Host "  浏览器访问: http://localhost:$WebPort" -ForegroundColor Cyan
  Write-Host "  停止所有服务: powershell -File scripts\dev-all.ps1 -Stop" -ForegroundColor DarkGray
  Write-Host ''
}

# ===== Main =====

if ($Stop) {
  Stop-DevProcesses
  exit 0
}

if ($CheckOnly) {
  Invoke-HealthCheck
  exit 0
}

Start-AllServices
