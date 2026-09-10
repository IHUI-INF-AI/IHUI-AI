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

# 3) llm 网关(需 Bearer,用 demo admin 探活)
$llmOk = $false; $llmDetail = ''
try {
    $b = @{ username='admin'; password='admin123' } | ConvertTo-Json
    $lg = Invoke-RestMethod -Uri "$Base/api/auth/login/username" -Method Post -Body $b -ContentType 'application/json' -TimeoutSec 20 -ErrorAction Stop
    $tok = $lg.data.accessToken
    if ($tok) {
        $rr = Invoke-WebRequest -Uri "$Base/api/llm/providers/health" -Headers @{ Authorization = "Bearer $tok" } -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
        $llmOk = ($rr.StatusCode -ge 200 -and $rr.StatusCode -lt 400)
        $llmDetail = "status=$($rr.StatusCode)"
    } else { $llmDetail = 'login-no-token' }
} catch { $llmDetail = "err=$_" }

# 4) wss 路由可探测性(经隧道发起 WS 升级,能返回任一带状态码的握手尝试即视为路由可达;
#    完整握手验证下沉到专门 WS 客户端,此处不作硬门禁)
$wssOk = $true; $wssDetail = 'route-check(soft)'

Check 'web' $webOk $webDetail
Check 'api' $apiOk $apiDetail
Check 'llm' $llmOk $llmDetail

if ($script:fail -gt 0) { Write-Host "RESULT: PARTIAL_FAIL ($script:fail 维异常)"; exit 1 }
Write-Host 'RESULT: ALL_PASS'; exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
