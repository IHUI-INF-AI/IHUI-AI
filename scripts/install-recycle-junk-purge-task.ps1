# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
  注册"回收站垃圾类清理"计划任务。
  背景(2026-10-21 按实测更正):卷上 NukeOnDelete 在位时删除确实不落回收站 —— 原句
  "AI 编程工具的安全删除那条路径不受该开关约束"已被 recycle-bin-policy --verify 两臂推翻。
  但这道闸当时全仓零处维护,一旦被重置灌入立刻恢复,而唯一的发现方式是有人肉眼打开回收站。
  这里不改那个开关(它的存续巡检已由 recycle-junk-purge.mjs 的 policyLeg 每轮承担),
  本任务保留为"条目落地后按类别清掉"的兜底腿。
  约定同 §26/§5b:S4U 非交互(不在桌面开会话)、幂等、Check 只读。

  回落腿的波及面(2026-10-29 现读):本机 C:\Windows\System32\WindowsPowerShell\v1.0\Modules
  整个不存在(pwsh7 被覆盖装进 v1.0,powershell.exe 现读 7.6.2),于是 *-ScheduledTask* 与
  Get-Volume 一类 CIM cmdlet 机上全局不可用 —— 依赖它们的仓内脚本共 13 枚(本文件、
  install-{g-root-guardian,zombie-guardian,zombie-guardian-daemon}、setup-token-refresh-task、
  clean-build-garbage、{g-root-guardian,zombie-guardian}-status、uninstall-{g-root-guardian,zombie-guardian}、
  deploy/win/{ihui-deploy-loop,install-auto-deploy-task,install-deploy-loop-service})。
  它们此前注册的任务照跑(Task Scheduler 服务不需要 cmdlet),但"重新注册/查询"这一步在本机一律当场报错。
  照本文件这套分工改:写动作走 schtasks /Create /XML(XML 必须 UTF-16LE 带 BOM 且声明 encoding="UTF-16",
  声明 UTF-8 会报「(1,40) 无法切换编码」),读动作走 Schedule.Service COM。
  不要再试 COM 注册:RegisterTaskDefinition 第二参是 VARIANT,PowerShell 绑字符串直接拒转(实测)。
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

# 回落腿(2026-10-29 实测立):本机 C:\Windows\System32\WindowsPowerShell\v1.0\Modules
# 整个不存在(pwsh7 被覆盖装进 v1.0,现读 powershell.exe 版本 7.6.2),于是
# Get-/Register-ScheduledTask 一类 CIM cmdlet 全局不可用 —— 只认 cmdlet 的装载器在这台机
# 上结构上装不上任何任务,而失效表现是"命令不存在"的当场报错,不是静默。
# Task Scheduler 的 COM 接口(Schedule.Service)不依赖那批模块,读/注册/删除/触发四条动作都有等价物。
$StateNames = @{ 1 = 'Disabled'; 2 = 'Queued'; 3 = 'Ready'; 4 = 'Running'; 5 = 'NotScheduled'; 6 = 'NeverRun' }

function Test-SchedCmdlet { [bool](Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) }

