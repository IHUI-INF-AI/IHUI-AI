# 接收后续所有参数,直接调 node_modules/.bin/tauri
# 用法: powershell -File with-rust.ps1 build --debug
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
Write-Host "[tauri-wrapper] PATH injected: $env:USERPROFILE\.cargo\bin"
# Tauri CLI 2.x 在 CI=1 时会自动追加 --ci 1,但 Rust 端只接受 true/false。
# 直接通过 node 启动 tauri.js,并在当前 PowerShell 进程中彻底移除 CI,避免自动注入非法参数。
Write-Host "[tauri-wrapper] CI before remove: [$env:CI]"
if (Test-Path env:CI) { Remove-Item env:CI }
Write-Host "[tauri-wrapper] CI after remove exists: $(Test-Path env:CI)"
$tauriJs = Join-Path (Get-Location) "node_modules\@tauri-apps\cli\tauri.js"
Write-Host "[tauri-wrapper] tauri.js: $tauriJs"
& node $tauriJs @args
exit $LASTEXITCODE
