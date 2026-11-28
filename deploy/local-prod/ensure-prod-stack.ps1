# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  # 日志轮转：Start-Process 的 -RedirectStandardOutput/-RedirectStandardError 会清空目标文件，
  # 每次自愈重启都会把上一段现场覆盖掉。重启前先把旧日志挪进 logs\archive，
  # 后台 AI 才能回溯"重启前发生了什么"；每类日志只留最近 20 份。
  function Rotate-LogPair([string]$base) {
    $archive = Join-Path $LogDir 'archive'
    New-Item -ItemType Directory -Force -Path $archive | Out-Null
    foreach ($ext in 'out', 'err') {
      $src = Join-Path $LogDir ("{0}-prod.{1}.log" -f $base, $ext)
      if ((Test-Path -LiteralPath $src) -and (Get-Item -LiteralPath $src).Length -gt 0) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Move-Item -LiteralPath $src -Destination (Join-Path $archive ("{0}-prod.{1}.{2}.log" -f $base, $ext, $stamp)) -Force
      }
    }
    Get-ChildItem -LiteralPath $archive -Filter ("{0}-prod.*.log" -f $base) |
      Sort-Object LastWriteTime -Descending | Select-Object -Skip 20 | Remove-Item -Force
  }

  if (-not (Test-Port 8802)) {
    $apiOut = Join-Path $LogDir 'api-prod.out.log'
    $apiErr = Join-Path $LogDir 'api-prod.err.log'
    Rotate-LogPair 'api'
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
    Rotate-LogPair 'web'
    Start-Process -FilePath $Pwsh -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File', (Join-Path $Root 'deploy\local-prod\run-web-prod.ps1')
    ) -WorkingDirectory $Root -RedirectStandardOutput $webOut -RedirectStandardError $webErr -WindowStyle Hidden | Out-Null
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start web (8801)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} web ok (8801)" -f (Get-Date))
  }

  # ai-service（8803）：LLM 单点。缺了它问数/对话不会报错，只会静默回落成关键词检索，
  # 所以把它也纳入自愈，别让「功能好像做了但没效果」这种状态长期存在。
  if (-not (Test-Port 8803)) {
    $aiOut = Join-Path $LogDir 'ai-prod.out.log'
    $aiErr = Join-Path $LogDir 'ai-prod.err.log'
    Rotate-LogPair 'ai'
    Start-Process -FilePath $Pwsh -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File', (Join-Path $Root 'deploy\local-prod\run-ai-prod.ps1')
    ) -WorkingDirectory $Root -RedirectStandardOutput $aiOut -RedirectStandardError $aiErr -WindowStyle Hidden | Out-Null
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start ai-service (8803)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} ai-service ok (8803)" -f (Get-Date))
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
