# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# ============================================================================
# 注册 worktree 生命周期回收计划任务(IHUI-Worktree-Reap,每 10 分钟)。
#
# 立因: `scripts/reap-worktrees.mjs` 的判据/保护面都在,但**没有任何调度器**,
# 实测登记面里同时挂着 7 个早已并入 main 的检出,最老的悬了数天。
# 这里给回收器一个无人值守的执行体;判据本身仍只在回收器里写一份。
#
# 红线:
#   - 必须 S4U(会话 0 无窗口能力),不得 Interactive;
#   - action 必须经 wscript.exe + ASCII-only VBS 包装(桌面零弹窗铁律);
#   - 不得直跑 node.exe(ensure-silent-tasks 会把它判违规并改写)。
#
# 用法:
#   pwsh -ExecutionPolicy Bypass -File <repo-root>\scripts\install-worktree-reap-task.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

$TaskName = 'IHUI-Worktree-Reap'
$ScriptsDir = $PSScriptRoot
if (-not $ScriptsDir) { $ScriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptsDir
$VbsLauncher = Join-Path $ScriptsDir 'worktree-reap-hidden.vbs'
$Reaper = Join-Path $ScriptsDir 'reap-worktrees.mjs'

Write-Host "[install-worktree-reap] TaskName: $TaskName" -ForegroundColor Cyan

if (-not (Test-Path $Reaper)) {
    Write-Error "[install-worktree-reap] 回收器不存在: $Reaper"
    exit 1
}
if (-not (Test-Path $VbsLauncher)) {
    Write-Error "[install-worktree-reap] VBS 启动器不存在: $VbsLauncher"
    exit 1
}

# 幂等重建:本任务只有一个合法写入者,直接覆盖旧注册。
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $VbsLauncher + '"')

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(2) `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$startup = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

$description = 'IHUI-AI worktree lifecycle reaper: every 10 min, reap clean worktrees already merged into main (idle >= 6h), back up dirty ones before reaping (idle >= 24h), tag unmerged ones as lost-commit and never delete them. Runtime JSONL: .workbuddy/worktree-reap.log'

Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger @($trigger, $startup) `
    -Action $action `
    -Settings $settings `
    -Principal $principal `
    -Description $description `
    -Force | Out-Null

Write-Host "[install-worktree-reap] 注册完成,立即跑一轮验证..." -ForegroundColor Green
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$info = Get-ScheduledTaskInfo -TaskName $TaskName
$log = Join-Path $ProjectRoot '.workbuddy\worktree-reap.log'
Write-Host "[install-worktree-reap] LastTaskResult=$($info.LastTaskResult) State=$((Get-ScheduledTask -TaskName $TaskName).State)"
if (Test-Path $log) {
    Write-Host "[install-worktree-reap] 台账已落盘: $log"
    Get-Content $log -Tail 1
} else {
    Write-Warning "[install-worktree-reap] 台账尚未生成 —— 检查 .workbuddy/worktree-reap.log 与 node 路径"
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
