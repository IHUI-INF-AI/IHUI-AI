@echo off
chcp 65001 >nul
echo ========================================
echo   ZHS Platform - 后端启动
echo ========================================
echo.
cd /d G:\IHUI-AI\server
echo [1/2] 启动 uvicorn (端口 8000)...
start /B python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
echo [2/2] 等待启动...
timeout /t 15 /nobreak >nul
echo.
echo ========================================
echo   后端已启动: http://127.0.0.1:8000
echo   Swagger UI: http://127.0.0.1:8000/docs
echo   健康检查: http://127.0.0.1:8000/healthz
echo ========================================
echo.
echo 按 Ctrl+C 停止后端
pause >nul
