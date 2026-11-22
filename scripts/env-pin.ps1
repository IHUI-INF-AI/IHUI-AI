# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# env-pin.ps1 —— PowerShell 侧的进程环境变量纠偏(与 scripts/env-pin.mjs 同一套判据)。
#
# 立因:注册表里的用户/机器环境变量已是系统盘值,但**长期驻留的父进程**(桌面壳、自动化宿主)
# 仍持有旧 D 盘值,派生的 shell 与 node 子进程继续往 D 盘写缓存。
# 本脚本按注册表现值重排当前 shell 的 $env:*,由 PowerShell profile 在每次启动时点(source)执行。
# 只纠"指向非系统盘"的项;其余值(含用户刻意覆盖)一律不动,幂等可重复执行。

$systemDrive = ($env:SystemDrive -replace '[\\:]', '').ToUpper()
$legacy = @('D', 'E', 'F', 'G')  # 仅用于日志措辞,判定仍以 SystemDrive 为准

$names = @(
  'TEMP', 'TMP', 'TMPDIR',
  'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME',
  'PNPM_HOME', 'PNPM_CACHE_DIR',
  'GRADLE_USER_HOME', 'RUSTUP_HOME', 'CARGO_HOME', 'CARGO_TARGET_DIR',
  'UV_CACHE_DIR', 'PIP_CACHE_DIR', 'NUGET_PACKAGES',
  'GOPATH', 'GOMODCACHE', 'GOCACHE', 'PLAYWRIGHT_BROWSERS_PATH',
  'NODE_OPTIONS'
)

$hives = @(
  'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
  'HKCU:\Environment'
)
$want = @{}
foreach ($hive in $hives) {
  $props = Get-ItemProperty -Path $hive -ErrorAction SilentlyContinue
  if (-not $props) { continue }
  foreach ($p in $props.PSObject.Properties) {
    if ($p.Name -like 'PS*') { continue }
    if (-not $names.Contains($p.Name)) { continue }
    $want[$p.Name] = [Environment]::ExpandEnvironmentVariables([string]$p.Value)
  }
}

$changed = @()
foreach ($name in $names) {
  if (-not $want.ContainsKey($name)) { continue }
  $target = $want[$name]
  $drive = $null
  $m = [regex]::Match($target, '^(?:file:///)?([A-Za-z]):[\\/]')
  if ($m.Success) { $drive = $m.Groups[1].Value.ToUpper() }
  # 注册表值本身指向非系统盘 ⇒ 拒绝搬运
  if ($drive -and $drive -ne $systemDrive) { continue }

  $current = [Environment]::GetEnvironmentVariable($name)
  if ($current -eq $target) { continue }

  if ($name -eq 'NODE_OPTIONS') {
    # NODE_OPTIONS 是开关串不是路径:只在现值空、且钩子文件真在盘上时补齐,不覆盖调用方追加的开关
    $hook = [regex]::Match($target, 'file:///(.+?\.mjs)')
    if ($current -or -not $hook.Success -or -not (Test-Path -LiteralPath ($hook.Groups[1].Value -replace '/', '\'))) { continue }
    [Environment]::SetEnvironmentVariable($name, $target)
    $changed += ('  {0}: (空) -> {1}' -f $name, $target)
    continue
  }

  $m2 = [regex]::Match([string]$current, '^(?:file:///)?([A-Za-z]):[\\/]')
  if (-not $m2.Success) { continue }
  if ($m2.Groups[1].Value.ToUpper() -eq $systemDrive) { continue }

  [Environment]::SetEnvironmentVariable($name, $target)
  $changed += ('  {0}: {1} -> {2}' -f $name, $current, $target)
}

if ($changed.Count -gt 0 -and $env:IHUI_ENV_PIN_QUIET -ne '1') {
  Write-Host ("[env-pin] 已按注册表纠正 {0} 项:" -f $changed.Count)
  $changed | ForEach-Object { Write-Host $_ }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
