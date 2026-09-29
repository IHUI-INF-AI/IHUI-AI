@echo off
rem IHUI-ImageCDN boot launcher - run by Scheduled Task at system startup (SYSTEM)
rem STATUS 2026-09-29: the scheduled task IHUI-ImageCDN is DISABLED on this box. Port 80 is owned
rem by the nssm service IHUI-IMAGE-CDN (see deploy\win\install-image-cdn-service.ps1), because this
rem one-shot launcher has no supervisor - if the node process dies, nothing restarts it until boot.
rem Kept as a manual escape hatch only; running it while the service is up just hits EADDRINUSE.
"D:\DevEnv\runtimes\node\node.exe" "D:\IHUI-AI\deploy\cdn-server.js" --root "D:\IHUI-AI\deploy\server-root" --http-port 80