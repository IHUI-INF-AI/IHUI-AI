# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

# =============================================================================
# IHUI-API 服务 wrapper — 由 Windows 服务 "IHUI-API" 调用(NSSM 托管)
# 直接以 node + tsx 启动(不走 pnpm dev,避免 pnpm install 交互卡死服务)
# 与历史 dev 进程启动方式一致:node --require tsx/preflight.cjs --import tsx/loader.mjs src/index.ts
# 2026-08-17 修复:tsx 路径改用 apps/api/node_modules 符号链接(版本无关),
#   不再硬编码 .pnpm/tsx@4.23.5(tsx 升级到 4.23.12 后旧路径 MODULE_NOT_FOUND 导致服务起不来)。
# 日志: D:\DevEnv\logs\svc-api-nssm.log / svc-api-nssm-err.log(NSSM 捕获)
# =============================================================================
$env:PATH = "D:\DevEnv\runtimes\node;D:\DevEnv\tools\npm-global;$env:PATH"
# Swagger 调试文档 API Key(公网安全:无此 key 访问 /docs 被拒;key 存独立文件,不进 .env/git)
if (Test-Path "D:\DevEnv\secrets\swagger-api-key.txt") {
    $env:SWAGGER_API_KEY = (Get-Content "D:\DevEnv\secrets\swagger-api-key.txt" -Raw).Trim()
}
Set-Location "D:\IHUI-AI\apps\api"

# =============================================================================
# PostgreSQL readiness 前置轮询 —— G-208 留下的第三格(2026-09-27 补)
# -----------------------------------------------------------------------------
# 为什么不靠 DependOnService:实测 IHUI-API 的 DEPENDENCIES 本来就为空、服务顺序早已满足,
#   而事故窗口是"PostgreSQL 服务已 RUNNING 但仍在崩溃恢复"——服务态为真、库不可用。
#   所以判据必须问"接不接连接",不是问"服务在不在";这两者不等价正是那次失效的机理。
# 为什么用 pg_isready 而不是探 TCP 端口:恢复期的 postmaster 照常监听端口,并对连接回
#   "the database system is starting up" —— 端口开着 ≠ 就绪。pg_isready 只做 libpq 握手、
#   不鉴权,所以这一步不需要也不读任何口令。
# 为什么必须有上界、且超时后仍要启动:一个"等不到就不启动"的前置会把一次数据库故障
#   换成"服务永久不启动",比原缺陷更难发现也更具破坏性。API 侧已按 G-208 加固
#   (apps/api/src/routes/live-gifts.ts 注册期建表失败不致命 + apps/api/src/index.ts:72
#   listen 的 180s 硬上界),它会自己报 degraded 或以退出码 1 交给服务管理器重启。
# 上界取 90s 的推导:① 必须 **小于** API 自己的 180s listen 上界,否则两道界叠成 >5 分钟
#   的"正在启动"态,nssm 与监控都会读成挂死(与 §12 那套"锁龄上限要短于上一层超时"同一条);
#   ② 正常重启时崩溃恢复在秒级完成,90s ≈ 30 次探测、是常见值的十倍量级余量;③ 超过 90s
#   还没起来的,是 PostgreSQL 侧的故障而不是包装器该继续等的理由 —— 换到 API 的失败出口上
#   才有人能看见它(§5e"失败必须响")。可用 IHUI_API_PG_WAIT_SECONDS 调,设 0 = 显式关掉前置。
# =============================================================================

$PgWaitSeconds = 90
if ($env:IHUI_API_PG_WAIT_SECONDS -and $env:IHUI_API_PG_WAIT_SECONDS -match '^\d+$') {
    $PgWaitSeconds = [int]$env:IHUI_API_PG_WAIT_SECONDS
}

