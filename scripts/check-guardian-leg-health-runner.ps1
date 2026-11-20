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

# ok / stale ⇒ 无需动作(warn 档 §12e:stale 只登记不发信)
if ($state -ne 'down') {
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
$mailScript = Join-Path $ProjectRoot 'apps\api\scripts\notify-deploy-failure.ts'
$tsxEntry   = Join-Path $ProjectRoot 'node_modules\.bin\tsx.cmd'
$mailRc = 'missing-exit'
if ((Test-Path $mailScript) -and (Test-Path $tsxEntry)) {
    $detail = if ($json) { ($json.findings -join '; ') } else { 'state=down(无 findings)' }
    $daemonPid = if ($json) { $json.daemonPid } else { '-' }
    $body = @(
        "guardian 存活哨兵判 down(Y-72)",
        "",
        "daemon pid: $daemonPid",
        "判定: $detail",
        "拉起动作: schtasks /run $guardianTask ⇒ rc=$pullRc",
        "本机: $env:COMPUTERNAME  时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ) -join "`r`n"
    $msgFile = Join-Path $LogDir 'guardian-leg-health-alert.md'
    try {
        [System.IO.File]::WriteAllText($msgFile, $body, (New-Object System.Text.UTF8Encoding($false)))
        if ($DryRun) {
            Write-Log "[DryRun] 将走品牌邮件出口告警"
            $mailRc = 'dryrun'
        } else {
            & $tsxEntry $mailScript --alert-id 'guardian-leg-health-down' --message-file $msgFile 2>&1 | Out-Null
            $mailRc = $LASTEXITCODE
            Write-Log ("品牌邮件出口 ⇒ rc={0}" -f $mailRc)
        }
    } catch {
        $mailRc = 'error'
        Write-Log "❌ 告警异常:$_"
    }
} else {
    Write-Log "⚠️ 品牌邮件出口不在位(tsx/mail 脚本)⇒ 告警未判定(不自制 SMTP,守门 81)"
}

exit 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
