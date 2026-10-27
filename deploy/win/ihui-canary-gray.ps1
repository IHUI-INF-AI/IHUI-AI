# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# ihui-canary-gray.ps1 — 金丝雀「灰度期」的进程编排层(起停实例与分流器)。
#
# 分工(§0.6 单一真相源,三处不得各写一份):
#   scripts/canary-traffic.mjs       — 档位推进判定 + 契约构造(纯函数,唯一判据)
#   scripts/canary-verdict.mjs       — 错误率/延迟比对(纯函数)
#   deploy/win/ihui-canary-stage.mjs — 「这一轮判定之后该做什么」的动作决策
#   deploy/win/ihui-canary-split.mjs — 源站前置分流器(按契约比例切流)
#   本文件                          — **进程与服务动作**:起/停/查灰度实例与分流器
#
# 灰度期的槽位形态(两个槽位同时在位,这是"先小流量"能成立的前提):
#   stable 槽位 = 8801  现网(灰度期**一直跑旧版本**)⇒ 灰度期内线上从没跑过新版本
#   canary 槽位 = 8845  灰度候选(跑 .next-staging 那份新构建)
#   分流器       = 8846  源站前置,按契约比例把请求切给上面两个槽位
#
# 判据一律不在本文件里重写(比例从哪来、怎么推进、异常怎么判都不归这里);
# 本文件只做"把进程拉起来/停下去/查得到",并把结果如实回给调用方。
#
# 状态(全部落 .ihui-agent/state/canary/,该目录被 gitignore 覆盖 ⇒ 不弄脏工作树):
#   ramp.json       契约(比例/档位/槽位端口/路由键头)—— 由 ihui-canary-stage.mjs 唯一写
#   canary.pid      灰度实例进程号
#   split.pid       分流器进程号
#   attempts.json   同一枚 sha 的灰度尝试次数(防"判不了就无限重来")
#
# 退出码:0 动作完成 / 2 未判定(缺件、起不来、判不出)。
# =============================================================================
param(
    # start | stop | status
    [Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'status')][string]$Action,
    # 灰度实例监听端口(默认 8845,与 scripts/data/canary-policy.json 的 canary 槽位一致)
    [int]$CanaryPort = 8845,
    # 分流器监听端口(默认 8846)
    [int]$SplitPort = 8846,
    # 灰度实例的启动命令覆盖(测试用;生产走仓内默认形态:next start 跑 .next-staging)
    [string]$CanaryExe = '',
    [string]$CanaryArgs = '',
    # 状态目录覆盖(测试用)
    [string]$StateDir = ''
)

$ErrorActionPreference = 'Stop'

# ── 仓库根:一律由脚本自身位置推导,禁止写死盘符(同 ihui-root-common.ps1 立的规矩)──
$RootCommon = Join-Path $PSScriptRoot 'ihui-root-common.ps1'
if (-not (Test-Path -LiteralPath $RootCommon)) {
    Write-Host "FAIL  缺少仓库根解析实现:$RootCommon(拒绝启动,不退回写死盘符)"
    exit 2
}
. $RootCommon
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot

$WebDir = Join-Path $Root 'apps\web'
if (-not $StateDir) { $StateDir = Join-Path $Root '.ihui-agent\state\canary' }
$ContractPath = Join-Path $StateDir 'ramp.json'
$CanaryPidFile = Join-Path $StateDir 'canary.pid'
$SplitPidFile = Join-Path $StateDir 'split.pid'
$AttemptsFile = Join-Path $StateDir 'attempts.json'
$LogDir = Join-Path $Root '.ihui-agent\logs'

function Write-GrayLog {
    param([string]$m)
    Write-Host ("[canary-gray] {0}" -f $m)
}

# ── node 可执行文件:按候选取第一个存在的(服务/SYSTEM 上下文 PATH 里常常取不到)──
function Resolve-GrayNode {
    $candidates = @(
        'D:\DevEnv\runtimes\node\node.exe',
        'D:\DevEnv\runtimes\node22-lts\node.exe',
        'C:\Program Files\nodejs\node.exe'
    )
    foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { return $c } }
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return ''
}

