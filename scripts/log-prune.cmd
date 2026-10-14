@echo off
REM log-prune.cmd - daily rotated-log retention (RETENTION: keep 72 per stream).
REM Measured 2026-10-02: api rotates ~7 copies/day, so 72 copies ~= 10 days
REM of on-disk fallback; Loki already retains 30 days (720h) as the query face.
REM Redirection lives here because WshShell.Run cannot express it reliably.
REM ASCII only. Registered via wscript.exe (see log-prune-hidden.vbs).
REM 2026-10-14 fix: the old node + repo paths hardcoded D:\ (D:\DevEnv\runtimes
REM and D:\IHUI-AI) which no longer exist after the D:->G: migration, so the task
REM silently failed. Node now uses the standard install; the script is resolved
REM relative to this .cmd (%~dp0) so the repo may live on any drive.
"C:\Program Files\nodejs\node.exe" "%~dp0prune-rotated-nssm-logs.mjs" --keep 72 --apply >> "D:\DevEnv\logs\log-prune.log" 2>&1
