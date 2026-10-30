@echo off
rem WorkBuddy one-click account switch (desktop double-click entry).
rem No args  -> close client -> pick account -> switch auth + swap sessions -> relaunch.
rem With args -> passthrough to relay:switch-oneclick (e.g. --to <snapshot> for a dry run).
rem All Chinese output comes from relay-account-switch.ts; this shell stays ASCII-only.
chcp 65001 >nul
cd /d "%~dp0.."
if "%~1"=="" (
  call pnpm relay:switch-oneclick --apply --close-client --restart-client
) else (
  call pnpm relay:switch-oneclick %*
)
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
