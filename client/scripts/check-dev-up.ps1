Start-Sleep -Seconds 25
try {
  $code = (Invoke-WebRequest -Uri 'http://127.0.0.1:8888/' -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue).StatusCode
  Write-Host "HTTP: $code"
} catch {
  Write-Host "HTTP: ERROR - $($_.Exception.Message)"
}
