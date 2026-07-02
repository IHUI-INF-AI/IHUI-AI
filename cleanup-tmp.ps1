$tmp = 'g:\IHUI-AI\client\tmp'
if (Test-Path $tmp) {
    Get-ChildItem $tmp -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Removing: $($_.FullName)"
        Remove-Item $_.FullName -Force
    }
    Remove-Item $tmp -Recurse -Force
    if (Test-Path $tmp) { Write-Host 'STILL EXISTS' } else { Write-Host 'REMOVED' }
} else {
    Write-Host 'NOT FOUND'
}
