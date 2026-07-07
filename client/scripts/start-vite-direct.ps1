# 启动 Vite dev server (直连模式, 后台运行), 日志写到项目内 client/dev-server-{stdout,stderr}.log
# 路径全部用 $PSScriptRoot 相对路径, 禁止硬编码 G:\ 盘符绝对路径 (项目搬迁断链 / 跨机失效)
$ClientDir = $PSScriptRoot | Split-Path -Parent  # client/scripts -> client
Set-Location $ClientDir
$stdoutLog = Join-Path $ClientDir 'dev-server-stdout.log'
$stderrLog = Join-Path $ClientDir 'dev-server-stderr.log'
$proc = Start-Process -FilePath "node" -ArgumentList "node_modules/vite/bin/vite.js","--port","8888" -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -NoNewWindow -PassThru -WorkingDirectory $ClientDir
Write-Host "Vite started PID $($proc.Id)"
Start-Sleep -Seconds 8
$alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if ($alive) {
  Write-Host "Vite ALIVE: PID $($proc.Id)"
} else {
  Write-Host "Vite DIED"
  if (Test-Path $stderrLog) {
    Get-Content $stderrLog -Tail 20
  }
}
