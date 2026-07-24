# ============================================================================
# Cleanup G:\ root external junk files and directories
# ============================================================================
# Causes:
#   1. WeChat Pay Merchant API Cert Tool V1.4.exe (Qt app) run in G:\ root
#      deploys Qt plugin dirs (platforms/iconengines/imageformats/styles/
#      bearer/translations) + Qt5*.dll + dependency DLLs + CA/cert/WXCertUtil
#   2. pnpm run in G:\ root created .pnpm-store (v11, conflicts with project v3)
#   3. Old certs in G:\ai_zhs\ (migrated to g:\IHUI-AI\cert\)
#   4. Temp files scattered in G:\ root (tmp/ tmp-test.log tmp_head.ts ...)
#   5. QoderCN IDE venv command wrote C:\ as g:\c\, Python created full path
#      chain c\Users\Administrator\.workbuddy\binaries\python\envs\default\
#      (evidence: pyvenv.cfg line 5 command field)
#   6. QoderCN path resolution fallback dir nonexistent-root\no-perm\
#   7. QoderCN JDK probe cache in G:\.appdata\jdk.md (32-bit hash)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1 -Force
#
# Safety:
#   - Only deletes 16 dirs + 31 files explicitly listed below, no wildcards
#   - Does NOT touch other app dirs (Trae CN / MuMuPlayer / QoderCN / WeGameApps)
#   - Default asks for confirmation; -Force skips (for agent auto-run)
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Stop'

# ---- Parse -Force flag ----
$Force = $false
foreach ($a in $args) {
    if ($a -eq '-Force' -or $a -eq '--force' -or $a -eq '-y') { $Force = $true }
}

# ---- Junk dirs to clean (16) ----
$junkDirs = @(
    'G:\platforms',
    'G:\iconengines',
    'G:\imageformats',
    'G:\styles',
    'G:\bearer',
    'G:\translations',
    'G:\CA',
    'G:\cert',
    'G:\WXCertUtil',
    'G:\rail_user_data',
    'G:\.pnpm-store',
    'G:\tmp',
    'G:\ai_zhs',
    'G:\.appdata',
    'G:\c',
    'G:\nonexistent-root'
)

# ---- Junk files to clean (31) ----
$junkFiles = @(
    'G:\微信支付商户API证书工具 V1.4.exe',
    'G:\Qt5Core.dll',
    'G:\Qt5Gui.dll',
    'G:\Qt5Network.dll',
    'G:\Qt5Svg.dll',
    'G:\Qt5Widgets.dll',
    'G:\D3Dcompiler_47.dll',
    'G:\libEGL.dll',
    'G:\libGLESv2.dll',
    'G:\opengl32sw.dll',
    'G:\libeay32.dll',
    'G:\ssleay32.dll',
    'G:\libgcc_s_dw2-1.dll',
    'G:\libstdc++-6.dll',
    'G:\libwinpthread-1.dll',
    'G:\msvcp120.dll',
    'G:\msvcr120.dll',
    'G:\quazip.dll',
    'G:\quazip.lib',
    'G:\quazipd.dll',
    'G:\quazipd.lib',
    'G:\zdll.lib',
    'G:\zlib.def',
    'G:\zlib1.dll',
    'G:\.tmp-edit-zhtw.mjs',
    'G:\tmp-test.log',
    'G:\tmp_head.ts',
    'G:\tmp_config_3ee96cf0.py',
    'G:\_tmp_30412_bf90cf4040534367bbe8475beda0ce11',
    'G:\_tmp_31272_784ba32974ff956ab605bf0d3408fda2',
    'G:\_tmp_37636_ebf2f152cb4ebf387c892fa70e2bbd78'
)

# ---- Count existing items ----
$existingDirs = $junkDirs | Where-Object { Test-Path $_ }
$existingFiles = $junkFiles | Where-Object { Test-Path $_ }

Write-Host ''
Write-Host '======== G:\ root junk cleanup ========' -ForegroundColor Cyan
Write-Host ''
Write-Host "Dirs to delete ($($existingDirs.Count)/$($junkDirs.Count) exist):" -ForegroundColor Yellow
foreach ($d in $existingDirs) { Write-Host "  [DIR]  $d" }
Write-Host ''
Write-Host "Files to delete ($($existingFiles.Count)/$($junkFiles.Count) exist):" -ForegroundColor Yellow
foreach ($f in $existingFiles) { Write-Host "  [FILE] $f" }
Write-Host ''

if ($existingDirs.Count -eq 0 -and $existingFiles.Count -eq 0) {
    Write-Host 'Nothing to clean. G:\ root is already clean.' -ForegroundColor Green
    exit 0
}

# ---- Confirm (skip with -Force) ----
if (-not $Force) {
    $confirm = Read-Host "Confirm delete $($existingDirs.Count) dirs + $($existingFiles.Count) files? (type YES to proceed)"
    if ($confirm -ne 'YES') {
        Write-Host 'Cancelled. Nothing deleted.' -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host '-Force enabled, skipping confirmation...' -ForegroundColor Cyan
}

# ---- Execute deletion ----
$deletedDirs = 0
$deletedFiles = 0
$failed = @()

foreach ($d in $existingDirs) {
    try {
        Remove-Item -Path $d -Recurse -Force -ErrorAction Stop
        Write-Host "  [OK] dir: $d" -ForegroundColor Green
        $deletedDirs++
    } catch {
        Write-Host "  [FAIL] dir: $d - $($_.Exception.Message)" -ForegroundColor Red
        $failed += $d
    }
}

foreach ($f in $existingFiles) {
    try {
        Remove-Item -Path $f -Force -ErrorAction Stop
        Write-Host "  [OK] file: $f" -ForegroundColor Green
        $deletedFiles++
    } catch {
        Write-Host "  [FAIL] file: $f - $($_.Exception.Message)" -ForegroundColor Red
        $failed += $f
    }
}

# ---- Summary ----
Write-Host ''
Write-Host '======== Cleanup complete ========' -ForegroundColor Cyan
Write-Host "Deleted: $deletedDirs dirs + $deletedFiles files" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count) items:" -ForegroundColor Red
    foreach ($item in $failed) { Write-Host "  $item" -ForegroundColor Red }
    Write-Host ''
    Write-Host 'Hint: failed items may be locked or read-only. Close relevant apps and retry.' -ForegroundColor Yellow
    exit 1
} else {
    Write-Host 'All deleted successfully. G:\ root junk cleaned.' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Verify: G:\ root no longer contains Qt plugin dirs / Qt DLLs / cert tool residue.' -ForegroundColor Cyan
    exit 0
}
