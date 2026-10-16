# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# 告警去重的共享实现(2026-09-28 立)
#
# 为什么必须有这一份:两处到人告警生产者(`deploy/win/ihui-deploy.ps1` 的失败告警、
# `deploy/win/ihui-monitor.ps1` 的巡检告警)**各自**实现过一遍"按签名去重",而两份实现
# 共用同一条致命结构缺陷 —— **状态文件只有一个槽**:`{sig, sigTs, repeatNo}`。
# 后果实测(2026-09-28 取证):近 48h 部署环寄出 **47 封**,全部是同一件事"ff 切流被挡";
# 同一故障有两条措辞("远端分叉需人工收敛" / "有未提交文件挡住 ff")随现场交替出现,
# 每次交替都:① 被当成一个全新告警立即另发;② 顺手把另一条的时间戳覆盖掉 ⇒ 4h 重发窗口
# 结构上永不命中。监控那侧同型:web 掉线与 api 掉线交替时互相抹时间戳。
# 所以去重身份**必须按签名分槽存**,而不是"最近那一条"。
#
# 版本兼容:**本模块刻意不写 `#requires -Version 7`**。
# `ihui-deploy.ps1` 要求 PS7,但 `ihui-monitor.ps1` 不要求,而 IHUI-MONITOR 服务由
# `C:\windows\System32\WindowsPowerShell\v1.0\powershell.exe` 拉起 —— 本机该文件实读是 7.6.2,
# 但 Gitee 取证记录过另一份 checkout 上是 5.1.26100(AGENTS「凡机器事实每次现取」口径)。
# 若本模块要求 PS7,在 5.1 机器上它会**加载失败**,表现不是报错而是监控静默不再发信 ——
# 那比现在的噪声严重得多。故这里只用两版通用的语法。
#
# 唯一到人通道是邮件,且**禁止任何"每日 N 封"总量封顶**(AGENTS §5e):这里只做按身份去重。
# 读不到状态文件/状态读不懂 ⇒ 判 `undetermined` 并**照旧寄**(宁可多喊一次),绝不静默
# 当作"已经寄过"——那等于把告警变成哑弹,而哑弹的症状就是安静。
# =============================================================================

function Get-AlertDedupKey {
    # 签名可能很长且含换行/中文 ⇒ 用 SHA-256 前 16 位当槽键,同时保留一段人类可读标签。
    param([Parameter(Mandatory = $true)][string]$Sig)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Sig)
        $hash = $sha.ComputeHash($bytes)
        $hex = ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
        return $hex.Substring(0, 16)
    } finally {
        $sha.Dispose()
    }
}

function ConvertTo-AlertInstant {
    <#
      档案里的时间戳 → **一个本地时刻的 DateTime**;取不到有效时刻返回 $null(调用方按未判定处理)。
      为什么必须有这一层(2026-10-11 实测,不是假想):`ConvertFrom-Json` 会把 ISO 串**自动转成 DateTime**
      (串尾 `Z`⇒Kind=Utc、`+08:00`⇒Local、裸串⇒Unspecified),而旧写法紧接着用 `[string]$x` 把它
      又转回文本 —— `[string]` 走**当前区域**格式(本机渲染成 `10/11/2026 17:31:30`),而区域格式
      **不带时区** ⇒ 一次 UTC 墙钟被当成一次本地墙钟,在本机(+08:00)整整差 8 小时。
      差 8 小时的后果就是本模块存在的理由本身失效:4h 重发窗口与 20min 抑制宽限全都算错,
      而且算错的方向是"到得比该到的早/晚",账面却完全安静。生产档案里当场能看到两种坏值
      (裸 ISO `...T17:16:32.0000000` 与区域串 `10/11/2026 17:31:30`),所以这不是测试夹具现象。
      三条不许漂的写法:
        1) DateTime 一律就地用,绝不再经 `[string]` 中转(那一步就是丢时区的那一步);
        2) Kind=Utc 必须 ToLocalTime();
        3) Kind=Unspecified(裸串)按**本地墙钟**解释,并显式 SpecifyKind 成 Local —— 它已无法自证出处,
           猜成 UTC 会凭空挪 8 小时,而"按本地墙钟用"与改动前所有本地生产者写入的数字逐字一致。
    #>
    param($Value)
    if ($null -eq $Value) { return $null }
    $d = $null
    if ($Value -is [datetime]) {
        $d = $Value
    } else {
        $s = ([string]$Value).Trim()
        if (-not $s) { return $null }
        try { $d = [datetime]$s } catch { return $null }
    }
    if ($d.Kind -eq [System.DateTimeKind]::Utc) { return $d.ToLocalTime() }
    if ($d.Kind -eq [System.DateTimeKind]::Unspecified) {
        return [System.DateTime]::SpecifyKind($d, [System.DateTimeKind]::Local)
    }
    return $d
}

