# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# deploy\win\deploy-lock-common.ps1 — 部署并发锁的**唯一**存活性判据(2026-09-26 立)
#
# 立因(本机真实生产冻结,证据在 deploy\win\deploy-loop.log):
#   机器 07:58:10 重启;锁文件 mtime 停在 04:53、内容是裸 pid `8052`(那正是重启前
#   部署守护自己的 pid)。重启后 pid 8052 被 postgres.exe(启动时刻 07:58:15)复用,
#   而旧判据只有一句 `$null -ne (Get-Process -Id 8052)` ⇒ 恒真 ⇒ **连续 46 分钟每轮
#   都 return,零次部署**,线上产物停在旧提交。
#   同一型缺陷本仓已记两次:`scripts/deploy-lock.mjs`(G-193,冻结 11h50m)、
#   `scripts/git-lock.mjs`(AGENTS §12)—— 都是**拿可被复用的身份(pid)当活性判据**。
#   这是第三次,所以这次一次把判据修对,而不是"再加一个锁龄"。
#
# 判据(四条**同时**成立才认定"仍被持有";任一正向不成立 ⇒ 判陈旧并可清理):
#   C1 进程存在            —— 进程不在,锁必然无主
#   C2 StartTime <= writtenAt(+容差)
#                          —— 一个进程不可能在它出现之前写下锁;这一条就是今早
#                             pid 复用的解药(postgres 07:58:15 > 锁 04:53 ⇒ 陈旧)
#   C3 bootId 与当前机器启动标识一致
#                          —— 跨重启的锁**必然**无主,与 pid 是否被复用无关
#   C4 heartbeatAt 距今 <= HeartbeatMaxMinutes
#                          —— 持有者必须在长任务里持续续心跳;不再续 = 已死
#
# 反向护栏(与判据同等重要,否则就是一台会把并发构建撞坏的尺子):
#   **不得**把"正在构建中"的锁误判成陈旧。为此:
#     · C2 只在"明确晚于 writtenAt + 容差"时判陈旧(见 $StartToleranceSeconds);
#     · 读不到 StartTime / 内容解析不出 都不是"陈旧",而是 `undetermined` ——
#       本轮**让路**(不抢锁),但必须大声喊出原因(§5e 失败必须响);
#     · C3 取不到(锁侧没有 bootId,或本机 CIM 与 TickCount 两个源都失败)只算**跳过**,
#       不降级成未判定:否则升级窗口里老守护留在盘上的裸 pid 锁会一路挂到绝对上限
#       (按推演 = 又一次三小时冻结)。跨重启那一型仍由 C2 独立兜住(重启后出生的
#       进程必然晚于 writtenAt)。取证:file_legacy_live_holder(旧格式活锁⇒持有)
#       与 file_legacy_pid_reused(旧格式跨重启现场⇒C2 判陈旧)那一对;
#     · `undetermined` 的绝对上限是 HardCapMinutes(按锁龄),超过才抢占;
#       正常持有(四条全过)**不受** HardCap 约束,长构建不会被抢。
#
# 阈值依据(不拍脑袋):
#   HeartbeatMaxMinutes = 45
#     相邻两次心跳之间最长的**合法**无心跳段由代码自己钉住:一次 `next build` try 的
#     墙钟 30 分钟(ihui-deploy.ps1:562 `WaitForExit(30*60*1000)`,try 内不可中断)
#     + 健康门禁最长约 9.6 分钟(8 轮 × 12s 间隔 + 每轮 3 次探测各 ≤20s)≈ 40 分钟,
#     取 45 分钟留余量。它同时不小于守护自身的单轮墙钟预算 $RunBudgetMin=45。
#   HardCapMinutes = 180
#     最坏合法单元 = 4 次构建 try × 30 分钟(ihui-deploy.ps1:512 $MaxTries=4)= 120 分钟,
#     取 180 = 120 + 50% 余量。只用于"判不出"那一支,不用于正常持有。
#     (与 deploy-lock.mjs 的 30 分钟硬上限不同:那里一个单元是**一次构建**,这里是
#      **整轮部署+门禁**,量的是不同东西,不得互相"对齐"数字。)
#
# 用法(两个读者必须走同一份实现,禁止再各写一遍 Get-Process):
#   . (Join-Path $PSScriptRoot 'deploy-lock-common.ps1')
#   $st = Resolve-IhuiDeployLockState -Path $LockFile -OwnerKind 'loop'
#   if ($st.ShouldHold) { return }                       # held / undetermined 都让路
#   if ($st.LockExists) { Clear-IhuiDeployLockStale -Path $LockFile -State $st }
#   Write-IhuiDeployLock -Path $LockFile -OwnerKind 'loop'
#   ... 长任务里周期性 Update-IhuiDeployLockHeartbeat -Path $LockFile -OwnerKind 'loop'
#   Remove-IhuiDeployLock -Path $LockFile -OwnerKind 'loop'   # 只删自己那把
#
# 取证:`node --test deploy/tests/deploy-lock-liveness.test.mjs`
#   (四条判据各自独立把陈旧态判下来 + "四条全满足 ⇒ 判持有、不抢锁"的反例)
# =============================================================================

