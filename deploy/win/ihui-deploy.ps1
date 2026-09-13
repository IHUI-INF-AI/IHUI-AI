# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI 原生 Windows 部署 + 健康门禁 + 回滚脚本
# 适用: aizhs.top 生产机(原生 Windows, NSSM 服务, Cloudflare Tunnel)
# 由本机定时任务轮询 origin/main 触发;也可手动执行。
#
# 行为(每个阶段失败即中止,不切流):
#   1. git fetch origin main + 以 FETCH_HEAD 计算本地落后提交数(不用被宿主吞掉的 origin/main ref)
#   2. 落后>0 才继续;git merge --ff-only FETCH_HEAD(禁 force,不动他人未提交改动)
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

# ── 工具链 PATH(2026-09-13 加,实测):服务/SYSTEM 上下文的 PATH 不含 node/pnpm,
#    否则 `pnpm run db:migrate`(以及 pnpm build)会报 '"node"' 不是内部或外部命令
#    (09:23 由 IHUI-DEPLOYLOOP 服务实测复现)。与 deploy\prod-bundle\svc\run-api.ps1
#    的 PATH 前置保持一致;额外补 WindowsPowerShell\v1.0(web prebuild 的 sync-downloads
#    链会调 powershell.exe)以及 pnpm 自带的 node_modules\.bin。
foreach ($p in @('D:\DevEnv\runtimes\node','D:\DevEnv\tools\npm-global','C:\windows\System32\WindowsPowerShell\v1.0')) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) { $env:PATH = "$p;$env:PATH" }
}

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
function Fail  { param([string]$m) Log "FAIL  $m"; try { Release-DeployLock } catch {}; exit 1 }
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
    # 探测 LLM 网关需带 Bearer;用 admin 获取 token(仅作健康探测,不改数据)
    # 凭据不入仓库:密码经环境变量 IHUI_ADMIN_PASSWORD 注入
    $adminPwd = $env:IHUI_ADMIN_PASSWORD
    if (-not $adminPwd) { return $null }
    try {
        $b = @{ username='admin'; password=$adminPwd } | ConvertTo-Json
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

# ── DB 迁移(2026-09-13 加):幂等,每轮执行;drizzle journal 保证仅 pending 迁移实际跑 ──
# 失败只告警不中止部署(数据库连接失败不应阻断 web 发布;计费修复依赖本步,失败会有监控/验证兜底)
function Invoke-DbMigrate {
    Log "DB 迁移检查(packages/database db:migrate)"
    $apiEnv = "$Root\apps\api\.env"
    if (Test-Path $apiEnv) {
        Get-Content $apiEnv | ForEach-Object {
            if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') { $env:DATABASE_URL = $Matches[1].Trim('"',"'") }
        }
    }
    Push-Location "$Root\packages\database"
    try {
        $migOut = & "D:\DevEnv\tools\npm-global\pnpm.cmd" run db:migrate 2>&1 | Out-String
        $migOut | Write-Host
        if ($LASTEXITCODE -eq 0) { Ok "db:migrate 完成(exit 0)" }
        else {
            # 2026-09-13 加固:失败必须能定位到具体迁移,而不是只报退出码
            $bad = ($migOut -split "`n" | Where-Object { $_ -match "\.sql|ERROR|error:" } | Select-Object -First 6) -join " | "
            Log "WARN  db:migrate 失败(exit $LASTEXITCODE),本轮继续但需人工核查;线索: $bad"
        }
    } finally { Pop-Location }
}
if (-not $dryrun) { Invoke-DbMigrate }

# ── DB seed(2026-09-13 加):仅跑 13 号中转站定价步骤,幂等可重复 ──
# 与 Invoke-DbMigrate 共用 apps/api/.env 的 DATABASE_URL(进程级 env 已设置,这里再兜底一次)
function Invoke-DbSeedRelayPricing {
    Log "DB seed(packages/database 中转站定价,--only=13)"
    $apiEnv = "$Root\apps\api\.env"
    if (Test-Path $apiEnv) {
        Get-Content $apiEnv | ForEach-Object {
            if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') { $env:DATABASE_URL = $Matches[1].Trim('"',"'") }
        }
    }
    Push-Location "$Root\packages\database"
    try {
        $seedOut = & "D:\DevEnv\tools\npm-global\pnpm.cmd" exec tsx seed/index.ts --only=13 2>&1 | Out-String
        $seedOut | Write-Host
        if ($LASTEXITCODE -eq 0) { Ok "seed 完成(exit 0)" }
        else { Log "WARN  seed 失败(exit $LASTEXITCODE),本轮继续但需人工核查" }
    } finally { Pop-Location }
}
if (-not $dryrun) { Invoke-DbSeedRelayPricing }

# ── 代理解析(2026-09-13 修复,实测):GitHub 直连在本机被墙,系统/SYSTEM 上下文
#    没有 http_proxy 环境变量 → `git fetch` 报 "Failed to connect to github.com:443"
#    (实测 09-13 09:13),且失败时 stdout 为空 → 旧代码 `[int](...)` 得 0 →
#    误判"已是最新"静默 exit 0。此为「部署循环永不部署」的第二重根因(静默失效),
#    比 origin/main ref 被吞更隐蔽。对策:① 探测本机 Clash 代理显式传给 git;
#    ② fetch 与 behind 全程 fail-closed —— 任何一步失败即非 0 退出,绝不伪装成"已最新"。
$ProxyCandidates = @('http://127.0.0.1:7897')
$Proxy = $null
foreach ($p in $ProxyCandidates) {
    try {
        $u = [Uri]$p
        $cli = New-Object System.Net.Sockets.TcpClient
        $iar = $cli.BeginConnect($u.Host, $u.Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(600) -and $cli.Connected) { $Proxy = $p; $cli.Close(); break }
        $cli.Close()
    } catch {}
}
$gitNet = @()
if ($Proxy) { $gitNet = @('-c', "http.proxy=$Proxy", '-c', "https.proxy=$Proxy"); Log "git 网络走代理 $Proxy" }
else { Log "WARN  未探测到可用代理(候选:$($ProxyCandidates -join ',')),将尝试直连" }

Log "fetch origin main ..."
$fetchOut = & git @gitNet fetch origin main 2>&1 | Out-String
$fetchOut.Trim() | Write-Host
if ($LASTEXITCODE -ne 0 -or $fetchOut -match 'fatal:|Could not connect|RPC failed|Could not resolve host') {
    Fail "git fetch origin main 失败(fetch 未成功则无法判定是否落后),本轮不部署"
}
# 落后提交数 = 本地未含 origin/main 的提交数
# 2026-09-13 修复(实测):本机 origin/main 这个嵌套 remote-tracking ref 会被宿主吞掉、永不更新
# (fetch 打印 6eedf5b0f1..adcc23136a 但 rev-parse origin/main 仍读回旧值)→
# 旧写法 git rev-list --count HEAD..origin/main 恒 0 → 循环判定"已是最新"提前退出、永不部署。
# 改为对齐刚 fetch 下来的 FETCH_HEAD(fetch 之后它必然是远端最新),彻底免疫该问题。
$behindRaw = (& git @gitNet rev-list --count HEAD..FETCH_HEAD 2>&1 | Out-String).Trim()
if ($behindRaw -notmatch '^\d+$') { Fail "无法计算 behind(FETCH_HEAD 无效:'$behindRaw'),本轮不部署" }
$behind = [int]$behindRaw

if ($behind -eq 0 -and -not $deployLatest) {
    Ok "本地已是最新 main,无需部署(behind=$behind)"
    Release-DeployLock
    exit 0
}
if ($dryrun) { Ok "dryrun 模式: behind=$behind,即将部署到 origin/main=$($(git rev-parse --short FETCH_HEAD | Out-String).Trim())"; Release-DeployLock; exit 0 }

if ($behind -gt 0) {
    Log "本地落后远端 $behind 个提交,进行 fast-forward merge(FETCH_HEAD)"
    & git merge --ff-only FETCH_HEAD 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -ne 0) { Fail "git merge --ff-only FETCH_HEAD 失败(可能冲突/未提交改动),已停止,未切流" }
    Ok "merge 完成,HEAD=$(git rev-parse --short HEAD | Out-String)"
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

    # ── 重启 api(2026-09-13 加):api 为源码直跑,pull 后需重载才能吃到后端新代码 ──
    # 服务名不确定,按候选精确匹配;找不到则跳过(tsx watch 形态会自动重载)
    $apiName = @('IHUI-API','ihui-api','svc-api','IHUI-API-SVC') |
        Where-Object { $null -ne (Get-Service -Name $_ -ErrorAction SilentlyContinue) } |
        Select-Object -First 1
    if ($apiName) {
        Log "重启 api 服务($apiName)使后端新代码生效"
        try {
            sc.exe stop $apiName | Out-Null
            Start-Sleep -Seconds 4
            sc.exe start $apiName | Out-Null
            Start-Sleep -Seconds 6
            $apiOk = $false
            for ($i = 1; $i -le 5; $i++) {
                if (Test-Http -url $ApiHealth -contains '"status":"ok"') { $apiOk = $true; break }
                Start-Sleep -Seconds 6
            }
            if ($apiOk) { Ok "api 重启完成且健康" }
            else { Log "WARN  api 重启后健康未即时通过(冷启动可能较慢),需人工核查 $apiName" }
        } catch { Log "WARN  api 重启异常: $_" }
    } else {
        Log "未找到 api 服务(候选:IHUI-API/ihui-api/svc-api),跳过重启(tsx watch 形态自动重载)"
    }
}
Write-Host ""
Log "=== 部署完成,HEAD=$(git rev-parse --short HEAD | Out-String).Trim() 活跃组=win(8801/8802/8803) ==="
Release-DeployLock
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
