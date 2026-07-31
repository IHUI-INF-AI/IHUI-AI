<#
.SYNOPSIS
  IHUI-AI 一键启动 web(8801) + api(8802) + ai-service(8803) 三个 dev server,
  并在单个终端实时合并输出三者的日志。

.DESCRIPTION
  派生 3 个 Start-Process 后台进程跑 dev server,日志重定向到
  .trae-cn/tmp/ihui-stack-<svc>-<timestamp>.log,同时用 3 个 Start-Job
  持续 tail 日志文件,按颜色输出到当前终端(Ctrl+C 优雅停止所有子进程)。

  与 scripts/start-dev.ps1(后台 SIGINT 免疫)的关系:
    - start-dev.ps1:生产/调试推荐,后台派生,SIGINT 不级联。
    - start-ihui-stack.ps1:开发期"看日志"体验,前台聚合三色输出,Ctrl+C 全停。

.PARAMETER Skip
  跳过指定服务。可重复或单值字符串:'web','api','ai',或数组。
  与 -Only 互斥。

.PARAMETER Only
  只启动指定服务。'web' / 'api' / 'ai' 单值。
  与 -Skip 互斥。

.PARAMETER WhatIf
  打印将要执行的命令但不真跑(预演)。

.PARAMETER Status
  检查三个端口是否在跑并打印。

.PARAMETER Help
  显示帮助。

.EXAMPLE
  pwsh -File scripts\start-ihui-stack.ps1
  pwsh -File scripts\start-ihui-stack.ps1 -Skip ai
  pwsh -File scripts\start-ihui-stack.ps1 -Only web
  pwsh -File scripts\start-ihui-stack.ps1 -WhatIf
  pwsh -File scripts\start-ihui-stack.ps1 -Status

.NOTES
  仅支持 Windows PowerShell 5.1+。
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [Alias('Excludes')]
  [string[]]$Skip,

  [string]$Only,

  [switch]$WhatIf,

  [switch]$Status,

  [switch]$Help
)

Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -ErrorAction SilentlyContinue | Out-Null

$ErrorActionPreference = 'Stop'

# ============================================================
# 路径常量
# ============================================================
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..')).Path
$TmpDir = Join-Path $RepoRoot '.trae-cn\tmp'
$LogDir = $TmpDir
$PidFile = Join-Path $TmpDir 'ihui-stack-pids.json'

$WebPort = 8801
$ApiPort = 8802
$AiPort = 8803

# 服务定义(单一权威来源)
$Services = @(
  @{
    Key      = 'web'
    Name     = 'WEB-8801'
    Port     = $WebPort
    Color    = 'Cyan'
    Cwd      = $RepoRoot
    Cmd      = 'pnpm'
    Args     = @('--filter', '@ihui/web', 'dev')
    Health   = "http://localhost:$WebPort"
    Shortcut = 'web'
  }
  @{
    Key      = 'api'
    Name     = 'API-8802'
    Port     = $ApiPort
    Color    = 'Yellow'
    Cwd      = $RepoRoot
    Cmd      = 'pnpm'
    Args     = @('--filter', '@ihui/api', 'dev')
    Health   = "http://localhost:$ApiPort/api/health"
    Shortcut = 'api'
  }
  @{
    Key      = 'ai'
    Name     = 'AI-8803'
    Port     = $AiPort
    Color    = 'Magenta'
    Cwd      = (Join-Path $RepoRoot 'apps\ai-service')
    Cmd      = 'python'
    Args     = @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8803')
    Health   = "http://localhost:$AiPort/health"
    Shortcut = 'ai'
  }
)

# ============================================================
# 颜色输出
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
# 帮助
# ============================================================
function Show-Help {
  Write-Hdr 'start-ihui-stack.ps1 用法'
  Write-Host @"
  启动 (前台聚合日志,Ctrl+C 全停):
    pwsh -File scripts\start-ihui-stack.ps1                # 启动 web + api + ai
    pwsh -File scripts\start-ihui-stack.ps1 -Skip ai       # 只启动 web + api
    pwsh -File scripts\start-ihui-stack.ps1 -Only web      # 只启动 web
    pwsh -File scripts\start-ihui-stack.ps1 -WhatIf        # 预演,不动手

  管理:
    pwsh -File scripts\start-ihui-stack.ps1 -Status        # 查看三端状态

  颜色:
    WEB  = Cyan     [WEB-8801]
    API  = Yellow   [API-8802]
    AI   = Magenta  [AI-8803]

  产物:
    日志: .trae-cn/tmp/ihui-stack-<svc>-<timestamp>.log
    PID : .trae-cn/tmp/ihui-stack-pids.json

  停止:
    Ctrl+C (本终端会优雅关闭所有子进程 + 清 PID 文件)
"@
}

