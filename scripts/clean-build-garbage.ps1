# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# ============================================================================
# 仓库构建垃圾根治脚本(计划任务每周日 04:00 自动执行)
# ============================================================================
# 根治对象(2026-10-13 实测的四类膨胀源,只增不减、没有任何一方回收):
#   1. Turbopack 编译缓存 .next/cache/turbopack + .next/dev/cache/turbopack
#      —— RocksDB 持久缓存,无淘汰机制,dev server 越开越大(实测攒到 9.6GB)。
#        纯缓存,清空后下次 dev server 启动自动重建(首次启动慢约半分钟)。
#   2. Rust 增量编译缓存 target/debug/incremental
#      —— rustc 自管的纯缓存,清空后下次编译自动重建,只损失当次增量加速。
#   3. Rust 陈旧构建产物(deps 多版本 hash 残留)—— 用 cargo-sweep 按 mtime 清理,
#      它会连带删对应 fingerprint,cargo 下次编译正确重建,不会出现指纹不一致。
#   4. Git 松散对象 —— 本仓 local config gc.auto=0(刻意关闭自动 gc,避免与高频
#      agent git 操作锁冲突),因此松散对象无人回收(实测滚到 17.96 GiB)。这里每周
#      轻量 repack -d + prune,不跑 --aggressive(实测它在 22GB 全量 repack 时
#      Out of memory 失败;普通 repack 只打包松散对象,内存友好且 10 分钟内完成)。
# 另含 Android/Gradle 构建产物(mtime>30 天才删,防止删掉最近构建)。
#
# 安全约定(与 c-drive-auto-maintain.ps1 同口径):
#   - 正在被构建进程占用的目标一律跳过并留痕,绝不硬删正在写的缓存
#   - -DryRun 只列将删什么,不落删除动作(删除出口单点 ForceDelete 拦截)
#   - 日志落 D:\DevEnv\logs\build-garbage-clean.log
#
# 用法:
#   pwsh -File scripts\clean-build-garbage.ps1              # 真执行(计划任务档)
#   pwsh -File scripts\clean-build-garbage.ps1 -DryRun      # 预演,零删除
#   pwsh -File scripts\clean-build-garbage.ps1 -InstallTask # 注册/更新每周计划任务
# 验证:
#   Get-ScheduledTask -TaskName 'IHUI-CleanBuildGarbage' | Select TaskName, State
# 卸载:
#   Unregister-ScheduledTask -TaskName 'IHUI-CleanBuildGarbage' -Confirm:$false
# ============================================================================

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$InstallTask,
  [string]$TaskName = 'IHUI-CleanBuildGarbage',
  [string]$TaskTime = '04:00'
)

$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logFile = 'D:\DevEnv\logs\build-garbage-clean.log'
# 阈值:低于它不动,防止"每次运行都清空、缓存永远热不起来"。
$turbopackCapMB = 3072   # Turbopack 缓存超过 3GB 才清
$incrementalCapMB = 2048 # Rust incremental 超过 2GB 才清
$gitLooseCapMB = 512     # git 松散对象超过 512MB 才 repack
$gradleAgeDays = 30      # gradle build 目录超 30 天未动才删
$sweepAgeDays = 30       # cargo sweep 保留最近 30 天构建

function Log {
  param([string]$msg, [string]$level = 'INFO')
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
  Write-Host $line
  $line | Out-File $logFile -Append -ErrorAction SilentlyContinue
}

$delTag = if ($DryRun) { '[DRY]' } else { '[DEL]' }

