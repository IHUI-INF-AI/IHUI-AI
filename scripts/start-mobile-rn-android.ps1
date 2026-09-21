# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  mobile-rn Android 模拟器一键启动(替代 7 步手工链路,2026-09-03 收敛)
.DESCRIPTION
  顺序:
    1. 幂等注入 RN deepFreeze 兼容补丁(node scripts/patch-rn-deepfreeze.mjs)
    2. 前置检查:adb / 模拟器(无设备则软渲染启动 ihui_api36)/ 后端 8802(缺失仅告警)
    3. 确保 Metro 在 8081(未监听则后台起 expo,日志 tmp/metro-mobile-rn.log)
    4. 构建 debug APK(仅当缺失或 -Build;x86_64 单 ABI;前台执行——后台任务会被环境 ~2min 终结)
    5. 安装到设备 + adb reverse tcp:8081 tcp:8081
    6. 启动 App + 延时截图(tmp/mobile-screen-*.png)

  用法:
    pwsh -File scripts/start-mobile-rn-android.ps1              # 标准启动(APK 存在则跳过构建)
    pwsh -File scripts/start-mobile-rn-android.ps1 -Build       # 强制 gradle 重建 APK
    pwsh -File scripts/start-mobile-rn-android.ps1 -NoEmulator  # 不自动起模拟器(人工已开)
    pwsh -File scripts/start-mobile-rn-android.ps1 -Avd <name>  # 指定 AVD(默认 ihui_api36)
.PARAMETER Build
  强制重新构建 debug APK(默认 APK 存在即跳过)
.PARAMETER NoEmulator
  不自动启动模拟器;无在线设备时报错退出
.PARAMETER Avd
  模拟器 AVD 名,默认 ihui_api36
.PARAMETER WaitSec
  启动 App 后等待秒数,默认 40(首次 bundle 编译需更久,可调大)
.NOTES
  要求 pwsh7。本机 AVD 唯一可靠启动=软渲染(-gpu swiftshader_indirect),gfxstream+RTX3060 组合会卡死;
  Metro 必须 8081(App 默认 dev URL);adb reverse 只解决 Metro,business API 走 10.0.2.2:8802 直连。
  红屏排查速查表见 skill:mobile-rn-android-emulator。
#>
[CmdletBinding()]
param(
  [switch]$Build,
  [switch]$NoEmulator,
  [string]$Avd = 'ihui_api36',
  [int]$WaitSec = 40
)

$ErrorActionPreference = 'Stop'
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..')).Path

# ============================================================
# 路径常量
# ============================================================
$Sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Users\Administrator\AppData\Local\Android\Sdk' }
$Adb = Join-Path $Sdk 'platform-tools\adb.exe'
$EmulatorBin = Join-Path $Sdk 'emulator\emulator.exe'
$MobileRn = Join-Path $RepoRoot 'apps\mobile-rn'
$Apk = Join-Path $MobileRn 'android\app\build\outputs\apk\debug\app-debug.apk'
$TmpDir = Join-Path $RepoRoot 'tmp'
$MetroLog = Join-Path $TmpDir 'metro-mobile-rn.log'
$PatchScript = Join-Path $ScriptRoot 'patch-rn-deepfreeze.mjs'

