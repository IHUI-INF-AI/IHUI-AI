# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 行为验证:签到批次节流判据(deploy/win/lib/checkin-batch-gate.ps1)
# 跑法:pwsh -NoProfile -File deploy/win/tests/checkin-batch-gate.test.ps1
# 立因(2026-11-04):08:05 批次跑到 08:06:58 被 08:06:59 的部署重启切断。修法是
# 「批次执行中推迟重启,上限 900s,超限照常部署并告警」。本测试钉住:
#   ① 六种状态各自的走向(进行中推迟 / 结束立即部署 / 不存在立即部署 /
#      过期(硬杀残留)立即部署+告警 / 超限部署+告警 / 读不到 fail-closed 等满上限);
#   ② 过期判据只看心跳时间戳,与 pid 是否存活无关(否则一次 Force 杀进程会永久阻塞部署);
#   ③ 节流真的接进了主脚本,且**在重启那一行之前**,重启锚点(AiRestartIso)仍在重启之后
#      (部署后验收的断言语义一位未动)—— 「造好没装车」等于没有。
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\lib\checkin-batch-gate.ps1'),
      [string]$DeployPath = (Join-Path $PSScriptRoot '..\ihui-deploy.ps1'),
      [string]$SchedulerPath = (Join-Path $PSScriptRoot '..\..\..\apps\ai-service\app\services\checkin_scheduler.py'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}

$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ihui-checkin-gate-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpRoot | Out-Null

function WriteMarker([string]$path, [datetimeoffset]$heartbeat, [object]$markerPid = 4242) {
    $payload = [ordered]@{
        schema      = 'ihui.checkin-batch.v1'
        pid         = [int]$markerPid
        batch       = '自检批次'
        startedAt   = $heartbeat.AddSeconds(-30).ToString('o')
        heartbeatAt = $heartbeat.ToString('o')
        host        = 'self-test'
    }
    ($payload | ConvertTo-Json -Compress) | Set-Content -LiteralPath $path -Encoding utf8
}

