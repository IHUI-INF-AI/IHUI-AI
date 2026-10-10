# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  mobile-rn release APK 一键构建(签名流水线, 2026-09-03 P2 落地)
.DESCRIPTION
  流程:
    1. 幂等注入 release 签名配置(node scripts/patch-rn-release-signing.mjs,
       android/ 为 Expo prebuild 生成物, prebuild 后必须重打)
    2. 前置检查: keystore(~/.android/ihui-release.keystore) + 签名凭据(~/.gradle/gradle.properties)
    2.5 后端基址对账:烤进包的 API/WEB 基址必须是显式的;含回环地址而没给 -AllowLocalBackend 即拒绝构建
    3. gradlew assembleRelease(前台执行——后台任务会被环境 ~2min 终结)
    3.5 从产出的 APK 里读回 assets/index.android.bundle,确认两个基址真在里面、且无回环残留
    4. apksigner 验签 + 产物报告

  签名凭据设计(不入库):
    - keystore: C:/Users/Administrator/.android/ihui-release.keystore(仓库外)
    - 密码:    用户级 ~/.gradle/gradle.properties 的 IHUI_RELEASE_* 属性(Gradle 自动读取)
    - build.gradle 未检测到凭据时 release 回退 debug 签名(仅本机可装, 不可上架)

  用法:
    pwsh -File scripts/build-mobile-rn-release.ps1                  # 默认双 ABI(arm64-v8a+x86_64)
    pwsh -File scripts/build-mobile-rn-release.ps1 -VersionCode 2   # 指定版本号(上架必须递增)
    pwsh -File scripts/build-mobile-rn-release.ps1 -Abi x86_64      # 单 ABI(模拟器/快速验证)
    pwsh -File scripts/build-mobile-rn-release.ps1 -FullAbi         # 含 x86(32位, 一般不必要)
    pwsh -File scripts/build-mobile-rn-release.ps1 -ApiBaseUrl https://api.aizhs.top -WebBaseUrl https://aizhs.top   # 生产包(显式给基址)
    pwsh -File scripts/build-mobile-rn-release.ps1 -ApiBaseUrl http://192.168.1.7:8802 -WebBaseUrl http://192.168.1.7:8801   # 局域网真机联调
    pwsh -File scripts/build-mobile-rn-release.ps1 -AllowLocalBackend   # 本机回环 + adb reverse(不给这旗会被 2.5 拒绝)
.PARAMETER VersionCode
  Android versionCode(上架递增)。缺省 0 = **自动**:有机身时取"机上已装版本 + 1",无机身/取不到时回落 1 并大声说明。
  为什么默认不能是 1:装机取证时 `adb install -r` 遇 versionCode 低于机上值会直接
  `INSTALL_FAILED_VERSION_DOWNGRADE` —— 装不上又不报错到底,于是那一轮"实测"量的仍是旧包,
  而账面看起来"构建成功"(2026-09-27 实测撞在这一步)。
.PARAMETER ShowVersionCode
  只解析并打印本次会用的 versionCode 与依据,不构建(给取证脚本与人工先确认落点用)
.PARAMETER Abi
  目标 ABI(逗号分隔, 如 arm64-v8a,x86_64); 缺省为 arm64-v8a,x86_64(32 位真机已放弃, 见 PROJECT_PLAN G-977963)
.PARAMETER FullAbi
  构建全部 ABI(含 x86 32 位)
.PARAMETER SkipVerify
  跳过 apksigner 验签
