@echo off
rem IHUI-ImageCDN boot launcher - run by Scheduled Task at system startup (SYSTEM)
rem STATUS 2026-09-29: the scheduled task IHUI-ImageCDN is DISABLED on this box. Port 80 is owned
rem by the nssm service IHUI-IMAGE-CDN (see deploy\win\install-image-cdn-service.ps1), because this
rem one-shot launcher has no supervisor - if the node process dies, nothing restarts it until boot.
rem Kept as a manual escape hatch only; running it while the service is up just hits EADDRINUSE.
rem Root is derived from this script's own location (deploy\win -> repo root); no hardcoded drive
rem letter: the same checkout lives at G:\IHUI-AI (dev) and D:\IHUI-AI (prod), a literal resolved
rem to two different roots. Same rule as deploy\win\ihui-root-common.ps1 (PowerShell side).
for %%I in ("%~dp0..\..") do set "IHUI_ROOT=%%~fI"
if not exist "%IHUI_ROOT%\package.json" (
    echo [ERROR] IHUI root not resolved: "%IHUI_ROOT%\package.json" not found. Refusing to run with a wrong root. 1>&2
    exit /b 1
)
rem node 跟仓库根同一盘的 DevEnv 固定位。根已由上面 %~dp0 推出,这里只取该根的盘符,
rem 不写死任何盘符。该位不在则用 PATH 上的 node(where 取首个命中)。都没有则报错退出。
set "NODE_EXE="
for %%I in ("%IHUI_ROOT%") do set "NODE_FIXED=%%~dI\DevEnv\runtimes\node\node.exe"
if exist "%NODE_FIXED%" set "NODE_EXE=%NODE_FIXED%"
if not defined NODE_EXE for /f "delims=" %%N in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%N"
)
if not defined NODE_EXE (
    echo [ERROR] node.exe not found: neither "%NODE_FIXED%" nor on PATH. 1>&2
    exit /b 1
)
"%NODE_EXE%" "%IHUI_ROOT%\deploy\cdn-server.js" --root "%IHUI_ROOT%\deploy\server-root" --http-port 80