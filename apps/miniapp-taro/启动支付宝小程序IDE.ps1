# 一键启动支付宝小程序 IDE 脚本
# 双击运行即可自动编译并打开项目

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$MiniappDir = Join-Path $ProjectRoot "apps\miniapp-taro"
$IdeExe = "G:\支付宝小程序开发工具\小程序开发者工具\小程序开发者工具.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  智汇 AI - 支付宝小程序一键启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 IDE 是否安装
Write-Host "[1/3] 检查支付宝小程序开发工具..." -ForegroundColor Yellow
if (-not (Test-Path $IdeExe)) {
    Write-Host "错误: 未找到支付宝小程序开发工具" -ForegroundColor Red
    Write-Host "路径: $IdeExe" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}
Write-Host "  OK - 开发工具已安装" -ForegroundColor Green

# 2. 编译支付宝小程序
Write-Host ""
Write-Host "[2/3] 编译支付宝小程序..." -ForegroundColor Yellow
Set-Location $MiniappDir
try {
    & pnpm build:alipay 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        throw "编译失败,退出码: $LASTEXITCODE"
    }
    Write-Host "  OK - 编译成功" -ForegroundColor Green
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 3. 打开 IDE
Write-Host ""
Write-Host "[3/3] 启动支付宝小程序开发工具..." -ForegroundColor Yellow
try {
    Start-Process -FilePath $IdeExe -ArgumentList "--project `"$MiniappDir`""
    Write-Host "  OK - IDE 已启动" -ForegroundColor Green
} catch {
    Write-Host "错误: 启动 IDE 失败: $_" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  启动完成! 请查看 IDE 窗口" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2