.PARAMETER ApiBaseUrl
  烤进包的 API 基址(写 EXPO_PUBLIC_API_BASE_URL)。缺省 = 沿用当前环境/ apps/mobile-rn/.env 的值。
  为什么必须由脚本管:release 走的是 `gradlew assembleRelease`,**不经过 eas**,所以 eas.json 的
  `build.production.env` 那三个值在这条链上**从不生效**;而 apps/mobile-rn/.env 是 gitignored 的、
  换机/重装就没有 ⇒ 不显式传参时 Metro 会把 `src/lib/config.ts:28` 的缺省值 `http://localhost:8802`
  烤进包,产出一个"构建成功、装到真机上连不通任何后端"的 APK。
  现状如实登记(2026-10-10 现测,别把这条读成本机已发生的事故):本机用户级
  `EXPO_PUBLIC_API_BASE_URL=https://aizhs.top` 在位,所以**当前**产出包扫 `assets/index.android.bundle`
  读到的是 `aizhs.top` 在位、`8802` 零命中 —— 这一型在**这台机上尚未发生**,是 env 缺失时才成立的路径
  (CI / 换机 / 清空用户环境变量)。守卫防的是那条路径,不是已经烧出来的事故。
.PARAMETER WebBaseUrl
  烤进包的 Web 基址(写 EXPO_PUBLIC_WEB_URL)。同上,SSO mobile-auth 与 WebView 域名都取自它。
.PARAMETER AllowLocalBackend
  显式允许产出连回环地址(localhost/127.0.0.1/10.0.2.2)的包,配 `adb reverse` 用。
  **不给这个旗就不许产出连回环的包** —— 缺省直接拒绝构建,而不是等人装到手机上才发现全不通。
#>
param(
  [int]$VersionCode = 0,
  [string]$Abi = '',
  [switch]$FullAbi,
  [switch]$SkipVerify,
  [switch]$ShowVersionCode,
  [string]$ApiBaseUrl = '',
  [string]$WebBaseUrl = '',
  [switch]$AllowLocalBackend,
  [string]$SelfTestApk = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $RepoRoot 'apps/mobile-rn/android'
$Gradle = Join-Path $AndroidDir 'gradlew.bat'

# ---- 后端基址:解析 → 拒绝静默连回环 → 构建后从包里回读复核 ----------------------------------
# 三条不可漂的写法:
#  ① 取值顺序必须与 Metro 实际生效顺序一致(显式参数 > 进程环境 > apps/mobile-rn/.env > config.ts 缺省),
#     少一档就会"脚本以为烤的是 A、包里其实是 B"。
#  ② 判"烤没烤对"不许拿"我传了 env"当证据 —— 必须从产出的 APK 里把 assets/index.android.bundle 读回来
#     查字面量(与"产物存在 ≠ 能力在线"同一条纪律)。
#  ③ 拒绝的出路只有一条:显式传 -ApiBaseUrl/-WebBaseUrl,或明确 -AllowLocalBackend;
#     不许把这一维降级成 warning(那等于把"装到手机上什么都连不通"留给下一个人重新发现)。
function Resolve-DotEnvValue {
  param([string]$EnvFile, [string]$Key)
  if (-not (Test-Path $EnvFile)) { return '' }
  foreach ($line in Get-Content -LiteralPath $EnvFile -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    # .NET 正则不认 Perl 的 \Q…\E(实测抛 "Unrecognized escape sequence \Q"),必须走 [regex]::Escape。
    # 本机 .env 是 gitignored 的,旧自检从没走到这一行 ⇒ 这条缺陷能一路活到真换机/CI 上才炸。
    $m = [regex]::Match($t, '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)$')
    if ($m.Success) { return ($m.Groups[1].Value.Trim().Trim('"', "'")) }
  }
  return ''
}

function Resolve-BakedBackend {
  $envFile = Join-Path $RepoRoot 'apps/mobile-rn/.env'
  $api = if ($ApiBaseUrl) { $ApiBaseUrl } elseif ($env:EXPO_PUBLIC_API_BASE_URL) { $env:EXPO_PUBLIC_API_BASE_URL } else { Resolve-DotEnvValue -EnvFile $envFile -Key 'EXPO_PUBLIC_API_BASE_URL' }
  $web = if ($WebBaseUrl) { $WebBaseUrl } elseif ($env:EXPO_PUBLIC_WEB_URL) { $env:EXPO_PUBLIC_WEB_URL } else { Resolve-DotEnvValue -EnvFile $envFile -Key 'EXPO_PUBLIC_WEB_URL' }
  $apiSrc = if ($ApiBaseUrl) { '参数' } elseif ($env:EXPO_PUBLIC_API_BASE_URL) { '进程环境' } elseif ($api) { '.env' } else { 'config.ts 缺省' }
  $webSrc = if ($WebBaseUrl) { '参数' } elseif ($env:EXPO_PUBLIC_WEB_URL) { '进程环境' } elseif ($web) { '.env' } else { 'config.ts 缺省' }
  if (-not $api) { $api = 'http://localhost:8802' }
  if (-not $web) { $web = 'http://localhost:8801' }
  return [pscustomobject]@{ Api = $api; Web = $web; ApiSrc = $apiSrc; WebSrc = $webSrc }
}

function Test-LoopbackUrl {
  param([string]$Url)
  return ($Url -match '://(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.0\.2\.2)(:|/|$)')
}

function Get-BundleText {
  param([string]$ApkPath)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ApkPath)
  try {
    $entry = $zip.GetEntry('assets/index.android.bundle')
    if (-not $entry) { throw "APK 里没有 assets/index.android.bundle(打包形态变了?拒绝猜)" }
    $ms = New-Object System.IO.MemoryStream
    $s = $entry.Open()
    try { $s.CopyTo($ms) } finally { $s.Dispose() }
    # 逐字节取回再按 Latin1 解:JS bundle 里的 URL 是 ASCII 字面量,Latin1 无损且不会因为
    # Metro 产物里的任意字节序列而解错(解错的表现是"查不到",而"查不到"会被读成"没烤进去")。
    return [System.Text.Encoding]::GetEncoding('ISO-8859-1').GetString($ms.ToArray())
  } finally { $zip.Dispose() }
}

