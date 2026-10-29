# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  取消微信(Weixin)在 Windows 11 任务栏的固定 —— 可选缓解脚本（可逆）
.DESCRIPTION
  微信 4.x 在 Win11 上由 explorer 拉起 `Weixin.exe --scene=taskbarpins` 子进程，
  该子进程渲染任务栏固定图标。取消固定可降低该子进程被触发的频率。
  本脚本幂等，仅删除指向 Weixin.exe 的任务栏固定快捷方式(.lnk)。
  可逆：用户在微信窗口标题栏右键"固定到任务栏"即可恢复。
  注意：看门狗已根治黑窗症状，本脚本并非必须，按需使用。
#>
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'mitigate-unpin.log'

function Write-Log($m) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$ts] $m"
  Add-Content -Path $LogPath -Value $line -Encoding utf8
  Write-Host $line
}

Write-Log "=== 开始：取消微信任务栏固定 ==="

# Win11 任务栏固定项存储于 Quick Launch\User Pinned\TaskBar 下的 .lnk
$pinDir = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$removed = 0

if (Test-Path $pinDir) {
  $links = Get-ChildItem -Path $pinDir -Filter '*.lnk' -ErrorAction SilentlyContinue
  foreach ($lnk in $links) {
    try {
      $sh = New-Object -ComObject WScript.Shell
      $target = $sh.CreateShortcut($lnk.FullName).TargetPath
      if ($target -match 'Weixin\.exe' -or $target -match '微信') {
        Remove-Item -Path $lnk.FullName -Force
        Write-Log "已删除固定项: $($lnk.Name) -> $target"
        $removed++
      }
    } catch {
      Write-Log "处理 $($lnk.Name) 时出错: $_"
    }
  }
} else {
  Write-Log "未找到任务栏固定目录: $pinDir"
}

if ($removed -eq 0) {
  Write-Log "未发现微信的固定项（可能本就未固定，或 Win11 以新方式管理固定）。无需操作。"
} else {
  Write-Log "共移除 $removed 个固定项。若任务栏未立即刷新，可手动右键微信窗口标题栏重新固定，或重启 explorer。"
}

Write-Log "=== 结束：恢复方法 = 微信窗口标题栏右键 -> 固定到任务栏 ==="
Write-Host "日志见: $LogPath" -ForegroundColor Cyan
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
