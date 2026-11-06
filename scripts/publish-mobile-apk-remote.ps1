#requires -Version 7
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  出包机没有生产 checkout 时,把本次 APK 送进生产 checkout 并跑那条正式发布链(站点腿 + app_versions 登记)。
.DESCRIPTION
  为什么要有这条:2026-11-05 实测,站点腿与 latest 行只认生产 checkout 的落点,出包机缺它就只能半发布
  ——用户更新卡看不到新版。本脚本不重写发布判据:包由**生产机自己**从 Gitee 单文件腿取(80MB 经隧道
  上传要 5 分钟,直连 Gitee 只要 40 秒),取到后按本机算出的字节数 + SHA256 对账,再交给生产 checkout 的
  `scripts/publish-mobile-apk.mjs` 执行(三态判据/写后自证/回读全在那边)。
  终检必须从**公网**读 `/api/app-version/latest`,版本对不上即失败 —— 不许"远程 exit 0"当成功。
.PARAMETER Apk
  本机 APK 绝对路径(只用于算 SHA256/字节数,不上传)。
.PARAMETER Version
  版本名(须与 APK 内 versionName 一致)。
.PARAMETER VersionCode
  版本号(须与 APK 内 versionCode 一致)。
.PARAMETER TargetHost
  SSH 主机别名(默认 ssh.aizhs.top,走 ~/.ssh/config 的 Cloudflare Access ProxyCommand)。
.PARAMETER ProdRoot
  生产 checkout 绝对路径(默认 D:\DevEnv\ihui-prod)。
#>
param(
  [Parameter(Mandatory = $true)][string]$Apk,
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][int]$VersionCode,
  [string]$TargetHost = 'ssh.aizhs.top',
  [string]$ProdRoot = 'D:\DevEnv\ihui-prod'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Apk)) { throw "APK 不存在: $Apk" }

$sha256 = (Get-FileHash $Apk -Algorithm SHA256).Hash.ToLower()
$bytes = (Get-Item $Apk).Length
$giteeUrl = 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/mobile-apk-latest/ihui-ai-latest.apk'
$remoteApk = "$ProdRoot\.tmp\ihui-remote-publish.apk"

# 生产侧:取包(已存在且字节一致则复用)→ SHA 对账 → 读生产 DATABASE_URL → 跑正式发布链
$tpl = @'
$ErrorActionPreference='Stop'
Set-Location '__ROOT__'
New-Item -ItemType Directory -Force -Path '.tmp' | Out-Null
$f = '__APK__'
if (-not (Test-Path $f) -or (Get-Item $f).Length -ne __BYTES__) {
  Invoke-WebRequest -Uri '__URL__' -OutFile $f -TimeoutSec 900
}
$h = (Get-FileHash $f -Algorithm SHA256).Hash.ToLower()
"remote sha256=$h bytes=$((Get-Item $f).Length)"
if ($h -ne '__SHA__') { throw "Gitee 包与本次构建不符: 期望 __SHA__, 实得 $h" }
$line = Get-Content 'apps\api\.env' | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -Last 1
if ($line) { $env:DATABASE_URL = ($line -replace '^\s*DATABASE_URL\s*=','').Trim().Trim('"').Trim("'") }
node scripts/publish-mobile-apk.mjs --apk $f --version '__VERSION__' --version-code __VC__
exit $LASTEXITCODE
'@
$remoteScript = $tpl.
  Replace('__ROOT__', $ProdRoot).
  Replace('__APK__', $remoteApk).
  Replace('__BYTES__', [string]$bytes).
  Replace('__URL__', $giteeUrl).
  Replace('__SHA__', $sha256).
  Replace('__VERSION__', $Version).
  Replace('__VC__', [string]$VersionCode)

$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remoteScript))
& ssh -o BatchMode=yes $TargetHost pwsh -NoProfile -EncodedCommand $b64
if ($LASTEXITCODE -ne 0) { throw "生产发布失败 (exit=$LASTEXITCODE) —— 站点腿或版本登记未完成" }

# 公网终检:线上 latest 必须就是本次版本(远程 exit 0 不构成成功证据)
# 两条实测口径(2026-11-06):
#  ① 必须 -NoProxy:本机系统代理(127.0.0.1:7897)对 api.aizhs.top 的 TLS 出口是坏的,
#     .NET HttpClient 走默认代理直接 `The SSL connection could not be established`;
#  ② 必须重试:该接口实测 3 次里有 1~2 次 25s 级超时(EdgeOne 偶发),单次超时会把
#     "已发布且已登记"的整轮记成失败,下一轮再重复打同一个包。
$live = $null
$lastErr = ''
for ($i = 1; $i -le 3; $i++) {
  try {
    $r = Invoke-RestMethod -Uri "https://api.aizhs.top/api/app-version/latest?platform=android&t=$([DateTime]::UtcNow.Ticks)&i=$i" -TimeoutSec 30 -NoProxy
    $live = $r.data.latest
    if ($live.version -eq $Version -and [int]$live.buildNumber -eq $VersionCode) { break }
    $lastErr = "线上 latest 未切到本次版本: 期望 $Version/$VersionCode, 实得 $($live.version)/$($live.buildNumber)"
  } catch {
    $lastErr = $_.Exception.Message
  }
  if ($i -lt 3) { Start-Sleep -Seconds 5 }
}
if ($null -eq $live -or $live.version -ne $Version -or [int]$live.buildNumber -ne $VersionCode) {
  throw "公网终检失败(3 次均未通过): $lastErr"
}
Write-Host "[remote] ✓ 生产已发布并登记: $($live.version)/$($live.buildNumber) → $($live.downloadUrl)" -ForegroundColor Green

# 清掉生产临时包(80MB,不留在生产盘)
& ssh -o BatchMode=yes $TargetHost "del /q $remoteApk" | Out-Null
# 清理是收尾动作,失败不许污染发布结论:本脚本被 build-mobile-rn-release.ps1 以 `&` 同进程调用,
# 调用方紧接着就检查 $LASTEXITCODE —— 这里的 ssh 抖动会被读成"远程发布腿失败"(实测过的假红)。
if ($LASTEXITCODE -ne 0) { Write-Warning "生产临时包清理失败(exit=$LASTEXITCODE),不影响发布结论" }
$global:LASTEXITCODE = 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