# 目标 ABI 的缺省值只住这一处(本文件在版本树里;机主拍板 2026-10-09,G-977963:收成 arm64-v8a,x86_64,
# 放弃 32 位真机与 x86 32 位模拟器)。
# 为什么**不**拿 apps/mobile-rn/android/gradle.properties 当缺省源:那条路径被
# apps/mobile-rn/.gitignore 的 /android 规则整目录忽略,属 Expo prebuild 的产物 —— 重跑 prebuild 就回到
# 模板四档,刚被放弃的 armeabi-v7a 那一路自己长回来,而它在本机必挂
# (:configureCMakeRelWithDebInfo[armeabi-v7a] 报 unsupported argument 'armv7-a')。
# 所以对那一行只做**一致性判定并大声报**,不取它的值;判据抽成纯函数,自检用构造面逐臂证。
$DefaultAbi = 'arm64-v8a,x86_64'
function Resolve-AbiArg {
  param([string]$Abi, [switch]$FullAbi, [string]$DefaultAbi, [string]$PropsAbi)
  if ($FullAbi) { return @{ Arg = '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64'; Drift = ''; Note = 'FullAbi(显式全量)' } }
  if ($Abi)     { return @{ Arg = "-PreactNativeArchitectures=$Abi"; Drift = ''; Note = '显式 -Abi(不比一致性)' } }
  if (-not $PropsAbi) { return @{ Arg = "-PreactNativeArchitectures=$DefaultAbi"; Drift = ''; Note = '生成工程里读不到该行 ⇒ 一致性未判定(仍按缺省构建)' } }
  if ($PropsAbi -ne $DefaultAbi) { return @{ Arg = "-PreactNativeArchitectures=$DefaultAbi"; Drift = $PropsAbi; Note = "与生成工程不一致:它写 $PropsAbi" } }
  return @{ Arg = "-PreactNativeArchitectures=$DefaultAbi"; Drift = ''; Note = '与生成工程同值' }
}