# ── 默认阈值(集中一处;调用点不抄第二份数字) ──────────────────────────────
$script:IhuiLockHeartbeatMaxMinutes  = 45
$script:IhuiLockHardCapMinutes       = 180
$script:IhuiLockStartToleranceSec    = 5      # 时钟粒度/CIM 采样偏差的容差,见文件头
$script:IhuiLockHeartbeatMinGapSec   = 15     # 心跳节流:轮询 700ms 一次,不必每拍写盘

# ── 时刻归一(全库唯一的"哪个 Kind 算什么"出口)────────────────────────────
# 为什么必须有它:本机时钟是 UTC(日志戳一律 `+00:00`),所以"把 Local 当 UTC"这类
# 错误在这台机上**量不出来** —— 偏移恰好是 0。换到 UTC+8 的机器上,同一个错会让
# 心跳看起来老 8 小时 ⇒ C4 把**正在构建**的锁判陈旧并抢占。那正是本票要防的反向事故,
# 所以所有时刻都必须经此归一后再比较。
# 约定:Utc 原样;Local 换算;Unspecified 按 Local 处理(与 CIM LastBootUpTime、
# Process.StartTime、Win32_Process.CreationDate 的实际返回形态一致)。
function ConvertTo-IhuiLockUtc {
    param($Value)
    if ($null -eq $Value) { return $null }
    $d = if ($Value -is [datetime]) { $Value } else { try { [datetime]$Value } catch { return $null } }
    if ($d.Kind -eq [DateTimeKind]::Utc) { return $d }
    if ($d.Kind -eq [DateTimeKind]::Local) { return $d.ToUniversalTime() }
    return ([DateTime]::SpecifyKind($d, [DateTimeKind]::Local)).ToUniversalTime()
}

function Format-IhuiLockUtc {
    param($WhenUtc)
    $u = ConvertTo-IhuiLockUtc $WhenUtc
    if ($null -eq $u) { return '' }
    return $u.ToString('o')
}

# ── 启动标识归一(2026-09-26 实跑抓到的坑,不是防御性冗余)────────────────
# PS7 的 ConvertFrom-Json 会把**长得像 ISO-8601 的字符串自动铸成 DateTime**(实测:
# 锁文件里写的 bootId="2026-09-26T07:58:10.5000000Z" 读回来是 DateTime,
# `[string]` 一格式化变成 "09/26/2026 07:58:10" ⇒ 与当前 bootId 永不相等 ⇒
# **自己刚写下的锁被 C3 判成"机器重启过"并抢占** —— 一个把活锁抢掉的判据比旧判据更糟)。
# 所以两侧都必须过这里:能按时刻解读的按时刻归一,不能的按去空格字符串比。
function Normalize-IhuiBootId {
    param($Value)
    if ($null -eq $Value) { return '' }
    if ($Value -is [datetime]) { return (Format-IhuiLockUtc $Value) }
    $s = ([string]$Value).Trim()
    if ($s -eq '') { return '' }
    $dt = [datetime]::MinValue
    if ([datetime]::TryParse($s, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind, [ref]$dt)) {
        return (Format-IhuiLockUtc $dt)
    }
    return $s
}

