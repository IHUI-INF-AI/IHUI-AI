$ErrorActionPreference = 'Continue'
$paths = @(
    'G:\1\pw-output',
    'G:\dev\stdout',
    'G:\tmp\ro.css',
    'G:\tmp\refund_evidence'
)
foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p) {
        try {
            Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
            Write-Host "DELETED: $p"
        } catch {
            Write-Host "FAILED:  $p  --  $($_.Exception.Message)"
        }
    } else {
        Write-Host "NOT-EXIST: $p"
    }
}
Write-Host '---'
Write-Host '--- after delete ---'
foreach ($p in $paths) {
    if (Test-Path -LiteralPath $p) {
        Write-Host "STILL-EXISTS: $p"
    } else {
        Write-Host "GONE: $p"
    }
}
Write-Host '--- remaining in G:\ ---'
Get-ChildItem G:\1 -ErrorAction SilentlyContinue | Select-Object Name,Mode,CreationTime | Format-List
Get-ChildItem G:\dev -ErrorAction SilentlyContinue | Select-Object Name,Mode,CreationTime | Format-List
Get-ChildItem G:\tmp -ErrorAction SilentlyContinue | Select-Object Name,Mode,CreationTime | Format-List
