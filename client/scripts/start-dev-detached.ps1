# 启动 Vite dev server (后台运行), 日志写到项目内 client/dev-server.log
# 路径全部用 $PSScriptRoot 相对路径, 禁止硬编码 G:\ 盘符绝对路径 (项目搬迁断链 / 跨机失效)
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
$ClientDir = $PSScriptRoot | Split-Path -Parent  # client/scripts -> client
Set-Location $ClientDir
& npm run dev 2>&1 | Out-File -FilePath (Join-Path $ClientDir 'dev-server.log') -Encoding utf8
