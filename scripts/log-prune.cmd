@echo off
setlocal EnableExtensions
REM log-prune.cmd - daily rotated-log retention (RETENTION: keep 72 per stream).
REM Measured 2026-10-02: api rotates ~7 copies/day, so 72 copies ~= 10 days
REM of on-disk fallback; Loki already retains 30 days (720h) as the query face.
REM Redirection lives here because WshShell.Run cannot express it reliably.
REM ASCII only. Registered via wscript.exe (see log-prune-hidden.vbs).
REM 2026-10-14 fix: the old node + repo paths hardcoded D:\ (D:\DevEnv\runtimes
REM and D:\IHUI-AI). The script is now resolved relative to this .cmd (%~dp0)
REM so the repo may live on any drive.
REM
REM 2026-10-28 fix (root cause of "the system cannot find the path specified"
REM repeated every night at 04:00 in D:\DevEnv\logs\log-prune.log):
REM   the previous revision pinned node to "C:\Program Files\nodejs\node.exe",
REM   which does NOT exist on this host (verified 2026-10-28 11:2x: Test-Path
REM   = False; machine PATH carries D:\nodejs\ and the real runtimes live under
REM   D:\DevEnv\runtimes\). Every run died before the pruner ever started, so
REM   2.3 GB of rotated nssm logs piled up. Do not pin a single install path
REM   again: resolve in this order -> %IHUI_NODE_BIN% -> known runtimes on this
REM   host -> `where node`. A missing node is now a LOUD failure (exit 3 plus a
REM   FAIL line in the log) instead of a silent one.
REM
REM Exit codes: 0 = pruned/nothing to prune, 3 = no node interpreter found,
REM otherwise the pruner's own exit code.

set "LOGDIR=D:\DevEnv\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" 2>nul

set "NODE_BIN="
if defined IHUI_NODE_BIN if exist "%IHUI_NODE_BIN%" set "NODE_BIN=%IHUI_NODE_BIN%"
if not defined NODE_BIN if exist "D:\DevEnv\runtimes\node22-lts\node.exe" set "NODE_BIN=D:\DevEnv\runtimes\node22-lts\node.exe"
if not defined NODE_BIN if exist "D:\DevEnv\runtimes\node\node.exe" set "NODE_BIN=D:\DevEnv\runtimes\node\node.exe"
if not defined NODE_BIN if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_BIN if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_BIN if exist "D:\nodejs\node.exe" set "NODE_BIN=D:\nodejs\node.exe"
if not defined NODE_BIN for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_BIN set "NODE_BIN=%%i"

if not defined NODE_BIN (
  >> "%LOGDIR%\log-prune.log" echo [%DATE% %TIME%] FAIL no node interpreter found ^(tried IHUI_NODE_BIN, D:\DevEnv\runtimes\node22-lts, D:\DevEnv\runtimes\node, Program Files\nodejs, D:\nodejs, PATH^)
  endlocal
  exit /b 3
)

"%NODE_BIN%" "%~dp0prune-rotated-nssm-logs.mjs" --keep 72 --apply >> "%LOGDIR%\log-prune.log" 2>&1
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" >> "%LOGDIR%\log-prune.log" echo [%DATE% %TIME%] FAIL pruner exit=%RC% ^(node=%NODE_BIN%^)
endlocal & exit /b %RC%
