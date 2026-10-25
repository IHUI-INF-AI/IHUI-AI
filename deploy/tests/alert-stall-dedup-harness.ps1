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

if (Test-Path $tmp) { Remove-Item $tmp -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
