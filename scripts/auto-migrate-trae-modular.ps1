# TRAE ModularData 自动迁移脚本(计划任务用,TRAE 未运行时执行)
# 用法:由计划任务在开机/登录时自动调用,也可手动运行
# 原理:检测 TRAE 进程 → 未运行则复制 ModularData/logs 到 D 盘 → 删除原目录 → 创建符号链接

$ErrorActionPreference = 'Continue'
$logFile = "D:\caches\trae-modular-data\migration.log"
$lockFile = "D:\caches\trae-modular-data\migration.lock"

# 防止重复执行
if (Test-Path $lockFile) {
  $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($lockAge.TotalMinutes -lt 30) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 跳过:30 分钟内已执行过" | Out-File $logFile -Append
    exit 0
  }
}
New-Item -ItemType File -Path $lockFile -Force | Out-Null

function Log {
  param([string]$msg)
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
  Write-Host $line
  $line | Out-File $logFile -Append -ErrorAction SilentlyContinue
}

Log "=========================================="
Log "TRAE ModularData 自动迁移检查"

# ===== 1. 检查 TRAE 是否在运行 =====
$traeProc = Get-Process | Where-Object {
  $_.ProcessName -like "*trae*" -or $_.ProcessName -like "*Trae*" -or $_.ProcessName -like "*solo*"
}
if ($traeProc) {
  Log "跳过:TRAE 正在运行(PID: $($traeProc.Id -join ','))"
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}
Log "OK:TRAE 未运行,可以迁移"

# ===== 2. 检查符号链接是否已存在(已迁移过)=====
$modularPath = "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\ModularData"
$logsPath = "C:\Users\荣耀\AppData\Roaming\TRAE SOLO CN\logs"

$modularMigrated = $false
$logsMigrated = $false

if (Test-Path $modularPath) {
  $item = Get-Item $modularPath -Force -ErrorAction SilentlyContinue
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    $modularMigrated = $true
    Log "OK:ModularData 已是符号链接,跳过"
  }
}
if (Test-Path $logsPath) {
  $item = Get-Item $logsPath -Force -ErrorAction SilentlyContinue
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    $logsMigrated = $true
    Log "OK:logs 已是符号链接,跳过"
  }
}

if ($modularMigrated -and $logsMigrated) {
  Log "全部已迁移,无需操作"
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  exit 0
}

# ===== 3. 迁移 ModularData =====
if (-not $modularMigrated -and (Test-Path $modularPath)) {
  $dst = "D:\caches\trae-modular-data\ModularData"
  Log "开始迁移 ModularData..."

  # 确保 D 盘目标存在
  if (-not (Test-Path $dst)) {
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
  }

  try {
    # 复制
    Log "  复制到 D 盘..."
    Copy-Item -Path "$modularPath\*" -Destination $dst -Recurse -Force -ErrorAction Stop

    # 验证 D 盘数据
    $dstSize = (Get-ChildItem $dst -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $srcSize = (Get-ChildItem $modularPath -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    Log ("  源: {0} GB,目标: {1} GB" -f [math]::Round($srcSize/1GB,2), [math]::Round($dstSize/1GB,2))

    if ($dstSize -lt ($srcSize * 0.95)) {
      Log "  [FAIL] D 盘数据不完整,放弃迁移"
      Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
      exit 1
    }

    # 删除原目录
    Log "  删除 C 盘原目录..."
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($modularPath,'OnlyErrorDialogs','DeletePermanently')

    # 创建符号链接
    Log "  创建符号链接..."
    $linkResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","mklink","/D",("`"$modularPath`""),("`"$dst`"") -Verb RunAs -Wait -PassThru -WindowStyle Hidden
    if ($linkResult.ExitCode -eq 0) {
      Log "  [OK] ModularData 迁移完成"
    } else {
      Log ("  [FAIL] mklink 退出码: {0}" -f $linkResult.ExitCode)
    }
  } catch {
    Log ("  [FAIL] {0}" -f $_.Exception.Message)
  }
}

# ===== 4. 迁移 logs =====
if (-not $logsMigrated -and (Test-Path $logsPath)) {
  $dstLogs = "D:\caches\trae-modular-data\logs"
  Log "开始迁移 logs..."

  if (-not (Test-Path $dstLogs)) {
    New-Item -ItemType Directory -Path $dstLogs -Force | Out-Null
  }

  try {
    Log "  复制到 D 盘..."
    Copy-Item -Path "$logsPath\*" -Destination $dstLogs -Recurse -Force -ErrorAction Stop

    Log "  删除 C 盘原目录..."
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($logsPath,'OnlyErrorDialogs','DeletePermanently')

    Log "  创建符号链接..."
    $linkResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","mklink","/D",("`"$logsPath`""),("`"$dstLogs`"") -Verb RunAs -Wait -PassThru -WindowStyle Hidden
    if ($linkResult.ExitCode -eq 0) {
      Log "  [OK] logs 迁移完成"
    } else {
      Log ("  [FAIL] mklink 退出码: {0}" -f $linkResult.ExitCode)
    }
  } catch {
    Log ("  [FAIL] {0}" -f $_.Exception.Message)
  }
}

# ===== 5. 验证 =====
$free = (Get-PSDrive C).Free
Log ("C 盘可用: {0} GB" -f [math]::Round($free/1GB,2))
Log "=========================================="

Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
exit 0
