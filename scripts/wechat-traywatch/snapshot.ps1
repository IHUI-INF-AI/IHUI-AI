# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  系统状态快照（用于回滚参考与报告）
.DESCRIPTION
  捕获与微信黑窗相关的环境状态，输出到 snapshot-before.txt。
#>
$Out = Join-Path $PSScriptRoot 'snapshot-before.txt'
$lines = @()
$lines += "===== 微信黑窗排障 - 系统状态快照 ====="
$lines += ("生成时间: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$lines += ""

$lines += "--- 操作系统 ---"
$os = Get-CimInstance Win32_OperatingSystem
$lines += ($os.Caption + " build " + $os.BuildNumber)

$lines += ""
$lines += "--- 显示适配器（虚拟显示器 / 物理屏）---"
Get-CimInstance Win32_VideoController | ForEach-Object {
  $lines += ("  " + $_.Name + "  " + $_.CurrentHorizontalResolution + "x" + $_.CurrentVerticalResolution)
}

$lines += ""
$lines += "--- 相关进程 ---"
@('Weixin','TranslucentTB','GameViewer','GameViewerServer','GameViewerHealthd') | ForEach-Object {
  $ps = Get-Process -Name $_ -ErrorAction SilentlyContinue
  if ($ps) { $ps | ForEach-Object { $lines += ("  " + $_.ProcessName + " PID=" + $_.Id + " Start=" + $_.StartTime) } }
  else { $lines += ("  " + $_ + " : 无") }
}

$lines += ""
$lines += "--- GameViewerService 服务状态 ---"
$svc = Get-Service -Name 'GameViewerService' -ErrorAction SilentlyContinue
if ($svc) { $lines += ("  Status=" + $svc.Status + " StartType=" + $svc.StartType) } else { $lines += "  未安装" }

$lines += ""
$lines += "--- 目标窗口 Qt51514WxTrayIconMessageWindowClass 可见性 ---"
$py = 'C:\Users\Administrator\.workbuddy-ai\binaries\python\versions\3.13.12\python.exe'
$inline = @'
import ctypes, ctypes.wintypes as wt
u=ctypes.windll.user32
E=ctypes.WINFUNCTYPE(ctypes.c_bool,wt.HWND,wt.LPARAM)
def cls(h):
    b=ctypes.create_unicode_buffer(300); u.GetClassNameW(h,b,300); return b.value
def vis(h): return bool(u.IsWindowVisible(h))
found=[]
def cb(h,l):
    if cls(h)=="Qt51514WxTrayIconMessageWindowClass":
        found.append((h,vis(h)))
    return True
u.EnumWindows(E(cb),0)
if not found:
    print("  (无该窗口)")
else:
    for h,v in found:
        print("  hwnd=%d visible=%s"%(h,v))
'@
try {
  $result = & $py -c $inline 2>&1
  $lines += $result
} catch {
  $lines += ("  枚举失败: " + $_)
}

$lines += ""
$lines += "--- 看门狗计划任务状态 ---"
try {
  $svc = New-Object -ComObject Schedule.Service
  $svc.Connect()
  $root = $svc.GetFolder('\')
  $task = $root.GetTask('WeChatTrayWatchdog')
  $states = @('Unknown','Disabled','Queued','Ready','Running')
  $lines += ("  Task=WeChatTrayWatchdog State=" + $states[$task.State] + " Enabled=" + $task.Enabled + " LastRun=" + $task.LastRunTime)
} catch {
  $lines += "  未安装看门狗任务"
}

$lines | Out-File -FilePath $Out -Encoding utf8
Write-Host "快照已写入: $Out"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