# ── 启动标识:一眼看穿"跨重启的锁必然无主" ─────────────────────────────────
# 主源 CIM Win32_OperatingSystem.LastBootUpTime;CIM 不可用时退回
# `[Environment]::TickCount64`(开机至今毫秒数)反推 —— 重启会把它清零,所以它同样是
# "当次启动"的标识。退回值按 10 秒取整:now 与 tickcount 同步前进,差值恒定,只有恰好
# 落在桶边界(约 1ms 宽)才会不同形;宁可因取整判不出(C3 记未判定,不判陈旧),
# 也不要把两次读取的正常抖动读成"机器重启过"而去抢活锁。
function Get-IhuiDeployLockBootId {
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -Property LastBootUpTime -ErrorAction Stop
        if ($null -ne $os -and $null -ne $os.LastBootUpTime) {
            $t = ConvertTo-IhuiLockUtc $os.LastBootUpTime
            if ($null -ne $t) { return $t.ToString('o') }
        }
    } catch { /* CIM 不可用 → 走下面退回源,不静默返回空 */ }
    try {
        $boot = [DateTime]::UtcNow.AddMilliseconds(-[Environment]::TickCount64)
        $floor = [datetime]::new($boot.Ticks - ($boot.Ticks % ([TimeSpan]::TicksPerSecond * 10)), [DateTimeKind]::Utc)
        return $floor.ToString('o')
    } catch { return '' }
}

# ── 进程事实:存在性 + 启动时刻(两个数据源,任一可读即用) ────────────────
# 为什么必须量 StartTime 而不是只看"进程在不在":pid 会被复用,这是本次事故的**全部**成因。
# 为什么要两个源:`Get-Process` 拿不到 StartTime(跨会话/权限/进程刚好退出)时,
# CIM Win32_Process.CreationDate 通常仍读得到;两个源都拿不到才承认"判不出"。
function Get-IhuiDeployLockProcessFacts {
    param([int]$ProcessId)
    $facts = [pscustomobject]@{
        ProcessId     = $ProcessId
        ProcessExists = $false
        StartReadable = $false
        ProcessStartUtc = $null
    }
    if ($ProcessId -le 0) { return $facts }
    $p = $null
    try { $p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue } catch { $p = $null }
    if ($null -ne $p) {
        $facts.ProcessExists = $true
        try {
            $st = ConvertTo-IhuiLockUtc $p.StartTime
            if ($null -ne $st) { $facts.ProcessStartUtc = $st; $facts.StartReadable = $true }
        } catch { /* 读不到:交给下面的 CIM 源 */ }
        try { $p.Dispose() } catch {}
    }
    if ($facts.StartReadable) { return $facts }
    # 第二源(CIM)。它同时负责否证"Get-Process 说没有"这一格 —— 拿不到句柄不等于进程不在。
    try {
        $row = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        if ($null -ne $row) {
            $facts.ProcessExists = $true
            $cd = ConvertTo-IhuiLockUtc $row.CreationDate
            if ($null -ne $cd) { $facts.ProcessStartUtc = $cd; $facts.StartReadable = $true }
        }
        # 两个独立源都说没有 ⇒ 才允许 C1 正向判"进程不存在";只有一源可用时它说了算
    } catch { /* CIM 不可用:保留 Get-Process 的结论 */ }
    return $facts
}

