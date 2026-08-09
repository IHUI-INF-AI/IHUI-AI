# =============================================================================
# build-with-node22.ps1
# 用途:强制使用 Node 22.22.2 执行 next build,解决 SWC NAPI 在 Node 26 上的
#       STATUS_STACK_BUFFER_OVERRUN (0xC0000409) 堆栈损坏问题。
# 背景:
#   - 2026-08-04 生产排障发现,Next.js 16.2.12 + SWC 16.2.12 在 Node 26.6.0 下
#     next build 反复崩溃(退出码 -1073740791 = 0xC0000409)。
#   - 第一次成功构建(16:09, BUILD_ID=5NtDqmPejwZ7s6Hx0flt-)用的是 Node 22.22.2。
#   - 内存充足(物理 27GB 空闲,pagefile 16GB),排除 OOM。
# 策略:改用 Node 22.22.2 绝对路径执行构建,NAPI 绑定兼容性更好。
# 用法:
#   powershell -ExecutionPolicy Bypass -File .trae-cn\tmp\next-build-node22\build-with-node22.ps1
#   可选参数:-RestartService  (构建成功后自动重启 IHUI-WEB)
# =============================================================================

param(
    [switch]$RestartService,
    [switch]$CleanCache
)

$ErrorActionPreference = "Stop"

# ----------------------------- 配置 ---------------------------------
$Node22        = "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe"
$Node22Dir     = Split-Path $Node22 -Parent
$PnpmGlobal    = "D:\DevEnv\tools\npm-global"
$WebDir        = "D:\IHUI-AI\apps\web"
$ProjectRoot   = "D:\IHUI-AI"
$LogDir        = "D:\IHUI-AI\.trae-cn\tmp\next-build-node22\logs"
$Timestamp     = Get-Date -Format "yyyyMMdd-HHmmss"
$BuildLog      = "$LogDir\next-build-node22-$Timestamp.log"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }

# 生产模式环境变量(与 run-web.ps1 保持一致)
# NEXT_PUBLIC_API_BASE_URL 必须置空:浏览器走同源 /api/* → Next.js rewrites 转发
$env:NEXT_PUBLIC_API_BASE_URL = ""
# 堆上限与 package.json build 脚本一致
$env:NODE_OPTIONS = "--max-old-space-size=8192"
# 让 node 22 优先于系统 PATH 里的 26.6.0
$env:PATH = "$Node22Dir;$PnpmGlobal;$env:PATH"

# ----------------------------- 前置检查 -----------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  next build with Node 22.22.2" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Node22)) {
    Write-Host "[FATAL] Node 22.22.2 未找到: $Node22" -ForegroundColor Red
    exit 1
}

Write-Host "Node 路径 : $Node22"
Write-Host "Node 版本 : $(& $Node22 --version)"
Write-Host "Web 目录  : $WebDir"
Write-Host "构建日志  : $BuildLog"
Write-Host "堆上限    : 8192 MB (NODE_OPTIONS=$env:NODE_OPTIONS)"
Write-Host "API base  : '$env:NEXT_PUBLIC_API_BASE_URL' (空=生产同源)"
if ($RestartService) { Write-Host "构建后    : 自动重启 IHUI-WEB" }
Write-Host ""

# ----------------------------- [0/6] 部署全局锁 -----------------------------
# 2026-08-09 根治并发部署:在任何 .next 操作(备份/清理)之前获取部署锁。
# 多个 Agent/自动化任务并行触发构建时,后到者等待超时后直接退出,避免互相破坏产物。
Write-Host "[0/6] 获取部署锁 (deploy-lock)" -ForegroundColor Yellow
& $Node22 "$ProjectRoot\scripts\deploy-lock.mjs" acquire --mode build --timeout 600000 --stale 600000 2>&1 | Tee-Object -FilePath $BuildLog
$lockExit = $LASTEXITCODE
if ($lockExit -ne 0) {
    Write-Host ""
    Write-Host "[FATAL] 无法获取部署锁(退出码 $lockExit)" -ForegroundColor Red
    Write-Host "  原因: 已有其他构建/部署在运行,或 .deploy.lock 残留"
    Write-Host "  处理: 等待其完成;若确认无构建在跑,可删除 D:\IHUI-AI\.deploy.lock 后重试"
    Write-Host "  日志: $BuildLog"
    exit $lockExit
}

