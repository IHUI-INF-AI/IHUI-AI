# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#Requires -Version 5.1
<#
.SYNOPSIS
  反向隧道 SSH 通道一键体检（只读）。
.DESCRIPTION
  校验 127.0.0.1:2222 反向隧道是否存活、量测 SSH banner 往返延迟、
  量测一次公钥登录耗时并取回 whoami/hostname，最后输出单行 JSON 汇总。
  全程只读：不修改 sshd、防火墙、计划任务、隧道配置，不写远端文件。
.PARAMETER TargetHost
  隧道本地监听地址，默认 127.0.0.1。
.PARAMETER Port
  隧道本地监听端口，默认 2222。
.PARAMETER SshAlias
  登录使用的 ssh 别名，默认 lcc（指向 127.0.0.1:2222）。
.PARAMETER BannerSamples
  banner 往返采样次数，默认 3。
.PARAMETER SkipLogin
  只测监听与延迟，不做登录验证。
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\check-lcc-tunnel.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\check-lcc-tunnel.ps1 -SkipLogin
.NOTES
  退出码：0 全部通过；1 任一检查失败。
#>
[CmdletBinding()]
param(
    [string]$TargetHost = '127.0.0.1',
    [int]$Port = 2222,
    [string]$SshAlias = 'lcc',
    [int]$BannerSamples = 3,
    [switch]$SkipLogin
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Invoke-BannerProbe {
    param([string]$HostName, [int]$TcpPort)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $iar = $client.BeginConnect($HostName, $TcpPort, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(15000, $false)
        if (-not $ok) { throw 'connect timeout after 15000ms' }
        $client.EndConnect($iar)
        $sw.Stop()
        $connectMs = [int]$sw.ElapsedMilliseconds

        $stream = $client.GetStream()
        $stream.ReadTimeout = 15000
        $buf = New-Object byte[] 256
        $sw2 = [System.Diagnostics.Stopwatch]::StartNew()
        $read = $stream.Read($buf, 0, $buf.Length)
        $sw2.Stop()
        if ($read -le 0) { throw 'empty banner' }
        $bannerMs = [int]$sw2.ElapsedMilliseconds
        $bannerText = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read).Trim()

        return [pscustomobject]@{
            ConnectMs = $connectMs
            BannerMs  = $bannerMs
            Banner    = $bannerText
        }
    }
    finally {
        $client.Close()
    }
}

$summary = [ordered]@{
    checked_at    = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    listen_2222   = $false
    banner        = ''
    connect_ms    = @()
    banner_rtt_ms = @()
    banner_avg_ms = $null
    login_seconds = $null
    whoami        = ''
    hostname      = ''
    exit_code     = $null
    ok            = $false
    note          = ''
}

$failures = New-Object System.Collections.Generic.List[string]

# 1) 监听检查
try {
    $probe = Invoke-BannerProbe -HostName $TargetHost -TcpPort $Port
    $summary.listen_2222 = $true
    $summary.banner = $probe.Banner
    $summary.connect_ms += $probe.ConnectMs
    $summary.banner_rtt_ms += $probe.BannerMs
}
catch {
    $summary.note = "隧道未监听或不可达：$($_.Exception.Message)"
    $failures.Add('listen')
}

# 2) 延迟采样
if ($summary.listen_2222) {
    for ($i = 1; $i -lt $BannerSamples; $i++) {
        try {
            $p = Invoke-BannerProbe -HostName $TargetHost -TcpPort $Port
            $summary.connect_ms += $p.ConnectMs
            $summary.banner_rtt_ms += $p.BannerMs
        }
        catch {
            $failures.Add("banner-$i")
        }
    }
    if ($summary.banner_rtt_ms.Count -gt 0) {
        $sum = 0
        foreach ($v in $summary.banner_rtt_ms) { $sum += $v }
        $summary.banner_avg_ms = [int][math]::Round($sum / $summary.banner_rtt_ms.Count, 0)
    }
}

# 3) 登录验证
if ($summary.listen_2222 -and -not $SkipLogin) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $out = & ssh -o BatchMode=yes -o ConnectTimeout=15 $SshAlias "whoami & hostname" 2>&1
    $code = $LASTEXITCODE
    $sw.Stop()
    $summary.login_seconds = [math]::Round($sw.Elapsed.TotalSeconds, 2)
    $summary.exit_code = $code
    $lines = @($out | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne '' })
    foreach ($line in $lines) {
        if ($line -match '\\') { $summary.whoami = $line }
        elseif ($line -match '^[A-Za-z0-9._-]+$') { $summary.hostname = $line }
    }
    if ($code -ne 0) {
        $failures.Add('login')
        $summary.note = ($lines -join ' | ')
    }
}

if ($failures.Count -eq 0) {
    $summary.ok = $true
    if ($summary.note -eq '') {
        $summary.note = '隧道存活，公钥登录正常'
    }
}
else {
    if ($summary.note -eq '') {
        $summary.note = '失败项：' + ($failures -join ',')
    }
}

$json = [pscustomobject]$summary | ConvertTo-Json -Compress
Write-Output $json

if ($summary.ok) { exit 0 } else { exit 1 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
