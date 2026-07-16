# 接收后续所有参数,直接调 node_modules/.bin/tauri
# 用法: powershell -File with-rust.ps1 build --debug
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
Write-Host "[tauri-wrapper] PATH injected: $env:USERPROFILE\.cargo\bin"
$tauri = Join-Path (Get-Location) "node_modules\.bin\tauri.cmd"
Write-Host "[tauri-wrapper] tauri: $tauri"
$proc = Start-Process -FilePath $tauri -ArgumentList $args -Wait -NoNewWindow -PassThru
exit $proc.ExitCode