# ── 锁内容归一:结构化 / 旧裸 pid / 不可用 三态 ────────────────────────────
# 三态必须分开(与 deploy-lock.mjs 的认识论同一条):
#   structured  新格式,四条判据都能量
#   legacy      旧裸 pid —— **升级窗口内一定存在**(运行中的守护仍按旧格式写),
#               writtenAt/heartbeatAt 取文件 mtime。今早那把锁走 legacy 路径也能被
#               C2 当场判陈旧(mtime 04:53 < postgres StartTime 07:58:15),不必等 45 分钟。
#   unusable    空文件/半个 JSON/没有 pid ⇒ 判不出,不得凭猜测删锁(见谓词 C0)
function Read-IhuiDeployLockMeta {
    param([Parameter(Mandatory = $true)][string]$Path)
    $absent = [pscustomobject]@{
        Kind = 'absent'; Pid = 0; OwnerKind = ''; WrittenAtUtc = $null
        HeartbeatAtUtc = $null; BootId = ''; FileAgeUtc = $null; Reason = '锁文件不存在'
    }
    if (-not (Test-Path -LiteralPath $Path)) { return $absent }
    $fileAge = $null
    try { $fileAge = (Get-Item -LiteralPath $Path).LastWriteTimeUtc } catch { $fileAge = $null }
    $raw = $null
    try { $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop } catch {
        return [pscustomobject]@{ Kind = 'unusable'; Pid = 0; OwnerKind = ''; WrittenAtUtc = $null
            HeartbeatAtUtc = $null; BootId = ''; FileAgeUtc = $fileAge; Reason = "读不出内容:$($_.Exception.Message)" }
    }
    $txt = if ($null -eq $raw) { '' } else { ([string]$raw).Trim() }
    if ($txt -eq '') {
        return [pscustomobject]@{ Kind = 'unusable'; Pid = 0; OwnerKind = ''; WrittenAtUtc = $null
            HeartbeatAtUtc = $null; BootId = ''; FileAgeUtc = $fileAge; Reason = '锁文件是空文件(0 字节/全空白)' }
    }
    # 旧格式:裸 pid。时间戳只能问文件系统(mtime),bootId 无从得知。
    if ($txt -match '^\d+$') {
        $stamp = if ($null -ne $fileAge) { $fileAge } else { [DateTime]::UtcNow }
        return [pscustomobject]@{ Kind = 'legacy'; Pid = [int]$txt; OwnerKind = 'legacy'
            WrittenAtUtc = $stamp; HeartbeatAtUtc = $stamp; BootId = ''
            FileAgeUtc = $fileAge; Reason = '旧格式裸 pid(时间戳取文件 mtime)' }
    }
    try {
        $o = $txt | ConvertFrom-Json
        if ($null -eq $o) { throw '顶层是 null' }
        if ($o -isnot [psobject]) { throw '顶层不是对象' }
        $pidVal = 0
        if ($null -ne $o.pid) { $pidVal = [int]$o.pid }
        if ($pidVal -le 0) { throw '没有可用的 pid 字段' }
        $written = $null; $beat = $null
        if ($o.psobject.Properties['writtenAt'] -and $o.writtenAt) { $written = ConvertTo-IhuiLockUtc $o.writtenAt }
        if ($o.psobject.Properties['heartbeatAt'] -and $o.heartbeatAt) { $beat = ConvertTo-IhuiLockUtc $o.heartbeatAt }
        if ($null -eq $written) { $written = (ConvertTo-IhuiLockUtc $fileAge) }
        if ($null -eq $written) { $written = [DateTime]::UtcNow }
        if ($null -eq $beat) { $beat = $written }
        $boot = ''
        if ($o.psobject.Properties['bootId'] -and $o.bootId) { $boot = Normalize-IhuiBootId $o.bootId }
        $owner = ''
        if ($o.psobject.Properties['ownerKind'] -and $o.ownerKind) { $owner = [string]$o.ownerKind }
        return [pscustomobject]@{ Kind = 'structured'; Pid = $pidVal; OwnerKind = $owner
            WrittenAtUtc = $written; HeartbeatAtUtc = $beat; BootId = $boot
            FileAgeUtc = $fileAge; Reason = '' }
    } catch {
        return [pscustomobject]@{ Kind = 'unusable'; Pid = 0; OwnerKind = ''; WrittenAtUtc = $null
            HeartbeatAtUtc = $null; BootId = ''; FileAgeUtc = $fileAge
            Reason = "内容解析不出锁元数据:$($_.Exception.Message)" }
    }
}

