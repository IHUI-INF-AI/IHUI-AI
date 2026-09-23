@echo off
rem IHUI-AI local full-stack launcher. ZERO WINDOWS BY STRUCTURE.
rem Preferred path: start the IHUI-DevStack scheduled task. It is registered with
rem LogonType S4U, so it runs in session 0, which has no desktop - no process in
rem that tree (not tsx, not uvicorn, not pnpm internals) can put a window on your
rem screen, regardless of how it spawns. Registered by: pnpm dev:stack:autostart
rem Fallback path (task absent): hidden local dispatch through
rem scripts\dev-stack-launch.mjs into scripts\dev-stack.mjs, which health-checks
rem the stack and starts only what is missing, in dependency order. Idempotent:
rem if the supervisor already holds the stack up, double-clicking changes nothing.
rem Stop all: pnpm dev:safe:stop    Health check: pnpm dev:stack:check
rem Keep this file plain ASCII with no quotes and no shell-looking text inside
rem comments: cmd.exe decodes .bat through the ANSI codepage and mis-parses both.
setlocal

set "ROOT=%~dp0"
set "ROOTC=%ROOT:~0,-1%"
set "LOGDIR=%ROOT%.tmp-sync"

rem PATH may expose an npm .cmd shim before the real binary, which spawn cannot exec.
set "NODEEXE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODEEXE if /i "%%~xi"==".exe" set "NODEEXE=%%i"
if not defined NODEEXE (
  echo [start-all] node.exe not found in PATH - cannot launch the stack.
  exit /b 1
)

rem The cwd argument must not keep its trailing backslash: a quoted trailing
rem backslash escapes the closing quote and shifts every later argument.
set "TASK=IHUI-DevStack"
schtasks /Query /TN "%TASK%" >nul 2>&1
if errorlevel 1 goto :fallback
rem Headless path: start the S4U supervisor task. It runs in session 0, which has
rem no desktop, so nothing in its process tree can create a window on your screen.
rem Task Scheduler ignores a second start while it is already running.
schtasks /Run /TN "%TASK%" >nul 2>&1
if errorlevel 1 (
  echo [start-all] could not start task %TASK% - run: pnpm dev:stack:autostart
  exit /b 1
)
echo [start-all] supervisor task %TASK% signalled; health check runs in session 0, no windows.
goto :report

:fallback
rem Task not installed on this machine yet - fall back to a local hidden dispatch.
"%NODEEXE%" "%ROOT%scripts\dev-stack-launch.mjs" startall "%LOGDIR%" "%ROOTC%" "%NODEEXE%" "%ROOT%scripts\dev-stack.mjs"
if errorlevel 1 (
  echo [start-all] handoff failed - see "%LOGDIR%\dev-stack-startall.err.log"
  exit /b 1
)
echo [start-all] task %TASK% missing, used local dispatch. Make it headless: pnpm dev:stack:autostart
goto :report

:report
echo [start-all] web http://localhost:8801  api http://localhost:8802/health  ai-service http://localhost:8803/health
echo [start-all] logs %LOGDIR%\dev-stack-watcher.log   stop: pnpm dev:safe:stop   check: pnpm dev:stack:check
endlocal
exit /b 0