# ============================================================
# 工具函数
# ============================================================
function Test-PortInUse([int]$port) {
  # 兼容 IPv4 + IPv6:Next.js dev server / uvicorn 在 Windows 上常默认只绑
  # IPv6([::1]),而 Get-NetTCPConnection 在 PS 5.1 上查询不完整,容易误报
  # DOWN。兜底逻辑:Get-NetTCPConnection(快)→ netstat(PS 5.1 兼容)→
  # Test-NetConnection(真连一下,慢但稳)。
  $conn = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if ($conn.Count -gt 0) { return $true }

  # netstat 兜底:Windows 5.x 起 ::port / 0.0.0.0:port 都能匹配
  $netstat = netstat -an 2>$null | Select-String "[:.]$port\s"
  if ($null -ne $netstat -and $netstat.Count -gt 0) { return $true }

  # 终极兜底:用 Test-NetConnection 主动连接(可能耗时 1-2s)
  try {
    $tnc = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    return $tnc
  } catch {
    return $false
  }
}

function Get-PortOwner([int]$port) {
  $conn = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if ($conn.Count -gt 0) {
    $procId = ($conn | Select-Object -First 1).OwningProcess
    if ($procId -gt 0) { return $procId }
  }
  # IPv6 fallback:netstat 解析
  $line = netstat -ano 2>$null | Select-String "[:.]$port\s.*LISTENING" | Select-Object -First 1
  if ($null -ne $line) {
    $tokens = ($line -replace '\s+', ' ').Trim().Split(' ')
    if ($tokens.Count -ge 5) {
      $pid = $tokens[$tokens.Count - 1]
      if ($pid -match '^\d+$' -and [int]$pid -gt 0) { return [int]$pid }
    }
  }
  return $null
}

function Test-CommandExists([string]$cmd) {
  $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

function Test-Http([string]$url, [int]$timeoutSec = 2) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $timeoutSec -ErrorAction Stop
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
  } catch {
    return $false
  }
}

# ============================================================
# 预检
# ============================================================
function Invoke-Preflight {
  Write-Hdr '预检环境'

  $ok = $true

  if (-not (Test-CommandExists 'pnpm')) {
    Write-Err 'pnpm 不在 PATH。请先安装 pnpm (npm i -g pnpm)。'
    $ok = $false
  } else {
    $pnpmVer = (& pnpm --version 2>&1 | Select-Object -First 1)
    Write-Ok "pnpm: $pnpmVer"
  }

  if (-not (Test-CommandExists 'python')) {
    Write-Err 'python 不在 PATH。ai-service 启动会失败。'
    $ok = $false
  } else {
    $pyVer = (& python --version 2>&1 | Select-Object -First 1)
    Write-Ok "python: $pyVer"
  }

  $pnpmStore = Join-Path $RepoRoot 'node_modules\.pnpm'
  if (-not (Test-Path $pnpmStore)) {
    Write-Err "未发现 $pnpmStore。请先在仓库根目录执行 pnpm install。"
    $ok = $false
  } else {
    Write-Ok "node_modules\.pnpm: 已存在"
  }

  foreach ($svc in $Services) {
    $port = [int]$svc.Port
    if (Test-PortInUse $port) {
      $owner = Get-PortOwner $port
      Write-Warn "端口 $port ($($svc.Name)) 已被 PID=$owner 占用。"
      Write-Host "       建议先停掉:Start-Process pids 写入 $PidFile,或手动 taskkill /F /PID $owner" -ForegroundColor DarkGray
    } else {
      Write-Ok "端口 $port ($($svc.Name)): 空闲"
    }
  }

  if (-not $ok) {
    Write-Err '预检未通过,退出。'
    exit 1
  }
}

