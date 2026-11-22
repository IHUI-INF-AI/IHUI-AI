# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ============================================================
#  IHUI 局域网 SSH 入站开通脚本（在被接入的那台 Windows 上运行）
#  目的：允许主控机 192.168.1.37 以 Administrator 免密登录本机
#  用法：管理员 PowerShell 中执行
#        powershell -NoProfile -ExecutionPolicy Bypass -File .\enable-ssh-inbound.ps1
#  特性：幂等，重复运行不会重复写公钥 / 重复建规则
#  不改动：SSH 端口、密码认证策略（仅校正 PubkeyAuthentication=yes）
# ============================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$AllowedFrom     = '192.168.1.37'
$PubKeyLine      = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPKJbbo+Nkeqe8t9qR1WXfd9U4hucSvAxhocEjmYhUX3 ihui-prod-deploy-20260903'
$ExpectedFinger  = 'SHA256:GB0vohF6egrYzLGV1JBP1uMM8ZFEwvvh1hCeJrwfcvk'
$AdminKeysFile   = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
$SshdConfig      = Join-Path $env:ProgramData 'ssh\sshd_config'

function Write-Step($text) { Write-Host "[*] $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "[+] $text" -ForegroundColor Green }
function Write-Warn2($text){ Write-Host "[!] $text" -ForegroundColor Yellow }
function Write-Err2($text) { Write-Host "[x] $text" -ForegroundColor Red }

# ---------- 0. 前置检查：管理员权限 ----------
Write-Step '检查管理员权限'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err2 '需要管理员权限。请右键“Windows PowerShell / 终端”选择“以管理员身份运行”后重试。'
    exit 1
}
Write-Ok "当前账号：$($identity.Name)（管理员）"

# ---------- 1. 安装 OpenSSH Server ----------
Write-Step '检查 OpenSSH Server'
$sshdExe = Join-Path $env:SystemRoot 'System32\OpenSSH\sshd.exe'
if (Test-Path -LiteralPath $sshdExe) {
    Write-Ok 'OpenSSH Server 已安装'
} else {
    $cap = $null
    try {
        $cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' -ErrorAction Stop | Select-Object -First 1
    } catch {
        Write-Warn2 "Get-WindowsCapability 不可用：$($_.Exception.Message)"
    }
    if ($cap -and $cap.State -ne 'Installed') {
        Write-Step "安装能力 $($cap.Name)（需要联网，可能需要几分钟）"
        Add-WindowsCapability -Online -Name $cap.Name | Out-Null
    } elseif (-not $cap) {
        Write-Err2 '无法通过能力包安装 OpenSSH Server。请手动安装后重跑本脚本。'
        exit 1
    }
    if (-not (Test-Path -LiteralPath $sshdExe)) {
        Write-Err2 "安装后仍未找到 $sshdExe"
        exit 1
    }
    Write-Ok 'OpenSSH Server 安装完成'
}

# ---------- 2. 注册并启动 sshd 服务 ----------
Write-Step '配置 sshd 服务（开机自启 + 立即启动）'
$svc = Get-Service -Name sshd -ErrorAction SilentlyContinue
if (-not $svc) {
    New-Service -Name sshd -BinaryPathName "`"$sshdExe`"" -StartupType Automatic -Description 'OpenSSH Server' | Out-Null
    Write-Ok '已注册 sshd 服务'
}
Set-Service -Name sshd -StartupType Automatic
if ((Get-Service -Name sshd).Status -ne 'Running') {
    Start-Service -Name sshd
    Start-Sleep -Seconds 2
}
Write-Ok "sshd 服务状态：$((Get-Service -Name sshd).Status)"

# ---------- 3. 放行 22 端口 ----------
Write-Step '配置防火墙入站规则（TCP 22）'
$ruleName = 'OpenSSH-Server-In-TCP'
try {
    $rule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    if ($rule) {
        if ("$($rule.Enabled)" -ne 'True') { Enable-NetFirewallRule -Name $ruleName }
        Write-Ok "已启用系统自带规则 $ruleName"
    } else {
        New-NetFirewallRule -Name $ruleName -DisplayName 'OpenSSH Server (TCP 22)' `
            -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -Enabled True | Out-Null
        Write-Ok "已创建入站规则 $ruleName"
    }
} catch {
    Write-Warn2 "NetFirewall 模块不可用，改用 netsh"
    $existing = & netsh advfirewall firewall show rule name="OpenSSH Server (TCP 22)" 2>$null | Select-String '规则名|Rule Name'
    if ($existing) {
        Write-Ok 'netsh 规则已存在，跳过'
    } else {
        & netsh advfirewall firewall add rule name="OpenSSH Server (TCP 22)" dir=in action=allow protocol=TCP localport=22 | Out-Null
        Write-Ok '已通过 netsh 放行 TCP 22'
    }
}

