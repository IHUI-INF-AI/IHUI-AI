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
rem 2026-11-07 DBG-83 收口: node 发现机制。原硬编码 "D:\DevEnv\runtimes\node\node.exe" 在
rem G: 检出上即便 :10 的 root 推导正确,node 路径仍是死盘符 ⇒ 直接启动失败(与 :7-9 声明的
rem 「不写死盘符」自相矛盾)。发现序: ①本机已知固定位(在位则用,本机行为零变化) ②PATH 上
rem 的 node(where 取首个命中) ③都拿不到则明确报错退出,绝不静默。
set "NODE_EXE="
if exist "D:\DevEnv\runtimes\node\node.exe" set "NODE_EXE=D:\DevEnv\runtimes\node\node.exe"
if not defined NODE_EXE for /f "delims=" %%N in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%N"
)
if not defined NODE_EXE (
    echo [ERROR] node.exe not found: neither D:\DevEnv\runtimes\node\node.exe nor on PATH. 1>&2
    exit /b 1
)
"%NODE_EXE%" "%IHUI_ROOT%\deploy\cdn-server.js" --root "%IHUI_ROOT%\deploy\server-root" --http-port 80