if ($SelfTestApk -ne '') {
  # 自检档:只量新加的两段判据,不构建。为什么要有它而不是"下次构建顺便看":拒绝臂与回读臂都是
  # "红才有意义"的判据,而一条永不红的判据与一条根本没跑到的判据,在账面上长得一模一样。
  $script:Fail = 0
  function Chk([string]$name, [bool]$cond) {
    if ($cond) { Write-Host "  ok   $name" -ForegroundColor Green }
    else { Write-Host "  FAIL $name" -ForegroundColor Red; $script:Fail += 1 }
  }
  # 标签一律 ASCII:本机控制台代码页是 GBK,中文经重定向会变乱码(CI/取证读到的就是不可判定的一堆方块),
  # 而"跑完了但读不懂"与"没跑"在账面上必须可区分。
  Chk 'loopback-localhost-detected' (Test-LoopbackUrl 'http://localhost:8802')
  Chk 'loopback-10.0.2.2-detected' (Test-LoopbackUrl 'http://10.0.2.2:8801')
  Chk 'loopback-127.0.0.1-detected' (Test-LoopbackUrl 'http://127.0.0.1:8802')
  Chk 'lan-ip-not-loopback' (-not (Test-LoopbackUrl 'http://192.168.1.7:8802'))
  Chk 'prod-domain-not-loopback' (-not (Test-LoopbackUrl 'https://aizhs.top'))
  Chk 'hostname-prefix-localhost-not-loopback' (-not (Test-LoopbackUrl 'https://localhost8802.example/'))
  # 取值优先级:参数 > 进程环境 > .env > config.ts 缺省。这一维错了的表现是「我传了参数却烤了别人的值」。
  $ApiBaseUrl = 'https://param.example'; $WebBaseUrl = 'https://param.example'
  $env:EXPO_PUBLIC_API_BASE_URL = 'https://env.example'; $env:EXPO_PUBLIC_WEB_URL = 'https://env.example'
  $b1 = Resolve-BakedBackend
  Chk 'precedence-param-over-env' ($b1.Api -eq 'https://param.example' -and $b1.ApiSrc -eq '参数')
  $ApiBaseUrl = ''; $WebBaseUrl = ''
  $b2 = Resolve-BakedBackend
  Chk 'precedence-env-when-no-param' ($b2.Api -eq 'https://env.example' -and $b2.ApiSrc -eq '进程环境')
  $env:EXPO_PUBLIC_API_BASE_URL = ''; $env:EXPO_PUBLIC_WEB_URL = ''
  $b3 = Resolve-BakedBackend
  Chk 'fallback-to-config-default-not-empty-string' ($b3.Api.Length -gt 0 -and $b3.Web.Length -gt 0)
  $tmpEnv = Join-Path ([System.IO.Path]::GetTempPath()) ("ihui-dotenv-probe-" + [guid]::NewGuid().ToString('N') + '.env')
  @(
    '# 注释里也写着同名键 EXPO_PUBLIC_API_BASE_URL=should-not-match',
    'OTHER_KEY=zzz',
    'EXPO_PUBLIC_API_BASE_URL="https://env.example/api"',
    'EXPO_PUBLIC_WEB_URL=http://env.example'
  ) | Set-Content -LiteralPath $tmpEnv -Encoding UTF8
  try {
    $got = Resolve-DotEnvValue -EnvFile $tmpEnv -Key 'EXPO_PUBLIC_API_BASE_URL'
    Chk 'dotenv-reader-quoted-value-unwrapped' ($got -eq 'https://env.example/api')
    Chk 'dotenv-reader-ignores-comment-line' ($got -notlike '*should-not-match*')
    Chk 'dotenv-reader-prefix-key-not-confused' (
      (Resolve-DotEnvValue -EnvFile $tmpEnv -Key 'EXPO_PUBLIC_WEB_URL') -eq 'http://env.example'
    )

  Chk 'dotenv-reader-missing-key-returns-empty' (
      (Resolve-DotEnvValue -EnvFile $tmpEnv -Key 'NO_SUCH_KEY') -eq ''
    )
  } finally {
    Remove-Item -LiteralPath $tmpEnv -Force -ErrorAction SilentlyContinue
  }
  Chk 'config-default-counts-as-loopback' ((Test-LoopbackUrl $b3.Api) -and (Test-LoopbackUrl $b3.Web))
  Chk 'default-abi-is-the-two-approved-tiers' ($DefaultAbi -eq 'arm64-v8a,x86_64')
  $a1 = Resolve-AbiArg -Abi '' -FullAbi:$false -DefaultAbi $DefaultAbi -PropsAbi 'arm64-v8a,x86_64'
  Chk 'abi-arm-consistent-no-drift' (($a1.Drift -eq '') -and ($a1.Arg -like '*arm64-v8a,x86_64'))
  $a2 = Resolve-AbiArg -Abi '' -FullAbi:$false -DefaultAbi $DefaultAbi -PropsAbi 'armeabi-v7a,arm64-v8a,x86,x86_64'
  Chk 'abi-drift-detected-and-named' (($a2.Drift -like 'armeabi-v7a*') -and ($a2.Arg -like "*$DefaultAbi*"))
  $a3 = Resolve-AbiArg -Abi 'arm64-v8a' -FullAbi:$false -DefaultAbi $DefaultAbi -PropsAbi 'armeabi-v7a,x86'
  Chk 'abi-explicit-Abi-skips-consistency' (($a3.Arg -like '*=arm64-v8a') -and ($a3.Drift -eq ''))
  $a4 = Resolve-AbiArg -Abi '' -FullAbi:$false -DefaultAbi $DefaultAbi -PropsAbi ''
  Chk 'abi-missing-props-line-is-undetermined-not-silent' (($a4.Drift -eq '') -and ($a4.Note -like '*未判定*'))
  $a5 = Resolve-AbiArg -Abi '' -FullAbi:$true -DefaultAbi $DefaultAbi -PropsAbi ''
  Chk 'abi-fullabi-still-offers-32bit-exit' ($a5.Arg -like '*armeabi-v7a*')
  if (Test-Path $SelfTestApk) {
    $text = Get-BundleText -ApkPath $SelfTestApk
    Chk 'bundle-readable-from-real-apk' ($text.Length -gt 100000)
    Chk 'baked-prod-url-found-in-bundle(positive-control)' ($text.Contains('https://aizhs.top'))
    Chk 'unbaked-url-not-found(negative-control)' (-not $text.Contains('https://not-baked-9f3a2b.example'))
  } else {
    Write-Host "  FAIL apk-unreadable:$SelfTestApk (readback arm did not run; not a pass)" -ForegroundColor Red
    $script:Fail += 1
  }
  Write-Host "`n===== SELFTEST FAILURES=$script:Fail =====" -ForegroundColor ($(if ($script:Fail) { 'Red' } else { 'Green' }))
  exit ($(if ($script:Fail) { 1 } else { 0 }))
}

