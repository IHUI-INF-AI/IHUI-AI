@echo off
chcp 65001 > nul
del /F /Q "g:\IHUI-AI\client\src\locales\modules\zh-TW\wechat首頁.json"
del /F /Q "g:\IHUI-AI\client\src\locales\modules\ja\wechatホーム.json"
del /F /Q "g:\IHUI-AI\client\src\locales\modules\ko\wechat홈.json"
del /F /Q "g:\IHUI-AI\client\src\locales\modules\ko\핵심 장점.json"
echo CLEANUP_DONE
