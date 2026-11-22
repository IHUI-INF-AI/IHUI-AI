@echo off
REM © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
REM Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
REM [IHUI-AI-PROVENANCE]:
setlocal
chcp 65001 >nul
set "HERE=%~dp0"
set "PS1=%HERE%install-relay-shortcut.ps1"

echo ==================================================
echo   智汇AI · 一键安装「AI 客户端一键切号」
echo ==================================================
echo.

if not exist "%PS1%" (
  echo [错误] 找不到安装器: %PS1%
  echo        本文件必须与 install-relay-shortcut.ps1 同目录 ^(仓库 scripts\^)。
  echo.
  pause
  exit /b 2
)

set "SH="
where pwsh >nul 2>nul && set "SH=pwsh"
if not defined SH (
  echo [错误] 未找到 PowerShell 7 ^(pwsh^)。
  echo        安装: winget install --id Microsoft.PowerShell -e
  echo        或从 https://aka.ms/powershell 下载后重试。
  echo.
  pause
  exit /b 2
)

echo 正在创建桌面快捷方式...
"%SH%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [完成] 桌面已生成「AI 客户端一键切号」,双击即可使用。
) else (
  echo [失败] 安装器退出码 = %RC%,请查看上方错误信息。
)
echo.
pause
exit /b %RC%
