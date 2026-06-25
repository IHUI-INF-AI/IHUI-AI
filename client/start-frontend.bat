@echo off
:: ========================================
:: 前端启动脚本 (后端已迁移至 server/ 目录)
:: 后端启动: cd ../server && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
:: ========================================
chcp 65001 >NUL
echo ========================================
echo   Officialsite - 前端启动
echo ========================================
echo.
cd /d "%~dp0"
echo [1/2] 启动 Vite Dev Server (端口 8888)...
start /B node node_modules\vite\bin\vite.js --port 8888
echo [2/2] 等待启动...
timeout /t 10 /nobreak >NUL
echo.
echo ========================================
echo   前端已启动: http://127.0.0.1:8888
echo ========================================
echo.
echo 按 Ctrl+C 停止前端
pause >NUL
