# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 生产栈收尾回收器：把「用完不走」的遗留收掉，别让窗口 / 进程 / 端口一直堆着。
#
# 安全边界（故意保守：宁可漏杀一个，也不误杀在役的）：
#   1. 只碰命令行里带 C:\IHUI-AI 的进程；系统进程和其他项目一律不动。
#   2. 受保护集合 = 所有正在 Listen 的端口的进程 + 它们的完整祖先链 + 本脚本自身的祖先链。
#      在役服务哪怕父进程已退出，也永远不进候选（例：pnpm dev 的 launcher 死了，
#      但它是 8801 的根，杀它就把开发环境打断）。
#   3. 只有「父进程已不存在」且「存活超过 300 秒」的才进候选；
#      一次性命令（git / ssh / pytest / 同步脚本）跑完会自行退出，超时才说明真卡住了。
#   4. 同签名多实例只保留最新的一个，旧的关掉（现在 traywatch 就是这样堆了两份）。
#   5. 端口出现多个监听者：8802/8803 是专属端口，收敛为一个（保留契约形态，其次最新）；
#      8801 分属 dev 会话与生产回源，谁该活由持锁方决定，只记账不处置。
#   6. -DryRun 只打印计划，不动手。

param([switch]$DryRun)

# 自隐藏兜底：本脚本常由 ensure 在无控制台链里调用（那时 GetConsoleWindow=0，直接跳过）；
# 一旦被可见方式拉起（手工排查 / 老式任务直启 / 异常调用方），先把自己的黑框藏掉，
# 不给"回收器自己变成一个新的可见窗口"留口子。
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
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$ReapLog = Join-Path $LogDir 'reap.log'
$script:Dry = [bool]$DryRun

function Note([string]$m) {
  $line = ('{0:o} {1}' -f (Get-Date), $m)
  Add-Content -LiteralPath $ReapLog -Value $line -Encoding utf8
  if ($script:Dry) { Write-Output ('[dry] ' + $m) } else { Write-Output $m }
}

# --- 0. 日志自身轮转，别让清理器把日志撑爆 ---
foreach ($f in @($ReapLog, (Join-Path $LogDir 'prod-stack.log'))) {
  if ((Test-Path -LiteralPath $f) -and (Get-Item -LiteralPath $f).Length -gt 2MB) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $arch = Join-Path $LogDir 'archive'
    New-Item -ItemType Directory -Force -Path $arch | Out-Null
    Move-Item -LiteralPath $f -Destination (Join-Path $arch (('{0}.{1}.log' -f (Split-Path $f -Leaf).Replace('.log',''), $stamp))) -Force
  }
}

# --- 1. 隐藏 IHUI 相关的可见控制台窗口（只藏窗口，不杀进程） ---
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class IhuiWin {
  public delegate bool Cb(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Cb cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}
'@
$script:HidCount = 0
$cb = [IhuiWin+Cb]{
  param([IntPtr]$h, $l)
  try {
    if ([IhuiWin]::IsWindowVisible($h)) {
      $cls = [Text.StringBuilder]::new(128)
      [void][IhuiWin]::GetClassName($h, $cls, 128)
      if ($cls.ToString() -eq 'ConsoleWindowClass') {
        [uint32]$procId = 0
        [void][IhuiWin]::GetWindowThreadProcessId($h, [ref]$procId)
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue).CommandLine
        if ($cmd -and $cmd -like '*IHUI-AI*') {
          if (-not $script:Dry) { [void][IhuiWin]::ShowWindow($h, 0) }
          $script:HidCount = $script:HidCount + 1
        }
      }
    }
  } catch {}
  return $true
}
[void][IhuiWin]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:HidCount -gt 0) { Note ('HIDE 收掉了 {0} 个可见控制台窗口' -f $script:HidCount) }

# --- 2. 端口占用检测：分两级，别把正常情况也当成事故 ---
#   真冲突 = 同一端口、同一协议族上出现两个不同 pid —— 流量去处不确定，必须人工定夺。
#   跨协议族 = 同一端口 IPv4 一个、IPv6 一个 —— 多数情况无害，记一行 INFO 就行。
$listen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
$byFamily = @($listen | Group-Object {
    $af = if ($_.LocalAddress -match ':') { 'v6' } else { 'v4' }
    '{0}|{1}' -f $_.LocalPort, $af
  })
