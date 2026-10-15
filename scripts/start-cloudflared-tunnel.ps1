# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# 启动 Cloudflare Tunnel,把本地 localhost:8801 暴露到
#   https://aizhs.top         (主域,完整应用)
#   https://bsm.aizhs.top     (认证子域,只承载登录/OAuth 回调)
# 架构:分域 SSO (2026-07-21 立)
#   - aizhs.top       → 主站访问入口(浏览器直访)
#   - bsm.aizhs.top   → 登录/扫码/第三方 OAuth 回调专用子域
#   - 中间件在 bsm.aizhs.top 上做白名单,只放行 /sso/* /auth/* /callback 等 auth 路由,
#     其余路径 307 跳回 aizhs.top 同路径,子域不承载主功能
#   - Cookie 写在 .aizhs.top 域,主域与子域共享登录态
# 用法:在 IDE 终端或 PowerShell 中运行此脚本
# 前提:本地 dev server (localhost:8801) 已启动
# 前提:Cloudflare 隧道 ingress 已配置两条规则:
#   aizhs.top       → http://localhost:8801
#   bsm.aizhs.top   → http://localhost:8801
#   (在 Cloudflare Zero Trust → Networks → Tunnels → ihui-local → Configure → Public hostname 添加)

$env:Path += ";C:\Program Files (x86)\cloudflared"

# 安全:真实 token 从本地文件读取(不进 git)。部署包解压后此文件位于 deploy/prod-bundle/cloudflared/TUNNEL_TOKEN.local.txt
# 若无该文件则回退占位符,运行前请先在 Cloudflare 后台 rotate 并填入
$tokenFile = Join-Path $PSScriptRoot "..\deploy\prod-bundle\cloudflared\TUNNEL_TOKEN.local.txt"
if (Test-Path $tokenFile) {
    $tunnelToken = (Get-Content $tokenFile -Raw).Trim()
} else {
    $tunnelToken = "<PASTE-YOUR-TUNNEL-TOKEN-HERE>"
    Write-Warning "未找到 TUNNEL_TOKEN.local.txt,请先从部署包拷贝或填写真实 token"
}

Write-Host "启动 Cloudflare Tunnel (aizhs.top + bsm.aizhs.top -> localhost:8801)..."
Write-Host "分域 SSO 架构:主域 aizhs.top + 认证子域 bsm.aizhs.top(只承载登录)"
Write-Host "按 Ctrl+C 停止"
Write-Host ""

# 传输协议固定 http2(2026-10-14 诊断立因):
# cloudflared 默认走 QUIC(UDP 784),而国内运营商对跨境 UDP 的 QoS 远差于 TCP ——
# 真机实测(Redmi 5G → api.aizhs.top):ICMP RTT 353/493/586ms,HTTPS TTFB 1.5-4.4s,
# 其中 TLS 握手单独占 0.8s(RTT 0.5s 的物理下限只够 1 个 RTT),且出现 6.37s 长尾。
# 仓内既有读数(deploy/scripts/prod-bundle/health-check-bare.ps1:156,
# 2026-08-05):http2 比 quic 公网 TTFB 快约 2 倍;该健康检查第 10 项长期因
# "服务未带 --protocol http2" 而 WARN —— 安装端(install-service-windows.ps1)与
# 启动端(本脚本)不写协议参数,cloudflared 就永远用默认 QUIC,守门只能干喊。
# 部署包重装/启动脚本现从源头固化 http2;生产机现存服务的切换命令见
# docs/DEPLOYMENT_RUNBOOK.md「Cloudflared 传输协议」节。
cloudflared tunnel --no-autoupdate run --protocol http2 --token $tunnelToken
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