function Resolve-IhuiPgIsReady {
    # 形态照 deploy/win/ihui-pg-backup.ps1 的 Resolve-NodeExe:先按(本脚本刚设过的)PATH 找,
    # 再按绝对路径候选找 —— 服务身份读的是**机器级** PATH,只靠 Get-Command 会在自动轮次里
    # 静默落空(那一处的症状是"手动跑对的、服务跑退回旧配置")。全落空返回 $null 由调用方喊出来。
    $cmd = Get-Command pg_isready.exe -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { return $cmd.Source }
    $candidates = @('D:\DevEnv\runtimes\pgsql\bin\pg_isready.exe') # 部署机 PG 客户端位(与 pg_dump 同目录)
    foreach ($root in @('C:\Program Files\PostgreSQL', 'D:\Program Files\PostgreSQL')) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        # 版本目录不写死:本文件头注记过一次"硬编码 tsx@4.23.5,升级后 MODULE_NOT_FOUND 导致
        # 服务起不来"。同一坑在 PG 大版本升级(17→18)时会以"找不到 pg_isready"重现。
        # 取版本号最高的那份(升过级的机器两份并存,老客户端可能不认新服务器的协议)。
        # ⚠ 实测坑:System.Version 不接受裸 "17"(TryParse 直接 False),所以必须补齐成
        #   major.minor 再比 —— 不补的话所有候选都落回同一个兜底值,等于按目录枚举顺序随便挑,
        #   而"挑中哪一份客户端"正是这段唯一在决定的事。
        $versions = foreach ($d in (Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            $exePath = Join-Path $d.FullName 'bin\pg_isready.exe'
            if (-not (Test-Path -LiteralPath $exePath)) { continue }
            $vm = [regex]::Match($d.Name, '^(\d+)(?:\.(\d+))?')
            if (-not $vm.Success) { continue }
            $minor = if ($vm.Groups[2].Success) { $vm.Groups[2].Value } else { '0' }
            [pscustomobject]@{ Version = [version]"$($vm.Groups[1].Value).$minor"; Path = $exePath }
        }
        $hit = $versions | Sort-Object Version -Descending | Select-Object -First 1
        if ($hit) { $candidates += $hit.Path }
    }
    foreach ($p in $candidates) { if (Test-Path -LiteralPath $p) { return $p } }
    return $null
}

function Get-IhuiApiDbEndpoint {
    # 真值只有一处:apps/api/.env 的 DATABASE_URL。apps/api/src/index.ts:5 用 dotenv/config 从
    # 进程 cwd(就是上面 Set-Location 的那个目录)读它,:32 以 z.url() 强制校验,db/index.ts:53
    # 拿它连接 —— 轮询必须打**同一个端点**。若另去读根 .env 的 DB_HOST/DB_PORT,两份不一致时
    # 就会出现"探针绿了、应用连的还是另一处"的假前置(§两处算同一件事必漂移)。
    # 落点写绝对路径是沿用本脚本现状(它已把 apps\api 的字面量写死三处),而不是用 $PSScriptRoot
    # 推导:运行副本住在 deploy/prod-bundle/svc、入库源住在 deploy/scripts/prod-bundle/svc,
    # 两份到仓库根的层数不同,同一句推导必然有一份算错 —— 那才是真的第二份真相。
    # 只回 host 与 port:口令在同一行里,任何一条输出都不许带出它(§5d/§5e)。
    param([Parameter(Mandatory = $true)][string]$EnvFile)
    if (-not (Test-Path -LiteralPath $EnvFile)) { return $null }
    $url = $null
    foreach ($line in (Get-Content -LiteralPath $EnvFile -ErrorAction SilentlyContinue)) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') { $url = $matches[1] }
    }
    if (-not $url) { return $null }
    $url = $url.Trim().Trim('"', "'").Trim()
    # 先取 authority(:// 到第一个 / ? # 之前),再按**最后一个 @** 切掉 userinfo ——
    # 用一条正则直接抓 host 会在 unix socket 形态 `postgresql://user:pw@/dbname` 上
    # 回溯成"把用户名当主机",于是探针去打一个根本不存在的机器、日志写着"主机解析失败",
    # 而真因是 DSN 形态。分两步切就没有这种歧义;切完为空即 socket ⇒ 判"读不出端点"。
    $am = [regex]::Match($url, '^[a-z]+://[^/?#]*', 'IgnoreCase')
    if (-not $am.Success) { return $null }
    $authority = $am.Value.Substring($am.Value.IndexOf('://') + 3)
    $at = $authority.LastIndexOf('@')
    $hostport = if ($at -ge 0) { $authority.Substring($at + 1) } else { $authority }
    if ([string]::IsNullOrWhiteSpace($hostport)) { return $null }
    $h = $hostport
    $p = ''
    if ($hostport.StartsWith('[')) {
        # IPv6 字面量:主机在方括号里,端口在 ] 之后
        $cb = $hostport.IndexOf(']')
        if ($cb -gt 0) {
            $h = $hostport.Substring(1, $cb - 1)
            if ($hostport.Substring($cb + 1) -match '^:(\d+)$') { $p = $matches[1] }
        }
    } elseif ($hostport -match '^(.*):(\d+)$') {
        $h = $matches[1]
        $p = $matches[2]
    }
    if ([string]::IsNullOrWhiteSpace($h)) { return $null }
    return [pscustomobject]@{ Host = $h; Port = $p }
}

