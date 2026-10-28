# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# IHUI CLI PowerShell 一键安装脚本
# 用法: iwr -useb https://aizhs.top/install.ps1 | iex
# 依赖: Node.js 20+(自动检测,缺失则报错引导安装;优先走 GitHub binary 下载,失败降级 npm)
# 同源说明: 与根目录 scripts/install.ps1 为同源双分发版本(根目录版是 aizhs.top 实际服务的版本,本目录版随 npm 包/仓库分发),两者能力保持一致。
$ErrorActionPreference = 'Stop'

$GITHUB_REPO = 'IHUI-INF-AI/IHUI-AI'
$NPM_PACKAGE = 'ihui-cli'
$INSTALL_DIR = Join-Path $env:LOCALAPPDATA 'IHUI\bin'
$TEMP_DIR = $null

function Info($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Warn($m) { Write-Host "⚠ $m" -ForegroundColor Yellow }
function Fatal($m) { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }

# 0. 参数解析(--version 或环境变量 IHUI_VERSION 指定版本)
$INSTALL_VERSION = if ($env:IHUI_VERSION) { $env:IHUI_VERSION } else { 'latest' }
if ($args.Count -gt 0) {
  for ($i = 0; $i -lt $args.Count; $i++) {
    switch ($args[$i]) {
      { $_ -in @('-Version', '--version', '-v') } {
        $INSTALL_VERSION = $args[$i + 1]
        $i++
      }
      { $_ -in @('-Help', '--help', '-h') } {
        Write-Host "IHUI CLI 安装脚本"
        Write-Host ""
        Write-Host "用法:"
        Write-Host "  iwr -useb https://aizhs.top/install.ps1 | iex"
        Write-Host "  iwr -useb https://aizhs.top/install.ps1 | iex -Version 1.0.0"
        Write-Host ""
        Write-Host "环境变量:"
        Write-Host "  IHUI_VERSION  指定版本 (默认: latest)"
        exit 0
      }
      default { Fatal "未知参数: $($args[$i])" }
    }
  }
}

Write-Host "IHUI AI Coding Agent — 安装中..." -ForegroundColor Cyan

# ---------- 平台 / 架构检测(binary 通道) ----------
function Detect-Platform {
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture

  switch ($arch) {
    "X64"   { $script:ARCH = "x64" }
    "Arm64" { $script:ARCH = "arm64" }
    default {
      # 回退到环境变量
      $procArch = $env:PROCESSOR_ARCHITECTURE
      switch ($procArch) {
        "AMD64" { $script:ARCH = "x64" }
        "ARM64" { $script:ARCH = "arm64" }
        default {
          Fatal "不支持的架构: $procArch (仅支持 x64 / arm64)"
        }
      }
    }
  }

  Info "检测到平台: windows/$script:ARCH"
}

# ---------- 版本号解析(binary 通道) ----------
function Resolve-Version {
  if ($INSTALL_VERSION -eq "latest") {
    Info "解析最新版本..."
    try {
      $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$GITHUB_REPO/releases/latest" -UseBasicParsing
      $script:LATEST_TAG = $release.tag_name
      $script:VERSION_NUM = $script:LATEST_TAG -replace "^cli-v", ""
      Info "最新版本: $($script:VERSION_NUM) (tag: $($script:LATEST_TAG))"
    } catch {
      Warn "无法获取最新版本号,降级到 npm 安装"
      return $false
    }
  } else {
    $script:VERSION_NUM = $INSTALL_VERSION
    $script:LATEST_TAG = "cli-v$INSTALL_VERSION"
    Info "指定版本: $INSTALL_VERSION"
  }
  return $true
}

# ---------- 下载 binary(binary 通道) ----------
function Download-Binary {
  $assetName = "ihui-windows-$script:ARCH.zip"

  if ($INSTALL_VERSION -eq "latest") {
    $downloadUrl = "https://github.com/$GITHUB_REPO/releases/latest/download/$assetName"
  } else {
    $downloadUrl = "https://github.com/$GITHUB_REPO/releases/download/cli-v$script:VERSION_NUM/$assetName"
  }

  Info "下载: $downloadUrl"
  $script:TEMP_DIR = Join-Path $env:TEMP "ihui-install-$(Get-Random)"
  New-Item -ItemType Directory -Path $script:TEMP_DIR -Force | Out-Null

  $zipPath = Join-Path $script:TEMP_DIR $assetName
  try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
  } catch {
    Warn "下载 binary 失败: $($_.Exception.Message)"
    return $false
  }

  Info "解压..."
  try {
    Expand-Archive -Path $zipPath -DestinationPath $script:TEMP_DIR -Force
  } catch {
    Warn "解压失败: $($_.Exception.Message)"
    return $false
  }

  $exePath = Join-Path $script:TEMP_DIR "ihui.exe"
  if (-not (Test-Path $exePath)) {
    Warn "解压后未找到 ihui.exe"
    return $false
  }

  return $true
}

