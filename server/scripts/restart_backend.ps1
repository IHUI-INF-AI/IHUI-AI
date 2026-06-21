# kill backend on port 8000 and restart
$conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
}
Start-Sleep -Seconds 2
Start-Process -FilePath python -ArgumentList '-m','uvicorn','app.main:app','--port','8000','--host','127.0.0.1' -WorkingDirectory 'g:\1\server' -WindowStyle Hidden -RedirectStandardOutput 'g:\1\server\logs\uvicorn.out' -RedirectStandardError 'g:\1\server\logs\uvicorn.err'
Write-Host "backend restarting..."
Start-Sleep -Seconds 12
$check = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($check) { Write-Host "backend_listening=yes" } else { Write-Host "backend_listening=no" }
