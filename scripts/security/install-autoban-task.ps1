# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#Requires -Version 7.0
<#
.SYNOPSIS
  注册/卸载「入口攻击自动封禁」计划任务(2026-11-24 立)。

.DESCRIPTION
  每 N 分钟以 SYSTEM 身份跑一次 ihui-attack-autoban.mjs --apply:
  读火绒 WAF + 路由日志 -> 打分 -> 对达标 IP 建防火墙 block 规则 -> 到期自动解封。
  只做本机防御,不做任何对外攻击(合规红线写在入口脚本头部注释里)。

  为什么不用 commit 门(guardian-runner):那是提交时跑的判据,不是常驻防护;
  攻击不会等你 commit。
  为什么用 schtasks 而不是 ScheduledTasks 模块:pwsh 7 下该模块常不可见,
  schtasks.exe 在 Server 与 Win10/11 上行为一致,且不依赖模块自动加载。

.PARAMETER Install
  注册计划任务(幂等:同名先删再建)。
.PARAMETER Uninstall
  删除计划任务(不摘已建的防火墙规则,规则按 TTL 由 --prune 到期解封)。
.PARAMETER Status
  只打印任务状态与最近一次结果(默认动作)。

.EXAMPLE
  pwsh -File scripts/security/install-autoban-task.ps1 -Status
  pwsh -File scripts/security/install-autoban-task.ps1 -Install
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Status,
  [string]$Root = 'D:\IHUI-AI',
  [int]$IntervalMinutes = 10,
  [string]$NodeExe = ''
)

$ErrorActionPreference = 'Stop'
$taskName = 'IHUI-Attack-AutoBan'
$scriptPath = Join-Path $Root 'scripts\security\ihui-attack-autoban.mjs'
$schtasks = Join-Path $env:SystemRoot 'System32\schtasks.exe'

function Resolve-NodeExe {
  # 稳定路径优先:会话内 Get-Command node 可能指到 sandbox runtime 的临时副本,
  # 那个目录会随会话回收消失,计划任务随后每 10 分钟全失败。
  if ($NodeExe -and (Test-Path -LiteralPath $NodeExe)) { return $NodeExe }
  foreach ($p in @('D:\DevEnv\runtimes\node22-lts\node.exe', 'C:\Program Files\nodejs\node.exe')) {
    if (Test-Path -LiteralPath $p) { return $p }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -notmatch 'sandbox_runtime') { return $cmd.Source }
  throw '找不到稳定的 node.exe:请把 node 加到 D:\DevEnv\runtimes\node22-lts 或 PATH,或用 -NodeExe 指定'
}

function Show-Status {
  & $schtasks /Query /TN $taskName /V /FO LIST 2>&1
}

if ($Uninstall) {
  & $schtasks /Delete /TN $taskName /F 2>&1
  Write-Host '已删除计划任务(已建防火墙规则保留,按 TTL 由 --prune 到期解封)'
  return
}

if ($Status -or -not $Install) {
  Show-Status
  if (-not $Install) {
    Write-Host ''
    Write-Host '当前为只读查看。注册请加 -Install;卸载加 -Uninstall。'
  }
  return
}

if (-not (Test-Path -LiteralPath $scriptPath)) { throw "缺少入口脚本: $scriptPath" }
$nodeExe = Resolve-NodeExe

# schtasks /TR 需要一整条带引号的命令行;数组传参避免被二次拆词。
$taskRun = '"{0}" "{1}" --apply --json' -f $nodeExe, $scriptPath
& $schtasks /Create /TN $taskName /TR $taskRun /SC MINUTE /MO $IntervalMinutes /RU SYSTEM /RL HIGHEST /F 2>&1

if ($LASTEXITCODE -ne 0) { throw "schtasks 注册失败(exit $LASTEXITCODE)" }
Write-Host "已注册 $taskName:每 $IntervalMinutes 分钟以 SYSTEM 运行"
Write-Host "  命令: $taskRun"
Show-Status
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
