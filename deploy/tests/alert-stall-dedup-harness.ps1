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

Write-Output '[10] 生产节奏形状:两轮之间隔 23 分钟(> 窗)时,切流类必须升级'
# 为什么单独立一档:[2] 那档把 lastSend 回拨到 30 秒前,而部署环的真实节奏是"构建 + 门禁 8 轮 ≈ 20 分钟"
# 外加最小间隔 30 分钟 ⇒ **两轮之间的间隔恒大于 15 分钟的窗**。原实现在这个形状下每轮都"重新起锚",
# elapsed 永远是 0,escalated 那一支结构上到不了 —— 2026-10-21 11:33 与 11:56 两轮同身份相隔 22.9 分钟,
# 两轮都写"已连续抑制 0 分钟",45 分钟登录 500 一封都没寄,最后被"成功切流清偿"抹平。
# 夹具的形状必须与生产的形状相同,否则"用例全绿"与"判据在生产里有牙"是两件事。
function BackdateWholeGrace([string]$sig, [double]$minutes) {
    # 把**整段**抑制(锚点与上一轮)一起回拨,模拟"两轮真的隔了 N 分钟"
    $st = Read-AlertDedupState -StateFile $tmp
    $k = Get-AlertDedupKey -Sig ('grace:' + $sig)
    $ts = (Get-Date).AddMinutes(-$minutes).ToString('o')
    $st.Map[$k].firstTs = $ts
    $st.Map[$k].lastSend = $ts
    Write-AlertDedupState -StateFile $tmp -Map $st.Map | Out-Null
}
Fresh
$null = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
BackdateWholeGrace $sigStall 23
$g10 = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
T '10a 隔 23 分钟的下一轮 ⇒ 升级,不再抑制' ($g10.Suppressed -eq $false) "Suppressed=$($g10.Suppressed) Decision=$($g10.Decision) Elapsed=$($g10.ElapsedMinutes)"
T '10b 升级理由里报的是**整段**时长而不是 0' ($g10.ElapsedMinutes -ge 15) "ElapsedMinutes=$($g10.ElapsedMinutes)"
T '10c 措辞必须是 escalated(不是重新起锚)' ($g10.Decision -eq 'escalated') $g10.Decision
# 成对反证:非切流类调用方(监控每 5 分钟一轮)保留"隔一个窗 ⇒ 新一轮"的原语义 ——
# 摘掉这条,上周的旧锚会让今天一次正常 3 分钟换流在第一轮就秒寄(2026-10-10 修过的假阳,不得回潮)。
Fresh
$null = Test-AlertSuppressionGrace -Sig 'IHUI-WEB 掉线' -StateFile $tmp -GraceMinutes 15
BackdateWholeGrace 'IHUI-WEB 掉线' 23
$g10d = Test-AlertSuppressionGrace -Sig 'IHUI-WEB 掉线' -StateFile $tmp -GraceMinutes 15
T '10d 非切流类同形状仍按新一轮起锚并抑制(改动不许越界)' ($g10d.Suppressed -and $g10d.Decision -eq 'grace-reopened') "Suppressed=$($g10d.Suppressed) Decision=$($g10d.Decision)"
# 再一条:切流类成功切流后锚点退休,下一段仍从 0 开始(升级通道不许变成"永远秒寄")
Fresh
$null = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
$null = Test-AlertDueByIdentity -Sig $sigStall -StateFile $tmp -RepeatHours 4 -Stall
$null = Clear-AlertStallIdentities -StateFile $tmp
$g10e = Test-AlertSuppressionGrace -Sig $sigStall -StateFile $tmp -GraceMinutes 15 -Stall
T '10e 清偿后下一段重新起锚并抑制' ($g10e.Suppressed -and $g10e.Decision -eq 'grace-window') "Suppressed=$($g10e.Suppressed) Decision=$($g10e.Decision)"

