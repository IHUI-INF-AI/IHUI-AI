# scripts/migration/create_storage_junctions.ps1
# 阶段 A 资产入位 - 建立 NTFS junction(不复制文件,0 磁盘占用)
# 用法: powershell -ExecutionPolicy Bypass -File scripts/migration/create_storage_junctions.ps1

$ErrorActionPreference = 'Continue'
$dstBase = 'G:\IHUI-AI\storage\edu-assets'
$eduRoot = 'G:\code\edu'
$ljdRoot = 'G:\code\ljd-交接文件'

# 创建目标根目录
if (-not (Test-Path $dstBase)) {
    New-Item -ItemType Directory -Path $dstBase -Force | Out-Null
}

# 要建 junction 的项:英文路径 → 英文源路径(避免中文路径的编码问题)
$map = @{
    'videos'               = "$eduRoot\videos"
    'elasticsearch-7.17.16'= "$eduRoot\elasticsearch-7.17.16"
    'frontend-admin'       = "$eduRoot\admin\admin"
    'frontend-web'         = "$eduRoot\web\web"
    'java-source'          = "$eduRoot\service\service"
}

foreach ($name in $map.Keys) {
    $target = $map[$name]
    $link = Join-Path $dstBase $name
    if (-not (Test-Path $target)) {
        Write-Host ("[SKIP] {0,-30} source missing: {1}" -f $name, $target) -ForegroundColor Yellow
        continue
    }
    if (Test-Path $link) {
        $attr = (Get-Item $link -Force).Attributes
        if ($attr -band [System.IO.FileAttributes]::ReparsePoint) {
            Write-Host ("[OK]   {0,-30} already junction" -f $name) -ForegroundColor DarkYellow
            continue
        }
        Remove-Item $link -Recurse -Force -ErrorAction SilentlyContinue
    }
    $result = & cmd /c mklink /J "`"$link`"" "`"$target`"" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("[OK]   {0,-30} -> {1}" -f $name, $target) -ForegroundColor Green
    } else {
        Write-Host ("[FAIL] {0,-30} {1}" -f $name, $result) -ForegroundColor Red
    }
}

# handoff(中文路径)用快照方式
$handoff = Join-Path $dstBase 'handoff'
if (-not (Test-Path $handoff)) {
    New-Item -ItemType Directory -Path $handoff -Force | Out-Null
}
if (-not (Test-Path (Join-Path $handoff 'README.md'))) {
    Write-Host '[OK] handoff/ (snapshot mode - see README.md for manual junction cmd)' -ForegroundColor Cyan
}

# 占位目录
foreach ($empty in @('jars','spring-cloud-config')) {
    $p = Join-Path $dstBase $empty
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Path $p -Force | Out-Null
    }
}

# 总结
Write-Host ''
Write-Host '=== Storage summary ===' -ForegroundColor Cyan
foreach ($name in @('videos','elasticsearch-7.17.16','jars','frontend-admin','frontend-web','java-source','handoff','spring-cloud-config')) {
    $p = Join-Path $dstBase $name
    if (Test-Path $p) {
        $attr = (Get-Item $p -Force).Attributes
        $isJunction = ($attr -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        $count = (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
        $marker = if ($isJunction) { '[JUNCTION]' } else { '[DIR]' }
        Write-Host ('  {0,-30} {1}  {2,8:N0} files' -f $name, $marker, $count)
    }
}