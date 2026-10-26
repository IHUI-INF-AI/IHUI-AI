# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
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
#   pwsh -File scripts/build-next-prod.ps1 [-RestartService] [-CleanCache]
#   -RestartService  构建成功后原子换入 .next 并重启 IHUI-WEB(停机=秒级目录交换)
#   (不加时只构建到 .next-staging,**线上 .next 全程不动**,服务零影响)
# =============================================================================

param(
    [switch]$RestartService,
    [switch]$CleanCache,
    # 内部重入标记:外层用 `deploy-lock run` 拿锁后以本开关再调自己(用户不要手传)。
    [switch]$UnderLock
)

$ErrorActionPreference = "Stop"

# ----------------------------- 配置 ---------------------------------
# Node 22 路径解析(2026-09-18 修复):WorkBuddy 管理版目录名可能带构建后缀
# (22.22.2-3),旧脚本写死 22.22.2 导致生产 FATAL"Node 22.22.2 未找到"。
# 按候选顺序取第一个存在的 node.exe。
$Node22Candidates = @(
    "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-3\node.exe",
    "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe",
    "D:\DevEnv\runtimes\node22\node.exe",
    # 2026-10-25:本机实际在位的 Node 22 是 node22-lts(前三条候选在本机全部不存在,
    # 构建脚本因此 FATAL「Node 22 未找到」,生产 web 无法重建;该 exe 实测可正常跑
    # next build,SWC 不再 STATUS_STACK_BUFFER_OVERRUN)。
    "D:\DevEnv\runtimes\node22-lts\node.exe"
)
$Node22 = $Node22Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Node22) {
    Write-Host "[FATAL] Node 22 未找到(候选: $($Node22Candidates -join '; '))" -ForegroundColor Red
    exit 1
}
$Node22Dir     = Split-Path $Node22 -Parent
$PnpmGlobal    = "D:\DevEnv\tools\npm-global"
# 根目录一律由脚本自身位置推导(AGENTS.md 首部迁移修正:旧盘符写死是事故源)。
# 本机实测:仓库在 G:\IHUI-AI 而旧值写死 旧盘符根目录(该路径不存在),生产构建入口因此不可用;
# 生产机的 checkout 在 D 盘时,同一份推导逻辑自然解析到 D 盘 —— 两端都不必各留一份副本。
$ProjectRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$WebDir        = Join-Path $ProjectRoot 'apps/web'
$LogDir        = Join-Path $ProjectRoot '.ihui-agent/tmp/next-build-node22/logs'
# .next 备份落工作区外(既防 Tailwind 扫描污染,也不写 C 盘 —— §26 开发工具缓存一律指向 D 盘,
# 本机 TEMP 由用户环境变量指向 D:\DevEnv\Temp;§26 旧表写的 D:\caches\Temp 本机不存在,已更正)
$Timestamp     = Get-Date -Format "yyyyMMdd-HHmmss"
$BuildLog      = Join-Path $LogDir "next-build-node22-$Timestamp.log"
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

if (-not $Node22) {
    Write-Host "[FATAL] Node 22 未找到(候选: $($Node22Candidates -join '; '))" -ForegroundColor Red
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

# ----------------------------- [0/6] 部署锁(整段覆盖) -----------------------------
# 2026-10-25 治"锁账面有、实际没挡住":旧写法在 [0/6] 用子进程 acquire、在 [7/6] 再开一个
# 子进程 release —— 两个都不是锁主人(ownerPid=本 pwsh),release 因"owner 仍存活"必被拒
# (实测),锁只能等 stale 被下一位抢占,期间部署环空转。
# 正解是 `deploy-lock run`(拿锁+跑命令+交还全在同一进程,命令退出即交还)—— 本脚本自举重入,
# 让**整段构建 + 原子换入**都在同一把锁内。
if (-not $UnderLock) {
    Write-Host "[0/6] 获取部署锁并托管本脚本(deploy-lock run)" -ForegroundColor Yellow
    $inner = @('-UnderLock')
    if ($RestartService) { $inner += '-RestartService' }
    if ($CleanCache) { $inner += '-CleanCache' }
    $pwshExe = (Get-Process -Id $PID).Path
    & $Node22 "$ProjectRoot\scripts\deploy-lock.mjs" run --mode build --timeout 600000 --stale 600000 -- $pwshExe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @inner
    exit $LASTEXITCODE
}
Write-Host "[0/6] 已在部署锁内(deploy-lock run 托管)" -ForegroundColor DarkGray

# 切换到 web 目录
Set-Location $WebDir

# 2026-10-25 根治"构建期间线上 500"(实测事故):旧流程先删 apps/web/.next 再就地构建,
# 而 `next start` 正在服务这棵目录 ⇒ 整个构建期(~9 分钟)静态资源 404、动态页 500。
# next.config.ts 已支持 IHUI_BUILD_DIST(部署环零停机交换用的同一机制),本脚本改为
# 构建到 `.next-staging` —— 构建全程不碰线上 `.next`;只有成功且带 -RestartService 时
# 才做"停服务 → 原子换入 → 起服务"(秒级停机)。
$StagingRel = '.next-staging'
$StagingDir = Join-Path $WebDir $StagingRel
$env:IHUI_BUILD_DIST = $StagingRel

# ----------------------------- [1/6] 准备 staging 目录 -----------------------------
Write-Host "[1/6] 准备 staging 构建目录" -ForegroundColor Yellow
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue }
Write-Host "  线上 .next 保持不动(构建期间服务只读旧产物)"
Write-Host "  staging   : $StagingRel"

