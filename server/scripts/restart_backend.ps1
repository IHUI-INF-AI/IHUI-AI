# kill backend on port 8000 and restart
# 2026-06-25 修复: 改用 $PSScriptRoot 解析路径, 避免硬编码 G:\1\server
$ServerRoot = Join-Path $PSScriptRoot "..\"
$ServerRoot = (Resolve-Path $ServerRoot).Path
$LogDir = Join-Path $ServerRoot "logs"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 2
Start-Process -FilePath python -ArgumentList '-m','uvicorn','app.main:app','--port','8000','--host','127.0.0.1' -WorkingDirectory $ServerRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDir 'uvicorn.out') -RedirectStandardError (Join-Path $LogDir 'uvicorn.err')
Write-Host "backend restarting..."
Start-Sleep -Seconds 12
$check = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($check) { Write-Host "backend_listening=yes" } else { Write-Host "backend_listening=no" }
