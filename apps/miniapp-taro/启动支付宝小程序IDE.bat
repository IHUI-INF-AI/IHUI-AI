@echo off
chcp 65001 >nul
echo ========================================
echo   智汇 AI - 支付宝小程序一键启动
echo ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0启动支付宝小程序IDE.ps1"
if %errorlevel% neq 0 (
    echo.
    echo 启动失败，请检查上面的错误信息
    pause
)
