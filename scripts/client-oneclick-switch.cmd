@echo off
rem Multi-client one-click account switch (desktop double-click entry, 2026-11-05).
rem Asks which client, lists that client's pool accounts, switches after explicit confirm.
rem All Chinese output comes from scripts/client-oneclick-switch.mjs and the scripts it
rem delegates to; this shell stays ASCII-only (cmd decodes via the OEM codepage).
rem Pool read goes through apps/api/scripts/relay-pool-account-list.ts; the write-back goes
rem through scripts/switch-client-account.mjs. This file decides nothing.
chcp 65001 >nul
cd /d "%~dp0.."
node scripts/client-oneclick-switch.mjs
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
