# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI 部署窗口状态 — 部署侧写、监控侧读的唯一显式信号
# =============================================================================
# 立因:生产端每 ~30 分钟重部署一次,部署期间 web/api/ai 重启造成端口与公网 URL 短暂不可用,
# 而监控此前靠三条间接判据(部署锁 pid / build log mtime / 服务进程 StartTime)识别"部署中",
# 三条都有盲区:多层派生时锁 pid 对不上;build log 要么恒旧要么回落到每分钟都写的
# deploy-loop.log(恒新);进程启动窗口只覆盖重启后的 10 分钟。结果是部署窗口内照常寄信。
#
# 本模块只做一件事:把"现在有一轮部署在跑 / 刚成功 / 已失败"写成仓库外的状态文件,
# 让监控读同一份事实,不再猜。状态文件默认 D:\DevEnv\state\ihui-deploy-window.json,
# 可用 IHUI_DEPLOY_WINDOW_FILE 覆盖(测试用 scratch,生产用默认)。
#
# 语义:
#   closedAt 为空 + 心跳 <= StaleMinutes   ⇒ 活动窗口,抑制部署相关告警
#   closedAt 为空 + 心跳 >  StaleMinutes   ⇒ Stale,部署可能已失联,立即放行
#   result=success + now <= settleUntil   ⇒ 成功后恢复观察期,仍抑制
#   result=failed/rolledback/noop         ⇒ 立即放行
#   文件不存在 / JSON 损坏 / result 未知  ⇒ 不抑制(判不出不得静默)
#
# 兼容:本模块被 PowerShell 5.1(monitor)与 7(deploy/loop)共同加载,不得使用 PS7 专有语法。
# 时间一律 ISO 8601 带偏移;读取用 DateTimeOffset,禁止把墙钟字符串直接比较。
# =============================================================================

function Get-IhuiDeployWindowPath {
    if ($env:IHUI_DEPLOY_WINDOW_FILE) { return $env:IHUI_DEPLOY_WINDOW_FILE }
    return 'D:\DevEnv\state\ihui-deploy-window.json'
}

function ConvertTo-IhuiDeployWindowInstant {
    # 只做解析,不抛:调用方按"判不出"处理,判不出不得伪装成某个时刻。
    param($Value)
    if ($null -eq $Value -or $Value -eq '') { return $null }
    if ($Value -is [datetimeoffset]) { return $Value }
    if ($Value -is [datetime]) {
        if ($Value -eq [datetime]::MinValue) { return $null }
        return [datetimeoffset]::new($Value)
    }
    $s = [string]$Value
    if (-not $s) { return $null }
    $dto = [datetimeoffset]::MinValue
    $styles = [System.Globalization.DateTimeStyles]::RoundtripKind
    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    if ([datetimeoffset]::TryParse($s, $culture, $styles, [ref]$dto)) { return $dto }
    return $null
}

function Format-IhuiDeployWindowInstant {
    param($Value)
    $dto = ConvertTo-IhuiDeployWindowInstant $Value
    if ($null -eq $dto) { return $null }
    return $dto.ToString('o')
}

function Read-IhuiDeployWindowState {
    <#
      返回 @{ Ok; FileExists; State; Error }。
      FileExists 与 Ok 分开:文件在盘上但读不懂时,监控必须知道"这一格存在过"(Authoritative),
      从而不再回落到旧启发式判据;而 Ok=$false 又保证它不会被当成"部署中"去抑制。
    #>
    param([Parameter(Mandatory = $true)][string]$Path)
    $exists = Test-Path -LiteralPath $Path
    if (-not $exists) {
        return @{ Ok = $false; FileExists = $false; State = $null; Error = "状态文件不存在:$Path" }
    }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
        if (-not $raw -or -not $raw.Trim()) { throw '文件为空' }
        $obj = $raw | ConvertFrom-Json
        if ($null -eq $obj) { throw 'JSON 解析结果为空' }
        $state = @{
            schema        = [int]$obj.schema
            runId         = [string]$obj.runId
            phase         = [string]$obj.phase
            startedAt     = ConvertTo-IhuiDeployWindowInstant $obj.startedAt
            heartbeatAt   = ConvertTo-IhuiDeployWindowInstant $obj.heartbeatAt
            expectedEndAt = ConvertTo-IhuiDeployWindowInstant $obj.expectedEndAt
            closedAt      = ConvertTo-IhuiDeployWindowInstant $obj.closedAt
            result        = [string]$obj.result
            settleUntil   = ConvertTo-IhuiDeployWindowInstant $obj.settleUntil
            head          = [string]$obj.head
            reason        = [string]$obj.reason
        }
        return @{ Ok = $true; FileExists = $true; State = $state; Error = '' }
    } catch {
        return @{ Ok = $false; FileExists = $true; State = $null; Error = "状态文件读不出:$($_.Exception.Message)" }
    }
}