Write-Output '[9] 装车锁:调用点必须真的带上 -Stall 与清偿(否则上面全绿也只是模块自己对了)'
$src = Get-Content (Join-Path $PSScriptRoot '..\win\ihui-deploy.ps1') -Raw
T '9a 宽限窗调用带 -Stall' ($src -match 'Test-AlertSuppressionGrace[^\r\n]*-Stall') '调用点没标类 ⇒ 锚点永不被清偿'
T '9b 去重调用把 -Stall 透传' ($src -match 'Test-AlertDueByIdentity[^\r\n]*-Stall:\$Stall') '身份不带类 ⇒ 清偿无对象'
T '9c Fail 走切流类(只判属性名与归属行,不判排版)' (@(@($src -split "\r?\n" | Where-Object { $_ -match 'Invoke-FailNotify' -and $_ -match '-m\s+\$m\b' -and $_ -match '-Stall\b' })).Count -ge 1) 'Fail 未标记 ⇒ 本轮未切流仍无终态'
# ↑ 9c 原先锚的是**逐字排版**(`Invoke-FailNotify -m $m -Stall`)。2026-10-21 实测它因此长期红着:
# 后来有人在这两个参数之间插入 `-Detail $Detail`(行为完全正确),字面锚不再命中,而它报的是
# "Fail 未标记"——**指控错了东西**,而且因为本 harness 没人接进测试层(见同目录新增的 .test.mjs),
# 这枚红持续 nobody-sees。改成按行取属性(不判顺序、不判空格),并配一条反证:
T '9c-反证 摘掉 -Stall 的同形行必须判 0(证明上面那把扫描有牙,不是换了个恒真)' (@('try { Invoke-FailNotify -m $m -Detail $Detail } catch {}' | Where-Object { $_ -match '-m\s+\$m\b' -and $_ -match '-Stall\b' }).Count -eq 0) '恒真式 ⇒ 9c 是装饰不是锁'
T '9d 成功切流处真的清偿' ($src -match 'Clear-AlertStallIdentities -StateFile \$AlertNotifyStateFile') '没接线 ⇒ 本票等于没做'
T '9e 门禁回滚那处也按切流类' ($src -match 'Invoke-FailNotify -Stall -m "健康门禁未过') '回滚=未切流,漏标会继续 4h 重发'

Write-Output '[11] G-21 身份含"本轮原因":同文本换病因必须另开槽位喊出(票面 04:37 那一型)'
$msgG21 = '构建失败 → 保持当前在线版本,不动 web,已记冷却(30 分钟后自动重试)'
$fpA = Get-AlertIdentitySig -Message $msgG21 -Reason 'Module not found: @ihui/shared'
$fpB = Get-AlertIdentitySig -Message $msgG21 -Reason 'SyntaxError: Unexpected token'
Fresh
$d11a = Test-AlertDueByIdentity -Sig $fpA -StateFile $tmp -RepeatHours 4 -Stall
T '11a 病因 A 首发 ⇒ due-new' ($d11a.Due -and $d11a.Decision -eq 'due-new') $d11a.Decision
$d11b = Test-AlertDueByIdentity -Sig $fpA -StateFile $tmp -RepeatHours 4 -Stall
T '11b 同文本同病因重复 ⇒ window-hit(同原因重复仍去重)' ((-not $d11b.Due) -and $d11b.Decision -eq 'window-hit') "$($d11b.Decision) | $($d11b.Note)"
$d11c = Test-AlertDueByIdentity -Sig $fpB -StateFile $tmp -RepeatHours 4 -Stall
T '11c 同文本换病因 ⇒ 第二发不被旧槽压住(due-new)' ($d11c.Due -and $d11c.Decision -eq 'due-new') "$($d11c.Decision) key=$($d11c.Key)"
T '11d 换病因的槽键与病因 A 的槽键不同(同键=还会被压)' ($d11c.Key -ne $d11a.Key) "A=$($d11a.Key) B=$($d11c.Key)"
T '11e 同病因身份逐字节稳定(同因去重的前提,不得吃漂移明细)' ((Get-AlertIdentitySig -Message $msgG21 -Reason 'Module not found: @ihui/shared') -eq $fpA) '身份不稳定 ⇒ 每轮换身份,48h/47 封那一型复活'
# [2026-10-26 票 G-44] 11f 改档:旧断言要求"空原因 ⇒ 身份 = 整条文案",而 G-44 要修的正是这一形
# (文案里任一处读数漂一个值就换一个槽)。新契约 = 身份只含稳定类别枚举,下两条 11g/11h 是它的正向锁。
T '11f 空原因 ⇒ 身份只含类别枚举、不回落整条文案(G-44)' ((Get-AlertIdentitySig -Message $msgG21 -Reason '') -eq '类别=build-failed') "实得:$(Get-AlertIdentitySig -Message $msgG21 -Reason '')"
$msgG44Drift = '构建失败 → 保持当前在线版本,不动 web,已记冷却(45 分钟后自动重试)'
T '11g 同族读数漂移(冷却 30→45 分钟)身份不变(旧形会另开槽)' ((Get-AlertIdentitySig -Message $msgG44Drift -Reason '') -eq (Get-AlertIdentitySig -Message $msgG21 -Reason '')) "漂移后:$(Get-AlertIdentitySig -Message $msgG44Drift -Reason '')"
$msgG44Other = 'git merge --ff-only 本轮远端 tip 分叉且自动收敛无效:需人工收敛后才能切流(未强推、未动任何在途改动)'
T '11h 不同故障族不共槽(构建失败 vs ff 分叉)' ((Get-AlertIdentitySig -Message $msgG44Other -Reason '') -ne (Get-AlertIdentitySig -Message $msgG21 -Reason '')) "另族:$(Get-AlertIdentitySig -Message $msgG44Other -Reason '')"

