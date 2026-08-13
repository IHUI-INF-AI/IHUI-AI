#requires -Version 7
<#
.SYNOPSIS
  IHUI-AI 8 端 dev 服务启动器(根治 SIGINT 免疫)
.DESCRIPTION
  解决 Trae IDE / 终端关闭窗口时,前台运行的 pnpm dev 被外部 SIGINT
  (即 "Terminate batch job (Y/N)?") 反复中断的问题。

  核心机制:服务进程用 Start-Process 派生到隐藏 cmd.exe 窗口,日志重定向
  到 .trae-cn/tmp/dev-logs/<name>.log,PID 写入 .trae-cn/tmp/dev-logs/pids.json。
  关闭本脚本窗口不会级联关闭 dev server。

  用法:
    pwsh -File scripts/start-dev.ps1                       # 启动默认组 web+api
    pwsh -File scripts/start-dev.ps1 -Services web,api,ai-service
    pwsh -File scripts/start-dev.ps1 -All                  # 启动 8 端
    pwsh -File scripts/start-dev.ps1 -Foreground           # 前台模式(不推荐,会被 SIGINT)
    pwsh -File scripts/start-dev.ps1 -Status               # 查看运行状态
    pwsh -File scripts/start-dev.ps1 -Stop                 # 停止所有 start-dev 启动的服务
    pwsh -File scripts/start-dev.ps1 -Clean                # 清理所有 IHUI 端口 + 残留 dev 进程
    pwsh -File scripts/start-dev.ps1 -Force                # 端口冲突时强制 kill 占用进程

  端口 + 命令注册表:scripts/dev-port-registry.json
  端口权威来源:docs/port-management.md(必须保持同步)
.NOTES
  仅支持 Windows PowerShell 5.1+(PowerShell Core 7+ 也兼容)
#>

[CmdletBinding()]
param(
  [string[]]$Services,
  [switch]$All,
  [switch]$Default,
  [switch]$Foreground,
  [switch]$Status,
  [switch]$Stop,
  [switch]$Clean,
  [switch]$Force,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

# ============================================================
# 路径常量
# ============================================================
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..')).Path
$RegistryPath = Join-Path $ScriptRoot 'dev-port-registry.json'
$LogDir = Join-Path $RepoRoot '.trae-cn\tmp\dev-logs'
$PidFile = Join-Path $LogDir 'pids.json'

# ============================================================
# 函数:Write-* 颜色输出
# ============================================================
function Write-Info([string]$msg) { Write-Host "  [INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]    $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "  [ERR]   $msg" -ForegroundColor Red }
function Write-Hdr([string]$msg)  {
  Write-Host ''
  Write-Host ('=' * 70) -ForegroundColor DarkGray
  Write-Host "  $msg" -ForegroundColor White
  Write-Host ('=' * 70) -ForegroundColor DarkGray
}

# ============================================================
# 函数:加载注册表
# ============================================================
function Get-ServiceRegistry {
  if (-not (Test-Path $RegistryPath)) {
    throw "注册表不存在: $RegistryPath"
  }
  $raw = Get-Content -Raw -Path $RegistryPath -Encoding UTF8
  try {
    $json = $raw | ConvertFrom-Json
  } catch {
    throw "注册表 JSON 解析失败: $($_.Exception.Message)"
  }
  return $json
}

# ============================================================
# 函数:读取 / 写入 PID 文件
# ============================================================
function Get-PidMap {
  if (-not (Test-Path $PidFile)) { return @{} }
  try {
    $content = Get-Content -Raw -Path $PidFile -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($content)) { return @{} }
    $obj = $content | ConvertFrom-Json
    $map = @{}
    foreach ($prop in $obj.PSObject.Properties) {
      $map[$prop.Name] = $prop.Value
    }
    return $map
  } catch {
    Write-Warn "PID 文件解析失败,忽略: $PidFile"
    return @{}
  }
}

function Save-PidMap([hashtable]$map) {
  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $map | ConvertTo-Json -Depth 5 | Set-Content -Path $PidFile -Encoding UTF8
}

function Remove-PidEntry([string]$name) {
  $map = Get-PidMap
  if ($map.ContainsKey($name)) {
    $map.Remove($name)
    Save-PidMap $map
  }
}

# ============================================================
# 函数:检测端口是否被占用
# ============================================================
function Test-PortInUse([int]$port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  return ($null -ne $conn -and $conn.Count -gt 0)
}

function Get-PortOwner([int]$port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($null -eq $conn) { return $null }
  $procId = ($conn | Select-Object -First 1).OwningProcess
  if ($procId -le 0) { return $null }
  return $procId
}

# ============================================================
# 函数:检测进程是否还活着
# ============================================================
function Test-PidAlive([int]$procId) {
  if ($procId -le 0) { return $false }
  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  return ($null -ne $p -and -not $p.HasExited)
}

# ============================================================
# 函数:通过 HTTP 探活
# 2026-08-07 修复:默认超时 3s → 10s。api/ai-service 冷启动首次响应
# (tsx 编译 + DB 连接 + provider 探活)常超 2s,探针超时短会误判 FAIL
# ("模型连接失败/任务列表加载失败"排查链中的自检误报根因)。
# ============================================================
function Test-HealthUrl([string]$url, [int]$timeoutSec = 10) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec -ErrorAction Stop
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
  } catch {
    return $false
  }
}

