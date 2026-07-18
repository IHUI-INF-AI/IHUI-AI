# ============================================================================
# 清理 G:\ 根目录的项目外垃圾文件和目录
# ============================================================================
# 成因:
#   1. 微信支付商户 API 证书工具 V1.4.exe(Qt 应用)在 G:\ 根目录运行时
#      释放 Qt 插件目录(platforms/iconengines/imageformats/styles/bearer/
#      translations)+ Qt5*.dll + 依赖 DLL + CA/cert/WXCertUtil 证书工作目录
#   2. pnpm 在 G:\ 根目录运行时创建 .pnpm-store(版本 v11,与项目内 v3 冲突)
#   3. 旧版证书放在 G:\ai_zhs\(已迁移到项目内 g:\IHUI-AI\cert\)
#   4. 临时文件散落在 G:\ 根目录(tmp/ tmp-test.log tmp_head.ts tmp_config_*.py
#      _tmp_* .tmp-edit-zhtw.mjs)
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1
#
# 安全保证:
#   - 只删除下方明确列出的 13 个目录 + 31 个文件,不用通配符
#   - 不触碰其他应用目录(Trae CN / MuMuPlayer / QoderCN / WeGameApps 等)
#   - 删除前显示清单并要求确认
# ============================================================================

#Requires -Version 5.0

$ErrorActionPreference = 'Stop'

# ---- 待清理目录(13 个)----
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
    'G:\ai_zhs'
)

# ---- 待清理文件(31 个)----
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

# ---- 统计存在的待删项 ----
$existingDirs = $junkDirs | Where-Object { Test-Path $_ }
$existingFiles = $junkFiles | Where-Object { Test-Path $_ }

Write-Host ''
Write-Host '======== G:\ 根目录垃圾清理 ========' -ForegroundColor Cyan
Write-Host ''
Write-Host "待删除目录($($existingDirs.Count)/$($junkDirs.Count) 个存在):" -ForegroundColor Yellow
foreach ($d in $existingDirs) { Write-Host "  [DIR]  $d" }
Write-Host ''
Write-Host "待删除文件($($existingFiles.Count)/$($junkFiles.Count) 个存在):" -ForegroundColor Yellow
foreach ($f in $existingFiles) { Write-Host "  [FILE] $f" }
Write-Host ''

if ($existingDirs.Count -eq 0 -and $existingFiles.Count -eq 0) {
    Write-Host '没有需要清理的垃圾文件,G:\ 根目录已干净。' -ForegroundColor Green
    exit 0
}

# ---- 确认 ----
$confirm = Read-Host "确认删除以上 $($existingDirs.Count) 个目录 + $($existingFiles.Count) 个文件?(输入 YES 继续)"
if ($confirm -ne 'YES') {
    Write-Host '已取消,未删除任何内容。' -ForegroundColor Red
    exit 1
}

# ---- 执行删除 ----
$deletedDirs = 0
$deletedFiles = 0
$failed = @()

foreach ($d in $existingDirs) {
    try {
        Remove-Item -Path $d -Recurse -Force -ErrorAction Stop
        Write-Host "  [OK] 删除目录: $d" -ForegroundColor Green
        $deletedDirs++
    } catch {
        Write-Host "  [FAIL] 目录: $d — $($_.Exception.Message)" -ForegroundColor Red
        $failed += $d
    }
}

foreach ($f in $existingFiles) {
    try {
        Remove-Item -Path $f -Force -ErrorAction Stop
        Write-Host "  [OK] 删除文件: $f" -ForegroundColor Green
        $deletedFiles++
    } catch {
        Write-Host "  [FAIL] 文件: $f — $($_.Exception.Message)" -ForegroundColor Red
        $failed += $f
    }
}

# ---- 汇总 ----
Write-Host ''
Write-Host '======== 清理完成 ========' -ForegroundColor Cyan
Write-Host "成功删除: $deletedDirs 个目录 + $deletedFiles 个文件" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "失败: $($failed.Count) 项:" -ForegroundColor Red
    foreach ($item in $failed) { Write-Host "  $item" -ForegroundColor Red }
    Write-Host ''
    Write-Host '提示:失败的项可能是被占用或有只读属性,请关闭相关程序后重试。' -ForegroundColor Yellow
    exit 1
} else {
    Write-Host '全部删除成功,G:\ 根目录垃圾已清理干净。' -ForegroundColor Green
    Write-Host ''
    Write-Host '验证:执行 G:\ 根目录已不再包含 Qt 插件目录 / Qt DLL / 证书工具残留。' -ForegroundColor Cyan
    exit 0
}
