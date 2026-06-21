@echo off
cd /d "G:\officialsite\miniapp"
"C:\Program Files (x86)\Tencent\微信web开发者工具\node.exe" "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.js" upload --project "G:\officialsite\miniapp\dist\build\mp-weixin" --version "1.0.0" --desc "首次上传"
pause
