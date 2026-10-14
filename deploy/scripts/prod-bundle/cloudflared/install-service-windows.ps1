# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# Cloudflared Windows 系统服务安装(开机自启,备选方案)
# =============================================================================
# 适用场景:不用 Docker 容器跑 cloudflared,而是用 Windows 服务跑
# 优点:开机自启,不依赖 Docker Desktop
# 缺点:需要本机安装 cloudflared.exe
#
# 用法(管理员 PowerShell):
#   powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\cloudflared\install-service-windows.ps1
# =============================================================================

param(
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "需要管理员权限。请用管理员 PowerShell 运行此脚本。"
    exit 1
}

# 从 .env.production 读取 TUNNEL_TOKEN
if (-not $Token) {
    $envFile = "$(Split-Path -Parent $(Split-Path -Parent $(Split-Path -Parent $MyInvocation.MyCommand.Path)))\.env.production"
    if (Test-Path $envFile) {
        foreach ($line in (Get-Content $envFile -Encoding UTF8)) {
            if ($line -match "^TUNNEL_TOKEN=(.+)$") {
                $Token = $matches[1]
                break
            }
        }
    }
}

if (-not $Token) {
    Write-Error "未提供 Token 且 .env.production 中未找到 TUNNEL_TOKEN"
    exit 1
}

Write-Host "[INFO] Token 已加载(长度: $($Token.Length))"

# 检查 cloudflared 是否安装
$cloudflaredPath = $null
foreach ($path in @("C:\Program Files (x86)\cloudflared\cloudflared.exe", "C:\Program Files\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\cloudflared\cloudflared.exe")) {
    if (Test-Path $path) {
        $cloudflaredPath = $path
        break
    }
}

if (-not $cloudflaredPath) {
    Write-Host "[INFO] cloudflared 未安装,尝试用 winget 安装..."
    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Error "winget 安装失败,请手动安装:https://github.com/cloudflare/cloudflared/releases/latest"
        exit 1
    }
    # 重新查找
    foreach ($path in @("C:\Program Files (x86)\cloudflared\cloudflared.exe", "C:\Program Files\cloudflared\cloudflared.exe")) {
        if (Test-Path $path) {
            $cloudflaredPath = $path
            break
        }
    }
    if (-not $cloudflaredPath) {
        Write-Error "安装后仍找不到 cloudflared.exe"
        exit 1
    }
}

Write-Host "[INFO] cloudflared: $cloudflaredPath"

# 用 cloudflared 自带的 service install 命令
# --protocol http2(2026-10-14 立):cloudflared 默认 QUIC,国内跨境 UDP QoS 差,
# 真机实测 TTFB 1.5-4.4s、TLS 握手 0.8s;仓内 2026-08-05 读数 http2 比 quic
# 快约 2 倍(health-check-bare.ps1:156),该健康检查第 10 项长期 WARN 的根因就是
# 安装端从未写协议参数。写在这里 ⇒ 服务注册表 binPath 自带协议,
# health-check-bare.ps1:158 的 PathName 匹配直接转 PASS。
& $cloudflaredPath service install $Token --protocol http2
if ($LASTEXITCODE -ne 0) {
    Write-Error "cloudflared service install 失败"
    exit 1
}

# 启动服务
Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
$svc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "[OK] Cloudflared 服务已安装并启动(开机自启)" -ForegroundColor Green
    Write-Host ""
    Write-Host "管理命令:"
    Write-Host "  查看状态:  Get-Service Cloudflared"
    Write-Host "  停止:      Stop-Service Cloudflared"
    Write-Host "  启动:      Start-Service Cloudflared"
    Write-Host "  重启:      Restart-Service Cloudflared"
    Write-Host "  卸载:      & '$cloudflaredPath' service uninstall"
    Write-Host ""
    Write-Host "查看日志: 事件查看器 → Windows 日志 → 应用程序 → 来源: Cloudflared"
} else {
    Write-Error "服务已安装但启动失败"
    Write-Host "查看事件查看器日志定位问题"
    exit 1
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
