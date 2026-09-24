# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 数据库备份调度器 — 由 Windows 服务 "IHUI-PG-BACKUP" 托管(NSSM)
# =============================================================================
# 行为:启动即执行一次备份 → 每天 03:00 执行一次备份
# 日志: D:\DevEnv\logs\pg-backup-scheduler.log(NSSM AppStdout 捕获)
# =============================================================================
$ErrorActionPreference = "Continue"

function Run-Backup {
    try {
        & "D:\IHUI-AI\deploy\prod-bundle\pg-backup.ps1"
        # ⚠️ PowerShell 的 `&` **不会**因为被调脚本 `exit 1` 抛异常 ⇒ 旧结构里 catch 永远抓不到
        # 备份失败,失败轮照样打"备份完成"。2026-09-24 实测到后果:pg_hba 在 04:47 被改成
        # scram-sha-256(全链路不再免密),而本脚本用的是 postgres + 显式空口令 ——
        # 最后一份成功 dump 停在 04:39,之后每次"成功"都是假的。静默是这类事故唯一的传播方式。
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份完成"
        } else {
            Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份失败:子脚本 exit=$LASTEXITCODE(见上一行 [ERROR])"
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份失败: $_"
    }
    # 2026-09-06 WAL 归档清理: 每次备份后清掉超过 7 天的归档(与 7 天全量轮转对齐, 防无限累积)。
    # 归档来自 PG archive_command → D:\DevEnv\pg_archives\（24 位十六进制 WAL 段名）。
    $archives = Get-ChildItem "D:\DevEnv\pg_archives" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -match '^[0-9A-F]{24}$' }
    $cutoff = (Get-Date).AddDays(-7)
    $removed = $archives | Where-Object { $_.LastWriteTime -lt $cutoff }
    foreach ($f in $removed) { Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue }
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WAL 归档:清理 $($removed.Count) 份, 保留 $($archives.Count - $removed.Count) 份"
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 备份调度器启动,先执行一次备份"
Run-Backup

while ($true) {
    # 计算下一次 03:00
    $now = Get-Date
    $next = Get-Date -Year $now.Year -Month $now.Month -Day $now.Day -Hour 3 -Minute 0 -Second 0
    if ($next -le $now) { $next = $next.AddDays(1) }
    $waitSec = [math]::Round(($next - $now).TotalSeconds)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 下次备份: $($next.ToString('yyyy-MM-dd HH:mm:ss'))(等待 ${waitSec}s)"
    Start-Sleep -Seconds $waitSec
    Run-Backup
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