function ConvertTo-AlertTimestampText {
    # 时间戳进出档案的**唯一**文本形态:可 round-trip 的 ISO(必带偏移)。
    # 解析不出来的原样返回文本,让读侧把它报成未判定 —— 不得凭空造一个时刻,也不得悄悄丢一格。
    param($Value)
    if ($null -eq $Value) { return '' }
    $d = ConvertTo-AlertInstant -Value $Value
    if (-not $d) { return [string]$Value }
    return $d.ToString('o')
}

function Read-AlertDedupState {
    # 返回 @{ Found=$true|$false; Map=<key → entry>; Error='<判不出的原因>' }
    # 三态严格分开:文件不存在 = 没有历史(正常首寄);文件存在但读不懂 = undetermined(必须喊出来)。
    param([Parameter(Mandatory = $true)][string]$StateFile)
    if (-not (Test-Path -LiteralPath $StateFile)) {
        return @{ Found = $false; Map = @{}; Error = $null }
    }
    $raw = $null
    try {
        $raw = [System.IO.File]::ReadAllText($StateFile)
    } catch {
        return @{ Found = $true; Map = @{}; Error = "状态文件读不出: $($_.Exception.Message)" }
    }
    $obj = $null
    try {
        $obj = $raw | ConvertFrom-Json
    } catch {
        return @{ Found = $true; Map = @{}; Error = '状态文件不是合法 JSON(可能被并发写坏或手工改过)' }
    }
    $map = @{}
    if ($obj -and $obj.alerts) {
        foreach ($p in @($obj.alerts.PSObject.Properties)) {
            if (-not $p.Value) { continue }
            $stall = $false
            if ($null -ne $p.Value.stall) { [void]([bool]::TryParse([string]$p.Value.stall, [ref]$stall)) }
            $map[$p.Name] = @{ sigTs = ConvertTo-AlertTimestampText -Value $p.Value.sigTs; firstTs = ConvertTo-AlertTimestampText -Value $p.Value.firstTs; repeatNo = [int]$p.Value.repeatNo; lastSend = ConvertTo-AlertTimestampText -Value $p.Value.lastSend; label = [string]$p.Value.label; stall = $stall }
        }
        return @{ Found = $true; Map = $map; Error = $null }
    }
    # 旧格式(单槽 v1)只认这一次:把它当成"一条历史记录"种进新表,而不是整表作废。
    # 整表作废会让"刚刚寄过"的那条重发,而单槽残留又正是本次要修的缺陷本身。
    if ($obj -and $obj.sig -and $obj.sigTs) {
        $key = Get-AlertDedupKey -Sig ([string]$obj.sig)
        $label = [string]$obj.sig
        if ($label.Length -gt 120) { $label = $label.Substring(0, 120) }
        $map[$key] = @{ sigTs = ConvertTo-AlertTimestampText -Value $obj.sigTs; firstTs = ConvertTo-AlertTimestampText -Value $obj.sigTs; repeatNo = 0; lastSend = ConvertTo-AlertTimestampText -Value $obj.sigTs; label = $label }
        return @{ Found = $true; Map = $map; Error = '状态文件是旧单槽格式,已按一条历史记录迁入分槽表' }
    }
    return @{ Found = $true; Map = @{}; Error = '状态文件里没有可解析的去重记录(alerts 与 sig 两形态都缺)' }
}

