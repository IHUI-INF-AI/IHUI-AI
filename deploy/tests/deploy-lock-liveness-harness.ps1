# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# deploy\tests\deploy-lock-liveness-harness.ps1 — 部署并发锁判据的取证夹具
#
# 由 deploy-lock-liveness.test.mjs 派生(`node --test` 跑),**不**独立使用。
# 为什么用 .ps1 做现场而不是把判据搬到 JS 里测:判据的实现是 PowerShell,在 JS 里
# 重写一份再测就是 §22c 说的"镜像测试只复读实现"—— 测的自己的副本。
# 本夹具做的是另一件事:**造真实现场**(真起一个进程、真的写锁文件、真的改文件
# mtime),把库函数的结论原样吐成 JSON,由 JS 侧断言。
#
# 全程只在 -Scratch 指定目录下写文件,绝不碰 deploy\win\.deploy*.lock(那是生产机
# 正在用的锁)。
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Scratch
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # 结论里含中文,不显式设会被码页吃成乱码

$Lib = Join-Path (Split-Path -Parent $PSScriptRoot) 'win\deploy-lock-common.ps1'
if (-not (Test-Path -LiteralPath $Lib)) { throw "找不到判据实现:$Lib" }
. $Lib

New-Item -ItemType Directory -Path $Scratch -Force | Out-Null
$now = [DateTime]::UtcNow
$out = [ordered]@{}
$childProc = $null

function Add-Case {
    param([string]$Name, [psobject]$Result, [hashtable]$Extra)
    $o = [ordered]@{
        verdict    = $Result.Verdict
        failed     = $Result.Failed
        reason     = $Result.Reason
        checks     = $Result.Checks
        shouldHold = $null
        lockExists = $null
    }
    if ($null -ne $Result.ShouldHold) { $o.shouldHold = [bool]$Result.ShouldHold }
    if ($null -ne $Result.LockExists) { $o.lockExists = [bool]$Result.LockExists }
    if ($Extra) { foreach ($k in $Extra.Keys) { $o[$k] = $Extra[$k] } }
    $script:out[$Name] = $o
}

function New-Obs {
    param([hashtable]$Over)
    $base = @{
        ContentUsable = $true; ContentReason = ''; FallbackAgeUtc = $null
        Pid = 0; ProcessExists = $true; ProcessStartUtc = $null
        WrittenAtUtc = $now.AddMinutes(-5); HeartbeatAtUtc = $now.AddMinutes(-1)
        BootIdLock = 'BOOT-A'; BootIdCurrent = 'BOOT-A'
        NowUtc = $now; HeartbeatMaxMinutes = 45; HardCapMinutes = 180; StartToleranceSeconds = 5
    }
    foreach ($k in $Over.Keys) { $base[$k] = $Over[$k] }
    return [pscustomobject]$base
}