# ── 端口探活:本机 TCP 连一下即可(毫秒级,不做业务请求)──
function Test-GrayPort {
    param([int]$Port, [int]$TimeoutMs = 500)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        if (-not $task.Wait($TimeoutMs)) { return $false }
        return $client.Connected
    } catch {
        return $false
    } finally {
        try { $client.Close() } catch { }
    }
}

function Get-GrayPid {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return 0 }
    $raw = (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue)
    if (-not $raw) { return 0 }
    $pidValue = 0
    if (-not [int]::TryParse($raw.Trim(), [ref]$pidValue)) { return 0 }
    if ($pidValue -le 0) { return 0 }
    $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if (-not $proc) { return 0 }
    return $pidValue
}

function Stop-GrayProcess {
    param([string]$PidFile, [string]$What)
    $pidValue = Get-GrayPid -Path $PidFile
    if ($pidValue -le 0) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return $false
    }
    Write-GrayLog "停止 $What(pid=$pidValue)"
    & taskkill /PID $pidValue /T /F 2>&1 | Out-Null
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $true
}

# ── 灰度实例的启动形态:next start 跑 .next-staging 那份新构建 ──────────────
# IHUI_BUILD_DIST 决定 next.config.ts 的 distDir(next.config.ts: buildDistDir =
# process.env.IHUI_BUILD_DIST || staticDistDir)⇒ 灰度实例服务 .next-staging,
# 现网 8801 那只没有这个环境变量,服务 .next ⇒ 两个槽位服务的是两份不同产物。
function Get-GrayCanaryCommand {
    if ($CanaryExe) {
        return [pscustomobject]@{ Exe = $CanaryExe; Args = $CanaryArgs; Cwd = $WebDir }
    }
    $node = Resolve-GrayNode
    if (-not $node) {
        Write-GrayLog "未判定:node.exe 取不到(候选全不存在且 PATH 里没有)⇒ 灰度实例起不来"
        return $null
    }
    $nextBin = Join-Path $WebDir 'node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $nextBin)) {
        Write-GrayLog "未判定:next 二进制不在位($nextBin)⇒ 灰度实例起不来"
        return $null
    }
    if (-not (Test-Path -LiteralPath (Join-Path $WebDir '.next-staging\BUILD_ID'))) {
        Write-GrayLog "未判定:.next-staging 没有 BUILD_ID ⇒ 灰度实例无产物可服务(先构建到 staging)"
        return $null
    }
    return [pscustomobject]@{
        Exe  = $node
        Args = "`"$nextBin`" start -H 127.0.0.1 -p $CanaryPort"
        Cwd  = $WebDir
    }
}

function Start-GrayCanary {
    if (Test-GrayPort -Port $CanaryPort) {
        Write-GrayLog "灰度实例已在位(端口 $CanaryPort)⇒ 不重复起"
        return $true
    }
    $cmd = Get-GrayCanaryCommand
    if (-not $cmd) { return $false }
    New-Item -ItemType Directory -Path $LogDir -Force -ErrorAction SilentlyContinue | Out-Null
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $outLog = Join-Path $LogDir "canary-web-$stamp.out.log"
    $errLog = Join-Path $LogDir "canary-web-$stamp.err.log"
    # 灰度实例必须服务 .next-staging(新构建),不是 .next(现网那份)。
    $env:IHUI_BUILD_DIST = '.next-staging'
    $proc = Start-Process -FilePath $cmd.Exe -ArgumentList $cmd.Args -WorkingDirectory $cmd.Cwd `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    Set-Content -LiteralPath $CanaryPidFile -Value $proc.Id -NoNewline
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-GrayPort -Port $CanaryPort) {
            Write-GrayLog "灰度实例已在位(端口 $CanaryPort,pid=$($proc.Id),产物=.next-staging)"
            return $true
        }
        if ($proc.HasExited) { break }
    }
    Write-GrayLog "FAIL  灰度实例起不来(端口 $CanaryPort 无监听)⇒ 灰度不放量(看 $errLog)"
    return $false
}

