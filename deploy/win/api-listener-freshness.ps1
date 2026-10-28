# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 5.1
<#
api-listener-freshness.ps1 —— "端口上现在应答的进程,是不是本轮部署之后起来的"只读尺子(2026-10-28 立)。

立因是当天现读的一次假成功:部署把生产签出 ff 到新提交、web 换流、`/api/health` 回 200,
但**监听 8843 的还是 15:34 起的旧 node**——服务"重启"起来的子进程因为端口被旧孤儿占着而退出,
而健康探针只证明"有人在答",证明不了"答的是新代码"。API 侧修复因此在生产上根本没上岗,
账面却写着部署成功(AGENTS §12f:判据失效的表现永远是安静)。

所以这一步必须问"实听者的身份",而不是问"有没有 200":
  ① netstat 取该端口的 LISTENING 所有者 pid(不用 Get-NetTCPConnection:它在部分宿主
     PowerShell 里根本不存在,当天实测即如此);
  ② Win32_Process 取该 pid 的 CreationDate;
  ③ 与 -SinceIso(本轮部署起点)比:**所有**监听者都晚于起点才算 fresh。

三态纪律(§0.3):取不到输入一律 `undetermined` 并点名原因,绝不把"没量到"写成"没问题",
也绝不写成"stale"(那是把失明读成指控)。判定一律用 ASCII 词元,中文只作说明。

输出契约(单行,便于调用侧正则):
  FRESHNESS|state=fresh|stale|undetermined|port=<n>|pids=<a,b>|reason=<code>
  reason: ok / no-listener / multiple-ambiguous / netstat-unavailable / netstat-unparsed /
          pid-gone / creation-unknown / bad-since / cim-unavailable
#>
param(
    # 允许多端口(api 是蓝绿两色 8842/8843,调用侧不知道活跃的是哪一色)。
    # **刻意用字符串而不是 [int[]]**:`-Port 8842,8843` 经 argv 传给 [int[]] 时,
    # .NET 会把 "8842,8843" 按千分位折成单个 88428843(2026-10-28 实测),于是两色谁都量不到、
    # 尺子整把瞎判 no-listener —— 字符串自解析堵掉这一型。
    # 无人监听的色只作"跳过";**任一**有监听的色起于锚点之前 ⇒ stale。
    [string]$Ports = '8843',
    [string]$SinceIso = ''
)

$ErrorActionPreference = 'Stop'
$portLabel = $Ports
$out = { param($state, $pids, $reason)
    Write-Output ("FRESHNESS|state={0}|port={1}|pids={2}|reason={3}" -f $state, $portLabel, ($pids -join ','), $reason)
}

# 变量名**刻意不叫 $ports**:PowerShell 变量名大小写不敏感,`$ports` 与参数 `$Ports` 是同一个,
# 一旦 New-Object 覆盖,后面 `-split` 就是在空列表上跑 ⇒ 谁都量不到、整把尺子静默判 no-listener
# (2026-10-28 写成这样,F1/F2/F6 三条用例当场把它抓住;F3/F5 反而"通过"—— 那正是"一律判
# 未判定"也能拿部分绿的假象,所以反向对照不是可选项)。
$wantPorts = New-Object System.Collections.Generic.List[int]
foreach ($tok in ($Ports -split '[,;\s]+')) {
    if ($tok -match '^\d+$') { $wantPorts.Add([int]$tok) }
}
if ($wantPorts.Count -eq 0) { & $out 'undetermined' '' 'bad-ports'; exit 0 }

$since = [datetime]::MinValue
if ([string]::IsNullOrWhiteSpace($SinceIso)) {
    & $out 'undetermined' '' 'bad-since'
    exit 0
}
# 锚点**必须自带时区标记**(Z 或 ±HH:MM)。不带时区的串会按本地时区解 ⇒ 在本机(UTC+8)
# 恰好差 8 小时:2026-10-28 实测拿 `date -u` 生成的"未来一小时"裸串量现役 API,明明该判
# stale 却判成 fresh —— 一个静默的 8 小时偏差足以让这把尺子天天报"新鲜"。
# 失效方向照 §0.10:要一次定向说明(改用 Get-Date -Format o 或 ISO 带 Z),不猜。
if (($SinceIso -notmatch '[Zz]$') -and ($SinceIso -notmatch '[+-]\d{2}:?\d{2}$')) {
    & $out 'undetermined' '' 'since-no-timezone'
    exit 0
}
try { $since = [datetime]::Parse($SinceIso, [System.Globalization.CultureInfo]::InvariantCulture) }
catch { & $out 'undetermined' '' 'bad-since'; exit 0 }

# ① netstat:绝对路径优先,PATH 兜底(服务身份与交互账户的 PATH 互不相通)
$netstat = "$env:SystemRoot\System32\NETSTAT.EXE"
if (-not (Test-Path -LiteralPath $netstat)) { $netstat = 'netstat.exe' }
$lines = $null
try { $lines = & $netstat -ano 2>$null } catch { }
if ($null -eq $lines -or @($lines).Count -eq 0) { & $out 'undetermined' '' 'netstat-unavailable'; exit 0 }

$pids = New-Object System.Collections.Generic.List[string]
$tcpRows = 0
foreach ($line in @($lines)) {
    $t = ('' + $line).Trim()
    if ($t -notmatch '^TCP\s+') { continue }
    $tcpRows++
    $cols = $t -split '\s+'
    if ($cols.Count -lt 5) { continue }
    if ($cols[3] -ne 'LISTENING') { continue }
    $local = $cols[1]
    $m = [regex]::Match($local, ':(\d+)$')
    if (-not $m.Success) { continue }
    if ($wantPorts -notcontains [int]::Parse($m.Groups[1].Value)) { continue }
    $pidTxt = $cols[$cols.Count - 1]
    if ($pidTxt -match '^\d+$') { $pids.Add($pidTxt) }
}
if ($tcpRows -eq 0) { & $out 'undetermined' '' 'netstat-unparsed'; exit 0 }
if ($pids.Count -eq 0) { & $out 'undetermined' '' 'no-listener'; exit 0 }
$uniq = @($pids | Sort-Object -Unique)

# ② 每个实听者的创建时刻(任一取不到 ⇒ 整把尺子未判定,不得只按能取到的下结论)
$anyStale = $false
foreach ($p in $uniq) {
    $proc = $null
    try { $proc = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$p" -ErrorAction Stop }
    catch { & $out 'undetermined' ($uniq -join ',') 'cim-unavailable'; exit 0 }
    if ($null -eq $proc) { & $out 'undetermined' ($uniq -join ',') 'pid-gone'; exit 0 }
    $cd = $proc.CreationDate
    if ($null -eq $cd) { & $out 'undetermined' ($uniq -join ',') 'creation-unknown'; exit 0 }
    try { $created = [datetime]$cd } catch { & $out 'undetermined' ($uniq -join ',') 'creation-unknown'; exit 0 }
    if ($created -lt $since) { $anyStale = $true }
}

if ($anyStale) { & $out 'stale' ($uniq -join ',') 'ok'; exit 3 }
& $out 'fresh' ($uniq -join ',') 'ok'; exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
