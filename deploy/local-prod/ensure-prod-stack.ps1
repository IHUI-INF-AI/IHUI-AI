# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 生产栈自愈：8801 Web / 8802 API 掉线时拉起；由计划任务开机与每 5 分钟调用。
$ErrorActionPreference = 'Continue'
$Root = 'C:\IHUI-AI'
$Pwsh = 'C:\Program Files\PowerShell\7\pwsh.exe'
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, 'Global\IHUIProdStackEnsure')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
  function Test-Port([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  }

  if (-not (Test-Port 8802)) {
    $apiOut = Join-Path $LogDir 'api-prod.out.log'
    $apiErr = Join-Path $LogDir 'api-prod.err.log'
    Start-Process -FilePath $Pwsh -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File', (Join-Path $Root 'deploy\local-prod\run-api-prod.ps1')
    ) -WorkingDirectory $Root -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr -WindowStyle Hidden | Out-Null
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start api (8802)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} api ok (8802)" -f (Get-Date))
  }

  if (-not (Test-Port 8801)) {
    $webOut = Join-Path $LogDir 'web-prod.out.log'
    $webErr = Join-Path $LogDir 'web-prod.err.log'
    Start-Process -FilePath $Pwsh -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File', (Join-Path $Root 'deploy\local-prod\run-web-prod.ps1')
    ) -WorkingDirectory $Root -RedirectStandardOutput $webOut -RedirectStandardError $webErr -WindowStyle Hidden | Out-Null
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start web (8801)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} web ok (8801)" -f (Get-Date))
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
