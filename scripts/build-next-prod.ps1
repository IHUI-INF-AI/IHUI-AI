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
# 2026-08-06 提速:清理时**保留 .next\cache**(Next 构建缓存,删除整个 .next
# 会丢缓存导致每次全量编译)。产物目录(server/static/pages/BUILD_ID 等)仍删除。
if (Test-Path ".next") {
    Get-ChildItem ".next" -Exclude "cache" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
if ($CleanCache) {
    Write-Host "  -CleanCache: 强制清理 .next\cache + node_modules\.cache + *.tsbuildinfo" -ForegroundColor Yellow
    if (Test-Path ".next\cache") { Remove-Item ".next\cache" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path "node_modules\.cache") { Remove-Item "node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue }
    Get-ChildItem -Filter "*.tsbuildinfo" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}
Write-Host "  旧产物清理完成"

# ----------------------------- [3/6] prebuild (check-lock) -----------------------------
Write-Host "[3/6] prebuild: check-lock.js" -ForegroundColor Yellow
$prebuildStart = Get-Date
& $Node22 scripts/check-lock.js build 2>&1 | Tee-Object -FilePath $BuildLog
$prebuildExit = $LASTEXITCODE
$prebuildDuration = (Get-Date) - $prebuildStart

if ($prebuildExit -ne 0) {
    Write-Host ""
    Write-Host "[FAILED] prebuild (check-lock) 失败,退出码 $prebuildExit" -ForegroundColor Red
    Write-Host "  耗时: $($prebuildDuration.ToString('mm\分ss\秒'))"
    Write-Host "  日志: $BuildLog"
    exit $prebuildExit
}
Write-Host "  prebuild 通过 ($($prebuildDuration.ToString('mm\分ss\秒')))"

# ----------------------------- [4/6] next build -----------------------------
# 2026-08-06 提速:webpack(3.4min 编译)→ Turbopack(29s 编译,7 倍提速,
# 且跳过 build traces 收集)。产物验证:rewrites 7 条、client-reference-manifest 齐全、
# 798 页,next start 兼容。webpack 专属配置(afterEmit/webpackMemoryOptimizations)被
# turbopack 忽略,无副作用。
Write-Host "[4/6] next build --turbopack (Node 22.22.2)" -ForegroundColor Yellow
Write-Host "  开始时间: $(Get-Date -Format 'HH:mm:ss')"
Write-Host ""

$buildStart = Get-Date
# 追加到同一日志(prebuild 已创建)
& $Node22 node_modules/next/dist/bin/next build --turbopack 2>&1 |
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

    # 2026-08-05 根治:重启 IHUI-WEB 后 Cloudflared 隧道连接池会残留指向旧进程
    # 的连接,公网大响应(HTML 页面)会 502/超时(小响应正常,是假象)。
    # 自动重启 Cloudflared 重置连接池,消除该隐患。
    Write-Host "  重启 Cloudflared 隧道(重置连接池)..." -ForegroundColor Yellow
    try {
        Restart-Service Cloudflared -Force -ErrorAction Stop
        Start-Sleep -Seconds 10
        $tunnelOk = $false
        for ($i = 0; $i -lt 6; $i++) {
            try {
                $r2 = Invoke-WebRequest -Uri "https://aizhs.top/" -TimeoutSec 15 -UseBasicParsing
                Write-Host "  隧道重启后公网: $($r2.StatusCode)" -ForegroundColor Green
                $tunnelOk = $true
                break
            } catch {
                Start-Sleep -Seconds 5
            }
        }
        if (-not $tunnelOk) {
            Write-Host "  [WARN] 隧道重启后公网仍未恢复,请手动检查 Cloudflared" -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "  [WARN] Cloudflared 重启失败: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "如需应用新产物,重启 IHUI-WEB:" -ForegroundColor DarkGray
    Write-Host "  Restart-Service IHUI-WEB -Force" -ForegroundColor DarkGray
    Write-Host "  (run-web.ps1 会检测到 BUILD_ID 存在,跳过 build 直接 next start)" -ForegroundColor DarkGray
}

Write-Host ""
