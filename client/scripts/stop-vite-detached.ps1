# 停止 Vite dev server (Windows)
# 移动自 client/stop-vite-detached.ps1 (2026-07-04 整理: dev 工具归位到 client/scripts/)
$pidFile = Join-Path (Join-Path $PSScriptRoot '..') '.vite-pid'
if (Test-Path $pidFile) {
  $pid = (Get-Content $pidFile -Raw).Trim()
  if ($pid -and (Get-Process -Id $pid -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Write-Host "stopped vite pid=$pid"
  } else {
    Write-Host "pid $pid not running"
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
  Write-Host "no .vite-pid file"
}
