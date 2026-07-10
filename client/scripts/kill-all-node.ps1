Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Killing PID $($_.Id)"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
$remaining = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "Remaining node procs: $remaining"
