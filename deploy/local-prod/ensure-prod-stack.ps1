# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 生产栈自愈：8801 Web / 8802 API 掉线时拉起；由计划任务开机与每 5 分钟调用。
$ErrorActionPreference = 'Continue'

# 自隐藏兜底：计划任务或任何调用方把本脚本以可见方式拉起时，先把自己的控制台窗口藏掉，
# 避免每 5 分钟在桌面上闪一个 pwsh 黑框。GetConsoleWindow 为 0 表示本就无控制台，直接跳过。
try {
  if (-not ('IHUI.ConsoleHide' -as [type])) {
    Add-Type -Namespace IHUI -Name ConsoleHide -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
  }
  $h = [IHUI.ConsoleHide]::GetConsoleWindow()
  if ($h -ne [IntPtr]::Zero) { [void][IHUI.ConsoleHide]::ShowWindow($h, 0) }
} catch { }

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

  # 无窗口启动：Start-Process 的 -WindowStyle Hidden 一旦与 -RedirectStandardOutput/-Error 同时使用，
  # Windows 会强制为子进程新建可见控制台（WindowStyle 被忽略），watchdog 每拉一次就弹一个 pwsh 黑框。
  # 统一改为 cmd.exe + CreateNoWindow + 文件重定向：控制台从根上不创建（也不会闪一下），
  # 重定向句柄由 cmd 持有，本脚本退出后日志仍持续写入。用 >> 追加，不截断现场。
  $ComSpec = if ($env:ComSpec) { $env:ComSpec } else { 'C:\Windows\System32\cmd.exe' }
  function Start-HiddenLauncher([string]$ScriptPath, [string]$OutLog, [string]$ErrLog) {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $ComSpec
    $psi.Arguments = '/d /c ""{0}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{1}" 1>>"{2}" 2>>"{3}""' -f $Pwsh, $ScriptPath, $OutLog, $ErrLog
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    [void][System.Diagnostics.Process]::Start($psi)
  }

  # 专属端口只许一个本服务实例。跨地址族各绑一份（旧实例 127.0.0.1 + 新实例 0.0.0.0）看着都"在跑"，
  # 实际是两个进程分走一半流量：旧的不死、新的照起，进程和端口只会越堆越多，Test-Port 又是
  # 任意地址族命中即算"已起"，所以永远不会自愈。这里在拉起前先收敛：保留契约形态的那个
  # （ai-service: --host 127.0.0.1；api: src/index.ts），契约形态不在时才退化为保留最新。
  function Stop-DuplicateListeners([int]$port, [string]$contractLike) {
    $owners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 })
    if ($owners.Count -le 1) { return }
    $matched = @($owners | Where-Object {
        $cl = (Get-CimInstance Win32_Process -Filter "ProcessId=$_" -ErrorAction SilentlyContinue).CommandLine
        $cl -and $cl -like $contractLike
      })
    if ($matched.Count -ge 1) {
      $keep = @($matched | Sort-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).StartTime } -Descending)[0]
    } else {
      $keep = @($owners | Sort-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).StartTime } -Descending)[0]
    }
    foreach ($o in @($owners | Where-Object { $_ -ne $keep })) {
      $nm = (Get-CimInstance Win32_Process -Filter "ProcessId=$o" -ErrorAction SilentlyContinue).Name
      Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} dedupe port {1}: kept pid={2}, killed pid={3}({4})" -f (Get-Date), $port, $keep, $o, $nm)
      Stop-Process -Id $o -Force -ErrorAction SilentlyContinue
    }
  }

  Stop-DuplicateListeners 8802 '*src/index.ts*'

  if (-not (Test-Port 8802)) {
    $apiOut = Join-Path $LogDir 'api-prod.out.log'
    $apiErr = Join-Path $LogDir 'api-prod.err.log'
    Rotate-LogPair 'api'
    Start-HiddenLauncher (Join-Path $Root 'deploy\local-prod\run-api-prod.ps1') $apiOut $apiErr
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start api (8802)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} api ok (8802)" -f (Get-Date))
  }

  # 构建 / dev 会话持锁时不要抢 8801：那会和生产 web 双绑同一个端口，
  # 表现就是 8801 反复「掉线—拉起」，进程和日志越堆越多。等锁释放再交回自愈。
  $deployLock = Join-Path $Root '.deploy.lock\meta.json'
  $lockMode = ''
  if (Test-Path -LiteralPath $deployLock) {
    try { $lockMode = (Get-Content -LiteralPath $deployLock -Raw | ConvertFrom-Json).mode } catch { $lockMode = 'unknown' }
  }

  if ($lockMode) {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} web skipped: deploy lock held ({1})" -f (Get-Date), $lockMode)
  } elseif (-not (Test-Port 8801)) {
    $webOut = Join-Path $LogDir 'web-prod.out.log'
    $webErr = Join-Path $LogDir 'web-prod.err.log'
    Rotate-LogPair 'web'
    Start-HiddenLauncher (Join-Path $Root 'deploy\local-prod\run-web-prod.ps1') $webOut $webErr
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start web (8801)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} web ok (8801)" -f (Get-Date))
  }

  # ai-service（8803）：LLM 单点。缺了它问数/对话不会报错，只会静默回落成关键词检索，
  # 所以把它也纳入自愈，别让「功能好像做了但没效果」这种状态长期存在。
  Stop-DuplicateListeners 8803 '*--host 127.0.0.1*'

  # 契约校验：8803 只认 --host 127.0.0.1（只监听环回，.env 里的 HOST 和 package.json 的 dev
  # 参数都是 0.0.0.0，任何绕过 run-ai-prod 的启动都会把网关暴露到局域网）。更麻烦的是它和
  # 契约实例抢同一端口：先绑上的赢，而 Test-Port 命中即算「已起」，于是野形态一旦占了端口，
  # 契约实例就永远起不来。这里先收敛掉非契约形态，再按契约拉起。
  $aiOwners = @(Get-NetTCPConnection -LocalPort 8803 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 })
  foreach ($o in $aiOwners) {
    $cl = (Get-CimInstance Win32_Process -Filter "ProcessId=$o" -ErrorAction SilentlyContinue).CommandLine
    if ($cl -and $cl -notlike '*--host 127.0.0.1*') {
      Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} dedupe port 8803: killed pid={1} (非契约 host 形态)" -f (Get-Date), $o)
      Stop-Process -Id $o -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 400
    }
  }

  if (-not (Test-Port 8803)) {
    Rotate-LogPair 'ai'
    # 这里不要再给 launcher 加 -RedirectStandardOutput/-RedirectStandardError：
    # 一旦有重定向，Start-Process 会忽略 -WindowStyle Hidden，弹出一个可见的 pwsh 控制台；
    # 而且它会以截断方式打开 ai-prod.*.log，把 run-ai-prod 刚写的日志清成 0 字节。
    # 输出统一由 run-ai-prod.ps1 自己接管（pythonw + cmd 文件重定向，全程无控制台）。
    Start-Process -FilePath $Pwsh -ArgumentList @(
      '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
      '-File', (Join-Path $Root 'deploy\local-prod\run-ai-prod.ps1')
    ) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} start ai-service (8803)" -f (Get-Date))
  } else {
    Add-Content -Path (Join-Path $LogDir 'prod-stack.log') -Value ("{0:o} ai-service ok (8803)" -f (Get-Date))
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}

# 收尾回收：把用完不走的遗留收掉（可见控制台窗口 / 孤儿进程 / 过期临时日志 /
# 值守脚本重复实例）。放在 mutex 之外，失败也不影响自愈主流程。
try {
  & $Pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $Root 'deploy\local-prod\reap-prod-stack.ps1') *> $null
} catch { }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