function Wait-IhuiPostgresReady {
    param(
        [Parameter(Mandatory = $true)][string]$Exe,
        [Parameter(Mandatory = $true)][string]$H,
        [string]$P,
        [Parameter(Mandatory = $true)][int]$LimitSeconds
    )
    # 单轮探测自己也要有界:不设 PGCONNECT_TIMEOUT 时一次探测可挂到 TCP 层默认超时(分钟级),
    # 那会把"最多等 N 秒"变成无界等待 —— 与守门 80 拦的"无界只读调用"同型。
    $env:PGCONNECT_TIMEOUT = '3'
    $probeArgs = @('-q') # -q:结论只看退出码,不把结果行重复进 nssm 日志
    if ($H) { $probeArgs += @('-h', $H) }
    if ($P) { $probeArgs += @('-p', $P) }
    $portText = if ($P) { ":$P" } else { '' }
    Write-Host "[IHUI-API] 等待 PostgreSQL 接受连接:$H$portText(上界 ${LimitSeconds}s,单轮探测超时 3s)"
    $deadline = (Get-Date).AddSeconds($LimitSeconds)
    $probes = 0
    $lastCode = $null
    while ((Get-Date) -lt $deadline) {
        $probes += 1
        & $Exe @probeArgs 2>&1 | Out-Null
        $code = $LASTEXITCODE
        if ($code -eq 0) {
            Write-Host "[IHUI-API] PostgreSQL 已接受连接(探测 $probes 次),继续启动 API"
            return $true
        }
        if ($code -ne $lastCode) {
            # 只在退出码变化时打一行,免得 90 秒灌出几十条重复日志;码值含义按 PG 客户端工具
            # 的固定约定写死在这里:1 = 正在拒绝(崩溃恢复中的常态),2 = 无响应,3 = 解析不到主机。
            $meaning = switch ($code) {
                1 { '库在拒绝连接(崩溃恢复未完成 / 仍在启动)' }
                2 { '无响应(实例没起 / 端口或防火墙不对)' }
                3 { '主机解析失败(DATABASE_URL 的 host 写错)' }
                default { "未知码,按未就绪处理" }
            }
            Write-Host "[IHUI-API]   pg_isready 退出码 $code = $meaning,继续等待"
            $lastCode = $code
        }
        # 只睡到上界为止:否则最后一轮会"探测完再白睡 2 秒",让声明的上界被越过。
        # 仍可能被**正在进行**的那一次探测超出(它自己的上界是 PGCONNECT_TIMEOUT=3s),
        # 所以总时长是"上界 + 至多一轮探测",不是"恰好上界"。
        $left = ($deadline - (Get-Date)).TotalSeconds
        if ($left -le 0) { break }
        $nap = if ($left -lt 2) { $left } else { 2 }
        Start-Sleep -Milliseconds ([int]($nap * 1000))
    }
    return $false
}

