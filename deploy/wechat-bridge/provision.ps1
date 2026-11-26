# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 微信朋友圈只读桥：一台新机器上的落地脚本。
#
# 为什么要有它：桥的启动器与看门狗原来是这台机器上的手工产物（data/wechat-bridge 不进 git），
# 换机器就得重新拼一遍环境变量、目录、账号名，还得记住计划任务怎么注册。这里把它参数化：
# 校验前置条件 → 探测微信账号目录 → 生成启动器与看门狗 → 可选注册登录自启与每 5 分钟巡检。
#
# 默认只打印计划（-DryRun 为默认行为），确认无误后加 -Apply 才落盘。

param(
    [string]$Root = 'C:\IHUI-AI',
    [string]$DbDir = (Join-Path $env:USERPROFILE 'Documents\xwechat_files'),
    [string]$Account = '',
    [int]$Port = 8849,
    [string]$PythonExe = '',
    [string]$OutDir = '',
    [string]$TaskPrefix = 'IHUI-WeChat-Bridge',
    [switch]$RegisterTasks,
    [switch]$Apply,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$bridgeDir = Join-Path $Root 'deploy\wechat-bridge'
$dataDir = if ($OutDir) { $OutDir } else { Join-Path $Root 'data\wechat-bridge' }
$py = if ($PythonExe) { $PythonExe } else { Join-Path $dataDir 'venv\Scripts\python.exe' }
$dry = (-not $Apply) -or $DryRun

function Say([string]$line) { Write-Output $line }

Say "root      = $Root"
Say "bridge    = $bridgeDir"
Say "data      = $dataDir"
Say "python    = $py"
Say "db dir    = $DbDir"
Say "port      = $Port"
Say "mode      = $(if ($dry) { 'dry-run（不落盘）' } else { 'apply' })"

if (-not (Test-Path -LiteralPath (Join-Path $bridgeDir 'server.mjs'))) {
    throw "找不到桥服务：$bridgeDir\server.mjs"
}
if (-not (Test-Path -LiteralPath $py)) {
    throw "sidecar Python 不存在：$py（先在该目录建 venv 并装依赖，或用 -PythonExe 指定）"
}

# 账号目录自动探测：微信 4.2 的每个登录账号在 xwechat_files 下各占一个目录，
# 只认得到 db_storage\sns\sns.db 的那个；不止一个时必须显式指定，避免猜错人。
$candidates = @()
if (Test-Path -LiteralPath $DbDir) {
    foreach ($dir in Get-ChildItem -LiteralPath $DbDir -Directory -ErrorAction SilentlyContinue) {
        if (Test-Path -LiteralPath (Join-Path $dir.FullName 'db_storage\sns\sns.db')) {
            $candidates += $dir.Name
        }
    }
}
if (-not $Account) {
    if ($candidates.Count -eq 1) {
        $Account = $candidates[0]
        Say "account   = $Account（自动探测到唯一候选）"
    } elseif ($candidates.Count -eq 0) {
        throw "在 $DbDir 下没找到 db_storage\sns\sns.db；用 -DbDir 指向微信数据目录，并确认已登录过微信"
    } else {
        throw "找到多个账号目录（$($candidates -join ', ')），请用 -Account 指定一个"
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $DbDir "$Account\db_storage\sns\sns.db"))) {
    throw "账号目录里没有 sns.db：$DbDir\$Account\db_storage\sns\sns.db"
}

$launcher = @'
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 由 deploy/wechat-bridge/provision.ps1 生成；只读 sns.db，不写微信目录、不发消息、不抢前台。
param([int]$Port = __PORT__, [switch]$DownloadMedia)
$ErrorActionPreference = 'Stop'
$root = '__ROOT__'
$python = '__PYTHON__'
$dbDir = '__DBDIR__'
$account = '__ACCOUNT__'
$bridgeDir = Join-Path $root 'deploy\wechat-bridge'
$dataDir = '__DATADIR__'

New-Item -ItemType Directory -Force -Path $dataDir, (Join-Path $dataDir 'work'), (Join-Path $root 'data\wechat-hub-media') | Out-Null

$env:BRIDGE_PORT = "$Port"
$env:BRIDGE_HOST = '127.0.0.1'
$env:BRIDGE_DRIVER = 'db'
$env:BRIDGE_MOMENT_DRIVER = 'db'
$env:BRIDGE_DB_SIDECAR = 'on'
$env:BRIDGE_DB_PYTHON = $python
$env:BRIDGE_DB_DIR = $dbDir
$env:BRIDGE_DB_ACCOUNT = $account
$env:BRIDGE_DB_WORKDIR = Join-Path $dataDir 'work'
$env:BRIDGE_DB_MEDIA_DIR = Join-Path $root 'data\wechat-hub-media'
$env:BRIDGE_DB_MEDIA_DOWNLOAD = if ($DownloadMedia) { '1' } else { '0' }
$env:BRIDGE_DB_TIMEOUT_MS = '300000'
$env:BRIDGE_MAX_ARCHIVE = '5000'
$env:BRIDGE_MOMENT_ARCHIVE = Join-Path $dataDir 'moments-archive.jsonl'

