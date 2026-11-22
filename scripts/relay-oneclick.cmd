@echo off
rem WorkBuddy one-click account switch (desktop double-click entry).
rem No args  -> prune stale snapshots -> sync pool accounts into snapshot dir -> close client -> pick account -> switch auth + swap sessions -> relaunch.
rem With args -> passthrough to relay:switch-oneclick (e.g. --to <snapshot> for a dry run).
rem All Chinese output comes from relay-account-switch.ts; this shell stays ASCII-only.
rem Pool sync failure never blocks switching (offline pool degrades to local snapshots).
rem Snapshot prune is non-blocking: each run keeps only the latest snapshot per accountId, moving superseded ones into .pruned/ (recoverable); it never aborts switching.
chcp 65001 >nul
cd /d "%~dp0.."
if "%~1"=="" (
  call pnpm relay:pool-snapshot-sync --apply
  call pnpm relay:snapshot-prune --apply
  call pnpm relay:switch-oneclick --apply --close-client --restart-client
) else (
  call pnpm relay:switch-oneclick %*
)
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
