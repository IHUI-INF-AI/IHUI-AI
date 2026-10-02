@echo off
rem vcvars 替代：沙箱禁 reg.exe，手动设 MSVC + Windows SDK 环境后跑 cargo check
set "MSVC=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
set "SDK=C:\Program Files (x86)\Windows Kits\10"
set "SDKVER=10.0.26100.0"
set "PATH=%MSVC%\bin\Hostx64\x64;%SDK%\bin\%SDKVER%\x64;%PATH%"
set "LIB=%MSVC%\lib\x64;%SDK%\Lib\%SDKVER%\um\x64;%SDK%\Lib\%SDKVER%\ucrt\x64"
set "INCLUDE=%MSVC%\include;%SDK%\Include\%SDKVER%\um;%SDK%\Include\%SDKVER%\ucrt;%SDK%\Include\%SDKVER%\shared;%SDK%\Include\%SDKVER%\winrt"
cd /d D:\IHUI-AI\apps\assistant
node scripts\prepare-dev.mjs
cd /d D:\IHUI-AI\apps\assistant\src-tauri
cargo check
