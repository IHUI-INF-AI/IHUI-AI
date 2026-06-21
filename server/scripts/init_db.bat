@echo off
REM init_db.bat - init SQLite database and start uvicorn
REM Usage: init_db.bat [port=8000] [--no-run]
set PORT=%1
if "%PORT%"=="" set PORT=8000
if /I "%PORT%"=="--no-run" set PORT=8000

setlocal
set ROOT_DIR=%~dp0..\..
set ROOT_DIR=%ROOT_DIR:\\=\%
cd /d %ROOT_DIR%\server

echo [1/5] Clean old SQLite files
del /Q .zhs_db_fallback_*.sqlite 2>nul
echo done.

echo [2/5] Set environment variables
set AUTO_CREATE_SCHEMA=1
set ENV=development
set CORS_ORIGINS=http://localhost:3000,http://localhost:5173
echo done.

echo [3/5] Verify Python deps
python -c "import fastapi, sqlalchemy, loguru, fakeredis" 2>nul
if errorlevel 1 (
    echo Missing deps, run: pip install -r requirements.txt
    exit /b 1
)
echo deps OK.

echo [4/5] Seed admin user
python -m scripts.seed_admin
if errorlevel 1 (
    echo seed_admin failed, exit 1
    exit /b 1
)
echo admin seed done.

if /I "%2"=="--no-run" goto :skip_run
echo [5/5] Start uvicorn on port %PORT%
echo Visit http://127.0.0.1:%PORT%/docs
echo Login: admin / admin123
echo Ctrl+C to stop
python -m uvicorn app.main:app --port %PORT% --host 127.0.0.1
goto :eof

:skip_run
echo [5/5] Skipped (--no-run), DB ready
