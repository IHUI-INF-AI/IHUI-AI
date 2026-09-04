@echo off
rem ============================================================
rem  IHUI-AI 全栈本地一键启动脚本
rem  拉起: Redis(8811) + api(8802) + ai-service(8803) + web(8801)
rem  PostgreSQL(8810) 是 Windows 服务(PostgreSQL16IHUI)，开机自启，无需在此拉起
rem  用法: 双击运行，或在命令行执行 start-all.bat
rem  每个服务在独立窗口运行，关闭本脚本不影响已启动的服务；
rem  要停止某服务，直接关闭对应窗口即可
rem ============================================================
setlocal

rem 路径常量
set ROOT=D:\IHUI-AI
set LOGDIR=D:\IHUI-AI\.tmp-sync
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set REDIS_EXE=D:\ihui-redis-6.2\Redis-6.2.24-Windows-x64-msys2\redis-server.exe
set REDIS_DIR=D:\ihui-redis-6.2\data
set PNPM=C:\Users\Administrator\AppData\Roaming\npm\pnpm.cmd

echo ============================================================
echo  IHUI-AI 全栈服务启动
echo ============================================================

rem ---------- 1. Redis 6.2.24 (8811) ----------
echo [1/4] Redis 6.2.24 (8811) ...
call :ensure_port_free 8811
start "IHUI-Redis-8811" cmd /k "cd /d %REDIS_DIR% && %REDIS_EXE% redis-6.2.conf"
echo      已在新窗口启动 Redis，日志见 %REDIS_DIR%\redis-6.2.log
echo.

rem ---------- 2. api (8802) ----------
echo [2/4] api (8802) ...
call :ensure_port_free 8802
start "IHUI-api-8802" cmd /k "cd /d %ROOT%\apps\api && set NODE_ENV=development && call %PNPM% dev > %LOGDIR%\api-dev.log 2>&1"
echo      已在新窗口启动 api，日志见 %LOGDIR%\api-dev.log
echo.

rem ---------- 3. ai-service (8803) ----------
echo [3/4] ai-service (8803) ...
call :ensure_port_free 8803
start "IHUI-ai-service-8803" cmd /k "cd /d %ROOT%\apps\ai-service && set NODE_ENV=development && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8803 > %LOGDIR%\ai-service-dev.log 2>&1"
echo      已在新窗口启动 ai-service，日志见 %LOGDIR%\ai-service-dev.log
echo.

rem ---------- 4. web (8801) ----------
echo [4/4] web (8801) ...
call :ensure_port_free 8801
start "IHUI-web-8801" cmd /k "cd /d %ROOT%\apps\web && call %PNPM% dev > %LOGDIR%\web-dev.log 2>&1"
echo      已在新窗口启动 web(Next.js dev)，日志见 %LOGDIR%\web-dev.log
echo.

echo ============================================================
echo  所有服务已在新窗口启动。等待 30-40 秒后访问:
echo    web         http://localhost:8801
echo    api         http://localhost:8802/health
echo    ai-service  http://localhost:8803/health
echo  PostgreSQL(8810) 为 Windows 服务，开机自启。
echo ============================================================
echo 按任意键关闭本脚本（已启动的服务窗口不受影响）...
pause >nul
exit /b

rem ---------- 辅助: 检查端口是否被占用并提示 ----------
:ensure_port_free
set PORT=%~1
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo      !! 端口 %PORT% 已被占用，可能服务已在运行，将跳过自动等待(新窗口可能启动失败)
)
exit /b
