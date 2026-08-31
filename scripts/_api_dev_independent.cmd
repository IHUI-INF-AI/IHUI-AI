@echo off
set PATH=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2;C:\Users\Administrator\AppData\Roaming\npm;%PATH%
cd /d G:\IHUI-AI\apps\api
pnpm --filter @ihui/api dev