# 包名解析:先读 app.json 的 android.package,取不到再回落到 android/app/build.gradle 的
# applicationId(android/ 是 Expo prebuild 生成物,但 gradle 真正用的就是它,所以它是权威落点)。
# ⚠️ 2026-09-29 实测修掉的缺陷:apps/mobile-rn/app.json 的 android 段是空的 {} ⇒ 旧写法恒得
# $null,于是下面 `adb shell dumpsys package <空>` 变成 dump **全部应用**,而正则取的是第一个
# versionCode= 匹配 ⇒ 拿到的是机上某个无关 app 的版本号(实测读到 41503031,而本 app 实为
# 41503032),于是"自动定档"从来没对过、且会产出重号或降级的包。两个来源都取不到时必须 throw,
# 绝不允许带空包名去查 —— 静默查错对象比直接失败贵得多。
$RnPackage = $null
$AppJsonPath = Join-Path $RepoRoot 'apps/mobile-rn/app.json'
if (Test-Path -LiteralPath $AppJsonPath) {
  $RnPackage = (Get-Content -Raw -LiteralPath $AppJsonPath | ConvertFrom-Json).android.package
}
if (-not $RnPackage) {
  $GradleApp = Join-Path $AndroidDir 'app/build.gradle'
  if (Test-Path -LiteralPath $GradleApp) {
    $m = Select-String -Path $GradleApp -Pattern "applicationId\s+'([^']+)'" | Select-Object -First 1
    if (-not $m) { $m = Select-String -Path $GradleApp -Pattern 'applicationId\s+"([^"]+)"' | Select-Object -First 1 }
    if ($m) { $RnPackage = $m.Matches[0].Groups[1].Value }
  }
}
if (-not $RnPackage) {
  throw '无法解析 Android 包名:app.json 的 android.package 与 build.gradle 的 applicationId 都取不到。拒绝继续 —— 带空包名跑 dumpsys 会 dump 全部应用,把无关 app 的 versionCode 当成本 app 的。'
}
Write-Host "  包名(现读):$RnPackage" -ForegroundColor DarkGray

