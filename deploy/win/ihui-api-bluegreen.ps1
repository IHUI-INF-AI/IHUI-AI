# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# ⚠ 2026-10-28 起**已被 ihui-api-bluegreen.mjs 取代**,部署环不再调用本脚本。
#   原因(当日实测):本机 sc.exe 被程序黑名单封死(PROGRAM BLOCKED BY SECURITY POLICY),
#   且 powershell 起嵌套子进程时连 Test-Path 都加载不出 ⇒ 本脚本在此环境第一步就跑不通。
#   保留仅供对照历史语义(切换步骤与 .mjs 逐条一致),不要再把它接回部署面。
#
# API 蓝绿切换器 —— 部署时用它取代「sc stop 旧实例 → sc start 新实例」的硬重启。
#
# 流程：
#   1. 目标色 = 非当前活跃色（blue 8842 / green 8843）
#   2. 停目标色（若在跑）→ 启动目标色，让它加载**新代码**
#   3. 轮询 http://127.0.0.1:<目标端口>/api/health 直到 status=ok
#   4. 原子写状态文件，ihui-api-router.mjs 1 秒内切上游（8802 始终有监听）
#   5. 排空 DrainSec 秒，让旧色上的 in-flight 请求与 WS 自然结束
#   6. 停旧色
#
# 失败语义：目标色起不来 ⇒ 状态文件不动、旧色继续服务，脚本 exit 1（部署失败但线上无损）。

param(
    [ValidateSet('auto', 'blue', 'green')][string]$Target = 'auto',
    [int]$HealthTimeoutSec = 120,
    [int]$DrainSec = 20,
    [string]$StateFile = 'D:\DevEnv\ihui-prod\deploy\run\api-bluegreen.json',
    [string]$LogFile = 'D:\DevEnv\logs\api-bluegreen.log'
)

$ErrorActionPreference = 'Stop'

$Services = @{ blue = 'IHUI-API-BLUE'; green = 'IHUI-API-GREEN' }
$Ports = @{ blue = 8842; green = 8843 }

function Write-BgLog {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    Write-Host $line
    try {
        $dir = Split-Path -Parent $LogFile
        if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
    } catch { }
}

function Read-BgState {
    if (-not (Test-Path -LiteralPath $StateFile)) {
        return [pscustomobject]@{ active = 'blue'; blue = $Ports.blue; green = $Ports.green }
    }
    try {
        $s = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
        $active = if ($s.active -eq 'green') { 'green' } else { 'blue' }
        return [pscustomobject]@{
            active = $active
            blue   = if ($s.blue) { [int]$s.blue } else { $Ports.blue }
            green  = if ($s.green) { [int]$s.green } else { $Ports.green }
        }
    } catch {
        Write-BgLog "状态文件损坏,按默认 blue 处理:$($_.Exception.Message)" 'WARN'
        return [pscustomobject]@{ active = 'blue'; blue = $Ports.blue; green = $Ports.green }
    }
}

function Write-BgStateAtomic {
    param([string]$Active)
    $dir = Split-Path -Parent $StateFile
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $tmp = "$StateFile.tmp"
    $payload = [ordered]@{ active = $Active; blue = $Ports.blue; green = $Ports.green; updatedAt = (Get-Date).ToString('o') }
    $payload | ConvertTo-Json | Set-Content -LiteralPath $tmp -Encoding utf8
    Move-Item -LiteralPath $tmp -Destination $StateFile -Force
}

function Test-ApiHealth {
    param([int]$Port)
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3
        return ($r.StatusCode -eq 200 -and $r.Content -match '"status":"ok"')
    } catch {
        return $false
    }
}

function Wait-ServiceState {
    param([string]$Name, [string]$Desired, [int]$TimeoutSec = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status.ToString() -eq $Desired) { return $true }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Start-BgService {
    param([string]$Name)
    $svc = Get-Service -Name $Name -ErrorAction Stop
    if ($svc.Status -ne 'Running') {
        Write-BgLog "启动服务 $Name"
        sc.exe start $Name | Out-Null
    } else {
        Write-BgLog "服务 $Name 已在运行,先停止以便加载新代码"
        sc.exe stop $Name | Out-Null
        if (-not (Wait-ServiceState -Name $Name -Desired 'Stopped' -TimeoutSec 30)) {
            throw "服务 $Name 30 秒内未停止,放弃切换"
        }
        sc.exe start $Name | Out-Null
    }
}

function Stop-BgService {
    param([string]$Name, [int]$TimeoutSec = 45)
    $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $svc) { return }
    if ($svc.Status -eq 'Stopped') { return }
    Write-BgLog "停止服务 $Name"
    sc.exe stop $Name | Out-Null
    if (-not (Wait-ServiceState -Name $Name -Desired 'Stopped' -TimeoutSec $TimeoutSec)) {
        Write-BgLog "服务 $Name 未在 ${TimeoutSec}s 内停止(继续,不阻塞部署)" 'WARN'
    }
}

