# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
param(
  # 预演:只列将要删什么、各占多少,不落删除动作。清理类任务的铁律是先看清身份再动手。
  [switch]$DryRun
)
# C 盘自动维护脚本(计划任务用,每天凌晨 3 点自动执行)
# 功能:① 清理 Chrome 缓存(路径不存在则只告警) ② 清理 Temp 旧目录(默认只删本项目产物名字)
#       ③ 清理本项目落在 C 盘的产物 ④ 报告 C 盘状态
# 删除面总原则:按名字,不整片。宽口径整片清扫只在 IHUI_TEMP_WIDE_SWEEP=1 时启用。
# 用法:由计划任务自动调用,也可手动 pwsh -File 此脚本(强烈建议先加 -DryRun)

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

# 逐条删除留痕的前缀在此单点决定:DryRun 下恒为 [DRY],因此全脚本不可能出现 [DEL]。
# (原先有一处 [DEL] 打在 DryRun 分支之前,预演日志读起来像已经删了。)
$delTag = if ($DryRun) { '[DRY]' } else { '[DEL]' }

# 本项目落在 TEMP 里的产物名字表 —— 第 2 段"默认删除面"的唯一依据。
# 注:PowerShell 的 -like 默认忽略大小写,故 'ihui-*' 同时覆盖 'IHUI-*'。
$projectTempNamePatterns = @(
  'ihui-*',
  'next-backup-*',
  'probe-*',
  'wb-ext-debug.log'
)
function Test-ProjectTempName {
  param([string]$name)
  foreach ($p in $projectTempNamePatterns) {
    if ($name -like $p) { return $true }
  }
  return $false
}

# 凭据/备份类目录名一律整目录跳过 —— 清理任务不得靠近口令表(§15 历史事故)。
# 定义提前到首段之前:原先只有第 3 段用,而 Temp 宽口径清扫同样必须过这道判据。
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

# 体积统计单点实现(ForceDelete 与 skipped 计数共用,避免两份算法)。
# ⚠️ 先判重解析点:junction 必须"就地断链",绝不能跟着递归 —— 实测 PowerShell 7 的
# `Get-ChildItem -Recurse` **会穿过 junction** 枚举到目标里的文件(本仓 2026-09-24 实测),
# 于是"按名字删 C:\tmp\ihui-*"会顺着链接打到 D:\DevEnv\Temp\c-root-tmp\ 的真实目标上。
# 体积口径同理:跟进去就把 D 盘的量算成 C 盘的债。
function Test-ReparsePoint {
  param([string]$path)
  # 必须显式判存在 + ErrorAction Stop:默认 Continue 下"路径不存在"是**非终止错误**,
  # catch 根本接不住 ⇒ 每天对不存在的 C:\temp 甩一条红字到日志(实测)。
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  try {
    $attr = (Get-Item -LiteralPath $path -Force -ErrorAction Stop).Attributes
    return ($attr -match 'ReparsePoint')
  } catch {
    return $false
  }
}

function Get-PathSize {
  param([string]$path)
  if (Test-ReparsePoint $path) { return [double]0 }
  $sum = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if (-not $sum) { return [double]0 }
  return [double]$sum
}