function Resolve-AutoVersionCode {
  <#
    返回 @{ Value = <int>; Source = <string> }。
    三条失败路径一律回落 1 但**必须喊出原因** —— 静默用 1 等于把"装不上"重新藏回构建成功里。
  #>
  param([string]$Package)
  # 第二道锁:即使调用方漏判,空包名也绝不进 dumpsys。
  if ([string]::IsNullOrWhiteSpace($Package)) {
    return @{ Value = 1; Source = '包名为空 ⇒ 拒绝查 dumpsys(空包名会 dump 全部应用,把无关 app 的 versionCode 当成本 app 的),回落 1 并在此大声说明' }
  }
  $adb = Get-Command adb.exe -ErrorAction SilentlyContinue
  if (-not $adb) { return @{ Value = 1; Source = 'PATH 里没有 adb.exe ⇒ 无法问机上版本,回落 1' } }
  $dev = & $adb.Source devices 2>$null | Out-String
  if ($dev -notmatch "`tdevice") { return @{ Value = 1; Source = '没有已授权设备在线 ⇒ 无法问机上版本,回落 1' } }
  $dump = ''
  try { $dump = (& $adb.Source shell "dumpsys package $Package" 2>$null) -join "`n" } catch { }
  $m = [regex]::Match($dump, 'versionCode=(\d+)')
  if (-not $m.Success) { return @{ Value = 1; Source = "机上查不到 $Package 的 versionCode(未装或 dumpsys 形态变) ⇒ 回落 1" } }
  $installed = [int]$m.Groups[1].Value
  return @{ Value = $installed + 1; Source = "机上 $Package 现装 versionCode=$installed ⇒ 取 +1" }
}

if ($VersionCode -le 0) {
  $auto = Resolve-AutoVersionCode -Package $RnPackage
  $VersionCode = $auto.Value
  Write-Host "  versionCode 自动定档:$VersionCode —— $($auto.Source)" -ForegroundColor Cyan
}

if ($ShowVersionCode) {
  Write-Host "本次将使用的 versionCode = $VersionCode(未构建)" -ForegroundColor Green
  return
}

Write-Host "`n===== [1/4] 幂等注入 release 签名配置 =====" -ForegroundColor Cyan
Push-Location $RepoRoot
try {
  node scripts/patch-rn-release-signing.mjs
  if ($LASTEXITCODE -ne 0) { throw 'patch-rn-release-signing.mjs 失败' }
} finally { Pop-Location }