# 三条"跳过前置"的出口都必须**喊出原因**再照常启动,禁止静默 —— 静默的降级看起来和
# "前置生效了"一模一样,而 §5b/§5e 记过多次:判据失效的表现永远是安静。
# 连"怎么把端点/工具算出来"也一并兜住:这一段任何意外都只能变成"跳过前置",不能变成"API 起不来"。
# (例如 String.Trim(char[]) 的重载解析在某个 PowerShell 版本上抛错 ⇒ 落进下面的降级分支,而不是炸脚本。)
$pgExe = $null
$pgEndpoint = $null
try {
    $pgExe = Resolve-IhuiPgIsReady
    $pgEndpoint = Get-IhuiApiDbEndpoint -EnvFile "D:\IHUI-AI\apps\api\.env"
} catch {
    Write-Host "[IHUI-API] ⚠ 降级:解析 pg_isready / DATABASE_URL 时异常($($_.Exception.Message)),跳过就绪前置并直接启动" -ForegroundColor Yellow
}
if ($PgWaitSeconds -le 0) {
    Write-Host "[IHUI-API] ⚠ 就绪前置已被 IHUI_API_PG_WAIT_SECONDS=0 显式关闭,直接启动(崩溃恢复窗口内会白重启一次)" -ForegroundColor Yellow
} elseif (-not $pgExe) {
    Write-Host "[IHUI-API] ⚠ 降级:找不到 pg_isready.exe(候选:PATH / D:\DevEnv\runtimes\pgsql\bin / {C,D}:\Program Files\PostgreSQL\<大版本>\bin),跳过就绪前置并直接启动 —— 本机没有这套前置机制,不等于库已就绪。处置:装 postgresql 客户端工具,或把它的 bin 加进本脚本可见的 PATH。" -ForegroundColor Yellow
} elseif (-not $pgEndpoint) {
    Write-Host "[IHUI-API] ⚠ 降级:读不到 D:\IHUI-AI\apps\api\.env 里的 DATABASE_URL,无法确定要等哪个端点 ⇒ 跳过就绪前置并直接启动(API 会按自己的路径因缺 DATABASE_URL 退出,那是另一条已加固的失败出口)。" -ForegroundColor Yellow
} else {
    $ready = $true
    try {
        $ready = Wait-IhuiPostgresReady -Exe $pgExe -H $pgEndpoint.Host -P $pgEndpoint.Port -LimitSeconds $PgWaitSeconds
    } catch {
        # 前置自身出错绝不能变成"API 起不来":这一步是减损,不是准入证。
        Write-Host "[IHUI-API] ⚠ 降级:就绪轮询自身异常($($_.Exception.Message)),跳过前置并直接启动" -ForegroundColor Yellow
        $ready = $true
    }
    if (-not $ready) {
        Write-Host ("[IHUI-API] ⚠ 超时:${PgWaitSeconds} 秒内 PostgreSQL 未接受连接 —— 仍照常启动 API。这是刻意的:" +
            "等不到就不启动会把一次数据库故障换成'服务永久不启动',比原缺陷更糟。" +
            'API 侧已按 G-208 加固(注册期建表失败不致命 + listen 180s 硬上界),它会自己报 degraded ' +
            '或以退出码 1 交给服务管理器重启。真因请看 PostgreSQL 侧:崩溃恢复未完成 / 实例没起 / 主机端口不对。') -ForegroundColor Yellow
    }
}

& "D:\DevEnv\runtimes\node\node.exe" `
  --require "D:\IHUI-AI\apps\api\node_modules\tsx\dist\preflight.cjs" `
  --import "file:///D:/IHUI-AI/apps/api/node_modules/tsx/dist/loader.mjs" `
  src/index.ts
