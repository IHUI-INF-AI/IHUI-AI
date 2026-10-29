# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  停止 GameViewer(UU远程) 相关服务与进程 —— 可选缓解脚本（可逆）
.DESCRIPTION
  GameViewer 虚拟显示器(3840x2160)与物理 Intel 屏(1920x1080)组成双拓扑，
  远程会话连/断会造成显示拓扑不同步，触发 explorer 重建任务栏 -> 微信重注册
  taskbarpins 子进程 -> 黑窗。停止 GameViewer 可降低触发频率。
  ⚠️ 警告：这会停用 UU远程 的远程访问能力，仅在确实不需要远程时执行。
  可逆：以管理员身份运行 `Start-Service GameViewerService` 即可恢复。
  注意：看门狗已根治黑窗症状，本脚本并非必须，按需使用。
#>
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'mitigate-gameviewer.log'

function Write-Log($m) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$ts] $m"
  Add-Content -Path $LogPath -Value $line -Encoding utf8
  Write-Host $line
}

Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host "  ⚠️  警告：本脚本将停用 UU远程(GameViewer) 的远程访问能力。" -ForegroundColor Yellow
Write-Host "  仅在确实不需要远程时执行。可逆：Start-Service GameViewerService" -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Yellow

Write-Log "=== 开始：停止 GameViewer ==="

# 1) 停止服务
$svc = Get-Service -Name 'GameViewerService' -ErrorAction SilentlyContinue
if ($svc) {
  try {
    if ($svc.Status -eq 'Running') { Stop-Service -Name 'GameViewerService' -Force }
    # 设为手动，避免后续随系统自动拉起（磁盘上保留，可随时 Start-Service 恢复）
    Set-Service -Name 'GameViewerService' -StartupType Manual -ErrorAction SilentlyContinue
    Write-Log "已停止并将 GameViewerService 设为 Manual（原状态: $($svc.Status)）"
  } catch {
    Write-Log "停止服务失败: $_"
  }
} else {
  Write-Log "未找到 GameViewerService（可能未安装或未运行）。"
}

# 2) 停止相关进程
$procs = @('GameViewer', 'GameViewerServer', 'GameViewerHealthd')
foreach ($name in $procs) {
  $p = Get-Process -Name $name -ErrorAction SilentlyContinue
  if ($p) {
    try {
      $p | Stop-Process -Force
      Write-Log "已停止进程 $name (PID: $($p.Id -join ','))"
    } catch {
      Write-Log "停止 $name 失败: $_"
    }
  }
}

Write-Log "=== 结束：恢复方法 = 管理员运行 `Start-Service GameViewerService`（会自动恢复原启动类型）==="
Write-Host "日志见: $LogPath" -ForegroundColor Cyan
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
