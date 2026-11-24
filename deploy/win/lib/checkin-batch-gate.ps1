# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 签到批次节流判据(部署侧唯一实现,2026-11-04 立)
# 跑法:被 ihui-deploy.ps1 点源;自检见 deploy/win/tests/checkin-batch-gate.test.ps1
# =============================================================================
# 立因(2026-11-04 现读,不是假想):
#   部署环 IHUI-DEPLOYLOOP 每 ~45 分钟部署一次,每次重启 IHUI-AI-SERVICE。08:05
#   主窗口批次 08:05:08 起批,08:06:58 打到第 6 个号的「错峰延迟 29s 后签到」时,
#   08:06:59 部署重启把进程优雅关闭 ⇒ 本轮总结行没打出、剩余账号当天不再有人管
#   (调度器没有「本轮跑到第几个」的持久账本)。本模块只解决这一件事:**批次在
#   执行中(含错峰等待)就不重启 ai-service,等待有上限,超限照常部署并显式告警**。
#   蓝绿切换 / 健康门禁 / 快照 / 验收一律不碰。
#
# 判据表(状态 ← ai-service 写的 marker,见 app/services/checkin_batch_marker.py):
#   marker 不存在              → absent  → 立即部署(0 秒等待)
#   心跳年龄 <  StaleSeconds    → fresh   → 推迟,每 PollSeconds 轮询,直到批次结束
#   心跳年龄 ≥  StaleSeconds    → stale   → 判定硬杀残留(进程被 Force 杀掉时 finally
#                                           不执行),立即部署 + WARN
#   读不到 / 坏 JSON / 形状不全 → unknown → **fail-closed:视为「可能在执行」,等待到上限**
#
# 为什么 unknown 选「视为可能在执行」而不是「不确定 ⇒ 立即部署」(二选一,已选定):
#   读错的两种代价不对称。等错:最多晚部署 900s,下一轮部署仍在 30 分钟最小间隔内,
#   完全可逆。判错(当成空闲):切断一批签到,当天该批剩余账号不会自动补跑 ——
#   08:05 主窗口每天只跑一次,启动补偿只在「节拍后 120 分钟宽限内 ∧ 今日无 ok 记录」
#   才补,过了窗口就不再补。所以「读不到」必须按「可能在跑」处理。
#   **这条与「读不到当空闲」正好相反,是本模块的 fail-closed 定义,任何改动都必须
#   同时改这里、Python marker 模块头注与本仓设计文档。**
#
# 上限 900s(15 分钟)的依据(任务书要求给依据):
#   今日实测最长批次:08:05 主窗口 08:05:08→08:06:58 ≈ 110s(14 个号含错峰);
#   qoder 10:05 轮 10:06:25→10:10:06 ≈ 221s(8 个号)。900s ≈ 实测最长的 4 倍余量,
#   同时 < 部署环最小部署间隔 30 分钟、< 部署锁心跳上限 45 分钟(等待期每轮轮询都
#   续锁,见 -HeartbeatCallback)。Qoder 补跑上限 200 号 × 错峰 ≤45s 的极端批次会
#   超过 900s:此时按任务书「超限必须照常部署并显式告警」,不无限拖、不静默跳过。
#
# 判据只读不写、无副作用;任何内部异常都收敛成 unknown(fail-closed),绝不 throw
# 把部署直接打死(节流是增强项,不能让一次文件系统抖动停掉发布)。

function Get-IhuiCheckinBatchMarkerPath {
    <#  marker 路径的唯一出口:默认 <Root>\deploy\run\checkin-batch.json。
        与 ai-service 侧默认路径同构(那边由 __file__ 推导仓库根,见
        checkin_batch_marker.py 的 default_marker_path);env 可覆盖(换根/自检用)。 #>
    param([Parameter(Mandatory = $true)][string]$Root)
    $override = $env:IHUI_CHECKIN_BATCH_MARKER
    if (-not [string]::IsNullOrWhiteSpace($override)) { return $override }
    return (Join-Path $Root 'deploy\run\checkin-batch.json')
}

