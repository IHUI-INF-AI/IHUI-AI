$path = 'g:\IHUI-AI\scripts\dev-up.ps1'
$tokens = $null
$errs = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref] $tokens, [ref] $errs)
if ($errs -and $errs.Count -gt 0) {
  Write-Host 'SYNTAX_ERRORS:'
  $errs | ForEach-Object { Write-Host ('  - Line {0}: {1}' -f $_.Extent.StartLineNumber, $_.Message) }
  exit 1
} else {
  Write-Host 'SYNTAX_OK'
}