# 切换到 web 目录
Set-Location $WebDir

# ----------------------------- [1/6] 备份当前 .next -----------------------------
Write-Host "[1/6] 备份当前 .next" -ForegroundColor Yellow
$backupName = $null
if (Test-Path ".next\BUILD_ID") {
    $currentBuildId = Get-Content ".next\BUILD_ID"
    # 2026-08-05 根治:备份到外部 C:\tmp(不在 apps/web 内创建 .next-bak-*),
    # 否则 Tailwind 4 扫描这些目录会内存爆炸(137GB+)导致构建失败。
    $backupName = "C:\tmp\next-backup-node22-$Timestamp"
    Write-Host "  当前 BUILD_ID: $currentBuildId"
    Write-Host "  备份为: $backupName (外部,防 Tailwind 扫描污染)"
    if (-not (Test-Path "C:\tmp")) { New-Item -ItemType Directory -Path "C:\tmp" -Force | Out-Null }
    # 2026-08-06 提速:robocopy /MT 多线程复制(4.7GB 单线程 Copy-Item 慢 3-5 倍)。
    # /NFL /NDL /NJH /NJS /NP 抑制日志刷屏;退出码 >= 8 表示复制失败。
    robocopy ".next" $backupName /E /MT:16 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) {
        Write-Host "  [WARN] robocopy 备份失败(退出码 $LASTEXITCODE),回退 Copy-Item" -ForegroundColor DarkYellow
        Remove-Item $backupName -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item ".next" $backupName -Recurse -Force
    }
} else {
    Write-Host "  当前 .next 无 BUILD_ID(不完整或不存在),跳过备份"
}

