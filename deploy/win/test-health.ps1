# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# test-health.ps1 — 生产四维健康自检(web / api / llm 网关 / wss)
# 用法: pwsh -NoProfile -File deploy\win\test-health.ps1 [域名]
# 返回: 每维一行 + 最终 ALL_PASS / PARTIAL_FAIL;退出码 0=全过 1=有缺
# =============================================================================
param([string]$Base = 'https://aizhs.top')

$fail = 0
function Check([string]$name, [bool]$okVal, [string]$detail) {
    $tag = if ($okVal) { 'PASS' } else { 'FAIL' }
    if (-not $okVal) { $script:fail++ }
    '{0}  {1,-12} {2}' -f $tag, $name, $detail
}

# 1) web 首页
$webOk = $false; $webDetail = ''
try {
    $r = Invoke-WebRequest -Uri $Base -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
    $webOk = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400 -and $r.Content -match '<!DOCTYPE html')
    $webDetail = "status=$($r.StatusCode) len=$($r.Content.Length)"
} catch { $webDetail = "err=$_" }

# 2) api health
$apiOk = $false; $apiDetail = ''
try {
    $h = Invoke-RestMethod -Uri "$Base/api/health" -TimeoutSec 20 -ErrorAction Stop
    $apiOk = ($h.status -eq 'ok')
    $apiDetail = "status=$($h.status)"
} catch { $apiDetail = "err=$_" }

# 3) llm 网关(需 Bearer,用 admin 探活;密码经环境变量 IHUI_ADMIN_PASSWORD 注入)
#
# 判据不再看 HTTP 码:该端点即使所有 provider 都 unreachable/invalid_key 也照样
# 返回 200(信封错误是 HTTP 200 + 业务字段),旧写法 `StatusCode 2xx ⇒ PASS` 会把
# 「provider 全挂」判成健康。现在必须读信封:
#   code === 0
#   summary.total > 0 且 summary.ok > 0
#   至少有一个 provider 自身可用:status=ok 且 is_in_cooldown=false 且 consecutive_failures=0
# 三者任一不成立即判红;冷却/连续失败/可用数都会写进 detail,便于现读。
function Get-LlmProvidersHealthVerdict([object]$envelope) {
    $code = if ($envelope) { $envelope.code } else { $null }
    $data = if ($envelope) { $envelope.data } else { $null }
    $summary = if ($data) { $data.summary } else { $null }
    if ($null -eq $summary) { return @{ Ok = $false; Detail = 'envelope-missing-summary' } }
    $providers = @($data.providers)
    $usable = @($providers | Where-Object {
        $_.status -eq 'ok' -and $_.is_in_cooldown -ne $true -and [int]$_.consecutive_failures -eq 0
    })
    $cool = @($providers | Where-Object { $_.is_in_cooldown -eq $true })
    $maxFail = 0
    foreach ($p in $providers) {
        $n = 0
        try { $n = [int]$p.consecutive_failures } catch { $n = 0 }
        if ($n -gt $maxFail) { $maxFail = $n }
    }
    $okCount = 0
    try { $okCount = [int]$summary.ok } catch { $okCount = 0 }
    $total = 0
    try { $total = [int]$summary.total } catch { $total = 0 }
    $ok = ($code -eq 0 -and $total -gt 0 -and $okCount -gt 0 -and $usable.Count -gt 0)
    return @{ Ok = $ok; Detail = "code=$code total=$total ok=$okCount usable=$($usable.Count) cooldown=$($cool.Count) max_fail=$maxFail" }
}

$llmOk = $false; $llmDetail = ''
try {
    if (-not $env:IHUI_ADMIN_PASSWORD) { throw 'missing IHUI_ADMIN_PASSWORD' }
    $b = @{ username='admin'; password=$env:IHUI_ADMIN_PASSWORD } | ConvertTo-Json
    $lg = Invoke-RestMethod -Uri "$Base/api/auth/login/username" -Method Post -Body $b -ContentType 'application/json' -TimeoutSec 20 -ErrorAction Stop
    $tok = $lg.data.accessToken
    if ($tok) {
        $rr = Invoke-WebRequest -Uri "$Base/api/llm/providers/health" -Headers @{ Authorization = "Bearer $tok" } -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
        $envelope = $rr.Content | ConvertFrom-Json -ErrorAction Stop
        $verdict = Get-LlmProvidersHealthVerdict $envelope
        $llmOk = $verdict.Ok
        $llmDetail = "http=$($rr.StatusCode) $($verdict.Detail)"
    } else { $llmDetail = 'login-no-token' }
} catch { $llmDetail = "err=$_" }

# 4) wss — 真实 WebSocket 升级握手(不再以恒真占位)。端点与
#    deploy/prod-bundle/scripts/smoke-public-ws.mjs 同一条口径(api 子域 +
#    /v1/ai/capabilities/ws/stream),可用 IHUI_WS_PROBE_URL 覆盖。
$wssOk = $false; $wssDetail = ''
try {
    $wsUri = if ($env:IHUI_WS_PROBE_URL) {
        [Uri]$env:IHUI_WS_PROBE_URL
    } else {
        $u = [Uri]$Base
        $hostName = $u.Host -replace '^www\.', ''
        $wsHost = if ($hostName -like 'api.*') { $hostName } else { "api.$hostName" }
        [Uri]"wss://$wsHost/v1/ai/capabilities/ws/stream"
    }
    # 该端点要求 token(见 smoke-public-ws.mjs);复用 llm 维登录取到的令牌,取不到即判失败
    if (-not $tok) { throw 'no-token(llm 登录未取到 accessToken)' }
    $probe = [Uri]("$($wsUri.AbsoluteUri)?token=$([Uri]::EscapeDataString($tok))")
    $ws = [System.Net.WebSockets.ClientWebSocket]::new()
    $cts = [System.Threading.CancellationTokenSource]::new()
    try {
        $cts.CancelAfter(15000)
        $ws.ConnectAsync($probe, $cts.Token).GetAwaiter().GetResult()
        $wssOk = ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open)
        $wssDetail = "state=$($ws.State) host=$($wsUri.Host)"
    } finally {
        $ws.Dispose(); $cts.Dispose()
    }
} catch { $wssDetail = "err=$_" }

Check 'web' $webOk $webDetail
Check 'api' $apiOk $apiDetail
Check 'llm' $llmOk $llmDetail
Check 'wss' $wssOk $wssDetail

if ($script:fail -gt 0) { Write-Host "RESULT: PARTIAL_FAIL ($script:fail 维异常)"; exit 1 }
Write-Host 'RESULT: ALL_PASS'; exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
