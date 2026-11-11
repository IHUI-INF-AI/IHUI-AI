# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  重建「AI 客户端一键切号」(及旧版「WorkBuddy 一键切号」)桌面快捷方式。

.DESCRIPTION
  快捷方式本身不进版本库(落在用户桌面),丢了或换机就重跑本脚本。
  本脚本路径无关:从自身位置推算仓库根,用 [Environment]::GetFolderPath('Desktop')
  取真实桌面路径(支持桌面在非系统盘,如 E:\桌面)。

  入口分两代:
    · 新入口(2026-11-05 立,当前主力):scripts\client-oneclick-switch.cmd
      → 桌面「AI 客户端一键切号.lnk」(选客户端 → 列号池 → 切本机登录态,多平台)。
    · 旧入口(仅 WorkBuddy):scripts\relay-oneclick.cmd
      → 桌面「WorkBuddy 一键切号.lnk」(relay-oneclick.cmd 还在才建,向后兼容)。

  注意:本入口不是独立程序,依赖整仓 + Node22 + tsx + relay 号池库/.env。换机前那台机
  必须先有本仓库(且 pnpm install 过),再跑本脚本才有意义。

.PARAMETER Desktop
  覆盖桌面路径(测试用;默认取系统真实桌面)。

.PARAMETER SkipOld
  不建旧版「WorkBuddy 一键切号」快捷方式。

.PARAMETER WhatIf
  只打印将要创建的快捷方式及其目标,不落盘(安全干跑)。

.EXAMPLE
  pwsh -NoProfile -File scripts/install-relay-shortcut.ps1
  pwsh -NoProfile -File scripts/install-relay-shortcut.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Desktop,
  [switch]$SkipOld
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'package.json'))) {
  throw "无法定位仓库根: $repo (本脚本应位于 <仓库>\scripts\ 下)"
}
$desktop = if ($Desktop) { $Desktop } else { [Environment]::GetFolderPath('Desktop') }
if (-not (Test-Path $desktop)) { throw "桌面目录不存在: $desktop" }

function Find-WorkBuddyIcon {
  foreach ($root in @(
      'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
      'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )) {
    try {
      $hit = Get-ItemProperty $root -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like 'WorkBuddy*' -and $_.DisplayIcon } |
        Select-Object -First 1
      if ($hit) { return ($hit.DisplayIcon -replace ',\s*-?\d+$', '') + ',0' }
    } catch { }
  }
  return $null
}

function New-SwitcherShortcut {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$CmdRel,
    [string]$Icon,
    [Parameter(Mandatory)] [string]$Description,
    [switch]$WhatIf
  )
  $cmd = Join-Path $repo $CmdRel
  if (-not (Test-Path $cmd)) {
    Write-Warning "跳过「$Name」: 启动器缺失 $cmd"
    return
  }
  $lnk = Join-Path $desktop "$Name.lnk"
  if ($WhatIf) {
    Write-Output "[WhatIf] 将创建: $lnk -> $cmd (WorkDir=$repo)"
    return
  }
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut($lnk)
  $sc.TargetPath = $cmd
  $sc.WorkingDirectory = $repo
  if ($Icon) { $sc.IconLocation = $Icon }
  $sc.Description = $Description
  $sc.WindowStyle = 1
  $sc.Save()
  if (-not (Test-Path $lnk)) { throw "创建失败: $lnk" }
  Write-Output "OK $lnk"
  Write-Output "  Target=$($sc.TargetPath)"
  Write-Output "  Icon=$($sc.IconLocation)"
}

$icon = Find-WorkBuddyIcon

# 新入口(当前主力,2026-11-05)
New-SwitcherShortcut -Name 'AI 客户端一键切号' -CmdRel 'scripts\client-oneclick-switch.cmd' -Icon $icon `
  -Description 'AI 客户端一键切号:选客户端 -> 列号池 -> 切本机登录态(多平台)' -WhatIf:$WhatIfPreference

# 旧入口(仅 WorkBuddy,relay-oneclick.cmd 还在才建)
if (-not $SkipOld) {
  New-SwitcherShortcut -Name 'WorkBuddy 一键切号' -CmdRel 'scripts\relay-oneclick.cmd' -Icon $icon `
    -Description 'WorkBuddy 一键切号(旧):关闭客户端 -> 选号 -> 切号+会话换桶 -> 重启客户端' -WhatIf:$WhatIfPreference
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