$node = if (Test-Path -LiteralPath 'C:\Program Files\nodejs\node.exe') { 'C:\Program Files\nodejs\node.exe' } else { (Get-Command node).Source }
$existing = $null
try { $existing = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 3 } catch { }
if ($existing -and $existing.ok -and $existing.online) {
    "BRIDGE_ALREADY_RUNNING port=$Port status=$($existing.status)"
    exit 0
}
$outLog = Join-Path $dataDir 'bridge.out.log'
$errLog = Join-Path $dataDir 'bridge.err.log'
$p = Start-Process -FilePath $node -ArgumentList 'server.mjs' -WorkingDirectory $bridgeDir -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 5
        if ($status.ok -and $status.online) {
            "BRIDGE_OK pid=$($p.Id) port=$Port status=$($status.status)"
            exit 0
        }
    } catch { }
}
throw "桥未在 15 秒内就绪；查看 $errLog"
'@

$watchdog = @'
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 看门狗：桥不在就拉起，已在（含启动中）就不重复拉起；登录时与每 5 分钟各跑一次。
$ErrorActionPreference = 'Stop'
$log = Join-Path '__DATADIR__' 'watchdog.log'
$port = __PORT__
function Write-Watchdog([string]$line) {
    Add-Content -LiteralPath $log -Value "[$((Get-Date).ToString('s'))] $line" -Encoding utf8
}
$status = $null
try { $status = Invoke-RestMethod -Uri "http://127.0.0.1:$port/status" -TimeoutSec 5 } catch { }
if ($status -and $status.ok) { exit 0 }
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) { Write-Watchdog "port $port listening but /status not ready; skip duplicate start"; exit 1 }
try {
    & (Join-Path '__DATADIR__' 'start-bridge.ps1') -Port $port *>> $log
    Write-Watchdog "start-bridge.ps1 returned"
} catch {
    Write-Watchdog "start failed: $($_.Exception.Message)"
    exit 1
}
'@

$launcher = $launcher.Replace('__PORT__', "$Port").Replace('__ROOT__', $Root).Replace('__PYTHON__', $py)
$launcher = $launcher.Replace('__DBDIR__', $DbDir).Replace('__ACCOUNT__', $Account).Replace('__DATADIR__', $dataDir)
$watchdog = $watchdog.Replace('__PORT__', "$Port").Replace('__DATADIR__', $dataDir)

$startPath = Join-Path $dataDir 'start-bridge.ps1'
$ensurePath = Join-Path $dataDir 'ensure-bridge.ps1'
if ($dry) {
    Say "would-write = $startPath"
    Say "would-write = $ensurePath"
    Say "would-create = $dataDir\work, $Root\data\wechat-hub-media"
} else {
    New-Item -ItemType Directory -Force -Path $dataDir, (Join-Path $dataDir 'work'), (Join-Path $Root 'data\wechat-hub-media') | Out-Null
    if (Test-Path -LiteralPath $startPath) { Copy-Item -LiteralPath $startPath -Destination "$startPath.bak" -Force }
    if (Test-Path -LiteralPath $ensurePath) { Copy-Item -LiteralPath $ensurePath -Destination "$ensurePath.bak" -Force }
    Set-Content -LiteralPath $startPath -Value $launcher -Encoding utf8
    Set-Content -LiteralPath $ensurePath -Value $watchdog -Encoding utf8
    Say "written = $startPath"
    Say "written = $ensurePath"
}

# 生成物先过一遍语法解析，避免把语法错的脚本交给计划任务，半夜静默失败。
foreach ($path in @($startPath, $ensurePath)) {
    $code = if ($dry) { if ($path -eq $startPath) { $launcher } else { $watchdog } } else { Get-Content -LiteralPath $path -Raw }
    $errors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseInput($code, [ref]$null, [ref]$errors)
    if ($errors.Count -gt 0) { throw "生成的脚本有语法错误：$path -> $($errors[0].Message)" }
    Say "syntax-ok = $(Split-Path -Leaf $path)"
}

if ($RegisterTasks) {
    $pwsh = (Get-Command pwsh).Source
    if ($dry) {
        Say "would-register = $TaskPrefix-Logon（登录时）"
        Say "would-register = $TaskPrefix-Watchdog（每 5 分钟）"
    } else {
        $cmd = "`"$pwsh`" -NoProfile -ExecutionPolicy Bypass -File `"$ensurePath`""
        & schtasks /Create /TN "$TaskPrefix-Logon" /TR $cmd /SC ONLOGON /RL LIMITED /F | Out-Null
        & schtasks /Create /TN "$TaskPrefix-Watchdog" /TR $cmd /SC MINUTE /MO 5 /RL LIMITED /F | Out-Null
        Say "registered = $TaskPrefix-Logon, $TaskPrefix-Watchdog"
    }
}

Say "下一步：apply 后用 powershell -File `"$startPath`" 启一次，管理台「桥体检」应显示 driver=db、status=db-sidecar-ready"
