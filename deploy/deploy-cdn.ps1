#!/usr/bin/env powershell
<#
.SYNOPSIS
  IHUI-AI 图片 CDN 一键部署脚本(在承载服务的电脑上运行)

.DESCRIPTION
  步骤:
    1. 首次运行:生成自签名证书 + 打包部署文件
    2. 启动 HTTPS CDN 服务(443) + HTTP 跳转(80)
    3. 配合路由器端口映射/内网穿透,将 img.aizhs.top 指向本机

.EXAMPLE
  # 首次部署(生成证书并启动)
  .\deploy-cdn.ps1 -FirstTime

  # 日常启动
  .\deploy-cdn.ps1
#>
param(
  [switch]$FirstTime,
  [int]$HttpsPort = 443,
  [int]$HttpPort = 80,
  [string]$HostName = 'img.aizhs.top'
)

$ErrorActionPreference = 'Stop'
$deployDir = Split-Path $MyInvocation.MyCommand.Path -Parent
Set-Location $deployDir

# 1. 检查 Node.js
try { $nodeVer = node -v } catch {
  Write-Host '[错误] 未安装 Node.js,请到 https://nodejs.org 安装 LTS 版本' -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Node.js $nodeVer"

# 2. 首次运行:生成自签名证书
if ($FirstTime -or !(Test-Path 'cert.pem')) {
  Write-Host '[步骤] 生成自签名证书 (CN=' + $HostName + ')'
  node cdn-server.js --gen-cert --host-name $HostName --cert-out cert.pem --key-out key.pem
}

# 3. 初始化静态目录(如不存在则提示)
if (!(Test-Path 'server-root')) {
  Write-Host '[警告] server-root 目录不存在,将从本仓库复制' -ForegroundColor Yellow
  Write-Host '        请把 IHUI-AI/apps/miniapp-taro/src/assets/remote 整个目录复制为 deploy/server-root'
  exit 1
}

# 4. 开机自启(可选):注册计划任务
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "CDN 配置摘要"
Write-Host "  域名:     https://$HostName (DNS A 记录指向本机公网 IP)"
Write-Host "  HTTPS:    :$HttpsPort"
Write-Host "  HTTP:     :$HttpPort (自动跳转 HTTPS)"
Write-Host "  静态目录: $((Get-Item 'server-root').FullName)"
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# 5. 启动服务(Ctrl+C 停止)
node cdn-server.js --root ./server-root --https-port $HttpsPort --http-port $HttpPort --cert cert.pem --key key.pem --host-name $HostName
