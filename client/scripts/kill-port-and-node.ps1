$port = 8888
$conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $procId = $c.OwningProcess
  if ($procId -gt 0) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Port $port -> PID $procId ($($proc.ProcessName)) -- killing"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Killing node PID $($_.Id)"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
$portBusy = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).Count
$nodeCount = (Get-Process node -ErrorAction SilentlyContinue).Count
Write-Host "Port $port busy: $portBusy"
Write-Host "Node procs: $nodeCount"