function Start-GraySplit {
    if (Test-GrayPort -Port $SplitPort) {
        Write-GrayLog "分流器已在位(端口 $SplitPort)⇒ 不重复起"
        return $true
    }
    $node = Resolve-GrayNode
    if (-not $node) {
        Write-GrayLog "未判定:node.exe 取不到 ⇒ 分流器起不来"
        return $false
    }
    $script = Join-Path $Root 'deploy\win\ihui-canary-split.mjs'
    if (-not (Test-Path -LiteralPath $script)) {
        Write-GrayLog "未判定:分流器脚本不在位($script)"
        return $false
    }
    New-Item -ItemType Directory -Path $LogDir -Force -ErrorAction SilentlyContinue | Out-Null
    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $outLog = Join-Path $LogDir "canary-split-$stamp.out.log"
    $errLog = Join-Path $LogDir "canary-split-$stamp.err.log"
    $proc = Start-Process -FilePath $node -ArgumentList "`"$script`" --contract `"$ContractPath`" --listen $SplitPort" `
        -WorkingDirectory $Root -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    Set-Content -LiteralPath $SplitPidFile -Value $proc.Id -NoNewline
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 300
        if (Test-GrayPort -Port $SplitPort) {
            Write-GrayLog "分流器已在位(端口 $SplitPort,pid=$($proc.Id))"
            return $true
        }
        if ($proc.HasExited) { break }
    }
    Write-GrayLog "FAIL  分流器起不来(端口 $SplitPort 无监听)⇒ 灰度不放量(看 $errLog)"
    return $false
}

# ── 同一枚 sha 的灰度尝试次数(防"判不了就无限重来")────────────────────
function Get-GrayAttempt {
    param([string]$Sha)
    if (-not $Sha) { return 0 }
    if (-not (Test-Path -LiteralPath $AttemptsFile)) { return 0 }
    try {
        $doc = Get-Content -LiteralPath $AttemptsFile -Raw | ConvertFrom-Json
        $v = $doc.$Sha
        if ($null -eq $v) { return 0 }
        return [int]$v
    } catch {
        return 0
    }
}

function Add-GrayAttempt {
    param([string]$Sha)
    if (-not $Sha) { return }
    $map = @{}
    if (Test-Path -LiteralPath $AttemptsFile) {
        try { $map = (Get-Content -LiteralPath $AttemptsFile -Raw | ConvertFrom-Json) } catch { $map = @{} }
    }
    $cur = 0
    if ($null -ne $map.$Sha) { $cur = [int]$map.$Sha }
    $map | Add-Member -NotePropertyName $Sha -NotePropertyValue ($cur + 1) -Force
    New-Item -ItemType Directory -Path (Split-Path -Parent $AttemptsFile) -Force -ErrorAction SilentlyContinue | Out-Null
    Set-Content -LiteralPath $AttemptsFile -Value ($map | ConvertTo-Json -Compress) -NoNewline
}

New-Item -ItemType Directory -Path $StateDir -Force -ErrorAction SilentlyContinue | Out-Null

switch ($Action) {
    'start' {
        if (-not (Start-GrayCanary)) { exit 2 }
        if (-not (Start-GraySplit)) {
            Stop-GrayProcess -PidFile $CanaryPidFile -What '灰度实例' | Out-Null
            exit 2
        }
        Write-GrayLog "灰度期进程已就位(实例 $CanaryPort / 分流器 $SplitPort)"
        exit 0
    }
    'stop' {
        Stop-GrayProcess -PidFile $SplitPidFile -What '分流器' | Out-Null
        Stop-GrayProcess -PidFile $CanaryPidFile -What '灰度实例' | Out-Null
        Write-GrayLog "灰度期进程已停(实例 $CanaryPort / 分流器 $SplitPort)"
        exit 0
    }
    'status' {
        $contract = $null
        if (Test-Path -LiteralPath $ContractPath) {
            try { $contract = Get-Content -LiteralPath $ContractPath -Raw | ConvertFrom-Json } catch { $contract = $null }
        }
        $out = [ordered]@{
            canaryUp = (Test-GrayPort -Port $CanaryPort)
            splitUp  = (Test-GrayPort -Port $SplitPort)
            contract = $contract
            attempts = (Get-GrayAttempt -Sha 'status')
        }
        Write-Host ($out | ConvertTo-Json -Depth 6 -Compress)
        exit 0
    }
}
exit 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
