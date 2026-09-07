# =============================================================================
# IHUI 原生 Windows 部署 + 健康门禁 + 回滚脚本
# 适用: aizhs.top 生产机(原生 Windows, NSSM 服务, Cloudflare Tunnel)
# 由本机定时任务轮询 origin/main 触发;也可手动执行。
#
# 行为(每个阶段失败即中止,不切流):
#   1. git fetch origin main + 计算本地落后提交数
#   2. 落后>0 才继续;git pull --ff-only(禁 force,不动他人未提交改动)
#   3. 备份当前 web 构建产物(.next → .rollback)
#   4. 重建 web(next build);api/ai-service 跑源码(tsx/uvicorn)无需独立构建
#   5. 重启 NSSM 服务(走非活跃逻辑,健康全过才保留)
#   6. 健康门禁:web 200 + /api/health ok + LLM 网关可达;未过则回滚
#   7. 回滚:恢复 .rollback 构建 + 重启服务
#
# 用例:
#   powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -dryrun
#   powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -deployLatest
# =============================================================================
param(
    [switch]$dryrun,          # 只 fetch + 报告差距,不部署
    [switch]$deployLatest,    # 忽略是否落后,强制部署到当前 origin/main
    [switch]$rollbackOnly,    # 仅用上次 .rollback 恢复
    [switch]$force            # 跳过健康门禁直接切流(谨慎)
)

# 全局路径与约束
$ErrorActionPreference = 'Stop'
$Root       = 'D:\IHUI-AI'
$WebDir     = "$Root\apps\web"
$ApiDir     = "$Root\apps\api"
$AiDir      = "$Root\apps\ai-service"
$BackupDir  = 'D:\DevEnv\backups\deploy'
$ActiveFile = "$Root\deploy\win\active-env"   # active-env 标记,当前恒 'win'
$PublicWeb  = 'https://aizhs.top'
$ApiHealth  = "$PublicWeb/api/health"

# ── 并发锁(2026-09-07 加固):手动 -deployLatest 与计划任务 loop 可能同时进入,
#    两者会互相 Remove-Item/.next 与 .next-staging,导致构建期 ENOENT(实测
#    _buildManifest.js.tmp.* 被对端删除)。用 PID 锁保证同一时刻仅一个部署实例。
$DeployLock = "$Root\deploy\win\.deploy.lock"
function Get-DeployLock {
    if (Test-Path $DeployLock) {
        $pidIn = (Get-Content $DeployLock -Raw -ErrorAction SilentlyContinue).Trim()
        $alive = $false
        if ($pidIn -match '^\d+$') { $alive = $null -ne (Get-Process -Id ([int]$pidIn) -ErrorAction SilentlyContinue) }
        if ($alive) {
            Write-Host "FAIL  检测到进行中的部署(pid=$pidIn),终止本次部署避免并发冲突"
            exit 2
        }
        Remove-Item $DeployLock -Force -ErrorAction SilentlyContinue   # 悬挂锁清理
    }
    Set-Content -Path $DeployLock -Value "$PID" -NoNewline
}
function Release-DeployLock {
    if ((Test-Path $DeployLock) -and ((Get-Content $DeployLock -Raw).Trim() -eq "$PID")) {
        Remove-Item $DeployLock -Force -ErrorAction SilentlyContinue
    }
}