# ── 谓词(纯函数:不碰文件系统、不派生进程,四条判据的输入全部显式喂进来) ──
# 之所以要求纯:取证必须能构造"pid 是别的真在跑的进程 / bootId 不符 / 心跳过期 /
# 进程不存在"四种现场并各自判陈旧,还得能造出"四条全满足 ⇒ 判持有"的反例。
# 判序 = 短路顺序;每条独立可判陈旧,顺序只影响 Reason 文本,不影响结论。
function Test-IhuiDeployLockHeld {
    param(
        [Parameter(Mandatory = $true)][psobject]$Observation
    )
    $o = $Observation
    $now        = ConvertTo-IhuiLockUtc $o.NowUtc
    if ($null -eq $now) { $now = [DateTime]::UtcNow }
    $hbMax      = if ($null -ne $o.HeartbeatMaxMinutes) { [double]$o.HeartbeatMaxMinutes } else { $script:IhuiLockHeartbeatMaxMinutes }
    $capMax     = if ($null -ne $o.HardCapMinutes) { [double]$o.HardCapMinutes } else { $script:IhuiLockHardCapMinutes }
    $tolSec     = if ($null -ne $o.StartToleranceSeconds) { [double]$o.StartToleranceSeconds } else { $script:IhuiLockStartToleranceSec }
    $checks = [System.Collections.Generic.List[string]]::new()
    $mk = { param($verdict, $reason, $failed)
        [pscustomobject]@{ Verdict = $verdict; Reason = $reason; Failed = $failed; Checks = ($checks -join ' ') } }

    # ── C0 内容可用性:读不出元数据时**四条都无从量起**。
    #     不得把"读不懂"读成"没人持锁"(那是本仓最贵的一型),也不得傻等不给出路:
    #     唯一自动出路是按文件时间的绝对上限。
    if ($null -ne $o.ContentUsable -and -not [bool]$o.ContentUsable) {
        $stamp = if ($null -ne $o.FallbackAgeUtc) { ConvertTo-IhuiLockUtc $o.FallbackAgeUtc } else { $now }
        if ($null -eq $stamp) { $stamp = $now }
        $ageMin = ($now - $stamp).TotalMinutes
        $checks.Add("C0=unusable")
        if ($ageMin -gt $capMax) {
            return & $mk 'stale' "锁内容不可用且按文件时间已超绝对上限($([math]::Round($ageMin,1)) 分钟 > $capMax 分钟)" 'C0-unusable-over-cap'
        }
        return & $mk 'undetermined' "锁内容不可用($($o.ContentReason)),本轮让路不抢锁;超 $capMax 分钟后才清理" 'C0-unusable'
    }
    $checks.Add('C0=usable')

    # ── C1 进程存在 ──
    if (-not [bool]$o.ProcessExists) {
        $checks.Add('C1=gone')
        return & $mk 'stale' "名义持有进程 pid=$($o.Pid) 已不存在" 'C1-process-gone'
    }
    $checks.Add('C1=alive')

    # ── C2 进程启动时刻不得晚于写锁时刻 ──
    $written = $null
    if ($null -ne $o.WrittenAtUtc) { $written = ConvertTo-IhuiLockUtc $o.WrittenAtUtc }
    $start   = $null
    if ($null -ne $o.ProcessStartUtc) { $start = ConvertTo-IhuiLockUtc $o.ProcessStartUtc }
    if ($null -eq $written) {
        $checks.Add('C2=no-writtenAt')
        return & $mk 'undetermined' '锁没写下 writtenAt,无法核对进程启动时刻先后,本轮让路' 'C2-no-written-at'
    }
    if ($null -eq $start) {
        $checks.Add('C2=start-unreadable')
        # 判不出 ≠ 陈旧:让路,但由 C4 + 绝对上限兜住(见下)
    }
    elseif ($start -gt $written.AddSeconds($tolSec)) {
        $checks.Add('C2=reused')
        return & $mk 'stale' ("pid=$($o.Pid) 的进程启动于 {0},晚于写锁时刻 {1}(+$tolSec 秒容差)⇒ pid 已被复用,不是持有者" -f (Format-IhuiLockUtc $start), (Format-IhuiLockUtc $written)) 'C2-pid-reused'
    }
    else { $checks.Add('C2=ok') }

    # ── C3 启动标识 ──
    $bootLock = Normalize-IhuiBootId $o.BootIdLock
    $bootNow  = Normalize-IhuiBootId $o.BootIdCurrent
    if ($bootLock -ne '' -and $bootNow -ne '') {
        if ($bootLock -ne $bootNow) {
            $checks.Add('C3=boot-changed')
            return & $mk 'stale' "锁写下时的机器启动标识 $bootLock 与当前 $bootNow 不符 ⇒ 机器已重启,锁必然无主" 'C3-boot-changed'
        }
        $checks.Add('C3=ok')
    } else {
        # 任一侧取不到 ⇒ 这一条只能跳过。**跳过不等于"判不出"**:C2 已能独立抓住
        # 跨重启的 pid 复用(重启后出生的进程必然晚于锁的 writtenAt),所以旧裸 pid
        # 格式(升级窗口里一定存在,它没有 bootId)仍可被认作"持有"。
        # 反过来若把"跳过"降级成 undetermined,老守护遗留在盘上的裸 pid 锁会一路挂在
        # "未判定"里,直到 180 分钟绝对上限才清 —— 按推演那就是一次三小时部署冻结。
        # 取证对应关系:测试 file_legacy_live_holder 钉"旧格式活锁判持有",
        # file_legacy_pid_reused 钉"旧格式跨重启现场仍被 C2 判下来"。
        $checks.Add('C3=skipped')
    }

    # ── C4 心跳时效 ──
    $beat = $null
    if ($null -ne $o.HeartbeatAtUtc) { $beat = ConvertTo-IhuiLockUtc $o.HeartbeatAtUtc }
    if ($null -eq $beat) {
        $checks.Add('C4=no-heartbeat')
        return & $mk 'undetermined' '锁没写下 heartbeatAt,心跳判据无从量起,本轮让路' 'C4-no-heartbeat'
    }
    $beatAgeMin = ($now - $beat).TotalMinutes
    if ($beatAgeMin -gt $hbMax) {
        $checks.Add('C4=stale')
        return & $mk 'stale' "心跳已 $([math]::Round($beatAgeMin,1)) 分钟未续(上限 $hbMax 分钟)⇒ 持有者不再活动" 'C4-heartbeat-stale'
    }
    if ($beatAgeMin -lt -($tolSec / 60.0) - 1) {
        # 心跳在未来 = 时钟被调过或内容被手改。它不能证明持有,也不能证明不持有:
        # 判不出(让路),由 C4 上限之外的绝对上限兜住。
        $checks.Add('C4=future')
        return & $mk 'undetermined' "心跳时间戳在未来($([math]::Round($beatAgeMin,1)) 分钟),疑似时钟跳变,本轮让路" 'C4-heartbeat-future'
    }
    $checks.Add('C4=ok')

    # ── 收尾:四条都不正向失败;只有"身份无从核对"(C2 读不到启动时刻)才算判不出 ──
    $undetermined = ($checks -join ' ').Contains('C2=start-unreadable')
    if ($undetermined) {
        $ageMin = ($now - $written).TotalMinutes
        if ($ageMin -gt $capMax) {
            $checks.Add("CAP=$([math]::Round($ageMin,1))")
            return & $mk 'stale' "判据无法完全核验且锁龄 $([math]::Round($ageMin,1)) 分钟已超绝对上限 $capMax 分钟 ⇒ 抢占" 'C5-over-hard-cap'
        }
        return & $mk 'undetermined' '进程启动时刻或启动标识取不到,本轮让路不抢锁(超绝对上限才清理)' 'C5-undetermined'
    }
    return & $mk 'held' '四条判据全部成立 ⇒ 仍被持有,不得抢锁' ''
}

