# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  停止 TranslucentTB 并尽量禁用其自启 —— 可选缓解脚本（可逆）
.DESCRIPTION
  TranslucentTB 会 hook 任务栏渲染，与微信 taskbarpins 子进程抢占任务栏，
  是黑窗弹出的环境因素之一。停止它可降低触发频率。
  可逆：重新运行 TranslucentTB 可执行文件即可恢复（建议同时在其设置里关闭"开机启动"）。
  注意：看门狗已根治黑窗症状，本脚本并非必须，按需使用。
#>
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'mitigate-translucenttb.log'

function Write-Log($m) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$ts] $m"
  Add-Content -Path $LogPath -Value $line -Encoding utf8
  Write-Host $line
}

Write-Log "=== 开始：停止 TranslucentTB ==="

# 1) 停止进程
$tb = Get-Process -Name 'TranslucentTB' -ErrorAction SilentlyContinue
if ($tb) {
  try {
    $tb | Stop-Process -Force
    Write-Log "已停止 TranslucentTB 进程 (PID: $($tb.Id -join ','))"
  } catch {
    Write-Log "停止进程失败: $_"
  }
} else {
  Write-Log "TranslucentTB 当前未运行。"
}

# 2) 尝试禁用自启：HKCU Run 中的 TranslucentTB 项
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
try {
  if (Test-Path $runKey) {
    $props = Get-ItemProperty -Path $runKey
    $matched = $props.PSObject.Properties | Where-Object { $_.Name -match 'TranslucentTB|Translucent' }
    foreach ($p in $matched) {
      Remove-ItemProperty -Path $runKey -Name $p.Name -Force
      Write-Log "已移除自启项: HKCU\...\Run\$p.Name (原值: $($p.Value))"
    }
    if ($matched.Count -eq 0) { Write-Log "HKCU Run 中未发现 TranslucentTB 自启项（其自启可能由应用内设置管理）。" }
  }
} catch {
  Write-Log "处理自启项时出错: $_"
}

Write-Log "=== 结束：恢复方法 = 重新运行 TranslucentTB 可执行文件（并在其设置中开启"开机启动"如需）==="
Write-Host "日志见: $LogPath" -ForegroundColor Cyan
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