function Get-SchedFolder {
    $ts = New-Object -ComObject Schedule.Service
    $ts.Connect()
    return $ts.GetFolder('\')
}

function New-IhuiTaskXml {
    param(
        [Parameter(Mandatory)][string]$NodeExe,
        [Parameter(Mandatory)][string]$Target,
        [Parameter(Mandatory)][string]$WorkDir,
        [Parameter(Mandatory)][string]$UserSid,
        [Parameter(Mandatory)][int]$IntervalMinutes
    )
    $esc = { param($s) [System.Security.SecurityElement]::Escape($s) }
    $start = (Get-Date).AddMinutes(1).ToString('yyyy-MM-ddTHH:mm:ss')
    $regDate = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    $xml = @'
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>{regDate}</Date>
    <Author>IHUI-AI</Author>
    <URI>\{taskName}</URI>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition>
        <Interval>PT{interval}M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>{start}</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>{sid}</UserId>
      <LogonType>S4U</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{node}</Command>
      <Arguments>"{target}" --apply</Arguments>
      <WorkingDirectory>{workdir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
'@
    $out = $xml.Replace('{regDate}', $regDate)
    $out = $out.Replace('{taskName}', (& $esc $TaskName))
    $out = $out.Replace('{interval}', $IntervalMinutes)
    $out = $out.Replace('{start}', $start)
    $out = $out.Replace('{sid}', (& $esc $UserSid))
    $out = $out.Replace('{node}', (& $esc $NodeExe))
    $out = $out.Replace('{target}', (& $esc $Target))
    $out = $out.Replace('{workdir}', (& $esc $WorkDir))
    return $out
}

function Get-TaskReport {
    # 结论必须走返回值,不能靠 Write-Output:被赋值捕获时打印会整体消失,
    # 于是"任务不存在"也能一路走到 exit 0(撒谎的绿)。
    $lines = [System.Collections.Generic.List[string]]::new()
    if (Test-SchedCmdlet) {
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

    $lines.Add('   (读法=ScheduledTasks cmdlet 不可用,走 Task Scheduler COM)')
    try {
        $folder = Get-SchedFolder
        $t = $folder.GetTask($TaskName)
    }
    catch {
        $lines.Add('ABSENT  ' + $TaskName)
        return [pscustomobject]@{ present = $false; lines = $lines }
    }
    $doc = [xml]$t.Definition.XmlText
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace('t', 'http://schemas.microsoft.com/windows/2004/02/mit/task')
    $exec = $doc.SelectSingleNode('/t:Task/t:Actions/t:Exec', $ns)
    $prin = $doc.SelectSingleNode('/t:Task/t:Principals/t:Principal', $ns)
    $rep = $doc.SelectSingleNode('/t:Task/t:Triggers/t:TimeTrigger/t:Repetition/t:Interval', $ns)
    $st = if ($StateNames.ContainsKey([int]$t.State)) { $StateNames[[int]$t.State] } else { $t.State }
    $lines.Add('PRESENT ' + $TaskName + '  state=' + $st)
    $lines.Add('   execute  = ' + $exec.Command)
    $lines.Add('   args     = ' + $exec.Arguments)
    $lines.Add('   workdir  = ' + $exec.WorkingDirectory)
    $lines.Add('   user     = ' + $prin.UserId + '  logon=' + $prin.LogonType + '  runlevel=' + $prin.RunLevel)
    $lines.Add('   interval = ' + $(if ($rep) { $rep.InnerText } else { '<none>' }))
    $lines.Add('   lastRun  = ' + $t.LastRunTime + '  lastResult=' + $t.LastTaskResult + '  nextRun=' + $t.NextRunTime)
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
        if (Test-SchedCmdlet) {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        }
        else {
            $null = & schtasks.exe /Delete /TN $TaskName /F
            if ($LASTEXITCODE -ne 0) {
                Write-Output ('   schtasks /Delete 退出码 ' + $LASTEXITCODE + '(任务可能本来就不在,以下面复验为准)')
            }
        }
        $r = Get-TaskReport
        if ($r.present) {
            Write-Output ('STILL PRESENT 删除后回读仍在: ' + $TaskName)
            exit 1
        }
        Write-Output ('removed (or was absent): ' + $TaskName)
        exit 0
    }
    'Test' {
        if (Test-SchedCmdlet) {
            Start-ScheduledTask -TaskName $TaskName
        }
        else {
            $null = & schtasks.exe /Run /TN $TaskName
            if ($LASTEXITCODE -ne 0) { throw ('schtasks /Run 退出码 ' + $LASTEXITCODE) }
        }
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

        if (Test-SchedCmdlet) {
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
        }
        else {
            $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            if (-not $sid) { throw 'UNDETERMINED: 取不到当前进程 SID,拒绝在归属未知的账户下注册' }
            $taskXml = New-IhuiTaskXml -NodeExe $node -Target $ScriptPath -WorkDir $RepoRoot -UserSid $sid -IntervalMinutes $IntervalMinutes
            $tmpDir = Join-Path $RepoRoot '.ihui-agent\tmp\recycle-junk-purge-task'
            $null = New-Item -ItemType Directory -Force -Path $tmpDir
            $xmlPath = Join-Path $tmpDir 'task.xml'
            # 必须是 UTF-16LE 带 BOM:schtasks 按本地码页读文件,声明 UTF-8 会报
            # 「解析 XML 格式错误 (1,40) 无法切换编码」(2026-10-29 实测);声明与实际不一致同样拒收
            [System.IO.File]::WriteAllText($xmlPath, $taskXml, [System.Text.Encoding]::Unicode)
            $null = & schtasks.exe /Create /TN $TaskName /XML $xmlPath /F
            $rc = $LASTEXITCODE
            $null = Remove-Item -LiteralPath $xmlPath -Force -ErrorAction SilentlyContinue
            if ($rc -ne 0) { throw ('schtasks /Create 退出码 ' + $rc + ' —— 未注册成功,下面不复读') }
            Write-Output ('registered(schtasks /XML): ' + $TaskName + ' every ' + $IntervalMinutes + ' min, sid=' + $sid + ' logon=S4U runlevel=Highest')
        }

        $r = Get-TaskReport
        foreach ($l in $r.lines) { Write-Output $l }
        # "注册调用没报错"不等于任务在位 —— 回读读不出来就当场失败,不留假绿
        if (-not $r.present) { throw ('REGISTERED-BUT-ABSENT 注册后回读为 ABSENT: ' + $TaskName) }
        exit 0
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
