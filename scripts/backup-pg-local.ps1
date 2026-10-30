# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  IHUI 本地 PG 每日备份(Windows 向, 对标 deploy/scripts/backup-db.sh)。
.DESCRIPTION
  从 apps/api/.env 的 DATABASE_URL 取连接串, pg_dump(custom 格式) 落到
  <DevEnv 根>\backups\pg\ (AGENTS.md §15b 唯一备份目录;根盘符随仓根派生,
  IHUI_DEVENV_ROOT 可覆盖), 保留最近 7 份。
  口令只走进程级 PGPASSWORD, 不写日志不入仓。
  还原含 pgvector 表时需超级用户先建 vector 扩展(见文末注释)。
  立项: 2026-09-23 对话数据恢复失败(本机零备份), 防再现。
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
# G-70(2026-10-26):备份落点与 pg_dump 落点都不再把盘符字面当唯一真相 —— 与
# deploy/win/ihui-pg-backup.ps1 的既有探测样板同纪律(G-298 落点解析 + 2026-10-25 P0 候选链):
# 环境变量优先,否则按仓根所在盘符派生。换机后旧写死值(备份卷 D:\DevEnv、工具卷 D:\ihui-pg\16
# 与 D:\DevEnv\runtimes\pgsql)整卷失踪,写死只让守卫永远报"请更新本文件路径"。
$DevEnvRoot = if ($env:IHUI_DEVENV_ROOT) { $env:IHUI_DEVENV_ROOT } else { (Split-Path -Qualifier $RepoRoot) + '\DevEnv' }
$BackupDir = Join-Path $DevEnvRoot 'backups\pg'
$Retain = 7

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$LogFile = Join-Path $BackupDir 'backup.log'
function Write-Log([string]$Msg) {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Msg"
  $line | Out-File -FilePath $LogFile -Append -Encoding utf8
}
# pg_dump 定位候选链(高→低,与 Resolve-PgBinCandidateDirs 同源,不在本文件抄第二份盘符表):
#   ① $env:IHUI_PG_BIN_DIR 显式覆盖(换机/换盘只改机器级 env)
#   ② 运行中 PostgreSQL 服务 ImagePath 反查 …\bin\pg_ctl.exe(与服务器版本天然配对)
#   ③ $env:ProgramFiles\PostgreSQL\<版本>\bin(按版本降序)
#   ④ PATH 上的 pg_dump.exe
# 2026-10-25 教训保留:pg tooling 换卷后 pwsh 只把 CommandNotFound 吐到控制台,而计划任务经
# wscript 启动看不到 stderr ⇒ 本地备份静默烂了一个月(P5/P7 靠读文件才量到)。
# 失踪守卫必须写 backup.log —— 停摆要留下能被人量到的痕迹,不得只剩任务面 Last Result 0 的谎。
$pgBinCandidates = @()
if ($env:IHUI_PG_BIN_DIR) { $pgBinCandidates += $env:IHUI_PG_BIN_DIR }
try {
  $pgSvcs = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
    Where-Object { $_.PathName -and $_.PathName -match '(?i)postgres' -and $_.State -eq 'Running' } |
    Sort-Object Name -Descending)
  foreach ($s in $pgSvcs) {
    $m = [regex]::Match($s.PathName, '^"?([^"]+?)[\\/]bin[\\/]pg_ctl\.exe', 'IgnoreCase')
    if ($m.Success) { $pgBinCandidates += (Join-Path $m.Groups[1].Value 'bin') }
  }
} catch {
  Write-Log "WARN: 从服务反查 PG bin 失败(跳过该候选): $($_.Exception.Message)"
}
$pfRoot = if ($env:ProgramFiles) { Join-Path $env:ProgramFiles 'PostgreSQL' } else { $null }
if ($pfRoot -and (Test-Path -LiteralPath $pfRoot)) {
  $installs = @(Get-ChildItem -LiteralPath $pfRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Name -replace '\D', '') } -Descending)
  foreach ($d in $installs) { $pgBinCandidates += (Join-Path $d.FullName 'bin') }
}
$pgCmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
if ($pgCmd -and $pgCmd.Source) { $pgBinCandidates += (Split-Path -Parent $pgCmd.Source) }
$PgDump = $null
foreach ($cand in ($pgBinCandidates | Where-Object { $_ } | Select-Object -Unique)) {
  $probe = Join-Path $cand 'pg_dump.exe'
  if (Test-Path -LiteralPath $probe) { $PgDump = $probe; break }
}
if (-not $PgDump) {
  $tried = if ($pgBinCandidates.Count -gt 0) { $pgBinCandidates -join ' | ' } else { '(无候选)' }
  Write-Log "ERROR: pg_dump 不在位 —— 候选全落空: $tried —— 出路:设 IHUI_PG_BIN_DIR=<含 pg_dump.exe 的 bin 目录>"
  exit 1
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
