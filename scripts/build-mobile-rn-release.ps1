# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

#requires -Version 7
<#
.SYNOPSIS
  mobile-rn release APK 一键构建(签名流水线, 2026-09-03 P2 落地)
.DESCRIPTION
  流程:
    1. 幂等注入 release 签名配置(node scripts/patch-rn-release-signing.mjs,
       android/ 为 Expo prebuild 生成物, prebuild 后必须重打)
    2. 前置检查: keystore(~/.android/ihui-release.keystore) + 签名凭据(~/.gradle/gradle.properties)
    3. gradlew assembleRelease(前台执行——后台任务会被环境 ~2min 终结)
    4. apksigner 验签 + 产物报告

  签名凭据设计(不入库):
    - keystore: C:/Users/Administrator/.android/ihui-release.keystore(仓库外)
    - 密码:    用户级 ~/.gradle/gradle.properties 的 IHUI_RELEASE_* 属性(Gradle 自动读取)
    - build.gradle 未检测到凭据时 release 回退 debug 签名(仅本机可装, 不可上架)

  用法:
    pwsh -File scripts/build-mobile-rn-release.ps1                  # 默认三 ABI(arm64-v8a+armeabi-v7a+x86_64)
    pwsh -File scripts/build-mobile-rn-release.ps1 -VersionCode 2   # 指定版本号(上架必须递增)
    pwsh -File scripts/build-mobile-rn-release.ps1 -Abi x86_64      # 单 ABI(模拟器/快速验证)
    pwsh -File scripts/build-mobile-rn-release.ps1 -FullAbi         # 含 x86(32位, 一般不必要)
.PARAMETER VersionCode
  Android versionCode(上架递增)。缺省 0 = **自动**:有机身时取"机上已装版本 + 1",无机身/取不到时回落 1 并大声说明。
  为什么默认不能是 1:装机取证时 `adb install -r` 遇 versionCode 低于机上值会直接
  `INSTALL_FAILED_VERSION_DOWNGRADE` —— 装不上又不报错到底,于是那一轮"实测"量的仍是旧包,
  而账面看起来"构建成功"(2026-09-27 实测撞在这一步)。
.PARAMETER ShowVersionCode
  只解析并打印本次会用的 versionCode 与依据,不构建(给取证脚本与人工先确认落点用)
.PARAMETER Abi
  目标 ABI(逗号分隔, 如 arm64-v8a,armeabi-v7a); 缺省为 arm64-v8a,armeabi-v7a,x86_64(不含 32 位 x86)
.PARAMETER FullAbi
  构建全部 ABI(含 x86 32 位)
.PARAMETER SkipVerify
  跳过 apksigner 验签
#>
param(
  [int]$VersionCode = 0,
  [string]$Abi = '',
  [switch]$FullAbi,
  [switch]$SkipVerify,
  [switch]$ShowVersionCode
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$AndroidDir = Join-Path $RepoRoot 'apps/mobile-rn/android'
$Gradle = Join-Path $AndroidDir 'gradlew.bat'

# 包名从 app.json 现读,不抄第二份(appId 改了这里会跟着走)
$RnPackage = (Get-Content -Raw -LiteralPath (Join-Path $RepoRoot 'apps/mobile-rn/app.json') |
  ConvertFrom-Json).android.package

function Resolve-AutoVersionCode {
  <#
    返回 @{ Value = <int>; Source = <string> }。
    三条失败路径一律回落 1 但**必须喊出原因** —— 静默用 1 等于把"装不上"重新藏回构建成功里。
  #>
  param([string]$Package)
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

# 目标 ABI: -Abi 优先 > -FullAbi 全量 > 默认三 ABI
$abiArg = ''
if ($FullAbi) { $abiArg = '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64' }
elseif ($Abi)  { $abiArg = "-PreactNativeArchitectures=$Abi" }
else           { $abiArg = '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64' }

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