# ── 传感器 + 谓词的唯一组合点(读者只调这一句) ────────────────────────────
function Resolve-IhuiDeployLockState {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$OwnerKind = '',
        [double]$HeartbeatMaxMinutes = 0,
        [double]$HardCapMinutes = 0
    )
    if ($HeartbeatMaxMinutes -le 0) { $HeartbeatMaxMinutes = $script:IhuiLockHeartbeatMaxMinutes }
    if ($HardCapMinutes -le 0) { $HardCapMinutes = $script:IhuiLockHardCapMinutes }
    $meta = Read-IhuiDeployLockMeta -Path $Path
    $now = [DateTime]::UtcNow
    # 「锁不存在」是一条**确定的否定事实**,与"内容读不出"(C0 unusable)不同:
    # 它不需要任何判据即可直接持有。若把它喂进 C0,verdict 会是 undetermined ⇒
    # ShouldHold=true ⇒ 守护每一轮都"让路",部署环原地死掉。
    if ($meta.Kind -eq 'absent') {
        return [pscustomobject]@{
            Path = $Path; LockExists = $false; ShouldHold = $false; Verdict = 'absent'
            Failed = ''; Checks = ''; Reason = '锁文件不存在,可直接持有'
            Meta = $meta; Pid = 0; BootIdCurrent = ''
        }
    }
    $usable = ($meta.Kind -eq 'structured') -or ($meta.Kind -eq 'legacy')
    $facts = $null
    if ($usable) { $facts = Get-IhuiDeployLockProcessFacts -ProcessId $meta.Pid }
    $bootNow = Get-IhuiDeployLockBootId
    if ($meta.Kind -eq 'unusable' -and $null -eq $meta.FileAgeUtc) {
        return [pscustomobject]@{
            Path = $Path; LockExists = $true; ShouldHold = $true; Verdict = 'undetermined'
            Failed = 'C0-no-mtime'; Checks = ''; Reason = '锁文件在但既读不出内容也量不到 mtime,无从判定'
            Meta = $meta; Pid = 0; BootIdCurrent = $bootNow
        }
    }
    $obs = [pscustomobject]@{
        ContentUsable         = $usable
        ContentReason         = $meta.Reason
        FallbackAgeUtc        = $meta.FileAgeUtc
        Pid                   = $meta.Pid
        ProcessExists         = ($null -ne $facts) -and $facts.ProcessExists
        ProcessStartUtc       = if ($null -ne $facts) { $facts.ProcessStartUtc } else { $null }
        WrittenAtUtc          = $meta.WrittenAtUtc
        HeartbeatAtUtc        = $meta.HeartbeatAtUtc
        BootIdLock            = $meta.BootId
        BootIdCurrent         = $bootNow
        NowUtc                = $now
        HeartbeatMaxMinutes   = $HeartbeatMaxMinutes
        HardCapMinutes        = $HardCapMinutes
    }
    $v = Test-IhuiDeployLockHeld -Observation $obs
    return [pscustomobject]@{
        Path = $Path; LockExists = ($meta.Kind -ne 'absent'); ShouldHold = ($v.Verdict -ne 'stale')
        Verdict = $v.Verdict; Failed = $v.Failed; Checks = $v.Checks; Reason = $v.Reason
        Meta = $meta; Pid = $meta.Pid; BootIdCurrent = $bootNow
    }
}

