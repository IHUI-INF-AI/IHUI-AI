# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# cf-ssh-proxy.ps1 —— ssh ProxyCommand 的 Service Token 加载器(规范形态)
#
# 部署位置: D:/DevEnv/secrets/cf-ssh-proxy.ps1(由 ~/.ssh/config 的 ProxyCommand 调用)
#
# 【为什么这份脚本必须带 BOM】 Windows PowerShell 5.1 读无 BOM 的 .ps1 时按 ANSI 解码,
# 本文件里的中文会被读成乱码并触发「缺少 )」解析错误,整条 ssh 隧道当场断(2026-10-27 实测)。
# 本文件首字节必须是 EF BB BF;`node scripts/tests/doctor-ssh-tunnel.test.mjs` 钉这条不变量。
#
# 【为什么前置件要显式点名】 这份脚本与它的 token 文件在 2026-10-27 01:40 一起被创建,
# 同批把 ~/.ssh/config 的 ProxyCommand 写坏了(反斜杠被 OpenSSH 转义吃掉)。缺件必须
# 自己报名字,而不是让 cloudflared 抛一段看不懂的 TLS/Access 错误。

$ErrorActionPreference = 'Stop'

$tokenFile   = 'D:/DevEnv/secrets/cf-access-ssh-aizhs.token'
$cloudflared = 'C:/Program Files (x86)/cloudflared/cloudflared.exe'

if (-not (Test-Path -LiteralPath $tokenFile)) {
    [Console]::Error.WriteLine("[cf-ssh-proxy] 缺少 Access Service Token 文件: $tokenFile")
    [Console]::Error.WriteLine('[cf-ssh-proxy] 从 Cloudflare Zero Trust 控制台重新签发 token,把 secret 本体写进该文件。')
    exit 78
}
if (-not (Test-Path -LiteralPath $cloudflared)) {
    [Console]::Error.WriteLine("[cf-ssh-proxy] 缺少 cloudflared: $cloudflared")
    [Console]::Error.WriteLine('[cf-ssh-proxy] 装好 cloudflared 后改本脚本的 $cloudflared,或建同路径软链。')
    exit 78
}
if (-not $args -or [string]::IsNullOrWhiteSpace([string]$args[0])) {
    [Console]::Error.WriteLine('[cf-ssh-proxy] 缺少 hostname 参数(ssh 会把 %h 作为唯一参数传进来)。')
    exit 78
}

$env:TUNNEL_SERVICE_TOKEN_SECRET = (Get-Content -Raw -LiteralPath $tokenFile).Trim()
& $cloudflared access ssh --hostname $args[0]
exit $LASTEXITCODE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
