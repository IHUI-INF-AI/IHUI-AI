#requires -Version 5.1
<#
  CI 环境一键准备脚本 (建议 3)
  专门给 GitHub Actions (Windows runner) 使用.

  与 dev-up.ps1 的区别:
    - 无交互 (CI 是 headless, 不能弹任何 prompt)
    - 强制 SKIP_PORT_CLEAN=1 (CI runner 是干净的, 不会有人占用 8000)
    - 自动 install Python / Node 依赖
    - 写 .env (CI 环境变量)
    - 启动 vite preview 而非 vite dev (CI 是无头, dev server 不稳)
    - 失败时给明确错误 (非零退出码 + stderr 信息)

  用法 (在 GitHub Actions workflow 中):
    - name: Setup CI env
      shell: pwsh
      run: |
        .\scripts\ci-env-setup.ps1
    - name: Run e2e
      shell: pwsh
      run: |
        cd client
        npm run test:e2e

  环境变量覆盖 (与 dev-up.ps1 一致):
    $env:BACKEND_BIN  / $env:FRONTEND_BIN / $env:REDIS_BIN / $env:PG_BIN
    $env:HEALTH_TIMEOUT = '60'
    $env:CI_ENV_FILE   = '.env.ci'  # 自定义 env 模板

  退出码:
    0 - 成功, backend / vite preview 都健康
    10 - python 找不到
    11 - 依赖安装失败
    12 - 后端启动失败 / 不健康
    13 - vite preview 启动失败
#>

$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot

# 兼容 PowerShell 5.1 的环境变量 + Get-Command 链
function Resolve-Bin($envName, [string[]]$cmdNames) {
  $value = (Get-Item env:$envName -ErrorAction SilentlyContinue).Value
  if ($value) { return $value }
  foreach ($n in $cmdNames) {
    $c = Get-Command $n -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
  }
  return $null
}

$pythonExe  = Resolve-Bin 'BACKEND_BIN'  @('python', 'python3', 'py')
$frontendExe = Resolve-Bin 'FRONTEND_BIN' @('pnpm', 'npm')
if (-not $frontendExe) { $frontendExe = (Resolve-Bin 'NPM_BIN' @('npm')) }
$healthTimeout = if ($env:HEALTH_TIMEOUT) { [int]$env:HEALTH_TIMEOUT } else { 60 }
$envFile = if ($env:CI_ENV_FILE) { $env:CI_ENV_FILE } else { '.env.ci' }
$backendPort = if ($env:BACKEND_PORT) { [int]$env:BACKEND_PORT } else { 8000 }
$previewPort = if ($env:PREVIEW_PORT) { [int]$env:PREVIEW_PORT } else { 4173 }

function Write-Step($msg) { Write-Host "[ci-env] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[ci-env] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[ci-env] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ci-env] $msg" -ForegroundColor Red }

