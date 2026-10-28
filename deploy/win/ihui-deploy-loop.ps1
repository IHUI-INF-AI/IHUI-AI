# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
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
#   1. 并发锁(2026-09-26 重写判据):避免 daemon 与手工运行重叠。**不再只问"pid 在不在"**
#      —— 那一条在 2026-09-26 早上把这台机冻了 46 分钟(锁写下时的 pid 8052 重启后被
#      postgres.exe 复用 ⇒ `Get-Process -Id 8052` 恒真 ⇒ 每轮 return,零次部署)。
#      现判据四条同时成立才算"仍被持有",实现唯一出口在 `deploy-lock-common.ps1`
#      (与 ihui-deploy.ps1 共用同一份,禁止两处各写一遍 Get-Process)。
#      读者这一侧另有一条(G-208② 落地时补):判成陈旧之后,**先归档现场再删**,且
#      `Clear-IhuiDeployLockStale` 的返回值必须被看见 —— 它返回 $false 意味着"判定与
#      删除之间有人刚写下新锁",此时继续无条件写自己的锁就是把并发持有者盖掉。
#      取证入口:`-SelfTestScratch <临时目录>` 只跑这一段,不发起部署。
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
    [int]$RunBudgetMin = 45,         # 单轮墙钟预算:构建本身允许 30 分钟,留余量给门禁与重启
    # [2026-10-16 根治] 最小部署间隔(分钟):两次真实部署之间至少隔这么久,期间的新提交攒批,
    # 到点由下一轮轮询统一部署。旧形 behind>0 就立即部署,origin/main 持续推送时变成
    # "10-15 晚 9 次 + 次日晨 3 次、每 ~10 分钟一次完整重建+全服务重启",每次都制造
    # 公网 502/ERR 报警窗口(监控日志逐条可证)。手动 -deployLatest 不走本守护,不受节流。
    [int]$MinDeployIntervalMin = 30,
    # 取证通道:给定目录时**只**跑"锁处置"这一段并打印 JSON 结论,绝不发起部署、绝不碰
    # deploy\win\.deploy-loop.lock。由 deploy/tests/deploy-loop-lock-preemption.test.mjs 驱动。
    # 为什么入口在本文件而不是全放在夹具里:本票要证的是**本文件**拿到判据结论之后做的事
    # (让路 / 归档 / 抢占 / 不覆盖别人的新锁)。把这些搬进夹具另写一遍再测,测的是副本,
    # 而不是生产路径上真被执行的那几行(§22c"镜像只复读实现就是复读机"的反面)。
    [string]$SelfTestScratch = ''
)

$ErrorActionPreference = 'Continue'   # 本层不因下层退出码中断,交给日志判定

# ── 本进程输出编码 = UTF-8(G-305,2026-09-28)────────────────────────────────
# 与 ihui-deploy.ps1 同一型病灶的**另一半**:LocalSystem 上下文里
# `[Console]::OutputEncoding` 默认 gb2312(CP936)。子进程那一半已按"写的一侧定死
# UTF-8"修掉(它每轮被新起,下一轮即生效);本层这一半只管一件事,如实说清:
#   catch 里的兜底分支 `& $PwshExe … | ForEach-Object` 是**管道**形态 —— 子进程写、
#   本进程按 [Console]::OutputEncoding 解码,不设就是仍按 GBK 解(主路径走文件重定向 +
#   显式 UTF-8 StreamReader,不经过这一条)。
# 本层自己 Log 的中文行**不是**受害者(实测 2026-09-28 的 deploy-loop.log:
# 守护自己写的「———— 部署轮询开始 ————」逐字完好,而同一文件里所有 `[deploy]` 前缀
# (从子进程转写来的)行成串乱码)—— 因为脚本字面量由 PS7 按 UTF-8 读入,而
# Add-Content 在 PS7 默认就是 utf8NoBOM。写侧无需改,这里设编码只为把**读**的那一跳对齐。
# ⚠️ 生效时机:本文件由 IHUI-DEPLOYLOOP **服务进程在启动时一次性读进内存** ——
#    现读证据:该守护的 pwsh 进程 pid=10440 启动于 2026-09-26 11:09:10,而本文件本次
#    改动落盘于 2026-09-28 00:51 ⇒ 驻留的那份必然是改动前的脚本,**不重启不生效**。
#    重启会连带 api/web 换流(实测窗口内本地也拒连数秒),归机主择时,命令见文件末。
#    子进程那半(ihui-deploy.ps1)每轮从磁盘新起读取 ⇒ **下一轮部署即生效**,不必等重启;
#    这一句不是推测:三条姿势的实测见交付报告(仅子进程修好 ⇒ U+FFFD 已从 47 归 0)。
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
    Write-Warning 'WARN console-output-encoding NOT set to UTF-8 (takes effect only after service restart anyway)'
}

# ── 仓库根:自脚本位置推导 + $env:IHUI_ROOT 显式覆盖(2026-10-12 立)───────────
# 旧值把 $Root 写死为生产机盘符根(字面量),只在那台机器成立:同一份仓在开发机落
# G:\IHUI-AI,两端解析出两个根,看起来"不同步"(deploy 面 23 处同型写死,立因见
# ihui-root-common.ps1)。解析走该文件的**唯一出口**,与 ihui-deploy.ps1:66 共用
# 同一份实现,本文件不另写一遍向上爬目录的逻辑(判据唯一出口,同下方
# deploy-lock-common.ps1 立的规矩)。
# ⚠️ 生效时机与上面编码那段同一条:本文件由 IHUI-DEPLOYLOOP 服务进程启动时**一次性
#    读进内存,不重启不生效** —— 本次改根解析、以及日后改 $env:IHUI_ROOT 覆盖值,
#    都必须重启 IHUI-DEPLOYLOOP 才生效(子进程 ihui-deploy.ps1 那半是每轮新起,
#    下一轮即生效,但本层的 $Root/$LockFile/$LogFile 驻留内存不刷新)。
# helper 缺失必须大声死,不退回写死盘符继续跑(同下方 LockCommon 的规矩)。
$RootCommon = Join-Path $PSScriptRoot 'ihui-root-common.ps1'
if (-not (Test-Path -LiteralPath $RootCommon)) {
    Write-Host "FAIL  缺少仓库根解析实现:$RootCommon(部署环拒绝启动,不退回写死盘符)"
    exit 1
}
. $RootCommon
$Root     = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot
$WinDir   = Join-Path $Root 'deploy\win'
$LockFile = Join-Path $WinDir '.deploy-loop.lock'
$LogFile  = Join-Path $WinDir 'deploy-loop.log'

# ── 并发锁判据:与 ihui-deploy.ps1 **共用同一份实现**(deploy-lock-common.ps1)。
#    两处各写一遍 Get-Process 必然漂移,而漂移的代价就是再冻一次生产(AGENTS §12e 同型)。
#    找不到就大声死,不得退回"只看 pid 在不在"的旧判据继续跑 —— 那等于把本票的修复
#    变成一个静默失效的选项。$ErrorActionPreference 在本文件是 Continue,故必须显式判定。
$LockCommon = Join-Path $PSScriptRoot 'deploy-lock-common.ps1'
if (-not (Test-Path -LiteralPath $LockCommon)) {
    Write-Host "FAIL  缺少并发锁判据:$LockCommon(部署环拒绝启动,不退回旧判据)"
    exit 1
}
. $LockCommon

