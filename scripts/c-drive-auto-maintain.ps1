# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
param(
  # 预演:只列将要删什么、各占多少,不落删除动作。清理类任务的铁律是先看清身份再动手。
  [switch]$DryRun
)
# C 盘自动维护脚本(计划任务用,每天凌晨 3 点自动执行)
# 功能:① 清理 Chrome 缓存 ② 清理 Temp 旧文件 ③ 报告 C 盘状态
# 用法:由计划任务自动调用,也可手动 pwsh -File 此脚本

$ErrorActionPreference = 'Continue'
# 维护日志落统一外置根的 logs 下。原写 D:\caches\ 属死路径(本机不存在该目录,日志从未写出)。
$logFile = "D:\DevEnv\logs\c-drive-maintain.log"

function Log {
  param([string]$msg, [string]$level = "INFO")
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
  Write-Host $line
  $line | Out-File $logFile -Append -ErrorAction SilentlyContinue
}

Add-Type -AssemblyName Microsoft.VisualBasic

function ForceDelete {
  param([string]$path)
  if (-not (Test-Path $path)) { return [double]0 }
  # DryRun 必须在这条唯一的删除出口上拦:曾把它只写在第 3 段,结果预演模式照样
  # 把 [1/3] Chrome 缓存和 [2/3] Temp 旧目录真删了(DeletePermanently,不进回收站)。
  if ($DryRun) {
    Log ("  [DRY]  {0}" -f $path)
    return [double]0
  }
  # 单文件走另一条 API:原实现只有 DeleteDirectory 分支,对文件路径必然抛后被 catch
  # 吞掉 → 静默"清理成功但什么都没删"(盘根的 IHUI-*.ps1 就属于这一类)。
  if (Test-Path -PathType Leaf -LiteralPath $path) {
    try {
      $flen = (Get-Item -LiteralPath $path).Length
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, 'OnlyErrorDialogs', 'DeletePermanently')
      return [double]$flen
    } catch { return [double]0 }
  }
  $size = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  if (-not $size) { $size = [double]0 }
  try {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($path,'OnlyErrorDialogs','DeletePermanently')
    return [double]$size
  } catch {
    # 尝试逐项删
    try {
      Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Sort-Object -Property FullName -Descending | ForEach-Object {
        if ($_.PSIsContainer) {
          [System.IO.Directory]::Delete($_.FullName, $false)
        } else {
          [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($_.FullName,'OnlyErrorDialogs','DeletePermanently')
        }
      }
      [System.IO.Directory]::Delete($path, $false)
      return [double]$size
    } catch {
      return [double]0
    }
  }
}

Log "=========================================="
if ($DryRun) {
  Log "C 盘自动维护 —— DRY RUN(全脚本不删任何东西)" "WARN"
} else {
  Log "C 盘自动维护开始"
}

$before = (Get-PSDrive C).Free
Log ("清理前 C 盘可用: {0} GB" -f [math]::Round($before/1GB,2))

[double]$freed = 0

# ===== 1. Chrome 缓存(保留用户数据)=====
Log "[1/3] 清理 Chrome 缓存"
$chromeCaches = @(
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\OptGuideOnDeviceModel",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\component_crx_cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\GraphiteDawnCache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\Cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\Code Cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\GPUCache"
)
foreach ($t in $chromeCaches) {
  $sz = ForceDelete $t
  if ($sz -gt 0) {
    $freed += $sz
    Log ("  [OK] {0,6} MB  {1}" -f [math]::Round($sz/1MB,1), $t)
  }
}

# ===== 2. Temp 旧文件(>3 天)=====
Log "[2/3] 清理 Temp 旧文件"
$lt = "$env:LOCALAPPDATA\Temp"
$oldTemp = Get-ChildItem $lt -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
  $_.LastWriteTime -lt (Get-Date).AddDays(-3)
}
foreach ($d in $oldTemp) {
  # 逐条留痕:这一段按"目录 >3 天"整片删,不限项目产物,必须能事后回答"删了什么"。
  # 前缀按模式区分 —— 曾经无条件写 [DEL],预演模式下的日志看起来像已经删了。
  if (-not $DryRun) { Log ("  [DEL]  {0}" -f $d.FullName) }
  $sz = ForceDelete $d.FullName
  if ($sz -gt 0) { $freed += $sz }
}
Log ("  [OK] Temp 旧目录已清理,释放 {0} MB" -f [math]::Round(($freed/1MB),1))

