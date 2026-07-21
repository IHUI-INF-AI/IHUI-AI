# 启动 Cloudflare Tunnel,把本地 localhost:3000 暴露到
#   https://aizhs.top         (主域,完整应用)
#   https://bsm.aizhs.top     (认证子域,只承载登录/OAuth 回调)
# 架构:分域 SSO (2026-07-21 立)
#   - aizhs.top       → 主站访问入口(浏览器直访)
#   - bsm.aizhs.top   → 登录/扫码/第三方 OAuth 回调专用子域
#   - 中间件在 bsm.aizhs.top 上做白名单,只放行 /sso/* /auth/* /callback 等 auth 路由,
#     其余路径 307 跳回 aizhs.top 同路径,子域不承载主功能
#   - Cookie 写在 .aizhs.top 域,主域与子域共享登录态
# 用法:在 TRAE 终端或 PowerShell 中运行此脚本
# 前提:本地 dev server (localhost:3000) 已启动
# 前提:Cloudflare 隧道 ingress 已配置两条规则:
#   aizhs.top       → http://localhost:3000
#   bsm.aizhs.top   → http://localhost:3000
#   (在 Cloudflare Zero Trust → Networks → Tunnels → ihui-local → Configure → Public hostname 添加)

$env:Path += ";C:\Program Files (x86)\cloudflared"

$tunnelToken = "eyJhIjoiNDhkY2Q1MDcyNGI1ZmVkMjFlOGRkNmNjZGM2M2FiMDEiLCJ0IjoiZTY3NTkyOWEtZjZmMC00ODkzLTkyN2UtNGM4MjNmOTcyNGUwIiwicyI6Ik1ESmtZMlV6WkRNdE1ERTNaQzAwTldOaUxUazNaall0WVRKa09XTTFOVGs1TUdSaCJ9"

Write-Host "启动 Cloudflare Tunnel (aizhs.top + bsm.aizhs.top -> localhost:3000)..."
Write-Host "分域 SSO 架构:主域 aizhs.top + 认证子域 bsm.aizhs.top(只承载登录)"
Write-Host "按 Ctrl+C 停止"
Write-Host ""

cloudflared tunnel --no-autoupdate run --token $tunnelToken
