# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 跑法: pwsh -NoProfile -File deploy/win/tests/test-health-wss.test.ps1
# DBG-77: test-health.ps1 的 wss 维必须真探活,失败要进入总判定。
# 只连接 127.0.0.1 上本测试自己拉起的桩,不访问生产域名。
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$health = Join-Path $root 'deploy\win\test-health.ps1'

$pass = 0
$fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function Get-EnvOrNull([string]$name) {
    $item = Get-Item -Path "Env:$name" -ErrorAction SilentlyContinue
    if ($item) { return [string]$item.Value }
    return $null
}

Write-Output '[1] 源码: wss 不再写死成功,并且把结果交给 Check'
if (-not (Test-Path -LiteralPath $health)) { throw "找不到 $health" }
$text = [System.IO.File]::ReadAllText($health)
$hardcoded = [regex]::IsMatch($text, '(?im)\$wssOk\s*=\s*\$true\b')
T '源码不出现 $wssOk = $true' (-not $hardcoded) $(if ($hardcoded) { '仍有 $wssOk = $true' } else { '' })
$wired = [regex]::IsMatch($text, '(?m)Check\s+''wss''\s+\$wssOk\b')
T 'Check ''wss'' $wssOk 已接线' $wired

Write-Output '[2] 行为: 仅 wss 失败时总判定失败(回环桩,非生产)'
$keys = @(
    'IHUI_ADMIN_PASSWORD', 'IHUI_WS_PROBE_URL', 'NO_PROXY',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'
)
$saved = @{}
foreach ($k in $keys) { $saved[$k] = Get-EnvOrNull $k }
$tmp = Join-Path $root '.ihui-agent\tmp\dbg-77'
$helper = Join-Path $tmp 'loopback-stub.cjs'
$proc = $null
try {
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $nodeSrc = @'
const http = require('http')
const net = require('net')
const httpServer = http.createServer((req, res) => {
  const url = String(req.url || '/').split('?')[0]
  if (req.method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<!DOCTYPE html><html><body>ok</body></html>')
    return
  }
  if (req.method === 'GET' && url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  if (req.method === 'POST' && url === '/api/auth/login/username') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: { accessToken: 'dbg77-local-only' } }))
    })
    return
  }
  if (req.method === 'GET' && url === '/api/llm/providers/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not-found')
})
const wsSink = net.createServer((sock) => { sock.destroy() })
httpServer.listen(0, '127.0.0.1', () => {
  wsSink.listen(0, '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({
      http: httpServer.address().port,
      ws: wsSink.address().port,
    }) + '\n')
  })
})
'@
    [System.IO.File]::WriteAllText($helper, $nodeSrc)
    $node = (Get-Command node -ErrorAction Stop).Source
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $node
    $psi.Arguments = '"' + $helper + '"'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
    $proc = [System.Diagnostics.Process]::Start($psi)
    $errTask = $proc.StandardError.ReadToEndAsync()
    $lineTask = $proc.StandardOutput.ReadLineAsync()
    if (-not $lineTask.Wait(8000)) { throw '回环桩 8s 内没有报出端口' }
    $line = $lineTask.Result
    if ([string]::IsNullOrWhiteSpace($line)) {
        $err = ''
        if ($errTask.IsCompleted) { $err = $errTask.Result }
        throw "回环桩没有输出端口。stderr=$err"
    }
    $meta = $line | ConvertFrom-Json
    $base = "http://127.0.0.1:$($meta.http)"
    $wsUrl = "ws://127.0.0.1:$($meta.ws)/v1/ai/capabilities/ws/stream"
    if ($base -notmatch '^http://127\.0\.0\.1:\d+$') { throw "拒绝非回环基址 $base" }
    if ($wsUrl -notmatch '^ws://127\.0\.0\.1:\d+/') { throw "拒绝非回环探测 $wsUrl" }
    $env:IHUI_ADMIN_PASSWORD = 'dbg77-local-only'
    $env:IHUI_WS_PROBE_URL = $wsUrl
    $env:NO_PROXY = '127.0.0.1,localhost'
    foreach ($proxyKey in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY')) {
        Remove-Item -Path "Env:$proxyKey" -ErrorAction SilentlyContinue
    }
    $lines = & pwsh -NoProfile -File $health $base 2>&1
    $code = $LASTEXITCODE
    $out = @($lines | ForEach-Object { "$_" }) -join "`n"
    T '退出码为 1' ($code -eq 1) "$code"
    T 'web 通过' ($out -match '(?m)^PASS\s+web\b') $out
    T 'api 通过' ($out -match '(?m)^PASS\s+api\b') $out
    T 'llm 通过' ($out -match '(?m)^PASS\s+llm\b') $out
    T 'wss 为 FAIL' ($out -match '(?m)^FAIL\s+wss\b') $out
    T '总判定 PARTIAL_FAIL 且不是 ALL_PASS' (
        ($out -match 'PARTIAL_FAIL \(1 维异常\)') -and ($out -notmatch 'ALL_PASS')
    ) $out
} catch {
    T '回环行为验证可跑完' $false "$_"
} finally {
    if ($proc -and -not $proc.HasExited) {
        try { $proc.Kill($true) } catch { try { $proc.Kill() } catch { } }
    }
    if ($proc) { $proc.Dispose() }
    if (Test-Path -LiteralPath $helper) { Remove-Item -LiteralPath $helper -Force }
    foreach ($k in $keys) {
        if ($null -eq $saved[$k]) { Remove-Item -Path "Env:$k" -ErrorAction SilentlyContinue }
        else { Set-Item -Path "Env:$k" -Value $saved[$k] }
    }
}

if ($script:fail -gt 0) {
    Write-Output "RESULT: FAIL ($pass ok / $fail fail)"
    exit 1
}
Write-Output "RESULT: PASS ($pass)"
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
