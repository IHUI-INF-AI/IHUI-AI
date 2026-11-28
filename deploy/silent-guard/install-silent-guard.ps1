# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# install-silent-guard.ps1 —— 把仓库里的控制台窗口守卫铺到本机并挂上计划任务
#
# 为什么需要这个脚本: 守卫的规则改在 `%USERPROFILE%\.ihui-silent-guard\windows-console-watcher.py`
# 这份现场文件上, 它不进版本库 ⇒ 换机/重装/换人接手时规则就丢, 弹窗从零复发。
# 仓库内权威副本 = deploy/silent-guard/windows-console-watcher.py, 本脚本负责把它落地并接线。
#
# 用法(默认只体检, 不改任何东西):
#   pwsh -File install-silent-guard.ps1                     # 体检: 源/落点/pythonw/任务/在跑实例
#   pwsh -File install-silent-guard.ps1 -Apply              # 铺文件 + 注册或更新计划任务
#   pwsh -File install-silent-guard.ps1 -Apply -Restart     # 顺手重启守卫(先结束旧实例)
#
# 为什么必须是 pythonw: pythonw.exe 是 GUI 子系统进程, 天生不带控制台窗口;
# 换成 python.exe/pwsh 会随触发方继承可见控制台 —— 正是本守卫要消灭的那一形态。
# 注册任务需要管理员权限(RunLevel Highest + Interactive)。

[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$Restart,
  [string]$TaskName = 'IHUI-Console-Watcher'
)

$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot 'windows-console-watcher.py'
$dstDir = Join-Path $env:USERPROFILE '.ihui-silent-guard'
$dst = Join-Path $dstDir 'windows-console-watcher.py'

Write-Output "源文件  : $src"
if (-not (Test-Path -LiteralPath $src)) { throw "仓库内找不到守卫脚本: $src" }
Write-Output "落点    : $dst"

# pythonw 探测: 先按任务现状的口径找系统 Python(Programs\Python\Python3*\pythonw.exe), 再回退 PATH。
# 注意不能直接取 PATH 第一个 pythonw: 沙箱运行时常在 PATH 前面塞自己的 pythonw, 那个装不了持久任务。
$pythonw = $null
$pyRoot = Join-Path $env:LOCALAPPDATA 'Programs\Python'
if (Test-Path -LiteralPath $pyRoot) {
  $pythonw = Get-ChildItem -LiteralPath $pyRoot -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'pythonw.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}
if (-not $pythonw) {
  $cmd = Get-Command pythonw.exe -ErrorAction SilentlyContinue
  if ($cmd) { $pythonw = $cmd.Source }
}
if (-not $pythonw) { throw '找不到 pythonw.exe: 先装 Python 3, 或把系统 Python 的 pythonw 加进 PATH' }
Write-Output "pythonw : $pythonw"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  $act = $task.Actions | Select-Object -First 1
  Write-Output "计划任务: 已存在 Execute=$($act.Execute)"
  Write-Output "          Args=$($act.Arguments)"
  Write-Output "          LogonType=$($task.Principal.LogonType) RunLevel=$($task.Principal.RunLevel) MultipleInstances=$($task.Settings.MultipleInstances) ExecutionTimeLimit=$($task.Settings.ExecutionTimeLimit)"
  $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  Write-Output "          State=$($task.State) LastResult=$($info.LastTaskResult) LastRun=$($info.LastRunTime)"
} else {
  Write-Output '计划任务: 不存在（-Apply 时会新建, 触发器=登录时）'
}

$running = @(Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'windows-console-watcher\.py' })
if ($running.Count -gt 0) {
  Write-Output ("在跑实例: " + (($running | ForEach-Object { "pid=$($_.ProcessId)" }) -join ', '))
} else {
  Write-Output '在跑实例: 无'
}

if (-not $Apply) {
  Write-Output ''
  Write-Output '[体检模式] 未改动任何东西。落地请加 -Apply; 需要重启守卫再加 -Restart。'
  return
}

# 1) 铺文件(目录不存在则建)
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Copy-Item -LiteralPath $src -Destination $dst -Force
Write-Output "已写入  : $dst"

# 2) 注册或更新计划任务
$action = New-ScheduledTaskAction -Execute $pythonw -Argument ('"' + $dst + '"') -WorkingDirectory $dstDir
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

if ($task) {
  Set-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings | Out-Null
  Write-Output '已更新  : 计划任务的动作/主体/设置(触发器保持原样)'
} else {
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName $TaskName `
    -Action $action `
    -Principal $principal `
    -Settings $settings `
    -Trigger $trigger `
    -Description 'IHUI 控制台窗口守卫: 把只该在后台运行的终端窗口藏起来(pythonw 常驻, 单实例互斥体 Global\IHUI_ConsoleWatcher)' | Out-Null
  Write-Output '已注册  : 计划任务(登录时自启)'
}

# 3) 重启守卫
if ($Restart) {
  foreach ($p in $running) {
    try {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
      Write-Output "已结束  : 旧实例 pid=$($p.ProcessId)"
    } catch {
      Write-Output "结束失败: pid=$($p.ProcessId) — $($_.Exception.Message)"
    }
  }
  Start-Sleep -Milliseconds 800
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 2
  $now = @(Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'windows-console-watcher\.py' })
  if ($now.Count -gt 0) {
    Write-Output ("重启后  : 已就位 " + (($now | ForEach-Object { "pid=$($_.ProcessId)" }) -join ', '))
  } else {
    Write-Output '重启后  : 未起来 —— 直接用 pythonw 前台跑一次看报错, 或查任务历史'
  }
}

Write-Output ''
Write-Output '[完成] 守卫已落地并接线。规则改动请改仓库副本后重跑本脚本, 不要再只改现场文件。'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