foreach ($g in $byFamily) {
  $pids = @($g.Group | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($pids.Count -gt 1) {
    $port = ($g.Name -split '\|')[0]
    Note ('WARN 端口 {0} 同一协议族上有 {1} 个不同进程在监听（pid={2}），流量去处不确定，需人工决定保留哪个' -f $port, $pids.Count, ($pids -join ','))
  }
}
$byPort = @($listen | Group-Object LocalPort | Where-Object { @($_.Group | Select-Object -ExpandProperty OwningProcess -Unique).Count -gt 1 })
foreach ($p in $byPort) {
  $addrs = @($p.Group | ForEach-Object {
      $who = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_.OwningProcess) -ErrorAction SilentlyContinue).Name
      '{0}={1}(pid {2})' -f $_.LocalAddress, $who, $_.OwningProcess
    })
  Note ('INFO 端口 {0} 由两个进程分别占用不同协议族：{1}，不是真双绑' -f $p.Name, ($addrs -join ' / '))
}

# --- 2b. 专属端口去重：8802 / 8803 只许一个实例 ---
# 真实事故形态：旧实例绑 127.0.0.1、新实例绑 0.0.0.0，两者互不冲突，于是都"活着"，
# 一个占一半流量、一个占另一半，Test-Port 又只看"有没有人监听"，从此再也不会自愈 ——
# 这就是「进程一直堆着、端口一直收不回来」的根。收敛规则：契约形态优先，其次留最新。
$exclusivePorts = @(
  @{ Port = 8802; Contract = '*src/index.ts*';       What = 'api' },
  @{ Port = 8803; Contract = '*--host 127.0.0.1*';   What = 'ai-service' }
)
foreach ($ex in $exclusivePorts) {
  $owners = @($listen | Where-Object { [int]$_.LocalPort -eq $ex.Port } |
    Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 })
  if ($owners.Count -eq 0) { continue }
  # 单实例也可能是野形态：ai-service 的契约是 --host 127.0.0.1，而 .env / package.json 的 dev
  # 参数是 0.0.0.0 —— 任何绕过 run-ai-prod 的启动都会把网关暴露到局域网，且会占住端口
  # 让契约实例永远起不来。这种一律收敛，下一轮 ensure 会按契约补起。
  if ($owners.Count -eq 1 -and $ex.What -eq 'ai-service') {
    $cl = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $owners[0]) -ErrorAction SilentlyContinue).CommandLine
    if ($cl -and $cl -like '*--host 0.0.0.0*') {
      Note ('REAP 非契约 {0} 端口 {1} pid={2}（0.0.0.0 形态，收敛后由 ensure 按契约重起）' -f $ex.What, $ex.Port, $owners[0])
      if (-not $script:Dry) { Stop-Process -Id $owners[0] -Force -ErrorAction SilentlyContinue }
      continue
    }
    continue
  }
  if ($owners.Count -le 1) { continue }
  $matched = @($owners | Where-Object {
      $cl = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_) -ErrorAction SilentlyContinue).CommandLine
      $cl -and $cl -like $ex.Contract
    })
  if ($matched.Count -ge 1) {
    $keep = @($matched | Sort-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).StartTime } -Descending)[0]
  } else {
    $keep = @($owners | Sort-Object { (Get-Process -Id $_ -ErrorAction SilentlyContinue).StartTime } -Descending)[0]
  }
  foreach ($o in @($owners | Where-Object { $_ -ne $keep })) {
    Note ('REAP 双起 {0} 端口 {1} pid={2}（保留 pid={3}）' -f $ex.What, $ex.Port, $o, $keep)
    if (-not $script:Dry) { Stop-Process -Id $o -Force -ErrorAction SilentlyContinue }
  }
}

# --- 3. 受保护集合：生产端口（8801/8802/8803）的监听者 + 其祖先链 + 本脚本祖先链 ---
# 只保护生产端口是有意的：临时端口（8811 / 8853 这类验收桩、临时 dev）一旦所属会话结束，
# 就应该被收掉把端口放出来，而不是一直挂着。它们是「用完不走」的主要来源。
$prodPorts = @(8801, 8802, 8803)
$all = Get-CimInstance Win32_Process
$live = @{}
foreach ($p in $all) { $live[[int]$p.ProcessId] = $p }
$protected = [System.Collections.Generic.HashSet[int]]::new()
$seed = @(([int]$PID)) + @($listen | Where-Object { $prodPorts -contains [int]$_.LocalPort } | ForEach-Object { [int]$_.OwningProcess })
foreach ($s in $seed) {
  $cur = $s
  for ($i = 0; $i -lt 10; $i++) {
    if ($cur -le 0) { break }
    [void]$protected.Add($cur)
    if (-not $live.ContainsKey($cur)) { break }
    $cur = [int]$live[$cur].ParentProcessId
  }
}

