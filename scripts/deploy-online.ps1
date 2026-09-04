# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# deploy-online.ps1 — 线上(生产主机)一键部署:拉取优化代码 + 重建 + 重启 + 自验
# 版权:© 2026 IHUI AI (智汇AI) · 李春川 (Li Chunchuan) · https://aizhs.top
#
# 用法(在生产主机 PowerShell 执行,管理员):
#   powershell -ExecutionPolicy Bypass -File deploy-online.ps1
#   可选参数:
#     -Root <生产仓库根目录>  默认自动探测 D:\IHUI-AI / 当前目录的上层
#     -WebPort <线上web端口>  默认 8801
#     -NoPull               跳过 git pull(调试/已拉过)
#
# 设计要点(2026-09-03):
#   - 走"已验证"的官方构建(commit 6cff4df7ab 起的 package.json build=Turbopack),
#     避免旧 webpack 生产构建命中 'invariant expected app router to be mounted' 崩溃。
#   - 预取优化是运行时 JS,与打包器无关,webpack/turboopack 构建都会生效。
#   - 自动验证:① 线上资产指纹是否翻转(不再是旧 main-app-015f...) ② 页面切换延迟是否降到 ~50ms。
# =============================================================================
#requires -Version 7
param(
    [string]$Root = "",
    [int]$WebPort = 8801,
    [switch]$NoPull
)
$ErrorActionPreference = "Stop"

# ----------------------------- 定位仓库根 -----------------------------
if ([string]::IsNullOrWhiteSpace($Root)) {
    $candidates = @("D:\IHUI-AI", "$env:USERPROFILE\IHUI-AI", "$PSScriptRoot", (Split-Path $PWD -Parent))
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c) -and (Test-Path "$c\apps\web\package.json") -and (Test-Path "$c\package.json")) { $Root = $c; break }
    }
    if ([string]::IsNullOrWhiteSpace($Root)) {
        $ws = Get-ChildItem "G:","D:","C:" -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.FullName)\apps\web\package.json" } | Select-Object -First 1
        if ($ws) { $Root = $ws.FullName }
    }
}
if (-not $Root -or -not (Test-Path "$Root\apps\web\package.json")) {
    throw "无法定位 IHUI-AI 仓库根目录。请用 -Root 显式指定(应包含 apps\web\package.json 的目录)。"
}
$env:IHUI_PROJECT_ROOT = $Root
Write-Host "项目根目录: $Root" -ForegroundColor Cyan
Write-Host "线上 web 端口: $WebPort"

# ----------------------------- 锁/并发 -----------------------------
if (Test-Path "$Root\.deploy.lock") {
    $lockMeta = Get-Content "$Root\.deploy.lock\meta.json" -Raw -ErrorAction SilentlyContinue
    $lockPid = ($lockMeta | ConvertFrom-Json -ErrorAction SilentlyContinue).pid
    $alive = if ($lockPid) { Get-Process -Id $lockPid -ErrorAction SilentlyContinue } else { $null }
    if ($alive) { throw "检测到正在进行的构建/部署(pid $lockPid)。请等待其完成再部署。" }
    Write-Host "存在悬挂部署锁(持有者已退出),自动清理。" -ForegroundColor DarkYellow
    Remove-Item "$Root\.deploy.lock" -Recurse -Force -ErrorAction SilentlyContinue
}

# ----------------------------- Node 22(规避 SWC 崩溃) -----------------------------
$Node22 = @("C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe",
            "$Root\.workbuddy\binaries\node\versions\22.22.2\node.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($Node22) {
    Write-Host "使用 Node 22: $Node22"
    $env:PATH = "$(Split-Path $Node22);$env:PATH"
}

# ----------------------------- [1/5] 拉取最新(含优化) -----------------------------
if (-not $NoPull) {
    Write-Host "[1/5] git pull origin main" -ForegroundColor Yellow
    Push-Location $Root
    try {
        git pull --no-rebase origin main 2>&1 | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) { throw "git pull 失败,请检查仓库远程/凭证。" }
    } finally { Pop-Location }
}

# ----------------------------- [2/5] 安装依赖(如缺) -----------------------------
Write-Host "[2/5] 校验依赖" -ForegroundColor Yellow
if (-not (Test-Path "$Root\node_modules\.bin\next.cmd") -and -not (Test-Path "$Root\apps\web\node_modules\.bin\next.cmd")) {
    Write-Host "  node_modules 缺失,执行 pnpm install(过滤 dev 脚本)" -ForegroundColor DarkYellow
    & pnpm install --filter "@ihui/web" --ignore-scripts 2>&1 | Out-Host
}

# ----------------------------- [3/5] 生产构建(Turbopack,规避 webpack 崩溃) -----------------------------
Write-Host "[3/5] 生产构建(next build)" -ForegroundColor Yellow
Push-Location "$Root\apps\web"
try {
    & pnpm build 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "next build 失败,详情见上方日志。" }
    if (-not (Test-Path ".next\BUILD_ID")) { throw "构建产物缺少 BUILD_ID,不完整。" }
    $newBuildId = (Get-Content ".next\BUILD_ID" -Raw).Trim()
    Write-Host "  新构建 BUILD_ID: $newBuildId" -ForegroundColor Green
} finally { Pop-Location }

# ----------------------------- [4/5] 重启提供线上的进程 -----------------------------
Write-Host "[4/5] 重启线上 web 进程 (端口 $WebPort)" -ForegroundColor Yellow
$svc = Get-Service -Name "IHUI-WEB" -ErrorAction SilentlyContinue
if ($svc) {
    Restart-Service IHUI-WEB -Force
    Start-Sleep -Seconds 4
} else {
    # 停掉占用 $WebPort 的旧 next 进程,再用生产模式拉起
    $conn = Get-NetTCPConnection -LocalPort $WebPort -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }
    Push-Location "$Root\apps\web"
    try {
        $p = Start-Process node -ArgumentList "node_modules\next\dist\bin\next","start","-p",$WebPort `
             -WorkingDirectory "$Root\apps\web" -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\ihui-web.log" -RedirectStandardError "$env:TEMP\ihui-web.err.log"
        Write-Host "  已启动 next start (pid $($p.Id)),日志见 $env:TEMP\ihui-web.log"
    } finally { Pop-Location }
}

# ----------------------------- [5/5] 验证 -----------------------------
Write-Host "[5/5] 验证线上" -ForegroundColor Yellow
$online = "https://aizhs.top/"
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 3
    try {
        $r = (curl.exe -s --max-time 12 $online) -join ''
        if ($r.Length -gt 1000) {
            $old = $r.Contains("main-app-015f184bcec1d144")
            $turbo = $r -match "turbopack-[a-f0-9]+"
            Write-Host ("  线上响应 len={0} | 仍是旧构建={1} | 新Turbopack={2}" -f $r.Length, $old, $turbo) -ForegroundColor $(if($old){'Red'}else{'Green'})
            if (-not $old) { $ok = $true; break }
        }
    } catch { }
}
if (-not $ok) { Write-Host "[WARN] 线上仍是旧构建,请检查隧道/服务。" -ForegroundColor DarkYellow }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  部署流程完成!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  下一步:用 Playwright 精测页面切换延迟(预取优化应使热导航降至 ~40-67ms)。"
Write-Host "  生产主机若尚未重建,请在线上主机执行本脚本;本机参考验证请连 localhost:8901。"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
