@echo off
title RDP ????????
echo ================================
echo  IHUI-AI ???????
echo  rdp.aizhs.top -^> localhost:3389
echo ================================
echo.

REM ?? cloudflared ????
set "CF=%LOCALAPPDATA%\cloudflared.exe"
if not exist "%CF%" (
    echo [1/2] ????????? cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%CF%'"
    if errorlevel 1 (
        echo ??????????:
        echo https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
        echo ?? %LOCALAPPDATA%\cloudflared.exe ?????
        pause
        exit /b 1
    )
    echo ????
)

echo [2/2] ?? Cloudflare Zero Trust ??...
echo ???????????? Cloudflare?? Allow ???
echo.
echo ?????????????
echo ???? mstsc ???????????: localhost:3389
echo ???: Administrator    ??: (redacted)
echo.
echo ================================================
"%CF%" access tcp --hostname rdp.aizhs.top --url localhost:3389
pause
