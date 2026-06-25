@echo off
chcp 65001 >nul
echo ========================================
echo   ZHS Platform - 运行测试
echo ========================================
echo.
cd /d "%~dp0"
echo [1/2] 运行 E2E 冒烟测试...
python local_data\e2e_smoke_test.py --base http://127.0.0.1:8000
echo.
echo [2/2] 运行全量验证...
python scripts\dev\final_verify.py
echo.
echo ========================================
echo   测试完成
echo ========================================
pause >nul
