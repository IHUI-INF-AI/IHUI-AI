# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# G-916939 - PG backup second copy daily sync (robocopy /MIR)
# =============================================================================
# Decision (owner, 2026-10-07): second copy lands on G: volume (physical disk 1,
#   separate from D:/F: which sit on physical disk 0) + daily robocopy;
#   do NOT auto-start any cloud-sync client (the off-machine leg is a separate decision).
#
# Source note (2026-10-07, recorded as-is):
#   The repo-designated daily backup source D:\DevEnv\backups\pg does NOT exist on
#   this (new) machine - the daily dump chain is broken (see PROJECT_PLAN
#   G-1058618 / G-1058619). The only real backup location today is
#   F:\BaiduSyncdisk\IHUI-PG-BACKUP (manual dump ihui_dev_20261005_191010.dump).
#   Once the daily dump chain is rebuilt, change $source below only.
#
# Verdict: robocopy exit code 0-7 = success, >=8 = failure (passed through).
# Schedule: scheduled task IHUI-PG-SECOND-COPY, daily 03:30.
# Caveat: /MIR mirrors deletions from the source (matches backup rotation). If the
#   source ever becomes a cloud-sync dir, re-evaluate the risk of the sync client
#   wiping the source - with /MIR the G: copy would follow it to empty.
# =============================================================================

$ErrorActionPreference = 'Continue'
$source = 'F:\BaiduSyncdisk\IHUI-PG-BACKUP'
$target = 'G:\backups\pg-second-copy'
$logDir = 'G:\backups\logs'

function Write-Log([string]$msg, [string]$log) {
    $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Host $line
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

$stamp = Get-Date -Format 'yyyyMMdd'
$log = Join-Path $logDir "pg-second-copy-$stamp.log"
$rc = 16
try {
    if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
    if (-not (Test-Path -LiteralPath $target)) { New-Item -ItemType Directory -Force -Path $target | Out-Null }

    if (-not (Test-Path -LiteralPath $source)) {
        Write-Log "[ERROR] source dir missing: $source - nothing copied" $log
        exit 9
    }

    Write-Log "robocopy /MIR start: $source -> $target" $log
    & robocopy.exe $source $target /MIR /R:2 /W:5 /NP /NDL /LOG+:$log
    $rc = $LASTEXITCODE
    Write-Log "robocopy exit code $rc (0-7 = success)" $log
} catch {
    Write-Log "[ERROR] second-copy sync failed: $($_.Exception.Message)" $log
    exit 9
}

if ($rc -lt 8) { exit 0 } else { exit $rc }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