function Read-IhuiCheckinBatchMarker {
    <#  读一次 marker 并给出四态:absent / fresh / stale / unknown。
        返回对象:State, Pid, Batch, StartedAt, HeartbeatAt, AgeSeconds, Detail。 #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [datetimeoffset]$Now = [datetimeoffset]::UtcNow,
        [double]$StaleSeconds = 180
    )
    $r = [ordered]@{
        State       = 'unknown'
        Pid         = 0
        Batch       = ''
        StartedAt   = $null
        HeartbeatAt = $null
        AgeSeconds  = $null
        Detail      = ''
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $r.State = 'absent'
        $r.Detail = 'marker 不存在'
        return [pscustomobject]$r
    }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -Encoding utf8 -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) { throw '内容为空' }
        $obj = ConvertFrom-Json -InputObject $raw -ErrorAction Stop
        # 心跳优先,缺心跳时退回 startedAt;两者都没有 ⇒ 形状不全 ⇒ unknown
        # (fail-closed 口径:形状不全不许猜成空闲)。
        $hbRaw = $null
        foreach ($k in @('heartbeatAt', 'startedAt')) {
            $p = $obj.PSObject.Properties[$k]
            if ($null -ne $p -and -not [string]::IsNullOrWhiteSpace([string]$p.Value)) {
                $hbRaw = [string]$p.Value
                break
            }
        }
        if ([string]::IsNullOrWhiteSpace($hbRaw)) { throw '缺少 heartbeatAt/startedAt 时间戳' }
        $hb = [datetimeoffset]::Parse($hbRaw, [System.Globalization.CultureInfo]::InvariantCulture)
        $age = ($Now - $hb).TotalSeconds
        # 未来时间戳(时钟回拨/写入端时钟偏快)按「刚刷新」处理:宁可在上限内等,
        # 也不许把一次正常批次判成过期。
        if ($age -lt 0) { $age = 0 }
        $r.AgeSeconds = [math]::Round($age, 1)
        $r.HeartbeatAt = $hb
        $pPid = $obj.PSObject.Properties['pid']
        if ($null -ne $pPid) { $r.Pid = [int]$pPid.Value }
        $pBatch = $obj.PSObject.Properties['batch']
        if ($null -ne $pBatch) { $r.Batch = [string]$pBatch.Value }
        $pStart = $obj.PSObject.Properties['startedAt']
        if ($null -ne $pStart) { $r.StartedAt = [string]$pStart.Value }
        if ($age -ge $StaleSeconds) { $r.State = 'stale' } else { $r.State = 'fresh' }
        $r.Detail = ('pid={0} batch={1} heartbeatAt={2} age={3}s' -f `
                $r.Pid, $r.Batch, $hb.ToString('o'), $r.AgeSeconds)
        return [pscustomobject]$r
    } catch {
        $r.State = 'unknown'
        $r.Detail = "读取失败: $($_.Exception.Message)"
        return [pscustomobject]$r
    }
}

function Wait-IhuiCheckinBatchIdle {
    <#  等待「签到批次不在执行」,最多 MaxWaitSeconds 秒。返回 Outcome:
          idle            —— marker 一开始就不存在(立即部署)
          finished        —— 等过一段后 marker 消失(批次正常结束)
          stale           —— marker 心跳过期(硬杀残留)⇒ 立即部署 + WARN
          overdue         —— 批次仍在跑但已到上限 ⇒ 照常部署 + ALERT
          unknown-overdue —— 读不到状态(fail-closed 等到上限)⇒ 照常部署 + ALERT
        另返回 Severity(info/warn/alert)、Message(可直接写日志)、WaitedSeconds 等。
        -HeartbeatCallback 每轮轮询调用一次(续部署锁/部署窗口心跳,防长等待被判失联)。
        -ProgressCallback 每 60s 调用一次(长等待的进度日志)。
        -OnPoll 是自检钩子(每轮读完后调用,供测试删除/改写 marker),生产不传。 #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$MaxWaitSeconds = 900,
        [int]$PollSeconds = 10,
        [double]$StaleSeconds = 180,
        [scriptblock]$HeartbeatCallback,
        [scriptblock]$ProgressCallback,
        [scriptblock]$OnPoll
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $firstState = $null
    $last = $null
    $blocked = $false
    $nextProgress = 60.0
    $outcome = 'idle'
    $staleAge = 0.0

    while ($true) {
        if ($HeartbeatCallback) {
            # 续锁失败不得让节流变成致命错误:部署仍然要能往下走。
            try { & $HeartbeatCallback } catch { }
        }
        $last = Read-IhuiCheckinBatchMarker -Path $Path -StaleSeconds $StaleSeconds
        if ($null -eq $firstState) { $firstState = $last.State }
        if ($OnPoll) {
            try { & $OnPoll $last $sw.Elapsed.TotalSeconds } catch { }
        }
        $waited = $sw.Elapsed.TotalSeconds

        if ($last.State -eq 'absent') {
            $outcome = if ($blocked) { 'finished' } else { 'idle' }
            break
        }
        if ($last.State -eq 'stale') {
            if ($null -ne $last.AgeSeconds) { $staleAge = [double]$last.AgeSeconds }
            $outcome = 'stale'
            break
        }
        if ($waited -ge $MaxWaitSeconds) {
            $outcome = if ($last.State -eq 'unknown') { 'unknown-overdue' } else { 'overdue' }
            break
        }
        $blocked = $true
        $remain = $MaxWaitSeconds - $waited
        $poll = [double][math]::Max($PollSeconds, 1)
        $sleep = [math]::Min($poll, [math]::Max($remain, 0.05))
        Start-Sleep -Milliseconds ([int]([math]::Round($sleep * 1000)))
        $waited = $sw.Elapsed.TotalSeconds
        if ($ProgressCallback -and $waited -ge $nextProgress) {
            $nextProgress = $waited + 60.0
            try { & $ProgressCallback ([int]$waited) } catch { }
        }
    }

    $waited = $sw.Elapsed.TotalSeconds
    $severity = 'info'
    switch ($outcome) {
        'stale' {
            $severity = 'warn'
            $message = ('签到批次: marker 心跳停滞 {0}s(≥{1}s,疑似硬杀残留)⇒ 判定过期,立即继续部署' -f $staleAge, $StaleSeconds)
        }
        'overdue' {
            $severity = 'alert'
            $message = ('签到批次: 已等待 {0}s 达上限({1}s)仍未结束 ⇒ 照常部署并告警(本批可能被切断)' -f [int]$waited, [int]$MaxWaitSeconds)
        }
        'unknown-overdue' {
            $severity = 'alert'
            $message = ('签到批次: 读不到批次状态(fail-closed 按「可能在执行」)⇒ 已等到上限 {0}s ⇒ 照常部署并告警({1})' -f [int]$waited, $last.Detail)
        }
        'finished' {
            $message = ('签到批次: 执行中,等待 {0}s 后已结束 ⇒ 继续部署' -f [int]$waited)
        }
        default {
            $message = '签到批次: 无进行中批次 ⇒ 立即继续部署'
        }
    }

    return [pscustomobject][ordered]@{
        Outcome        = $outcome
        Severity       = $severity
        Message        = $message
        WaitedSeconds  = [int][math]::Round($waited)
        FirstState     = $firstState
        LastState      = if ($null -ne $last) { $last.State } else { 'absent' }
        Detail         = if ($null -ne $last) { $last.Detail } else { '' }
        MaxWaitSeconds = $MaxWaitSeconds
        StaleSeconds   = $StaleSeconds
        MarkerPath     = $Path
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
