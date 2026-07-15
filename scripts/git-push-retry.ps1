# git-push-retry.ps1 — git push 自动重试,缓解 GitHub TLS handshake 异常
# 用法: pwsh scripts/git-push-retry.ps1 [-Branch main] [-MaxAttempts 5]
# 退出码: 0 = 推送成功,1 = 所有重试都失败

param(
  [string]$Branch = 'main',
  [int]$MaxAttempts = 5,
  [int[]]$DelaysSec = @(5, 10, 20, 30, 60),
  [string]$Remote = 'origin',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$attempt = 0

Write-Host "→ git push $Remote $Branch (max attempts: $MaxAttempts, dryRun: $DryRun)" -ForegroundColor Cyan

while ($attempt -lt $MaxAttempts) {
  $attempt++
  Write-Host "`n[attempt $attempt/$MaxAttempts] $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor DarkGray

  $args = @('push', $Remote, $Branch)
  if ($DryRun) { $args = @('push', '--dry-run', $Remote, $Branch) }

  # 用 try/catch 抑制 NativeCommandError(实际 git 失败时 PowerShell 会抛错)
  $output = ''
  try {
    $output = & git @args 2>&1 | Out-String
  } catch {
    $output = $_.Exception.Message + "`n" + $_.ScriptStackTrace
  }
  $errText = [string]$output
  $exitCode = if ($errText -match 'fatal:|error:|fatal error') { 1 } else { 0 }

  if ($exitCode -eq 0) {
    Write-Host "✓ push succeeded on attempt $attempt" -ForegroundColor Green
    $output | ForEach-Object { Write-Host "  $_" }
    exit 0
  }

  $errText = [string]$output
  $isTls = $errText -match 'TLS|unexpected eof|SSL routines'
  $isNetwork = $errText -match 'Could not resolve|Connection (refused|reset)|timeout|ETIMEDOUT'

  if ($isTls -or $isNetwork) {
    $delay = if ($attempt -le $DelaysSec.Length) { $DelaysSec[$attempt - 1] } else { 60 }
    Write-Host "✗ network error: $(if ($isTls) { 'TLS handshake' } else { 'network' })" -ForegroundColor Yellow
    Write-Host "  retry in ${delay}s ..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds $delay
    continue
  }

  # 非网络错误(如 hook 失败 / non-fast-forward / 权限),直接退出
  Write-Host "✗ push failed (non-retryable):" -ForegroundColor Red
  $output | ForAll { Write-Host "  $_" }
  exit 1
}

Write-Host "`n✗ all $MaxAttempts attempts failed" -ForegroundColor Red
Write-Host "请检查:1) 网络代理设置  2) GitHub 服务状态 https://www.githubstatus.com  3) SSH/HTTPS 凭据是否过期" -ForegroundColor Yellow
exit 1
