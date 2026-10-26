# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# 行为验证:Get-HealthGateVerdict 的三态结论与"未证明"标记(纯函数,零副作用、零写盘)
# 跑法:pwsh -NoProfile -File deploy/tests/health-gate-verdict-harness.ps1
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\win\health-gate-verdict.ps1'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function Round([string]$web, [string]$api, [string]$llm) {
    $fails = @(); $unknown = @()
    foreach ($p in @(@('web', $web), @('api', $api), @('llm', $llm))) {
        if ($p[1] -eq 'fail') { $fails += "$($p[0])(HTTP 502 HTTP 502)" }
        elseif ($p[1] -ne 'pass') { $unknown += $p[0] }
    }
    return @{ web = $web; api = $api; llm = $llm; fails = $fails; unknown = $unknown }
}

Write-Output '[1] 某轮三项全绿 ⇒ pass,且不打"未证明"标记'
$v1 = Get-HealthGateVerdict -Rounds @((Round 'fail' 'fail' 'unknown'), (Round 'pass' 'pass' 'pass'))
T '1a Decision=pass' ($v1.Decision -eq 'pass') $v1.Decision
T '1b Proven=true' ($v1.Proven -eq $true) "$($v1.Proven)"
T '1c Markers 为空(不往绿轮上泼 WARN)' ($v1.Markers.Count -eq 0) "$($v1.Markers -join '|')"

Write-Output '[2] 复现 2026-10-19 00:29 那一轮:5 轮明确 502 + 末轮只剩 unknown'
$rounds2 = @((Round 'fail' 'fail' 'unknown'), (Round 'unknown' 'fail' 'unknown'), (Round 'fail' 'fail' 'unknown'),
             (Round 'fail' 'fail' 'unknown'), (Round 'fail' 'fail' 'unknown'), (Round 'unknown' 'fail' 'unknown'),
             (Round 'unknown' 'pass' 'unknown'))
$v2 = Get-HealthGateVerdict -Rounds $rounds2
T '2a 不得判成 pass(改前正是这里被洗成放行)' ($v2.Decision -ne 'pass') $v2.Decision
T '2b Decision=pass-unproven(放行但不冒绿)' ($v2.Decision -eq 'pass-unproven') $v2.Decision
T '2c Proven=false' ($v2.Proven -eq $false) "$($v2.Proven)"
T '2d EverFailed=true(明确 502 的证据没被末轮覆盖掉)' ($v2.EverFailed -eq $true) "$($v2.EverFailed)"
T '2e Markers 首枚是 ASCII GATE-UNPROVEN' ($v2.Markers[0] -match '^GATE-UNPROVEN ') ($v2.Markers[0])
T '2f 计数串带三个维' ($v2.Counts -match 'web=' -and $v2.Counts -match 'api=' -and $v2.Counts -match 'llm=') $v2.Counts
T '2g 回滚策略未改:LastFails 只取末轮(末轮无 fail ⇒ 不回滚)' ($v2.LastFails.Count -eq 0) "$($v2.LastFails -join '|')"

Write-Output '[3] 末轮仍有明确 fail ⇒ fail(与改前逐字同判,照样回滚)'
$v3 = Get-HealthGateVerdict -Rounds @((Round 'pass' 'pass' 'pass'), (Round 'fail' 'pass' 'pass'))
T '3a Decision=fail' ($v3.Decision -eq 'fail') $v3.Decision
T '3b LastFails 带 web 那一枚原文' ($v3.LastFails[0] -match '^web\(') ($v3.LastFails -join '|')
T '3c 打 GATE-FAIL-ON-EVIDENCE' (($v3.Markers -join ' ') -match 'GATE-FAIL-ON-EVIDENCE') ($v3.Markers -join '|')