# --- 4. 孤儿候选：只收两类，别的一概不碰 ---
#   (a) 监听非生产端口的 IHUI 进程：父已死且超时 → 收掉并把端口放出来
#   (b) 生产服务启动器 run-*-prod.ps1 自身：父已死且超时 → 僵尸 launcher
# 测试（pytest / vitest）、构建、git / ssh 这类一次性任务跑完会自行退出，
# 哪怕父进程没了也不能杀 —— 杀了就是丢结果，所以它们天然不在候选里。
$now = Get-Date
$nonProdOwners = @($listen |
  Where-Object { $prodPorts -notcontains [int]$_.LocalPort } |
  ForEach-Object { [int]$_.OwningProcess } |
  Sort-Object -Unique)

$cands = @($all | Where-Object {
  # 硬门槛一：命令行必须真的指向本项目。少了这一条，任何监听临时端口的第三方客户端
  # （百度网盘 YunDetectService、各种云助手）都会被当成候选，这是绝对不能碰的。
  $_.CommandLine -and $_.CommandLine -like '*IHUI-AI*' -and
  # 硬门槛二：只认这几种可执行体，双保险。
  (@('node.exe', 'pwsh.exe', 'python.exe', 'pythonw.exe', 'cmd.exe') -contains $_.Name) -and
  -not $protected.Contains([int]$_.ProcessId) -and
  -not $live.ContainsKey([int]$_.ParentProcessId) -and
  ($now - $_.CreationDate).TotalSeconds -gt 300 -and
  (
    ($nonProdOwners -contains [int]$_.ProcessId) -or
    ($_.CommandLine -like '*deploy\local-prod\run-*-prod.ps1*')
  )
})

$bySig = $cands | Group-Object {
  $c = ($_.CommandLine -replace '\s+', ' ')
  '{0}|{1}' -f $_.Name, $c.Substring(0, [Math]::Min(140, $c.Length))
}

foreach ($g in $bySig) {
  if ($g.Count -ge 2) {
    $newest = $g.Group | Sort-Object CreationDate -Descending | Select-Object -First 1
    foreach ($old in @($g.Group | Where-Object { $_.ProcessId -ne $newest.ProcessId })) {
      Note ('REAP 重复孤儿 {0} pid={1}（保留同签名最新的 {2}）' -f $old.Name, $old.ProcessId, $newest.ProcessId)
      if (-not $script:Dry) { Stop-Process -Id $old.ProcessId -Force -ErrorAction SilentlyContinue }
    }
  } else {
    $one = $g.Group[0]
    $kids = @($all | Where-Object { $_.ParentProcessId -eq $one.ProcessId })
    if ($kids.Count -eq 0) {
      Note ('REAP 孤儿 {0} pid={1}（无父无子，已 {2:N0}s）' -f $one.Name, $one.ProcessId, ($now - $one.CreationDate).TotalSeconds)
      if (-not $script:Dry) { Stop-Process -Id $one.ProcessId -Force -ErrorAction SilentlyContinue }
    }
  }
}

# --- 5. 值守类脚本去重：同签名多实例只留最新（不受父进程存活影响） ---
$watch = @($all | Where-Object { $_.CommandLine -and $_.CommandLine -like '*wechat-traywatch*' })
if ($watch.Count -gt 1) {
  $keep = $watch | Sort-Object CreationDate -Descending | Select-Object -First 1
  foreach ($w in @($watch | Where-Object { $_.ProcessId -ne $keep.ProcessId })) {
    Note ('REAP 重复值守 {0} pid={1}（保留 {2}）' -f $w.Name, $w.ProcessId, $keep.ProcessId)
    if (-not $script:Dry) { Stop-Process -Id $w.ProcessId -Force -ErrorAction SilentlyContinue }
  }
}

