# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 行为验证:健康门禁的**取证面**(GATE-DIM / GATE-CACHE-BLIND / LastLlmProbe)+ 判定面未被改动的反向锁
# 跑法:pwsh -NoProfile -File deploy/win/tests/health-gate-evidence.test.ps1
# 立因(2026-10-31 现读):生产连续两轮(11:02 / 11:16)门禁未全过 ⇒ 自动回滚,事后能拿到的读数
# 只有「健康门禁 第 N/8 轮: web=pass api=pass llm=fail …」——401/404/502/超时四型在日志里同形。
# 本测试钉住:① 判据本体(Get-HealthGateVerdict)一位未动(反向锁);② 新取证函数的三态/边界;
# ③ 取证函数真的接进了主脚本(装车证明,否则就是"造好没装车")。
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\health-gate-verdict.ps1'),
      [string]$DeployPath = (Join-Path $PSScriptRoot '..\ihui-deploy.ps1'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function P([string]$v, [int]$s, [string]$r = '') { return @{ Verdict = $v; Status = $s; Reason = $r } }

Write-Output '[1] Get-GateProbeClass:状态码 → ASCII 类别词(401/403 必须能与 5xx 分辨)'
T '1a 200+pass ⇒ ok' ((Get-GateProbeClass (P 'pass' 200)) -eq 'ok') (Get-GateProbeClass (P 'pass' 200))
T '1b 200+fail(内容不符)⇒ content' ((Get-GateProbeClass (P 'fail' 200 '应答不含 x')) -eq 'content') (Get-GateProbeClass (P 'fail' 200 '应答不含 x'))
T '1c 401 ⇒ auth(探测令牌被拒)' ((Get-GateProbeClass (P 'fail' 401 'HTTP 401')) -eq 'auth') (Get-GateProbeClass (P 'fail' 401 'HTTP 401'))
T '1d 403 ⇒ auth' ((Get-GateProbeClass (P 'fail' 403 'HTTP 403')) -eq 'auth') (Get-GateProbeClass (P 'fail' 403 'HTTP 403'))
T '1e 404 ⇒ http404(路由不在)' ((Get-GateProbeClass (P 'fail' 404 'HTTP 404')) -eq 'http404') (Get-GateProbeClass (P 'fail' 404 'HTTP 404'))
T '1f 502 ⇒ http502(边缘/隧道)' ((Get-GateProbeClass (P 'fail' 502 'HTTP 502')) -eq 'http502') (Get-GateProbeClass (P 'fail' 502 'HTTP 502'))
T '1g 429 ⇒ ratelimit' ((Get-GateProbeClass (P 'unknown' 429 '上游限流')) -eq 'ratelimit') (Get-GateProbeClass (P 'unknown' 429 '上游限流'))
T '1h Status=0+unknown ⇒ neterr(传输不可达/超时)' ((Get-GateProbeClass (P 'unknown' 0 '传输不可达(x)')) -eq 'neterr') (Get-GateProbeClass (P 'unknown' 0 '传输不可达(x)'))
T '1i $null ⇒ noprobe,且不抛' ((Get-GateProbeClass $null) -eq 'noprobe') (Get-GateProbeClass $null)

Write-Output '[2] Format-GateProbeEvidence:单行纯 ASCII,取不到的写 noprobe'
$full = [ordered]@{
    web = P 'pass' 200; api = P 'fail' 502 'HTTP 502'; llm = P 'fail' 401 'HTTP 401'
    webOrigin = P 'pass' 200; apiOrigin = P 'pass' 200; llmOrigin = P 'pass' 200
}
$line = Format-GateProbeEvidence -Probes $full
$want = 'GATE-DIM web=pass(200/ok) api=fail(502/http502) llm=fail(401/auth) origin=web:pass(200/ok)/api:pass(200/ok)/llm:pass(200/ok)'
T '2a 逐字形状(操作员按这一行定论,形状是契约)' ($line -eq $want) $line
T '2b 单行:不含 CR/LF/TAB' ($line -notmatch "[\r\n\t]") $line
T '2c 纯 ASCII(中文经 LocalSystem 管道会烂,取证行不许依赖它)' ($line -notmatch '[^\x20-\x7E]') $line
$partial = @{ web = P 'pass' 200 }
$lp = Format-GateProbeEvidence -Probes $partial
T '2d 缺键写 noprobe,不编造读数' ($lp -match 'api=noprobe' -and $lp -match 'llm=noprobe' -and $lp -match 'origin=web:noprobe') $lp
T '2e 空输入不抛' ((Format-GateProbeEvidence -Probes @{}) -match '^GATE-DIM ') (Format-GateProbeEvidence -Probes @{})
# 形状锁(与 2026-10-19 那枚真事故同型):.ContainsKey() 只有 Hashtable 有,OrderedDictionary 调它抛
$ht = @{
    web = P 'pass' 200; api = P 'fail' 502 'HTTP 502'; llm = P 'fail' 401 'HTTP 401'
    webOrigin = P 'pass' 200; apiOrigin = P 'pass' 200; llmOrigin = P 'pass' 200
}
T '2f Hashtable 与 OrderedDictionary 两种形状同结论(形状锁)' ((Format-GateProbeEvidence -Probes $ht) -eq $line) (Format-GateProbeEvidence -Probes $ht)

Write-Output '[3] Get-GateWebDimension:与旧内联三行逐条等价,只多识别"公网 pass 而源站 fail"'
function OldInline([string]$pv, [string]$ov) {
    # 旧写法(改前 ihui-deploy.ps1 的内联三行)照抄成参照物:公网 fail ⇒ fails;公网非 pass 且源站非 pass ⇒ unknown。
    $f = @(); $u = @()
    if ($pv -eq 'fail') { $f += 'x' } elseif ($pv -ne 'pass' -and $ov -ne 'pass') { $u += 'web' }
    return @{ Fails = $f.Count; Unknown = $u.Count }
}
$matrixOk = $true; $matrixDetail = ''
foreach ($pv in @('pass', 'fail', 'unknown')) {
    foreach ($ov in @('pass', 'fail', 'unknown')) {
        $d = Get-GateWebDimension -Public (P $pv 200) -Origin (P $ov 200)
        $old = OldInline $pv $ov
        # 唯一允许的差异:公网 pass × 源站 fail(缓存刷绿)—— 旧 0/0(算绿),新 0/1(未证明)
        $expectedUnknown = $old.Unknown
        if ($pv -eq 'pass' -and $ov -eq 'fail') { $expectedUnknown = 1 }
        if (@($d.Fails).Count -ne $old.Fails -or @($d.Unknown).Count -ne $expectedUnknown) {
            $matrixOk = $false; $matrixDetail += "[$pv/$ov]=f:$(@($d.Fails).Count),u:$(@($d.Unknown).Count) 期望 f:$($old.Fails),u:$expectedUnknown; "
        }
    }
}
T '3a 3×3 矩阵与旧写法等价(仅"公网 pass × 源站 fail"一格按设计转为未证明)' $matrixOk $matrixDetail
$cb = Get-GateWebDimension -Public (P 'pass' 200) -Origin (P 'fail' 502 'HTTP 502')
T '3b 公网 pass + 源站 502 ⇒ CacheBlind + 进 Unknown(不算绿)' ($cb.CacheBlind -eq $true -and @($cb.Unknown) -contains 'web' -and @($cb.Fails).Count -eq 0) "cb=$($cb.CacheBlind) u=$($cb.Unknown -join ',') f=$($cb.Fails -join ',')"
T '3c CacheBlind 的证据行点名源站状态与类别' ($cb.Marker -match 'GATE-CACHE-BLIND' -and $cb.Marker -match 'origin=fail\(502/http502\)') $cb.Marker
$ok2 = Get-GateWebDimension -Public (P 'pass' 200) -Origin (P 'pass' 200)
T '3d 公网 pass + 源站 pass ⇒ 无事发生(不冒红也不冒绿)' ($ok2.CacheBlind -eq $false -and @($ok2.Fails).Count -eq 0 -and @($ok2.Unknown).Count -eq 0) "cb=$($ok2.CacheBlind)"
$resc = Get-GateWebDimension -Public (P 'unknown' 0) -Origin (P 'pass' 200)
T '3e 公网取不到 + 源站 pass ⇒ Rescued(折算为绿,原样)' ($resc.Rescued -eq $true -and @($resc.Unknown).Count -eq 0) "rescued=$($resc.Rescued)"
$wf = Get-GateWebDimension -Public (P 'fail' 502 'HTTP 502') -Origin (P 'pass' 200)
T '3f 公网明确 fail ⇒ 仍进 Fails(源站 pass 不救,fail-closed 原样)' (@($wf.Fails).Count -eq 1 -and $wf.CacheBlind -eq $false) ($wf.Fails -join ',')

Write-Output '[4] 反向锁:判定面一位未动(同一组输入,改前改后同判)'
function Rnd([string]$w, [string]$a, [string]$l, [string]$wo, [string]$ao) {
    $f = @(); $u = @()
    foreach ($x in @(@('web', $w), @('api', $a), @('llm', $l))) {
        if ($x[1] -eq 'fail') { $f += "$($x[0])(HTTP 502)" } elseif ($x[1] -ne 'pass') { $u += $x[0] }
    }
    return @{ web = $w; api = $a; llm = $l; webOrigin = $wo; apiOrigin = $ao; fails = $f; unknown = $u }
}
$inc1 = Get-HealthGateVerdict -Rounds @((Rnd 'pass' 'pass' 'fail' 'pass' 'pass'))
T '4a 末轮仅 llm fail 且源站两端 pass ⇒ entry-broken(不回滚,2019-10 以来的判序)' ($inc1.Decision -eq 'entry-broken') $inc1.Decision
$inc2 = Get-HealthGateVerdict -Rounds @((Rnd 'pass' 'pass' 'fail' 'pass' 'fail'))
T '4b 末轮 fail 且源站不成立 ⇒ fail(回滚判据一位未动)' ($inc2.Decision -eq 'fail') $inc2.Decision
$inc3 = Get-HealthGateVerdict -Rounds @((Rnd 'pass' 'pass' 'pass' 'pass' 'pass'))
T '4c 三项全绿 ⇒ pass + Proven' ($inc3.Decision -eq 'pass' -and $inc3.Proven -eq $true) $inc3.Decision

Write-Output '[5] 装车证明:取证函数真的进了主脚本(造好没装车 = 没有)'
$s = Get-Content -LiteralPath $DeployPath -Raw -Encoding utf8
T '5a 主脚本调用 Get-GateWebDimension' ($s -match '\$webDim = Get-GateWebDimension -Public \$w -Origin \$wo') '未命中'
T '5b 主脚本每轮打一行 GATE-DIM' ($s -match 'Format-GateProbeEvidence -Probes \(\[ordered\]@\{') '未命中'
T '5c Test-LlmGateway 落 $script:LastLlmProbe(否则 llm 那一格永远没有状态)' ($s -match '\$script:LastLlmProbe = @\{ Verdict') '未命中'
T '5d Test-HealthGate 入口把 HealthGateEntryBroken 归零(同进程二次调用不许继承上一轮)' ($s -match '\$script:HealthGateEntryBroken = \$false') '未命中'
T '5e CacheBlind 的标记真的写进日志' ($s -match 'if \(\$webDim\.CacheBlind\) \{ Log \$webDim\.Marker \}') '未命中'

Write-Output ''
Write-Output ("结果: pass=$pass fail=$fail")
if ($fail -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