function Log   { param([string]$m) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $m" }
function Fail  { param([string]$m) Log "FAIL  $m"; exit 1 }
function Ok    { param([string]$m) Log "OK    $m" }

function Invoke-Step { param([string]$name,[scriptblock]$body)
    Log "── $name ──"
    & $body | ForEach-Object { Write-Host "   $_" }
    return $LASTEXITCODE
}

function Test-Http {
    param([string]$url,[string]$contains='')
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 15 -ErrorAction Stop -UseBasicParsing
        if ($contains -and $r.Content -notmatch [regex]::Escape($contains)) { return $false }
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
}

function BackendLogin-Token {
    # 探测 LLM 网关需带 Bearer;用 demo admin 获取 token(仅作健康探测,不改数据)
    try {
        $b = @{ username='admin'; password='admin123' } | ConvertTo-Json
        $login = Invoke-RestMethod -Uri "$PublicWeb/api/auth/login/username" -Method Post `
                        -Body $b -ContentType 'application/json' -TimeoutSec 20 -ErrorAction Stop
        if ($login.data.accessToken) { return $login.data.accessToken }
        if ($login.token.accessToken) { return $login.token.accessToken }
        if ($login.accessToken) { return $login.accessToken }
    } catch {}
    return $null
}

function Test-LlmGateway {
    $tok = BackendLogin-Token
    if (-not $tok) { return $false }
    try {
        $r = Invoke-WebRequest -Uri "$PublicWeb/api/llm/providers/health" `
                    -Headers @{ Authorization = "Bearer $tok" } -TimeoutSec 20 -ErrorAction Stop -UseBasicParsing
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
}

# 健康门禁: web + api健康 + LLM网关
# 2026-09-07 加固:Next 冷启动需数秒，重启后立即探全部走 :8801 的端点会集体误判失败
# (api/llm 都经 web 反代/tunnel → web 未就绪即整链 FAIL)。改为带退避的多次探测,
# 前 Ups个周期内(N 次 × 间隔)任一轮全过即成功;全部耗尽才算未过 → 进回滚。
function Test-HealthGate {
    [int]$Tries  = 8
    [int]$GapSec = 12
    for ($i = 1; $i -le $Tries; $i++) {
        Start-Sleep -Seconds $GapSec
        $p1 = Test-Http -url $PublicWeb -contains '<!DOCTYPE html'
        $p2 = Test-Http -url $ApiHealth -contains '"status":"ok"'
        $p3 = Test-LlmGateway
        Log "健康门禁 第 $i/$Tries 轮: web=$p1 api=$p2 llm=$p3"
        if ($p1 -and $p2 -and $p3) { return $true }
    }
    Log "健康门禁 ${Tries} 轮均未全过,判定失败"
    return $false
}

function New-BackupDir { if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null } }

function Build-Web {
    param([string]$DistDir = 'staging', [int]$MaxTries = 4)
    Set-Location $WebDir
    if (-not (Test-Path "node_modules\.bin\next.cmd")) {
        Log "web 依赖缺失,先 pnpm install"
        & "D:\DevEnv\tools\npm-global\pnpm.cmd" install
        if ($LASTEXITCODE -ne 0) { Fail "pnpm install 失败(exit $LASTEXITCODE)" }
    }
    # 2026-09-07 可靠性加固(实测):Tailwind v4 展开成 ~271KB 单行 CSS,Next 前端 CSS
    # 管线(lightningcss,与 Turbopack/webpack 无关)偶发在此巨行上报假性
    # "Parsing CSS failed / Unexpected token Delim('\u{1a}')" 中断构建;成功可达但概率失败。
    # 对策:冷构建(每次清空 staging 缓存)+ 多轮重试,落在成功态为止。
    $env:NEXT_TELEMETRY_DISABLED = '1'
    try {
        for ($try = 1; $try -le $MaxTries; $try++) {
            Log "构建尝试 $try/$MaxTries -> .next-$DistDir"
            Remove-Item "$WebDir\.next-$DistDir" -Recurse -Force -ErrorAction SilentlyContinue
            $env:IHUI_BUILD_DIST = ".next-$DistDir"
            & "D:\DevEnv\tools\npm-global\pnpm.cmd" build
            $ok = ($LASTEXITCODE -eq 0) -and (Test-Path "$WebDir\.next-$DistDir\BUILD_ID")
            if ($ok) { Ok "next build 完成 -> .next-$DistDir"; return }
            Log "第 $try 次失败(exit=$LASTEXITCODE),清缓存重试"
        }
        throw "next build 连续 $MaxTries 次失败,保持当前在线版本"
    } finally {
        Remove-Item Env:\IHUI_BUILD_DIST -ErrorAction SilentlyContinue
        Remove-Item Env:\NEXT_TELEMETRY_DISABLED -ErrorAction SilentlyContinue
    }
}

# ── 回滚:恢复上次构建产物 + 重启 ──
function Start-Web {
    try { sc.exe start IHUI-WEB | Out-Null } catch { throw "启动 IHUI-WEB 失败: $_" }
}
function Stop-Web {
    try { sc.exe stop IHUI-WEB | Out-Null } catch { Fail "停止 IHUI-WEB 失败: $_" }
}
function Restart-Web {
    try { sc.exe stop IHUI-WEB | Out-Null } catch {}
    Start-Sleep -Seconds 2
    try { sc.exe start IHUI-WEB | Out-Null } catch { Fail "启动 IHUI-WEB 失败: $_" }
    Start-Sleep -Seconds 8
}

# ── 回滚:仅 web(恢复 .rollback 构建 + 重启 web;api/ai 不受部署影响不重启)──
function Do-Rollback {
    Log "开始回滚:恢复上次 web 构建产物"
    $rb = "$WebDir\.rollback"
    if (-not (Test-Path "$rb\BUILD_ID")) { Fail "无可用 .rollback 构建,无法回滚" }
    Stop-Web
    Remove-Item "$WebDir\.next" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $rb "$WebDir\.next" -Recurse -Force
    Remove-Item $rb -Recurse -Force -ErrorAction SilentlyContinue
    Start-Web
    Start-Sleep -Seconds 8
    if (Test-HealthGate) { Ok "回滚完成,健康检查通过" } else { Fail "回滚后健康仍异常,需人工介入" }
}

# ── 零停机蓝绿式部署主流程 ──
New-BackupDir
Set-Location $Root

if (-not $dryrun) { Get-DeployLock }     # 仅实际构建占用;dryrun 只读裸查不占锁

if ($rollbackOnly) { try { Do-Rollback; exit 0 } finally { Release-DeployLock } }

Log "fetch origin main ..."
& git fetch origin main 2>&1 | Out-String | Write-Host
# 落后提交数 = 本地未含 origin/main 的提交数
$behind = [int](git rev-list --count HEAD..origin/main | Out-String).Trim()

if ($behind -eq 0 -and -not $deployLatest) {
    Ok "本地已是最新 main,无需部署(behind=$behind)"
    Release-DeployLock
    exit 0
}
if ($dryrun) { Ok "dryrun 模式: behind=$behind,即将部署到 origin/main=$($(git rev-parse --short origin/main | Out-String).Trim())"; Release-DeployLock; exit 0 }

if ($behind -gt 0) {
    Log "本地落后 origin/main $behind 个提交,进行 fast-forward pull"
    & git pull --ff-only origin main 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -ne 0) { Fail "git pull 失败(可能冲突/未提交改动),已停止,未切流" }
    Ok "pull 完成,HEAD=$(git rev-parse --short HEAD | Out-String)"
}