Write-Output '[12] G-21 装车锁:身份合成真的接进派发入口与调用点(否则上面全绿只是模块自洽)'
T '12a Invoke-FailNotify 有 -Reason 参数' ($src -match 'function Invoke-FailNotify \{[\r\n]+\s*param\([^\r\n]*\[string\]\$Reason') '派发入口不吃原因 ⇒ 本票等于没做'
T '12b 去重判定吃含原因身份' ($src -match 'Test-AlertDueByIdentity -Sig \$dedupSig') '仍吃消息面 $sig ⇒ 换病因照样被旧槽压住'
T '12c 宽限窗锚点仍吃消息面(病因漂移不得重置宽限窗,否则换因反而永久静默)' ($src -match 'Test-AlertSuppressionGrace -Sig \$sig\b') '锚点换成含原因身份 ⇒ 每轮换因重新起锚,escalated 到不了'
T '12d Fail 转发 -Reason' ($src -match 'Invoke-FailNotify -m \$m -Detail \$Detail -Reason \$Reason -Stall') 'Fail 通道没原因 ⇒ 构建/ff 类照样哑'
T '12e 构建失败调用点真的带 reason(票面那一格)' ($src -match 'Fail "构建失败[^\r\n]*-Reason "\$_"') '判据在、调用点没有 = 没有'
T '12f ff 未归类调用点真的带 reason' ($src -match 'Fail "git merge --ff-only 失败\(成因见紧邻上一行\)[^\r\n]*-Reason \$ffErrFp') '通用文案没病因'
T '12g 连败 throw 带末次报错指纹(-Reason "$_" 的病因来源)' ($src -match 'next build 连续 \$MaxTries 次失败[^\r\n]*末次报错') 'throw 不带因 ⇒ reason 仍是通用文案,换病因照样被压'

Write-Output '[13] 部署窗口 runId 命名空间:同一身份各起各的锚,清理只碰目标轮次'
Fresh
$sigWin = 'web(8801) 未监听'
# 普通去重身份(非 grace 锚点)必须在下面所有清理后仍在
$null = Test-AlertDueByIdentity -Sig $sigDb -StateFile $tmp -RepeatHours 4
$gA = Test-AlertSuppressionGrace -Sig $sigWin -StateFile $tmp -GraceMinutes 20 -RunId 'run-A'
$gB = Test-AlertSuppressionGrace -Sig $sigWin -StateFile $tmp -GraceMinutes 20 -RunId 'run-B'
$gN = Test-AlertSuppressionGrace -Sig $sigWin -StateFile $tmp -GraceMinutes 20
T '13a 同一身份在 run-A / run-B / 无 runId 下都被抑制' ($gA.Suppressed -and $gB.Suppressed -and $gN.Suppressed) "A=$($gA.Suppressed) B=$($gB.Suppressed) N=$($gN.Suppressed)"
T '13a 三个 Key 互不相同(否则旧窗口的锚会压住新窗口)' (($gA.Key -ne $gB.Key) -and ($gA.Key -ne $gN.Key) -and ($gB.Key -ne $gN.Key)) "A=$($gA.Key) B=$($gB.Key) N=$($gN.Key)"

$clA = Clear-AlertGraceAnchors -StateFile $tmp -RunId 'run-A'
T '13b 不带 -Keep 清 run-A ⇒ Ok 且 Cleared=1' ($clA.Ok -and $clA.Cleared -eq 1) "Ok=$($clA.Ok) Cleared=$($clA.Cleared) Error=$($clA.Error)"
T '13b Labels 含 run-A|web(8801) 未监听' (@($clA.Labels) -contains "run-A|$sigWin") "Labels=$(@($clA.Labels) -join ',')"

