# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  IHUI 本地 PG 每日备份(Windows 向, 对标 deploy/scripts/backup-db.sh)。
.DESCRIPTION
  从 apps/api/.env 的 DATABASE_URL 取连接串, pg_dump(custom 格式) 落到
  D:\DevEnv\backups\pg\ (AGENTS.md §15b 唯一备份目录), 保留最近 7 份。
  口令只走进程级 PGPASSWORD, 不写日志不入仓。
  还原含 pgvector 表时需超级用户先建 vector 扩展(见文末注释)。
  立项: 2026-09-23 对话数据恢复失败(本机零备份), 防再现。
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackupDir = 'D:\DevEnv\backups\pg'
$PgDump = 'D:\DevEnv\runtimes\pgsql\bin\pg_dump.exe'
$Retain = 7

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$LogFile = Join-Path $BackupDir 'backup.log'
function Write-Log([string]$Msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
  $line | Out-File -FilePath $LogFile -Append -Encoding utf8
  Write-Output $line
}

$envLine = Get-Content -LiteralPath (Join-Path $RepoRoot 'apps\api\.env') |
  Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $envLine) { Write-Log 'ERROR: apps/api/.env 无 DATABASE_URL'; exit 1 }
if ($envLine -notmatch '^DATABASE_URL=postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)$') {
  Write-Log 'ERROR: DATABASE_URL 解析失败'; exit 1
}
$DbUser, $DbPass, $DbHost, $DbPort, $DbName =
  $Matches[1], $Matches[2], $Matches[3], $Matches[4], $Matches[5].Trim()

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$OutFile = Join-Path $BackupDir "ihui-dev-$Stamp.dump"

$env:PGPASSWORD = $DbPass
try {
  & $PgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -f $OutFile
  if ($LASTEXITCODE -ne 0) { Write-Log "ERROR: pg_dump exit=$LASTEXITCODE"; exit 1 }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$size = (Get-Item -LiteralPath $OutFile).Length
Write-Log "OK: $OutFile (${size}B)"

Get-ChildItem -LiteralPath $BackupDir -Filter 'ihui-dev-*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Retain |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Write-Log "prune: $($_.Name)"
  }
# 还原须知: pgvector(vector 扩展)表需超级用户先 CREATE EXTENSION vector, 再 pg_restore。
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