# ── 日志时间戳带时区(2026-09-21 根治):生产机时钟为 UTC,裸时间曾导致人工误判
#    「日志停更 7.5 小时」(实为 UTC)。一律带 +偏移,人眼可辨时区。
function LogLine { param([string]$m) ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'), $m) }
function Log     { param([string]$m) Add-Content -Path $LogFile -Value (LogLine $m) }

# ── 部署窗口(2026-10-26 立)──────────────────────────────────────────────────
# 子进程 ihui-deploy.ps1 负责写 start/phase/close;本环只做两件事:
#   ① 子进程长时间无输出时替活动窗口续心跳(否则监控 10 分钟判 Stale);
#   ② 子进程退出后兜底收口 —— 即使子进程漏掉某个退出路径,窗口也不会留在"部署中"永久抑制。
# 模块缺失只警告,不阻断部署(窗口是增强项;监控看到无状态文件会退回旧判据)。
$script:DeployWindowEnabled = $false
$script:DeployWindowFile = ''
$DeployWindowModule = Join-Path $PSScriptRoot 'deploy-window-common.ps1'
if (Test-Path -LiteralPath $DeployWindowModule) {
    . $DeployWindowModule
    $script:DeployWindowEnabled = $true
    $script:DeployWindowFile = Get-IhuiDeployWindowPath
} else {
    Log "WARN  缺少 deploy-window-common.ps1,部署窗口功能禁用(监控退回旧判据,部署不受影响)"
}

# ── 日志轮转(2026-10-13 改为 .N 顺移方案):deploy-loop.log 只增不滚,两个月积到
#    53MB,排查时 -Tail 变慢且历史噪音淹没有效信息。每轮部署轮询前检查:超过
#    $DeployLogMaxBytes 即顺移重命名 deploy-loop.log → .1,已有 .1 则依次 .1→.2
#    顺移,最多保留 $DeployLogKeep 份,最老的删除;不做 gzip(Windows 下
#    Compress-Archive 依赖多且轮转价值有限,纯改名即可)。Add-Content 每次按路径
#    重新打开,轮转后自动建新文件,无需重启守护。轮转落在每轮入口(非 Log 逐行
#    热路径),避免与流式转写抢锁;文件被占用时 Rename-Item 抛错 → 本轮跳过、
#    下轮再试,不抛错不中断部署主流程。
$DeployLogMaxBytes = 20MB
$DeployLogKeep     = 5
function Invoke-LogRotate {
    try {
        if (-not (Test-Path -LiteralPath $LogFile)) { return }
        if ((Get-Item -LiteralPath $LogFile -ErrorAction Stop).Length -lt $DeployLogMaxBytes) { return }
        $oldest = Join-Path $WinDir ("deploy-loop.log.{0}" -f $DeployLogKeep)
        if (Test-Path -LiteralPath $oldest) {
            Remove-Item -LiteralPath $oldest -Force -ErrorAction SilentlyContinue
        }
        for ($i = $DeployLogKeep - 1; $i -ge 1; $i--) {
            $src = Join-Path $WinDir ("deploy-loop.log.{0}" -f $i)
            if (Test-Path -LiteralPath $src) {
                Rename-Item -LiteralPath $src -NewName ("deploy-loop.log.{0}" -f ($i + 1)) -ErrorAction Stop
            }
        }
        Rename-Item -LiteralPath $LogFile -NewName 'deploy-loop.log.1' -ErrorAction Stop
        Log "日志已轮转: deploy-loop.log → deploy-loop.log.1(阈值 $DeployLogMaxBytes,保留 $DeployLogKeep 份)"
    } catch {
        # 被占用等瞬时原因:跳过本轮,下一轮再试;主流程不得中断
        return
    }
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

# ── 抢占前的"现场归档"(G-208② / 判据 3)────────────────────────────────────
# 为什么必须有它:抢占一把"判据说无主"的锁是**高危且不可逆**的动作,而判据本身可能
# 错(CIM 读不到启动时刻、时钟被调过、别人用旧格式写了锁)。删完之后如果没人能回答
# "当时锁里到底写着什么、凭什么抢",这次抢占在账面上就等于没发生过 —— 与本仓"失败
# 必须响 / 不得把没判写成判过了"(§5e、守门 118)是同一条禁令。
# 落点刻意选在**已被 .gitignore 忽略的项目内目录**(`.ihui-agent/*` 第 163 行):
#   · 不落 $env:TEMP —— 服务身份是 LocalSystem,其 TEMP 是 C:\Windows\Temp(§26 第四类真因);
#   · 不落 deploy\win\ —— 那会把只存在于部署机的运行台账塞进 `git status`,下一轮
#     不带 pathspec 的提交就可能把它打包入库(§12 污染型);
#   · 也不走 gitArchiveDir() 口径 —— 本文件是**部署机运行态**脚本,那把出口是 git 现场
#     归档用的(§5b/§15b),两类东西混在一个桶里会让"这是仓库现场还是运维台账"分不清。
# 只留最近 $StaleArchiveKeep 份:deploy-loop.log 曾因"只增不滚"两个月积到 53MB(见上),
# 同一型错误不在新目录上再犯一次。
$StaleArchiveKeep = 20
function Save-IhuiStaleLockSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][psobject]$State,
        [string]$ArchiveDir = '',
        [scriptblock]$Logger
    )
    if (-not $ArchiveDir) {
        $ArchiveDir = Join-Path (Join-Path $Root '.ihui-agent\tmp\deploy-loop') 'stale-lock-archive'
    }
    $emit = { param($m) if ($Logger) { & $Logger $m } else { Write-Host $m } }
    try {
        if (-not (Test-Path -LiteralPath $ArchiveDir)) {
            New-Item -ItemType Directory -Path $ArchiveDir -Force -ErrorAction Stop | Out-Null
        }
        # 原样字节:归档件的价值在于"删掉的那一刻文件里写着什么",包括别人手改过的
        # 半截 JSON —— 那正是 C0 判不出的现场,解析后再写就把它抹平了。
        $raw = $null
        if (Test-Path -LiteralPath $Path) {
            $raw = [string](Get-Content -LiteralPath $Path -Raw -ErrorAction Stop)
        }
        $m = $State.Meta
        $snap = [ordered]@{
            archivedAtUtc = ([DateTime]::UtcNow).ToString('o')
            lockPath      = $Path
            verdict       = $State.Verdict
            failed        = $State.Failed
            reason        = $State.Reason
            checks        = $State.Checks
            # 三项读数写在这里,是为了让归档件**自己**能回答"凭什么抢",不依赖去翻日志
            readings = [ordered]@{
                pid          = $m.Pid
                ownerKind    = $m.OwnerKind
                metaKind     = $m.Kind
                writtenAt    = $(if ($null -ne $m.WrittenAtUtc) { Format-IhuiLockUtc $m.WrittenAtUtc } else { '' })
                heartbeatAt  = $(if ($null -ne $m.HeartbeatAtUtc) { Format-IhuiLockUtc $m.HeartbeatAtUtc } else { '' })
                bootId       = $m.BootId
                fileMtimeUtc = $(if ($null -ne $m.FileAgeUtc) { $m.FileAgeUtc.ToString('o') } else { '' })
            }
            rawContent = $raw
        }
        $stamp = ([DateTime]::UtcNow).ToString('yyyyMMdd-HHmmss-fff')
        $dest = Join-Path $ArchiveDir ("stale-lock-{0}-{1}.json" -f $stamp, $PID)
        [System.IO.File]::WriteAllText($dest, ($snap | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
        Get-ChildItem -LiteralPath $ArchiveDir -Filter 'stale-lock-*.json' -File -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -Skip $StaleArchiveKeep |
            Remove-Item -Force -ErrorAction SilentlyContinue
        & $emit ("陈旧锁现场已归档:$dest(判定 {0} / 失败项 {1})" -f $State.Verdict, $(if ($State.Failed) { $State.Failed } else { '-' }))
        return $true
    } catch {
        # 归档失败**不**改变判据结论,但必须喊出来:静默删掉一把被判陈旧的锁 = 事后无从复核
        & $emit ("WARN  陈旧锁现场归档失败:{0} —— 仍按判据处置,但本轮日志必须能回答凭什么抢" -f $_.Exception.Message)
        return $false
    }
}

# ── 一轮的锁处置(唯一入口;取证走这里,不走整条部署链)──────────────────────
# 返回 $true = 本轮已持有锁,可以部署;$false = 本轮让路(调用方直接 return)。
# 三条"让路"分支的共同点:**抢错的代价是两个 next build 并发写 .next,漏一轮的代价
# 只是 60 秒后再来一次** —— 失效方向恒定向"少抢一把"倾斜(判据 1)。
function Enter-IhuiLoopLock {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [scriptblock]$Logger,
        [string]$ArchiveDir = ''
    )
    if (-not $Logger) { $Logger = { param($m) Log $m } }
    $st = Resolve-IhuiDeployLockState -Path $Path -OwnerKind 'loop'
    if ($st.LockExists) {
        if ($st.ShouldHold) {
            # held 与 undetermined 都让路:后者是"判不出",抢锁的代价是并发构建,
            # 而让路的代价只是一轮不部署(下一轮再判,且锁龄超绝对上限后会自行清理)。
            & $Logger "跳过:锁仍被持有或判不出,本轮让路 —— $(Format-IhuiDeployLockState -State $st)"
            return $false
        }
        # 判据认定无主 ⇒ 先留现场,再删(顺序不可反:删完就没有"当时写着什么"可归档了)
        [void](Save-IhuiStaleLockSnapshot -Path $Path -State $st -ArchiveDir $ArchiveDir -Logger $Logger)
        $cleared = Clear-IhuiDeployLockStale -Path $Path -State $st -Logger $Logger
        if (-not $cleared) {
            # Clear 内部有一道同一性复核:判定与删除之间锁被换过 ⇒ 取消删除并返回 $false。
            # 旧写法不看返回值、紧接着无条件 Write-IhuiDeployLock ⇒ 会把那个**刚写下新锁的
            # 并发持有者**整份盖掉,两个构建同时写 .next —— 这把锁存在的全部理由被自己拆掉。
            # 这一格在改判据那天就存在,只是没人让机器问过它(与"判据在位而无人调度"同型)。
            & $Logger "跳过:陈旧锁未删成(判定之后锁内容已被换 ⇒ 可能有并发持有者刚写下新锁),本轮让路、不覆盖它"
            return $false
        }
    }
    if (-not (Write-IhuiDeployLock -Path $Path -OwnerKind 'loop')) {
        & $Logger "FAIL  并发锁写下失败($Path),本轮不部署(宁可漏一轮,不可并发构建)"
        return $false
    }
    return $true
}

