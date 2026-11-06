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

# 判据修正(2026-11-07):「:80 有人听」≠「kCDN 活着」。IIS / 其它进程占住 80 时
# 旧写法直接 exit 0,看门狗永远不再拉起,CDN 实际已死却账面健康;拉起后也只取
# 端口上的任意 pid 记成"拉起成功",会把别人的 pid 写进台账。现在按进程身份判:
#   监听者命令行含 cdn-server.js ⇒ 本进程,幂等退出
#   监听者是别人 ⇒ 拒绝拉起(硬起也会 listen 失败),exit 3 让计划任务/监控看得见
#   无监听 ⇒ 拉起 node 本进程,3 秒后要求「启动 pid == 端口归属 pid 且是本进程」
function Get-PortOwnerPid([int]$port) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $c) { return $null }
  return [int]$c.OwningProcess
}

function Get-ProcessInfo([int]$procId) {
  if (-not $procId) { return $null }
  try { return Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction Stop } catch { return $null }
}

function Test-CdnProcess([int]$procId) {
  $p = Get-ProcessInfo $procId
  if (-not $p -or -not $p.CommandLine) { return $false }
  return ($p.CommandLine -match 'cdn-server\.js')
}

$listenPort = 80
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
$owner = Get-PortOwnerPid $listenPort
if ($owner) {
  if (Test-CdnProcess $owner) {
    Add-Content -Path $log -Value "[$stamp] :$listenPort 由 kCDN 本进程持守 pid=$owner,幂等退出"
    exit 0
  }
  $label = (Get-ProcessInfo $owner).Name
  Add-Content -Path $log -Value "[$stamp] :$listenPort 被非 kCDN 进程占用 pid=$owner name=$label ⇒ 拒绝拉起(listen 必失败),需人工释放端口"
  exit 3
}

Add-Content -Path $log -Value "[$stamp] :$listenPort 无监听 ⇒ 拉起 cdn-server"
$outLog = 'D:\DevEnv\logs\svc-imagecdn.log'
$errLog = 'D:\DevEnv\logs\svc-imagecdn.err.log'
$spawned = Start-Process -FilePath $node -ArgumentList @(
  'cdn-server.js', '--root', 'server-root', '--http-port', "$listenPort"
) -WorkingDirectory $deployDir -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Start-Sleep -Seconds 3
$owner2 = Get-PortOwnerPid $listenPort
if ($spawned -and $owner2 -and $owner2 -eq $spawned.Id -and (Test-CdnProcess $owner2)) {
  Add-Content -Path $log -Value "[$stamp] 拉起成功 pid=$owner2(端口归属与启动 pid 一致)"
} else {
  $spawnedPid = if ($spawned) { $spawned.Id } else { 'none' }
  $who = if ($owner2) { "$owner2/$((Get-ProcessInfo $owner2).Name)" } else { 'none' }
  Add-Content -Path $log -Value "[$stamp] 拉起失败: spawnedPid=$spawnedPid portOwner=$who 不一致或无监听; 查 $errLog"
  exit 2
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