function ForceDelete {
  param([string]$path)
  if (-not (Test-Path -LiteralPath $path)) { return [double]0 }
  # DryRun 必须拦在这条唯一的删除出口上:曾把它只写在第 3 段,结果预演模式照样
  # 把 [1/3] Chrome 缓存和 [2/3] Temp 旧目录真删了(DeletePermanently,不进回收站)。
  if ($DryRun) {
    Log ("  {0}  {1}" -f $delTag, $path)
    return [double]0
  }
  # 重解析点只能**断链**,绝不能进 DeleteDirectory/递归分支:那会顺着 junction 删掉
  # 外置根里的真实内容(§26 的改道机制因此变成自毁机制)。
  if (Test-ReparsePoint $path) {
    try {
      # System.IO.Directory::Delete(path,false) 对 mount point 只移除链接本身;
      # 传 $true 或在 PS7 用 -Recurse 才是危险形态。
      [System.IO.Directory]::Delete($path, $false)
      Log ("  {0} 断链(未跟随目标) {1}" -f $delTag, $path) "WARN"
      return [double]0
    } catch {
      Log ("  [FAIL] 断链失败,已跳过: {0}" -f $path) "WARN"
      return [double]0
    }
  }
  # 单文件走另一条 API:原实现只有 DeleteDirectory 分支,对文件路径必然抛后被 catch
  # 吞掉 → 静默"清理成功但什么都没删"(盘根的 IHUI-*.ps1 就属于这一类)。
  if (Test-Path -PathType Leaf -LiteralPath $path) {
    try {
      $flen = (Get-Item -LiteralPath $path).Length
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, 'OnlyErrorDialogs', 'DeletePermanently')
      Log ("  {0} {1,8} MB  {2}" -f $delTag, [math]::Round($flen/1MB,2), $path)
      return [double]$flen
    } catch {
      Log ("  [FAIL] 删除失败(文件,已跳过): {0}" -f $path) "WARN"
      return [double]0
    }
  }
  $size = (Get-PathSize $path)
  try {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($path,'OnlyErrorDialogs','DeletePermanently')
    Log ("  {0} {1,8} MB  {2}" -f $delTag, [math]::Round($size/1MB,2), $path)
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
      Log ("  {0} {1,8} MB  {2}" -f $delTag, [math]::Round($size/1MB,2), $path)
      return [double]$size
    } catch {
      Log ("  [FAIL] 删除失败(目录,已跳过): {0}" -f $path) "WARN"
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
Log "[1/4] 清理 Chrome 缓存"
# 下面这批路径把用户名写死成"荣耀",而计划任务实际注册运行的用户是 $env:USERNAME,
# 本机该目录不存在 ⇒ 本段常年空转。**故意不改成指向真实用户配置**:那等于让一个每天
# 3:00 无人值守、DeletePermanently 不进回收站的任务突然开始删一个正在使用的浏览器缓存,
# 风险远大于收益。这里只做显式告警 + 如实报"清理 0 项",要不要改判据由人决定。
$chromeCaches = @(
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\OptGuideOnDeviceModel",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\component_crx_cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\GraphiteDawnCache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\Cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\Code Cache",
  "C:\Users\荣耀\AppData\Local\Google\Chrome\User Data\Default\GPUCache"
)
[double]$chromeFreed = 0
[int]$chromeTargets = 0
$chromeMissing = @()
foreach ($t in $chromeCaches) {
  if (-not (Test-Path -LiteralPath $t)) { $chromeMissing += $t; continue }
  if (Test-Protected $t) {
    Log ("  [SKIP] 受保护目录内,不清理: {0}" -f $t) "WARN"
    continue
  }
  $chromeTargets += 1
  $sz = ForceDelete $t
  $chromeFreed += $sz
  $freed += $sz
}
if ($chromeMissing.Count -gt 0) {
  Log ("  [WARN] Chrome 缓存段空转:{0}/{1} 项目标路径不存在 —— 脚本硬编码用户名与计划任务注册用户不一致(当前用户 = {2})" -f `
    $chromeMissing.Count, $chromeCaches.Count, $env:USERNAME) "WARN"
  foreach ($m in $chromeMissing) { Log ("         不存在: {0}" -f $m) }
}
Log ("  [OK] Chrome 缓存:清理 {0} 项(路径不存在 {1} 项),释放 {2} MB" -f `
  $chromeTargets, $chromeMissing.Count, [math]::Round($chromeFreed/1MB,1))

# ===== 2. Temp 旧目录(>3 天,默认只删本项目产物名字)=====
Log "[2/4] 清理 Temp 旧目录"
$lt = "$env:LOCALAPPDATA\Temp"
$oldTemp = @(Get-ChildItem $lt -Directory -Force -ErrorAction SilentlyContinue | Where-Object {
  $_.LastWriteTime -lt (Get-Date).AddDays(-3)
})
# 判据收紧(删除面变小):这一段原来对"$env:LOCALAPPDATA\Temp 下所有 mtime>3 天的目录"整片
# ForceDelete,完全不看名字 —— 与 AGENTS.md 承诺的"删除面是按名字的"相反,而且真删过东西
# (2026-09-23 一次误跑释放约 29.8MB 无主 Temp 目录,当时逐条日志一条都没有)。
# 现在:默认只删本项目产物名字;宽口径整片清扫必须显式设 IHUI_TEMP_WIDE_SWEEP=1 才恢复,
# 且未开启时把"本会被宽口径扫掉的目录"数量与体积如实打印成 skipped 计数,绝不静默。
$wideSweep = ($env:IHUI_TEMP_WIDE_SWEEP -eq '1')
[double]$tempFreed = 0
[int]$tempTargets = 0
[int]$tempSkipped = 0
[double]$tempSkippedSize = 0
$skippedSample = @()
foreach ($d in $oldTemp) {
  if (-not $wideSweep -and -not (Test-ProjectTempName $d.Name)) {
    $tempSkipped += 1
    $sz = Get-PathSize $d.FullName
    $tempSkippedSize += $sz
    if ($skippedSample.Count -lt 5) { $skippedSample += ("{0} ({1} MB)" -f $d.Name, [math]::Round($sz/1MB,1)) }
    continue
  }
  if (Test-Protected $d.FullName) {
    Log ("  [SKIP] 受保护目录内,不清理: {0}" -f $d.FullName) "WARN"
    continue
  }
  # 逐条留痕由 ForceDelete 单点输出([DRY]/[DEL] 按模式区分),失败另有 [FAIL],不再静默。
  $tempTargets += 1
  $sz = ForceDelete $d.FullName
  $tempFreed += $sz
  $freed += $sz
}
if ($wideSweep) {
  Log "  [WARN] IHUI_TEMP_WIDE_SWEEP=1 已启用:本段按整片清扫(mtime>3 天的目录不看名字,仅受保护目录例外)" "WARN"
}
# 这一行恒打印(计数为 0 也打),否则"默认按名字"这道判据在日志里没有任何痕迹。
$judgeMode = if ($wideSweep) { '宽口径已开' } else { '默认按名字' }
$judgeNames = $projectTempNamePatterns -join ' / '
Log ("  [JUDGE] 名字判据({0}):只删 {1};被跳过的旧目录 {2} 个,合计 {3} MB" -f $judgeMode, $judgeNames, $tempSkipped, [math]::Round($tempSkippedSize/1MB,1))
if ($tempSkipped -gt 0) {
  Log "  [SKIP] 上述被跳过项未被删除(设 IHUI_TEMP_WIDE_SWEEP=1 才会扫)" "WARN"
  foreach ($s in $skippedSample) { Log ("         例: {0}" -f $s) }
}
Log ("  [OK] Temp 旧目录:{0} {1} 项,释放 {2} MB" -f `
  $(if ($DryRun) { '预演命中' } else { '清理' }), $tempTargets, [math]::Round($tempFreed/1MB,1))

# C:\Windows\Temp 旧文件
# 说明:本子段是本脚本里唯一仍"不按名字"的删除面(系统临时目录,与本项目产物名字无关),
# 本次改动未收紧它,但改为逐条留痕 + 如实计数,让它在日志里可见而不再静默。
Log "  [NOTE] 以下 C:\Windows\Temp 子段不按名字筛,只按 mtime>3 天的文件"
$wt = "C:\Windows\Temp"
$oldFiles = @(Get-ChildItem $wt -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
  -not $_.PSIsContainer -and $_.LastWriteTime -lt (Get-Date).AddDays(-3)
})
[int]$wtTargets = 0
[double]$wtFreed = 0
foreach ($f in $oldFiles) {
  if (Test-Protected $f.FullName) {
    Log ("  [SKIP] 受保护目录内,不清理: {0}" -f $f.FullName) "WARN"
    continue
  }
  $wtTargets += 1
  # 走同一条删除出口:逐条留痕与 DryRun 拦截都由 ForceDelete 单点保证。
  $sz = ForceDelete $f.FullName
  $wtFreed += $sz
  $freed += $sz
}
Log ("  [OK] C:\Windows\Temp:{0} {1} 项,释放 {2} MB" -f `
  $(if ($DryRun) { '预演命中' } else { '清理' }), $wtTargets, [math]::Round($wtFreed/1MB,1))

# ===== 3. 本项目落在 C 盘的产物 =====
# 2026-09-23 修:这一段原来扫的是 C:\temp,而我们实际写到的地方是 C:\tmp(构建备份,
# 实攒 13.2GB)、%LOCALAPPDATA%\Temp(git 夹具)、以及盘根本身。扫错目录 = 每天跑也零效果。
Log "[3/4] 清理本项目在 C 盘的产物"
# 受保护名单与 Test-Protected 已上移到脚本头部(宽口径清扫同样要用),此处不再重复定义。

$cCandidates = @()
# 盘根:项目自己写的探查脚本 / 构建状态 / 清理实验残骸 / 误建的 pnpm store
# 注:盘根只认这两组前缀 + .pnpm-store,刻意不套第 2 段的名字表 —— 那会在盘根新增
#     probe-* / next-backup-* 这类可与他人产物同名的删除面(等于放宽)。
$cCandidates += Get-ChildItem "C:\" -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'IHUI-*' -or $_.Name -like '.empty-tmp*' }
if ((Test-Path "C:\.pnpm-store") -and ((Get-Item "C:\.pnpm-store").LastWriteTime -lt (Get-Date).AddDays(-1))) {
  $cCandidates += Get-Item "C:\.pnpm-store" -Force
}
# C:\tmp 与 C:\temp:构建备份 / 探查脚本 / 调试日志
# 已封口(= junction 改道到外置根)的扫描位**整体跳过**:列进去会把 D 盘目标里的名字当成
# C 盘删除面(实测 PS7 的 -Recurse 会穿过 junction)。封口位的健康度由第 4 段单独管。
foreach ($t in @("C:\tmp", "C:\temp")) {
  if (Test-ReparsePoint $t) {
    Log ("  [SKIP] 已改道(junction),不跟随其目标枚举: {0}" -f $t)
    continue
  }
  $cCandidates += Get-ChildItem $t -Force -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -like 'ihui-*' -or $_.Name -like 'IHUI-*' -or
    $_.Name -like 'next-backup-*' -or $_.Name -like 'probe-*' -or
    $_.Name -eq 'wb-ext-debug.log'
  }
}
# 活 TEMP:测试夹具(名字必须命中 ihui- 前缀,别人的工具态一律不碰)。
# 这里刻意比第 2 段的名字表更窄:第 2 段有 mtime>3 天兜底,本段无年龄门槛,
# 若套同一张表等于给 probe-* / next-backup-* 去掉年龄限制 —— 那是放宽,不做。
$cCandidates += Get-ChildItem "$env:LOCALAPPDATA\Temp" -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'ihui-*' }

