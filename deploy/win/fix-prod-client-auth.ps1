# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
  生产机(ssh.aizhs.top)登录面配置对齐 —— 2026-11-18 立。

  背景:api.aizhs.top 走 Cloudflare 隧道,同时挂这台开发机与生产机两条腿,请求落到哪条不确定。
  两台对"人机验证"的口径不一致时,用户会遇到"有时能登录、有时 403 人机验证失败"。
  本脚本把生产机的口径对齐到与开发机一致(后端不强制 Turnstile,前端验证框保留),
  并把客户端签名密钥写进 .env(供三端发版后开严格模式)。

  用法(在生产机的 PowerShell 里,以管理员身份):
      # 只看计划,不动文件
      powershell -NoProfile -File deploy\win\fix-prod-client-auth.ps1
      # 落盘并滚动重启 api 两端
      powershell -NoProfile -File deploy\win\fix-prod-client-auth.ps1 -Apply

  设计取舍:默认 -Apply 之外一律只读;改文件前逐字节备份;任何一步取不到就点名说明并跳过,
  不猜、不半途写入。
#>
param(
  [string]$RepoRoot = 'D:\DevEnv\ihui-prod',
  [string]$Secret = '',
  [switch]$Apply,
  [switch]$KeepTurnstile
)

$ErrorActionPreference = 'Stop'
$envPath = Join-Path $RepoRoot 'apps\api\.env'
$statePath = Join-Path $RepoRoot 'deploy\run\api-bluegreen.json'

function Write-Step([string]$text) { Write-Output ("[fix-prod-client-auth] " + $text) }

if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Step "未找到 $envPath —— 确认 RepoRoot 是否为生产机上的 checkout(默认 D:\DevEnv\ihui-prod)"
  exit 2
}

# ---------- 1. 读密钥(未传参则从网盘密钥目录取) ----------
if (-not $Secret) {
  $secretFile = 'D:\BaiduSyncdisk\密钥\IHUI-AI项目密钥\client-sign-secret.txt'
  if (Test-Path -LiteralPath $secretFile) {
    $m = Select-String -LiteralPath $secretFile -Pattern '^\s*([0-9a-f]{64})\s*$' | Select-Object -First 1
    if ($m) { $Secret = $m.Matches[0].Groups[1].Value }
  }
}
if ($Secret -and $Secret -notmatch '^[0-9a-f]{64}$') {
  Write-Step '传入的 Secret 形态不对(应为 64 位小写 hex)'
  exit 2
}

# ---------- 2. 计算改动 ----------
$text = [IO.File]::ReadAllText($envPath)
$changes = New-Object System.Collections.Generic.List[string]

if (-not $KeepTurnstile -and $text -match '(?m)^TURNSTILE_SECRET_KEY=') {
  $changes.Add('注释 TURNSTILE_SECRET_KEY(后端不再强制人机验证,与开发机口径一致)')
}
if (-not $KeepTurnstile -and $text -match '(?m)^TURNSTILE_SECRET_KEY_OFF=') {
  $changes.Add('TURNSTILE_SECRET_KEY 已是 OFF 状态,跳过')
}
if ($Secret) {
  if ($text -match '(?m)^IHUI_CLIENT_SIGN_SECRET=') {
    $cur = (Select-String -LiteralPath $envPath -Pattern '(?m)^IHUI_CLIENT_SIGN_SECRET=(.+)$').Matches[0].Groups[1].Value.Trim()
    if ($cur -eq $Secret) { $changes.Add('IHUI_CLIENT_SIGN_SECRET 已是同值,跳过') }
    else { $changes.Add('IHUI_CLIENT_SIGN_SECRET 已存在但值不同 —— 本脚本不覆盖,请人工确认') ; $Secret = '' }
  } else {
    $changes.Add('追加 IHUI_CLIENT_SIGN_SECRET(供三端发版后开严格模式)')
  }
}
if ($changes.Count -eq 0) { $changes.Add('无需改动') }

Write-Step ('计划: ' + ($changes -join ' / '))

if (-not $Apply) {
  Write-Step '只读模式 —— 加 -Apply 才会落盘并重启。'
  exit 0
}

# ---------- 3. 备份 + 写入 ----------
$backup = "$envPath.bak-client-auth-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item -LiteralPath $envPath -Destination $backup -Force
Write-Step ("已备份: " + $backup)