# ----------------------------- [2/6] 清理旧产物 -----------------------------
Write-Host "[2/6] 清理旧产物" -ForegroundColor Yellow
# 2026-08-05 根治:仅清 .next 旧产物(已备份到 C:\tmp)。
# 不再清理 node_modules\.cache 和 *.tsbuildinfo —— 它们是 webpack filesystem
# 持久缓存,二次构建命中后从 50 分钟降到 10-15 分钟。缓存损坏时用
# -CleanCache 参数强制清理。
# 2026-08-06 21:15 回退 webpack:保留 .next\cache 后二次 Turbopack 构建从
# 4min42s 恶化到 9min50s(页面数据收集阶段 4→9min);Turbopack 该阶段比 webpack
# 慢 6 倍(4min vs 40s)→ 回退 webpack 且 .next 全删,避免混用缓存。
if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
if ($CleanCache) {
    Write-Host "  -CleanCache: 强制清理 node_modules\.cache + *.tsbuildinfo" -ForegroundColor Yellow
    if (Test-Path "node_modules\.cache") { Remove-Item "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue }
    Get-ChildItem -Filter "*.tsbuildinfo" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}
Write-Host "  旧产物清理完成"

# ----------------------------- [3/6] prebuild (lock verify) -----------------------------
# 2026-08-09:锁已在 [0/6] 获取,这里做幂等校验——若锁丢失(被误删)则终止,
# 避免无锁状态下继续写 .next 造成并发损坏。
# deploy-lock.mjs check 语义: exit 0=无锁(异常), exit 1=有锁(正常)
Write-Host "[3/6] prebuild: lock verify" -ForegroundColor Yellow
$prebuildStart = Get-Date
& $Node22 "$ProjectRoot\scripts\deploy-lock.mjs" check 2>&1 | Tee-Object -FilePath $BuildLog
$prebuildExit = $LASTEXITCODE
$prebuildDuration = (Get-Date) - $prebuildStart

if ($prebuildExit -eq 1) {
    Write-Host "  锁持有中,继续构建"
} else {
    Write-Host ""
    Write-Host "[FAILED] prebuild 校验失败:部署锁丢失(exit=$prebuildExit),终止构建" -ForegroundColor Red
    Write-Host "  原因: .deploy.lock 被外部删除(可能与其他 Agent 冲突)"
    Write-Host "  日志: $BuildLog"
    exit 1
}
Write-Host "  prebuild 通过 ($($prebuildDuration.ToString('mm\分ss\秒')))"

# ----------------------------- [4/6] next build -----------------------------
# 2026-08-06 21:15 回退 webpack(实测结论):
# Turbopack 编译快(29s vs 3.4min),但其页面数据收集+优化阶段比 webpack 慢 6 倍
# (4min42s → 二次构建 9min50s),总时长反而更差且不稳定 → 保留 webpack(总 ~4min,
# 页面收集仅 40s,稳定可预期)。webpack 编译 3.4min 已由 12 核 + filesystem 缓存
# 优化到位。Turbopack 待 Next 修复页面收集性能后再评估。
Write-Host "[4/6] next build --webpack (Node 22.22.2)" -ForegroundColor Yellow
Write-Host "  开始时间: $(Get-Date -Format 'HH:mm:ss')"
Write-Host ""

$buildStart = Get-Date
# 追加到同一日志(prebuild 已创建)
& $Node22 node_modules/next/dist/bin/next build --webpack 2>&1 |
    Tee-Object -FilePath $BuildLog -Append
$buildExit = $LASTEXITCODE
$buildDuration = (Get-Date) - $buildStart

Write-Host ""
Write-Host "  构建耗时: $($buildDuration.ToString('hh\时mm\分ss\秒'))"
Write-Host "  退出码  : $buildExit"

if ($buildExit -ne 0) {
    Write-Host ""
    Write-Host "[FAILED] next build 失败" -ForegroundColor Red
    Write-Host "  日志: $BuildLog"
    Write-Host ""
    Write-Host "--- 错误尾部(最后 30 行)---" -ForegroundColor DarkGray
    Get-Content $BuildLog -Tail 30

    # 回滚:恢复备份(从 C:\tmp 复制回来)
    if ($backupName -and (Test-Path $backupName)) {
        Write-Host ""
        Write-Host "  回滚:恢复 $backupName → .next" -ForegroundColor Yellow
        if (Test-Path ".next") { Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue }
        Copy-Item $backupName ".next" -Recurse -Force
        Write-Host "  已恢复,服务可继续使用旧产物" -ForegroundColor Green
    }
    exit $buildExit
}

# ----------------------------- [5/6] 验证产物 -----------------------------
Write-Host "[5/6] 验证构建产物" -ForegroundColor Yellow

if (-not (Test-Path ".next\BUILD_ID")) {
    Write-Host "[FAILED] BUILD_ID 不存在,产物不完整" -ForegroundColor Red
    exit 1
}
$newBuildId = Get-Content ".next\BUILD_ID"
$size = [math]::Round((Get-ChildItem ".next" -Recurse -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum / 1GB, 2)
Write-Host "  BUILD_ID  : $newBuildId"
Write-Host "  产物大小  : $size GB"

# 检查 rewrites 是否已编译进产物(生产模式必需,代理 /api/* → 8802/8803)
# 2026-08-05 修复:rewrites 是对象{beforeFiles,afterFiles,fallback},
# $routes.rewrites.Count 对对象统计返回错误值(误报"1条")。改为统计 afterFiles 数组。
$routesManifest = ".next\routes-manifest.json"
if (Test-Path $routesManifest) {
    $routes = Get-Content $routesManifest -Raw | ConvertFrom-Json
    $rewriteCount = @($routes.rewrites.afterFiles).Count
    Write-Host "  rewrites  : $rewriteCount 条 (afterFiles)"
    if ($rewriteCount -lt 7) {
        Write-Host "  [WARN] rewrites 数量少于 7,API 代理可能不完整" -ForegroundColor DarkYellow
    } else {
        Write-Host "  rewrites  : OK (7 条 API 代理规则已编译)" -ForegroundColor Green
    }
} else {
    Write-Host "  [WARN] routes-manifest.json 不存在,无法验证 rewrites" -ForegroundColor DarkYellow
}

# 检查 server 产物(next start 必需)
if (Test-Path ".next\server") {
    $serverSize = [math]::Round((Get-ChildItem ".next\server" -Recurse |
        Measure-Object Length -Sum).Sum / 1MB, 1)
    Write-Host "  server    : OK ($serverSize MB)"
} else {
    Write-Host "  [FAILED] .next\server 不存在,next start 无法运行" -ForegroundColor Red
    exit 1
}

# 检查 static 产物(前端资源)
if (Test-Path ".next\static") {
    $staticSize = [math]::Round((Get-ChildItem ".next\static" -Recurse |
        Measure-Object Length -Sum).Sum / 1MB, 1)
    Write-Host "  static    : OK ($staticSize MB)"
} else {
    Write-Host "  [WARN] .next\static 不存在,前端资源缺失" -ForegroundColor DarkYellow
}

# ----------------------------- [6/6] 完成 / 重启服务 -----------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  构建成功!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  BUILD_ID  : $newBuildId"
Write-Host "  总耗时    : $($buildDuration.ToString('hh\时mm\分ss\秒'))"
Write-Host "  日志      : $BuildLog"
Write-Host ""

# 2026-08-05 极致优化:成功构建后清理 C:\tmp 旧备份,只保留最新 1 个(防堆积)
if (Test-Path "C:\tmp") {
    $oldBackups = Get-ChildItem "C:\tmp" -Directory -Filter "next-backup-*" |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip 1
    foreach ($ob in $oldBackups) {
        Write-Host "  清理旧备份: $($ob.Name)" -ForegroundColor DarkGray
        Remove-Item $ob.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($RestartService) {
    Write-Host "[6/6] 重启 IHUI-WEB 服务(应用新产物)" -ForegroundColor Yellow
    Restart-Service IHUI-WEB -Force
    Start-Sleep -Seconds 5

    # 验证服务起来
    $ok = $false
    for ($i = 0; $i -lt 15; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:8801/" -TimeoutSec 3 -UseBasicParsing
            Write-Host "  8801 响应: $($r.StatusCode) (length=$($r.Content.Length))" -ForegroundColor Green
            $ok = $true
            break
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if (-not $ok) {
        Write-Host "  [WARN] IHUI-WEB 未在 30 秒内响应,请检查日志" -ForegroundColor DarkYellow
        Write-Host "  D:\DevEnv\logs\svc-web-nssm.log"
    }

    # 公网验证
    try {
        $r = Invoke-WebRequest -Uri "https://aizhs.top/" -TimeoutSec 10 -UseBasicParsing
        Write-Host "  公网首页: $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] 公网访问失败: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }

    # 2026-08-05 曾重启 Cloudflared 重置连接池,解决"web 大响应 502"假象。
    # 2026-08-09 取消强制重启(根治报警):Restart-Service Cloudflared 每次制造
    #   10-30s 公网不可达窗口,直接触发监控报警;且 http2 隧道下 Cloudflare 边缘
    #   会自动重连,残留连接池问题可通过"重启后多轮验证"覆盖。
    Write-Host "  验证公网隧道(不重启 Cloudflared,避免制造不可达窗口)..." -ForegroundColor Yellow
    $tunnelOk = $false
    for ($i = 0; $i -lt 8; $i++) {
        try {
            $r2 = Invoke-WebRequest -Uri "https://aizhs.top/" -TimeoutSec 15 -UseBasicParsing
            Write-Host "  公网验证: $($r2.StatusCode)" -ForegroundColor Green
            $tunnelOk = $true
            break
        } catch {
            Start-Sleep -Seconds 5
        }
    }
    if (-not $tunnelOk) {
        Write-Host "  [WARN] 公网验证未通过,请手动检查 Cloudflared" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "如需应用新产物,重启 IHUI-WEB:" -ForegroundColor DarkGray
    Write-Host "  Restart-Service IHUI-WEB -Force" -ForegroundColor DarkGray
    Write-Host "  (run-web.ps1 会检测到 BUILD_ID 存在,跳过 build 直接 next start)" -ForegroundColor DarkGray
}

# ----------------------------- [7/6] 释放部署锁 -----------------------------
Write-Host ""
Write-Host "释放部署锁..." -ForegroundColor Yellow
& $Node22 "$ProjectRoot\scripts\deploy-lock.mjs" release --mode build 2>&1 | Tee-Object -FilePath $BuildLog

Write-Host ""