# 一行可读描述(两个读者/diagnose 共用同一句措辞,避免三种说法)
function Format-IhuiDeployLockState {
    param([Parameter(Mandatory = $true)][psobject]$State)
    $m = $State.Meta
    return ("[{0}] 锁={1} 判定={2} 失败项={3} pid={4} owner={5} kind={6} writtenAt={7} heartbeatAt={8} bootId={9} 依据:{10} 检查:{11}" -f `
        (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'), (Split-Path $State.Path -Leaf), $State.Verdict, `
        $(if ($State.Failed) { $State.Failed } else { '-' }), $m.Pid, $(if ($m.OwnerKind) { $m.OwnerKind } else { '-' }), $m.Kind, `
        $(if ($null -ne $m.WrittenAtUtc) { Format-IhuiLockUtc $m.WrittenAtUtc } else { '-' }), `
        $(if ($null -ne $m.HeartbeatAtUtc) { Format-IhuiLockUtc $m.HeartbeatAtUtc } else { '-' }), `
        $(if ($m.BootId) { $m.BootId } else { '-' }), $State.Reason, $State.Checks)
}

# ── 写锁(结构化元数据) ────────────────────────────────────────────────────
function Write-IhuiDeployLock {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$OwnerKind,
        [datetime]$NowUtc
    )
    if (-not $PSBoundParameters['NowUtc']) { $NowUtc = [DateTime]::UtcNow }
    $stamp = Format-IhuiLockUtc $NowUtc
    $meta = [ordered]@{
        pid         = $PID
        ownerKind   = $OwnerKind
        writtenAt   = $stamp
        bootId      = (Get-IhuiDeployLockBootId)
        heartbeatAt = $stamp
    }
    return (Write-IhuiDeployLockJson -Path $Path -Meta $meta)
}

function Write-IhuiDeployLockJson {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Meta
    )
    $json = $Meta | ConvertTo-Json -Compress
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force -ErrorAction SilentlyContinue | Out-Null
    }
    # 同目录临时文件 + Move-Item -Force:读者绝不会看到半个 JSON(unusable 那一态
    # 本身就是我们要避免的现场,不能由自己的写法造出来)
    $tmp = "$Path.$PID.tmp"
    try {
        [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $Path -Force -ErrorAction Stop
        return $true
    } catch {
        try { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } catch {}
        return $false
    }
}

# ── 心跳续期(长任务里必须真的一直续,否则 C4 会把正在构建的锁判陈旧) ──────
# 只认自己那把:pid 与 ownerKind 都对得上才改,绝不替别人的锁续命、也绝不把别人的
# 锁内容覆盖成自己的。
function Update-IhuiDeployLockHeartbeat {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$OwnerKind,
        [int]$MinIntervalSeconds = 0,
        [datetime]$NowUtc
    )
    if ($MinIntervalSeconds -le 0) { $MinIntervalSeconds = $script:IhuiLockHeartbeatMinGapSec }
    if (-not $PSBoundParameters['NowUtc']) { $NowUtc = [DateTime]::UtcNow }
    try {
        $meta = Read-IhuiDeployLockMeta -Path $Path
        if ($meta.Kind -ne 'structured') { return $false }
        if ($meta.Pid -ne $PID) { return $false }
        if ($meta.OwnerKind -and ($meta.OwnerKind -ne $OwnerKind)) { return $false }
        if ($null -ne $meta.HeartbeatAtUtc) {
            $beat = ConvertTo-IhuiLockUtc $meta.HeartbeatAtUtc
            if ($null -ne $beat -and ($NowUtc - $beat).TotalSeconds -lt $MinIntervalSeconds) { return $false }   # 节流
        }
        $m = [ordered]@{
            pid = $PID; ownerKind = $OwnerKind
            writtenAt = (Format-IhuiLockUtc $meta.WrittenAtUtc)
            bootId = $meta.BootId
            heartbeatAt = (Format-IhuiLockUtc $NowUtc)
        }
        return (Write-IhuiDeployLockJson -Path $Path -Meta $m)
    } catch { return $false }
}

# ── 放锁:只删自己那把(旧裸 pid 格式也要认,升级窗口内运行中的守护写的是旧格式) ──
function Remove-IhuiDeployLock {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$OwnerKind = ''
    )
    try {
        if (-not (Test-Path -LiteralPath $Path)) { return $false }
        $meta = Read-IhuiDeployLockMeta -Path $Path
        if ($meta.Pid -ne $PID) { return $false }        # 不是自己的 ⇒ 不代删
        if ($OwnerKind -and $meta.OwnerKind -and ($meta.OwnerKind -notin @('legacy', $OwnerKind))) { return $false }
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        return $true
    } catch { return $false }
}

# ── 陈旧锁的处置:打印现场 + 删除。删除前必须把判据留下的话讲清楚 ───────────
# (AGENTS §5e"失败必须响";抢占别人的锁是高危动作,日志里要能回答"凭什么抢")
# 删除还要过一次**同一性复核**:判据读到的那份内容与即将删掉的那份必须仍是同一把
# (pid + writtenAt + heartbeatAt 三项全等)。判定与删除之间有窗口,并发部署可能
# 刚好在此刻写下它自己的新锁 —— 那时删掉的就是活锁,正是本票要根治的那一型。
function Clear-IhuiDeployLockStale {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [psobject]$State,
        [scriptblock]$Logger
    )
    $line = Format-IhuiDeployLockState -State $State
    if ($Logger) { & $Logger "陈旧锁清理:$line" } else { Write-Host "陈旧锁清理:$line" }
    try {
        $again = Read-IhuiDeployLockMeta -Path $Path
        if ($again.Kind -ne 'absent') {
            $was = $State.Meta
            $same = ($again.Kind -eq $was.Kind) -and ($again.Pid -eq $was.Pid) `
                -and ((Format-IhuiLockUtc $again.WrittenAtUtc) -eq (Format-IhuiLockUtc $was.WrittenAtUtc)) `
                -and ((Format-IhuiLockUtc $again.HeartbeatAtUtc) -eq (Format-IhuiLockUtc $was.HeartbeatAtUtc))
            if (-not $same) {
                $msg = "陈旧锁清理**取消**:判定之后锁内容已变化(可能有并发持有者刚写下新锁),本轮不动它,下一轮重判"
                if ($Logger) { & $Logger $msg } else { Write-Host $msg }
                return $false
            }
        }
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        return $true
    } catch { return $false }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
