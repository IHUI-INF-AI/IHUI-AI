# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# 行为验证:alert-dedup.ps1 的"切流受阻类"清偿语义(全部跑临时档案,绝不碰 deploy\win\.alert-notify-state.json)
param([string]$ModulePath = (Join-Path $PSScriptRoot '..\win\alert-dedup.ps1'))
$ErrorActionPreference = 'Stop'
. $ModulePath

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) 'ihui-alert-dedup-test-state.json'
$sigStall = 'git merge --ff-only 失败:有未提交文件挡住 ff,已停止,未切流'
$sigDb = 'DB 迁移未落地(原因:exit 1;仍待应用 5 个)'
$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function Fresh { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
function BackdateGrace([string]$sig, [double]$minutes) {
    # 把 grace 锚点回拨,模拟"这一件事已经连着被挡了 N 分钟"
    $st = Read-AlertDedupState -StateFile $tmp
    $k = Get-AlertDedupKey -Sig ('grace:' + $sig)
    $anchor = (Get-Date).AddMinutes(-$minutes).ToString('o')
    $st.Map[$k].firstTs = $anchor
    $st.Map[$k].lastSend = (Get-Date).AddSeconds(-30).ToString('o')
    Write-AlertDedupState -StateFile $tmp -Map $st.Map | Out-Null
}

Fresh
Write-Output '[1] 宽限窗内不寄'
$g1 = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
T '1a 第一轮被挡 ⇒ 抑制' ($g1.Suppressed -eq $true) "Suppressed=$($g1.Suppressed) Decision=$($g1.Decision)"
T '1b 抑制理由带"还差多久升级"' ($g1.Note -match '15') $g1.Note

Write-Output '[2] 持续超窗 ⇒ 升级并发信,身份登记为切流类'
BackdateGrace $sigStall 16
$g2 = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
T '2a 超 15 分钟 ⇒ 不再抑制' ($g2.Suppressed -eq $false) "Suppressed=$($g2.Suppressed) Decision=$($g2.Decision)"
$due2 = Test-AlertDueByIdentity -Sig $sigStall -StateFile $tmp -RepeatHours 4 -Stall
T '2b 该身份判为应寄(新故障)' ($due2.Due -and $due2.Decision -eq 'due-new') "$($due2.Decision)"
$st = Read-AlertDedupState -StateFile $tmp
$ks = Get-AlertDedupKey -Sig $sigStall
T '2c 条目落盘带 stall=true' ([bool]$st.Map[$ks].stall) "stall=$($st.Map[$ks].stall)"

Write-Output '[3] 未到 4 小时同身份不重发'
$due3 = Test-AlertDueByIdentity -Sig $sigStall -StateFile $tmp -RepeatHours 4 -Stall
T '3a 4h 窗口照常生效' ((-not $due3.Due) -and $due3.Decision -eq 'window-hit') "$($due3.Decision)"

Write-Output '[4] 成功切流把切流类的身份与抑制锚点一起退休,共存类与监控类的锚点不动'
$null = Test-AlertDueByIdentity -Sig $sigDb -StateFile $tmp -RepeatHours 12
# 监控脚本(Test-AlertSuppressionGrace 的另一个调用方)用的锚点:不带 -Stall,必须活过清偿
$null = Test-AlertSuppressionGrace -Sig 'IHUI-WEB 掉线' -StateFile $tmp -GraceMinutes 3
$st = Read-AlertDedupState -StateFile $tmp
$kStallId = Get-AlertDedupKey -Sig $sigStall
$kStallGrace = Get-AlertDedupKey -Sig ('grace:' + $sigStall)
$kDb = Get-AlertDedupKey -Sig $sigDb
$kMonGrace = Get-AlertDedupKey -Sig ('grace:' + 'IHUI-WEB 掉线')
T '4-前置 四个键此刻都在' ($st.Map.ContainsKey($kStallId) -and $st.Map.ContainsKey($kStallGrace) -and $st.Map.ContainsKey($kDb) -and $st.Map.ContainsKey($kMonGrace)) '锚点没建起来'
$cl = Clear-AlertStallIdentities -StateFile $tmp
T '4a 清偿了 2 格(身份 + 抑制锚点)' ($cl.Ok -and $cl.Cleared -eq 2) "Ok=$($cl.Ok) Cleared=$($cl.Cleared)"
$st = Read-AlertDedupState -StateFile $tmp
T '4b 切流类身份已消失' (-not $st.Map.ContainsKey($kStallId)) '仍在'
T '4c 切流类抑制锚点已消失(否则恢复后秒寄)' (-not $st.Map.ContainsKey($kStallGrace)) '仍在 ⇒ 下一段会立刻发信'
T '4d DB 迁移类(可与成功共存)未被清' ($st.Map.ContainsKey($kDb)) '被误清'
T '4e 监控类的抑制锚点未被清' ($st.Map.ContainsKey($kMonGrace)) '越界清了别人的锚点'

Write-Output '[5] 清偿后再被挡:重新起锚并抑制,不会立刻补发'
$g5 = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
T '5a 重新起锚并抑制' ($g5.Suppressed -and $g5.Decision -in @('grace-window', 'grace-reopened')) "$($g5.Decision)"

Write-Output '[6] 判不出不得伪装成已清'
Fresh
$null = Test-AlertDueByIdentity -Sig $sigStall -StateFile $tmp -RepeatHours 4 -Stall
[System.IO.File]::WriteAllText($tmp, '{ "alerts": { 此文件已被并发写坏')
$cl6 = Clear-AlertStallIdentities -StateFile $tmp
T '6a 坏档案 ⇒ Ok=false 且带原因' ((-not $cl6.Ok) -and $cl6.Error -and $cl6.Cleared -eq 0) "Ok=$($cl6.Ok) Error=$($cl6.Error)"

Write-Output '[7] 旧格式条目(没有 stall 字段)默认不清偿'
Fresh
[System.IO.File]::WriteAllText($tmp, (@{ version = 2; alerts = @{ deadbeef00000000 = @{ sigTs = (Get-Date).ToString('o'); firstTs = (Get-Date).ToString('o'); repeatNo = 0; lastSend = (Get-Date).ToString('o'); label = 'legacy' } } } | ConvertTo-Json -Depth 5))
$cl7 = Clear-AlertStallIdentities -StateFile $tmp
T '7a 无 stall 字段的存量条目原样保留' ($cl7.Ok -and $cl7.Cleared -eq 0) "Cleared=$($cl7.Cleared)"
$st = Read-AlertDedupState -StateFile $tmp
T '7b 读得出且不报错' ((-not $st.Error) -and -not [bool]$st.Map['deadbeef00000000'].stall) "err=$($st.Error)"

Write-Output '[8] 非切流类调用与改动前同形(不写 stall)'
Fresh
$due8 = Test-AlertDueByIdentity -Sig $sigDb -StateFile $tmp -RepeatHours 12
$st = Read-AlertDedupState -StateFile $tmp
T '8a 未带 -Stall ⇒ stall=false' ($due8.Due -and -not [bool]$st.Map[(Get-AlertDedupKey -Sig $sigDb)].stall) '被标成 stall 会在成功后静默'
$cl8 = Clear-AlertStallIdentities -StateFile $tmp
T '8b 该类不被成功清偿' ($cl8.Cleared -eq 0) "Cleared=$($cl8.Cleared)"

Write-Output '[9] 装车锁:调用点必须真的带上 -Stall 与清偿(否则上面全绿也只是模块自己对了)'
$src = Get-Content (Join-Path $PSScriptRoot '..\win\ihui-deploy.ps1') -Raw
T '9a 宽限窗调用带 -Stall' ($src -match 'Test-AlertSuppressionGrace[^\r\n]*-Stall') '调用点没标类 ⇒ 锚点永不被清偿'
T '9b 去重调用把 -Stall 透传' ($src -match 'Test-AlertDueByIdentity[^\r\n]*-Stall:\$Stall') '身份不带类 ⇒ 清偿无对象'
T '9c Fail 走切流类' ($src -match 'Invoke-FailNotify -m \$m -Stall') 'Fail 未标记 ⇒ 本轮未切流仍无终态'
T '9d 成功切流处真的清偿' ($src -match 'Clear-AlertStallIdentities -StateFile \$AlertNotifyStateFile') '没接线 ⇒ 本票等于没做'
T '9e 门禁回滚那处也按切流类' ($src -match 'Invoke-FailNotify -Stall -m "健康门禁未过') '回滚=未切流,漏标会继续 4h 重发'

if (Test-Path $tmp) { Remove-Item $tmp -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
