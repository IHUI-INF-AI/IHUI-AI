#requires -Version 7
# 重启 web dev server:停 8801 端口进程 + 清 .next 缓存
$conns = Get-NetTCPConnection -LocalPort 8801 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    $pids = $conns.OwningProcess | Sort-Object -Unique
    foreach ($p in $pids) {
        try {
            Stop-Process -Id $p -Force -ErrorAction Stop
            Write-Host "Killed PID $p"
        } catch {
            $msg = $_.Exception.Message
            Write-Host "Failed to kill PID $p : $msg"
        }
    }
    Start-Sleep -Seconds 3
} else {
    Write-Host "No process listening on 8801"
}

$nextPath = 'g:\IHUI-AI\apps\web\.next'
if (Test-Path $nextPath) {
    Remove-Item -Recurse -Force $nextPath
    Write-Host ".next cache cleared"
} else {
    Write-Host ".next cache not present"
}
