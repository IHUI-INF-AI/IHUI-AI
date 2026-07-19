# memory topics.md cleanup script
# Move topics.md / session_memory_*.jsonl older than 30 days to archive subdir
# These files are managed by Trae CN automatically, only move files, never edit content
# Usage: powershell -ExecutionPolicy Bypass -File scripts/cleanup-memory-topics.ps1

$ErrorActionPreference = 'Stop'
$memoryRoot = 'c:\Users\Administrator\.trae-cn\memory\projects\-g-IHUI-AI'
$archiveRoot = Join-Path $memoryRoot 'archive'
$threshold = (Get-Date).AddDays(-30)

if (-not (Test-Path $memoryRoot)) {
    Write-Host "memory root not exist, skip: $memoryRoot"
    exit 0
}

if (-not (Test-Path $archiveRoot)) {
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
}

$totalMoved = 0
$totalBytes = 0

Get-ChildItem $memoryRoot -Directory | ForEach-Object {
    $dirName = $_.Name
    $parsed = $null
    try {
        $parsed = [datetime]::ParseExact($dirName, 'yyyyMMdd', $null)
    } catch {
        return
    }
    if ($parsed -ge $threshold) {
        return
    }

    $destDir = Join-Path $archiveRoot $dirName
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    Get-ChildItem $_.FullName -File | ForEach-Object {
        $destFile = Join-Path $destDir $_.Name
        Move-Item $_.FullName $destFile -Force
        $totalMoved++
        $totalBytes += $_.Length
        Write-Host "  moved: $dirName/$($_.Name) ($([math]::Round($_.Length/1KB, 1)) KB)"
    }
}

if ($totalMoved -eq 0) {
    Write-Host "no memory files older than 30 days need cleanup"
} else {
    $kb = [math]::Round($totalBytes / 1KB, 1)
    Write-Host ""
    Write-Host "cleanup done: $totalMoved files, $kb KB moved to archive/"
}