$st = Read-AlertDedupState -StateFile $tmp
T '13c run-B 锚点仍在' ($st.Map.ContainsKey($gB.Key)) 'run-B 被误清'
T '13c 无 runId 的普通 grace 锚点仍在' ($st.Map.ContainsKey($gN.Key)) '无 runId 锚点被误清'
T '13c run-A 的键已消失' (-not $st.Map.ContainsKey($gA.Key)) 'run-A 仍残留'

$gC = Test-AlertSuppressionGrace -Sig $sigWin -StateFile $tmp -GraceMinutes 20 -RunId 'run-C'
$clB = Clear-AlertGraceAnchors -StateFile $tmp -RunId 'run-B' -Keep
T '13d -Keep 只清旧轮次 ⇒ Ok 且 Cleared=1(run-C)' ($clB.Ok -and $clB.Cleared -eq 1) "Ok=$($clB.Ok) Cleared=$($clB.Cleared) Error=$($clB.Error)"
T '13d Labels 含 run-C|web(8801) 未监听' (@($clB.Labels) -contains "run-C|$sigWin") "Labels=$(@($clB.Labels) -join ',')"

$st = Read-AlertDedupState -StateFile $tmp
T '13e run-B 锚点仍在' ($st.Map.ContainsKey($gB.Key)) '当前窗 run-B 被误清'
T '13e 无 runId 的普通 grace 锚点仍在' ($st.Map.ContainsKey($gN.Key)) '实现规定 -Keep 不碰无 runId 前缀的条目'
T '13e run-C 的键已消失' (-not $st.Map.ContainsKey($gC.Key)) 'run-C 仍残留'
T '13f 普通去重身份条目未被误删' ($st.Map.ContainsKey((Get-AlertDedupKey -Sig $sigDb))) 'DB 迁移条目被清理越界删掉'

