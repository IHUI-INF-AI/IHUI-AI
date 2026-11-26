# 5.1 语法回归：桥实际是用 powershell.exe(5.1) 拉起 UIA 脚本的，脚本里一旦出现 5.1 不认的语法
# （典型是 PowerShell 7 的空合并 ??），整条好友扫描链路会在桥侧静默失败。这里只用 5.1 解析，不执行。
$here = $PSScriptRoot
if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
$root = Split-Path -Parent $here
$target = Join-Path $root 'tools\wechat-friends.ps1'
if (-not (Test-Path -LiteralPath $target)) { Write-Output 'missing-script'; exit 2 }

$errors = $null
$tokens = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($target, [ref]$tokens, [ref]$errors)
if ($errors -and $errors.Count -gt 0) {
  $first = $errors[0]
  Write-Output ("parse-failed: line {0}: {1}" -f $first.Extent.StartLineNumber, $first.Message)
  exit 1
}
Write-Output ("parse-ok: powershell {0}, {1} tokens" -f $PSVersionTable.PSVersion.ToString(), $tokens.Count)
exit 0
