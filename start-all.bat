@echo off
rem IHUI-AI local full-stack launcher. SILENT BY DESIGN.
rem Hands off to scripts\dev-stack-launch.mjs, which spawns dev-stack.mjs
rem detached with windowsHide, so no service console window is ever created.
rem dev-stack.mjs with no flags health-checks the stack and starts only what is
rem missing, in dependency order, so this file is idempotent: if the login
rem autostart watcher already holds the stack up, double-clicking changes nothing.
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
"%NODEEXE%" "%ROOT%scripts\dev-stack-launch.mjs" startall "%LOGDIR%" "%ROOTC%" "%NODEEXE%" "%ROOT%scripts\dev-stack.mjs"
if errorlevel 1 (
  echo [start-all] handoff failed - see "%LOGDIR%\dev-stack-startall.err.log"
  exit /b 1
)

echo [start-all] health-check dispatched in background; no windows by design.
echo [start-all] web http://localhost:8801  api http://localhost:8802/health  ai-service http://localhost:8803/health
echo [start-all] logs %LOGDIR%\dev-stack-startall.log   stop: pnpm dev:safe:stop
endlocal
exit /b 0
