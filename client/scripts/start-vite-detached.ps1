# 启动 Vite dev server 作为独立后台进程 (Windows)
# 用 Start-Process -WindowStyle Hidden 完全脱离父 shell
# 写 PID 到 .vite-pid 供后续 stop/cleanup 使用
# 移动自 client/start-vite-detached.ps1 (2026-07-04 整理: dev 工具归位到 client/scripts/)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$nodeExe = (Get-Command node.exe).Source
$viteEntry = Join-Path $PWD 'node_modules\vite\bin\vite.js'
$proc = Start-Process -FilePath $nodeExe `
  -ArgumentList "`"$viteEntry`"","--port","8888","--strictPort","--host","127.0.0.1" `
  -WorkingDirectory $PWD `
  -RedirectStandardOutput (Join-Path $PWD 'dev-server.log') `
  -RedirectStandardError (Join-Path $PWD 'dev-server-err.log') `
  -WindowStyle Hidden `
  -PassThru
$proc.Id | Out-File -FilePath (Join-Path $PWD '.vite-pid') -Encoding ascii
Write-Host "vite started, pid=$($proc.Id)"