# ---------- 4. 校正 PubkeyAuthentication ----------
Write-Step '检查公钥认证开关'
if (Test-Path -LiteralPath $SshdConfig) {
    $raw = Get-Content -LiteralPath $SshdConfig -Raw
    if ($raw -match '(?m)^\s*PubkeyAuthentication\s+no') {
        $bak = "$SshdConfig.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -LiteralPath $SshdConfig -Destination $bak -Force
        $new = [regex]::Replace($raw, '(?m)^\s*PubkeyAuthentication\s+no\s*$', 'PubkeyAuthentication yes')
        [IO.File]::WriteAllText($SshdConfig, $new, (New-Object Text.UTF8Encoding($false)))
        Write-Warn2 "已把 PubkeyAuthentication 改为 yes（备份 $bak）"
        Restart-Service -Name sshd
        Start-Sleep -Seconds 2
    } else {
        Write-Ok 'PubkeyAuthentication 未被禁用'
    }
    $pwdAuth = if ($raw -match '(?m)^\s*PasswordAuthentication\s+yes') { 'yes' } else { 'no/未显式设置' }
    Write-Warn2 "当前 PasswordAuthentication：$pwdAuth（本脚本不改它）"
} else {
    Write-Warn2 "未找到 $SshdConfig，跳过配置校正（默认值通常允许公钥）"
}

# ---------- 5. 写入主控机公钥 ----------
Write-Step "写入主控机公钥（$AllowedFrom）"
function Add-KeyToFile {
    param([string]$Path, [string]$Key)
    $blob = ($Key -split ' ')[1]
    $dir = Split-Path -Path $Path -Parent
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $lines = @()
    if (Test-Path -LiteralPath $Path) {
        $lines = @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue | Where-Object { $_.Trim() -ne '' })
    }
    $exists = $false
    foreach ($l in $lines) { if ($l -match [regex]::Escape($blob)) { $exists = $true; break } }
    if ($exists) {
        Write-Ok "公钥已存在，跳过：$Path"
        return
    }
    $all = @($lines) + @($Key)
    # 必须以 UTF-8 无 BOM 写入：Windows OpenSSH 读带头 BOM 的首行会判为非法公钥
    [IO.File]::WriteAllText($Path, (($all -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
    Write-Ok "已追加公钥：$Path"
}

# 管理员账号走 ProgramData 的 administrators_authorized_keys
Add-KeyToFile -Path $AdminKeysFile -Key $PubKeyLine
# 同时写用户目录一份，兼容 AuthorizedKeysFile 指向 ~/.ssh/authorized_keys 的配置
Add-KeyToFile -Path (Join-Path $env:USERPROFILE '.ssh\authorized_keys') -Key $PubKeyLine

# ---------- 6. 修正 administrators_authorized_keys 权限 ----------
Write-Step '修正密钥文件权限（仅 Administrators + SYSTEM）'
if (Test-Path -LiteralPath $AdminKeysFile) {
    & icacls $AdminKeysFile /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
    Write-Ok '权限已收紧'
} else {
    Write-Warn2 '未生成 administrators_authorized_keys，跳过'
}

# ---------- 7. 终态自检 ----------
Write-Step '终态自检'
$svcStatus = (Get-Service -Name sshd).Status.ToString()
$netLines = @(netstat -ano | Select-String ':22\s+.*LISTENING')
$port22 = ($netLines.Count -gt 0)

$ipv4 = ''
try {
    $adapters = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' -ErrorAction Stop
    foreach ($n in $adapters) {
        foreach ($a in $n.IPAddress) {
            if ($a -match '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' -and $a -notlike '127.*') { $ipv4 = $a; break }
        }
        if ($ipv4) { break }
    }
} catch { }

$finger = 'unverified'
$keygen = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh-keygen.exe'
if (-not (Test-Path -LiteralPath $keygen)) { $keygen = 'ssh-keygen' }
if (Test-Path -LiteralPath $AdminKeysFile) {
    try {
        $tmp = Join-Path $env:TEMP 'ihui-key-check.pub'
        [IO.File]::WriteAllText($tmp, ((Get-Content -LiteralPath $AdminKeysFile | Where-Object { $_ -match 'ihui-prod-deploy' } | Select-Object -First 1) + "`n"), (New-Object Text.UTF8Encoding($false)))
        $out = & $keygen -lf $tmp -E sha256 2>$null
        if ($out -match '(SHA256:[A-Za-z0-9+/=]+)') { $finger = $matches[1] }
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    } catch { }
}

Write-Host ''
Write-Host '================ 自检结果 ================' -ForegroundColor Cyan
Write-Host "主机名        : $env:COMPUTERNAME"
Write-Host "本机 IPv4     : $ipv4"
Write-Host "sshd 状态     : $svcStatus"
Write-Host "22 端口监听   : $(if($port22){'LISTENING'}else{'未监听'})"
Write-Host "公钥指纹      : $finger"
Write-Host "预期指纹      : $ExpectedFinger"
Write-Host "指纹匹配      : $(if($finger -eq $ExpectedFinger){'是'}else{'否（请把上面实际指纹回传）'})"
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

$ready = ($svcStatus -eq 'Running') -and $port22 -and ($finger -eq $ExpectedFinger)
$summary = [ordered]@{
    hostname  = $env:COMPUTERNAME
    ipv4      = $ipv4
    sshd      = $svcStatus
    port22    = $(if ($port22) { 'LISTENING' } else { 'DOWN' })
    keyFinger = $finger
    user      = $env:USERNAME
    ready     = $ready
}
Write-Host '--- 回报给主控机的摘要（直接复制这一行）---'
Write-Host ($summary | ConvertTo-Json -Compress)

if ($ready) {
    Write-Ok "开通完成。主控机现在可执行：ssh Administrator@$ipv4"
    exit 0
} else {
    Write-Warn2 '自检未全部通过，请把上面的 JSON 摘要与输出回传给主控机排查。'
    exit 2
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
