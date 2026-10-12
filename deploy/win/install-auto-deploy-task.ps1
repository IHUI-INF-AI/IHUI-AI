# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# deploy\win\install-auto-deploy-task.ps1 — 注册/更新 push→自动部署轮询计划任务(每 6 分钟)
# 用 pwsh -File 执行,参数在脚本内构造,规避外层 shell 引号污染。
#
# ⚠ 本机(WIN-20251101PXT)无法使用 Task Scheduler(2026-09-13 实测):
#   1) schtasks.exe 被安全策略列入程序黑名单,不可绕过;
#   2) ScheduledTasks 模块随 C:\Windows\System32\WindowsPowerShell\v1.0\Modules 一并消失
#      (该目录已被 PS7 Core 文件覆盖,WinSxS 亦无副本),Get-/Register-ScheduledTask 均不可用;
#   3) Schedule 服务受保护,Stop/Restart 均 Access Denied,任务定义无法热重载。
#   → 本机请改用 install-deploy-loop-service.ps1(nssm 服务 IHUI-DEPLOYLOOP)。
#   本脚本保留给"Task Scheduler 可用"的机器。
#
# 2026-09-13 修正:旧版 /tr 构造把"整条命令行+引号"整体塞进 <Command>,生成的任务指向
#   一个并不存在的"可执行文件",自 2026-09-07 注册起从未成功运行过一次
#   (这正是"部署循环没在跑"的直接根因)。schtasks 以"第一个被引号包裹的 token"为
#   可执行文件、其余为参数 → exe 路径与脚本路径必须各自带引号。
# =============================================================================
$ErrorActionPreference = 'Stop'

# 仓库根不写死盘符(旧版硬编码到生产机盘符):同一份仓在开发机/生产机落在不同路径,
# 写死后会把错根烤进计划任务的注册数据 —— 改了脚本也不生效,
# 因为生效的那一份在任务计划程序里,不在仓库里。根一律从本文件位置推导。
. (Join-Path $PSScriptRoot 'ihui-root-common.ps1')
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot

$task = 'IHUI-AutoDeploy'
$cmd  = "$env:windir\System32\schtasks.exe"
$pwshPath = 'C:\Program Files\PowerShell\7\pwsh.exe'
$loopPath = Join-Path $Root 'deploy\win\ihui-deploy-loop.ps1'

# 运行时断言:$loopPath 会被 schtasks 烤进任务注册数据,写错要到下次触发时才暴露,
# 报错时机离故障时机太远(任务静默不跑) → 宁可在安装时就响。
if (-not (Test-Path -LiteralPath $loopPath)) {
    throw "缺失依赖: $loopPath(由仓库根 $Root 派生,ihui-deploy-loop.ps1 不存在)"
}

# 先删除同名任务(若存在),再创建
& $cmd /delete /tn $task /f 2>$null | Out-Null

# /tr 值:exe 路径与脚本路径**各自**用双引号包裹。schtasks 会把第一个被引号包裹的
# token 作为 <Command>,其余作为 <Arguments>。不要把"整条命令"再整体包一层引号
# (旧版就是这么写的 → <Command> 变成一整串,任务永不可执行)。
$runCmd = '"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}"' -f $pwshPath, $loopPath
$argList = @('/create','/tn',$task,'/tr',$runCmd,'/sc','MINUTE','/mo','6','/ru','SYSTEM','/rl','HIGHEST','/f')

$output = & $cmd @argList 2>&1 | Out-String
Write-Host $output
if ($LASTEXITCODE -ne 0) { throw "schtasks 注册失败(exit $LASTEXITCODE)" }

Write-Host '--- 验证 ---'
$info = & $cmd /query /tn $task /fo LIST /v 2>&1 | Select-String -Pattern 'TaskName|Task To Run|Repeat: Every|Status|Next Run'
$info | ForEach-Object { Write-Host $_.Line }
Write-Host 'AUTO_DEPLOY_TASK_OK'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
