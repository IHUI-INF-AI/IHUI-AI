# 添加 Defender 排除路径
$paths = @("G:\IHUI-AI", "G:\IHUI-AI\node_modules", "G:\IHUI-AI\apps")
foreach ($path in $paths) {
    try {
        Add-MpPreference -ExclusionPath $path -ErrorAction Stop
        Write-Host "已添加排除: $path"
    } catch {
        Write-Host "添加排除失败 ($path): $_"
    }
}

# 验证
Write-Host "`n当前排除路径:"
Get-MpPreference -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ExclusionPath
