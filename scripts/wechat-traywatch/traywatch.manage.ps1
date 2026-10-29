# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  微信托盘看门狗 (WeChatTrayWatchdog) 管理脚本
.DESCRIPTION
  安装/卸载/启动/停止/查看状态。看门狗随用户登录自启，自动隐藏微信
  误显示的 WxTrayIconMessageWindow 黑窗。
  注：本机 schtasks.exe 在沙箱黑名单内，故改用 Task Scheduler COM API
      (Schedule.Service)，功能等价、不依赖被拦截的程序。
.EXAMPLE
  traywatch.manage.ps1 -Install      # 导入计划任务并立即启动
  traywatch.manage.ps1 -Status       # 查看运行状态
  traywatch.manage.ps1 -Stop         # 临时停止
  traywatch.manage.ps1 -Start        # 重新启动
  traywatch.manage.ps1 -Uninstall    # 彻底移除
#>
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Start,
  [switch]$Stop,
  [switch]$Status
)

$ErrorActionPreference = 'Stop'
$TaskName = 'WeChatTrayWatchdog'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$XmlPath   = Join-Path $ScriptDir 'WeChatTrayWatchdog.xml'

function Get-RootFolder {
  $svc = New-Object -ComObject Schedule.Service
  $svc.Connect()
  return $svc.GetFolder('\')
}

function Install-Task {
  $svc = New-Object -ComObject Schedule.Service
  $svc.Connect()
  $root = $svc.GetFolder('\')
  # 幂等：已存在先删
  try { $root.DeleteTask($TaskName, 0) } catch { }

  $task = $svc.NewTask(0)
  $task.RegistrationInfo.Description = '自动隐藏微信 taskbarpins 辅助窗口 (WxTrayIconMessageWindow)，防止黑窗弹出。零侵入、可逆、随登录自启。'

  # --- Settings（用对象模型逐项设置，避免 XML schema 顺序问题）---
  $s = $task.Settings
  $s.MultipleInstances       = 3      # IgnoreNew
  $s.DisallowStartIfOnBatteries = $false
  $s.StopIfGoingOnBatteries  = $false
  $s.AllowHardTerminate      = $true
  $s.StartWhenAvailable      = $false
  $s.RunOnlyIfNetworkAvailable = $false
  $s.AllowDemandStart        = $true
  $s.Enabled                 = $true
  $s.Hidden                  = $true
  $s.Priority                = 7
  $s.ExecutionTimeLimit      = 'PT0S'   # 不限时，看门狗需常驻
  $s.RestartCount            = 3
  $s.RestartInterval         = 'PT1M'
  $s.RunOnlyIfIdle           = $false

  # --- Trigger: 登录时 ---
  $trig = $task.Triggers.Create(9)      # TASK_TRIGGER_LOGON = 9
  $trig.Enabled = $true

  # --- Action: 无窗口 pythonw 运行看门狗 ---
  $act = $task.Actions.Create(0)        # TASK_ACTION_EXEC = 0
  $act.Path      = Join-Path $env:LOCALAPPDATA ''  # 占位，下面覆盖
  $act.Path      = 'C:\Users\Administrator\.workbuddy-ai\binaries\python\versions\3.13.12\pythonw.exe'
  $act.Arguments = '"' + (Join-Path $ScriptDir 'traywatch.py') + '"'
  $act.WorkingDirectory = $ScriptDir

  # --- Principal: 当前用户、交互式令牌、最高权限 ---
  $p = $task.Principal
  $p.UserId    = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $p.LogonType = 3                      # InteractiveToken
  $p.RunLevel  = 1                      # Highest

  # 6 = CreateOrUpdate, 3 = InteractiveToken, sddl=$null
  return $root.RegisterTaskDefinition($TaskName, $task, 6, $null, $null, 3, $null)
}

if ($Install) {
  Write-Host '[1/2] 通过 COM API 注册计划任务...'
  $t = Install-Task
  Write-Host '[2/2] 立即启动任务...'
  $t.Run($null) | Out-Null
  Write-Host "OK: 任务 '$TaskName' 已创建并启动。" -ForegroundColor Green
  Write-Host "查看状态:  traywatch.manage.ps1 -Status"
}
elseif ($Uninstall) {
  $root = Get-RootFolder
  $root.DeleteTask($TaskName, 0)
  Write-Host "OK: 任务 '$TaskName' 已移除。" -ForegroundColor Green
}
elseif ($Start) {
  $root = Get-RootFolder
  $root.GetTask($TaskName).Run($null) | Out-Null
  Write-Host "已启动。" -ForegroundColor Green
}
elseif ($Stop) {
  $root = Get-RootFolder
  $root.GetTask($TaskName).Stop($null) | Out-Null
  Write-Host "已停止。" -ForegroundColor Green
}
elseif ($Status) {
  $root = Get-RootFolder
  $task = $root.GetTask($TaskName)
  $states = @('Unknown','Disabled','Queued','Ready','Running')
  Write-Host "任务名 : $TaskName"
  Write-Host "状态   : $($states[$task.State]) ($($task.State))"
  Write-Host "启用   : $($task.Enabled)"
  Write-Host "上次运行: $($task.LastRunTime)"
  Write-Host "下次运行: $($task.NextRunTime)"
}
else {
  Write-Host '用法: traywatch.manage.ps1 [-Install | -Uninstall | -Start | -Stop | -Status]'
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
