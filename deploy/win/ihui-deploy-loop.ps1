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
#   4. **每轮墙钟预算($RunBudgetMin,默认 45 分钟)**:超预算即 taskkill /T 整树并按
#      失败记录 —— 2026-09-24 实测一轮在健康门禁里阻塞 20 分钟(CPU 两次采样恒为
#      32.359375s、日志停更),而子进程是以同步管道 `& pwsh … | ForEach-Object` 调起的,
#      它不返回则**整个守护永不进入下一轮 poll** ⇒ 此后所有提交都不再部署。
#      这与 ihui-deploy.ps1:552 那次「构建静默死亡 + 孤儿孙进程持管道 ⇒ 日志停更 7.5h」
#      是同一型故障,那一处已按"Start-Process 重定向到文件 + WaitForExit 墙钟 + taskkill"
#      根治,本层此前仍是无界等待,故照同一先例补齐。
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
    [int]$IntervalSeconds = 60,
    [int]$RunBudgetMin = 45          # 单轮墙钟预算:构建本身允许 30 分钟,留余量给门禁与重启
)

$ErrorActionPreference = 'Continue'   # 本层不因下层退出码中断,交给日志判定
$Root     = 'D:\IHUI-AI'
$WinDir   = Join-Path $Root 'deploy\win'
$LockFile = Join-Path $WinDir '.deploy-loop.lock'
$LogFile  = Join-Path $WinDir 'deploy-loop.log'

# ── 日志时间戳带时区(2026-09-21 根治):生产机时钟为 UTC,裸时间曾导致人工误判
#    「日志停更 7.5 小时」(实为 UTC)。一律带 +偏移,人眼可辨时区。
function LogLine { param([string]$m) ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'), $m) }
function Log     { param([string]$m) Add-Content -Path $LogFile -Value (LogLine $m) }

# ── 日志轮转(2026-09-21 根治):deploy-loop.log 只增不滚,两个月积到 53MB,排查时
#    -Tail 变慢且历史噪音淹没有效信息。每轮部署轮询前检查:超过 50MB 即重命名为
#    带时间戳归档,保留最近 5 份。Add-Content 每次按路径重新打开,轮转后自动建新
#    文件,无需重启守护;轮转异常只跳过,不影响部署。
$LogMaxBytes = 50MB
$LogKeep     = 5
function Invoke-LogRotate {
    try {
        if (-not (Test-Path $LogFile)) { return }
        if ((Get-Item $LogFile -ErrorAction Stop).Length -lt $LogMaxBytes) { return }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Move-Item $LogFile (Join-Path $WinDir "deploy-loop-$stamp.log") -Force
        Get-ChildItem (Join-Path $WinDir 'deploy-loop-*.log') -File -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -Skip $LogKeep |
            Remove-Item -Force -ErrorAction SilentlyContinue
        Log "日志已轮转: deploy-loop.log → deploy-loop-$stamp.log(保留最近 $LogKeep 份)"
    } catch {}
}

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
        # 流式落盘(2026-09-21 根治):旧写法 `$out = & pwsh ... 2>&1` 先在内存攒完子进程
        # 全部输出再统一落盘,部署全程(最长 30+ 分钟)日志零写入 —— 「日志停更」无法
        # 区分是故障还是正常构建中(本次事故排查的主要干扰源)。改管道逐行实时落盘。
        #
        # 但"管道逐行"仍是**无界等待**:2026-09-24 实测子进程在健康门禁里阻塞 20 分钟
        # (两次采样 CPU 恒为 32.359375s ⇒ 卡在 I/O 而非空转),守护因此永不进入下一轮 poll,
        # 此后所有提交都不再部署。故这一层改成"Start-Process 重定向到文件 + 增量尾读 +
        # 墙钟",既保住实时落盘,又给得出确定性收口 —— 与 ihui-deploy.ps1:552 那处构建的
        # 根治法同形(文件不依赖存活写者,天然免疫管道挂死)。
        # 落点**不得用 $env:TEMP**:服务身份是 LocalSystem,其 TEMP 是 C:\Windows\Temp
        # (HKCU 的 TEMP 迁移对它无效,§26 第四类真因),故显式落项目内并被 gitignore 的目录。
        $runDir  = Join-Path $Root '.ihui-agent\tmp\deploy-loop'
        $runOut  = Join-Path $runDir "run-$PID.out.log"
        $runErr  = Join-Path $runDir "run-$PID.err.log"
        New-Item -ItemType Directory -Path $runDir -Force -ErrorAction SilentlyContinue | Out-Null
        $child = $null
        $timedOut = $false
        try {
            $child = Start-Process -FilePath $PwshExe -ArgumentList @(
                '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $WinDir 'ihui-deploy.ps1')
            ) -NoNewWindow -PassThru -RedirectStandardOutput $runOut -RedirectStandardError $runErr
            $deadline = (Get-Date).AddMinutes($RunBudgetMin)
            $seen = 0L
            while ($true) {
                foreach ($f in @($runOut, $runErr)) {
                    if (-not (Test-Path $f)) { continue }
                    $len = (Get-Item $f).Length
                    if ($len -le $seen) { continue }
                    try {
                        $fs = [System.IO.File]::Open($f, 'Open', 'Read', 'ReadWrite')
                        $sr = New-Object System.IO.StreamReader($fs)
                        [void]$sr.BaseStream.Seek($seen, 'Begin')
                        while (-not $sr.EndOfStream) {
                            $line = $sr.ReadLine()
                            if ($null -ne $line) { Log "[deploy] $line" }
                        }
                        $seen = $sr.BaseStream.Position
                        $sr.Close(); $fs.Close()
                    } catch { Start-Sleep -Milliseconds 300 }   # 子进程正在写:下一轮再读
                }
                if ($child.HasExited) { break }
                if ((Get-Date) -gt $deadline) {
                    $timedOut = $true
                    Log "FAIL  本轮超墙钟预算 $RunBudgetMin 分钟,判挂死 → taskkill /T 整树(pid=$($child.Id))"
                    & taskkill /PID $child.Id /T /F 2>&1 | Out-Null
                    Start-Sleep -Seconds 3
                    break
                }
                Start-Sleep -Milliseconds 700
            }
            $global:LASTEXITCODE = if ($timedOut) { 124 } elseif ($null -ne $child -and $null -ne $child.ExitCode) { $child.ExitCode } else { 1 }
        } catch {
            Log "Start-Process 调起子部署脚本异常($($_.Exception.Message)),回退直调"
            & $PwshExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $WinDir 'ihui-deploy.ps1') 2>&1 |
                ForEach-Object { Log "[deploy] $_" }
        } finally {
            # §26:临时物用完必须删 —— 部署环每 60 秒一轮,不清就是每天数千个文件
            Remove-Item $runOut, $runErr -Force -ErrorAction SilentlyContinue
        }
        Log "———— 部署轮询结束(exit=$LASTEXITCODE) ————"
    } finally {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}

if ($Daemon) {
    Log "==== 部署守护启动(pid=$PID, interval=${IntervalSeconds}s, pwsh=$PwshExe) ===="
    while ($true) {
        Invoke-LogRotate
        Invoke-PollOnce
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Invoke-LogRotate
    Invoke-PollOnce
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