# ============================================================
# 函数:健康检查(带超时轮询)
# ============================================================
function Wait-Healthy([string]$name, [int]$port, [string]$healthUrl, [int]$timeoutSec) {
  if ($timeoutSec -le 0) { return $true }
  Write-Info "$name 等待健康检查(最多 ${timeoutSec}s)..."

  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    # 端口先开
    if (Test-PortInUse $port) {
      # HTTP 健康检查(可选)
      if ([string]::IsNullOrEmpty($healthUrl)) {
        return $true
      }
      if (Test-HealthUrl $healthUrl 10) {
        return $true
      }
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

# ============================================================
# 函数:杀进程树
# ============================================================
function Stop-ProcessTree([int]$procId, [string]$label) {
  if (-not (Test-PidAlive $procId)) { return $true }
  $output = & taskkill /F /T /PID $procId 2>&1
  Write-Info "taskkill $label PID=$procId : $output"
  Start-Sleep -Milliseconds 500
  return (-not (Test-PidAlive $procId))
}

# ============================================================
# 函数:停止单个服务
# ============================================================
function Stop-ServiceProcess([string]$name) {
  $map = Get-PidMap
  if (-not $map.ContainsKey($name)) {
    Write-Warn "$name 未在 PID 注册表中"
    return
  }
  $entry = $map[$name]
  $procId = [int]$entry.pid
  Write-Info "停止 $name (PID=$procId, port=$($entry.port))"
  if (Stop-ProcessTree $procId $name) {
    Write-Ok "$name 已停止"
  } else {
    Write-Warn "$name 进程仍存活,请手动检查"
  }
  Remove-PidEntry $name
}

# ============================================================
# 函数:启动单个服务(后台 / 前台)
# ============================================================
function Start-ServiceProcess {
  param(
    [string]$Name,
    [string]$Cmd,
    [string[]]$ScriptArgs,
    [string]$Cwd,
    [int]$Port,
    [string]$HealthUrl,
    [int]$TimeoutSec,
    [bool]$IsForeground
  )

  Write-Hdr "启动 $Name"

  # 1. 端口冲突检测
  if (Test-PortInUse $port) {
    $owner = Get-PortOwner $port
    if ($Force) {
      Write-Warn "端口 $port 被 PID=$owner 占用,-Force 模式直接 kill"
      if ($owner -gt 0) { Stop-ProcessTree $owner "$Name 旧进程" | Out-Null }
      Start-Sleep -Seconds 1
    } else {
      Write-Err "端口 $port 已被占用(PID=$owner)。"
      Write-Host "       选项:" -ForegroundColor DarkGray
      Write-Host "       1) 重新运行带 -Force 自动 kill 占用进程" -ForegroundColor DarkGray
      Write-Host "       2) 手动跑:pwsh -File scripts/start-dev.ps1 -Clean" -ForegroundColor DarkGray
      Write-Host "       3) 跳过该服务:$Name" -ForegroundColor DarkGray
      return $false
    }
  }

  # 2. 拼 cmd 行(pnpm 在 Windows 是 .cmd shim,Start-Process 调 pnpm.exe
  #    会报 "%1 is not a valid Win32 application"。用 cmd.exe /c 包装最稳。)
  $argList = $ScriptArgs | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
  }
  $cmdLine = "$Cmd " + ($argList -join ' ')

  # 3. 准备日志
  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $logPath = Join-Path $LogDir "$Name.log"
  $errPath = Join-Path $LogDir "$Name.log.err"

  if ($IsForeground) {
    # 前台模式:在当前终端跑,会被外部 SIGINT 影响(不推荐)
    Write-Warn "前台模式:本窗口关闭/外部 SIGINT 会中断 $Name"
    Write-Info "$Name → $cmdLine (cwd: $Cwd)"
    Write-Host ''
    Push-Location $Cwd
    try {
      & cmd.exe /c $cmdLine
    } finally {
      Pop-Location
    }
    return $true
  }

  # 4. 后台模式(默认,SIGINT 免疫)
  Write-Info "后台启动 $Name → $logPath"
  Write-Info "  cmd: cmd.exe /c $cmdLine"
  Write-Info "  cwd: $Cwd"

  try {
    $proc = Start-Process -FilePath 'cmd.exe' `
      -ArgumentList @('/c', $cmdLine) `
      -WorkingDirectory $Cwd `
      -WindowStyle Hidden `
      -RedirectStandardOutput $logPath `
      -RedirectStandardError $errPath `
      -PassThru `
      -ErrorAction Stop
  } catch {
    Write-Err "启动 $Name 失败:$($_.Exception.Message)"
    return $false
  }

  $procId = $proc.Id
  Write-Ok "$Name 启动成功 PID=$procId"

  # 5. 写 PID 注册表
  $map = Get-PidMap
  $map[$Name] = @{
    pid        = $procId
    port       = $Port
    health     = $HealthUrl
    log        = $logPath
    err        = $errPath
    started_at = (Get-Date).ToString('o')
  }
  Save-PidMap $map

  # 6. 健康检查(异步轮询,不阻塞其他服务启动)
  if (Wait-Healthy $Name $Port $HealthUrl $TimeoutSec) {
    Write-Ok "$Name 健康(端口 $Port 监听中)"
  } else {
    Write-Warn "$Name 启动超时($TimeoutSec s),请检查日志:$logPath"
  }
  return $true
}

# ============================================================
# 函数:打印状态
# ============================================================
function Show-Status {
  $registry = Get-ServiceRegistry
  Write-Hdr "IHUI-AI dev 服务状态"

  $map = Get-PidMap
  foreach ($name in $registry.all) {
    $svc = $registry.services.$name
    $port = [int]$svc.port
    $health = $svc.health
    $portInUse = Test-PortInUse $port
    $pidInfo = ''
    if ($map.ContainsKey($name)) {
      $procId = [int]$map[$name].pid
      $alive = Test-PidAlive $procId
      $pidInfo = if ($alive) { "PID=$procId 存活" } else { "PID=$procId 已死(僵尸)" }
    }
    $statusText = if ($portInUse) { 'UP' } else { 'DOWN' }
    $statusColor = if ($portInUse) { 'Green' } else { 'DarkGray' }
    $httpText = ''
    if ($portInUse -and -not [string]::IsNullOrEmpty($health)) {
      $ok = Test-HealthUrl $health 10
      $httpText = if ($ok) { ' / HTTP 200' } else { ' / HTTP NO-RESP' }
    }
    $pidText = if ($pidInfo) { "  [$pidInfo]" } else { '' }
    Write-Host ("  {0,-15} port {1,-5} {2}{3}{4}" -f $name, $port, $statusText, $httpText, $pidText) -ForegroundColor $statusColor
  }

  Write-Host ''
  Write-Host "  PID 注册表: $PidFile" -ForegroundColor DarkGray
  Write-Host "  日志目录:   $LogDir" -ForegroundColor DarkGray
}

# ============================================================
# 函数:停止所有 start-dev 启动的服务
# ============================================================
function Stop-AllServices {
  Write-Hdr "停止 start-dev 启动的所有服务"
  $map = Get-PidMap
  if ($map.Count -eq 0) {
    Write-Warn "PID 注册表为空,无服务可停"
    return
  }
  foreach ($name in @($map.Keys)) {
    Stop-ServiceProcess $name
  }
  Write-Ok "所有服务已停止"
}

# ============================================================
# 函数:清理端口 + 残留 dev 进程
# ============================================================
function Invoke-Cleanup {
  Write-Hdr "清理 IHUI dev 端口 + 残留 dev 进程"
  $registry = Get-ServiceRegistry

  # 1. 杀所有注册端口
  foreach ($name in $registry.all) {
    $svc = $registry.services.$name
    $port = [int]$svc.port
    $owner = Get-PortOwner $port
    if ($owner) {
      Write-Info "端口 $port ($name) 被 PID=$owner 占用,kill"
      Stop-ProcessTree $owner "$name 残留" | Out-Null
    } else {
      Write-Info "端口 $port ($name) free"
    }
  }

  # 2. 清 PID 注册表
  $map = Get-PidMap
  foreach ($name in @($map.Keys)) {
    $procId = [int]$map[$name].pid
    if (Test-PidAlive $procId) {
      Stop-ProcessTree $procId "$name 残留" | Out-Null
    }
    $map.Remove($name)
  }
  Save-PidMap $map

  # 3. 扫 IHUI 命令行残留(< 2 小时启动的 node.exe / python.exe)
  $cutoff = (Get-Date).AddHours(-2)
  $zombies = Get-Process -Name node, python -ErrorAction SilentlyContinue |
    Where-Object { $_.StartTime -gt $cutoff }
  $killed = 0
  foreach ($p in $zombies) {
    try {
      $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue).CommandLine
      if ($cmd -and ($cmd -match 'apps[\\/]|@ihui[\\/]|next-server|tsx watch|uvicorn|fastapi')) {
        Stop-ProcessTree $p.Id "$($p.ProcessName) IHUI 残留" | Out-Null
        $killed++
      }
    } catch {}
  }
  Write-Ok "已清理 $killed 个 IHUI 残留 dev 进程"
}

# ============================================================
# 函数:显示帮助
# ============================================================
function Show-Help {
  Write-Hdr "start-dev.ps1 用法"
  Write-Host @"
  启动模式(默认后台模式,SIGINT 免疫):
    pwsh -File scripts/start-dev.ps1                        # 启动默认组 web+api
    pwsh -File scripts/start-dev.ps1 -Services web,api,ai-service
    pwsh -File scripts/start-dev.ps1 -All                   # 启动全部 8 端
    pwsh -File scripts/start-dev.ps1 -Foreground            # 前台(不推荐,会被 SIGINT 杀)

  管理命令:
    pwsh -File scripts/start-dev.ps1 -Status                # 查看 8 端运行状态
    pwsh -File scripts/start-dev.ps1 -Stop                  # 停止所有 start-dev 启动的服务
    pwsh -File scripts/start-dev.ps1 -Clean                 # 清理端口 + 残留 dev 进程

  其他:
    -Force   端口冲突时强制 kill 占用进程
    -Help    显示本帮助

  设计原理:
    - 后台模式:Start-Process 派生 cmd.exe 隐藏窗口 + 重定向 stdout/stderr 到日志
    - 关闭本终端不会级联关闭 dev server(SIGINT 只到本 PowerShell 进程)
    - PID 写入 .trae-cn/tmp/dev-logs/pids.json(可手动清)
    - 日志:  .trae-cn/tmp/dev-logs/<name>.log + <name>.log.err
    - 注册表: scripts/dev-port-registry.json(端口 + 命令)
"@
}

# ============================================================
# Main
# ============================================================

if ($Help) {
  Show-Help
  exit 0
}

if ($Status) {
  Show-Status
  exit 0
}

if ($Stop) {
  Stop-AllServices
  exit 0
}

if ($Clean) {
  Invoke-Cleanup
  exit 0
}

# ============================================================
# 启动前硬门禁:三端 env 一致性检查(JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY)
# 2026-08-07 立:此前 env 漂移导致全站 401(任务列表/模型连接失败)反复出现,
# 任何不一致直接拒绝启动,绝不带病运行。
# ============================================================
function Invoke-EnvConsistencyGate {
  Write-Hdr "env 一致性门禁(三端 JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY)"
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Err "未找到 node,无法执行一致性门禁(scripts/check-dev-env-consistency.mjs),拒绝启动"
    return $false
  }
  $gateScript = Join-Path $RepoRoot 'scripts\check-dev-env-consistency.mjs'
  if (-not (Test-Path $gateScript)) {
    Write-Err "门禁脚本缺失: $gateScript,拒绝启动"
    return $false
  }
  $output = & node $gateScript 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -eq 0) {
    $output | ForEach-Object { Write-Host $_ }
    Write-Ok "env 一致性门禁通过"
    return $true
  }
  $output | ForEach-Object { Write-Host $_ }
  Write-Err "env 一致性门禁失败(exit=$exitCode):拒绝启动。请先修复 env 配置再重试。"
  return $false
}

# 启动流程
$registry = Get-ServiceRegistry

# 决定要启动的服务列表
$toStart = @()
if ($All) {
  $toStart = $registry.all
} elseif ($Services) {
  foreach ($s in $Services) {
    $s = $s.Trim()
    if ($s -notin $registry.all) {
      Write-Err "未知服务: $s(可选:$($registry.all -join ', '))"
      exit 1
    }
    $toStart += $s
  }
} else {
  # 默认:registry.default
  $toStart = $registry.default
}

if ($toStart.Count -eq 0) {
  Write-Err "无服务可启动。请用 -Services <name> 或 -All"
  Show-Help
  exit 1
}

# 硬门禁:env 一致性(仅实际启动时执行,-Status/-Stop/-Clean 跳过)
if (-not (Invoke-EnvConsistencyGate)) {
  exit 1
}

Write-Hdr "IHUI-AI dev 启动器(后台模式,SIGINT 免疫)"
Write-Info "启动服务:$($toStart -join ', ')"
Write-Info "日志目录:  $LogDir"
Write-Info "PID 注册表:$PidFile"
Write-Info "前台模式:  $(if ($Foreground) { 'YES(不免疫)' } else { 'NO(免疫)' })"

foreach ($name in $toStart) {
  $svc = $registry.services.$name
  Start-ServiceProcess `
    -Name $name `
    -Cmd $svc.cmd `
    -ScriptArgs $svc.args `
    -Cwd (Join-Path $RepoRoot $svc.cwd) `
    -Port ([int]$svc.port) `
    -HealthUrl $svc.health `
    -TimeoutSec ([int]$svc.timeout_sec) `
    -IsForeground:([bool]$Foreground)
}

Write-Hdr "完成"
Write-Info "查看状态:pwsh -File scripts/start-dev.ps1 -Status"
Write-Info "停止服务:pwsh -File scripts/start-dev.ps1 -Stop"
Write-Info "查看日志:$LogDir"
Write-Info "浏览器:" -NoNewline
foreach ($name in $toStart) {
  $svc = $registry.services.$name
  if ($svc.health) {
    Write-Host " $($svc.health)" -NoNewline -ForegroundColor Cyan
  }
}
Write-Host ''

# ============================================================
# 启动后端到端自检(2026-08-07 立):所有已启动服务做 HTTP 实测,
# 不再只信启动器的健康检查(api/ai-service 编译慢常报超时误判)。
# 每个服务独立等待其 registry timeout_sec(不统一窗口,慢服务给足时间)。
# 任一服务超时不响应 → 打印红色 FAIL + 日志提示,但仍保留进程排查。
# ============================================================
Write-Hdr "端到端自检(HTTP 实测,按服务独立等待)"
foreach ($name in $toStart) {
  $svc = $registry.services.$name
  $port = [int]$svc.port
  if (-not $svc.health) {
    Write-Host "  {0,-15} port {1,-5} SKIP(无 HTTP 探针)" -f $name, $port -ForegroundColor DarkGray
    continue
  }
  # 每个服务按自己的 timeout_sec 等待(web 60s / api 120s / ai-service 240s)
  $svcDeadline = (Get-Date).AddSeconds([int]$svc.timeout_sec)
  $ok = $false
  while ((Get-Date) -lt $svcDeadline) {
    if (Test-HealthUrl $svc.health 10) { $ok = $true; break }
    Start-Sleep -Milliseconds 1000
  }
  if ($ok) {
    $line = "  {0,-15} port {1,-5} PASS  {2}" -f $name, $port, $svc.health
    Write-Host $line -ForegroundColor Green
  } else {
    $line = "  {0,-15} port {1,-5} FAIL  {2}" -f $name, $port, $svc.health
    Write-Host $line -ForegroundColor Red
    Write-Host "          ↳ 请检查日志: $LogDir\$name.log(.err)" -ForegroundColor DarkGray
  }
}
