# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 数据库备份调度器 — 由 Windows 计划任务 "\IHUI-PG-BACKUP" 托管(SYSTEM;
# 触发器=开机 AtStartup + 每日 03:00,多实例策略 IgnoreNew ⇒ 循环存活时 03:00 那班
# 只是"若循环已死则重新拉起"的兜底,不会并发起第二个循环)
# =============================================================================
# 历史形态:2026-10-27 前由 NSSM 服务 IHUI-PG-BACKUP 常驻承载。本机实测(现读):
# nssm.exe 不在位、同名服务与同名计划任务条目均不存在(换机后整条调度面失联),
# 故复注册为计划任务。换载体带来的一个真实差异:计划任务**没有** NSSM 的
# AppStdout 捕获 ⇒ 日志由本脚本自己落盘(见下),否则"看日志"这条出路会指向空文件。
# 行为:启动即执行一次备份 → 每天 03:00 执行一次备份
#       → 失败轮 30 分钟后自动重试,最多 4 次(约 2 小时窗口);仍失败则等下一班 03:00
# 日志: <DevEnvRoot>\logs\pg-backup-scheduler.log(DevEnvRoot = IHUI_DEVENV_ROOT 覆盖,
#       否则按仓库根所在盘派生 <盘>:\DevEnv —— 与 ihui-pg-backup.ps1 的 G-298 同一口径,
#       不再写死 D:\ 字面量)
# =============================================================================
$ErrorActionPreference = "Continue"
# G-385(2026-10-01):NSSM 重定向 stdout 时 PS5.1 默认按 GBK 写 ⇒ 日志里中文全是乱码,
# 全仓无机读方因此没人修。显式声明 UTF-8,让 pg-backup-scheduler.log 可被脚本/人直接读。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 成功即清零;失败走 30 分钟重试通道。2026-10-01 事故:09:08 定时轮撞上部署环重启
# PG(8810 拒连/"database system is starting up"),旧结构等到次日 03:00 才重试 ——
# 备份新鲜度必然穿过 26h 阈值,且期间告警通道也未送达,双重静默。
$script:BackupOk = $true
$script:RetryCount = 0

# 仓库根走唯一解析实现(ihui-root-common.ps1),不写死盘符:硬编码 D:\IHUI-AI 在换机/换盘后
# 指向另一个根,而本调度器由 nssm 服务 IHUI-PG-BACKUP 常驻跑,错根会每轮"照常"跑空。
# 目标脚本先验在位再调用 —— 服务/计划任务里的失败必须当场大声,不许空转到下一班 03:00。
. (Join-Path $PSScriptRoot 'ihui-root-common.ps1')
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot
$backupScript = Join-Path $Root 'deploy\prod-bundle\pg-backup.ps1'
if (-not (Test-Path -LiteralPath $backupScript)) {
    throw "找不到备份脚本: $backupScript —— 拒绝带着错根继续(本脚本由计划任务 IHUI-PG-BACKUP 常驻跑)"
}

# DevEnv 根派生与 ihui-pg-backup.ps1 的 G-298 同一条口径(IHUI_DEVENV_ROOT 覆盖优先,
# 否则按仓库根所在盘派生 <盘>:\DevEnv);本仓只允许这一处"从 $Root 推根"的写法存在于
# 这两份配对脚本中,盘符字面量一律不得回来(2026-10-27 实测:D:\ 字面量在本机是死路径)。
$DevEnvRoot = if ($env:IHUI_DEVENV_ROOT) { $env:IHUI_DEVENV_ROOT } else { (Split-Path -Qualifier $Root) + '\DevEnv' }
$schedulerLogFile = Join-Path $DevEnvRoot 'logs\pg-backup-scheduler.log'

function Write-Log {
    # 控制台 + 日志文件双写。计划任务没有服务控制器的 stdout 捕获,只写控制台 = 什么都不留;
    # 落盘失败**不得**打断备份循环(日志是观测面,备份是交付面),但必须当场喊出来。
    param([string]$Message)
    [Console]::Out.WriteLine($Message)
    try {
        $dir = Split-Path -Parent $schedulerLogFile
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        Add-Content -LiteralPath $schedulerLogFile -Value $Message -Encoding utf8
    } catch {
        [Console]::Error.WriteLine("[WARN] 调度器日志落盘失败(不阻断备份): $schedulerLogFile —— $($_.Exception.Message)")
    }
}