# ----------------------------- [2/6] 清理旧缓存(可选) -----------------------------
Write-Host "[2/6] 清理旧缓存" -ForegroundColor Yellow
# 不再清理 .next(线上产物);staging 已在上一格整清。node_modules\.cache 与
# *.tsbuildinfo 是 webpack filesystem 持久缓存,命中后构建从 ~10 分钟降到 ~4 分钟;
# 只有 -CleanCache 档才强制清(缓存损坏时用)。
if ($CleanCache) {
    Write-Host "  -CleanCache: 强制清理 node_modules\.cache + *.tsbuildinfo" -ForegroundColor Yellow
    if (Test-Path "node_modules\.cache") { Remove-Item "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue }
    Get-ChildItem -Filter "*.tsbuildinfo" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}
Write-Host "  清理完成(线上产物未触碰)"

# ----------------------------- [2b/6] 重建工作区依赖 dist -----------------------------
# 手动路径不走 turbo 依赖图,而 web 的 next build 直接读 `@ihui/types` 等包的 **dist**。
# 上游刚新增导出时,陈旧 dist 会让类型检查假红(2026-10-25 实测:`packages/types/src` 已有
# `ChatSyncMessageSnapshot`、dist 没有 ⇒ TS2305,构建失败)。这里用 turbo 的**依赖过滤**
# 重建(不手抄部署脚本那串包名,避免第二份清单漂移):`@ihui/web^...` = web 的全部依赖。
Write-Host "[2b/6] 重建工作区依赖 dist(turbo: @ihui/web^...)" -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    # 用 **pnpm 自己的依赖过滤**直接递归跑(已实测集合 = 9 个依赖包,不含 @ihui/web):
    #   · 不能用 `pnpm turbo build --filter=...`:--filter 先被 pnpm 消费,选中 web 自身 ⇒
    #     turbo 在 web 包里再跑 build,而 web 的 build 脚本自己 `deploy-lock run` ⇒
    #     与外层持锁死等(2026-10-25 实测两轮卡死 5 分钟零产物)。
    #   · 不自抄包名清单(部署环那一串是第二份清单,新增依赖必然漂)。
    #   · --if-present:eslint-config/tsconfig 这类没有 build 脚本的包直接跳过。
    & (Join-Path $PnpmGlobal 'pnpm.cmd') --filter "@ihui/web^..." run --if-present build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAILED] 依赖 dist 重建失败(exit $LASTEXITCODE)⇒ 不构建,线上不受影响" -ForegroundColor Red
        Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
} finally {
    Pop-Location
}

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

    # staging 构建失败:删掉半成品即可 —— 线上 .next 全程未被触碰,服务继续用旧产物。
    Write-Host ""
    Write-Host "  清理 staging(线上 .next 未受影响)" -ForegroundColor Yellow
    Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
    exit $buildExit
}

# ----------------------------- [5/6] 验证产物 -----------------------------
Write-Host "[5/6] 验证构建产物" -ForegroundColor Yellow