# ============================================================
# 颜色输出
# ============================================================
function Write-Info([string]$msg) { Write-Host "  [INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]    $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN]  $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "  [ERR]   $msg" -ForegroundColor Red }
function Write-Hdr([string]$msg)  {
  Write-Host ''
  Write-Host ('=' * 70) -ForegroundColor DarkGray
  Write-Host "  $msg" -ForegroundColor White
  Write-Host ('=' * 70) -ForegroundColor DarkGray
}

# ============================================================
# 工具函数
# ============================================================
function Test-PortInUse([int]$port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  return ($null -ne $conn -and $conn.Count -gt 0)
}

function Get-OnlineDeviceSerial {
  if (-not (Test-Path $Adb)) { throw "未找到 adb: $Adb(检查 ANDROID_HOME 或 SDK 路径)" }
  $out = & $Adb devices 2>$null
  foreach ($line in $out) {
    if ($line -match '^(emulator-\d+)\s+device$') { return $Matches[1] }
  }
  return $null
}

function Wait-BootCompleted([string]$serial, [int]$timeoutSec = 240) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    $boot = (& $Adb -s $serial shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($boot -eq '1') { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

# ============================================================
# 1. deepFreeze 补丁(幂等)
# ============================================================
function Invoke-RnPatch {
  Write-Hdr 'RN deepFreeze 兼容补丁(幂等)'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Write-Err '未找到 node'; exit 1 }
  if (-not (Test-Path $PatchScript)) { Write-Err "补丁脚本缺失: $PatchScript"; exit 1 }
  & node $PatchScript
  if ($LASTEXITCODE -ne 0) {
    Write-Err "deepFreeze 补丁失败(exit=$LASTEXITCODE),请先 pnpm install 再重试"
    exit 1
  }
}

# ============================================================
# 2. 设备准备(已有设备复用;无则软渲染启动)
# ============================================================
function Ensure-Device {
  Write-Hdr '设备检查'
  $serial = Get-OnlineDeviceSerial
  if ($serial) { Write-Ok "在线设备: $serial(复用)"; return $serial }

  if ($NoEmulator) { Write-Err '无在线设备且指定 -NoEmulator,退出'; exit 1 }
  if (-not (Test-Path $EmulatorBin)) { Write-Err "未找到 emulator: $EmulatorBin"; exit 1 }
  Write-Info "启动模拟器 $Avd(软渲染 swiftshader_indirect,boot 最长 240s)..."
  Start-Process -FilePath $EmulatorBin -ArgumentList @('-avd', $Avd, '-gpu', 'swiftshader_indirect', '-no-boot-anim') -WindowStyle Hidden | Out-Null
  if (-not (Wait-BootCompleted 'emulator-5554' 240)) { Write-Err '模拟器 240s 未完成 boot,查 qemu 日志/换 AVD'; exit 1 }
  Start-Sleep -Seconds 2
  $serial = Get-OnlineDeviceSerial
  if (-not $serial) { Write-Err 'adb 仍无在线设备'; exit 1 }
  Write-Ok "模拟器就绪: $serial"
  return $serial
}

# ============================================================
# 3. Metro(8081,缺失则后台起)
# ============================================================
function Ensure-Metro {
  Write-Hdr 'Metro(8081)'
  if (Test-PortInUse 8081) { Write-Ok '8081 已在监听,复用现有 Metro'; return }
  if (-not (Test-Path $TmpDir)) { New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null }
  Write-Info '启动 Metro(隐藏 cmd.exe,SIGINT 免疫,日志 tmp/metro-mobile-rn.log)...'
  $proc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', "cd /d `"$MobileRn`" && set CI=1&& set EXPO_NO_TELEMETRY=1&& npx expo start --port 8081") `
    -WorkingDirectory $MobileRn `
    -WindowStyle Hidden `
    -RedirectStandardOutput $MetroLog `
    -RedirectStandardError "$MetroLog.err" `
    -PassThru
  Write-Ok "Metro 已派生 PID=$($proc.Id)"
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri 'http://localhost:8081/status' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { Write-Ok 'Metro /status 就绪'; return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  Write-Warn "Metro 90s 未就绪,继续执行(日志: $MetroLog)"
}

# ============================================================
# 4. gradle 构建(前台;后台任务会被环境 ~2min 终结)
# ============================================================
function Invoke-GradleBuild {
  Write-Hdr 'Gradle debug APK'
  if (-not $Build -and (Test-Path $Apk)) {
    Write-Ok "APK 已存在,跳过构建(强制重建加 -Build): $Apk"
    return
  }
  Write-Info 'assembleDebug(x86_64 单 ABI,前台执行,预计 1-5 分钟)...'
  $buildLog = Join-Path $TmpDir 'gradle-mobile-rn.log'
  Push-Location (Join-Path $MobileRn 'android')
  try {
    & .\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --console=plain *> $buildLog
    if ($LASTEXITCODE -ne 0) { throw "gradle 构建失败 exit=$LASTEXITCODE(日志: $buildLog)" }
  } finally { Pop-Location }
  Write-Ok "构建成功 → $Apk"
}

# ============================================================
# 5. 安装 + reverse
# ============================================================
function Install-ToDevice([string]$serial) {
  Write-Hdr "安装到 $serial"
  if (-not (Test-Path $Apk)) { Write-Err "APK 不存在: $Apk"; exit 1 }
  & $Adb -s $serial install -r $Apk 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { Write-Err 'APK 安装失败'; exit 1 }
  & $Adb -s $serial reverse --remove-all 2>$null
  & $Adb -s $serial reverse tcp:8081 tcp:8081
  Write-Ok 'adb reverse tcp:8081 tcp:8081 已设置'
}

# ============================================================
# 6. 启动 App + 截图
# ============================================================
function Launch-App([string]$serial) {
  Write-Hdr "启动 App(等待 ${WaitSec}s 后截图)"
  & $Adb -s $serial shell am force-stop ai.ihui.mobile 2>$null
  Start-Sleep -Seconds 1
  & $Adb -s $serial shell am start -n ai.ihui.mobile/.MainActivity 2>&1 | Out-Host
  Start-Sleep -Seconds $WaitSec

  if (-not (Test-Path $TmpDir)) { New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null }
  $shot = Join-Path $TmpDir ("mobile-screen-{0:yyyyMMdd-HHmmss}.png" -f (Get-Date))
  # exec-out 为二进制输出,须用 Start-Process 重定向保字节(PS 管道会按文本解码损坏 PNG)
  Start-Process -FilePath $Adb -ArgumentList @('-s', $serial, 'exec-out', 'screencap', '-p') `
    -RedirectStandardOutput $shot -NoNewWindow -Wait | Out-Null
  if ((Get-Item $shot).Length -gt 1000) {
    Write-Ok "截图已保存: $shot"
  } else {
    Write-Warn "截图过小(<1KB),App 可能仍在加载(红屏排查见 skill:mobile-rn-android-emulator)"
  }
}

# ============================================================
# Main
# ============================================================
Write-Hdr 'mobile-rn Android 一键启动(2026-09-03 流程)'
Write-Info "repo: $RepoRoot"
Write-Info "sdk:  $Sdk"

# 后端告警(不阻塞:adb reverse 只解决 Metro,API 走 10.0.2.2:8802)
if (-not (Test-PortInUse 8802)) {
  Write-Warn '后端 8802 未监听:App 内登录/API 将失败。请先运行 pwsh -File scripts/start-dev.ps1'
} else {
  Write-Ok '后端 8802 监听中'
}

Invoke-RnPatch
$serial = Ensure-Device
Ensure-Metro
Invoke-GradleBuild
Install-ToDevice $serial
Launch-App $serial

Write-Hdr '完成'
Write-Ok "设备: $serial | APK: $Apk"
Write-Ok "Metro 日志: $MetroLog | 截图: $TmpDir\mobile-screen-*.png"
Write-Info '提示:首次 bundle 编译需 1-3 分钟;若红屏且 Metro 无请求,检查 reverse(tcp:8081)与端口'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
