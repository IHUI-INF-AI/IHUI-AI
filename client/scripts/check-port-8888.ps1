Start-Sleep -Seconds 10
$listen = (Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue).Count
$all = (Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue).Count
Write-Host "Port 8888 LISTEN: $listen"
Write-Host "Port 8888 ALL: $all"