# --- 6. 临时日志清理：超过 24 小时的 tmp 输出 ---
$tmpPatterns = @(
  (Join-Path $Root 'apps\api\tmp-8802.*.log'),
  (Join-Path $LogDir '*.tmp'),
  (Join-Path $Root '.tmp\*.tmp')
)
foreach ($pat in $tmpPatterns) {
  Get-ChildItem -Path $pat -File -ErrorAction SilentlyContinue |
    Where-Object { ($now - $_.LastWriteTime).TotalHours -gt 24 } |
    ForEach-Object {
      Note ('REAP 清理过期临时日志 {0}' -f $_.FullName)
      if (-not $script:Dry) { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    }
}

# --- 7. 防回潮：静默任务的动作用回来必须是 wscript + VBS ---
# 历史事故：自愈任务被重装成「直接跑 pwsh.exe」，于是每 5 分钟在桌面上闪一个黑框。
# 只靠改一次是治不住的，这里每轮复核；一旦发现动作退化成可执行程序直启，
# 就改回 wscript 隐藏包装（VBS 已存在，不重新生成，避免覆盖别人改过内容）。
$silentTasks = @(
  @{ Name = 'IHUI-Prod-Stack-Boot'; Vbs = 'IHUI-Prod-Stack-Ensure-hidden.vbs' },
  @{ Name = 'IHUI-Prod-Stack-Watchdog'; Vbs = 'IHUI-Prod-Stack-Ensure-hidden.vbs' }
)
$vbsDir = Join-Path $env:USERPROFILE '.ihui-silent-guard'
foreach ($st in $silentTasks) {
  $t = Get-ScheduledTask -TaskName $st.Name -ErrorAction SilentlyContinue
  if (-not $t -or $t.Actions.Count -eq 0) { continue }
  $exe = "$($t.Actions[0].Execute)"
  $vbs = Join-Path $vbsDir $st.Vbs
  if ($exe -notmatch 'wscript') {
    if (Test-Path -LiteralPath $vbs) {
      Note ('REPAIR 任务 {0} 的动作退化为「{1}」直启，改回 wscript 隐藏包装' -f $st.Name, $exe)
      if (-not $script:Dry) {
        try {
          $a = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument ('//B "' + $vbs + '"')
          Set-ScheduledTask -TaskName $st.Name -Action $a -ErrorAction Stop | Out-Null
          Note ('REPAIR 已修正 {0}' -f $st.Name)
        } catch {
          Note ('REPAIR 失败 {0}: {1}' -f $st.Name, $_.Exception.Message)
        }
      }
    } else {
      Note ('REPAIR 跳过 {0}：隐藏包装缺失 {1}' -f $st.Name, $vbs)
    }
  }
}

# --- 8. 闲置临时服务回收：用完不走的典型就是这一类 ---
# 判据故意保守：非生产端口、命令行指向本项目、已经跑了 2 小时以上、而且一条活跃连接都没有。
# 只要还有人在连它（浏览器标签、另一端在调），就不动 —— 那时它是「在用」，不是「用完」。
# 位置：在受保护集合之外，所以不会碰 8801/8802/8803 和任何在役链路。
$idleSeconds = 7200
foreach ($o in @($nonProdOwners)) {
  if ($protected.Contains([int]$o)) { continue }
  $proc = $live[[int]$o]
  if (-not $proc) { continue }
  if (-not ($proc.CommandLine -and $proc.CommandLine -like '*IHUI-AI*')) { continue }
  $age = ($now - $proc.CreationDate).TotalSeconds
  if ($age -lt $idleSeconds) { continue }
  $est = @(Get-NetTCPConnection -OwningProcess $o -State Established -ErrorAction SilentlyContinue)
  if ($est.Count -gt 0) { continue }
  $ports = @($listen | Where-Object { $_.OwningProcess -eq $o } | Select-Object -ExpandProperty LocalPort -Unique)
  Note ('REAP 闲置临时服务 {0} pid={1}（已 {2:N0}s 无连接，端口 {3}）' -f $proc.Name, $o, $age, ($ports -join ','))
  if (-not $script:Dry) { Stop-Process -Id $o -Force -ErrorAction SilentlyContinue }
}

Note ('DONE 回收结束（候选 {0}，隐藏窗口 {1}，模式 {2}）' -f $cands.Count, $script:HidCount, $(if ($script:Dry) { 'dry-run' } else { 'apply' }))
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
