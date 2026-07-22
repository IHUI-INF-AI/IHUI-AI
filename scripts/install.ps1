# IHUI AI CLI — 一键安装脚本 (Windows PowerShell)
# 用法: irm https://ihui.ai/install.ps1 | iex
#   或: irm https://ihui.ai/install.ps1 | iex -Version 1.0.0
# PowerShell 5.1+ 兼容

$ErrorActionPreference = "Stop"

$GITHUB_REPO = "IHUI-INF-AI/IHUI-AI"
$NPM_PACKAGE = "@ihui/cli"
$INSTALL_VERSION = if ($env:IHUI_VERSION) { $env:IHUI_VERSION } else { "latest" }
$INSTALL_DIR = Join-Path $env:LOCALAPPDATA "IHUI\bin"
$TEMP_DIR = $null

function Write-Log {
    param([string]$Message)
    Write-Host "[ihui] $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[ihui] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ihui] $Message" -ForegroundColor Red
}

# ---------- 参数解析 ----------
if ($args.Count -gt 0) {
    for ($i = 0; $i -lt $args.Count; $i++) {
        switch ($args[$i]) {
            { $_ -in @("-Version", "--version", "-v") } {
                $INSTALL_VERSION = $args[$i + 1]
                $i++
            }
            { $_ -in @("-Help", "--help", "-h") } {
                Write-Host "IHUI AI CLI 安装脚本"
                Write-Host ""
                Write-Host "用法:"
                Write-Host "  irm https://ihui.ai/install.ps1 | iex"
                Write-Host "  irm https://ihui.ai/install.ps1 | iex -Version 1.0.0"
                Write-Host ""
                Write-Host "环境变量:"
                Write-Host "  IHUI_VERSION  指定版本 (默认: latest)"
                exit 0
            }
            default {
                Write-Err "未知参数: $($args[$i])"
                exit 1
            }
        }
    }
}

# ---------- 架构检测 ----------
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
                    Write-Err "不支持的架构: $procArch (仅支持 x64 / arm64)"
                    exit 1
                }
            }
        }
    }

    Write-Log "检测到平台: windows/$script:ARCH"
}

# ---------- 版本号解析 ----------
function Resolve-Version {
    if ($INSTALL_VERSION -eq "latest") {
        Write-Log "解析最新版本..."
        try {
            $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$GITHUB_REPO/releases/latest" -UseBasicParsing
            $script:LATEST_TAG = $release.tag_name
            $script:VERSION_NUM = $script:LATEST_TAG -replace "^cli-v", ""
            Write-Log "最新版本: $($script:VERSION_NUM) (tag: $($script:LATEST_TAG))"
        } catch {
            Write-Warn "无法获取最新版本号,降级到 npm 安装"
            return $false
        }
    } else {
        $script:VERSION_NUM = $INSTALL_VERSION
        $script:LATEST_TAG = "cli-v$INSTALL_VERSION"
        Write-Log "指定版本: $INSTALL_VERSION"
    }
    return $true
}

# ---------- 下载 binary ----------
function Download-Binary {
    $assetName = "ihui-windows-$script:ARCH.zip"

    if ($INSTALL_VERSION -eq "latest") {
        $downloadUrl = "https://github.com/$GITHUB_REPO/releases/latest/download/$assetName"
    } else {
        $downloadUrl = "https://github.com/$GITHUB_REPO/releases/download/cli-v$script:VERSION_NUM/$assetName"
    }

    Write-Log "下载: $downloadUrl"
    $script:TEMP_DIR = Join-Path $env:TEMP "ihui-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $script:TEMP_DIR -Force | Out-Null

    $zipPath = Join-Path $script:TEMP_DIR $assetName
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Warn "下载 binary 失败: $($_.Exception.Message)"
        return $false
    }

    Write-Log "解压..."
    try {
        Expand-Archive -Path $zipPath -DestinationPath $script:TEMP_DIR -Force
    } catch {
        Write-Warn "解压失败: $($_.Exception.Message)"
        return $false
    }

    $exePath = Join-Path $script:TEMP_DIR "ihui.exe"
    if (-not (Test-Path $exePath)) {
        Write-Warn "解压后未找到 ihui.exe"
        return $false
    }

    return $true
}