function Get-PathSize {
  param([string]$path)
  if (-not (Test-Path -LiteralPath $path)) { return [double]0 }
  $sum = (Get-ChildItem -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if (-not $sum) { return [double]0 }
  return [double]$sum
}

# 唯一删除出口:DryRun 拦截与逐条留痕都在这里单点保证。
function ForceDelete {
  param([string]$path)
  if (-not (Test-Path -LiteralPath $path)) { return [double]0 }
  $size = Get-PathSize $path
  if ($DryRun) {
    Log ("  {0} {1,8} MB  {2}" -f $delTag, [math]::Round($size/1MB,1), $path)
    return [double]0
  }
  try {
    Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
    Log ("  {0} {1,8} MB  {2}" -f $delTag, [math]::Round($size/1MB,1), $path)
    return $size
  } catch {
    # 典型场景:缓存正被 dev server / cargo 进程占用(文件锁)。留待下轮,不硬闯。
    Log ("  [FAIL] 删除失败(可能被进程占用,下轮重试): {0} :: {1}" -f $path, $_.Exception.Message) 'WARN'
    return [double]0
  }
}

# 构建进程检测:正在跑对应构建时跳过对应段,绝不硬删正在写的缓存。
function Test-DevServerRunning {
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  foreach ($p in $procs) {
    if ($p.CommandLine -match 'next[\\/]dev|next-dev|apps[\\/]web') { return $true }
  }
  return $false
}
function Test-RustBuildRunning {
  if (Get-Process -Name 'cargo', 'rustc' -ErrorAction SilentlyContinue) { return $true }
  return $false
}

# ===== -InstallTask:注册/更新每周计划任务后直接退出 =====
if ($InstallTask) {
  Log "注册计划任务 $TaskName(每周日 $TaskTime)"
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    Log "  任务已存在,先移除旧版(幂等)"
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
  $pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
  if (-not $pwsh) { $pwsh = 'pwsh' }
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $TaskTime
  $action = New-ScheduledTaskAction -Execute $pwsh `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\clean-build-garbage.ps1`"" `
    -WorkingDirectory $repoRoot
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
  # S4U:非交互 session 0 运行,不需要存储密码(与 IHUI-RefreshCliToken 同口径)。
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Trigger $trigger -Action $action -Settings $settings -Principal $principal -Force | Out-Null
  $check = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($check) { Log ("  [OK] 已注册,状态={0};触发器=每周日 {1}" -f $check.State, $TaskTime) }
  else { Log "  [FAIL] 注册未生效,请检查上面的报错" 'WARN'; exit 1 }
  exit 0
}

Log "=========================================="
if ($DryRun) { Log '构建垃圾清理 —— DRY RUN(不删任何东西)' 'WARN' } else { Log '构建垃圾清理开始' }
$beforeFree = (Get-PSDrive G -ErrorAction SilentlyContinue).Free
[double]$freed = 0

# ===== [1/5] Turbopack 编译缓存 =====
Log '[1/5] Turbopack 编译缓存'
$tpPaths = @(
  (Join-Path $repoRoot 'apps\web\.next\dev\cache\turbopack'),
  (Join-Path $repoRoot 'apps\web\.next\cache\turbopack')
)
if (Test-DevServerRunning) {
  Log '  [SKIP] 检测到 web dev server 正在运行,缓存正被 RocksDB 持久化占用,本轮不动' 'WARN'
} else {
  [double]$tpFreed = 0
  foreach ($tp in $tpPaths) {
    $sz = Get-PathSize $tp
    if ($sz -gt ($turbopackCapMB * 1MB)) {
      Log ("  [判定] {0} = {1:N1} MB > {2} MB 上限 ⇒ 清空(纯缓存,dev server 下次启动自动重建)" -f $tp, ($sz/1MB), $turbopackCapMB)
      $tpFreed += ForceDelete $tp
    } elseif ($sz -gt 0) {
      Log ("  [保留] {0} = {1:N1} MB ≤ {2} MB 上限,不动" -f $tp, ($sz/1MB), $turbopackCapMB)
    }
  }
  $freed += $tpFreed
  Log ("  [OK] Turbopack 缓存释放 {0} MB" -f [math]::Round($tpFreed/1MB,1))
}

# ===== [2/5] Rust 增量编译缓存 =====
Log '[2/5] Rust 增量编译缓存'
$incPath = Join-Path $repoRoot 'apps\desktop\src-tauri\target\debug\incremental'
if (Test-RustBuildRunning) {
  Log '  [SKIP] 检测到 cargo/rustc 正在运行,本轮不动 incremental' 'WARN'
} else {
  $incSz = Get-PathSize $incPath
  if ($incSz -gt ($incrementalCapMB * 1MB)) {
    Log ("  [判定] {0} = {1:N1} MB > {2} MB 上限 ⇒ 清空(rustc 自管纯缓存,下次编译自动重建)" -f $incPath, ($incSz/1MB), $incrementalCapMB)
    $freed += ForceDelete $incPath
  } elseif ($incSz -gt 0) {
    Log ("  [保留] {0} = {1:N1} MB ≤ {2} MB 上限,不动" -f $incPath, ($incSz/1MB), $incrementalCapMB)
  } else {
    Log '  [OK] incremental 不存在,无需处理'
  }
}

# ===== [3/5] Rust 陈旧构建产物(cargo-sweep) =====
Log '[3/5] Rust 陈旧构建产物(cargo sweep)'
$tauriDir = Join-Path $repoRoot 'apps\desktop\src-tauri'
# CARGO_HOME 在本机被改到 D:\caches\rustup 一族的外置根(2026-10-13 实测
# $env:CARGO_HOME=D:\caches\cargo),硬编码 ~/.cargo/bin 会恒 false ⇒ 段内空转。
# S4U 计划任务身份可能读不到进程级 env,故加注册表 HKCU\Environment 回退。
$cargoHome = $env:CARGO_HOME
if (-not $cargoHome) {
  $cargoHome = (Get-ItemProperty -LiteralPath 'HKCU:\Environment' -Name 'CARGO_HOME' -ErrorAction SilentlyContinue).CARGO_HOME
}
if (-not $cargoHome) { $cargoHome = Join-Path $env:USERPROFILE '.cargo' }
$sweepBin = Join-Path (Join-Path $cargoHome 'bin') 'cargo-sweep.exe'
if (Test-RustBuildRunning) {
  Log '  [SKIP] 检测到 cargo/rustc 正在运行,本轮不动 deps' 'WARN'
} elseif (-not (Test-Path -LiteralPath $sweepBin)) {
  Log ("  [SKIP] cargo-sweep 未安装(找不到 {0}),跳过。安装:cargo install cargo-sweep" -f $sweepBin) 'WARN'
} elseif (-not (Test-Path -LiteralPath (Join-Path $tauriDir 'Cargo.toml'))) {
  Log ("  [SKIP] 未找到 {0}\Cargo.toml,跳过" -f $tauriDir)
} else {
  # cargo sweep --time N:删除 N 天未被使用的构建产物(含对应 fingerprint),
  # 由工具保证一致性 —— 绝不手删 deps 里的 hash 文件(cargo 不校验产物存在性,
  # 手删会 fingerprint 指向缺失文件导致下次编译直接失败)。
  if ($DryRun) {
    Log ("  [DRY] 将执行 cargo sweep --time {0}(预演不执行;真实执行时清理超龄构建)" -f $sweepAgeDays)
  } else {
    Push-Location $tauriDir
    try {
      & $sweepBin "sweep" --time $sweepAgeDays 2>&1 | ForEach-Object { Log ("  [sweep] {0}" -f $_) }
      Log ("  [OK] cargo sweep --time {0} 完成(退出码 {1})" -f $sweepAgeDays, $LASTEXITCODE)
    } finally {
      Pop-Location
    }
  }
}

# ===== [4/5] Git 松散对象(本仓 gc.auto=0,只能靠每周计划任务兜底) =====
Log '[4/5] Git 松散对象 repack'
$gitDir = Join-Path $repoRoot '.git'
$gitLock = Join-Path $gitDir 'index.lock'
if (-not (Test-Path -LiteralPath $gitDir)) {
  Log "  [SKIP] {0} 不存在,跳过" -f $gitDir
} elseif (Test-Path -LiteralPath $gitLock) {
  Log '  [SKIP] .git/index.lock 存在(有 git 操作在进行),本轮不动' 'WARN'
} else {
  # 松散对象体积 = .git/objects 减去 pack/。用 count-objects 的权威输出判定。
  $co = & git -C $repoRoot count-objects -v 2>&1 | Out-String
  $looseMB = 0
  if ($co -match 'size:\s+(\d+)\s+K') { $looseMB = [int]$Matches[1] / 1KB }
  if ($looseMB -gt $gitLooseCapMB) {
    Log ("  [判定] 松散对象 {0:N1} MB > {1} MB 上限 ⇒ repack -d -f + prune" -f $looseMB, $gitLooseCapMB)
    if ($DryRun) {
      Log '  [DRY] 将执行 git repack -d -f 与 git prune --expire=2.weeks.ago(预演不执行)'
    } else {
      # repack -d:只打包松散对象,不全量合并 packs(内存友好;--aggressive 全量
      # repack 在本仓 22GB 规模上 Out of memory 失败过,勿改回)。
      & git -C $repoRoot repack -d -f 2>&1 | Select-Object -Last 3 | ForEach-Object { Log ("  [repack] {0}" -f $_) }
      # prune 只清 2 周前的不可达对象:给 reflog/进行中的操作留缓冲,不追最新。
      & git -C $repoRoot prune --expire=2.weeks.ago 2>&1 | Select-Object -Last 3 | ForEach-Object { Log ("  [prune] {0}" -f $_) }
      $co2 = & git -C $repoRoot count-objects -v 2>&1 | Out-String
      if ($co2 -match 'size:\s+(\d+)\s+K') {
        Log ("  [OK] repack 后松散对象 = {0:N1} MB" -f ([int]$Matches[1] / 1KB))
      }
    }
  } else {
    Log ("  [保留] 松散对象 {0:N1} MB ≤ {1} MB 上限,不动" -f $looseMB, $gitLooseCapMB)
  }
}

# ===== [5/5] Android/Gradle 构建产物(mtime>30 天) =====
Log '[5/5] Android/Gradle 构建产物'
$gradlePaths = @(
  (Join-Path $repoRoot 'apps\mobile-rn\android\app\build'),
  (Join-Path $repoRoot 'apps\mobile-cap\android\app\build')
)
$cut = (Get-Date).AddDays(-$gradleAgeDays)
[double]$grFreed = 0
foreach ($g in $gradlePaths) {
  if (-not (Test-Path -LiteralPath $g)) { continue }
  $mtime = (Get-Item -LiteralPath $g -Force).LastWriteTime
  if ($mtime -lt $cut) {
    Log ("  [判定] {0} 最后构建 {1:yyyy-MM-dd}(>{2} 天未动)⇒ 清除,下次 gradle 构建重建" -f $g, $mtime, $gradleAgeDays)
    $grFreed += ForceDelete $g
  } else {
    Log ("  [保留] {0} 最后构建 {1:yyyy-MM-dd}(≤{2} 天),可能是近期构建,不动" -f $g, $mtime, $gradleAgeDays)
  }
}
$freed += $grFreed
Log ("  [OK] Gradle 产物释放 {0} MB" -f [math]::Round($grFreed/1MB,1))

# ===== 总结 =====
Log '=========================================='
if ($DryRun) { Log '本轮为 DRY RUN:未删除任何文件,以上 [DRY] 均为「将要删」的量' 'WARN' }
$afterFree = (Get-PSDrive G -ErrorAction SilentlyContinue).Free
if ($beforeFree -and $afterFree) {
  Log ("G 盘可用: {0} GB → {1} GB(本次释放 {2} GB)" -f `
    [math]::Round($beforeFree/1GB,2), [math]::Round($afterFree/1GB,2), [math]::Round(($afterFree-$beforeFree)/1GB,2))
}
Log ("合计释放: {0} MB" -f [math]::Round($freed/1MB,1))
Log '=========================================='
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
