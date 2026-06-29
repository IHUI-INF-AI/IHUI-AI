@echo off
chcp 65001 >nul
echo ========================================
echo   ZHS Platform - 全栈启动
echo ========================================
echo.
echo [1/3] 启动后端 (端口 8000)...
cd /d G:\IHUI-AI\server
start /B python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
timeout /t 15 /nobreak >nul
echo      后端已启动 ✓
echo.
echo [2/3] 启动前端 (端口 8888)...
cd /d G:\IHUI-AI\client
start /B node node_modules\vite\bin\vite.js --port 8888
timeout /t 10 /nobreak >nul
echo      前端已启动 ✓
echo.
echo [3/3] 验证连通性...
curl -s http://127.0.0.1:8000/healthz >nul 2>&1 && echo      后端健康检查 ✓ || echo      后端健康检查 ✗
curl -s http://127.0.0.1:8888/ >nul 2>&1 && echo      前端可达 ✓ || echo      前端可达 ✗
echo.
echo ========================================
echo   全栈已启动!
echo   前端: http://127.0.0.1:8888
echo   后端: http://127.0.0.1:8000
echo   Swagger: http://127.0.0.1:8000/docs
echo   默认账号: admin / admin123
echo ========================================
echo.
echo 按任意键退出（后台服务继续运行）
pause >nul