function Write-IhuiDeployWindowState {
    <#
      原子写:先写同目录 $Path.tmp-$PID,再 Move-Item -Force 覆盖。
      写失败返回 Ok=$false 并把原因带回 —— 调用方必须写日志,不能把"没写成"读成"窗口没开"。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$State
    )
    $tmp = "$Path.tmp-$PID"
    try {
        $dir = Split-Path -Parent $Path
        if ($dir -and -not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
        $payload = [ordered]@{
            schema        = 1
            runId         = [string]$State.runId
            phase         = [string]$State.phase
            startedAt     = Format-IhuiDeployWindowInstant $State.startedAt
            heartbeatAt   = Format-IhuiDeployWindowInstant $State.heartbeatAt
            expectedEndAt = Format-IhuiDeployWindowInstant $State.expectedEndAt
            closedAt      = Format-IhuiDeployWindowInstant $State.closedAt
            result        = [string]$State.result
            settleUntil   = Format-IhuiDeployWindowInstant $State.settleUntil
            head          = [string]$State.head
            reason        = [string]$State.reason
        }
        $json = ($payload | ConvertTo-Json -Depth 5)
        [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
        for ($i = 0; $i -lt 3; $i++) {
            try {
                Move-Item -LiteralPath $tmp -Destination $Path -Force -ErrorAction Stop
                return @{ Ok = $true; Error = '' }
            } catch {
                if ($i -ge 2) { throw }
                Start-Sleep -Milliseconds 100
            }
        }
        return @{ Ok = $true; Error = '' }
    } catch {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        return @{ Ok = $false; Error = "状态文件写不出:$($_.Exception.Message)" }
    }
}

function Get-IhuiDeployWindowState {
    <#
      只读判定。返回字段见模块头注。任何"判不出"都落 Suppress=$false —— 宁可多喊一次,
      也不得让监控把真故障按"部署中"永久压住(2026-09-29 那场 2h39m 的教训)。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$StaleMinutes = 10
    )
    $read = Read-IhuiDeployWindowState -Path $Path
    $result = @{
        Authoritative = [bool]$read.FileExists
        Available     = [bool]$read.Ok
        Suppress      = $false
        Active        = $false
        Stale         = $false
        Settle        = $false
        Phase         = ''
        RunId         = ''
        Result        = ''
        Head          = ''
        Reason        = ''
        StartedAt     = $null
        HeartbeatAt   = $null
        ExpectedEndAt = $null
        ClosedAt      = $null
        SettleUntil   = $null
        Error         = [string]$read.Error
    }
    if (-not $read.Ok) {
        if ($read.FileExists) {
            $result.Reason = "窗口状态不可判($($read.Error))⇒ 不抑制"
        } else {
            $result.Reason = '窗口状态文件不存在'
        }
        return $result
    }

    $s = $read.State
    $result.Phase = $s.phase
    $result.RunId = $s.runId
    $result.Result = $s.result
    $result.Head = $s.head
    $result.StartedAt = $s.startedAt
    $result.HeartbeatAt = $s.heartbeatAt
    $result.ExpectedEndAt = $s.expectedEndAt
    $result.ClosedAt = $s.closedAt
    $result.SettleUntil = $s.settleUntil
    $now = [datetimeoffset]::Now

    if ($null -eq $s.closedAt) {
        $hb = $s.heartbeatAt
        if ($null -eq $hb) { $hb = $s.startedAt }
        if ($null -eq $hb) {
            $result.Stale = $true
            $result.Reason = '活动窗口缺少心跳时刻 ⇒ 不抑制'
            return $result
        }
        $ageMin = ($now - $hb).TotalMinutes
        if ($ageMin -gt $StaleMinutes) {
            $result.Stale = $true
            $result.Reason = "窗口心跳已停 $([Math]::Round($ageMin, 1)) 分钟(> ${StaleMinutes} 分钟),部署可能已失联 ⇒ 不抑制"
            return $result
        }
        $result.Active = $true
        $result.Suppress = $true
        $exp = if ($s.expectedEndAt) { $s.expectedEndAt.ToString('yyyy-MM-dd HH:mm:ss') } else { '未知' }
        $result.Reason = "部署窗口进行中(phase=$($s.phase), runId=$($s.runId), 预计结束=$exp)"
        return $result
    }

    if ($s.result -eq 'success' -and $s.settleUntil -and $now -le $s.settleUntil) {
        $result.Settle = $true
        $result.Suppress = $true
        $result.Reason = "部署成功,恢复观察期至 $($s.settleUntil.ToString('yyyy-MM-dd HH:mm:ss'))(runId=$($s.runId))"
        return $result
    }

    $closedText = if ($s.closedAt) { $s.closedAt.ToString('yyyy-MM-dd HH:mm:ss') } else { '未知' }
    $result.Reason = "部署窗口已收口(result=$($s.result), closedAt=$closedText)⇒ 不抑制"
    return $result
}

