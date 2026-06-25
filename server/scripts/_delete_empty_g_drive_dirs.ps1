$ErrorActionPreference = 'Continue'
$dirs = @('G:\1', 'G:\dev', 'G:\tmp')
foreach ($d in $dirs) {
    if (Test-Path -LiteralPath $d) {
        $items = @(Get-ChildItem -LiteralPath $d -Force -ErrorAction SilentlyContinue)
        if ($items.Count -eq 0) {
            try {
                Remove-Item -LiteralPath $d -Force -ErrorAction Stop
                Write-Host "DELETED-EMPTY-DIR: $d"
            } catch {
                Write-Host "FAILED-REMOVE-DIR:  $d  --  $($_.Exception.Message)"
            }
        } else {
            Write-Host "NOT-EMPTY (kept): $d ($($items.Count) items)"
        }
    } else {
        Write-Host "GONE: $d"
    }
}
Write-Host '---'
Write-Host '--- final check ---'
foreach ($d in $dirs) {
    if (Test-Path -LiteralPath $d) {
        Write-Host "STILL-EXISTS: $d"
    } else {
        Write-Host "GONE: $d"
    }
}
