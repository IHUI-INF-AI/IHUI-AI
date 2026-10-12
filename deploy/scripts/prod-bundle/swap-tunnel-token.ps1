# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# Cloudflare Tunnel Token 一键替换脚本(rotate 后使用)
# =============================================================================
# 背景:旧 token 曾进公开 git 历史,须在 Cloudflare 后台 rotate 后执行本脚本。
# 当前服务模式(2026-08-05 rotate 后定型):
#   ImagePath: cloudflared.exe tunnel run --protocol http2 --token-file C:\ProgramData\cloudflared\token
#   → token 只存文件,不进命令行参数(防 Process Explorer 可见)
# 本脚本只更新 token 文件并重启服务,**不重装服务**(保持 --token-file --protocol http2 安全模式)。
#
# 用法(管理员 PowerShell):
#   方式 A:已把新 token 粘贴到 TUNNEL_TOKEN.local.txt 后直接运行:
#     powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\swap-tunnel-token.ps1
#   方式 B:直接传参:
#     powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\swap-tunnel-token.ps1 -NewToken "eyJ..."
# =============================================================================
param(
    [string]$NewToken = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tokenFile = "$ProjectRoot\deploy\prod-bundle\cloudflared\TUNNEL_TOKEN.local.txt"
$serviceTokenFile = "C:\ProgramData\cloudflared\token"

function Write-Step { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-OK  { param([string]$m) Write-Host "[OK] $m" -ForegroundColor Green }

# 1. 获取新 token
if (-not $NewToken) {
    if (Test-Path $tokenFile) {
        $NewToken = (Get-Content $tokenFile -Raw).Trim()
    }
}
if ($NewToken -notmatch "eyJ[A-Za-z0-9_.-]+") {
    Write-Host "[ERROR] 未获取到有效 token。请先:1) Cloudflare 后台 rotate;2) 将新 token 填入 $tokenFile" -ForegroundColor Red
    exit 1
}
Write-Step "步骤 1/4: 新 token 已加载(长度 $($NewToken.Length))"

# 2. 备份并更新两个 token 文件
Write-Step "步骤 2/4: 更新 token 文件(备份旧 token)"
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($f in @($tokenFile, $serviceTokenFile)) {
    if (Test-Path $f) {
        Copy-Item $f "$f.bak-$stamp" -Force
        Write-OK "已备份 $f → .bak-$stamp"
    }
}
if (-not (Test-Path (Split-Path $serviceTokenFile -Parent))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $serviceTokenFile -Parent) | Out-Null
}
$NewToken | Set-Content $tokenFile -Encoding UTF8 -NoNewline
$NewToken | Set-Content $serviceTokenFile -Encoding UTF8 -NoNewline
Write-OK "已写入 TUNNEL_TOKEN.local.txt + C:\ProgramData\cloudflared\token"

# 3. 重启 Cloudflared 服务(不重装,保持 --token-file --protocol http2 模式)
Write-Step "步骤 3/4: 重启 Cloudflared 服务"
$svc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "[ERROR] Cloudflared 服务不存在,无法重启" -ForegroundColor Red
    exit 1
}
Stop-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Start-Service -Name "Cloudflared" -ErrorAction Stop
$img = (Get-CimInstance Win32_Service -Filter "Name='Cloudflared'").PathName
if ($img -notmatch "--token-file") {
    Write-Host "[WARN] 服务 ImagePath 不含 --token-file,当前为: $img" -ForegroundColor Yellow
    Write-Host "       安全模式已偏离,建议手动修正(见 README 运维节)" -ForegroundColor Yellow
} else {
    Write-OK "Cloudflared 已重启,ImagePath 保持安全模式: $img"
}

# 4. 公网验证
Write-Step "步骤 4/4: 公网验证"
Start-Sleep -Seconds 12
$ok = $true
foreach ($u in @("https://aizhs.top/", "https://aizhs.top/api/health", "https://bsm.aizhs.top/", "https://api.aizhs.top/api/health", "https://ai.aizhs.top/health")) {
    try {
        $r = Invoke-WebRequest -Uri $u -TimeoutSec 20 -ErrorAction Stop
        Write-OK "  $u → HTTP $($r.StatusCode)"
    } catch {
        $code = "ERR"
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Host "  [WARN] $u → $code" -ForegroundColor Yellow
        $ok = $false
    }
}
if ($ok) {
    Write-Host "`n✅ Token 替换完成,公网全部正常!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ 部分公网入口异常,检查 cloudflared 日志或等 30 秒重试" -ForegroundColor Yellow
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
