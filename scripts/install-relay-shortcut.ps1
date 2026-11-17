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

  唯一入口(2026-11-05 立):scripts\client-oneclick-switch.cmd
    → 桌面「AI 客户端一键切号.lnk」(选客户端 → 列号池 → 切本机登录态,多平台)。

  旧版「WorkBuddy 一键切号」已停用(2026-11-17 机主定案「不要再有旧版」):本安装器
  不再创建它,并会把桌面上遗留的同款旧快捷方式(目标=本仓 scripts\relay-oneclick.cmd)
  一并清掉。relay-oneclick.cmd 本身保留(WorkBuddy 切号+会话换桶仍可手动跑),
  只是不再上桌面。

  注意:本入口不是独立程序,依赖整仓 + Node22 + tsx + relay 号池库/.env。换机前那台机
  必须先有本仓库(且 pnpm install 过),再跑本脚本才有意义。

.PARAMETER Desktop
  覆盖桌面路径(测试用;默认取系统真实桌面)。

.PARAMETER SkipOld
  已无作用:安装器本就只建主入口。保留该参数仅为兼容既有调用方
  (api 服务 relay-desktop-shortcut 与 CLI relay desktop-shortcut 固定传它)。

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

function Resolve-IhuiIcon {
  # 项目桌面端(Tauri)图标唯一源:与打包进 app.exe 的图标同一枚 ico(见 src-tauri/tauri.conf.json bundle.icon)。
  $ico = Join-Path $repo 'apps\desktop\src-tauri\icons\icon.ico'
  if (Test-Path $ico) { return "$ico,0" }
  return $null
}

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
# 新入口用「我们自己的」图标:项目桌面端 ico 优先,取不到才回退 WorkBuddy 图标(再到默认)。
$ihuiIcon = Resolve-IhuiIcon
if (-not $ihuiIcon) {
  Write-Warning '未找到桌面端图标 apps\desktop\src-tauri\icons\icon.ico,新入口将回退 WorkBuddy/默认图标'
}

# 唯一入口(2026-11-05 起,多平台号池切号)
New-SwitcherShortcut -Name 'AI 客户端一键切号' -CmdRel 'scripts\client-oneclick-switch.cmd' -Icon ($ihuiIcon ?? $icon) `
  -Description 'AI 客户端一键切号:选客户端 -> 列号池 -> 切本机登录态(多平台)' -WhatIf:$WhatIfPreference

# 旧版退役(2026-11-17):只清「目标确实指向本仓 relay-oneclick.cmd」的遗留件。
# 同名但目标不是仓内那枚的一律不动(可能是机主自己的快捷方式),只报一行警告,不代删。
$legacyLnk = Join-Path $desktop 'WorkBuddy 一键切号.lnk'
if (Test-Path -LiteralPath $legacyLnk) {
  $legacyTarget = (New-Object -ComObject WScript.Shell).CreateShortcut($legacyLnk).TargetPath
  if ($legacyTarget -eq (Join-Path $repo 'scripts\relay-oneclick.cmd')) {
    if ($WhatIfPreference) {
      Write-Output "[WhatIf] 将清掉遗留旧快捷方式: $legacyLnk"
    } else {
      Remove-Item -LiteralPath $legacyLnk -Force
      Write-Output "已清掉遗留旧快捷方式: $legacyLnk"
    }
  } else {
    Write-Warning "桌面有同名快捷方式但目标不是本仓 relay-oneclick.cmd($legacyTarget),不代删: $legacyLnk"
  }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
