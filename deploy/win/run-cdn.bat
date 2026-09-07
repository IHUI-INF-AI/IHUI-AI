@echo off
rem IHUI-ImageCDN boot launcher - run by Scheduled Task at system startup (SYSTEM)
"D:\DevEnv\runtimes\node\node.exe" "D:\IHUI-AI\deploy\cdn-server.js" --root "D:\IHUI-AI\deploy\server-root" --http-port 80