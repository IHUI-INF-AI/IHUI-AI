# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# ihui-deploy-loop.ps1 — push→自动部署的调度入口
#
# 两种运行形态:
#   ① 服务形态(推荐,本机现行): `pwsh -File ihui-deploy-loop.ps1 -Daemon`
#      由 nssm 服务 IHUI-DEPLOYLOOP 托管(SERVICE_AUTO_START),进程内每
#      IntervalSeconds 秒轮询一次;进程退出由 nssm 自动拉起。
#   ② 单次形态(兼容/手工验收): 不带 -Daemon,执行一轮后退出。
#
# 职责:
#   1. 并发锁(带 PID 存活检测):避免 daemon 与手工运行重叠
#   2. 调用 ihui-deploy.ps1(幂等:behind=0 直接优雅退出,不部署)
#   3. 全量输出落盘 deploy-loop.log,便于回看失败原因
#
# -----------------------------------------------------------------------------
# 2026-09-13 变更记录(实测):
#   [根因] 计划任务 IHUI-AutoDeploy(2026-09-07 注册)的 <Command> 元素被整体塞入
#     "命令行+引号"(值形如 `"C:\...\pwsh.exe -NoProfile ... -File "`),Task Scheduler
#     于是去启动一个并不存在的"可执行文件"→ 该任务自注册起**从未成功运行过一次**。
#     deploy-loop.log 里 09-07 那条是当时人工验收手跑的,不是任务跑的。
#   [为何不再修任务] 本机 Task Scheduler 三重不可用:
#     1. schtasks.exe 被安全策略列入程序黑名单,不可绕过;
#     2. ScheduledTasks 模块随 C:\Windows\System32\WindowsPowerShell\v1.0\Modules
#        一并消失(该目录已被 PS7 Core 文件覆盖,WinSxS 无副本),
#        Get-ScheduledTask / Register-ScheduledTask 均不可用;
#     3. Schedule 服务受保护,Stop/Restart 均 Access Denied,任务定义无法热重载。
#     → 改用本机既有惯例:nssm 服务承载周期性任务(参考 IHUI-GIT-GUARD / IHUI-MONITOR)。
#   [修复] $PROCESS_ID 并非 PowerShell 自动变量(正确名为 $PID)→ 旧代码写入的锁内容
#     恒为空 → 并发锁从未生效。已改为 $PID。
#   [加固] 显式解析 pwsh 全路径:SYSTEM 上下文 PATH 不含 PS7,裸 `pwsh` 会 command-not-found。
#   [加固] daemon 形态内层用 return 而非 exit,避免退出进程触发 nssm 重启风暴。
# =============================================================================
param(
    [switch]$Daemon,
    [int]$IntervalSeconds = 360
)

$ErrorActionPreference = 'Continue'   # 本层不因下层退出码中断,交给日志判定
$Root     = 'D:\IHUI-AI'
$WinDir   = Join-Path $Root 'deploy\win'
$LockFile = Join-Path $WinDir '.deploy-loop.lock'
$LogFile  = Join-Path $WinDir 'deploy-loop.log'

function LogLine { param([string]$m) ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }
function Log     { param([string]$m) Add-Content -Path $LogFile -Value (LogLine $m) }

# ── pwsh 解析(2026-09-13 加固,实测):SYSTEM 上下文 PATH 不含 PowerShell 7,
#    裸 `pwsh` 会 command-not-found → 循环静默哑火。必须 PS7 —— PS5.1 在本机缺
#    WindowsPowerShell\v1.0\Modules 目录,Invoke-WebRequest 等不可用,健康门禁必坏。
$PwshCandidates = @()
if ($PSVersionTable.PSEdition -eq 'Core') { $PwshCandidates += (Join-Path $PSHOME 'pwsh.exe') }
$PwshCandidates += 'C:\Program Files\PowerShell\7\pwsh.exe'
$g = Get-Command pwsh -ErrorAction SilentlyContinue
if ($g) { $PwshCandidates += $g.Source }
$PwshExe = $PwshCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $PwshExe) {
    Log "FAIL  未找到 pwsh(候选:$($PwshCandidates -join ','));ihui-deploy.ps1 依赖 PS7"
    exit 1
}

function Invoke-PollOnce {
    # ---- 1) 并发锁(带 PID 存活性检测,防悬挂锁) ----
    if (Test-Path $LockFile) {
        $pidIn = (Get-Content $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
        $alive = $false
        if ($pidIn -match '^\d+$') { $alive = $null -ne (Get-Process -Id ([int]$pidIn) -ErrorAction SilentlyContinue) }
        if ($alive) { Log "跳过:检测到进行中的部署 loop(pid=$pidIn)"; return }
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue   # 悬挂锁清理
    }
    $PID | Set-Content -Path $LockFile
    try {
        # ---- 2) 调真实部署脚本(不带 -deployLatest:落后才部署,behind=0 优雅退出) ----
        Log "———— 部署轮询开始 ————"
        $out = & $PwshExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $WinDir 'ihui-deploy.ps1') 2>&1
        foreach ($line in $out) { Log "[deploy] $line" }
        Log "———— 部署轮询结束(exit=$LASTEXITCODE) ————"
    } finally {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}

if ($Daemon) {
    Log "==== 部署守护启动(pid=$PID, interval=${IntervalSeconds}s, pwsh=$PwshExe) ===="
    while ($true) {
        Invoke-PollOnce
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Invoke-PollOnce
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