# C:\Windows\Temp 旧文件
$wt = "C:\Windows\Temp"
$oldFiles = Get-ChildItem $wt -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
  -not $_.PSIsContainer -and $_.LastWriteTime -lt (Get-Date).AddDays(-3)
}
$wtSize = ($oldFiles | Measure-Object -Property Length -Sum).Sum
if (-not $wtSize) { $wtSize = 0 }
foreach ($f in $oldFiles) {
  if ($DryRun) { Log ("  [DRY]  {0}" -f $f.FullName); continue }
  try { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($f.FullName,'OnlyErrorDialogs','DeletePermanently') } catch {}
}
if (-not $DryRun) { $freed += $wtSize }

# ===== 3. 本项目落在 C 盘的产物 =====
# 2026-09-23 修:这一段原来扫的是 C:\temp,而我们实际写到的地方是 C:\tmp(构建备份,
# 实攒 13.2GB)、%LOCALAPPDATA%\Temp(git 夹具)、以及盘根本身。扫错目录 = 每天跑也零效果。
Log "[3/3] 清理本项目在 C 盘的产物"

# 凭据/备份类目录名一律整目录跳过 —— 清理任务不得靠近口令表(§15 历史事故)。
$protectedNames = @(
  'secrets', 'secret', 'credentials', 'credential', '密钥',
  'certs', 'certificates', 'backups', 'backup', 'BaiduSyncdisk'
)
function Test-Protected {
  param([string]$path)
  foreach ($seg in ($path -split '[\\/]')) {
    foreach ($p in $protectedNames) {
      if ($seg.ToLower() -eq $p.ToLower()) { return $true }
    }
  }
  return $false
}

$cCandidates = @()
# 盘根:项目自己写的探查脚本 / 构建状态 / 清理实验残骸 / 误建的 pnpm store
$cCandidates += Get-ChildItem "C:\" -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'IHUI-*' -or $_.Name -like '.empty-tmp*' }
if ((Test-Path "C:\.pnpm-store") -and ((Get-Item "C:\.pnpm-store").LastWriteTime -lt (Get-Date).AddDays(-1))) {
  $cCandidates += Get-Item "C:\.pnpm-store" -Force
}
# C:\tmp 与 C:\temp:构建备份 / 探查脚本 / 调试日志
foreach ($t in @("C:\tmp", "C:\temp")) {
  $cCandidates += Get-ChildItem $t -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like 'ihui-*' -or $_.Name -like 'IHUI-*' -or
    $_.Name -like 'next-backup-*' -or $_.Name -like 'probe-*' -or
    $_.Name -eq 'wb-ext-debug.log'
  }
}
# 活 TEMP:测试夹具(名字必须命中 ihui- 前缀,别人的工具态一律不碰)
$cCandidates += Get-ChildItem "$env:LOCALAPPDATA\Temp" -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'ihui-*' }

foreach ($d in ($cCandidates | Sort-Object FullName -Unique)) {
  if (Test-Protected $d.FullName) {
    Log ("  [SKIP] 受保护目录内,不清理: {0}" -f $d.FullName) "WARN"
    continue
  }
  if ($DryRun) {
    ForceDelete $d.FullName | Out-Null
    continue
  }
  $sz = ForceDelete $d.FullName
  $freed += $sz
  Log ("  [DEL]  {0,8} MB  {1}" -f [math]::Round($sz/1MB,1), $d.FullName)
}

# ===== 总结 =====
Start-Sleep -Seconds 1
$after = (Get-PSDrive C).Free
Log ("==========================================")
Log ("清理后 C 盘可用: {0} GB" -f [math]::Round($after/1GB,2))
Log ("本次释放:       {0} GB" -f [math]::Round(($after-$before)/1GB,2))
Log ("==========================================")

# 如果 C 盘可用 < 15 GB,触发警报
if ($after -lt 15GB) {
  Log "[警告] C 盘可用空间不足 15 GB!请人工检查" "WARN"
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