$lines = $text -split "`r`n"
if (-not $KeepTurnstile) {
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^TURNSTILE_SECRET_KEY=') {
      $lines[$i] = '# [2026-11-18 多源站口径对齐] 后端不强制人机验证(前端 Turnstile 仍显示);原行改名保留值' + "`r`n" + ($lines[$i] -replace '^TURNSTILE_SECRET_KEY=', 'TURNSTILE_SECRET_KEY_OFF=')
    }
  }
}
$newText = ($lines -join "`r`n")
if ($Secret) {
  $newText = $newText.TrimEnd() + "`r`n`r`n# 2026-11-18:客户端签名共享密钥(与三端打包注入值必须一致)" + "`r`nIHUI_CLIENT_SIGN_SECRET=$Secret`r`n"
}
[IO.File]::WriteAllText($envPath, $newText, (New-Object Text.UTF8Encoding($false)))
Write-Step '.env 已写入'

# ---------- 4. 滚动重启(只认本仓的蓝绿布局) ----------
$services = @('IHUI-API-BLUE', 'IHUI-API-GREEN')
$found = @(Get-Service -Name $services -ErrorAction SilentlyContinue)
if ($found.Count -eq 0) {
  Write-Step '未找到 IHUI-API-BLUE/GREEN 服务 —— 请按本机实际方式重启 api 后再验证(本脚本不猜服务名)'
} else {
  $active = 'green'
  if (Test-Path -LiteralPath $statePath) {
    $active = (Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).active
  }
  $standbySvc = if ($active -eq 'blue') { 'IHUI-API-GREEN' } else { 'IHUI-API-BLUE' }
  $standbyPort = if ($active -eq 'blue') { 8843 } else { 8842 }

  function Restart-AndWait([string]$svc, [int]$port) {
    Stop-Service $svc -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Service $svc
    for ($i = 0; $i -lt 40; $i++) {
      try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 3 -UseBasicParsing
        if ($r.StatusCode -eq 200) { return $true }
      } catch { }
      Start-Sleep -Seconds 3
    }
    return $false
  }

  Write-Step ("先重启待机端 " + $standbySvc)
  if (-not (Restart-AndWait $standbySvc $standbyPort)) { Write-Step ("$standbySvc 未就绪,中止(生产端未被改动)"); exit 1 }

  if (Test-Path -LiteralPath $statePath) {
    $s = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $s.active = if ($active -eq 'blue') { 'green' } else { 'blue' }
    $s.updatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffzzz')
    [IO.File]::WriteAllText($statePath, ($s | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Step ("已切流到 " + $s.active)
    Start-Sleep -Seconds 3
  }

  $activeSvc = if ($active -eq 'blue') { 'IHUI-API-BLUE' } else { 'IHUI-API-GREEN' }
  $activePort = if ($active -eq 'blue') { 8842 } else { 8843 }
  Write-Step ("再重启原活跃端 " + $activeSvc)
  if (-not (Restart-AndWait $activeSvc $activePort)) { Write-Step ("$activeSvc 未就绪 —— 请人工确认,当前流量在另一侧"); exit 1 }
  if (Test-Path -LiteralPath $statePath) {
    $s2 = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $s2.active = $active
    $s2.updatedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffzzz')
    [IO.File]::WriteAllText($statePath, ($s2 | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Step ("已切回 " + $active)
  }
}

# ---------- 5. 自证 ----------
$body = '{"account":"13800000000","password":"test1234"}'
$curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
if (-not $curl) { $curl = Join-Path $env:SystemRoot 'System32\curl.exe' }
if (Test-Path -LiteralPath $curl) {
  $code = (& $curl -s -o NUL -w "%{http_code}" --max-time 15 -X POST 'http://127.0.0.1:8802/api/auth/login' -H 'Content-Type: application/json' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0) Chrome/120' --data-binary $body 2>$null)
  Write-Step ("验证: 浏览器 UA 无 token 打到 8802 => HTTP " + $code + " (期望 401,403 表示仍在强制)")
} else {
  Write-Step '未找到 curl.exe —— 请手动验证: 浏览器登录应看到人机验证框且能提交'
}
Write-Step '完成。'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
