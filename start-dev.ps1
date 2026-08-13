#requires -Version 7
# ============================================================================
# IHUI-AI 本地开发环境一键启动脚本(Windows / PowerShell)
# 由 WorkBuddy 生成 2026-08-04
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File D:\IHUI-AI\start-dev.ps1      # 启动全部
#   powershell -ExecutionPolicy Bypass -File D:\IHUI-AI\start-dev.ps1 -Stop # 停止全部
#   powershell -ExecutionPolicy Bypass -File D:\IHUI-AI\start-dev.ps1 -Status # 查看状态
#
# 服务清单:
#   PostgreSQL 18.2  : 127.0.0.1:8810  (数据目录 D:\DevEnv\data\pgdata)
#   Redis 8.10      : 127.0.0.1:8811  (数据目录 D:\DevEnv\data\redis)
#   web (Next.js)   : 0.0.0.0:8801
#   api (Fastify)   : 0.0.0.0:8802
#   ai-service      : 127.0.0.1:8803
# ============================================================================

param(
  [switch]$Stop,
  [switch]$Status,
  [switch]$All
)

$ErrorActionPreference = "Stop"
$DevEnv   = "D:\DevEnv"
$Project  = "D:\IHUI-AI"
$PgBin    = "$DevEnv\runtimes\pgsql\bin"
$RedisBin = "$DevEnv\runtimes\redis"
$PgData   = "$DevEnv\data\pgdata"
$Logs     = "$DevEnv\logs"
$Node     = "$DevEnv\runtimes\node"
$PnpmBin  = "$DevEnv\tools\npm-global"

if (-not (Test-Path $Logs)) { New-Item -ItemType Directory -Force -Path $Logs | Out-Null }

function Test-Port($port) {
  return [bool](netstat -ano | Select-String ":$port\s" | Select-String "LISTENING")
}

if ($Status) {
  Write-Host "`n=== 服务状态 ===" -ForegroundColor Cyan
  $checks = @(
    @{n="PostgreSQL"; p=8810}, @{n="Redis"; p=8811},
    @{n="web"; p=8801}, @{n="api"; p=8802}, @{n="ai-service"; p=8803}
  )
  foreach ($c in $checks) {
    $on = Test-Port $c.p
    Write-Host ("  {0,-14} {1}: {2}" -f $c.n, $c.p, ($(if($on){"RUNNING"}else{"stopped"})))
  }
  exit 0
}

if ($Stop) {
  Write-Host "`n=== 停止服务 ===" -ForegroundColor Yellow
  foreach ($p in 8803,8802,8801) {
    $line = netstat -ano | Select-String ":$p\s" | Select-String "LISTENING"
    foreach ($l in $line) {
      $pidv = ($l.ToString().Trim() -split '\s+')[-1]
      Stop-Process -Id ([int]$pidv) -Force -ErrorAction SilentlyContinue
      Write-Host "  端口 $p 进程 $pidv 已停止"
    }
  }
  # 停止 PostgreSQL
  & "$PgBin\pg_ctl.exe" -D $PgData stop -m fast 2>&1 | Out-Host
  # 停止 Redis
  $r = netstat -ano | Select-String ":8811\s" | Select-String "LISTENING"
  foreach ($l in $r) {
    $pidv = ($l.ToString().Trim() -split '\s+')[-1]
    Stop-Process -Id ([int]$pidv) -Force -ErrorAction SilentlyContinue
  }
  Write-Host "全部停止完成" -ForegroundColor Green
  exit 0
}

Write-Host "`n=== 1/5 PostgreSQL ===" -ForegroundColor Cyan
if (Test-Port 8810) { Write-Host "  8810 已在运行,跳过" }
else {
  & "$PgBin\pg_ctl.exe" -D $PgData -l "$Logs\postgres.log" start 2>&1 | Out-Host
  Start-Sleep -Seconds 2
  if (Test-Port 8810) { Write-Host "  PostgreSQL 启动成功 (8810)" -ForegroundColor Green }
  else { Write-Host "  PostgreSQL 启动失败,请检查 $Logs\postgres.log" -ForegroundColor Red }
}

Write-Host "`n=== 2/5 Redis ===" -ForegroundColor Cyan
if (Test-Port 8811) { Write-Host "  8811 已在运行,跳过" }
else {
  Start-Process -FilePath "$RedisBin\redis-server.exe" -ArgumentList "--port","8811","--bind","127.0.0.1","--dir","D:/DevEnv/data/redis","--logfile","D:/DevEnv/logs/redis-8811.log" -WindowStyle Hidden
  Start-Sleep -Seconds 2
  if (Test-Port 8811) { Write-Host "  Redis 启动成功 (8811)" -ForegroundColor Green }
  else { Write-Host "  Redis 启动失败" -ForegroundColor Red }
}

Write-Host "`n=== 3/5 ai-service (Python) ===" -ForegroundColor Cyan
if (Test-Port 8803) { Write-Host "  8803 已在运行,跳过" }
else {
  $py = "$Project\apps\ai-service\.venv\Scripts\python.exe"
  Start-Process -FilePath $py -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8803" -WorkingDirectory "$Project\apps\ai-service" -RedirectStandardOutput "$Logs\ai-service.log" -RedirectStandardError "$Logs\ai-service-err.log" -WindowStyle Hidden
  Write-Host "  ai-service 启动中 (日志: $Logs\ai-service.log)"
}

Write-Host "`n=== 4/5 api (Fastify) ===" -ForegroundColor Cyan
if (Test-Port 8802) { Write-Host "  8802 已在运行,跳过" }
else {
  $env:PATH = "$Node;$PnpmBin;$env:PATH"
  Start-Process -FilePath "$PnpmBin\pnpm.cmd" -ArgumentList "dev" -WorkingDirectory "$Project\apps\api" -RedirectStandardOutput "$Logs\api.log" -RedirectStandardError "$Logs\api-err.log" -WindowStyle Hidden
  Write-Host "  api 启动中 (日志: $Logs\api.log)"
}

Write-Host "`n=== 5/5 web (Next.js) ===" -ForegroundColor Cyan
if (Test-Port 8801) { Write-Host "  8801 已在运行,跳过" }
else {
  $env:PATH = "$Node;$PnpmBin;$env:PATH"
  Start-Process -FilePath "$PnpmBin\pnpm.cmd" -ArgumentList "dev" -WorkingDirectory "$Project\apps\web" -RedirectStandardOutput "$Logs\web.log" -RedirectStandardError "$Logs\web-err.log" -WindowStyle Hidden
  Write-Host "  web 启动中 (日志: $Logs\web.log)"
}

Write-Host "`n=== 启动完成,等待就绪(约 15s) ===" -ForegroundColor Green
Start-Sleep -Seconds 15
& powershell -ExecutionPolicy Bypass -File $PSCommandPath -Status
Write-Host "`n访问: http://localhost:8801  (web)   /  http://localhost:8802/docs  (api swagger)   /  http://localhost:8803/health  (ai-service)" -ForegroundColor Yellow