[double]$projFreed = 0
[int]$projTargets = 0
foreach ($d in ($cCandidates | Sort-Object FullName -Unique)) {
  if (Test-Protected $d.FullName) {
    Log ("  [SKIP] 受保护目录内,不清理: {0}" -f $d.FullName) "WARN"
    continue
  }
  # DryRun 不再走单独分支:ForceDelete 这一个出口自带模式判定与逐条留痕。
  $projTargets += 1
  $sz = ForceDelete $d.FullName
  $projFreed += $sz
  $freed += $sz
}
Log ("  [OK] 本项目 C 盘产物:{0} {1} 项,释放 {2} MB" -f `
  $(if ($DryRun) { '预演命中' } else { '清理' }), $projTargets, [math]::Round($projFreed/1MB,1))

# ===== 4. 盘根写歪项封口体检(根治回潮,不靠"看见了再删") =====
# 成因:一批程序(剪映 / 微信输入法 / MSYS 侧工具 / 安装器)用**相对路径**写状态,而进程
# 工作目录恰好是 C:\ ⇒ common_attachment、persistent_data、tmp、tools 直接长在盘根。
# 光删会再长,所以第 4 段判的是"封口还在不在":被删掉的 junction 会被重新建回来。
# 唯一真相源在 scripts/seal-c-root-stray.mjs 的名字表里,本段不重复列名字。
Log "[4/4] 盘根封口体检"
$repoRoot = Split-Path -Parent $PSScriptRoot
$seal = Join-Path $PSScriptRoot 'seal-c-root-stray.mjs'
# node 绝对路径按仓库所在盘推导(服务身份不读 HKCU env,PATH 也不可信)。
# 注意 Join-Path 是 -Path/-ChildPath 两段式,把整串当 Path 传会因缺 ChildPath 直接报错(实测)。
$driveLetter = $repoRoot.Substring(0, 1)
$nodeCandidate = "${driveLetter}:\DevEnv\runtimes\node\node.exe"
$nodeExe = if (Test-Path -LiteralPath $nodeCandidate) { $nodeCandidate } else { 'node' }
[int]$sealNeedsAction = 0

function Invoke-Seal {
  param([string[]]$SealArgs)
  # ① 子进程 stdout 默认按控制台代码页(GBK)解码 ⇒ 中文全成乱码(实测「封口」变「封?」);
  # ② `& node 2>&1` 是**按块**产出的,多行会被并成一行 ⇒ 先收进变量再按行切。
  $prev = [Console]::OutputEncoding
  try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $out = & $nodeExe $seal @SealArgs 2>&1
    $code = $LASTEXITCODE
  } finally {
    [Console]::OutputEncoding = $prev
  }
  (@($out) -join "`n") -split "`r?`n" | Where-Object { $_.Trim() -ne '' } | ForEach-Object { Log ("  {0}" -f $_) }
  return $code
}