# ============================================================
# 状态检查
# ============================================================
function Show-Status {
  Write-Hdr 'IHUI-AI dev 栈状态'
  foreach ($svc in $Services) {
    $port = [int]$svc.Port
    $inUse = Test-PortInUse $port
    $owner = if ($inUse) { Get-PortOwner $port } else { $null }
    $httpOk = if ($inUse -and $svc.Health) { Test-Http $svc.Health 2 } else { $false }
    $statusText = if ($inUse) { 'UP' } else { 'DOWN' }
    $color = if ($inUse) { 'Green' } else { 'DarkGray' }
    $httpText = if ($httpOk) { ' / HTTP OK' } elseif ($inUse) { ' / HTTP NO-RESP' } else { '' }
    $ownerText = if ($owner) { "  (PID=$owner)" } else { '' }
    Write-Host ("  {0,-10} port {1,-5} {2}{3}{4}" -f $svc.Name, $port, $statusText, $httpText, $ownerText) -ForegroundColor $color
  }
  Write-Host ''
  if (Test-Path $PidFile) {
    Write-Host "  PID 文件: $PidFile" -ForegroundColor DarkGray
  } else {
    Write-Host "  PID 文件: (未生成,本脚本尚未启动过)" -ForegroundColor DarkGray
  }
}

# ============================================================
# 决定启动哪些服务
# ============================================================
function Resolve-ServicesToStart {
  # 互斥检查
  if ($Skip -and $Only) {
    Write-Err '-Skip 与 -Only 互斥,不可同时使用。'
    exit 1
  }

  $shortcuts = @{ 'web' = 'web'; 'api' = 'api'; 'ai' = 'ai' }

  if ($Only) {
    $only = $Only.Trim().ToLower()
    if (-not $shortcuts.ContainsKey($only)) {
      Write-Err "-Only 取值无效: '$Only'。允许: web / api / ai"
      exit 1
    }
    $selected = @($shortcuts[$only])
  } else {
    $selected = @('web', 'api', 'ai')
    if ($Skip) {
      foreach ($s in $Skip) {
        $s2 = "$s".Trim().ToLower()
        if (-not $shortcuts.ContainsKey($s2)) {
          Write-Err "-Skip 取值无效: '$s'。允许: web / api / ai"
          exit 1
        }
        $selected = $selected | Where-Object { $_ -ne $s2 }
      }
    }
  }

  if ($selected.Count -eq 0) {
    Write-Err '无服务可启动。'
    exit 1
  }

  return $selected
}