try {
    # ── 真实现场:一个刚启动的真进程 + 一个确定不存在的 pid ─────────────────
    $childProc = Start-Process -FilePath (Get-Process -Id $PID).Path `
        -ArgumentList '-NoProfile', '-Command', 'Start-Sleep -Seconds 60' `
        -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $youngPid = $childProc.Id
    $youngFacts = Get-IhuiDeployLockProcessFacts -ProcessId $youngPid

    $allIds = (Get-Process).Id
    $freePid = ([int]($allIds | Measure-Object -Maximum).Maximum) + 4096
    while ($freePid -lt 4000000 -and (Get-Process -Id $freePid -ErrorAction SilentlyContinue)) { $freePid += 1024 }
    $freeFacts = Get-IhuiDeployLockProcessFacts -ProcessId $freePid
    $selfFacts = Get-IhuiDeployLockProcessFacts -ProcessId $PID
    $bootNow = Get-IhuiDeployLockBootId
    if (-not $youngFacts.ProcessExists -or -not $youngFacts.StartReadable) {
        throw "夹具失效:刚起的子进程 pid=$youngPid 量不到(存在=$($youngFacts.ProcessExists) 启动时刻可读=$($youngFacts.StartReadable))"
    }
    if (-not $selfFacts.StartReadable) { throw "夹具失效:本进程自己的 StartTime 都量不到,判据现场无法构造" }

    # 夹具自身必须先自证"量到的值是对的",否则下面所有断言都建在沙上
    $out['_fixtures'] = [ordered]@{
        youngPid        = $youngPid
        youngExists     = [bool]$youngFacts.ProcessExists
        youngStartReadable = [bool]$youngFacts.StartReadable
        youngStartUtc   = (Format-IhuiLockUtc $youngFacts.ProcessStartUtc)
        freePid         = $freePid
        freeExists      = [bool]$freeFacts.ProcessExists
        selfExists      = [bool]$selfFacts.ProcessExists
        selfStartReadable = [bool]$selfFacts.StartReadable
        bootId          = $bootNow
        writtenAt       = (Format-IhuiLockUtc $now)
        startLaterThanWrite = ($youngFacts.ProcessStartUtc -gt $now.AddMinutes(-10))
    }

    # 合法持有者的时间对:writtenAt 必须**不早于**该进程自己的 StartTime
    # (一个进程不可能在它出现之前写下锁 —— 这正是 C2 的判据本身)。
    $legitWritten = $selfFacts.ProcessStartUtc.AddSeconds(1)
    $legitBeat = $now.AddSeconds(-1)

    # ── C1:进程不存在 ⇒ 陈旧(其余三条全部满足) ────────────────────────────
    Add-Case 'c1_process_gone' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $freePid; ProcessExists = $false; ProcessStartUtc = $null
    }))
    # ── C2:pid 是**别的真在跑的进程**,其 StartTime 晚于写锁时刻(= 今早的现场) ──
    Add-Case 'c2_pid_reused' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $youngPid; ProcessExists = $true; ProcessStartUtc = $youngFacts.ProcessStartUtc
        WrittenAtUtc = $now.AddMinutes(-10); HeartbeatAtUtc = $now.AddMinutes(-10)
    }))
    # ── C3:bootId 与当前启动标识不符 ⇒ 陈旧(进程仍在、C2 也过) ─────────────
    # 注意 fixture 必须用**本进程**当持有者:用一个刚起的子进程配"10 分钟前的 writtenAt"
    # 会先在 C2 上短路,那条用例就变成对 C2 的第二遍断言,而不是对 C3 的断言。
    Add-Case 'c3_boot_changed' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $PID; ProcessExists = $true; ProcessStartUtc = $selfFacts.ProcessStartUtc
        WrittenAtUtc = $legitWritten; HeartbeatAtUtc = $legitBeat
        BootIdLock = 'BOOT-OTHER'; BootIdCurrent = $bootNow
    }))
    # ── C4:心跳过期 ⇒ 陈旧(进程仍在、bootId 仍匹配 ⇒ 只能由 C4 拦) ─────────
    Add-Case 'c4_heartbeat_stale' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $PID; ProcessExists = $true; ProcessStartUtc = $selfFacts.ProcessStartUtc
        WrittenAtUtc = $legitWritten; HeartbeatAtUtc = $now.AddMinutes(-60)
    }))
    # ── 反例(不可省):四条全满足 ⇒ 判持有,不得抢锁 ─────────────────────────
    Add-Case 'all_ok_held' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $PID; ProcessExists = $true; ProcessStartUtc = $selfFacts.ProcessStartUtc
        WrittenAtUtc = $legitWritten; HeartbeatAtUtc = $legitBeat
    }))
    # ── C2 边界:StartTime 早于 writtenAt(合法持有者)⇒ 不得判陈旧 ──────────
    Add-Case 'c2_holder_before_lock_ok' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $youngPid; ProcessExists = $true; ProcessStartUtc = $youngFacts.ProcessStartUtc
        WrittenAtUtc = $youngFacts.ProcessStartUtc.AddMinutes(1)
        HeartbeatAtUtc = $youngFacts.ProcessStartUtc.AddMinutes(1)
    }))
    # ── C0:内容不可用 ⇒ 判不出(让路),不得判陈旧 ───────────────────────────
    Add-Case 'c0_unusable_undetermined' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        ContentUsable = $false; ContentReason = '测试夹具:半个 JSON'; FallbackAgeUtc = $now.AddMinutes(-10)
    }))
    # ── C0 + 绝对上限:内容不可用且已超上限 ⇒ 才清理 ─────────────────────────
    Add-Case 'c0_unusable_over_cap' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        ContentUsable = $false; ContentReason = '测试夹具:半个 JSON'; FallbackAgeUtc = $now.AddHours(-6)
    }))
    # ── C2 判不出(读不到 StartTime)⇒ 让路;超绝对上限才抢 ──────────────────
    Add-Case 'c2_start_unreadable_undetermined' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $youngPid; ProcessExists = $true; ProcessStartUtc = $null
    }))
    Add-Case 'c2_start_unreadable_over_cap' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $youngPid; ProcessExists = $true; ProcessStartUtc = $null
        WrittenAtUtc = $now.AddHours(-6); HeartbeatAtUtc = $now.AddMinutes(-1)
    }))
    # ── C3 无从比对(锁侧没有 bootId)⇒ 只算跳过,不得判陈旧、也不得降级成未判定 ──
    Add-Case 'c3_missing_skips_not_stale' (Test-IhuiDeployLockHeld -Observation (New-Obs @{
        Pid = $PID; ProcessExists = $true; ProcessStartUtc = $selfFacts.ProcessStartUtc
        WrittenAtUtc = $legitWritten; HeartbeatAtUtc = $legitBeat
        BootIdLock = ''; BootIdCurrent = $bootNow
    }))

    # ── 端到端:真的写文件 + 真的量(mtime / 旧裸 pid / 无锁) ────────────────
    $pAbs = Join-Path $Scratch 'absent.lock'
    Add-Case 'file_absent' (Resolve-IhuiDeployLockState -Path $pAbs -OwnerKind 'loop')

    $pSelf = Join-Path $Scratch 'self.lock'
    $wrote = Write-IhuiDeployLock -Path $pSelf -OwnerKind 'loop'
    Add-Case 'file_held_self' (Resolve-IhuiDeployLockState -Path $pSelf -OwnerKind 'loop') @{ wrote = $wrote; raw = (Get-Content $pSelf -Raw) }

    # 今早那次故障的可重放现场:旧裸 pid + mtime 早于该 pid 的启动时刻
    $pLegacy = Join-Path $Scratch 'legacy-reused.lock'
    [System.IO.File]::WriteAllText($pLegacy, "$youngPid")
    (Get-Item -LiteralPath $pLegacy).LastWriteTimeUtc = $now.AddMinutes(-30)
    Add-Case 'file_legacy_pid_reused' (Resolve-IhuiDeployLockState -Path $pLegacy -OwnerKind 'loop') @{ raw = (Get-Content $pLegacy -Raw) }

    # 同一旧格式,但持锁的正是本进程(mtime 晚于本进程启动时刻 = 真实持有者写下的样子)
    # ⇒ 必须判持有:升级窗口里不能把活锁抢掉。
    $pLegacyLive = Join-Path $Scratch 'legacy-live.lock'
    [System.IO.File]::WriteAllText($pLegacyLive, "$PID")
    (Get-Item -LiteralPath $pLegacyLive).LastWriteTimeUtc = $legitWritten
    Add-Case 'file_legacy_live_holder' (Resolve-IhuiDeployLockState -Path $pLegacyLive -OwnerKind 'loop')

    # 内容坏了 ⇒ 让路;并按文件 mtime 走到绝对上限才清理
    $pGarbage = Join-Path $Scratch 'garbage.lock'
    [System.IO.File]::WriteAllText($pGarbage, 'not-a-json-at-all')
    (Get-Item -LiteralPath $pGarbage).LastWriteTimeUtc = $now.AddMinutes(-5)
    Add-Case 'file_garbage_undetermined' (Resolve-IhuiDeployLockState -Path $pGarbage -OwnerKind 'loop')
    (Get-Item -LiteralPath $pGarbage).LastWriteTimeUtc = $now.AddHours(-7)
    Add-Case 'file_garbage_over_cap' (Resolve-IhuiDeployLockState -Path $pGarbage -OwnerKind 'loop')

    # 心跳与放锁的归属纪律:只认自己那把
    $pHb = Join-Path $Scratch 'heartbeat.lock'
    [void](Write-IhuiDeployLock -Path $pHb -OwnerKind 'loop')
    $before = Get-Content $pHb -Raw
    $throttled = Update-IhuiDeployLockHeartbeat -Path $pHb -OwnerKind 'loop' -MinIntervalSeconds 15 -NowUtc $now.AddSeconds(5)
    $afterThrottle = Get-Content $pHb -Raw
    $wrongOwner = Update-IhuiDeployLockHeartbeat -Path $pHb -OwnerKind 'deploy' -MinIntervalSeconds 0 -NowUtc $now.AddMinutes(2)
    $afterWrongOwner = Get-Content $pHb -Raw
    $renewed = Update-IhuiDeployLockHeartbeat -Path $pHb -OwnerKind 'loop' -MinIntervalSeconds 0 -NowUtc $now.AddMinutes(3)
    $after = Get-Content $pHb -Raw
    $out['_heartbeat'] = [ordered]@{
        throttled = $throttled; wrongOwner = $wrongOwner; renewed = $renewed
        # 节流与"owner 不匹配"两次都必须**一字不改**地留下原内容
        unchangedWhenThrottled = ($before -eq $afterThrottle) -and ($afterThrottle -eq $afterWrongOwner)
        writtenAtKept = ((($before | ConvertFrom-Json).writtenAt) -eq (($after | ConvertFrom-Json).writtenAt))
        beatAdvanced  = (((($after | ConvertFrom-Json).heartbeatAt) -as [datetime]) -gt ((($before | ConvertFrom-Json).heartbeatAt) -as [datetime]))
    }

    $pForeign = Join-Path $Scratch 'foreign.lock'
    [void](Write-IhuiDeployLock -Path $pForeign -OwnerKind 'loop')
    $fmeta = [ordered]@{ pid = $youngPid; ownerKind = 'loop'; writtenAt = (Format-IhuiLockUtc $now)
        bootId = (Get-IhuiDeployLockBootId); heartbeatAt = (Format-IhuiLockUtc $now) }
    [void](Write-IhuiDeployLockJson -Path $pForeign -Meta $fmeta)
    $removedForeign = Remove-IhuiDeployLock -Path $pForeign -OwnerKind 'loop'
    $out['_release'] = [ordered]@{
        removedForeign = $removedForeign
        foreignStillThere = (Test-Path -LiteralPath $pForeign)
        removedOwn = (Remove-IhuiDeployLock -Path $pHb -OwnerKind 'loop')
        ownGone = (-not (Test-Path -LiteralPath $pHb))
    }
    # ── 抢占的同一性复核(CAS):判定与删除之间被人换了锁 ⇒ 不得删 ────────────
    $pCas = Join-Path $Scratch 'cas.lock'
    [System.IO.File]::WriteAllText($pCas, "$youngPid")
    (Get-Item -LiteralPath $pCas).LastWriteTimeUtc = $now.AddMinutes(-30)
    $casState = Resolve-IhuiDeployLockState -Path $pCas -OwnerKind 'loop'
    # 判定完成后、删除之前的现场:并发持有者刚刚写下了它自己的新锁
    [void](Write-IhuiDeployLock -Path $pCas -OwnerKind 'loop')
    $clearedAfterSwap = Clear-IhuiDeployLockStale -Path $pCas -State $casState -Logger { param($m) }
    $out['_cas'] = [ordered]@{
        judgedVerdict      = $casState.Verdict
        cleared            = $clearedAfterSwap
        survivorStillThere = (Test-Path -LiteralPath $pCas)
        survivorVerdict    = (Resolve-IhuiDeployLockState -Path $pCas -OwnerKind 'loop').Verdict
    }
    # 正向对照:判定与内容一致时,陈旧锁必须真的被清掉(否则冻结原样复现)
    $pCas2 = Join-Path $Scratch 'cas2.lock'
    [System.IO.File]::WriteAllText($pCas2, "$youngPid")
    (Get-Item -LiteralPath $pCas2).LastWriteTimeUtc = $now.AddMinutes(-30)
    $cas2State = Resolve-IhuiDeployLockState -Path $pCas2 -OwnerKind 'loop'
    $out['_cas2'] = [ordered]@{
        judgedVerdict = $cas2State.Verdict
        cleared = (Clear-IhuiDeployLockStale -Path $pCas2 -State $cas2State -Logger { param($m) })
        gone = (-not (Test-Path -LiteralPath $pCas2))
    }
    # ── 判据 2 的库层现场:锁 mtime 早于本机**真** LastBootUpTime ──────────────
    # 与上面 c3_boot_changed 的区别很重要:那一条是**构造**的 bootId 字符串(证的是
    # "bootId 不等 ⇒ 判陈旧"这条规则本身),这一条形是在本票判据 2 要求的那句话上 ——
    # 拿盘上真实的开机时刻与真实的文件系统时间比,不掺任何模拟值。两式都要:
    #   (a) pid 已随重启消失(重启后最常见的形态)⇒ C1 当场判陈旧,不需要等任何上限
    #   (b) pid 被复用 **且** 锁是旧裸 pid 格式(没有 bootId,C3 只能跳过)⇒ 这一格
    #       唯一能拦住它的就是 C2 的启动时刻比对 —— 也就是 2026-09-26 08:37 那次冻结
    #       的真实形状。少了 (b),"跨重启会自动让位"这句话在旧格式锁上就是没证的。
    #   (c) 已知**未覆盖**的一格,按现读结果登记而不是写成已收:同一形态再叠上
    #       "StartTime 读不到"(跨会话/权限不足),四条里就没有任何一条看得见"这个文件
    #       比本次开机还老"—— C3 因锁侧没有 bootId 而跳过,C2 落到 start-unreadable,
    #       于是只由 C5 的绝对上限兜住(要等满 180 分钟)。把"mtime 早于 LastBootUpTime"
    #       本身做成一条判据才当场就能让位,而那属于 deploy-lock-common.ps1 的射程
    #       (不在本票可改文件内,已按归属登记给该库持有人)。
    #       这里断言的下界刻意是"**绝不被认证成持有**",不是"当场判陈旧" —— 将来那条
    #       判据落地后这一格自动变好,测试不会反过来挡它。
    $bootUtc = ConvertTo-IhuiLockUtc (Get-IhuiDeployLockBootId)
    if ($null -eq $bootUtc) { throw '夹具失效:本机启动标识量不到,跨重启现场无从核对' }
    $pBootA = Join-Path $Scratch 'cross-boot-pid-gone.lock'
    [System.IO.File]::WriteAllText($pBootA, "$freePid")
    (Get-Item -LiteralPath $pBootA).LastWriteTimeUtc = $bootUtc.AddMinutes(-30)
    $stBootA = Resolve-IhuiDeployLockState -Path $pBootA -OwnerKind 'loop'
    $pBootB = Join-Path $Scratch 'cross-boot-pid-reused.lock'
    [System.IO.File]::WriteAllText($pBootB, "$youngPid")
    (Get-Item -LiteralPath $pBootB).LastWriteTimeUtc = $bootUtc.AddMinutes(-30)
    $stBootB = Resolve-IhuiDeployLockState -Path $pBootB -OwnerKind 'loop'
    # (c) 的那一格:用**纯谓词**构造(真实现场里"某个真 pid 的 StartTime 读不到"没法按
    # 意愿造出来 —— 要么读得到、要么进程根本不在,那是另一格),把"读不到"这一档直接喂给
    # 判据本身,走的仍是它真实会走的那一支(不绕开任何一条判据)。
    # 算一次就存下来:两处各调一次会在两次之间读到不同的量,账面却长得一样。
    $gapObs = New-Obs @{
        Pid = $youngPid; ProcessExists = $true; ProcessStartUtc = $null
        WrittenAtUtc = $bootUtc.AddMinutes(-30); HeartbeatAtUtc = $bootUtc.AddMinutes(-20)
        BootIdLock = ''; BootIdCurrent = (Format-IhuiLockUtc $bootUtc)
        NowUtc = $bootUtc.AddMinutes(10)
    }
    $gapVerdict = Test-IhuiDeployLockHeld -Observation $gapObs
    $gapC = ($gapVerdict.Verdict -ne 'held')
    $out['_cross_boot'] = [ordered]@{
        lastBootUpTimeUtc = (Format-IhuiLockUtc $bootUtc)
        pidGone = [ordered]@{
            # 两个值都从盘上现读:断言"mtime 早于开机"必须拿文件系统给的答案,
            # 拿自己做过的减法去断言就是恒真式(永远绿的断言与永远红的同样没用)。
            mtimeUtc = (Format-IhuiLockUtc (Get-Item -LiteralPath $pBootA).LastWriteTimeUtc)
            earlierThanBoot = (((Get-Item -LiteralPath $pBootA).LastWriteTimeUtc) -lt $bootUtc)
            verdict = $stBootA.Verdict; failed = $stBootA.Failed; shouldHold = [bool]$stBootA.ShouldHold
        }
        pidReused = [ordered]@{
            mtimeUtc = (Format-IhuiLockUtc (Get-Item -LiteralPath $pBootB).LastWriteTimeUtc)
            earlierThanBoot = (((Get-Item -LiteralPath $pBootB).LastWriteTimeUtc) -lt $bootUtc)
            verdict = $stBootB.Verdict; failed = $stBootB.Failed; shouldHold = [bool]$stBootB.ShouldHold
            bootIdOnLock = $stBootB.Meta.BootId
        }
        # (c) 那一格的现读结论(判据原文见上方 $gapObs 处):见 **未覆盖的一格**,
        # 下界是"绝不被认证成持有",不是"当场判陈旧"。
        gapStartUnreadable = [ordered]@{
            verdict = $gapVerdict.Verdict; failed = $gapVerdict.Failed
            # 刻意不放"writtenAt 早于开机"这类**我自己算出来的**比较 —— 拿
            # $boot.AddMinutes(-30) -lt $boot 断言是恒真式(永远绿的断言与永远红的同样
            # 没用)。这一格要登记的只有"判据在缺 StartTime 时看得见什么、看不见什么"。
            writtenAtUtc = (Format-IhuiLockUtc $bootUtc.AddMinutes(-30))
            nowUtc = (Format-IhuiLockUtc $bootUtc.AddMinutes(10))
            neverCertifiedAsHeld = $gapC
        }
    }
} finally {
    if ($null -ne $childProc) { try { Stop-Process -Id $childProc.Id -Force -ErrorAction SilentlyContinue } catch {} }
}

($out | ConvertTo-Json -Depth 6 -Compress)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
