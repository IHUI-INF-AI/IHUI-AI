# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

# 本机生产 ai-service 启动器（8803）。由 ensure-prod-stack.ps1 在缺位时调用。
#
# 为什么单独一份：这个网关是所有 LLM 能力的单点——问数、对话、改写都走它。
# 它不在栈里时，这些功能不会报错，只会静默回落，看起来像「功能没做」。
# 这里用它与 apps/ai-service 自己的 .env 启动，只监听环回地址。

$ErrorActionPreference = 'Stop'
$Root = 'C:\IHUI-AI'
$AiDir = Join-Path $Root 'apps\ai-service'
$Python = Join-Path $AiDir '.venv\Scripts\python.exe'
$LogDir = Join-Path $Root 'logs'
$Port = 8803

if (-not (Test-Path -LiteralPath $Python)) {
    throw "run-ai-prod.ps1: sidecar Python 未找到：$Python"
}
if (-not (Test-Path -LiteralPath (Join-Path $AiDir 'app\main.py'))) {
    throw "run-ai-prod.ps1: 找不到 app/main.py：$AiDir"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    exit 0
}

$out = Join-Path $LogDir 'ai-prod.out.log'
$err = Join-Path $LogDir 'ai-prod.err.log'
Start-Process -FilePath $Python -ArgumentList @(
    '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$Port"
) -WorkingDirectory $AiDir -WindowStyle Hidden `
  -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null

for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 2
    try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
        if ($status.status -eq 'ok') { exit 0 }
    } catch {
        # 还在加载依赖，继续等；40 轮约 80 秒，超过就交给看门狗下一轮。
    }
}
exit 1