# 1) 备份当前 web 构建 → .rollback(web 保持在线,只读复制)
Log "备份当前 web 构建 → .rollback"
$curNext = "$WebDir\.next"
if (Test-Path "$curNext\BUILD_ID") {
    $rb = "$WebDir\.rollback"
    Remove-Item $rb -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $curNext $rb -Recurse -Force
    Ok "已备份当前构建为回滚点"
} else { Log "未发现现有 .next\BUILD_ID,跳过备份(冷启动)" }

# 2) 构建到 staging 目录(Turbopack 持久 cache 独立于 staging,每次冷构建规避
#    持久 cache 遮蔽的 CSS 解析偶发问题);web 在线,构建期零停机
try {
        Remove-Item "$WebDir\.next-staging" -Recurse -Force -ErrorAction SilentlyContinue
        Build-Web -DistDir 'staging'
    } catch {
        Log "构建失败($_) → 保持当前在线版本,不动 web"
        Release-DeployLock
        exit 1
    }

# 3) 秒级交换:停 web → 用新构建替换 .next → 起 web
Log "交换 staging → 线上(.next),重启 web"
Stop-Web
Remove-Item "$WebDir\.next" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item "$WebDir\.next-staging" "$WebDir\.next"
Start-Web
Start-Sleep -Seconds 8

# 4) 健康门禁(web + api + llm)
Log "健康门禁检查"
if (-not (Test-HealthGate)) {
    if ($force) { Log "force=true,忽略门禁直接切流(违规操作,请确认)" }
    else       { Do-Rollback }
} else {
    Ok "健康门禁通过,部署成功"
    Remove-Item "$WebDir\.rollback" -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host ""
Log "=== 部署完成,HEAD=$(git rev-parse --short HEAD | Out-String).Trim() 活跃组=win(8801/8802/8803) ==="
Release-DeployLock