# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI-SERVICE wrapper — 由 Windows 服务 "IHUI-AI-SERVICE" 调用(NSSM 托管)
# 以当前开发环境相同的方式启动 AI Service(uvicorn)
# 日志: D:\DevEnv\logs\svc-ai-nssm.log / svc-ai-nssm-err.log(NSSM 捕获)
# =============================================================================

# ⚠️⚠️ 单 worker 契约(签到风控第五件套,2026-10-16 钉死,改前必读)⚠️⚠️
# 下方 uvicorn 严禁加 --workers / --reload 等多进程形态:
# 签到出站节流闸门(checkin_outbound.py 的 OutboundGate 单例)与每日调度器
# (APScheduler 单例)都是**进程级**状态 —— 全局随机间隔、429/挑战页全局暂停、
# 每日 job 都只在单进程内成立。多 worker 下每个 worker 各持一套闸门、各跑
# 一份每日 job:"全局节流"静默退化成各 worker 各自为政,同平台多账号并发
# 请求直接打穿风控(封号面自杀)。要扩并发必须先把闸门改为跨进程共享
# (Redis/DB)实现,并连同本注释一起改;在那之前,单 worker 是硬约束。
# 另:本文件有两份落点(入库源 deploy\scripts\prod-bundle\svc 与生产实际执行的
# deploy\prod-bundle\svc),改动须同步两份,勿只改一份。

# 仓库根不再写死(2026-10-12):把仓库路径写死进生产启动脚本,换机/换根后 NSSM 起的服务
# 会指向错误目录、跑错代码。唯一解析实现在 deploy\win\ihui-root-common.ps1;本脚本有两份
# 落点(入库源 deploy\scripts\prod-bundle\svc 与生产实际执行的 deploy\prod-bundle\svc,
# 相差 1 级),写死相对深度必有一份算错 ⇒ 自 $PSScriptRoot 逐级向上找 helper,找不到当场
# throw —— 这是生产启动路径,宁可大声失败也不带着错根继续。
$ihuiRootCommon = $null
$ihuiProbe = $PSScriptRoot
for ($ihuiUp = 0; $ihuiUp -le 12; $ihuiUp++) {
    $ihuiCandidate = Join-Path $ihuiProbe 'deploy\win\ihui-root-common.ps1'
    if (Test-Path -LiteralPath $ihuiCandidate) { $ihuiRootCommon = $ihuiCandidate; break }
    $ihuiParent = Split-Path -Path $ihuiProbe -Parent
    if ([string]::IsNullOrEmpty($ihuiParent) -or $ihuiParent -eq $ihuiProbe) { break }
    $ihuiProbe = $ihuiParent
}
if (-not $ihuiRootCommon) {
    throw "run-ai.ps1: 自 $PSScriptRoot 向上未找到 deploy\win\ihui-root-common.ps1 —— 解析不出仓库根,拒绝启动服务"
}
. $ihuiRootCommon
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot

Set-Location (Join-Path $Root 'apps\ai-service')
# Playwright 浏览器共享路径(2026-09-04):服务以 SYSTEM 账户运行,默认会在
# systemprofile 的 AppData 下找浏览器导致 Chromium 启动失败;改为指向机器共享安装目录。
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\DevEnv\tools\ms-playwright"
# faster-whisper 本地模型目录(2026-10-15):与上面 Playwright 同一个坑 —— 服务以 SYSTEM
# 账户运行,其 HOME 是 systemprofile,`~/.cache/huggingface` 对服务进程**不可达**;再加
# 本机到 huggingface.co 直连不通 ⇒ 旧逻辑每次请求都加载失败,被兜成 stub=true 的假文本
# (表现:能录音、能返回,但内容永远是错的)。改成指向机器级共享的预置模型目录,离线加载。
# 目录缺失时 app/routers/voice_stt.py 会**显式报错**而不是静默回退假文本 —— 配了就必须生效。
$env:WHISPER_MODEL_DIR = "D:\DevEnv\models\faster-whisper-small"
& "$(Join-Path $Root 'apps\ai-service\.venv\Scripts\python.exe')" -m uvicorn app.main:app --host 127.0.0.1 --port 8803
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