# ---------- 通过 npm 安装 ----------
function Install-ViaNpm {
    Write-Log "尝试通过 npm 安装..."

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Err "未检测到 Node.js,请先安装 Node.js >= 20.10.0 (https://nodejs.org)"
        exit 1
    }

    $nodeVersion = (node -v) -replace "v", ""
    $nodeMajor = ($nodeVersion -split "\.")[0]
    if ([int]$nodeMajor -lt 20) {
        Write-Err "Node.js 版本过低 ($nodeVersion),需要 >= 20.10.0"
        exit 1
    }

    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-Err "未检测到 npm,请先安装 npm"
        exit 1
    }

    Write-Log "Node.js $nodeVersion 检测通过"

    if ($INSTALL_VERSION -eq "latest") {
        Write-Log "执行: npm install -g $NPM_PACKAGE"
        npm install -g $NPM_PACKAGE
    } else {
        Write-Log "执行: npm install -g $NPM_PACKAGE@$script:VERSION_NUM"
        npm install -g "$NPM_PACKAGE@$script:VERSION_NUM"
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm 安装失败"
        exit 1
    }

    Write-Log "npm 安装成功"
}

# ---------- 安装 binary 到系统 ----------
function Install-BinaryToPath {
    $exePath = Join-Path $script:TEMP_DIR "ihui.exe"

    Write-Log "安装到 $INSTALL_DIR"
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    Copy-Item -Path $exePath -Destination (Join-Path $INSTALL_DIR "ihui.exe") -Force

    # 添加到用户 PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$INSTALL_DIR*") {
        Write-Log "添加 $INSTALL_DIR 到用户 PATH"
        $newPath = if ($userPath) { "$userPath;$INSTALL_DIR" } else { $INSTALL_DIR }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        # 当前会话也生效
        $env:Path = "$env:Path;$INSTALL_DIR"
    }
}

# ---------- 验证安装 ----------
function Verify-Install {
    $ihuiPath = Join-Path $INSTALL_DIR "ihui.exe"
    if (Test-Path $ihuiPath) {
        Write-Log "安装成功" -ForegroundColor Green
        Write-Host ""
        & $ihuiPath --version
        Write-Host ""
        Write-Log "运行 'ihui --help' 查看完整命令列表"
        Write-Log "注意: 新打开的终端窗口才会生效 PATH 更新"
    } else {
        # 检查 npm 全局安装
        $ihuiCmd = Get-Command ihui -ErrorAction SilentlyContinue
        if ($ihuiCmd) {
            Write-Log "安装成功 (npm 全局)" -ForegroundColor Green
            Write-Host ""
            ihui --version
            Write-Host ""
            Write-Log "运行 'ihui --help' 查看完整命令列表"
        } else {
            Write-Err "安装可能未完成,ihui 未在 PATH 中"
            Write-Err "请重新打开 PowerShell 窗口"
            exit 1
        }
    }
}

# ---------- 清理 ----------
function Cleanup {
    if ($script:TEMP_DIR -and (Test-Path $script:TEMP_DIR)) {
        Remove-Item -Path $script:TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
}

try {
    Write-Log "IHUI AI CLI 安装程序"
    Write-Log "版本: $INSTALL_VERSION"
    Write-Host ""

    Detect-Platform

    # 优先尝试 binary 安装
    $binaryOk = $false
    if (Resolve-Version) {
        $binaryOk = Download-Binary
    }

    if ($binaryOk) {
        Install-BinaryToPath
    } else {
        # 降级到 npm
        Write-Warn "降级到 npm 安装方式"
        Install-ViaNpm
    }

    Verify-Install
} finally {
    Cleanup
}
