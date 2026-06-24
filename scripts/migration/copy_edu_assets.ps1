# 阶段 A: edu 资产入位脚本(精简版,不使用 Start-Transcript)
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/migration/copy_edu_assets.ps1

$ErrorActionPreference = 'Continue'

$dstBase       = 'G:\IHUI-AI\storage\edu-assets'
$eduRoot       = 'G:\code\edu'
$ljdRoot       = 'G:\code\ljd-交接文件'

$dstVideos      = Join-Path $dstBase 'videos'
$dstES          = Join-Path $dstBase 'elasticsearch-7.17.16'
$dstJars        = Join-Path $dstBase 'jars'
$dstAdmin       = Join-Path $dstBase 'frontend-admin'
$dstWeb         = Join-Path $dstBase 'frontend-web'
$dstJavaSrc     = Join-Path $dstBase 'java-source'
$dstHandoff     = Join-Path $dstBase 'handoff'
$dstNacosConfig = Join-Path $dstBase 'spring-cloud-config'

function Copy-Asset {
    param([string]$Src, [string]$Dst, [string]$Label)
    if ([string]::IsNullOrEmpty($Dst)) { Write-Host "[FAIL] $Label - Dst empty" -ForegroundColor Red; return }
    if ([string]::IsNullOrEmpty($Src)) { Write-Host "[FAIL] $Label - Src empty" -ForegroundColor Red; return }
    if (-not (Test-Path $Src)) { Write-Host "[SKIP] $Label - source missing: $Src" -ForegroundColor Yellow; return }
    if (-not (Test-Path $Dst)) { New-Item -ItemType Directory -Path $Dst -Force | Out-Null }
    Write-Host "[START] $Label : $Src -> $Dst" -ForegroundColor Cyan
    $rcLog = Join-Path $env:TEMP ('robocopy_{0}.log' -f $Label)
    robocopy $Src $Dst /MIR /MT:8 /R:3 /W:5 /NFL /NDL /NP /BYTES /LOG+:$rcLog | Out-Null
    if ($LASTEXITCODE -lt 8) { Write-Host ("[OK]   {0} rc={1}" -f $Label, $LASTEXITCODE) -ForegroundColor Green }
    else { Write-Host ("[FAIL] {0} rc={1} log={2}" -f $Label, $LASTEXITCODE, $rcLog) -ForegroundColor Red }
}

Write-Host ("=== Phase A started {0:yyyy-MM-dd HH:mm:ss} ===" -f (Get-Date)) -ForegroundColor Magenta

Copy-Asset -Src (Join-Path $eduRoot 'videos')                -Dst $dstVideos  -Label 'videos'
Copy-Asset -Src (Join-Path $eduRoot 'elasticsearch-7.17.16') -Dst $dstES      -Label 'elasticsearch'

if (Test-Path (Join-Path $eduRoot 'service\service')) {
    Write-Host "[START] jars" -ForegroundColor Cyan
    Get-ChildItem (Join-Path $eduRoot 'service\service') -Directory -Filter 'ihui-ai-edu-*-service' | ForEach-Object {
        $svcName = $_.Name
        $jarDst = Join-Path $dstJars $svcName
        if (-not (Test-Path $jarDst)) { New-Item -ItemType Directory -Path $jarDst -Force | Out-Null }
        $jarSrc = Join-Path $_.FullName 'target'
        if (Test-Path $jarSrc) {
            $jarLog = Join-Path $env:TEMP ('robocopy_jar_{0}.log' -f $svcName)
            robocopy $jarSrc $jarDst '*.jar' /S /MT:8 /R:3 /W:5 /NFL /NDL /NP /LOG+:$jarLog | Out-Null
            Write-Host ("  [JAR] {0} rc={1}" -f $svcName, $LASTEXITCODE)
        }
    }
}

Copy-Asset -Src (Join-Path $eduRoot 'admin\admin')           -Dst $dstAdmin   -Label 'frontend-admin'
Copy-Asset -Src (Join-Path $eduRoot 'web\web')               -Dst $dstWeb     -Label 'frontend-web'
Copy-Asset -Src (Join-Path $eduRoot 'service\service')       -Dst $dstJavaSrc -Label 'java-source'
Copy-Asset -Src $ljdRoot                                     -Dst $dstHandoff -Label 'handoff'

# A4: Nacos 配置抽取
if (Test-Path $dstJavaSrc) {
    Write-Host "[START] spring-cloud-config" -ForegroundColor Cyan
    if (-not (Test-Path $dstNacosConfig)) { New-Item -ItemType Directory -Path $dstNacosConfig -Force | Out-Null }
    Get-ChildItem $dstJavaSrc -Directory -Filter 'ihui-ai-edu-*-service' | ForEach-Object {
        $svcName = $_.Name
        $svcResDir = Join-Path $_.FullName 'src\main\resources'
        if (Test-Path $svcResDir) {
            Get-ChildItem $svcResDir -File -Filter 'application*.yml' | ForEach-Object {
                Copy-Item $_.FullName (Join-Path $dstNacosConfig ('{0}_{1}' -f $svcName, $_.Name)) -Force
            }
            Get-ChildItem $svcResDir -File -Filter 'bootstrap*.yml' | ForEach-Object {
                Copy-Item $_.FullName (Join-Path $dstNacosConfig ('{0}_{1}' -f $svcName, $_.Name)) -Force
            }
        }
    }
    Write-Host "[OK]   spring-cloud-config done" -ForegroundColor Green
}

Write-Host ("=== Phase A finished {0:yyyy-MM-dd HH:mm:ss} ===" -f (Get-Date)) -ForegroundColor Magenta