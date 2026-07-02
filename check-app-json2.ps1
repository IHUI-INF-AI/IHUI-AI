$locales = @('zh-CN', 'en', 'ja', 'ko', 'zh-TW')
foreach ($loc in $locales) {
    $path = "g:\IHUI-AI\client\src\locales\modules\$loc\app.json"
    Write-Host "--- $loc ---"
    $bytes = [System.IO.File]::ReadAllBytes($path)
    Write-Host "Size: $($bytes.Length) bytes"
    $head = $bytes[0..([Math]::Min(20, $bytes.Length-1))]
    $headHex = ($head | ForEach-Object { $_.ToString('X2') }) -join ' '
    Write-Host "Head bytes: $headHex"
    $hasBOM = ($bytes.Length -gt 3) -and ($bytes[0] -eq 0xEF) -and ($bytes[1] -eq 0xBB) -and ($bytes[2] -eq 0xBF)
    Write-Host "Has UTF-8 BOM: $hasBOM"
    Write-Host ""
}