# ============================================================
# 启动单个子进程 + 写 PID 文件
# ============================================================
function Start-Service {
  param(
    [hashtable]$Service
  )

  $key = $Service.Key
  $name = $Service.Name
  $port = [int]$Service.Port
  $cwd = $Service.Cwd
  $cmd = $Service.Cmd
  $args = $Service.Args

  if (-not (Test-Path $cwd)) {
    Write-Err "[$name] 工作目录不存在: $cwd"
    return $null
  }

  # 端口冲突硬阻断
  if (Test-PortInUse $port) {
    $owner = Get-PortOwner $port
    Write-Err "[$name] 端口 $port 已被 PID=$owner 占用,请先停掉或换端口。"
    return $null
  }

  # 准备日志文件
  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $logPath = Join-Path $LogDir ("ihui-stack-{0}-{1}.log" -f $key, $timestamp)
  $errPath = Join-Path $LogDir ("ihui-stack-{0}-{1}.log.err" -f $key, $timestamp)
  '' | Set-Content -Path $logPath -Encoding UTF8
  '' | Set-Content -Path $errPath -Encoding UTF8

  # pnpm 在 Windows 是 .cmd shim,直接 Start-Process pnpm.exe 报 "%1 is not a valid
  # Win32 application"。用 cmd.exe /c 包装最稳。
  $argList = $args | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
  }
  $cmdLine = "$Cmd " + ($argList -join ' ')

  if ($WhatIf) {
    Write-Info "[$name] WHATIF: cmd.exe /c $cmdLine  (cwd: $cwd)"
    Write-Info "[$name] WHATIF: stdout -> $logPath"
    Write-Info "[$name] WHATIF: stderr -> $errPath"
    return @{
      Service = $Service
      Pid     = 0
      Log     = $logPath
      Err     = $errPath
      StartedAt = (Get-Date).ToString('o')
      WhatIf  = $true
    }
  }

  Write-Info "[$name] 启动: $cmdLine"
  Write-Info "[$name] cwd : $cwd"

  try {
    $proc = Start-Process -FilePath 'cmd.exe' `
      -ArgumentList @('/c', $cmdLine) `
      -WorkingDirectory $cwd `
      -WindowStyle Hidden `
      -RedirectStandardOutput $logPath `
      -RedirectStandardError $errPath `
      -PassThru `
      -ErrorAction Stop
  } catch {
    Write-Err "[$name] 启动失败: $($_.Exception.Message)"
    return $null
  }

  Write-Ok "[$name] PID=$($proc.Id),日志: $logPath"
  return @{
    Service   = $Service
    Pid       = $proc.Id
    Log       = $logPath
    Err       = $errPath
    StartedAt = (Get-Date).ToString('o')
    WhatIf    = $false
  }
}

# ============================================================
# 写 PID 文件
# ============================================================
function Save-PidRegistry([array]$handles) {
  $map = [ordered]@{}
  foreach ($h in $handles) {
    if ($null -eq $h) { continue }
    $key = $h.Service.Key
    $map[$key] = @{
      name      = $h.Service.Name
      pid       = $h.Pid
      port      = [int]$h.Service.Port
      log       = $h.Log
      err       = $h.Err
      cwd       = $h.Service.Cwd
      cmd       = $h.Service.Cmd
      args      = $h.Service.Args
      started_at = $h.StartedAt
    }
  }
  if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  }
  $map | ConvertTo-Json -Depth 6 | Set-Content -Path $PidFile -Encoding UTF8
}

function Remove-PidRegistry {
  if (Test-Path $PidFile) {
    try { Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue } catch {}
  }
}

# ============================================================
# 优雅停止
# ============================================================
function Stop-AllHandles([array]$handles) {
  foreach ($h in $handles) {
    if ($null -eq $h) { continue }
    if ($h.WhatIf) { continue }
    $pid = [int]$h.Pid
    if ($pid -le 0) { continue }
    $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($null -eq $p) { continue }
    if ($p.HasExited) { continue }
    try {
      & taskkill /F /T /PID $pid 2>&1 | Out-Null
      Write-Info "[$($h.Service.Name)] taskkill PID=$pid"
    } catch {
      Write-Warn "[$($h.Service.Name)] taskkill 失败: $($_.Exception.Message)"
    }
  }
}

# ============================================================
# 实时日志 tail(Start-Job + Get-Content -Wait)
# ============================================================
# 用 Start-Job 跑 Get-Content -Wait,每个服务一个 job 持续监听日志追加,
# 通过 Write-Host -ForegroundColor 输出到主进程终端(Job 的 Write-Host
# 会回传到主进程 Output stream)。
function Start-LogTailingJobs {
  param([array]$Handles)
  $jobs = @()
  foreach ($h in $Handles) {
    if ($null -eq $h) { continue }
    $logPath = $h.Log
    $errPath = $h.Err
    $color = $h.Service.Color
    $name = $h.Service.Name
    $key = $h.Service.Key

    # tail job:持续读新行,按颜色 + prefix 输出
    $job = Start-Job -Name "tail-$key" -ScriptBlock {
      param($Path, $ErrPath, $Color, $SvcName)
      try {
        # 等待文件出现(子进程刚启动可能还没写)
        $deadline = (Get-Date).AddSeconds(10)
        while (-not (Test-Path $Path) -and (Get-Date) -lt $deadline) {
          Start-Sleep -Milliseconds 200
        }
        if (-not (Test-Path $Path)) { return }
        # 先打印首批已有内容(从文件开头),然后 -Wait 持续 tail
        if ((Get-Item $Path).Length -gt 0) {
          Get-Content -Path $Path -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host ("[{0}] {1}" -f $SvcName, $_) -ForegroundColor $Color
          }
        }
        if ((Test-Path $ErrPath) -and (Get-Item $ErrPath).Length -gt 0) {
          Get-Content -Path $ErrPath -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host ("[{0}] {1}" -f $SvcName, $_) -ForegroundColor $Color
          }
        }
        # 持续 tail(Get-Content -Wait 阻塞直到 EOF,新行追加后继续)
        Get-Content -Path $Path -Wait -Tail 0 -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
          Write-Host ("[{0}] {1}" -f $SvcName, $_) -ForegroundColor $Color
        }
      } catch {
        # tail 异常,静默(主进程会单独检测子进程存活)
      }
    } -ArgumentList $logPath, $errPath, $color, $name

    $jobs += $job
    Write-Info "[$name] tail job: $($job.Name) (Id=$($job.Id))"
  }
  return ,$jobs
}

function Stop-LogTailingJobs([array]$jobs) {
  foreach ($j in $jobs) {
    if ($null -eq $j) { continue }
    try {
      Stop-Job -Job $j -ErrorAction SilentlyContinue
      Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
    } catch {}
  }
}

# ============================================================
# Ctrl+C 处理
# ============================================================
$script:Handles = @()
$script:TailJobs = @()
$script:CleanedUp = $false

function Invoke-Cleanup {
  if ($script:CleanedUp) { return }
  $script:CleanedUp = $true
  Write-Host ''
  Write-Host ('-' * 70) -ForegroundColor DarkGray
  Write-Host '  [STOP] 收到停止信号,清理子进程 + tail jobs...' -ForegroundColor Yellow
  if ($script:TailJobs -and $script:TailJobs.Count -gt 0) {
    Stop-LogTailingJobs $script:TailJobs
  }
  Stop-AllHandles $script:Handles
  Remove-PidRegistry
  Write-Host '  [OK]   所有 dev server 已停止,PID 文件已清。' -ForegroundColor Green
  Write-Host ('-' * 70) -ForegroundColor DarkGray
}

# 注册 Ctrl+C 处理(非交互式终端可能没有 console handle,容错)
try {
  [Console]::TreatControlCAsInput = $false
} catch {}
$consoleCancel = {
  Invoke-Cleanup
  exit 0
}
try {
  [Console]::add_CancelKeyPress($consoleCancel)
} catch {}

# 进程退出时兜底
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
  if (-not $script:CleanedUp) {
    if ($script:TailJobs -and $script:TailJobs.Count -gt 0) {
      Stop-LogTailingJobs $script:TailJobs
    }
    Stop-AllHandles $script:Handles
    Remove-PidRegistry
  }
} | Out-Null

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

# 互斥已在 Resolve 里做,这里再校验一次
if ($Skip -and $Only) {
  Write-Err '-Skip 与 -Only 互斥,不可同时使用。'
  exit 1
}

$selected = Resolve-ServicesToStart

Write-Hdr 'IHUI-AI 启动器 (web+api+ai 前台聚合)'
Write-Info "目标服务: $($selected -join ', ')"
Write-Info "日志目录: $LogDir"
Write-Info "PID 文件: $PidFile"

# 预检
Invoke-Preflight

# 按选择过滤
$toStart = $Services | Where-Object { $_.Shortcut -in $selected }

# 启动
$handles = @()
$failures = 0
foreach ($svc in $toStart) {
  $h = Start-Service -Service $svc
  if ($null -eq $h) {
    $failures++
  } else {
    $handles += $h
  }
}

if ($failures -gt 0 -and $handles.Count -eq 0) {
  Write-Err "全部 $failures 个服务启动失败,退出。"
  Remove-PidRegistry
  exit 1
}
if ($failures -gt 0) {
  Write-Warn "$failures 个服务启动失败,继续拉起已成功的 $($handles.Count) 个..."
}

$script:Handles = $handles

# 写 PID 注册表
if ($WhatIf) {
  Write-Info 'WhatIf:跳过写 PID 文件'
} else {
  Save-PidRegistry $handles
  Write-Ok "PID 已写入 $PidFile"
}

# 启动 tail job(实时输出到主终端)
$script:TailJobs = Start-LogTailingJobs -Handles $handles

# 打印连接信息
Write-Hdr '完成'
foreach ($h in $handles) {
  $svc = $h.Service
  $color = if ($svc.Color -and [Enum]::IsDefined([System.ConsoleColor], $svc.Color)) { $svc.Color } else { 'White' }
  Write-Host ("  {0,-10} http://localhost:{1,-5} (PID {2})" -f $svc.Name, $svc.Port, $h.Pid) -ForegroundColor $color
}
Write-Host ''
Write-Host '  日志实时输出 (Ctrl+C 优雅停止全部服务):' -ForegroundColor DarkGray
Write-Host ('=' * 70) -ForegroundColor DarkGray

# 主循环:保持进程存活 + 监听子进程退出
try {
  while ($true) {
    Start-Sleep -Seconds 1
    foreach ($h in $handles) {
      if ($h.WhatIf) { continue }
      $p = Get-Process -Id $h.Pid -ErrorAction SilentlyContinue
      if ($null -eq $p -or $p.HasExited) {
        Write-Warn "[$($h.Service.Name)] 进程 PID=$($h.Pid) 已退出,查看日志: $($h.Log)"
      }
    }
  }
} finally {
  Invoke-Cleanup
}