function Run-Backup {
    try {
        # 计划任务没有 NSSM 那层 AppStdout 捕获(2026-10-27 换载体的实测差异)⇒ 子脚本的
        # [OK]/[ERROR]/[WARN] 明细必须在这里整段接住转写日志,否则日志面只剩"备份完成/失败"
        # 一行结论,排障时等于没有日志。*>&1 把子脚本全部流并入成功流;原生程序的 stderr
        # 在 EAP=Continue 下按文本流入,不改变 $LASTEXITCODE 的判定(下面仍按退出码打结论)。
        # ⚠ `&` 不会因为被调脚本 exit 1 抛异常 ⇒ 失败必须靠 $LASTEXITCODE 判,不得只靠 catch。
        $childOut = @(& $backupScript *>&1)
        # 2026-10-27 实测:InformationRecord/ErrorRecord 的字符串插值就是消息本体(不写类型名),
        # 而 Out-String 会把 ErrorRecord 附上 "Write-Error: Line |" 定位噪声 ⇒ 用插值不用 Out-String。
        foreach ($line in $childOut) { Write-Log ("    | " + "$line") }
        # 2026-09-24 实测后果(保留原文依据):pg_hba 在 04:47 被改成 scram-sha-256(全链路不再免密),
        # 而当时脚本用的是 postgres + 显式空口令 —— 最后一份成功 dump 停在 04:39,
        # 之后每次"成功"都是假的。静默是这类事故唯一的传播方式。
        if ($LASTEXITCODE -eq 0) {
            $script:BackupOk = $true
            $script:RetryCount = 0
            Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份完成"
        } else {
            $script:BackupOk = $false
            Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份失败:子脚本 exit=$LASTEXITCODE(见上一行 [ERROR])"
        }
    } catch {
        $script:BackupOk = $false
        Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份失败: $_"
    }
    # 2026-09-06 WAL 归档清理: 每次备份后清掉超过 7 天的归档(与 7 天全量轮转对齐, 防无限累积)。
    # 归档来自 PG archive_command → <DevEnvRoot>\pg_archives\(24 位十六进制 WAL 段名)。
    # 2026-10-27 实测:D:\DevEnv\pg_archives 字面量在本机是死路径(换机后 DevEnv 根随仓根走盘派生),
    # 与上方 $DevEnvRoot/$schedulerLogFile 同一口径,盘符字面量不得回来。
    $archivesDir = Join-Path $DevEnvRoot 'pg_archives'
    $archives = Get-ChildItem $archivesDir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -match '^[0-9A-F]{24}$' }
    $cutoff = (Get-Date).AddDays(-7)
    $removed = $archives | Where-Object { $_.LastWriteTime -lt $cutoff }
    foreach ($f in $removed) { Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue }
    Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WAL 归档:清理 $($removed.Count) 份, 保留 $($archives.Count - $removed.Count) 份"
}

Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份调度器启动,先执行一次备份"
Run-Backup

while ($true) {
    $now = Get-Date
    if ($script:BackupOk) {
        # 上一轮成功(或启动首轮):按常规节奏等下一班 03:00
        $next = Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour 3 -Minute 0 -Second 0
        if ($next -le $now) { $next = $next.AddDays(1) }
    } elseif ($script:RetryCount -lt 4) {
        $script:RetryCount++
        $next = $now.AddMinutes(30)
        Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 上轮备份失败,30 分钟后重试(第 $script:RetryCount/4 次)"
    } else {
        # 连续 4 次重试仍失败:放弃本轮,回常规节奏(失败告警由 pg-backup.ps1 内部发出)
        $script:RetryCount = 0
        $script:BackupOk = $true
        $next = Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour 3 -Minute 0 -Second 0
        if ($next -le $now) { $next = $next.AddDays(1) }
        Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 连续 4 次重试仍失败,放弃本轮重试,等下一班定时备份"
    }
    $waitSec = [math]::Round(($next - $now).TotalSeconds)
    Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 下次备份: $($next.ToString('yyyy-MM-dd HH:mm:ss'))(等待 ${waitSec}s)"
    Start-Sleep -Seconds $waitSec
    Run-Backup
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
