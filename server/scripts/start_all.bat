@echo off
REM start_all.bat - start backend and frontend in two windows
REM Usage: start_all.bat [backend_port=8000] [frontend_port=8888]

set BACKEND_PORT=%1
if "%BACKEND_PORT%"=="" set BACKEND_PORT=8000
set FRONTEND_PORT=%2
if "%FRONTEND_PORT%"=="" set FRONTEND_PORT=8888

setlocal
set ROOT_DIR=%~dp0..\..
set ROOT_DIR=%ROOT_DIR:\\=\%

echo [1/3] Init backend DB
cd /d %ROOT_DIR%\server
call scripts\init_db.bat %BACKEND_PORT% --no-run
if errorlevel 1 (
    echo DB init failed
    exit /b 1
)

echo.
echo [2/3] Start backend on port %BACKEND_PORT%
start "ZHS-Backend" cmd /k "cd /d %ROOT_DIR%\server && python -m uvicorn app.main:app --port %BACKEND_PORT% --host 127.0.0.1"

echo.
echo [3/3] Start frontend on port %FRONTEND_PORT%
start "ZHS-Frontend" cmd /k "cd /d %ROOT_DIR%\client && npm run dev -- --port %FRONTEND_PORT%"

echo.
echo === All started ===
echo Backend:  http://127.0.0.1:%BACKEND_PORT%/docs
echo Frontend: http://127.0.0.1:%FRONTEND_PORT%/
echo Close the corresponding window to stop a service.
endlocal