if (-not (Test-Path "$StagingRel\BUILD_ID")) {
    Write-Host "[FAILED] BUILD_ID 不存在,产物不完整" -ForegroundColor Red
    Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
$newBuildId = Get-Content "$StagingRel\BUILD_ID"
$size = [math]::Round((Get-ChildItem $StagingRel -Recurse -ErrorAction SilentlyContinue |
    Measure-Object Length -Sum).Sum / 1GB, 2)
Write-Host "  BUILD_ID  : $newBuildId"
Write-Host "  产物大小  : $size GB"

# 检查 rewrites 是否已编译进产物(生产模式必需,代理 /api/* → 8802/8803)
# 2026-08-05 修复:rewrites 是对象{beforeFiles,afterFiles,fallback},
# $routes.rewrites.Count 对对象统计返回错误值(误报"1条")。改为统计 afterFiles 数组。
$routesManifest = "$StagingRel\routes-manifest.json"
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
if (Test-Path "$StagingRel\server") {
    $serverSize = [math]::Round((Get-ChildItem "$StagingRel\server" -Recurse |
        Measure-Object Length -Sum).Sum / 1MB, 1)
    Write-Host "  server    : OK ($serverSize MB)"
} else {
    Write-Host "  [FAILED] $StagingRel\server 不存在,next start 无法运行" -ForegroundColor Red
    Remove-Item $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# 检查 static 产物(前端资源)
if (Test-Path "$StagingRel\static") {
    $staticSize = [math]::Round((Get-ChildItem "$StagingRel\static" -Recurse |
        Measure-Object Length -Sum).Sum / 1MB, 1)
    Write-Host "  static    : OK ($staticSize MB)"
} else {
    Write-Host "  [WARN] $StagingRel\static 不存在,前端资源缺失" -ForegroundColor DarkYellow
}

# next build 在 IHUI_BUILD_DIST 覆盖 distDir 时会改写被跟踪的 apps/web/next-env.d.ts
# (引用 `.next-staging/types/...`)。**不论是否换入**,构建一结束就还原为提交版 ——
# 否则 staging 被清掉后引用残留 = 源码树污染(门 check-next-env-dist 判红)。
try {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) { & git -C $ProjectRoot checkout -- apps/web/next-env.d.ts 2>$null }
} catch {}

# ----------------------------- [6/6] 完成 / 重启服务 -----------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  构建成功!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  BUILD_ID  : $newBuildId"
Write-Host "  总耗时    : $($buildDuration.ToString('hh\时mm\分ss\秒'))"
Write-Host "  日志      : $BuildLog"
Write-Host ""

# staging 构建不再产生备份:线上 .next 在构建期间从未被删,失败只需丢掉 staging。

$webSvc = Get-Service IHUI-WEB -ErrorAction SilentlyContinue
$webRunning = $webSvc -and $webSvc.Status -eq 'Running'
# 线上服务在跑 ⇒ 必须显式 -RestartService 才换入(交换要停服务);服务没跑 ⇒ 直接换入。
$doSwap = $RestartService -or (-not $webRunning)
if ($doSwap) {
    Write-Host "[6/6] 原子换入 staging → 线上 .next$(if ($RestartService) { ' 并重启 IHUI-WEB' })" -ForegroundColor Yellow
    if ($webRunning) {
        Write-Host "  停止 IHUI-WEB(停机窗口 = 交换耗时,秒级)..."
        Stop-Service IHUI-WEB -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    $liveNext = Join-Path $WebDir '.next'
    $rollbackNext = Join-Path $WebDir '.next-rollback'
    $swapOk = $false
    try {
        if (Test-Path $rollbackNext) { Remove-Item $rollbackNext -Recurse -Force -ErrorAction Stop }
        if (Test-Path $liveNext) { Move-Item -LiteralPath $liveNext -Destination $rollbackNext -ErrorAction Stop }
        Move-Item -LiteralPath $StagingDir -Destination $liveNext -ErrorAction Stop
        if (-not (Test-Path (Join-Path $liveNext 'BUILD_ID'))) { throw "换入后 BUILD_ID 不在位" }
        $swapOk = $true
    } catch {
        Write-Host "  [FAILED] 目录交换失败:$($_.Exception.Message)" -ForegroundColor Red
        if (-not (Test-Path $liveNext) -and (Test-Path $rollbackNext)) {
            Move-Item -LiteralPath $rollbackNext -Destination $liveNext -ErrorAction SilentlyContinue
        }
        if ($webRunning) { Start-Service IHUI-WEB -ErrorAction SilentlyContinue }
        exit 1
    }
    Write-Host "  已换入:$newBuildId(旧产物保留在 .next-rollback)"
    if ($webRunning) {
        Start-Service IHUI-WEB
        Start-Sleep -Seconds 5
    }


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
    Write-Host "产物已就绪但**未换入**:IHUI-WEB 正在运行,换入需要秒级停机。" -ForegroundColor DarkGray
    Write-Host "  staging : $StagingDir" -ForegroundColor DarkGray
    Write-Host "  线上 .next 全程未被触碰,服务仍用旧产物。" -ForegroundColor DarkGray
    Write-Host "  应用方式(二选一):" -ForegroundColor DarkGray
    Write-Host "    a) 重跑本脚本加 -RestartService(会重新构建并原子换入)" -ForegroundColor DarkGray
    Write-Host "    b) 手工交换(停机 = 秒级):" -ForegroundColor DarkGray
    Write-Host "       Stop-Service IHUI-WEB -Force" -ForegroundColor DarkGray
    Write-Host "       Remove-Item '$WebDir\.next-rollback' -Recurse -Force -ErrorAction SilentlyContinue" -ForegroundColor DarkGray
    Write-Host "       Move-Item '$WebDir\.next' '$WebDir\.next-rollback'" -ForegroundColor DarkGray
    Write-Host "       Move-Item '$StagingDir' '$WebDir\.next'" -ForegroundColor DarkGray
    Write-Host "       Start-Service IHUI-WEB" -ForegroundColor DarkGray
}

Write-Host ""
# 锁由外层 `deploy-lock run` 在本进程(内层)退出时交还,无需手工 release。
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
