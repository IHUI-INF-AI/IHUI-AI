# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
  注册"回收站垃圾类清理"计划任务。
  背景:两块卷都写了 NukeOnDelete=1(实测请求可撤销删除被 shell 直接拒绝),但 AI 编程
  工具的"安全删除"自己请求把文件送进回收站,那条路径不受该开关约束 => 回收站只涨不消。
  这里不改那个开关(它管的是默认删除路径),而是挂一个按类别自清的常驻腿。
  约定同 §26/§5b:S4U 非交互(不在桌面开会话)、幂等、Check 只读。
#>
[CmdletBinding()]
param(
    [ValidateSet('Check', 'Apply', 'Remove', 'Test')]
    [string] $Mode = 'Check',
    [int] $IntervalMinutes = 60
)

$ErrorActionPreference = 'Stop'
$TaskName = 'IHUI Recycle Junk Purge'
$ScriptPath = Join-Path $PSScriptRoot 'recycle-junk-purge.mjs'
$RepoRoot = Split-Path $PSScriptRoot -Parent

function Get-TaskReport {
    # 结论必须走返回值,不能靠 Write-Output:被赋值捕获时打印会整体消失,
    # 于是"任务不存在"也能一路走到 exit 0(撒谎的绿)。
    $lines = [System.Collections.Generic.List[string]]::new()
    $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $t) {
        $lines.Add('ABSENT  ' + $TaskName)
        return [pscustomobject]@{ present = $false; lines = $lines }
    }
    $info = $t | Get-ScheduledTaskInfo
    $act = @($t.Actions)[0]
    $rep = @($t.Triggers)[0].Repetition
    $lines.Add('PRESENT ' + $TaskName + '  state=' + $t.State)
    $lines.Add('   execute  = ' + $act.Execute)
    $lines.Add('   args     = ' + $act.Arguments)
    $lines.Add('   workdir  = ' + $act.WorkingDirectory)
    $lines.Add('   user     = ' + $t.Principal.UserId + '  logon=' + $t.Principal.LogonType + '  runlevel=' + $t.Principal.RunLevel)
    $lines.Add('   interval = ' + $(if ($rep) { $rep.Interval } else { '<none>' }))
    $lines.Add('   lastRun  = ' + $info.LastRunTime + '  lastResult=' + $info.LastTaskResult + '  nextRun=' + $info.NextRunTime)
    return [pscustomobject]@{ present = $true; lines = $lines }
}

switch ($Mode) {
    'Check' {
        if (-not (Test-Path -LiteralPath $ScriptPath)) {
            Write-Output ('MISSING TARGET SCRIPT: ' + $ScriptPath)
            exit 1
        }
        $r = Get-TaskReport
        foreach ($l in $r.lines) { Write-Output $l }
        if (-not $r.present) { exit 1 }
        exit 0
    }
    'Remove' {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Output ('removed (or was absent): ' + $TaskName)
        exit 0
    }
    'Test' {
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 25
        $r = Get-TaskReport
        foreach ($l in $r.lines) { Write-Output $l }
        exit 0
    }
    'Apply' {
        if (-not (Test-Path -LiteralPath $ScriptPath)) { throw 'target script missing: ' + $ScriptPath }
        $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCmd) { throw 'node.exe not on PATH at install time; run this after the toolchain is ready' }
        $node = $nodeCmd.Source
        Write-Output ('resolved node = ' + $node)

        # 先跑一次自检,不绿就不注册(装一个会静默失败的任务比没有任务更糟)
        & $node $ScriptPath --self-test
        if ($LASTEXITCODE -ne 0) { throw ('self-test failed with exit ' + $LASTEXITCODE) }
        Write-Output 'self-test PASS'

        # 参数名按本机现读:这版 ScheduleTaskServer 模块是 -Argument(单数),不是 -Arguments
        $action = New-ScheduledTaskAction -Execute $node `
            -Argument ('"' + $ScriptPath + '" --apply') `
            -WorkingDirectory $RepoRoot
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
            -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
        $userId = ($env:USERDOMAIN + '\' + $env:USERNAME)
        $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType S4U -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable -Hidden -MultipleInstances IgnoreNew `
            -ExecutionTimeLimit (New-TimeSpan -Hours 2)

        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
            -Principal $principal -Settings $settings -Force | Out-Null
        Write-Output ('registered: ' + $TaskName + ' every ' + $IntervalMinutes + ' min, user=' + $userId + ' logon=S4U')
        $r = Get-TaskReport
        foreach ($l in $r.lines) { Write-Output $l }
        exit 0
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