try {
    $now = [datetimeoffset]::UtcNow

    Write-Output '[1] marker 不存在 ⇒ 立即部署(0 秒等待;读不到 ≠ 忙碌,但「不存在」是明确的空闲)'
    $p1 = Join-Path $tmpRoot 'absent.json'
    $rd1 = Read-IhuiCheckinBatchMarker -Path $p1
    T '1a 读判据:不存在 ⇒ absent' ($rd1.State -eq 'absent') $rd1.State
    $r1 = Wait-IhuiCheckinBatchIdle -Path $p1 -MaxWaitSeconds 5 -PollSeconds 1 -StaleSeconds 180
    T '1b 等待判据:absent ⇒ idle 且不等待' ($r1.Outcome -eq 'idle' -and $r1.WaitedSeconds -eq 0) "outcome=$($r1.Outcome) waited=$($r1.WaitedSeconds)"
    T '1c idle 的告警级别是 info(无批次不是告警)' ($r1.Severity -eq 'info') $r1.Severity

    Write-Output '[2] 批次进行中 ⇒ 推迟;批次结束 ⇒ 立即继续部署'
    $p2 = Join-Path $tmpRoot 'running-then-done.json'
    WriteMarker $p2 $now
    T '2a 读判据:新鲜心跳 ⇒ fresh' ((Read-IhuiCheckinBatchMarker -Path $p2).State -eq 'fresh') (Read-IhuiCheckinBatchMarker -Path $p2).State
    $script:pollSeen = 0
    $r2 = Wait-IhuiCheckinBatchIdle -Path $p2 -MaxWaitSeconds 20 -PollSeconds 1 -StaleSeconds 180 -OnPoll {
        param($st, $el)
        $script:pollSeen++
        # 第一轮读到 fresh 之后把 marker 删掉 = 批次正常收尾
        if ($script:pollSeen -ge 1) { Remove-Item -LiteralPath $p2 -Force -ErrorAction SilentlyContinue }
    }
    T '2b 先推迟(至少等一轮)⇒ 批次收尾后 finished' ($r2.Outcome -eq 'finished' -and $r2.WaitedSeconds -ge 1) "outcome=$($r2.Outcome) waited=$($r2.WaitedSeconds)"

    Write-Output '[3] 批次持续执行 ⇒ 等到上限才继续(overdue,显式告警)'
    $p3 = Join-Path $tmpRoot 'running-forever.json'
    WriteMarker $p3 ([datetimeoffset]::UtcNow)
    $r3 = Wait-IhuiCheckinBatchIdle -Path $p3 -MaxWaitSeconds 2 -PollSeconds 1 -StaleSeconds 180
    T '3a 到上限前不返回 ⇒ overdue' ($r3.Outcome -eq 'overdue' -and $r3.WaitedSeconds -ge 2) "outcome=$($r3.Outcome) waited=$($r3.WaitedSeconds)"
    T '3b overdue 必须是 alert 级' ($r3.Severity -eq 'alert') $r3.Severity
    T '3c 告警文案点名上限(操作员能一眼看出「照常部署且可能切断」)' ($r3.Message -match '上限' -and $r3.Message -match '照常部署') $r3.Message

    Write-Output '[4] 硬杀残留:伪造 30 分钟前心跳 ⇒ 判过期,立即部署 + 告警(不许永久阻塞)'
    $p4 = Join-Path $tmpRoot 'stale-live-pid.json'
    WriteMarker $p4 $now.AddMinutes(-30) $PID
    $rd4 = Read-IhuiCheckinBatchMarker -Path $p4
    T '4a 30 分钟前心跳 ⇒ stale(与 pid 存活无关)' ($rd4.State -eq 'stale' -and [double]$rd4.AgeSeconds -ge 1700) "state=$($rd4.State) age=$($rd4.AgeSeconds)"
    $r4 = Wait-IhuiCheckinBatchIdle -Path $p4 -MaxWaitSeconds 20 -PollSeconds 1 -StaleSeconds 180
    T '4b stale ⇒ 立即返回(不等到上限)且 warn 级' ($r4.Outcome -eq 'stale' -and $r4.WaitedSeconds -eq 0 -and $r4.Severity -eq 'warn') "outcome=$($r4.Outcome) waited=$($r4.WaitedSeconds) sev=$($r4.Severity)"
    $p4b = Join-Path $tmpRoot 'stale-dead-pid.json'
    WriteMarker $p4b $now.AddMinutes(-30) 999999
    $rd4b = Read-IhuiCheckinBatchMarker -Path $p4b
    T '4c 同一时间戳 + 已不存在的 pid 仍是 stale(判据只看时间戳)' ($rd4b.State -eq 'stale') $rd4b.State
    T '4d 过期文案点名心跳停滞时长与阈值' ($r4.Message -match '心跳停滞' -and $r4.Message -match '180') $r4.Message

    Write-Output '[5] 读不到状态 ⇒ fail-closed 按「可能在执行」等满上限,再照常部署 + 告警'
    $p5 = Join-Path $tmpRoot 'broken.json'
    Set-Content -LiteralPath $p5 -Value '{ this is not json' -Encoding utf8
    $rd5 = Read-IhuiCheckinBatchMarker -Path $p5
    T '5a 坏 JSON ⇒ unknown(不是 absent,不许当成空闲)' ($rd5.State -eq 'unknown') "state=$($rd5.State) detail=$($rd5.Detail)"
    $r5 = Wait-IhuiCheckinBatchIdle -Path $p5 -MaxWaitSeconds 2 -PollSeconds 1 -StaleSeconds 180
    T '5b unknown ⇒ 等满上限才返回(unknown-overdue)' ($r5.Outcome -eq 'unknown-overdue' -and $r5.WaitedSeconds -ge 2) "outcome=$($r5.Outcome) waited=$($r5.WaitedSeconds)"
    T '5c 读不到也必须 alert(不许静默)' ($r5.Severity -eq 'alert') $r5.Severity
    T '5d 告警文案说明 fail-closed 口径' ($r5.Message -match 'fail-closed') $r5.Message
    $p5b = Join-Path $tmpRoot 'no-timestamps.json'
    Set-Content -LiteralPath $p5b -Value '{"schema":"ihui.checkin-batch.v1","batch":"x","pid":1}' -Encoding utf8
    T '5e 形状不全(无时间戳)⇒ unknown,不猜空闲' ((Read-IhuiCheckinBatchMarker -Path $p5b).State -eq 'unknown') (Read-IhuiCheckinBatchMarker -Path $p5b).State
    $p5c = Join-Path $tmpRoot 'future.json'
    WriteMarker $p5c ([datetimeoffset]::UtcNow.AddMinutes(10))
    T '5f 未来时间戳(时钟回拨)⇒ fresh,不误判过期' ((Read-IhuiCheckinBatchMarker -Path $p5c).State -eq 'fresh') (Read-IhuiCheckinBatchMarker -Path $p5c).State

    Write-Output '[6] 路径解析:默认落在 <Root>\deploy\run,env 可覆盖(与 ai-service 侧同构)'
    T '6a 默认路径拼装' ((Get-IhuiCheckinBatchMarkerPath -Root 'C:\X') -eq 'C:\X\deploy\run\checkin-batch.json') (Get-IhuiCheckinBatchMarkerPath -Root 'C:\X')
    $env:IHUI_CHECKIN_BATCH_MARKER = Join-Path $tmpRoot 'env-override.json'
    T '6b env 覆盖优先' ((Get-IhuiCheckinBatchMarkerPath -Root 'C:\X') -eq $env:IHUI_CHECKIN_BATCH_MARKER) (Get-IhuiCheckinBatchMarkerPath -Root 'C:\X')
    Remove-Item Env:\IHUI_CHECKIN_BATCH_MARKER -ErrorAction SilentlyContinue

    Write-Output '[7] 装车证明:节流真的接进主脚本,且在重启行之前;验收锚点语义未动'
    $s = Get-Content -LiteralPath $DeployPath -Raw -Encoding utf8
    $iGate = $s.IndexOf('Wait-IhuiCheckinBatchIdle -Path $markerPath -MaxWaitSeconds 900')
    $iRestart = $s.IndexOf('Log "重启 ai-service 服务($aiName)使 AI 新代码生效"')
    $iAnchor = $s.IndexOf('$script:AiRestartIso = (Get-Date).ToString(''o'')')
    T '7a 主脚本调用节流(900s 硬编码在调用点)' ($iGate -gt 0) "index=$iGate"
    T '7b 节流在重启行之前(先等再重启)' ($iGate -gt 0 -and $iRestart -gt 0 -and $iGate -lt $iRestart) "gate=$iGate restart=$iRestart"
    T '7c 重启锚点仍在重启行之后(部署后验收断言不受影响)' ($iAnchor -gt $iRestart -and $iRestart -gt 0) "anchor=$iAnchor restart=$iRestart"
    T '7d 长等待每轮续部署锁心跳' ($s -match '-HeartbeatCallback \{ Update-DeployLockHeartbeat \}') '未命中 HeartbeatCallback'
    T '7e 轮询与过期阈值与设计一致(10s / 180s)' ($s -match '-PollSeconds 10 -StaleSeconds 180') '未命中 10/180'

    Write-Output '[8] ai-service 侧装车证明:批次进入写 marker、finally 删 marker'
    T '8a _run_batch 构造 CheckinBatchMarker' ($null -ne (Select-String -LiteralPath $SchedulerPath -Pattern 'CheckinBatchMarker\(label\)')) '未命中'
    T '8b finally 里停 marker' ($null -ne (Select-String -LiteralPath $SchedulerPath -Pattern 'await marker.stop()' -SimpleMatch)) '未命中'
}
finally {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output ''
Write-Output ("结果: pass=$pass fail=$fail")
if ($fail -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