function Write-AlertDedupState {
    param(
        [Parameter(Mandatory = $true)][string]$StateFile,
        [Parameter(Mandatory = $true)][System.Collections.Hashtable]$Map,
        [int]$MaxEntries = 50
    )
    # 只留最近 N 条:无上限会让状态文件随签名数无限增长(每轮换措辞都会新增一条),
    # 而 N 条窗口足够覆盖"同一故障两条措辞交替"这一型(实测交替只有 2-4 种)。
    $sortHelp = @{}
    foreach ($k in $Map.Keys) {
        $ls = $Map[$k].lastSend
        $t = [DateTime]::MinValue
        $cand = ConvertTo-AlertInstant -Value $ls
        if ($cand) { $t = $cand }
        $sortHelp[$k] = $t
    }
    $ordered = @($Map.Keys | Sort-Object { $sortHelp[$_] } -Descending)
    if ($ordered.Count -gt $MaxEntries) { $ordered = @($ordered[0..($MaxEntries - 1)]) }
    $alerts = [ordered]@{}
    foreach ($k in $ordered) {
        # 三个时间戳必须走同一个文本出口:这里曾是 `[string]$Map[$k].sigTs`,而 `[string]` 作用在
        # DateTime 上走当前区域格式(不带时区)—— 写出去的那一刻就把这一格永久降级成"读不回来的串",
        # 而档案里那些 `10/11/2026 17:31:30` 就是这么攒出来的(见 ConvertTo-AlertInstant 头注)。
        $alerts[$k] = [ordered]@{
            sigTs    = ConvertTo-AlertTimestampText -Value $Map[$k].sigTs
            firstTs  = ConvertTo-AlertTimestampText -Value $Map[$k].firstTs
            repeatNo = [int]$Map[$k].repeatNo
            lastSend = ConvertTo-AlertTimestampText -Value $Map[$k].lastSend
            label    = [string]$Map[$k].label
            stall    = [bool]$Map[$k].stall
        }
    }
    $doc = [ordered]@{ version = 2; alerts = $alerts }
    $dir = Split-Path $StateFile -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    # 先写临时名再 Move,避免并发读者读到半截 JSON(两个服务同写一份状态文件是本仓常态)。
    $tmp = "$StateFile.tmp-$PID"
    [System.IO.File]::WriteAllText($tmp, (ConvertTo-Json $doc -Depth 5), [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $StateFile -Force
    return $ordered.Count
}

function Test-AlertDueByIdentity {
    <#
      按**签名分槽**判定"这一件事现在该不该再寄一次",并在判"该寄"时立刻登记。
      返回 @{ Due; Decision; Note; Key }
        Decision = 'window-hit'   同身份未到重发周期 ⇒ 不寄(这是去重真正在工作)
                 | 'due-new'      没有该身份的记录 ⇒ 寄第一封
                 | 'due-repeat'   同身份到点重发 ⇒ 寄,并在正文标持续时长/序号
                 | 'undetermined' 状态读不懂 ⇒ 仍判寄(宁多喊一次),Note 里带原因
      调用方必须把 Note 原样写进正文/日志(抑制与放行的理由都要可见)。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Sig,
        [Parameter(Mandatory = $true)][string]$StateFile,
        [Parameter(Mandatory = $true)][double]$RepeatHours,
        [int]$MaxEntries = 50,
        # stall=$true 把这一格登记成"本轮未切流"类故障 ⇒ 它有一个**终态**:部署环一旦成功切流,
        # 这条身份就被 Clear-AlertStallIdentities 摘掉。没有终态的 4h 重发会把已恢复的故障
        # 一直寄下去(2026-10-10 实测:同一身份 repeatNo=40,而这期间线上完成过 92 次切流)。
        # 默认 $false = 与改动前逐字同形(可与他种成功共存的故障不得被清偿,否则每轮重寄)。
        [switch]$Stall
    )
    $key = Get-AlertDedupKey -Sig $Sig
    $state = Read-AlertDedupState -StateFile $StateFile
    $map = $state.Map
    $now = Get-Date
    $label = $Sig -replace '\s+', ' '
    if ($label.Length -gt 120) { $label = $label.Substring(0, 120) }
    $undeterminedNote = ''
    if ($state.Error) { $undeterminedNote = "`n- 备注: 去重状态不可用($($state.Error)),本轮按'未寄过'处理并照常寄出" }

    if ($map.ContainsKey($key)) {
        $e = $map[$key]
        $prev = $null
        if ($e.sigTs) { $prev = ConvertTo-AlertInstant -Value $e.sigTs }
        if ($prev) {
            $ageH = ($now - $prev).TotalHours
            if ($ageH -ge 0 -and $ageH -lt $RepeatHours) {
                # **抑制也必须可审计**(§5e"失败必须响"的另一半):这一行一天能有 200+ 条,而原先不写
                # "压住的是哪件事",于是"这段时间一共压住了几件不同的故障"从日志结构上判不出来 ——
                # 读数的人只能看到一堆跳过,真被掩盖的那一件与正常的那一件长得一模一样。
                # 这里只把**去重键本身**与一小段可读标签打进日志行,**判定一字未动**(Due/Decision/Key 全同形),
                # 所以它不会让任何一条本来会寄的信被压掉,也不会让本来被压的寄出去。
                $short = $label
                if ($short.Length -gt 60) { $short = $short.Substring(0, 60) }
                return @{ Due = $false; Decision = 'window-hit'; Key = $key; Note = "同身份告警 $([Math]::Round($ageH, 1))h 前已寄过(未到 ${RepeatHours}h 重发周期),本轮跳过 | 身份=$key | 摘要=$short" }
            }
            $firstTs = $prev
            if ($e.firstTs) { $ff = ConvertTo-AlertInstant -Value $e.firstTs; if ($ff) { $firstTs = $ff } }
            $repeatNo = [int]$e.repeatNo + 1
            $durH = [Math]::Round(($now - $firstTs).TotalHours, 1)
            $note = "`n- 备注: 同一故障已持续 ${durH} 小时,本条为第 $($repeatNo + 1) 次重发(每 $RepeatHours 小时一次;其他身份的变化不影响本条)" + $undeterminedNote
            $map[$key] = @{ sigTs = $now.ToString('o'); firstTs = $firstTs.ToString('o'); repeatNo = $repeatNo; lastSend = $now.ToString('o'); label = $label; stall = [bool]$Stall }
            try { Write-AlertDedupState -StateFile $StateFile -Map $map -MaxEntries $MaxEntries | Out-Null } catch { }
            return @{ Due = $true; Decision = 'due-repeat'; Key = $key; Note = $note }
        }
        # 记录在位但时间戳解析不出 ⇒ 不按"已寄过"处理(那会静默),也不假装新故障
    }

    $map[$key] = @{ sigTs = $now.ToString('o'); firstTs = $now.ToString('o'); repeatNo = 0; lastSend = $now.ToString('o'); label = $label; stall = [bool]$Stall }
    $decision = 'due-new'
    $note = ''
    if ($state.Error) { $decision = 'undetermined'; $note = $undeterminedNote }
    try { Write-AlertDedupState -StateFile $StateFile -Map $map -MaxEntries $MaxEntries | Out-Null } catch { }
    return @{ Due = $true; Decision = $decision; Key = $key; Note = $note }
}

function Test-AlertSuppressionGrace {
    <#
      「按预期现象抑制告警」必须带时长上限 —— 2026-09-29 实测事故:IHUI-API 崩溃循环连续 2 小时 39 分
      (Loki 现读 `{job="api"} |= "does not provide an export named"` 777 次,首 22:17:49 / 末 00:57:11,
      无 >5 分钟中断 ⇒ 约每 12 秒被 nssm 拉活一次),而监控每 5 分钟都把诊断落在 `[部署重启中-预期现象]`(部署环被挡住时每 ~85 秒
      重跑一轮、每轮都刷新 `deploy-loop.log` 的 mtime,而 `Get-Diagnosis` 那条"最近构建于 X 分钟前 ≤ 15"
      正是读这个 mtime ⇒ 判据**永远**成立),于是每轮只写一行 [INFO] 就 return。
      抑制本身是对的(换流窗口的短暂拒连确属预期),错的是它**没有终态**:一个会自己结束的现象被当成
      永久豁免,而"永久豁免"的症状就是安静 —— 与去重那侧"读不懂就静默当作已寄过"是同一条禁令。

      返回 @{ Suppressed; ElapsedMinutes; Decision; Note }
        Decision = 'grace-window'    仍在宽限窗内 ⇒ 抑制(ElapsedMinutes 必须写进日志,让人看得见"还差多久升级")
                 | 'grace-reopened'  这条身份已断了一个窗以上 ⇒ 视为**新一轮**预期窗口,重新起锚并抑制
                                      (不这样修就会造出新的假阳:上周一次部署留下的旧锚,会让今天正常
                                       的 3 分钟换流在第一轮就直接寄信 —— 修噪声不能以造噪声为代价)
                 | 'escalated'       连续抑制已超过 GraceMinutes ⇒ **不再抑制**,交回正常发信路径
                 | 'undetermined'    状态读不出/时间戳解析不出 ⇒ 同样不抑制(宁可多喊一次)
      与 Test-AlertDueByIdentity 共用同一份状态档案,但身份键带 `grace:` 前缀 ⇒ 两种语义永不互相顶账。
      调用方**必须**把 Note 落到日志或正文:抑制的理由和放行的理由一样都要可见。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Sig,
        [Parameter(Mandatory = $true)][string]$StateFile,
        [Parameter(Mandatory = $true)][int]$GraceMinutes,
        [int]$MaxEntries = 50,
        # 同 Test-AlertDueByIdentity 的 -Stall:标出"这一格属于切流受阻类",成功切流时锚点与身份
        # **一起**退休。只清身份不清锚点会造出更坏的形态 —— 锚点还挂在上一段停摆的起点上,
        # 恢复后的第一次被挡直接判"超窗",于是每段都秒寄(2026-10-10 由行为测试 T5 抓出)。
        [switch]$Stall
    )
    $clean = ($Sig -replace '\s+', ' ').Trim()
    if ($clean.Length -gt 120) { $clean = $clean.Substring(0, 120) }
    $key = Get-AlertDedupKey -Sig ("grace:" + $clean)
    $now = Get-Date
    $state = Read-AlertDedupState -StateFile $StateFile

    if ($state.Error) {
        return @{ Suppressed = $false; ElapsedMinutes = 0; Decision = 'undetermined'; Key = $key;
                  Note = "抑制档案读不出($($state.Error))⇒ 不按预期现象抑制,本轮照常告警" }
    }
    $map = $state.Map
    $label = $clean

    $entry = $null
    if ($map.ContainsKey($key)) { $entry = $map[$key] }

    $anchor = $null
    $lastSeen = $null
    if ($entry) {
        if ($entry.firstTs) { $anchor = ConvertTo-AlertInstant -Value $entry.firstTs }
        if ($entry.lastSend) { $lastSeen = ConvertTo-AlertInstant -Value $entry.lastSend }
        if (-not $lastSeen -and $entry.sigTs) { $lastSeen = ConvertTo-AlertInstant -Value $entry.sigTs }
    }

    $decision = $null
    if (-not $entry -or -not $anchor -or -not $lastSeen) {
        # 没有条目 = 第一次;有条目但时刻解析不出 = 判不出。前者起锚抑制,后者**不抑制**。
        if (-not $entry) { $anchor = $now; $decision = 'grace-window' }
        else {
            return @{ Suppressed = $false; ElapsedMinutes = 0; Decision = 'undetermined'; Key = $key;
                      Note = '抑制档案里的时刻解析不出 ⇒ 不按预期现象抑制,本轮照常告警' }
        }
    } elseif (($now - $lastSeen).TotalMinutes -gt $GraceMinutes) {
        $anchor = $now
        $decision = 'grace-reopened'
    } else {
        $decision = 'grace-window'
    }

    $elapsed = [Math]::Round(($now - $anchor).TotalMinutes, 1)
    $suppressed = $true
    $note = "预期窗口内已连续抑制 ${elapsed} 分钟(上限 ${GraceMinutes} 分钟,超期即转为正式告警)"
    if ($decision -eq 'grace-reopened') { $note = "距上次同身份抑制已超一个窗口,按新一轮预期现象重新起锚;" + $note }
    if ($elapsed -ge $GraceMinutes) {
        $suppressed = $false
        $note = "预期窗口已连续 ${elapsed} 分钟(上限 ${GraceMinutes} 分钟)⇒ 不再按预期现象抑制,本条是正式告警"
        $decision = 'escalated'
    }

    $map[$key] = @{ sigTs = $now.ToString('o'); firstTs = $anchor.ToString('o'); repeatNo = 0; lastSend = $now.ToString('o'); label = $label; stall = [bool]$Stall }
    try { Write-AlertDedupState -StateFile $StateFile -Map $map -MaxEntries $MaxEntries | Out-Null } catch { }
    return @{ Suppressed = $suppressed; ElapsedMinutes = $elapsed; Decision = $decision; Key = $key; Note = $note }
}

