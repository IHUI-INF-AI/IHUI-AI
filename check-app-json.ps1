$locales = @('zh-CN', 'en', 'ja', 'ko', 'zh-TW')
foreach ($loc in $locales) {
    $path = "g:\IHUI-AI\client\src\locales\modules\$loc\app.json"
    Write-Host "--- $loc ---"
    if (Test-Path $path) {
        Write-Host "EXISTS"
        Get-Content $path -Raw
    } else {
        Write-Host "MISSING"
    }
    Write-Host ""
}