function Start-IhuiDeployWindow {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Phase,
        [int]$ExpectedMinutes = 60,
        [string]$Head = ''
    )
    $now = [datetimeoffset]::Now
    $note = ''
    $prev = Read-IhuiDeployWindowState -Path $Path
    if ($prev.Ok -and $prev.State.runId -and $prev.State.runId -ne $RunId) {
        $note = "覆盖上一窗口 runId=$($prev.State.runId) result=$($prev.State.result)"
    }
    $state = @{
        schema        = 1
        runId         = $RunId
        phase         = $Phase
        startedAt     = $now
        heartbeatAt   = $now
        expectedEndAt = $now.AddMinutes($ExpectedMinutes)
        closedAt      = $null
        result        = ''
        settleUntil   = $null
        head          = $Head
        reason        = $note
    }
    $w = Write-IhuiDeployWindowState -Path $Path -State $state
    if ($w.Ok) {
        $script:DeployWindowLastHeartbeat = Get-Date
    }
    return @{ Ok = $w.Ok; Error = $w.Error; State = $state; Note = $note }
}

function Update-IhuiDeployWindowPhase {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Phase,
        [int]$ExpectedMinutes = 0
    )
    $read = Read-IhuiDeployWindowState -Path $Path
    if (-not $read.Ok) { return @{ Ok = $false; Error = $read.Error } }
    $s = $read.State
    if ($s.closedAt) { return @{ Ok = $false; Error = '窗口已收口,拒绝更新阶段' } }
    if ($RunId -and $s.runId -and $s.runId -ne $RunId) {
        return @{ Ok = $false; Error = "runId 不匹配(窗口=$($s.runId), 调用=$RunId)" }
    }
    $now = [datetimeoffset]::Now
    $s.phase = $Phase
    $s.heartbeatAt = $now
    if ($ExpectedMinutes -gt 0) { $s.expectedEndAt = $now.AddMinutes($ExpectedMinutes) }
    $w = Write-IhuiDeployWindowState -Path $Path -State $s
    if ($w.Ok) { $script:DeployWindowLastHeartbeat = Get-Date }
    return @{ Ok = $w.Ok; Error = $w.Error }
}

function Update-IhuiDeployWindowHeartbeat {
    <#
      长任务里的续命。RunId 为空 = "续当前活动窗口"(部署环不知道子进程生成的 runId 时用)。
      节流状态放在脚本作用域,不读盘;MinIntervalSeconds=0 表示每次都写(测试用)。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$RunId = '',
        [int]$MinIntervalSeconds = 15
    )
    if ($MinIntervalSeconds -gt 0) {
        $last = $script:DeployWindowLastHeartbeat
        if ($last -is [datetimeoffset]) { $last = $last.LocalDateTime }
        if ($last -is [datetime] -and $last -ne [datetime]::MinValue) {
            if (((Get-Date) - $last).TotalSeconds -lt $MinIntervalSeconds) {
                return @{ Ok = $true; Written = $false; Error = '' }
            }
        }
    }
    $read = Read-IhuiDeployWindowState -Path $Path
    if (-not $read.Ok) { return @{ Ok = $false; Written = $false; Error = $read.Error } }
    $s = $read.State
    if ($s.closedAt) { return @{ Ok = $true; Written = $false; Error = '' } }
    if ($RunId -and $s.runId -and $s.runId -ne $RunId) {
        return @{ Ok = $false; Written = $false; Error = "runId 不匹配(窗口=$($s.runId), 调用=$RunId)" }
    }
    $s.heartbeatAt = [datetimeoffset]::Now
    $w = Write-IhuiDeployWindowState -Path $Path -State $s
    if ($w.Ok) { $script:DeployWindowLastHeartbeat = Get-Date }
    return @{ Ok = $w.Ok; Written = $w.Ok; Error = $w.Error }
}

function Close-IhuiDeployWindow {
    <#
      runId 守卫:一个部署轮不得关掉另一个 runId 的活动窗口。
      已收口的不覆盖:部署脚本先写 success,部署环随后看到的是 closed,不得把它改成 failed。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$Result,
        [string]$Head = '',
        [int]$SettleMinutes = 15,
        [string]$Reason = ''
    )
    $read = Read-IhuiDeployWindowState -Path $Path
    $now = [datetimeoffset]::Now
    if ($read.Ok) {
        $s = $read.State
        if ($RunId -and $s.runId -and $s.runId -ne $RunId) {
            return @{ Ok = $false; Skipped = $true; Error = "runId 不匹配(窗口=$($s.runId), 调用=$RunId)" }
        }
        if ($s.closedAt) {
            return @{ Ok = $true; Skipped = $true; Error = '' }
        }
    } else {
        $s = @{
            schema        = 1
            runId         = $RunId
            phase         = 'closed'
            startedAt     = $now
            heartbeatAt   = $now
            expectedEndAt = $null
            closedAt      = $null
            result        = ''
            settleUntil   = $null
            head          = ''
            reason        = ''
        }
    }
    $s.closedAt = $now
    $s.heartbeatAt = $now
    $s.result = $Result
    if ($Head) { $s.head = $Head }
    if ($Reason) { $s.reason = $Reason }
    if ($Result -eq 'success') {
        $s.settleUntil = $now.AddMinutes($SettleMinutes)
    } else {
        $s.settleUntil = $null
    }
    $w = Write-IhuiDeployWindowState -Path $Path -State $s
    return @{ Ok = $w.Ok; Skipped = $false; Error = $w.Error }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