# [2026-10-16 根治] 节流锚:最近一次"真实部署完成"的时刻。仅在本守护进程内存中维护,
# 守护重启即清零(首轮不节流)。只认子脚本输出里的 "部署完成,HEAD=" 行 —— behind=0
# 优雅退出、构建失败都不刷新锚点,否则节流会把"没部署过"误判成"刚部署过"。
$script:LastDeployDoneAt = $null
# 本轮真实上线的 sha(从同一行 HEAD= 捕获),金丝雀决策台账按它绑定"哪一枚包被观察过"。
$script:LastDeploySha = ''

# =============================================================================
# 金丝雀观察窗(O65 第 2 期「上线闭环」,2026-10-26 立)
#
# 补的是健康门禁答不出的那一格:门禁只回答"切流那一刻三项是否真绿",回答不了
#  ① 新版本相对**上一版**有没有回归(错误率抬了、P95 慢了);
#  ② 切流后持续几十秒里还稳不稳。
# 本函数在子部署脚本成功退出后跑一个观察窗:先采候选(新版),与上一轮通过时留下的
# 基线(旧版实测)按 scripts/data/canary-policy.json 的阈值比对;fail ⇒ 立即调
# ihui-deploy.ps1 -rollbackOnly 退回上一可用包;unknown ⇒ 只喊不回滚(没证据不动手)。
#
# 边界(刻意,不得放宽):
#  ① 判据只在 scripts/canary-verdict.mjs(纯函数 + 唯一策略文件);本函数只做调度与记账,
#     不在这里写第二份阈值或"什么算异常";
#  ② 判定只用源站直探(127.0.0.1):公网腿经 Cloudflare,一次隧道抖动就会把好构建判坏,
#     等于给发布链加一道恒红门(§12e,与 Test-HealthGate 的 entry-broken 同一条理由);
#  ③ 记账复用 scripts/deploy-decision.mjs 的唯一构造/追加实现(--record-decision),
#     本文件不手拼台账 JSON;记账失败只喊,不改"是否回滚";
#  ④ 返回值 = "本轮是否已经自动回滚"。为 $true 时调用方**不得**再刷绿色态 ——
#     子脚本已经打过「部署完成」,但观察窗把它撤了,绿色态必须跟着撤。
#  ⑤ 逃生舱:IHUI_DEPLOY_CANARY=0 时只跳过观察窗(不采样、不回滚),并在日志点名。
#  ⑥ 灰度分流(O65 第 2 期,2026-10-28 装车)在本函数尾部接线:档位/比例/槽位端口一律
#     经 scripts/canary-traffic.mjs 与 deploy/win/ihui-canary-stage.mjs 从
#     scripts/data/canary-policy.json 派生,进程动作在 deploy/win/ihui-canary-gray.ps1,
#     本层不写第二个数字。这一段有没有真接上,由只读尺子
#     deploy/win/ihui-canary-wiring.mjs --check 判(镜像 deploy/tests/ihui-canary-wiring.test.mjs)。
# =============================================================================
function Invoke-CanaryGate {
    param([Parameter(Mandatory = $true)][string]$Node)
    if ("$($env:IHUI_DEPLOY_CANARY)".Trim() -eq '0') {
        Log "CANARY 跳过(IHUI_DEPLOY_CANARY=0):本轮不采观察窗,也不据此回滚"
        return $false
    }
    $scriptPath = Join-Path $Root 'scripts\canary-verdict.mjs'
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Log "CANARY 未判定:$scriptPath 不存在 ⇒ 不采样、不回滚(部署本身已完成,但观察窗这一格没被看过)"
        return $false
    }
    $policyPath = Join-Path $Root 'scripts\data\canary-policy.json'
    if (-not (Test-Path -LiteralPath $policyPath)) {
        Log "CANARY 未判定:策略文件 $policyPath 不存在 ⇒ 不采样、不回滚(判据缺失不回落默认值)"
        return $false
    }
    $stateDir = Join-Path $Root '.ihui-agent\state\canary'
    try { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null } catch {
        Log "CANARY 未判定:样本目录写不了($stateDir):$_"
        return $false
    }
    $ledger = Join-Path $Root '.ihui-agent\deploy-decisions.jsonl'
    $baseline = Join-Path $stateDir 'last-good.jsonl'
    $candidate = Join-Path $stateDir ("candidate-{0}.jsonl" -f (Get-Date).ToString('yyyyMMdd-HHmmss'))

    # ── 灰度分流接线(O65 第 2 期「灰度分流」,2026-10-28 装车)─────────────────────
    # 这一段只做三件事:① 问出"当前档位"、② 让分流器/灰度实例真在位、③ 把本轮判定结论
    # 喂回档位推进。档位表、比例、槽位端口、桶口径**一律来自 scripts\data\canary-policy.json**
    # (经 scripts/canary-traffic.mjs 与 deploy/win/ihui-canary-stage.mjs 派生),本层一个数字
    # 都不写(§0.6 单一真相源;判据尺子 = deploy/win/ihui-canary-wiring.mjs W7)。
    # 任一件缺位 ⇒ 只喊 "GRAY 未判定" 并退回按现网端点观察:既不冒绿说"已分流",也不让
    # 分流这一格反过来摘掉既有回滚能力(§0.3 + §12e)。
    $grayStageCli = Join-Path $WinDir 'ihui-canary-stage.mjs'
    $grayTrafficCli = Join-Path $Root 'scripts\canary-traffic.mjs'
    $grayPs1 = Join-Path $WinDir 'ihui-canary-gray.ps1'
    $rampPath = Join-Path $stateDir 'ramp.json'
    $grayPolicyPath = Join-Path $stateDir 'gray-policy.json'
    $samplePolicy = $policyPath
    $grayStage = 'off'
    $graySampledFrom = 'stable'
    $splitUp = $false
    $canaryUp = $false
    if (-not ((Test-Path -LiteralPath $grayStageCli) -and (Test-Path -LiteralPath $grayTrafficCli) -and (Test-Path -LiteralPath $grayPs1))) {
        Log 'GRAY 未判定:分流件不在位(stage/traffic/gray 三件齐才动)⇒ 本轮不分流,观察窗仍按现网端点判'
    } elseif (-not $script:LastDeploySha) {
        Log 'GRAY 未判定:本轮部署 sha 取不到 ⇒ 不起始灰度契约(不知道给哪一枚构建放量)'
    } else {
        # 1) 当前档位:只问契约,不在这里解释比例
        $stOut = (& $Node $grayStageCli --status --contract $rampPath 2>&1 | Out-String)
        $stStage = ''
        $stSha = ''
        try {
            $stDoc = ConvertFrom-Json $stOut
            $stStage = [string]$stDoc.stage
            $stSha = [string]$stDoc.contract.deploySha
        } catch { Log "GRAY 未判定:契约状态读不出($stOut)" }
        if ($stStage) { $grayStage = $stStage.Trim() }
        # 契约缺失、或契约属于另一枚构建 ⇒ 从档位表**最小档**重新起步(比例由策略给,本层不填数)
        if ((-not $stSha) -or ($stSha -ne [string]$script:LastDeploySha)) {
            $inOut = (& $Node $grayStageCli --init --sha ([string]$script:LastDeploySha) --contract $rampPath 2>&1 | Out-String)
            foreach ($ln in ($inOut -split "`r?`n")) { if ($ln.Trim()) { Log ("  [gray] {0}" -f $ln.Trim()) } }
            if ($LASTEXITCODE -ne 0) {
                Log "GRAY 未判定:起始契约写不下(rc=$LASTEXITCODE)⇒ 本轮不分流"
                $grayStage = 'off'
            } else {
                try { $grayStage = [string]((ConvertFrom-Json $inOut).contract.stage) } catch { $grayStage = 'off' }
                Log "GRAY 起始档位=$grayStage(sha=$($script:LastDeploySha),比例取自 canary-policy.json)"
            }
        } else {
            Log "GRAY 当前档位=$grayStage(契约沿用同一枚 sha)"
        }
        # 2) 进程编排:-SplitOnly = 灰度实例无产物时也要让契约有一个真进程消费
        #    (分流器自带"灰度槽位不在位 ⇒ 回落 stable",永远不会把请求打到空端口)
        $gpOut = (& $PwshExe -NoProfile -ExecutionPolicy Bypass -File $grayPs1 -Action start -SplitOnly -Sha ([string]$script:LastDeploySha) -StateDir $stateDir 2>&1 | Out-String)
        foreach ($ln in ($gpOut -split "`r?`n")) { if ($ln.Trim()) { Log ("  [gray] {0}" -f $ln.Trim()) } }
        $splitUp = ($LASTEXITCODE -eq 0)
        $canaryUp = ($gpOut -match 'GRAY-CANARY\s+up')
        if (-not $splitUp) {
            Log "GRAY 未判定:分流器起不来(rc=$LASTEXITCODE)⇒ 本轮不分流,观察窗仍按现网端点判"
        } elseif ($canaryUp -and ($grayStage -ne 'off')) {
            # 3) 灰度实例真在位 ⇒ 采样目标改指灰度槽位,观察窗量的就是候选本身
            $dgpOut = (& $Node $grayTrafficCli --gray-policy --stage $grayStage --out $grayPolicyPath 2>&1 | Out-String)
            if (($LASTEXITCODE -eq 0) -and (Test-Path -LiteralPath $grayPolicyPath)) {
                $samplePolicy = $grayPolicyPath
                $graySampledFrom = 'canary'
                Log "GRAY 采样目标=灰度槽位(档位 $grayStage;策略由 canary-policy.json 派生,本层不写端口)"
            } else {
                foreach ($ln in ($dgpOut -split "`r?`n")) { if ($ln.Trim()) { Log ("  [gray] {0}" -f $ln.Trim()) } }
                Log 'GRAY 未判定:灰期策略派生失败 ⇒ 本轮仍按现网端点采样(不猜端口、不猜比例)'
            }
        } else {
            Log 'GRAY 分流器在位而灰度实例不在位 ⇒ 本轮按现网端点观察;契约仍由分流器消费(灰度槽位不健康即回落 stable)'
        }
    }

    Log ("CANARY 观察窗开始(源站直探量错误率/P95;采样面={0};样本={1})" -f $graySampledFrom, $candidate)
    $sampleOut = (& $Node $scriptPath --sample --policy $samplePolicy --stage candidate --out $candidate 2>&1 | Out-String)
    $sampleRc = $LASTEXITCODE
    foreach ($ln in ($sampleOut -split "`r?`n")) { if ($ln.Trim()) { Log "  [canary] $($ln.Trim())" } }
    if ($sampleRc -ne 0) {
        Log "CANARY 未判定:采样失败(rc=$sampleRc)⇒ 不回滚,也不冒充通过"
        return $false
    }
    $dArgs = @($scriptPath, '--decide', '--policy', $samplePolicy, '--candidate', $candidate, '--json', '--record-decision', '--deploy-sha', $script:LastDeploySha, '--ledger', $ledger)
    # 首次运行没有基线 ⇒ 只按绝对阈值判(判断器内部如实记"无基线",本层不补默认值)。
    if (Test-Path -LiteralPath $baseline) { $dArgs += @('--baseline', $baseline) }
    $dOut = (& $Node @dArgs 2>&1 | Out-String)
    $dRc = $LASTEXITCODE
    foreach ($ln in ($dOut -split "`r?`n")) { if ($ln.Trim()) { Log "  [canary] $($ln.Trim())" } }

    # ── 判定结论 → 档位推进(pass/fail/unknown 三态由 rc 现算,阈值判据不在这层)──────
    # fail ⇒ 契约比例归零 = 撤灰度流量(先于整包回滚:先把请求从候选身上拿走,再退包);
    # unknown ⇒ 原地不动(不放量也不回滚);pass ⇒ 升一档,末档再 pass ⇒ promote(可全量)。
    $verdictWord = if ($dRc -eq 0) { 'pass' } elseif ($dRc -eq 3) { 'fail' } else { 'unknown' }
    if ($splitUp -or ($grayStage -ne 'off')) {
        if (Test-Path -LiteralPath $grayStageCli) {
            $advOut = (& $Node $grayStageCli --decide --verdict $verdictWord --current $grayStage --sha ([string]$script:LastDeploySha) --contract $rampPath 2>&1 | Out-String)
            foreach ($ln in ($advOut -split "`r?`n")) { if ($ln.Trim()) { Log ("  [gray] {0}" -f $ln.Trim()) } }
            if ($LASTEXITCODE -ne 0) {
                Log "GRAY 未判定:档位推进没判出(rc=$LASTEXITCODE)⇒ 契约保持本轮读到的档位,不猜"
            } else {
                try {
                    $advDoc = ConvertFrom-Json $advOut
                    Log ("GRAY 动作={0} 新档位={1} 比例={2}%(取自 canary-policy.json) 依据={3}" -f `
                            $advDoc.action, $advDoc.stage, $advDoc.percent, $advDoc.reason)
                } catch { Log 'GRAY 未判定:档位推进结论解析不出 ⇒ 不据此放量' }
            }
        }
    }

    if ($dRc -eq 0) {
        if ($graySampledFrom -eq 'canary') {
            # 灰度期放量未完:基线必须是"现网实测",不能拿灰度槽位的样本充当基线(否则下一轮
            # 拿候选跟自己比,回归判据自己漂);.rollback 同理保留 —— 它是撤灰度的退路。
            Log "CANARY 通过(灰度槽位实测)⇒ 档位可进;基线与回滚点保持现网那份,不更新"
            return $false
        }
        # 放量完成:候选样本就是"当前在线版本"的实测 ⇒ 升为下一轮基线(滚动基线),
        # 然后摘掉本轮回滚点。删除权归本层(子脚本成功分支已不再删,否则这里判死时无包可退);
        # 下一轮部署的备份步也会整份替换它,所以"多留一会儿"不会累积多份。
        try { Copy-Item -LiteralPath $candidate -Destination $baseline -Force } catch { Log "CANARY 基线未更新(不影响放量):$_" }
        try { Remove-Item (Join-Path $Root 'apps\web\.rollback') -Recurse -Force -ErrorAction SilentlyContinue } catch {}
        Log "CANARY 通过 ⇒ 放量完成(错误率/P95 未超策略阈值,候选样本已升为下一轮基线)"
        return $false
    }
    if ($dRc -eq 3) {
        # 先撤灰度(停分流器与灰度实例;契约已被 --decide 归零),再退整包。
        # 顺序反了就是"包退完了,分流器还按老契约把请求往已经拆掉的候选槽位上送"。
        if ((Test-Path -LiteralPath $grayPs1) -and ($splitUp -or ($grayStage -ne 'off'))) {
            $stopOut = (& $PwshExe -NoProfile -ExecutionPolicy Bypass -File $grayPs1 -Action stop -StateDir $stateDir 2>&1 | Out-String)
            foreach ($ln in ($stopOut -split "`r?`n")) { if ($ln.Trim()) { Log ("  [gray] {0}" -f $ln.Trim()) } }
            Log "GRAY 已撤灰度(-Action stop;契约比例归零)"
        }
        Log "CANARY 异常 ⇒ 自动回滚(调 ihui-deploy.ps1 -rollbackOnly -CanaryRollback 退回上一可用包)"
        # -CanaryRollback 让子脚本按 canary-rollback 记账并发告警:本守护进程里**没有**
        # Invoke-FailNotify(它只活在 ihui-deploy.ps1),在这里直调只会抛"命令不存在"被 catch 吞掉 ——
        # 看起来发过信,实际零投递(2026-10-26 现读发现),故告警一律留在子脚本那一条唯一出口。
        # 子脚本只有 -rollbackOnly 成功才 exit 0;失败走 Fail(自己发信)并 exit 非 0。
        $rbOut = (& $PwshExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $WinDir 'ihui-deploy.ps1') -rollbackOnly -CanaryRollback 2>&1 | Out-String)
        $rbRc = $LASTEXITCODE
        foreach ($ln in ($rbOut -split "`r?`n")) { if ($ln.Trim()) { Log "  [rollback] $($ln.Trim())" } }
        if ($rbRc -ne 0) {
            Log "FAIL  金丝雀自动回滚失败(rc=$rbRc)⇒ 需人工介入,绿色态不得刷新"
            return $true
        }
        Log "OK    金丝雀自动回滚完成,旧版本重新在线(告警与 canary-rollback 记账由子脚本出口完成)"
        return $true
    }
    Log "CANARY 未判定(rc=$dRc)⇒ 不回滚、不冒充通过;下一轮部署会重新观察"
    return $false
}

function Invoke-PollOnce {
    # ---- 0) 最小部署间隔节流(2026-10-16 根治,见 param 注) ----
    # 放在拿锁之前:被节流的本轮不 fetch、不部署、不碰锁,60 秒后下一轮再看。
    # 攒批语义:节流期间到达的提交不会丢,间隔一到,下一轮轮询统一部署。
    if ($null -ne $script:LastDeployDoneAt) {
        $elapsed = ((Get-Date) - $script:LastDeployDoneAt).TotalMinutes
        if ($elapsed -lt $MinDeployIntervalMin) {
            Log ("[loop] 距上次部署完成 {0:N1} 分钟 < 最小间隔 {1} 分钟,本轮跳过(攒批,等下一轮)" -f $elapsed, $MinDeployIntervalMin)
            return
        }
    }
    # ---- 1) 并发锁(四条判据同时成立才算持有;见 deploy-lock-common.ps1) ----
    # 旧实现在这里只有一句 `Get-Process -Id $pidIn` 的存活判断,pid 复用即恒真。
    if (-not (Enter-IhuiLoopLock -Path $LockFile)) { return }
    try {
        # ---- 1b) 自进化 P0 前置闸(O65 O6501/O6502,2026-10-25 立)----
        # 两道闸都是 fail-closed:取不到判据 ⇒ 本轮不部署,绝不回落成"没改动所以放行"(§0.3)。
        #   ① 根护栏(root-guard --check):守门执行器/判据单一真源/AGENTS 铁律段被改动且无人工解锁 ⇒ 拒推进;
        #   ② 成本熔断(cost-breaker --check --kind deploy):滚动窗口内部署次数/墙钟超限 ⇒ 软停机(exit 3),留响声非故障。
        # node 在服务上下文(LocalSystem)的 PATH 里常常取不到,故按绝对路径兜底(与 ihui-deploy.ps1 Resolve-NodeExe 同源)。
        $guardNode = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
        if (-not $guardNode) {
            foreach ($np in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
                if (Test-Path -LiteralPath $np) { $guardNode = $np; break }
            }
        }
        if (-not $guardNode) {
            Log "FAIL  自进化前置闸:node.exe 取不到 ⇒ 根护栏/成本熔断判不了,本轮不部署(fail-closed)"
            return
        }
        $rgOut = (& $guardNode (Join-Path $Root 'scripts\root-guard.mjs') --check 2>&1 | Out-String)
        $rgRc = $LASTEXITCODE
        if ($rgRc -ne 0) {
            Log "FAIL  根护栏未通过(rc=$rgRc)⇒ 本轮不部署(fail-closed;人工复核后 node scripts/root-guard.mjs --seal --reason `"...`")"
            foreach ($ln in ($rgOut -split "`r?`n")) { if ($ln.Trim()) { Log "  $ln" } }
            return
        }
        $cbOut = (& $guardNode (Join-Path $Root 'scripts\cost-breaker.mjs') --check --kind deploy 2>&1 | Out-String)
        $cbRc = $LASTEXITCODE
        if ($cbRc -eq 3) {
            Log "PAUSE 成本熔断:部署额度已耗尽 ⇒ 本轮停转(软停机,下一轮再看;放量属人工阀 budget-cap-change)"
            foreach ($ln in ($cbOut -split "`r?`n")) { if ($ln.Trim()) { Log "  $ln" } }
            return
        }
        if ($cbRc -ne 0) {
            Log "FAIL  成本熔断判不了(rc=$cbRc)⇒ 本轮不部署(fail-closed)"
            foreach ($ln in ($cbOut -split "`r?`n")) { if ($ln.Trim()) { Log "  $ln" } }
            return
        }
        $roundStart = Get-Date
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
            # 仅用于挂死时点名"当时在跑哪一段"(2026-09-27 加,只加打印,不改判定与阈值)。
            # 旧措辞只有 pid,日志一停没人知道卡在哪;子进程自己每段都打一行(构建尝试 i/N、
            # 交换 staging、GATE-ITER i/N …),把最后收到的那条带下来即可,不需要新增 IPC。
            $lastLine = ''
            while ($true) {
                foreach ($f in @($runOut, $runErr)) {
                    if (-not (Test-Path $f)) { continue }
                    $len = (Get-Item $f).Length
                    if ($len -le $seen) { continue }
                    try {
                        $fs = [System.IO.File]::Open($f, 'Open', 'Read', 'ReadWrite')
                        # 编码**写死 UTF-8**,不再用 `StreamReader($fs)` 的默认值(G-305):
                        # 默认档在 .NET 里就是 UTF-8,但"靠默认"意味着任何宿主差异
                        # (Console/环境回落到 CP936)都会把这一跳静默变成二次损坏 ——
                        # deploy-loop.log 里那 129 处 U+FFFD 就是这种"两侧各自默认、中间没人对齐"的产物。
                        # detectEncodingFromByteOrderMarks=$true:万一有人手工补了 BOM,它被吃掉而不是落进日志。
                        # 已知残留(如实登记,本票不顺手改):增量尾读按"当前文件长度"截,
                        # 若子进程恰好把一个多字节字符写到一半就 flush,这一拍会解出 U+FFFD。
                        # 触发条件:日志里出现**成对的** U+FFFD 且下一拍没有重复该字符(即字符被吃掉而非重放);
                        # 修法是把 $seen 退到最后一个 0x0A(只解完整行),不要改成"整文件重读"。
                        $sr = New-Object System.IO.StreamReader($fs, [System.Text.UTF8Encoding]::new($false), $true)
                        [void]$sr.BaseStream.Seek($seen, 'Begin')
                        while (-not $sr.EndOfStream) {
                            $line = $sr.ReadLine()
                            if ($null -ne $line) {
                                Log "[deploy] $line"
                                if ($line.Trim()) { $lastLine = $line }
                                # [2026-10-16 根治] 只认真实部署完成的标志行刷新节流锚
                                # (ihui-deploy.ps1 健康门禁通过后打印;失败/behind=0 不含此行)。
                                # 同一行顺带取上线 sha(O65 第 2 期金丝雀记账用):与完成锚同源,
                                # 不去另跑 git rev-parse(那会在子进程退出后再读一次 HEAD,可能已被并发提交换掉)。
                                # 取到的原文直接交给判据模块做形状校验:读不出时会记成 undetermined(…),不冒充空。
                                if ($line -match '部署完成,HEAD=') {
                                    $script:LastDeployDoneAt = Get-Date
                                    $script:LastDeploySha = (($line -split '部署完成,HEAD=', 2)[1] -replace '\s+活跃组=.*$', '').Trim()
                                }
                            }
                        }
                        $seen = $sr.BaseStream.Position
                        $sr.Close(); $fs.Close()
                    } catch { Start-Sleep -Milliseconds 300 }   # 子进程正在写:下一轮再读
                }
                if ($child.HasExited) { break }
                # 心跳:判据 C4 要求持有者在长任务里持续续心跳,否则 45 分钟后锁会被
                # 下一轮(或手工部署)判陈旧并抢占。构建一轮实测 2-3 分钟、门禁曾阻塞 20 分钟,
                # 上限 45 分钟的推导见 deploy-lock-common.ps1 头注。函数内部按 15s 节流,
                # 所以这里每拍(≈700ms)调用只多做一次"要不要写盘"的判断。
                Update-IhuiDeployLockHeartbeat -Path $LockFile -OwnerKind 'loop' | Out-Null
                # 窗口心跳:子进程构建时可能长时间不输出,不续就会被监控判 Stale。
                # RunId 留空 = 续当前活动窗口;模块内部按 15s 节流。
                if ($script:DeployWindowEnabled) {
                    Update-IhuiDeployWindowHeartbeat -Path $script:DeployWindowFile -MinIntervalSeconds 15 | Out-Null
                }
                if ((Get-Date) -gt $deadline) {
                    $timedOut = $true
                    Log "FAIL  本轮超墙钟预算 $RunBudgetMin 分钟,判挂死 → taskkill /T 整树(pid=$($child.Id))"
                    # 只加打印:把"卡在哪一段"写进日志。子进程输出经 LocalSystem 管道后中文
                    # 已损坏成 U+FFFD(实测 deploy-loop.log),所以这里只保留可打印 ASCII ——
                    # 判段用的恰好都是 ASCII 骨架(GATE-ITER / GATE-ITER-STALLED / .next-staging /
                    # HEAD= / behind=0),中文丢了不影响定位,反而多一行噪音。
                    $stage = if ($lastLine) { $lastLine } else { '<none>' }
                    $stage = ($stage -replace '[^\x20-\x7E]', '?')
                    if ($stage.Length -gt 160) { $stage = $stage.Substring(0, 160) }
                    Log "FAIL  挂死时子进程最后一条输出 last-stage=$stage"
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
                ForEach-Object {
                    # 这一支是无界等待(异常兜底路径),更要保持心跳:它可能长时间只有零星
                    # 输出行,不续心跳就会被 C4 判陈旧 ⇒ 与正常轮并发构建。
                    Update-IhuiDeployLockHeartbeat -Path $LockFile -OwnerKind 'loop' | Out-Null
                    if ($script:DeployWindowEnabled) {
                        Update-IhuiDeployWindowHeartbeat -Path $script:DeployWindowFile -MinIntervalSeconds 15 | Out-Null
                    }
                    Log "[deploy] $_"
                }
        } finally {
            # §26:临时物用完必须删 —— 部署环每 60 秒一轮,不清就是每天数千个文件
            Remove-Item $runOut, $runErr -Force -ErrorAction SilentlyContinue
        }
        $roundRc = $LASTEXITCODE
        $roundMinutes = [Math]::Round(((Get-Date) - $roundStart).TotalMinutes, 2)
        # 「本轮确实部署完成」的唯一判据:子进程打出「部署完成,HEAD=」且 exit=0,
        # 完成时刻不早于本轮开始(排掉"上一轮的完成标记被本轮 behind=0 误读成自己的战果")。
        # 金丝雀观察窗与绿色态都只在这一个判据成立时才有意义。
        $deployDoneThisRound = ($roundRc -eq 0 -and $null -ne $script:LastDeployDoneAt -and $script:LastDeployDoneAt -ge $roundStart)
        # ---- 部署窗口兜底收口(2026-10-26 立)----
        # 子进程自己写 success/failed/rolledback/noop;这里只处理"它漏了某个退出路径"的情况。
        # 判据与金丝雀同一套:只有本轮确实完成才记 success;exit=0 但没完成记 noop;其余 failed。
        # 已完成收口的窗口 Active=false,这里不会覆盖(Close 对已关闭窗口返回 Skipped)。
        if ($script:DeployWindowEnabled) {
            try {
                $winNow = Get-IhuiDeployWindowState -Path $script:DeployWindowFile
                if ($winNow.Active -and $winNow.RunId) {
                    $winResult = if ($deployDoneThisRound) { 'success' } elseif ($roundRc -eq 0) { 'noop' } else { 'failed' }
                    $winHead = if ($script:LastDeploySha) { [string]$script:LastDeploySha } else { '' }
                    $winClose = Close-IhuiDeployWindow -Path $script:DeployWindowFile -RunId $winNow.RunId -Result $winResult -Head $winHead -SettleMinutes 15 -Reason "deploy-loop exit=$roundRc"
                    if ($winClose.Ok -and -not $winClose.Skipped) {
                        Log "WINDOW 兜底收口 $winResult runId=$($winNow.RunId) exit=$roundRc"
                    } elseif (-not $winClose.Ok) {
                        Log "WARN  部署窗口兜底收口失败($($winClose.Error))"
                    }
                }
            } catch {
                Log "WARN  部署窗口兜底收口异常(不影响部署环):$_"
            }
        }
        # ---- 2b) 记账与绿色态(O65 O6502 记账腿 / O6503 记号腿)----
        # 记账条件 = 本轮墙钟 ≥1 分钟(真的动过构建/部署);behind=0 的秒退不进账,否则额度被空转吃光。
        if ($roundMinutes -ge 1) {
            $budgetOut = (& $guardNode (Join-Path $Root 'scripts\cost-breaker.mjs') --charge --kind deploy --minutes $roundMinutes --note "deploy-loop rc=$roundRc" 2>&1 | Out-String)
            foreach ($ln in ($budgetOut -split "`r?`n")) { if ($ln.Trim()) { Log "  [budget] $($ln.Trim())" } }
        }
        # ---- 2c) 金丝雀观察窗(O65 第 2 期「上线闭环」)----
        # 只观察"刚上线的那一枚包":behind=0 秒退、构建失败、健康门禁回滚都没有新版本可观察。
        # 判据全在 scripts/canary-verdict.mjs;本层只负责"什么时候观察"和"回滚后不许刷绿"。
        $canaryRolledBack = $false
        if ($deployDoneThisRound) {
            try {
                $canaryRolledBack = [bool](Invoke-CanaryGate -Node $guardNode)
            } catch {
                # 观察窗自己抛异常 ⇒ 说不清"到底回没回滚",按最保守的一侧收口:不刷绿。
                # (green 记号是"上一个可运行态",在没证据时改写它等于把没量到写成量到了)
                Log "CANARY 未判定:观察窗异常($($_.Exception.Message))⇒ 不回滚结论未知,本轮不刷新绿色态"
                $canaryRolledBack = $true
            }
        }
        # 绿色态只在"本轮确实部署完成、且金丝雀没把这一轮撤掉"时刷新。
        if ($deployDoneThisRound -and -not $canaryRolledBack) {
            $greenOut = (& $guardNode (Join-Path $Root 'scripts\green-state.mjs') --mark --apply --note "deploy-loop ok" 2>&1 | Out-String)
            foreach ($ln in ($greenOut -split "`r?`n")) { if ($ln.Trim()) { Log "  [green] $($ln.Trim())" } }
        } elseif ($canaryRolledBack) {
            Log "GREEN 跳过:金丝雀观察窗已撤下本轮(或结论未知),绿色记号保持上一可运行态不前进"
        }
        Log "———— 部署轮询结束(exit=$roundRc) ————"
    } finally {
        # 只删自己那把(pid 对得上才删)。旧写法无条件 Remove-Item 会在"上一轮的锁被判
        # 陈旧清掉、新持有者刚写下锁"的窗口里替别人放锁 ⇒ 两个构建并发。
        Remove-IhuiDeployLock -Path $LockFile -OwnerKind 'loop' | Out-Null
    }
}

# =============================================================================
# 取证通道:只跑锁处置,绝不发起部署(判据 1/2/3 的三条现场都由这里真跑)
#
# 现场一律在 -SelfTestScratch 下造**真文件、真 mtime、真进程**:
#   S1 身份复用 = 2026-09-26 08:37 那次 46 分钟冻结的逐字重放
#      (旧裸 pid 锁 + mtime 早于该 pid 的启动时刻,那个 pid 是本夹具真起活的子进程)
#   S2 跨重启 = 判据 2 要求的那条**可证**形态:锁 mtime 早于本机真 LastBootUpTime
#   S3 活着的持锁者(反例,不可省)= 四条全满足 ⇒ 让路,且锁内容**逐字节不得变**
#   S4 unverifiable 对照 = 内容读不出 ⇒ 与改动前一样让路(不删、不覆盖、不归档)
#      + 同一把坏内容超绝对上限 ⇒ 必须有出路(否则"少抢一把"会退化成"永久挡住")
# 全程用自建的收集 Logger,不写生产 deploy-loop.log,也不碰 deploy\win\.deploy-loop.lock。
# =============================================================================
function Invoke-IhuiLoopLockSelfTest {
    param([Parameter(Mandatory = $true)][string]$Scratch)
    $ErrorActionPreference = 'Stop'
    $arch = Join-Path $Scratch 'archive'
    New-Item -ItemType Directory -Path $arch -Force | Out-Null
    $lines = [System.Collections.Generic.List[string]]::new()
    $logger = { param($m) $lines.Add([string]$m) }
    $out = [ordered]@{}
    $child = $null

    function Take-Log { param([int]$From) $r = @($lines[$From..([math]::Max($From, $lines.Count - 1))]); $r -join ' | ' }

    try {
        $now = [DateTime]::UtcNow
        $bootIdNow = Get-IhuiDeployLockBootId
        $bootUtc = ConvertTo-IhuiLockUtc ([datetime]$bootIdNow)   # 归一到 UTC 才可比(见下)
        $selfFacts = Get-IhuiDeployLockProcessFacts -ProcessId $PID
        $youngFacts = $null
        # 真起一个短命的活进程当"复用者"(夹具必须先自证量得到它,否则 S1/S2 的现场是假的)。
        # -WindowStyle Hidden:§5b/判据 6 —— 绝不弹可见窗口。收尾只按自己的 pid 精确停,
        # 不用 taskkill /IM(那会连带杀掉别人的同名进程)。
        $child = Start-Process -FilePath $PwshExe -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 60') -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 2
        $youngFacts = Get-IhuiDeployLockProcessFacts -ProcessId $child.Id
        $out._fixtures = [ordered]@{
            pwshExe           = $PwshExe
            selfPid           = $PID
            selfStartReadable = [bool]$selfFacts.StartReadable
            selfStartUtc      = (Format-IhuiLockUtc $selfFacts.ProcessStartUtc)
            youngPid          = $child.Id
            youngExists       = [bool]$youngFacts.ProcessExists
            youngStartReadable = [bool]$youngFacts.StartReadable
            youngStartUtc     = (Format-IhuiLockUtc $youngFacts.ProcessStartUtc)
            bootId            = $bootIdNow
            nowUtc            = $now.ToString('o')
        }
        if (-not $selfFacts.StartReadable) { throw '夹具失效:本进程自己的 StartTime 都量不到,S3 的现场无从构造' }
        if (-not $youngFacts.ProcessExists -or -not $youngFacts.StartReadable) { throw "夹具失效:刚起的子进程 pid=$($child.Id) 量不到(存在=$($youngFacts.ProcessExists) 启动时刻可读=$($youngFacts.StartReadable))" }
        if (-not $bootIdNow) { throw '夹具失效:本机启动标识量不到,S2 的"早于 LastBootUpTime"无从核对' }

        # ── S1:今早那把锁的逐字重放(旧裸 pid + mtime 早于该 pid 的启动时刻) ──
        $n0 = $lines.Count
        # 归档数按**增量**量,不按绝对值:同一目录可能被别的取证进程也写过归档件,
        # 绝对值会把别人的现场算成本轮的证据(实测同时跑两支 node --test 就撞出 5≠1)。
        $archBefore1 = @(Get-ChildItem -LiteralPath $arch -Filter 'stale-lock-*.json' -File -ErrorAction SilentlyContinue).Name
        $p1 = Join-Path $Scratch 's1-reused.lock'
        [System.IO.File]::WriteAllText($p1, "$($child.Id)")
        (Get-Item -LiteralPath $p1).LastWriteTimeUtc = $now.AddMinutes(-30)
        $acq1 = [bool](Enter-IhuiLoopLock -Path $p1 -Logger $logger -ArchiveDir $arch)
        $after1 = [string](Get-Content -LiteralPath $p1 -Raw)
        $new1 = @( @(Get-ChildItem -LiteralPath $arch -Filter 'stale-lock-*.json' -File -ErrorAction SilentlyContinue) |
            Where-Object { $archBefore1 -notcontains $_.Name } )
        $out.s1 = [ordered]@{
            acquired = $acq1; log = (Take-Log $n0); lockAfter = $after1
            lockAfterPid = $(try { ([int]($after1 | ConvertFrom-Json).pid) } catch { 0 })
            archiveAdded = $new1.Count
            archivePath = $(if ($new1.Count -gt 0) { $new1[0].FullName } else { '' })
            archivedRaw = $(if ($new1.Count -gt 0) { try { ([string](Get-Content -LiteralPath $new1[0].FullName -Raw) | ConvertFrom-Json).rawContent.Trim() } catch { "<读不回:$($_.Exception.Message)>" } } else { '' })
        }
        [void](Remove-IhuiDeployLock -Path $p1 -OwnerKind 'loop')

        # ── S2:判据 2 的可证形态 —— 锁 mtime 早于本机真 LastBootUpTime ──
        # 两式都跑:旧裸 pid(没有 bootId,C3 只能跳过)与结构化锁(带上一轮开机的 bootId)。
        # 报**实际**拦下的那一条(不预设是 C2 还是 C3):判据要能自证"这一型被拦",
        # 至于被哪一条拦是它自己的事,写死反而会把演进成问题。
        $boot = [datetime]$bootIdNow
        $n2 = $lines.Count
        $p2 = Join-Path $Scratch 's2-crossboot-legacy.lock'
        [System.IO.File]::WriteAllText($p2, "$($child.Id)")
        (Get-Item -LiteralPath $p2).LastWriteTimeUtc = $boot.AddMinutes(-30)
        $st2 = Resolve-IhuiDeployLockState -Path $p2 -OwnerKind 'loop'
        # 必须在**抢占之前**把盘上时间读走并算好比较:Enter 一旦把陈旧锁换成自己的新锁,
        # 同一再读到的就是刚刚写下的那份(实测如此 —— 那条"mtime 早于开机"的断言会去
        # 量一个已经不存在的现场,报出 mtimeEarlierThanBoot=false)。**先取证后动手**,
        # 与判据 3"先归档再删"是同一条顺序要求。
        $diskMtime2 = (Get-Item -LiteralPath $p2).LastWriteTimeUtc
        $earlier2 = $diskMtime2 -lt $bootUtc
        $acq2 = [bool](Enter-IhuiLoopLock -Path $p2 -Logger $logger -ArchiveDir $arch)
        $p2b = Join-Path $Scratch 's2b-crossboot-structured.lock'
        $meta2b = [ordered]@{
            pid = $child.Id; ownerKind = 'loop'
            writtenAt = (Format-IhuiLockUtc $boot.AddMinutes(-20))
            bootId = (Format-IhuiLockUtc $boot.AddHours(-3))
            heartbeatAt = (Format-IhuiLockUtc $now.AddMinutes(-1))
        }
        [void](Write-IhuiDeployLockJson -Path $p2b -Meta $meta2b)
        $st2b = Resolve-IhuiDeployLockState -Path $p2b -OwnerKind 'loop'
        $acq2b = [bool](Enter-IhuiLoopLock -Path $p2b -Logger $logger -ArchiveDir $arch)
        $out.s2 = [ordered]@{
            lastBootUpTimeUtc = (Format-IhuiLockUtc $bootUtc)
            legacy = [ordered]@{
                # 两条值都**从盘上现读**,而且现读发生在抢占之前(见上):不是我刚做过的
                # 减法 —— 拿 $boot.AddMinutes(-30) -lt $boot 去断言"早于开机"是条恒真式
                # (永远绿的断言与永远红的同样没用),现读文件系统时间才有牙。
                mtimeUtc = (Format-IhuiLockUtc $diskMtime2)
                earlierThanBoot = $earlier2
                verdict = $st2.Verdict; failed = $st2.Failed
                acquired = $acq2; log = (Take-Log $n2)
            }
            structured = [ordered]@{ verdict = $st2b.Verdict; failed = $st2b.Failed; acquired = $acq2b }
        }
        [void](Remove-IhuiDeployLock -Path $p2 -OwnerKind 'loop')
        [void](Remove-IhuiDeployLock -Path $p2b -OwnerKind 'loop')

        # ── S3(反例,不可省):活着的持锁者绝不被抢,内容逐字节不得变 ─────────
        # 两式:结构化(自己刚写下的)与旧裸 pid(升级窗口里仍在跑的老守护写下的)。
        # 后者尤其要紧 —— 判据若"认不出旧格式就抢",升级那一轮就会把正在构建的守护抢掉。
        $n3 = $lines.Count
        $archBefore3 = @(Get-ChildItem -LiteralPath $arch -Filter 'stale-lock-*.json' -File -ErrorAction SilentlyContinue).Count
        $p3 = Join-Path $Scratch 's3-live.lock'
        [void](Write-IhuiDeployLock -Path $p3 -OwnerKind 'loop')
        $before3 = [string](Get-Content -LiteralPath $p3 -Raw)
        $acq3 = [bool](Enter-IhuiLoopLock -Path $p3 -Logger $logger -ArchiveDir $arch)
        $after3 = [string](Get-Content -LiteralPath $p3 -Raw)
        $p3b = Join-Path $Scratch 's3b-live-legacy.lock'
        [System.IO.File]::WriteAllText($p3b, "$PID")
        (Get-Item -LiteralPath $p3b).LastWriteTimeUtc = $selfFacts.ProcessStartUtc.AddSeconds(5)
        $before3b = [string](Get-Content -LiteralPath $p3b -Raw)
        $acq3b = [bool](Enter-IhuiLoopLock -Path $p3b -Logger $logger -ArchiveDir $arch)
        $after3b = [string](Get-Content -LiteralPath $p3b -Raw)
        $arch3 = @(Get-ChildItem -LiteralPath $arch -Filter 'stale-lock-*.json' -File).Count
        $out.s3 = [ordered]@{
            structuredAcquired = $acq3; unchanged = ($before3 -ceq $after3)
            legacyAcquired = $acq3b; legacyUnchanged = ($before3b -ceq $after3b)
            log = (Take-Log $n3)
            # 让路的两次都**不该**留下归档件:归档只属于"真抢占了"那一路。
            # 量**增量**而不是绝对值 —— 绝对值里混着 S1/S2 合法留下的归档件,
            # 拿它当"这一路没归档"的证据就是把"没看清"写成"没问题"。
            archiveAddedByS3 = ($arch3 - $archBefore3)
        }
        [void](Remove-IhuiDeployLock -Path $p3 -OwnerKind 'loop')

        # ── S4(对照):unverifiable 维持改动前的行为 = 让路,不据此抢占 ───────
        $n4 = $lines.Count
        $p4 = Join-Path $Scratch 's4-unverifiable.lock'
        [System.IO.File]::WriteAllText($p4, 'not-a-json-at-all')
        (Get-Item -LiteralPath $p4).LastWriteTimeUtc = $now.AddMinutes(-5)
        $before4 = [string](Get-Content -LiteralPath $p4 -Raw)
        $acq4 = [bool](Enter-IhuiLoopLock -Path $p4 -Logger $logger -ArchiveDir $arch)
        $after4 = [string](Get-Content -LiteralPath $p4 -Raw)
        # 同一把坏内容,只是把文件时间推到绝对上限之外 ⇒ 必须有出路,
        # 否则"少抢一把"就变成"任何人都抢不动、部署环永久停摆"(G-208 的原病)。
        (Get-Item -LiteralPath $p4).LastWriteTimeUtc = $now.AddHours(-7)
        $acq4b = [bool](Enter-IhuiLoopLock -Path $p4 -Logger $logger -ArchiveDir $arch)
        $out.s4 = [ordered]@{
            holds = (-not $acq4); unchanged = ($before4 -ceq $after4); stillThere = (Test-Path -LiteralPath $p4)
            overCapAcquired = $acq4b; log = (Take-Log $n4)
        }
        [void](Remove-IhuiDeployLock -Path $p4 -OwnerKind 'loop')
    } finally {
        # 只按自己起的 pid 收尾(判据 6:禁止 taskkill /IM)
        if ($null -ne $child) { try { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue } catch {} }
    }
    ($out | ConvertTo-Json -Depth 8 -Compress)
}

if ($SelfTestScratch) {
    # 自我护栏:取证通道绝不允许把落点指到生产目录 —— 那会把"跑一次测试"变成"改一次生产锁"。
    $probe = ''
    try { $probe = [System.IO.Path]::GetFullPath($SelfTestScratch).TrimEnd('\', '/') } catch { $probe = '' }
    $winFull = ''
    try { $winFull = [System.IO.Path]::GetFullPath($WinDir).TrimEnd('\', '/') } catch { $winFull = '' }
    if (-not $probe) {
        Write-Host "FAIL  -SelfTestScratch 解析不出绝对路径,拒绝跑取证"
        exit 2
    }
    if ($winFull -and ($probe -ieq $winFull)) {
        Write-Host "FAIL  -SelfTestScratch 指向生产目录 $winFull,拒绝(取证只在临时目录里写)"
        exit 2
    }
    New-Item -ItemType Directory -Path $SelfTestScratch -Force | Out-Null
    try {
        Invoke-IhuiLoopLockSelfTest -Scratch $SelfTestScratch
        exit 0
    } catch {
        Write-Host ("FAIL  取证通道异常:{0}" -f $_.Exception.Message)
        exit 1
    }
}

if ($Daemon) {
    Log "==== 部署守护启动(pid=$PID, interval=${IntervalSeconds}s, min-deploy-interval=${MinDeployIntervalMin}min, pwsh=$PwshExe) ===="
    while ($true) {
        Invoke-LogRotate
        Invoke-PollOnce
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Invoke-LogRotate
    Invoke-PollOnce
}

# =============================================================================
# 给机主的一条命令(G-305 的第二半,本票**没有**代跑)
#
# 本文件顶部的 `[Console]::OutputEncoding = UTF-8` 与 StreamReader 写死编码两处,
# 只有在 IHUI-DEPLOYLOOP **重启后**才生效 —— PowerShell 在进程启动时把整份 .ps1 读进内存,
# 改磁盘不改动已驻留的守护。子进程那半(ihui-deploy.ps1)每轮新起,**下一轮即生效**。
#
# 为什么不自己重启:重启会 stop/start api 与 web(实测换流窗口 6-9s 内本地也拒连、登录页 500),
# 且部署环一启动就立刻跑一轮 ⇒ 时机属生产决策,不属编码修复。
#
# 建议时机:低峰、且 `git status` 干净(无人在飞提交)时执行一次:
#     nssm restart IHUI-DEPLOYLOOP
#   然后现读验证是否已经不再产生新的乱码(只看重启后的新行):
#     Select-String -Path deploy\win\deploy-loop.log -Pattern ([char]0xFFFD) | Measure-Object
#   期望:重启之后新增行里 U+FFFD 计数不再上升(历史行不会自动变好 —— 原始字节已丢,
#   GBK 落盘的中文无法从当前日志逆推,别去"清洗"历史行,那会把别人的现场也改一遍)。
# 判据不依赖这件事:本仓定位靠 ASCII 标记(GATE-ITER / HEALTH / behind= / OK / FAIL)。
# =============================================================================
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
