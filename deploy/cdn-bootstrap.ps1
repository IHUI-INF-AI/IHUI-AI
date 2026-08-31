#!/usr/bin/env powershell
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  One-shot bootstrap for the image CDN host machine (the box behind the tunnel).

.DESCRIPTION
  Designed for the machine that already serves aizhs.top through an intranet
  tunnel with Cloudflare proxy (orange cloud). In that setup TLS is terminated
  at Cloudflare, so the origin only needs plain HTTP.

  Steps performed:
    1. Verify Node.js exists.
    2. Locate server-root (falls back to ../server-root or the packaged copy).
    3. Open firewall inbound rules for the chosen ports (best effort).
    4. Start cdn-server.js in HTTP mode (or HTTPS when certs are present).
    5. Self-check via local HTTP request.
    6. Optional: register a Scheduled Task for auto start (-Install).

.EXAMPLES
  # Quick start (HTTP only, origin behind Cloudflare proxy)
  .\cdn-bootstrap.ps1

  # Custom ports + auto-start task
  .\cdn-bootstrap.ps1 -HttpPort 8090 -Install

  # Local HTTPS mode (only useful WITHOUT Cloudflare proxy)
  .\cdn-bootstrap.ps1 -HttpsPort 443 -Cert cert.pem -Key key.pem
#>
param(
  [int]$HttpPort   = 80,
  [int]$HttpsPort  = 0,
  [string]$Root    = '',
  [string]$Cert    = '',
  [string]$Key     = '',
  [switch]$Install,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$here = Split-Path $MyInvocation.MyCommand.Path -Parent

# --- 1. node check -----------------------------------------------------------
try { $nodeVer = (& node -v) } catch {
  Write-Host '[FATAL] Node.js not found. Install LTS from https://nodejs.org' -ForegroundColor Red
  exit 1
}
Write-Host "[ok] Node.js $nodeVer"

# --- 2. locate static root ---------------------------------------------------
if (-not $Root) {
  foreach ($cand in @((Join-Path $here 'server-root'), (Join-Path $here '..' | Join-Path -ChildPath 'server-root'))) {
    if (Test-Path $cand) { $Root = $cand; break }
  }
}
if (-not $Root -or -not (Test-Path $Root)) {
  Write-Host '[FATAL] server-root not found. Copy deploy/server-root next to this script.' -ForegroundColor Red
  exit 1
}
$manifest = Join-Path $Root 'MANIFEST.txt'
$imgCount = @(Get-ChildItem $Root -Recurse -File -Include *.png,*.jpg,*.jpeg,*.gif,*.webp).Count
Write-Host "[ok] root: $Root ($imgCount image files)"

# --- 3. firewall (best effort) ----------------------------------------------
foreach ($p in @($HttpPort, $HttpsPort) | Where-Object { $_ -gt 0 }) {
  $rule = "IHUI-CDN-$p"
  try {
    New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow -ErrorAction Stop | Out-Null
    Write-Host "[ok] firewall rule added: TCP/$p"
  } catch {
    Write-Host "[skip] firewall rule '$rule' not added ($($_.Exception.Message)). Run as admin to enable." -ForegroundColor Yellow
  }
}

# --- 4. build server args ----------------------------------------------------
$srvArgs = @((Join-Path $here 'cdn-server.js'), '--root', $Root, '--http-port', $HttpPort)
if ($HttpsPort -gt 0) { $srvArgs += @('--https-port', $HttpsPort) }
if ($Cert -and (Test-Path $Cert)) { $srvArgs += @('--cert', $Cert) }
if ($Key  -and (Test-Path $Key))  { $srvArgs += @('--key',  $Key) }

# --- 5. optional scheduled task ---------------------------------------------
if ($Install) {
  $cmd = "node $($srvArgs -join ' ') --cwd `"$here`""
  try {
    schtasks /Create /F /TN 'IHUI-ImageCDN' /SC ONLOGON /RL HIGHEST /TR "$cmd" | Out-Null
    Write-Host '[ok] scheduled task registered: IHUI-ImageCDN (runs at logon)'
  } catch {
    Write-Host "[warn] task registration failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# --- 6. start & self-check ---------------------------------------------------
if ($NoStart) { Write-Host '[done] bootstrap complete (server not started).' ; exit 0 }
Write-Host "[..] starting cdn-server.js on http*://0.0.0.0:$HttpPort ..."
$argLine = ($srvArgs | ForEach-Object { if ($_ -match '\s') { "`"$_`"" } else { $_ } }) -join ' '
$proc = Start-Process -FilePath 'node' -ArgumentList $argLine -WorkingDirectory $here -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 3
try {
  $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$HttpPort/tabbar/tabbar/home.png" -UseBasicParsing -TimeoutSec 6
  $ph = $probe.Headers['X-Placeholder']
  Write-Host ("[ok] self-check: {0} bytes{1}" -f $probe.RawContentLength, $(if ($ph) { " (PLACEHOLDER missing-image)" } else { " (REAL image)" }))
} catch {
  Write-Host "[warn] probe failed: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ''
Write-Host '================ NEXT STEPS ================' -ForegroundColor Cyan
Write-Host ' 1. Cloudflare DNS for aizhs.top zone:'
Write-Host '      A/CNAME  img  ->  this host   (orange-cloud proxy ON)'
Write-Host '      SSL/TLS mode: Flexible (origin speaks plain HTTP)'
Write-Host ' 2. WeChat MP console -> downloadFile/request legal domains:'
Write-Host '      add https://img.aizhs.top'
Write-Host ' 3. Verify from outside: https://img.aizhs.top/tabbar/tabbar/home.png'
Write-Host '============================================' -ForegroundColor Cyan
Write-Host "server pid: $($proc.Id)  (stop: Stop-Process -Id $($proc.Id))"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