Write-Host "`n===== [2/4] 前置检查: keystore + 签名凭据 =====" -ForegroundColor Cyan
$Keystore = "$env:USERPROFILE\.android\ihui-release.keystore"
$GradleProps = "$env:USERPROFILE\.gradle\gradle.properties"
$hasKs = Test-Path $Keystore
$hasProps = (Test-Path $GradleProps) -and (Select-String -Path $GradleProps -Pattern 'IHUI_RELEASE_STORE_FILE' -Quiet)
if (-not $hasKs -or -not $hasProps) {
  Write-Warning "release 签名凭据缺失: keystore=$hasKs, gradle.properties=$hasProps"
  Write-Warning '将回退 debug 签名(APK 仅本机可装)。生成凭据参考:'
  Write-Warning "  1) keytool -genkeypair -keystore `"$Keystore`" -alias ihui-release -keyalg RSA -keysize 2048 -validity 10000"
  Write-Warning '  2) 在 ~/.gradle/gradle.properties 写入 IHUI_RELEASE_STORE_FILE/STORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD'
} else {
  Write-Host "  keystore OK: $Keystore" -ForegroundColor Green
  Write-Host '  签名凭据 OK (~/.gradle/gradle.properties)' -ForegroundColor Green
}

# 缺省 ABI 只住 $DefaultAbi 一处(见文件上方函数定义处的注释:为什么不读 gradle.properties 那一行)。
$PropsAbi = Resolve-DotEnvValue -EnvFile (Join-Path $AndroidDir 'gradle.properties') -Key 'reactNativeArchitectures'
$AbiDecision = Resolve-AbiArg -Abi $Abi -FullAbi:$FullAbi -DefaultAbi $DefaultAbi -PropsAbi $PropsAbi
$abiArg = $AbiDecision.Arg
if ($AbiDecision.Drift) {
  Write-Warning $AbiDecision.Note
} else {
  Write-Host "  ABI 依据: $($AbiDecision.Note)" -ForegroundColor DarkGray
}

Write-Host "`n===== [2.5/4] 后端基址对账(烤进包里的那个) =====" -ForegroundColor Cyan
$Backend = Resolve-BakedBackend
Write-Host "  API = $($Backend.Api)   (来源:$($Backend.ApiSrc))" -ForegroundColor Gray
Write-Host "  WEB = $($Backend.Web)   (来源:$($Backend.WebSrc))" -ForegroundColor Gray
$loop = @()
if (Test-LoopbackUrl $Backend.Api) { $loop += "API=$($Backend.Api)" }
if (Test-LoopbackUrl $Backend.Web) { $loop += "WEB=$($Backend.Web)" }
if ($loop.Count -gt 0 -and -not $AllowLocalBackend) {
  # 这条拒绝必须自带一行 ASCII:本机控制台代码页是 GBK,中文经重定向会被吃掉(AGENTS §26 实测同型),
  # 而"拒绝得看不懂"等于没给出路 —— 出路必须是任何人、任何码页下都能照着敲的。
  Write-Error ("REFUSED: release build would bake a loopback backend: " + ($loop -join ', ') +
    " | why: this path runs gradlew assembleRelease (NOT eas), so eas.json production env never applies." +
    " | fix: pass -ApiBaseUrl/-WebBaseUrl explicitly, or add -AllowLocalBackend together with 'adb reverse'.")
  throw (
    "拒绝产出连回环后端的 release 包:$($loop -join ', ')。" +
    "这条链走 gradlew assembleRelease、不经 eas,所以 eas.json 的 production env 不会生效;" +
    "取值来源为「$($Backend.ApiSrc)/$($Backend.WebSrc)」说明没人显式给过。" +
    "两种正解:① 显式传 -ApiBaseUrl/-WebBaseUrl(生产或局域网地址);② 真要做本机联调就加 -AllowLocalBackend 并配 adb reverse。" +
    "禁止的出路:删掉这一步、或把它降级成 warning —— 那等于把「装上手机才发现全不通」留给下一个人。"
  )
}
# 显式回写,让 Metro 与脚本判决读同一份值(不依赖调用方 shell 里恰好 export 过)。
$env:EXPO_PUBLIC_API_BASE_URL = $Backend.Api
$env:EXPO_PUBLIC_WEB_URL = $Backend.Web
if ($AllowLocalBackend) { Write-Warning 'AllowLocalBackend:本次包的基址含回环地址,只能在配了 adb reverse 的机器上验证' }

Write-Host "`n===== [3/4] gradlew assembleRelease (versionCode=$VersionCode) =====" -ForegroundColor Cyan
Write-Host "  ABI: $($abiArg -replace '^.*=','')"
if (-not (Test-Path $Gradle)) { throw "gradlew 不存在: $Gradle (请先 expo prebuild)" }

Push-Location $AndroidDir
try {
  & .\gradlew.bat :app:assembleRelease $abiArg "-PversionCode=$VersionCode" --console=plain
  if ($LASTEXITCODE -ne 0) { throw "gradle assembleRelease 失败 (exit=$LASTEXITCODE)" }
} finally { Pop-Location }

$Apk = Join-Path $AndroidDir 'app/build/outputs/apk/release/app-release.apk'
if (-not (Test-Path $Apk)) { throw "产物未找到: $Apk" }
$SizeMB = [math]::Round((Get-Item $Apk).Length / 1MB, 1)

Write-Host "`n===== [3.5/4] 从包里回读烤进去的后端(不信任「我传了 env」) =====" -ForegroundColor Cyan
$bundle = Get-BundleText -ApkPath $Apk
Write-Host "  bundle 字节:$($bundle.Length)(Latin1 计数,用于字符串包含判定)" -ForegroundColor Gray
$miss = @()
foreach ($pair in @(@{ k = 'API'; v = $Backend.Api }, @{ k = 'WEB'; v = $Backend.Web })) {
  if (-not $bundle.Contains($pair.v)) { $miss += "$($pair.k)=$($pair.v)" }
}
if ($miss.Count -gt 0) {
  throw "包里找不到应被烤入的后端基址:$($miss -join ', ') —— 期望与实际分叉了,不能当构建成功交付。"
}
# 反向对照:非本机联调的包,绝不允许残留 config.ts 的回环缺省值。
if (-not $AllowLocalBackend) {
  $stray = @('http://localhost:8802', 'http://localhost:8801', 'http://10.0.2.2:8802', 'http://10.0.2.2:8801') |
    Where-Object { $bundle.Contains($_) }
  if ($stray.Count -gt 0) {
    throw "包里残留回环缺省基址:$($stray -join ', ')(生产包不得含这些)—— 说明有第二处把缺省值写进了产物。"
  }
}
Write-Host "  回读一致:API/WEB 两个基址都真在包里,且无回环残留 ✓" -ForegroundColor Green

Write-Host "`n===== [4/4] 验签 + 报告 =====" -ForegroundColor Cyan
if (-not $SkipVerify) {
  $BuildTools = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
  $ApkSigner = Join-Path $BuildTools.FullName 'apksigner.bat'
  if (Test-Path $ApkSigner) {
    & $ApkSigner verify --print-certs $Apk 2>&1 | Select-String 'Signer #1 certificate DN' | ForEach-Object { Write-Host "  $($_.Line.Trim())" -ForegroundColor Green }
    if ($LASTEXITCODE -ne 0) { Write-Warning '验签失败(签名无效!)' } else { Write-Host '  签名有效 ✓' -ForegroundColor Green }
  } else { Write-Warning "apksigner 未找到: $ApkSigner (跳过验签)" }
}

Write-Host "`n========== BUILD RELEASE DONE ==========" -ForegroundColor Green
Write-Host "  APK:      $Apk"
Write-Host "  大小:     ${SizeMB} MB"
Write-Host "  version:  $((Get-Content (Join-Path $RepoRoot 'apps/mobile-rn/package.json') -Raw | ConvertFrom-Json).version) (code=$VersionCode)"
Write-Host "  安装测试: adb install -r `"$Apk`""
Write-Host "========================================"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