if (-not (Test-Path -LiteralPath $seal)) {
  Log ("  [FAIL] 封口器不存在:{0} ⇒ 本段无法判定,不做任何假设" -f $seal) "WARN"
} else {
  # --check 零副作用;退出码 1 = 有待处置项。
  $sealNeedsAction = Invoke-Seal -SealArgs @('--check')
  if ($sealNeedsAction -eq 0) {
    Log "  [OK] 封口完好(盘根写歪项均已改道,不占 C)"
  } elseif ($DryRun) {
    Log "  [NOTE] DRY RUN:封口体检发现待处置项,已跳过重封(--apply 才动手)" "WARN"
    $null = Invoke-Seal -SealArgs @('--dry-run')
  } else {
    Log "  [HEAL] 封口有缺失/回潮 ⇒ 重跑封口器(幂等)" "WARN"
    $applied = Invoke-Seal -SealArgs @('--apply')
    if ($applied -ne 0) { Log "  [FAIL] 封口器 apply 仍报错,需人工看上面的输出" "WARN" }
    $sealNeedsAction = Invoke-Seal -SealArgs @('--check')
  }
}

# ===== 总结 =====
Start-Sleep -Seconds 1
$after = (Get-PSDrive C).Free
Log ("==========================================")
if ($DryRun) {
  Log '本轮为 DRY RUN:未删除任何文件,以上/以下各项均为「将要删」的量' "WARN"
}
Log ("清理后 C 盘可用: {0} GB" -f [math]::Round($after/1GB,2))
Log ("本次释放:       {0} GB" -f [math]::Round(($after-$before)/1GB,2))
Log ("删除面汇总:     Chrome 缓存 {0} 项 / Temp 旧目录 {1} 项 / C:\Windows\Temp {2} 项 / 本项目产物 {3} 项;按名字判据跳过的 Temp 目录 {4} 项({5} MB);宽口径开关 IHUI_TEMP_WIDE_SWEEP = {6};封口体检退出码 = {7}(0=完好;1=预演到待处置,或重封后复检仍待处置)" -f `
  $chromeTargets, $tempTargets, $wtTargets, $projTargets, $tempSkipped, [math]::Round($tempSkippedSize/1MB,1), $(if ($wideSweep) { '已启用' } else { '未启用' }), $sealNeedsAction)
Log ("合计释放:       {0} MB" -f [math]::Round($freed/1MB,1))
Log ("==========================================")

# 如果 C 盘可用 < 15 GB,触发警报
if ($after -lt 15GB) {
  Log "[警告] C 盘可用空间不足 15 GB!请人工检查" "WARN"
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
