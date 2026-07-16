# 接收后续所有参数,直接调 node_modules/.bin/tauri
# 用法: powershell -File with-rust.ps1 build --debug
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
Write-Host "[tauri-wrapper] PATH injected: $env:USERPROFILE\.cargo\bin"
# Tauri CLI 2.x 在 CI=1 时会自动追加 --ci 1,但 Rust 端只接受 true/false。
# 清空 CI 环境变量,避免自动注入非法的 --ci 1。
$env:CI = ''
$tauri = Join-Path (Get-Location) "node_modules\.bin\tauri.cmd"
Write-Host "[tauri-wrapper] tauri: $tauri"
& $tauri @args
exit $LASTEXITCODE