Fresh
[System.IO.File]::WriteAllText($tmp, '{ "alerts": { 此文件已被并发写坏')
$clG = Clear-AlertGraceAnchors -StateFile $tmp -RunId 'run-A'
T '13g 坏档案 ⇒ Ok=false / Cleared=0 / Error 非空' ((-not $clG.Ok) -and $clG.Cleared -eq 0 -and $clG.Error) "Ok=$($clG.Ok) Cleared=$($clG.Cleared) Error=$($clG.Error)"
Write-Output '[14] G-44 监控腿:监控侧逐项身份必须走同一把尺(单源),两病因不同键 / 换读数同键'
# 立因(现读,不是假想):deploy/win/ihui-monitor.ps1 的 Send-Alert 此前把**整条逐项文案**当去重
# 身份(旧那一行的形状就是"文案折叠空白后 Trim"),而部署侧 2026-10-26 已改档为
# 「类别 + 归一化病因」(Get-AlertIdentitySig)⇒ 全仓两把身份尺(§0.6 单一真相源禁令)。
# 两把尺的实际代价不是"不好看":监控那侧压抖动靠的是**人记得**调用 Get-*AlertSig 分档,
# 那层保护是散文不是器物 —— 下一个新增告警把轮次/条数/时刻/sha/盘符路径拼进文案,
# 就又是一次"每轮换一槽 ⇒ 4h 窗结构上永不命中"(本模块头注的 48h/47 封同族)。
# 纪律:本段只喂**字面量 + 临时档案** $tmp,绝不读写服务的去重档案
# (D:\DevEnv\state\ihui-monitor-state.json),也不 dot-source ihui-monitor.ps1(它顶层起巡检循环,
# 一 dot-source 就联网探站并按真实状态写盘 —— 那是生产动作,不是取证)。
# 路径解析**不能只按 $PSScriptRoot 相对取**:本 harness 会被同目录 .test.mjs 的 T6 变异自证整档
# 复制到临时目录再跑(那把尺的全部意义是"只有摘掉 -Stall 门控才翻红")。复制臂里 ..\win\ 不存在,
# 于是所有按相对路径读源码的锁会一起 FAIL ⇒ 变异臂**不变异也红** ⇒ T6 失去鉴别力(把没判读成判过)。
# 正解 = 先按常规相对位置取,取不到再从当前目录逐级向上找仓库内的真身;一条都找不到 ⇒ 14a 当场喊
# "取不到=未判定",绝不静默跳过(§0.3)。
$monCandidates = @((Join-Path $PSScriptRoot '..\win\ihui-monitor.ps1'))
$monWalk = $PSScriptRoot
for ($i = 0; $i -lt 6 -and $monWalk; $i++) {
    $monWalk = Split-Path $monWalk -Parent
    if ($monWalk) { $monCandidates += (Join-Path $monWalk 'deploy\win\ihui-monitor.ps1') }
}
$monPath = @($monCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
$monSrc = if ($monPath) { Get-Content -LiteralPath $monPath -Raw } else { $null }
T '14a 取到 ihui-monitor.ps1(取不到=未判定,不得记绿)' ([bool]$monSrc) "候选:$($monCandidates -join ' ;; ')"
# 剥掉整行注释再判:# 里逐字写出旧形是**证据**(与本 harness 9c 的按行扫描、T7 的 pragma 教训同一条
# 纪律 —— 判据的字面量写进散文会反噬判据自己)。
$monCode = ''
if ($monSrc) {
    $monCode = (@($monSrc -split "\r?\n" | Where-Object { $_.TrimStart() -notmatch '^#' }) -join "`n")
}
$oldShape = '\$isig\s*=\s*\(\$item'
T '14b 反向锁:整条文案自拼身份那一形不得回潮' ((-not ($monCode -match $oldShape)) -and [bool]$monCode) '回潮:逐项文案又直接当了去重身份'
T '14b-反证 旧形逐字喂进同一条扫描必须命中(否则 13b 是恒真装饰)' ('    $isig = ($item -replace ''\s+'', '''').Trim()' -match $oldShape) '扫描失效'
T '14c 身份面真的调用单源出口' ($monCode -match 'Get-MonitorAlertIdentity\s+-Item\s+\$item') '没接线 ⇒ 本段等于没做'
T '14f 抑制锚点吃身份面(读数漂一下不许把窗重新起锚)' ($monCode -match 'Test-AlertSuppressionGrace -Sig \$isig') '锚点回到文案面 ⇒ escalated 又可能到不了'
T '14g 在场清单与身份面同一把尺(喂文案会把整本台账读成缺席)' ($monCode -match '\$activeSigs = @\(\$alerts \| ForEach-Object \{ Get-MonitorAlertIdentity') '清偿档按 Sig 反查键位,两把尺 ⇒ 4h 抑制被拆掉、每轮重寄'
T '14h 展示面与身份面分家:进主题的是逐项文案,不是归一后的骨架' ($monCode -match '\$dueItems \+= \$itemTxt') '<n>/<ts> 占位符会被寄进人的邮箱'
# 出口本体:只许透传,不许加工(加工 = 第二把尺)
$fnBody = ''
if ($monSrc) {
    $fnStart = $monSrc.IndexOf('function Get-MonitorAlertIdentity')
    if ($fnStart -ge 0) {
        $fnNext = $monSrc.IndexOf("`nfunction ", $fnStart + 1)
        $fnBody = if ($fnNext -lt 0) { $monSrc.Substring($fnStart) } else { $monSrc.Substring($fnStart, $fnNext - $fnStart) }
    }
}
$fnCode = (@($fnBody -split "\r?\n" | Where-Object { $_.TrimStart() -notmatch '^#' }) -join "`n")
# "自己加工"的两种写法(-replace / 用 + 拼标识符)与下面的反例**共用同一条正则** —— 锁与反例
# 各写一份判据,迟早漂开(§22c 的同一条禁令,本 harness 的 9c 与 9c-反证 也是同一个形状)。
$stitch = '-replace|\$\w+\s*\+|\+\s*\$\w'
T '14d 抽到出口函数本体的原文' ($fnCode.Length -gt 0) 'ihui-monitor.ps1 里没有 function Get-MonitorAlertIdentity'
T '14d-2 出口真透传 Get-AlertIdentitySig' ($fnCode -match 'Get-AlertIdentitySig') $fnCode
T '14d-3 出口体内不得再自己加工字符串(-replace / 拼接都是第二把尺)' ((-not ($fnCode -match $stitch)) -and $fnCode.Length -gt 0) $fnCode
$badBody = '  return "ID:" + ($Item -replace ''\s+'', '''').Trim()'
T '14d-反证 自拼形态的出口体必须被同一条扫描抓住(否则 13d-3 是装饰)' ($badBody -match $stitch) '扫描恒真'
# ── 对照取证:把监控真实逐项文案喂给**单源本身** ──────────────────────────────────
$fpDiskWarn = Get-AlertIdentitySig -Message '磁盘剩余 档=1-10GB 卷=D'
$fpDiskCrit = Get-AlertIdentitySig -Message '磁盘剩余 档=lt1GB 卷=D'
T '14i 两病因(磁盘跨档)⇒ 不同键(跨档必须当场重报)' ($fpDiskWarn -ne $fpDiskCrit) "warn=$fpDiskWarn crit=$fpDiskCrit"
$fpUrlA = Get-AlertIdentitySig -Message 'https://aizhs.top/ → 档=访问异常(连续2次确认)'
$fpUrlB = Get-AlertIdentitySig -Message 'https://bsm.aizhs.top/ → 档=访问异常(连续2次确认)'
T '14j 不同 URL ⇒ 不同键,且归一不得吃掉 URL 本身(它是语义不是读数)' (($fpUrlA -ne $fpUrlB) -and ($fpUrlA -match 'aizhs\.top/')) "A=$fpUrlA B=$fpUrlB"
$jitA = Get-AlertIdentitySig -Message 'api(8802) 未监听 连续第 39 轮 2026-10-26 12:00:00 明细 D:\DevEnv\logs\monitor-alerts.log sha=1a2b3c4d5e6f7890'
$jitB = Get-AlertIdentitySig -Message 'api(8802) 未监听 连续第 41 轮 2026-10-26 12:35:00 明细 D:\DevEnv\logs\monitor-alerts.log sha=9f8e7d6c5b4a3210'
T '14k 轮次/条数/时刻/盘符路径/sha 换成另一组 ⇒ 同键(忘分档那一型由单源兜住)' ($jitA -eq $jitB) "A=$jitA B=$jitB"
Fresh
$dk1 = Test-AlertDueByIdentity -Sig $jitA -StateFile $tmp -RepeatHours 4
$dk2 = Test-AlertDueByIdentity -Sig $jitB -StateFile $tmp -RepeatHours 4
T '14k-2 同键在台账层真的压住了下一轮(键相等 + window-hit)' (($dk1.Key -eq $dk2.Key) -and (-not $dk2.Due) -and $dk2.Decision -eq 'window-hit') "k1=$($dk1.Key) k2=$($dk2.Key) d2=$($dk2.Decision)"
# ── 已知代价(现读点名,不是遗漏):班号是裸数字 ⇒ 跨班归一后并成一格 ──────────────
$bk1 = Get-AlertIdentitySig -Message '备份超龄 类别=ihui_dev 档=缺1 班(>26h)'
$bk2 = Get-AlertIdentitySig -Message '备份超龄 类别=ihui_dev 档=缺2 班(>26h)'
$bkOther = Get-AlertIdentitySig -Message '备份超龄 类别=keycloak 档=缺1 班(>26h)'
T '14l 现读点名这一格代价:跨班(班号)归一后同槽,而换类别仍必须不同槽' (($bk1 -eq $bk2) -and ($bk1 -ne $bkOther)) "b1=$bk1 b2=$bk2 other=$bkOther"
Fresh
$be1 = Test-AlertDueByIdentity -Sig $bk1 -StateFile $tmp -RepeatHours 4
$stB = Read-AlertDedupState -StateFile $tmp
$stB.Map[$be1.Key].sigTs = (Get-Date).AddHours(-25).ToString('o')
Write-AlertDedupState -StateFile $tmp -Map $stB.Map | Out-Null
$be2 = Test-AlertDueByIdentity -Sig $bk2 -StateFile $tmp -RepeatHours 4
# 这一条是"代价可接受"的全部依据:跨一班最快 24h(每日 03:00 一班,见 Get-BackupMissedShifts 头注),
# 恒大于 $AlertRepeatHours 的 4h 窗 ⇒ 跨班那一轮上一次寄信早已过窗 ⇒ **信照旧寄出**,只是判定名从
# due-new 变 due-repeat;主题/正文里的实际班号由展示面给出(13h),人不会少收一封。
# 真要在跨班瞬间另开一槽,出路是在单源 deploy/win/alert-dedup.ps1 的 Get-AlertCategory 给监控族
# 登记固定枚举(本席禁改单源 ⇒ 交主席),而不是在监控侧再拼一把尺。
T '14m 跨班那一轮仍照旧寄信(信面不丢)' ($be2.Due -and $be2.Decision -eq 'due-repeat') "d1=$($be1.Decision) d2=$($be2.Decision) Due=$($be2.Due)"

if (Test-Path $tmp) { Remove-Item $tmp -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
