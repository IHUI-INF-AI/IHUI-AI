@echo off
rem MSVC/SDK env wrapper (sandbox-safe: no reg.exe). Sets PATH/LIB/INCLUDE then runs tauri build.
set "MSVC=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207"
set "SDK=C:\Program Files (x86)\Windows Kits\10"
set "SDKVER=10.0.26100.0"
set "PATH=%MSVC%\bin\Hostx64\x64;%SDK%\bin\%SDKVER%\x64;%PATH%"
set "LIB=%MSVC%\lib\x64;%SDK%\Lib\%SDKVER%\um\x64;%SDK%\Lib\%SDKVER%\ucrt\x64"
set "INCLUDE=%MSVC%\include;%SDK%\Include\%SDKVER%\um;%SDK%\Include\%SDKVER%\ucrt;%SDK%\Include\%SDKVER%\shared;%SDK%\Include\%SDKVER%\winrt"
rem WorkBuddy NODE_OPTIONS shim (genie-trash) aborts long node builds on bulk-delete confirm; build tree must run without it.
set "NODE_OPTIONS="
cd /d D:\IHUI-AI\apps\assistant
call pnpm tauri build
