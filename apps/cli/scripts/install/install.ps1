# IHUI CLI PowerShell 一键安装脚本
# 用法: iwr -useb https://ihui.ai/install.ps1 | iex
# 依赖: Node.js 20+(自动检测,缺失则报错引导安装)
$ErrorActionPreference = 'Stop'

function Info($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "⚠ $m" -ForegroundColor Yellow }
function Fatal($m) { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }

Write-Host "IHUI AI Coding Agent — 安装中..." -ForegroundColor Cyan

# 1. 检测 Node.js
try { $nodeVer = (node -v) } catch {
  Fatal "未检测到 Node.js,请先安装 Node.js 20+ (https://nodejs.org)"
}
$major = [int]($nodeVer -replace '^v','' -split '\.')[0]
if ($major -lt 20) { Fatal "Node.js 版本过低(当前 $nodeVer),需 20+ (https://nodejs.org)" }
Info "Node.js $nodeVer"

# 2. 选择包管理器(npm 优先,降级 pnpm)
if (Get-Command npm -ErrorAction SilentlyContinue) {
  $inst = 'npm install -g'
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
  $inst = 'pnpm add -g'
} else {
  Fatal "未检测到 npm/pnpm,请先安装 npm (随 Node.js 附带)"
}

# 3. 全局安装(需要管理员权限,失败提示)
Invoke-Expression "$inst @ihui/cli"
if ($LASTEXITCODE -ne 0) {
  Warn "全局安装失败,尝试以管理员权限重试..."
  Start-Process -FilePath "$inst".Split(' ')[0] `
    -ArgumentList ($inst -replace '^\S+\s*', '') -ArgumentList @(' @ihui/cli') `
    -Verb RunAs -Wait -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) { Fatal "安装失败,请检查网络或手动运行: $inst @ihui/cli" }
}

# 4. 验证
$ihui = Get-Command ihui -ErrorAction SilentlyContinue
if ($ihui) {
  $ver = try { (ihui --version 2>$null) } catch { 'unknown' }
  Info "安装成功: ihui $ver"
  Write-Host "  运行 ihui 进入交互式 REPL" -ForegroundColor White
  Write-Host "  文档: https://ihui.ai" -ForegroundColor White
} else {
  Warn "ihui 未加入 PATH,请将 npm 全局 bin 目录加入 PATH"
  Write-Host "  查询全局 bin: npm prefix -g" -ForegroundColor White
}