# ---------- 安装 binary 到系统(binary 通道) ----------
function Install-BinaryToPath {
  $exePath = Join-Path $script:TEMP_DIR "ihui.exe"

  Info "安装到 $INSTALL_DIR"
  if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
  }

  Copy-Item -Path $exePath -Destination (Join-Path $INSTALL_DIR "ihui.exe") -Force

  # 添加到用户 PATH
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if ($userPath -notlike "*$INSTALL_DIR*") {
    Info "添加 $INSTALL_DIR 到用户 PATH"
    $newPath = if ($userPath) { "$userPath;$INSTALL_DIR" } else { $INSTALL_DIR }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    # 当前会话也生效
    $env:Path = "$env:Path;$INSTALL_DIR"
  }
}

# ---------- npm 降级安装(原有 npm 通道收拢为降级路径) ----------
function Install-ViaNpm {
  # 1. 检测 Node.js
  try { $nodeVer = (node -v) } catch {
    Fatal "未检测到 Node.js,请先安装 Node.js 20+ (https://nodejs.org)"
  }
  $major = [int]($nodeVer -replace '^v','' -split '\.')[0]
  if ($major -lt 20) { Fatal "Node.js 版本过低(当前 $nodeVer),需 20+ (https://nodejs.org)" }
  Info "Node.js $nodeVer"

  # 2. 选择包管理器(npm 优先,降级 pnpm)
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    $inst = 'npm install -g'
  } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $inst = 'pnpm add -g'
  } else {
    Fatal "未检测到 npm/pnpm,请先安装 npm (随 Node.js 附带)"
  }

  # 3. 全局安装(需要管理员权限,失败提示;支持指定版本)
  if ($INSTALL_VERSION -eq 'latest') {
    $pkg = $NPM_PACKAGE
  } else {
    $pkg = "$NPM_PACKAGE@$script:VERSION_NUM"
  }
  Invoke-Expression "$inst $pkg"
  if ($LASTEXITCODE -ne 0) {
    Warn "全局安装失败,尝试以管理员权限重试..."
    Start-Process -FilePath "$inst".Split(' ')[0] `
      -ArgumentList ($inst -replace '^\S+\s*', '') -ArgumentList @(" $pkg") `
      -Verb RunAs -Wait -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) { Fatal "安装失败,请检查网络或手动运行: $inst $pkg" }
  }
}

# ---------- 清理(binary 临时目录) ----------
function Cleanup {
  if ($script:TEMP_DIR -and (Test-Path $script:TEMP_DIR)) {
    Remove-Item -Path $script:TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ---------- 主流程:优先 binary 下载安装,失败降级 npm ----------
try {
  Detect-Platform

  # 优先尝试 binary 安装
  $binaryOk = $false
  if (Resolve-Version) {
    $binaryOk = Download-Binary
  }

  if ($binaryOk) {
    Install-BinaryToPath
  } else {
    Warn "降级到 npm 安装方式"
    Install-ViaNpm
  }


# 4. 验证
$ihui = Get-Command ihui -ErrorAction SilentlyContinue
if ($ihui) {
  $ver = try { (ihui --version 2>$null) } catch { 'unknown' }
  Info "安装成功: ihui $ver"
  Write-Host "  运行 ihui 进入交互式 REPL" -ForegroundColor White
  Write-Host "  文档: https://aizhs.top" -ForegroundColor White
} else {
  Warn "ihui 未加入 PATH,请将 npm 全局 bin 目录加入 PATH"
  Write-Host "  查询全局 bin: npm prefix -g" -ForegroundColor White
}
} finally {
  Cleanup
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