$state = Read-BgState

# ── 0. 状态自愈(2026-10-28 加)────────────────────────────────────────────────
# 状态文件记的活跃色可能没在跑:上次活跃停在 green(green 是 SERVICE_DEMAND_START),
# 机器重启后只有 blue 自动启动。此时若不先自愈,下面算出的"目标色"就是 blue ——
# 也就是把唯一在服务的实例停掉重起,那是一次真实的停机(与 router 的开机对账互为兜底)。
if ($Target -eq 'auto') {
    $otherColor = if ($state.active -eq 'blue') { 'green' } else { 'blue' }
    if (-not (Test-ApiHealth -Port $Ports[$state.active])) {
        if (Test-ApiHealth -Port $Ports[$otherColor]) {
            Write-BgLog "状态自愈:活跃色 $($state.active)($($Ports[$state.active])) 不可服务,另一色 $otherColor 健康 ⇒ 活跃色改写为 $otherColor" 'WARN'
            Write-BgStateAtomic -Active $otherColor
            $state = Read-BgState
        }
    }
}

# ── 1. 决定目标色 ────────────────────────────────────────────────────────────
$target = if ($Target -eq 'auto') { if ($state.active -eq 'blue') { 'green' } else { 'blue' } } else { $Target }
$oldColor = $state.active
$targetSvc = $Services[$target]
$targetPort = $Ports[$target]
$oldSvc = $Services[$oldColor]
$oldPort = $Ports[$oldColor]

Write-BgLog "当前活跃=$oldColor($oldPort) 目标=$target($targetPort) 服务=$targetSvc"

if ($target -eq $oldColor) {
    # 人工强制同色重启：此时没有第二色可承接，只能短暂中断（仅限运维显式指定）
    Write-BgLog "目标色与活跃色相同 ⇒ 退化为原地重启,期间 8802 会短暂 502" 'WARN'
}

# ── 2. 起目标色 ──────────────────────────────────────────────────────────────
Start-BgService -Name $targetSvc

# ── 3. 健康门禁 ──────────────────────────────────────────────────────────────
Write-BgLog "等待 $targetSvc 健康(:$targetPort,上界 ${HealthTimeoutSec}s)"
$healthy = $false
$deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
while ((Get-Date) -lt $deadline) {
    if (Test-ApiHealth -Port $targetPort) { $healthy = $true; break }
    Start-Sleep -Milliseconds 1500
}

if (-not $healthy) {
    Write-BgLog "$targetSvc 未能就绪 ⇒ 不切流,活跃仍是 $oldColor" 'ERROR'
    if ($target -ne $oldColor) { Stop-BgService -Name $targetSvc -TimeoutSec 20 }
    exit 1
}
Write-BgLog "$targetSvc 健康检查通过"

# ── 4. 原子切流 ──────────────────────────────────────────────────────────────
if ($target -ne $oldColor) {
    Write-BgStateAtomic -Active $target
    Write-BgLog "状态已切换 active=$target(router 1s 内生效)"
}

# ── 5. 排空 ──────────────────────────────────────────────────────────────────
if ($target -ne $oldColor) {
    if ($DrainSec -gt 0) {
        Write-BgLog "排空 ${DrainSec}s(旧色继续承接已建立连接)..."
        Start-Sleep -Seconds $DrainSec
    }
    # ── 6. 停旧色 ────────────────────────────────────────────────────────────
    Stop-BgService -Name $oldSvc
    Write-BgLog "切换完成:活跃=$target(:$targetPort) 旧色=$oldColor 已停止"
} else {
    Write-BgLog "原地重启完成:活跃=$target(:$targetPort)"
}

exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
