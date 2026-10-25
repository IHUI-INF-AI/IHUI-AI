# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# :80 图片 CDN 常守活(G-37③ 载体,2026-10-25 立)。
# 为什么是看门狗任务而不是服务:本机 nssm 缺失(全盘实测),而 cmd.exe 服务载体
# 会被 SCM 30 秒就绪窗超时杀宿主(本机三枚 IHUI* cmd 服务全 Stopped 即同型病,
# 2026-10-25 实测复现一次)。本脚本由计划任务 IHUI-ImageCDN-Watch 派发:
# 触发器 = 开机 + 每 1 分钟重复;幂等 —— :80 已在监听就退出,绝不起第二份
# (cdn-server.js 的 listen 无 error 处理,双起会互杀)。
# 回退:schtasks /change /tn IHUI-ImageCDN-Watch /disable 后按需手跑 run-cdn.bat。
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$deployDir = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
$serverJs = Join-Path $deployDir 'cdn-server.js'
$log = 'D:\DevEnv\logs\cdn-watchdog.log'

# 稳定位优先,避开 .workbuddy 自升级目录(服务/任务身份解析的 PATH 不可靠)。
$node = $null
foreach ($c in @('C:\Program Files\nodejs\node.exe', 'C:\PROGRA~1\nodejs\node.exe',
    (Join-Path $env:SystemDrive 'DevEnv\runtimes\node\node.exe'), 'D:\DevEnv\runtimes\node\node.exe')) {
  if ($c -and (Test-Path $c)) { $node = $c; break }
}
if (-not $node) { throw '找不到稳定位 node.exe' }

$listen = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listen) { exit 0 }

$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
Add-Content -Path $log -Value "[$stamp] :80 无监听 ⇒ 拉起 cdn-server"
Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -WorkingDirectory $deployDir -ArgumentList @(
  '/c', "`"$node`" cdn-server.js --root server-root --http-port 80 >> D:\DevEnv\logs\svc-imagecdn.log 2>&1"
)
Start-Sleep -Seconds 3
$again = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($again) {
  Add-Content -Path $log -Value "[$stamp] 拉起成功 pid=$($again.OwningProcess)"
} else {
  Add-Content -Path $log -Value "[$stamp] 拉起后 3 秒仍无监听,查 D:\DevEnv\logs\svc-imagecdn.log"
  exit 2
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