Write-Output '[4] 全程只剩未知(隧道整体不可达,一次都没 fail)⇒ 同样不得冒绿'
$v4 = Get-HealthGateVerdict -Rounds @((Round 'unknown' 'unknown' 'unknown'), (Round 'unknown' 'unknown' 'unknown'))
T '4a Decision=pass-unproven' ($v4.Decision -eq 'pass-unproven') $v4.Decision
T '4b EverFailed=false(确实没有失败证据,只有拿不到)' ($v4.EverFailed -eq $false) "$($v4.EverFailed)"

Write-Output '[5] 反向对照:判据必须对"有没有全绿轮"敏感,不是恒判 unproven'
$green = @((Round 'unknown' 'unknown' 'unknown'), (Round 'pass' 'pass' 'pass'))
$v5a = Get-HealthGateVerdict -Rounds $green
$flip = @((Round 'unknown' 'unknown' 'unknown'), (Round 'pass' 'pass' 'unknown'))
$v5b = Get-HealthGateVerdict -Rounds $flip
T '5a 末轮全绿 ⇒ pass' ($v5a.Decision -eq 'pass') $v5a.Decision
T '5b 把末轮 llm 摘成 unknown ⇒ 立刻不再是 pass(证明不是恒绿)' ($v5b.Decision -eq 'pass-unproven') $v5b.Decision

Write-Output '[6] 告警身份前提:Markers 与 Counts 里不得混进时间戳/40 位 sha'
$joined = (($v2.Markers + $v2.Counts) -join ' ')
T '6a 无 ISO 时刻' ($joined -notmatch '\d{4}-\d{2}-\d{2}T') $joined
T '6b 无 40 位 sha' ($joined -notmatch '[0-9a-f]{40}') $joined

Write-Output '[7] 空输入不崩、且绝不冒绿(§0.3 取不到判未判定)'
$v7 = Get-HealthGateVerdict -Rounds @()
T '7a Decision 非 pass' ($v7.Decision -ne 'pass') $v7.Decision
T '7b Proven=false' ($v7.Proven -eq $false) "$($v7.Proven)"

Write-Output '[8] 第二条腿:公网读不到但源站直探正常 ⇒ entry-broken(不回滚、也不冒绿)'
function RoundP([string]$web, [string]$api, [string]$llm, [string]$wo, [string]$ao) {
    $r = Round $web $api $llm
    $r.webOrigin = $wo; $r.apiOrigin = $ao
    return $r
}
$v8 = Get-HealthGateVerdict -Rounds @((RoundP 'fail' 'fail' 'unknown' 'pass' 'pass'))
T '8a Decision=entry-broken' ($v8.Decision -eq 'entry-broken') $v8.Decision
T '8b 不是 fail(不回滚好构建)' ($v8.Decision -ne 'fail') $v8.Decision
T '8c 也不是 pass(不冒绿)' ($v8.Decision -ne 'pass') $v8.Decision
T '8d OriginOk=true' ($v8.OriginOk -eq $true) "$($v8.OriginOk)"
T '8e Markers 带 GATE-ENTRY-BROKEN' (($v8.Markers -join ' ') -match 'GATE-ENTRY-BROKEN') ($v8.Markers -join '|')
T '8f 末轮 fail 证据没被抹掉(LastFails 仍在)' ($v8.LastFails.Count -gt 0) '空'

Write-Output '[9] 公网 fail 且源站也 fail ⇒ 仍判 fail(第二条腿不许反过来救放行)'
$v9 = Get-HealthGateVerdict -Rounds @((RoundP 'fail' 'fail' 'unknown' 'fail' 'fail'))
T '9a Decision=fail' ($v9.Decision -eq 'fail') $v9.Decision
T '9b OriginOk=false' ($v9.OriginOk -eq $false) "$($v9.OriginOk)"

Write-Output '[10] 源站读数取不到(unknown)⇒ 等同不成立,照旧 fail(§0.3 拿不到不记绿)'
$v10 = Get-HealthGateVerdict -Rounds @((RoundP 'fail' 'pass' 'unknown' 'unknown' 'pass'))
T '10a Decision=fail' ($v10.Decision -eq 'fail') $v10.Decision

