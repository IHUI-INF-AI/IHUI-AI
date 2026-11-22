# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ============================================================================
# check-guardian-leg-health-runner.ps1 (Y-72, 2026-11-19)
# ----------------------------------------------------------------------------
# 票面 Y-72 剩余两格的落地腿:
#   ① 每 15 分钟跑一次 scripts/check-guardian-leg-health.mjs (只读哨兵)
#   ② state=down 时 → 走品牌邮件出口告警 + 拉起 git-guardian 计划任务
#
# 只读哨兵本体绝不拉起(三态 ok/stale/down);本 runner 是唯一「动了手」的层。
# warn(§12e):stale 只登记不发信,down 才告警+拉起。
#
# 用法(计划任务调 VBS,VBS 调本脚本 -Quiet):
#   pwsh -ExecutionPolicy Bypass -File check-guardian-leg-health-runner.ps1            # 交互看结果
#   pwsh ... -Quiet      # 计划任务档,静默,down 才动作
# 退出码: 0=ok/stale(无需动作) 1=down 已告警+已尝试拉起 2=错误
# ============================================================================

#requires -Version 7
param(
    [switch]$Quiet,
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'

# ---- 路径(由脚本位置推导,绝不硬编码绝对盘符) ----
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptsDir
$Sentinel    = Join-Path $ScriptsDir 'check-guardian-leg-health.mjs'
$LogDir      = Join-Path $ProjectRoot '.ihui-agent\tmp'
$LogFile     = Join-Path $LogDir 'guardian-leg-health-runner.log'

if (-not (Test-Path $LogDir)) {
    try { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null } catch {}
}

function Write-Log([string]$msg) {
    $line = ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
    if (-not $Quiet) { Write-Output $line }
    try { Add-Content -Path $LogFile -Value $line -Encoding utf8 } catch {}
}

if (-not (Test-Path $Sentinel)) {
    Write-Log "❌ 哨兵本体缺失:$Sentinel ⇒ 未判定,不动作(宁停不猜)"
    exit 2
}

# ---- 跑只读哨兵(--json) ----
$sentinelOut = & node $Sentinel --json 2>&1
$sentinelRc  = $LASTEXITCODE
$json = $null
try { $json = $sentinelOut | ConvertFrom-Json } catch {}

$state = if ($json) { [string]$json.state } else { 'undetermined' }
Write-Log ("哨兵判定 state={0} rc={1}" -f $state, $sentinelRc)

# ---- 邮件出口取径 + UNDELIVERED 台账(第 87 项,2026-11-21)-------------------
# 现场(一手):本机 15:53–16:38 连续 6 轮 state=down,而每一轮的告警都只落了一行
#   「❌ 品牌邮件出口不在位(tsx/mail 脚本)⇒ 告警未判定」—— 也就是说"守护死了"这件事
#   从来到不了人(§5e 的单通道实际是断的)。根因:出口按**唯一一条硬编码路径**取 tsx
#   (根 node_modules/.bin/tsx.cmd),而本机只有工作区那份 apps/api/node_modules/.bin/tsx.cmd
#   (根 package.json 没装 tsx);路径不对就折成"出口不在位",而"不在位"只写日志、不留可追的账。
# 失效方向(§0.10 / §5e):① 取径改候选序,并**把试过的路径逐条点名**;② 投递失败(缺失或
#   非 0)一律落 UNDELIVERED 台账(带轮次与原因),下次投递成功时补一条"此前 N 轮未送达"再清账;
#   ③ 绝不写"已告警"——没送到就说没送到。
$Undelivered = Join-Path $ProjectRoot '.ihui-agent\state\guardian-leg-health-UNDELIVERED.json'
$mailScript  = Join-Path $ProjectRoot 'apps\api\scripts\notify-deploy-failure.ts'
$tsxTrials = @(
    (Join-Path $ProjectRoot 'node_modules\.bin\tsx.cmd'),
    (Join-Path $ProjectRoot 'apps\api\node_modules\.bin\tsx.cmd')
)
$tsxEntry = $null
foreach ($c in $tsxTrials) { if (Test-Path $c) { $tsxEntry = $c; break } }

function Read-Undelivered {
    param([string]$Path)
    try {
        if (-not (Test-Path $Path)) { return $null }
        $raw = Get-Content -Path $Path -Raw -Encoding utf8
        return ($raw | ConvertFrom-Json)
    } catch { return $null }
}
function Write-Undelivered {
    param([string]$Path, [string]$Reason, [string]$State)
    try {
        $prev = Read-Undelivered -Path $Path
        $rounds = if ($prev -and $prev.rounds) { [int]$prev.rounds + 1 } else { 1 }
        $since  = if ($prev -and $prev.since) { [string]$prev.since } else { (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
        $obj = [ordered]@{
            since   = $since
            rounds  = $rounds
            lastAt  = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
            state   = $State
            reason  = $Reason
            note    = '本账存在 = 有告警没送到人;下次投递成功自动补发摘要并清账(§5e)'
        }
        [System.IO.File]::WriteAllText($Path, ($obj | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
    } catch { Write-Log "❌ UNDELIVERED 台账写入失败:$_" }
}

function Send-BrandMail {
    param([string]$MsgFile, [string]$AlertId, [string]$Body)
    try {
        [System.IO.File]::WriteAllText($MsgFile, $Body, (New-Object System.Text.UTF8Encoding($false)))
        if ($DryRun) { return 'dryrun' }
        & $tsxEntry $mailScript --alert-id $AlertId --message-file $MsgFile 2>&1 | Out-Null
        return [string]$LASTEXITCODE
    } catch {
        Write-Log "❌ 告警异常:$_"
        return 'error'
    }
}

$mailExitUsable = (Test-Path $mailScript) -and $tsxEntry
if ($mailExitUsable) {
    # 取径必须可见:本项病灶就是"某一条硬编码路径不存在"被折成"出口不在位"(§0.3 未判定不得冒充判定)
    Write-Log ("ℹ️ 品牌邮件出口取径:tsx=" + $tsxEntry + " mail=" + $mailScript)
} else {
    Write-Log ("⚠️ 品牌邮件出口不可用:mail=" + (Test-Path $mailScript) + " tsx=" + ($tsxEntry -eq $null) + " 试过:" + ($tsxTrials -join ' | '))
}

# 恢复补发:此前有未送达的告警,而这一轮不再 down ⇒ 补一条"已恢复 + 此前 N 轮未送达"再清账
if ($state -ne 'down') {
    $prevUndel = Read-Undelivered -Path $Undelivered
    if ($prevUndel -and $mailExitUsable) {
        $body = @(
            "guardian 存活哨兵恢复(state=$state)",
            "",
            "此前未送达: $($prevUndel.rounds) 轮(state=$($prevUndel.state)),自 $($prevUndel.since)",
            "最近一次未送达原因: $($prevUndel.reason)",
            "本机: $env:COMPUTERNAME  时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        ) -join "`r`n"
        $rc = Send-BrandMail -MsgFile (Join-Path $LogDir 'guardian-leg-health-recovered.md') -AlertId 'guardian-leg-health-recovered' -Body $body
        Write-Log ("品牌邮件出口(恢复补发)⇒ rc={0}" -f $rc)
        if ($rc -eq '0') { try { Remove-Item -Path $Undelivered -Force } catch {} ; Write-Log "✅ 未送达告警已补发并清账" }
        elseif (-not $DryRun) { Write-Undelivered -Path $Undelivered -Reason ("恢复补发失败 rc=" + $rc) -State $state }
    }
    if ($state -eq 'stale') { Write-Log "⚠️ stale(§12e):只登记,不发信不拉起" }
    exit 0
}

# ---- down ⇒ 告警 + 拉起 ----
Write-Log "🚨 state=down ⇒ 走告警+拉起腿"

# ① 拉起:启动 git-guardian 计划任务(daemon 的载体)
$guardianTask = '\IHUI-AI git-guardian'
$pullRc = 'skipped'
if ($DryRun) {
    Write-Log "[DryRun] 将 schtasks /run $guardianTask"
    $pullRc = 'dryrun'
} else {
    try {
        schtasks /run /tn $guardianTask 2>&1 | Out-Null
        $pullRc = $LASTEXITCODE
        Write-Log ("schtasks /run {0} ⇒ rc={1}" -f $guardianTask, $pullRc)
    } catch {
        $pullRc = 'error'
        Write-Log "❌ 拉起异常:$_"
    }
}

# ② 告警:走品牌邮件出口(与 git-guardian.mjs dispatchGuardMail 同一出口,守门 81 硬拦自拼 SMTP)
if ($mailExitUsable) {
    $detail = if ($json -and $json.legs) { (($json.legs.PSObject.Properties | Where-Object { $_.Value.stale -or $_.Value.down } | ForEach-Object { "{0}={1}({2})" -f $_.Name, $(if ($_.Value.down) { 'down' } else { 'stale' }), $_.Value.ageHuman }) -join '; ') } else { 'state=down(无 findings)' }
    if (-not $detail) { $detail = 'state=down(三腿均新鲜,daemon 侧判死)' }
    # 第 88 项:三腿 tick 可能是兜底任务写的 —— 把"谁在跑"写进信文,否则收信人分不清"腿还活着"与"守护还活着"
    $executorNote = if ($json -and $json.executor) {
        "执行体=$($json.executor.kind) role=$($json.executor.role) pid=$($json.executor.pid) alive=$($json.executor.alive) hb=$($json.executor.heartbeatAgeHuman)$(if ($json.executor.pidReused) { ' ⚠️pid已被复用' } else { '' })"
    } else { '执行体=-' }
    if ($json -and $json.pidSource -eq 'pid-dead' -and $json.legState -ne 'down') { $detail = "常驻 daemon 已死(pid-dead);三腿仍新鲜说明只有一次性任务在兜底 ⇒ $detail" }
    # 哨兵 --json 的键是 `pid`(不是 daemonPid):旧写法取不到就恒打 "-",把"有 pid"读成"没有 pid"(第 87 项顺手修)
    $prevUndel = Read-Undelivered -Path $Undelivered
    $body = @(
        "guardian 存活哨兵判 down(Y-72)",
        "",
        "daemon pid: $(if ($json) { "$($json.pid)($($json.pidSource))" } else { '-' })",
        $executorNote,
        "判定: $detail",
        "拉起动作: schtasks /run $guardianTask ⇒ rc=$pullRc",
        $(if ($prevUndel) { "此前未送达: $($prevUndel.rounds) 轮(自 $($prevUndel.since))" } else { "" }),
        "本机: $env:COMPUTERNAME  时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ) -join "`r`n"
    $mailRc = Send-BrandMail -MsgFile (Join-Path $LogDir 'guardian-leg-health-alert.md') -AlertId 'guardian-leg-health-down' -Body $body
    Write-Log ("品牌邮件出口 ⇒ rc={0}" -f $mailRc)
    if ($mailRc -ne '0') { if (-not $DryRun) { Write-Undelivered -Path $Undelivered -Reason ("投递失败 rc=" + $mailRc) -State $state } }
    elseif ($prevUndel) { if (-not $DryRun) { try { Remove-Item -Path $Undelivered -Force } catch {} }; Write-Log "✅ 本轮告警已含此前未送达轮次,清账" }
} else {
    Write-Undelivered -Path $Undelivered -Reason '出口不可用(tsx 或 mail 脚本缺失)' -State $state
    Write-Log "❌ 告警未投递:品牌邮件出口不可用(已落 UNDELIVERED 台账,下次投递成功自动补发)"
}

exit 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
