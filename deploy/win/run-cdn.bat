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
"D:\DevEnv\runtimes\node\node.exe" "%IHUI_ROOT%\deploy\cdn-server.js" --root "%IHUI_ROOT%\deploy\server-root" --http-port 80