Write-Output '[11] 向后兼容:调用方完全不传源站维 ⇒ 与改前逐字同判'
$v11 = Get-HealthGateVerdict -Rounds @((Round 'fail' 'pass' 'unknown'))
T '11a Decision=fail(没有源站证据就不许免回滚)' ($v11.Decision -eq 'fail') $v11.Decision
T '11b OriginOk=false' ($v11.OriginOk -eq $false) "$($v11.OriginOk)"

Write-Output '[12] 输入形状锁:同一条数据用 Hashtable 与 OrderedDictionary 各喂一次,结论必须一致'
# 立因:2026-10-19 拿真实生产数据干跑时发现 .ContainsKey() 只有 Hashtable 有,
# OrderedDictionary 调它抛 InvalidOperation ⇒ $originOk 停在 false ⇒ 把好构建判成 fail 回滚。
$ht = RoundP 'fail' 'fail' 'unknown' 'pass' 'pass'
$od = [ordered]@{ web = 'fail'; api = 'fail'; llm = 'unknown'; webOrigin = 'pass'; apiOrigin = 'pass'; fails = @('web(HTTP 502)', 'api(HTTP 502)'); unknown = @('llm') }
$vh = Get-HealthGateVerdict -Rounds @($ht)
$vo = Get-HealthGateVerdict -Rounds @($od)
T '12a Hashtable 形状 ⇒ entry-broken' ($vh.Decision -eq 'entry-broken') $vh.Decision
T '12b OrderedDictionary 形状不抛异常且同结论(形状锁)' ($vo.Decision -eq 'entry-broken') "$($vo.Decision)"
T '12c 两种形状的 OriginOk 一致' ($vh.OriginOk -eq $vo.OriginOk -and $vo.OriginOk -eq $true) "h=$($vh.OriginOk) od=$($vo.OriginOk)"

Write-Output '[13] 源站折算契约:调用方把"公网 unknown 而源站 pass"折算掉后,空证据表即算绿'
$r13 = @{ web = 'pass'; api = 'pass'; llm = 'unknown'; webOrigin = 'pass'; apiOrigin = 'pass'; llmOrigin = 'pass'; fails = @(); unknown = @() }
$v13 = Get-HealthGateVerdict -Rounds @($r13)
T '13a 折算后 fails/unknown 皆空 ⇒ Decision=pass' ($v13.Decision -eq 'pass') $v13.Decision
T '13b Proven=true(某一维被源站折算救回,不再 perpetual-unproven)' ($v13.Proven -eq $true) "$($v13.Proven)"

Write-Output '[14] 向后兼容:调用方不折算(unknown 含 llm、无 llmOrigin 键)⇒ 仍 pass-unproven'
$v14 = Get-HealthGateVerdict -Rounds @((Round 'pass' 'pass' 'unknown'))
T '14a 未折算 ⇒ pass-unproven(老调用方语义一字不变)' ($v14.Decision -eq 'pass-unproven') $v14.Decision
T '14b Proven=false' ($v14.Proven -eq $false) "$($v14.Proven)"

Write-Output '[15] 折算只作用于 unknown:公网明确 fail 不因源站 pass 被折成绿'
$v15 = Get-HealthGateVerdict -Rounds @((RoundP 'pass' 'pass' 'fail' 'pass' 'pass'))
T '15a Decision 不是 pass(公网 fail 不享受折算)' ($v15.Decision -ne 'pass') $v15.Decision
T '15b Proven=false' ($v15.Proven -eq $false) "$($v15.Proven)"
T '15c Decision=entry-broken(公网 fail 但源站健康 ⇒ 入口故障,不回滚也不冒绿)' ($v15.Decision -eq 'entry-broken') $v15.Decision

Write-Output ''
Write-Output ("结果: pass=$pass fail=$fail")
if ($fail -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