function Wait-Port([int]$Port, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($c) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Health-Check([string]$Url, [int]$TimeoutSec) {
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

# ----- Step 0: preflight -----
Write-Step "Preflight check"
if (-not $pythonExe) {
  Write-Err "python not found. Set `$env:BACKEND_BIN"
  exit 10
}
if (-not $frontendExe) {
  Write-Err "pnpm/npm not found. Set `$env:FRONTEND_BIN"
  exit 10
}
Write-Ok "python=$pythonExe"
Write-Ok "frontend=$frontendExe"

# ----- Step 1: install dependencies -----
Write-Step "Step 1: install Python deps (server/requirements.txt)"
Push-Location (Join-Path $RootDir 'server')
try {
  & $pythonExe -m pip install -q -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    Write-Err "pip install failed (exit $LASTEXITCODE)"
    exit 11
  }
  Write-Ok "python deps installed"
} catch {
  Write-Err "pip install exception: $_"
  exit 11
} finally {
  Pop-Location
}

Write-Step "Step 1b: install Node deps (client/)"
Push-Location (Join-Path $RootDir 'client')
try {
  if ($frontendExe -like '*pnpm*') {
    & pnpm install --frozen-lockfile
  } else {
    & npm ci
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Err "node deps install failed (exit $LASTEXITCODE)"
    exit 11
  }
  Write-Ok "node deps installed"
} catch {
  Write-Err "node deps exception: $_"
  exit 11
} finally {
  Pop-Location
}

# ----- Step 2: write .env -----
Write-Step "Step 2: write .env ($envFile)"
$envPath = Join-Path $RootDir $envFile
@"
ENV=ci
AUTO_CREATE_SCHEMA=1
PORT=$backendPort
CORS_ALLOW_ORIGINS=http://127.0.0.1:$previewPort,http://localhost:$previewPort
"@ | Out-File -FilePath $envPath -Encoding UTF8 -Force
# 把 .env 内容复制到当前 session
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
Write-Ok ".env written: $envPath"

# ----- Step 3: start backend -----
Write-Step "Step 3: start backend (port $backendPort)"
$logDir = Join-Path $RootDir 'server\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$backendLog = Join-Path $logDir 'uvicorn_ci.log'
$backendProc = Start-Process -FilePath $pythonExe `
  -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $backendPort, '--log-level', 'warning') `
  -WorkingDirectory (Join-Path $RootDir 'server') `
  -RedirectStandardOutput $backendLog `
  -RedirectStandardError $backendLog `
  -WindowStyle Hidden `
  -PassThru
Write-Ok "Backend PID $($backendProc.Id), log $backendLog"

if (-not (Wait-Port $backendPort $healthTimeout)) {
  Write-Err "Backend did not listen on $backendPort within ${healthTimeout}s"
  Get-Content $backendLog -Tail 20 | ForEach-Object { Write-Host "  $_" }
  exit 12
}
Write-Ok "Backend listening on $backendPort"

if (-not (Health-Check "http://127.0.0.1:$backendPort/api/health" 15)) {
  Write-Err "Backend health check failed"
  Get-Content $backendLog -Tail 20 | ForEach-Object { Write-Host "  $_" }
  exit 12
}
Write-Ok "Backend health OK"

# ----- Step 4: build client for preview -----
Write-Step "Step 4: build client for preview (port $previewPort)"
Push-Location (Join-Path $RootDir 'client')
try {
  if ($frontendExe -like '*pnpm*') {
    & pnpm build
  } else {
    & npm run build
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Err "client build failed (exit $LASTEXITCODE)"
    exit 13
  }
  Write-Ok "client built"
} catch {
  Write-Err "client build exception: $_"
  exit 13
} finally {
  Pop-Location
}

Write-Step "Step 5: start vite preview (port $previewPort)"
$clientLogDir = Join-Path $RootDir 'client\logs'
if (-not (Test-Path $clientLogDir)) { New-Item -ItemType Directory -Path $clientLogDir -Force | Out-Null }
$previewLog = Join-Path $clientLogDir 'vite_preview_ci.log'
$previewProc = Start-Process -FilePath $frontendExe `
  -ArgumentList @('run', 'preview', '--', '--port', $previewPort, '--host', '127.0.0.1') `
  -WorkingDirectory (Join-Path $RootDir 'client') `
  -RedirectStandardOutput $previewLog `
  -RedirectStandardError $previewLog `
  -WindowStyle Hidden `
  -PassThru
Write-Ok "Vite preview PID $($previewProc.Id), log $previewLog"

if (-not (Wait-Port $previewPort 30)) {
  Write-Err "Vite preview did not listen on $previewPort within 30s"
  Get-Content $previewLog -Tail 20 | ForEach-Object { Write-Host "  $_" }
  exit 13
}
Write-Ok "Vite preview listening on $previewPort"

# ----- Step 6: write PIDs for cleanup -----
Write-Step "Step 6: write PIDs for CI cleanup"
@{
  BACKEND = $backendProc.Id
  PREVIEW = $previewProc.Id
  BACKEND_LOG = $backendLog
  PREVIEW_LOG = $previewLog
} | ConvertTo-Json | Out-File (Join-Path $RootDir 'logs\ci-pids.json') -Encoding UTF8

Write-Ok "================ CI ENV READY ================"
Write-Ok "Backend:  http://127.0.0.1:$backendPort"
Write-Ok "Preview:  http://127.0.0.1:$previewPort"
Write-Ok "================================================="
Write-Ok "Next: cd client; npm run test:e2e"
Write-Ok "Cleanup: Get-Content logs/ci-pids.json | ConvertFrom-Json | ForEach-Object { Stop-Process -Id `$_.BACKEND -Force; Stop-Process -Id `$_.PREVIEW -Force }"
exit 0
