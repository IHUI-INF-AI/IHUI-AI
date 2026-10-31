# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# requires -Version 7
# relay-url-handler —— `ihui-relay://` 协议的本机执行端(2026-10-31 立)。
#
# 链路:admin 号池页点「本机切换」→ 浏览器唤起 ihui-relay://switch?provider=X&uid=Y
#       → 本协议 handler(注册在 HKCU,跑在**用户会话**)→ 分发到既有切换器
#       (关客户端 → 换登录态 → 拉起客户端,全程用户会话,无 session 0 隔离问题)。
#
# 红线:
#  - provider/uid 一律先过白名单正则再进命令行,**绝不**把 URL 原文插进任何 shell;
#  - 只调仓内既有切换器(pnpm relay:switch-oneclick / relay:ide-switch),零新引擎;
#  - 快照缺失(本机没登录过该号)⇒ 弹窗如实说明,不静默、不猜快照名。

param(
    [string]$Url = '',
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

# ── 白名单(与 relay-switch/relay-account-switch 的射程对齐)──
$script:GuiProviders = @('workbuddy', 'qoder', 'trae', 'trae-solo')

function Parse-RelayUrl([string]$u) {
    if ([string]::IsNullOrWhiteSpace($u)) { return $null }
    if ($u -notmatch '^ihui-relay://switch\?') { return $null }
    $q = $u.Substring('ihui-relay://switch?'.Length)
    $map = @{}
    foreach ($pair in $q -split '&') {
        $kv = $pair -split '=', 2
        if ($kv.Count -eq 2) { $map[$kv[0]] = [uri]::UnescapeDataString($kv[1]) }
    }
    $provider = [string]$map['provider']
    $uid = [string]$map['uid']
    if ($provider -notmatch '^[a-z][a-z0-9-]{1,31}$') { return $null }
    if ($uid -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{3,127}$') { return $null }
    return @{ provider = $provider; uid = $uid }
}

function Get-PoolSnapshotName([string]$provider, [string]$uid) {
    # workbuddy:pool-snapshot-sync 的固定名(号池派生件,常备常新)
    if ($provider -eq 'workbuddy') {
        $safe = $uid -replace '[^A-Za-z0-9-]', '_'
        return "workbuddy-desktop.pool-$safe.info"
    }
    # ide 族:capture 约定名 pool-<uid>(relay:ide-switch capture --name pool-<uid>)
    return "pool-$uid"
}

function Test-SnapshotExists([string]$provider, [string]$name) {
    $home2 = $env:USERPROFILE
    if ($provider -eq 'workbuddy') {
        return (Test-Path (Join-Path $home2 ".wb-switch\backups\$name"))
    }
    return (Test-Path (Join-Path $home2 ".wb-switch\backups\ide\$provider\$name"))
}

function Invoke-Switch([string]$provider, [string]$snapshot) {
    $pnpm = 'pnpm'
    if ($provider -eq 'workbuddy') {
        & $pnpm --dir $RepoRoot relay:switch-oneclick --to $snapshot --apply --close-client --restart-client 2>&1
    }
    else {
        & $pnpm --dir $RepoRoot relay:ide-switch --ide $provider --to $snapshot --apply 2>&1
    }
    return $LASTEXITCODE
}

function Show-Result([string]$title, [string]$text) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.Interaction]::MsgBox($text, 'OkOnly,Information', $title) | Out-Null
}

function Main {
    $parsed = Parse-RelayUrl $Url
    if ($null -eq $parsed) {
        Show-Result 'ihui-relay' "链接格式不识别:`n$Url`n预期: ihui-relay://switch?provider=<平台>&uid=<账号>"
        return 2
    }
    $provider = $parsed['provider']
    $uid = $parsed['uid']
    if ($script:GuiProviders -notcontains $provider) {
        Show-Result 'ihui-relay' "平台「$provider」没有本机桌面客户端可切换。`n(可切换: $($script:GuiProviders -join ' / '))"
        return 2
    }
    $snapshot = Get-PoolSnapshotName $provider $uid
    if (-not (Test-SnapshotExists $provider $snapshot)) {
        Show-Result '本机没有该号的登录态' "账号 $uid 在本机没有可切换的快照。`n`n请先在本机对应客户端用该账号登录一次(登录即自动留快照),`n之后此按钮即可一键切换。"
        return 1
    }
    Write-Host "[ihui-relay] 切换 $provider → $snapshot"
    $rc = Invoke-Switch $provider $snapshot
    if ($rc -eq 0) {
        Show-Result '切换完成' "$provider 已切换到账号 $uid,客户端已拉起。"
        return 0
    }
    Show-Result '切换失败' "切换器退出码 $rc(详情见上方控制台/日志)。`n登录态若有改动已自动回滚。"
    return $rc
}

if ($SelfTest) {
    $fail = 0
    $p1 = Parse-RelayUrl 'ihui-relay://switch?provider=workbuddy&uid=30763d9f-abcd'
    if ($null -eq $p1 -or $p1['provider'] -ne 'workbuddy') { $fail++ }
    $p2 = Parse-RelayUrl 'ihui-relay://switch?provider=qoder&uid=a-b.c_1'
    if ($null -eq $p2 -or $p2['uid'] -ne 'a-b.c_1') { $fail++ }
    $p3 = Parse-RelayUrl 'ihui-relay://switch?provider=bad%20xx&uid=x'
    if ($null -ne $p3) { $fail++ }
    $p4 = Parse-RelayUrl 'javascript:alert(1)'
    if ($null -ne $p4) { $fail++ }
    $n1 = Get-PoolSnapshotName 'workbuddy' 'u-1'
    if ($n1 -ne 'workbuddy-desktop.pool-u-1.info') { $fail++ }
    $n2 = Get-PoolSnapshotName 'qoder' 'u-1'
    if ($n2 -ne 'pool-u-1') { $fail++ }
    if ($script:GuiProviders -contains 'doubao') { $fail++ }
    if ($fail -gt 0) { Write-Host "SELF-FAIL $fail"; exit 1 }
    Write-Host 'SELF-OK'
    exit 0
}

exit (Main)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
