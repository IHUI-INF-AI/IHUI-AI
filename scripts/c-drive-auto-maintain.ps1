# C 盘自动维护脚本(计划任务用,每天凌晨 3 点自动执行)
# 功能:① 清理 TRAE 旧 logs/Crashpad/CachedData ② 清理 Chrome 缓存 ③ 清理 Temp 旧文件
#      ④ 触发 TRAE ModularData 迁移(如 TRAE 未运行)⑤ 报告 C 盘状态
# 用法:由计划任务自动调用,也可手动 pwsh -File 此脚本

$ErrorActionPreference = 'Continue'
$logFile = "D:\caches\c-drive-maintain.log"

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
Log "C 盘自动维护开始"

$before = (Get-PSDrive C).Free
Log ("清理前 C 盘可用: {0} GB" -f [math]::Round($before/1GB,2))

[double]$freed = 0

# ===== 1. TRAE SOLO CN 当前版 logs/Crashpad/CachedData(保留 ModularData)=====
Log "[1/5] 清理 TRAE SOLO CN logs/Crashpad/CachedData"
$traeCaches = @(
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\CachedData",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\Crashpad",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\Cache",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\GPUCache",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\Code Cache",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\DawnWebGPUCache",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\DawnGraphiteCache",
  "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\blob_storage"
)
foreach ($t in $traeCaches) {
  $sz = ForceDelete $t
  if ($sz -gt 0) {
    $freed += $sz
    Log ("  [OK] {0,6} MB  {1}" -f [math]::Round($sz/1MB,1), $t)
  }
}

# ===== 2. 旧版 TRAE 残留(整个目录)=====
Log "[2/5] 清理旧版 TRAE 残留"
$freed += ForceDelete "C:\Users\荣耀\AppData\Roaming\TRAE SOLO"
$freed += ForceDelete "C:\Users\荣耀\AppData\Roaming\Trae CN"

# ===== 3. Chrome 缓存(保留用户数据)=====
Log "[3/5] 清理 Chrome 缓存"
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

# ===== 4. Temp 旧文件(>3 天)=====
Log "[4/5] 清理 Temp 旧文件"
$lt = "$env:LOCALAPPDATA\Temp"
$oldTemp = Get-ChildItem $lt -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
  $_.LastWriteTime -lt (Get-Date).AddDays(-3) -and $_.Name -ne "trae-agent-toolhost"
}
foreach ($d in $oldTemp) {
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
  try { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($f.FullName,'OnlyErrorDialogs','DeletePermanently') } catch {}
}
$freed += $wtSize

# C:\temp\ihui-* 项目违规写入
$ihuiTemp = Get-ChildItem "C:\temp" -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "ihui-*" }
foreach ($d in $ihuiTemp) {
  $sz = ForceDelete $d.FullName
  if ($sz -gt 0) { $freed += $sz }
}

# ===== 5. 触发 TRAE ModularData 迁移(如未运行)=====
Log "[5/5] 触发 TRAE ModularData 自动迁移(如 TRAE 未运行)"
$migrationScript = "D:\桌面\项目\IHUI-AI\scripts\auto-migrate-trae-modular.ps1"
if (Test-Path $migrationScript) {
  try {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File $migrationScript 2>&1 | ForEach-Object { Log "  $_" }
  } catch {
    Log ("  [FAIL] 迁移脚本执行失败: {0}" -f $_.Exception.Message) "ERROR"
  }
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
