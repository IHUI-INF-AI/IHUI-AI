$files = Get-ChildItem -Path 'g:\IHUI-AI\client\src\locales\modules' -Filter '*.json' -Recurse -File
$count = 0
$bom = 0
$doubleBom = 0
foreach ($f in $files) {
    $count++
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $b = 0
    $b1 = ($bytes.Length -gt 0) -and ($bytes[0] -eq 0xEF)
    $b2 = ($bytes.Length -gt 1) -and ($bytes[1] -eq 0xBB)
    $b3 = ($bytes.Length -gt 2) -and ($bytes[2] -eq 0xBF)
    $b4 = ($bytes.Length -gt 3) -and ($bytes[3] -eq 0xEF)
    $b5 = ($bytes.Length -gt 4) -and ($bytes[4] -eq 0xBB)
    $b6 = ($bytes.Length -gt 5) -and ($bytes[5] -eq 0xBF)
    if ($b1 -and $b2 -and $b3) { $bom++ }
    if ($b1 -and $b2 -and $b3 -and $b4 -and $b5 -and $b6) { $doubleBom++ }
}
Write-Host "Total JSON files: $count"
Write-Host "With BOM: $bom"
Write-Host "With DOUBLE BOM: $doubleBom"