function Clear-AlertStallIdentities {
    <#
      故障的**终态**:部署环成功切流了,那么"本轮未切流"这一类告警就已经不成立了 —— 把它们从
      去重档案里摘掉,让下一次发生重新按"新故障"计时。
      为什么必须由成功切流来清、而不是等 4 小时窗口自己过:窗口只会"到点再寄一封",它不知道
      中间已经恢复过。2026-10-10 现读同一身份 repeatNo=40(firstTs 09-29),而这段时间日志里有
      92 行"部署完成"⇒ 那些重发信里没有一封对应一次真实停摆。
      只摘 `stall=true` 的条目:`grace:` 前缀的抑制锚点与非切流类(如 DB 迁移未落地 —— 它按设计
      与成功切流共存)都必须原样留着,否则后者会在下一次成功后的**每一轮**重寄,修噪声变成造噪声。
      返回 @{ Ok; Cleared; Labels; Error } —— 档案读不出时 Ok=$false 并带原因,调用方必须把原因
      打进日志:把"没清成"写成"已清"就是把没判当成判过了。
    #>
    param(
        [Parameter(Mandatory = $true)][string]$StateFile,
        [int]$MaxEntries = 50
    )
    $state = Read-AlertDedupState -StateFile $StateFile
    if ($state.Error) {
        return @{ Ok = $false; Cleared = 0; Labels = @(); Error = $state.Error }
    }
    $map = $state.Map
    $stallKeys = @($map.Keys | Where-Object { $map[$_].stall })
    if ($stallKeys.Count -eq 0) {
        return @{ Ok = $true; Cleared = 0; Labels = @(); Error = $null }
    }
    $labels = @($stallKeys | ForEach-Object { [string]$map[$_].label })
    foreach ($k in $stallKeys) { $map.Remove($k) }
    try {
        Write-AlertDedupState -StateFile $StateFile -Map $map -MaxEntries $MaxEntries | Out-Null
    } catch {
        return @{ Ok = $false; Cleared = 0; Labels = $labels; Error = "清偿写不回去: $($_.Exception.Message)" }
    }
    return @{ Ok = $true; Cleared = $stallKeys.Count; Labels = $labels; Error = $null }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
