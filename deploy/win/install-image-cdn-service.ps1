# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

<#
.SYNOPSIS
  给 :80 图片 CDN 换上真正的常驻载体:nssm 服务 IHUI-IMAGE-CDN,并把开机计划任务
  IHUI-ImageCDN 禁用,使 :80 只有一个所有者。

.DESCRIPTION
  为什么必须换载体(2026-09-29 实测,不是推测):
    - 计划任务 IHUI-ImageCDN 的触发器是 BootTrigger,动作是 deploy\win\run-cdn.bat,
      而那个 bat 是**单发无循环**的 —— 进程一死就只能等下次开机。
    - 本机 20 个 IHUI* 服务的 nssm 配置里没有任何一条含 cdn,值守班的端口清单也只有
      8801/8802/8803/8810/8811 ⇒ :80 长期挂了不会有人知道。
    - 换成 nssm 服务后,"二进制路径烂掉"这一维由 scripts/check-service-binary-paths.mjs
      与守护巡检一起覆盖(那是服务才有的覆盖面,计划任务没有)。

  单一所有者:计划任务不禁用就会与服务抢 :80。抢输的一方因 cdn-server.js 的 listen
  没有 error 监听而整进程退出,服务侧表现为 nssm 反复重启 ⇒ 每次开机都 flapping。
  因此本脚本**先禁用任务并回读确认**,再动进程。禁用是可逆动作,回退命令打印在结尾。

  二进制路径:Application 一律落**绝对路径**,且优先稳定安装位而非 PATH 解析结果。
  依据是同仓已发生的事故 —— RSSHub 服务因 node 自升级把
  .workbuddy\binaries\node\versions\<版本> 整目录换掉而静默停了 3 天。服务身份读的是
  机器级 PATH(本机该 PATH 里有一串死路径),所以 `Get-Command node.exe` 在人手里命中
  不代表服务能找到;而 ".workbuddy 里那份"按定义随时会被自升级换掉,不得作为服务 Application。

  自检探针刻意**不用** cdn-bootstrap.ps1 那条 /tabbar/tabbar/home.png —— 实测该文件是
  0 字节,服务器对它回 200 + 占位图(X-Placeholder: empty-file),拿它做健康判据等于
  永远通过。本脚本在 server-root 里现取一个 >2 KB 的真文件,并要求响应**不带**占位头。

.PARAMETER ProveRestart
  验收动作:杀掉当前受管进程,等服务把它拉回来并复跑 HTTP 自检。会短暂(:80 空窗数秒)
  影响出图,只在需要证明"挂了能自动起来"时带它。默认不带 ⇒ 常规复跑零副作用。

.EXAMPLE
  pwsh -NoProfile -ExecutionPolicy Bypass -File deploy\win\install-image-cdn-service.ps1
  pwsh -NoProfile -ExecutionPolicy Bypass -File deploy\win\install-image-cdn-service.ps1 -ProveRestart
#>
param(
  [int]$HttpPort = 80,
  [string]$ServiceName = 'IHUI-IMAGE-CDN',
  [string]$BootTaskName = 'IHUI-ImageCDN',
  [switch]$ProveRestart,
  [switch]$SkipTaskDisable
)

$ErrorActionPreference = 'Stop'
# 本脚本的输出会被取证工具原样落件(AGENTS §26:控制台码页会把中文变成乱码,而读证据的人
# 拿到的就是那串乱码)。输出编码显式设成 UTF-8,证据文件才可读;进程结束即失效,无需还原。
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$here = Split-Path $MyInvocation.MyCommand.Path -Parent
$deployDir = Split-Path $here -Parent
$serverJs = Join-Path $deployDir 'cdn-server.js'
$root = Join-Path $deployDir 'server-root'
$logDir = 'D:\DevEnv\logs'

# nssm 输出实测含 NUL 字节,不剥掉则 -match 恒假(照 deploy\win\install-deploy-loop-service.ps1 的教训)
function Clean-Nssm([object]$o) { (($o | Out-String) -replace "`0", '').Trim() }

# --- 0. 依赖定位 --------------------------------------------------------------
$nssmCands = @((Get-Command nssm.exe -ErrorAction SilentlyContinue).Source,
  (Join-Path $env:SystemRoot 'System32\nssm.exe')) | Where-Object { $_ -and (Test-Path $_) }
if (-not $nssmCands.Count) { throw "找不到 nssm.exe(PATH 与 $env:SystemRoot\System32 都没有)" }
$nssm = $nssmCands[0]

foreach ($p in @($serverJs, $root)) {
  if (-not (Test-Path $p)) { throw "缺失依赖: $p" }
}

# 稳定安装位优先:扫各盘的 DevEnv\runtimes\node\node.exe,再退到 PATH 与 ProgramFiles。
$nodeCands = @()
foreach ($d in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root })) {
  $c = Join-Path $d.Root 'DevEnv\runtimes\node\node.exe'
  if (Test-Path $c) { $nodeCands += $c }
}
foreach ($c in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'), (Get-Command node.exe -ErrorAction SilentlyContinue).Source)) {
  if ($c -and (Test-Path $c) -and ($nodeCands -notcontains $c)) { $nodeCands += $c }
}
# .workbuddy 那份由第三方 IDE 自升级管理,路径随版本更替消失过(实测),一律不作服务 Application。
$nodeCands = @($nodeCands | Where-Object { $_ -notmatch '\.workbuddy' })
if (-not $nodeCands.Count) { throw '没有可作服务 Application 的 node.exe(候选均落在自升级目录或不存在)' }
$node = $nodeCands | Where-Object { try { (& $_ -v) } catch { $null } } | Select-Object -First 1
if (-not $node) { throw "候选 node 均无法执行: $($nodeCands -join ' | ')" }
Write-Host "[ok] node = $node ($((& $node -v)))"
Write-Host "[ok] nssm = $nssm"

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$appArgs = '"{0}" --root "{1}" --http-port {2}' -f $serverJs, $root, $HttpPort

# --- 1. 现况记录(便于事后归因:哪一步让 :80 换了人) -----------------------------
function Get-ManagedHostPid {
  # 判据取 Win32_Service.ProcessId(nssm 托管服务的宿主 pid)。
  # 不能用「nssm.exe 的命令行里找服务名」:实测 nssm 宿主的命令行就只有
  # C:\windows\System32\nssm.exe,不含任何服务名 ⇒ 那种写法恒返回空,
  # 于是服务自己的子进程被当成"计划任务遗留"杀掉,常规复跑等于一次无谓的 :80 空窗。
  (Get-CimInstance Win32_Service -Filter "Name='$ServiceName'" -ErrorAction SilentlyContinue).ProcessId
}
function Get-CdnProcs {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'cdn-server\.js' }
}
function Invoke-HttpCheck {
  # 探针只取**图片**扩展名:第一版按"任意 >2 KB 文件"选,结果选中了 MANIFEST.txt ——
  # 文本能 200 并不证明出图正常,而这一行的措辞声称的是"真图"。
  $probe = Get-ChildItem $root -Recurse -File -Include *.png, *.jpg, *.jpeg, *.gif, *.webp |
    Where-Object { $_.Length -gt 2048 } | Select-Object -First 1
  if (-not $probe) { throw "server-root 里没有 >2 KB 的真图片可作探针: $root" }
  $rel = $probe.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
  # 先算出编码后的路径再拼 URL:`'…{1}' -f $HttpPort, (…) -join '/'` 会被解析成
  # `('…' -f …) -join '/'` —— -f 结合得更紧,占位符收到的是整个数组,
  # 实测产出的 URL 是 http://127.0.0.1:80/System.Object[](404),自检当场红给自己看。
  $enc = (($rel -split '/') | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/'
  $url = "http://127.0.0.1:$HttpPort/$enc"
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
  } catch {
    throw "取图失败 $url : $($_.Exception.Message)"
  }
  $ph = $r.Headers['X-Placeholder']
  if ($ph) { throw "$url 回的是占位图(X-Placeholder=$ph) ⇒ 服务在跑但没在出真图" }
  if ($r.RawContentLength -le 2048) { throw "$url 只有 $($r.RawContentLength) B,与探针文件 $($probe.Length) B 不同形" }
  Write-Host ("[ok] 取图自检: {0} => HTTP {1}, {2} B(真图)" -f $url, $r.StatusCode, $r.RawContentLength)
}

$before = Get-CdnProcs
Write-Host ('[..] 现况:cdn-server 进程 ' + @($before).Count + ' 个 (' + (($before | ForEach-Object { $_.ProcessId }) -join ',') + ')' +
    ';服务 ' + $ServiceName + ' 存在性 = ' + [bool](Get-Service -Name $ServiceName -ErrorAction SilentlyContinue))

# --- 2. 单一所有者:先禁用开机任务并回读 ---------------------------------------
if ($SkipTaskDisable) {
  Write-Host '[warn] 已跳过禁用开机任务 ⇒ :80 存在双所有者风险,请勿以此状态收尾' -ForegroundColor Yellow
} elseif ((& schtasks /query /tn $BootTaskName 2>&1 | Out-String) -match 'ERROR|找不到') {
  Write-Host "[ok] 计划任务 $BootTaskName 不存在(或不可查)⇒ 无需收权"
} else {
  & schtasks /change /tn $BootTaskName /disable | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "禁用计划任务 $BootTaskName 失败(exit $LASTEXITCODE)——不收权就不动进程" }
  $xml = (& schtasks /query /tn $BootTaskName /xml) | Out-String
  if ($xml -notmatch '<Enabled>false</Enabled>') {
    throw "禁用回读不成立:$BootTaskName 的 XML 里没有 <Enabled>false</Enabled>(打印过的就是没生效的)"
  }
  Write-Host "[ok] 计划任务 $BootTaskName 已禁用(可逆:schtasks /change /tn $BootTaskName /enable)"
}

# --- 3. 注册/就地更新服务(照本仓既有 nssm 安装器的幂等策略:不先删后建) --------
# 判序说明:先禁用任务再装服务,是为了让「服务可用 ∧ 任务启用」这一双所有者状态
# 在任何时刻都不成立(反序则中途开机就会 flapping)。代价是若装机失败,会留下
# 「任务已禁用而服务未起」的现场 —— 所以失败路径必须把两条出路当场打印出来。
try {
  & $nssm get $ServiceName Application *> $null
  $exists = ($LASTEXITCODE -eq 0)
if ($exists) {
  Write-Host "已存在 $ServiceName,就地更新配置"
} else {
  & $nssm install $ServiceName $node $appArgs | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "nssm install 失败(exit $LASTEXITCODE)" }
}

$settings = @(
  @('Application', $node),
  @('AppParameters', $appArgs),
  @('AppDirectory', (Split-Path $deployDir -Parent)),
  @('AppStdout', (Join-Path $logDir 'svc-imagecdn-nssm.log')),
  @('AppStderr', (Join-Path $logDir 'svc-imagecdn-nssm-err.log')),
  @('AppRotateFiles', '1'),
  @('AppRotateOnline', '1'),
  @('AppRotateBytes', '10485760'),
  @('AppRestartDelay', '5000'),
  @('Start', 'SERVICE_AUTO_START'),
  @('ObjectName', 'LocalSystem'),
  @('DisplayName', 'IHUI Image CDN'),
  @('Description', "Serves deploy/server-root on 0.0.0.0:$HttpPort for aizhs.top images. Replaces the boot task $BootTaskName, which is disabled by this script so that :80 keeps a single owner.")
)
foreach ($s in $settings) {
  & $nssm set $ServiceName $s[0] $s[1] | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "nssm set $($s[0]) 失败(exit $LASTEXITCODE)" }
}

# --- 4. 让位:只停"非受管"的旧实例,再启动服务 --------------------------------
$hostPid = Get-ManagedHostPid
$legacy = @(Get-CdnProcs | Where-Object { -not $hostPid -or $_.ParentProcessId -ne $hostPid })
foreach ($p in $legacy) {
  Write-Host "[..] 停旧实例 pid=$($p.ProcessId)(计划任务拉起的那一份)"
  Stop-Process -Id $p.ProcessId -Force
}
if ($legacy.Count) { Start-Sleep -Seconds 2 }

$st = Clean-Nssm (& $nssm status $ServiceName 2>&1)
if ($st -notmatch '^SERVICE_RUNNING') {
  & $nssm start $ServiceName *> $null
  $startRc = $LASTEXITCODE
  # nssm 的 START 不把 SERVICE_START_PENDING 当成成功:实测 2026-09-29 它打印
  # "Unexpected status SERVICE_START_PENDING in response to START control" 并回 exit 1,
  # 而 6 秒后服务状态就是 Running、:80 正常出图 ⇒ **派生命令的退出码不是服务存在性的判据**。
  # 所以这里轮询真实状态来判定,退出码只如实打印。真起不来(如 Application 路径烂掉)
  # 仍然会在 45 秒后抛错,不会静默。
  $deadline = (Get-Date).AddSeconds(45)
  $running = $false
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 700
    if ((Get-Service -Name $ServiceName -ErrorAction SilentlyContinue).Status -eq 'Running') { $running = $true; break }
  }
  if (-not $running) { throw "nssm start(退出码 $startRc)后 45 秒内服务未达 Running;查 $logDir\svc-imagecdn-nssm-err.log" }
  Write-Host "[ok] 服务已达 Running(nssm start 退出码 $startRc,该码不作判据)"
}
} catch {
  Write-Host "`n[现场未收口] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "此刻 :80 可能已经没有进程在服务(开机任务已被禁用,服务又没起来)。两条出路:" -ForegroundColor Yellow
  Write-Host "  A) 恢复原载体:  schtasks /change /tn $BootTaskName /enable ; schtasks /run /tn $BootTaskName"
  Write-Host "  B) 手工直跑一次: `"$node`" `"$serverJs`" --root `"$root`" --http-port $HttpPort"
  Write-Host "然后修掉上面这条错误原因再重跑本脚本(它幂等)。" -ForegroundColor Yellow
  throw
}

# --- 5. 验证 ------------------------------------------------------------------
$s = Get-Service -Name $ServiceName
Write-Host ('[..] 服务状态 = ' + $s.Status + ' / 启动类型 = ' + $s.StartType)
if ($s.Status -ne 'Running') { throw "$ServiceName 没起来,看 $logDir\svc-imagecdn-nssm-err.log" }

$managed = @(Get-CdnProcs | Where-Object { $_.ProcessId })
if ($managed.Count -ne 1) { throw "受管实例应为 1 个,现读 $($managed.Count):$(($managed | ForEach-Object { $_.ProcessId }) -join ',')" }
Write-Host "[ok] 受管实例 pid=$($managed[0].ProcessId),命令行 $($managed[0].CommandLine)"

$listener = @(netstat -ano | Select-String -Pattern "^\s*TCP\s+0\.0\.0\.0:$HttpPort\s")
if (-not $listener.Count) { throw "端口 $HttpPort 没有在 LISTENING" }
$ownerPid = (($listener[0].ToString() -split '\s+')[-1])
if ($ownerPid -ne "$($managed[0].ProcessId)") { throw "端口 $HttpPort 的持有者 pid=$ownerPid,不是受管实例 $($managed[0].ProcessId)" }
Write-Host "[ok] 0.0.0.0:$HttpPort 的持有者就是受管实例($ownerPid)"

Invoke-HttpCheck
$zero = @(Get-ChildItem $root -Recurse -File | Where-Object { $_.Length -eq 0 }).Count
if ($zero) { Write-Host "[advisory] server-root 里有 $zero 个 0 字节文件:它们只会得到占位图,不是真图" -ForegroundColor Yellow }

# --- 6. 可选:证明"挂了能自动起来" --------------------------------------------
if ($ProveRestart) {
  $old = $managed[0].ProcessId
  Write-Host "[..] 验收:杀掉 pid=$old,等服务拉回"
  Stop-Process -Id $old -Force
  $deadline = (Get-Date).AddSeconds(90)
  $newPid = $null
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 800
    $now = @(Get-CdnProcs | Where-Object { $_.ProcessId -ne $old })
    if ($now.Count -eq 1) { $newPid = $now[0].ProcessId; break }
  }
  if (-not $newPid) { throw "杀掉 pid=$old 后 90 秒内没有被重新拉起 ⇒ 常驻化没有生效" }
  Write-Host "[ok] 自动恢复:pid $old => $newPid"
  Start-Sleep -Seconds 2
  Invoke-HttpCheck
}

Write-Host ''
Write-Host '--- 现值 ---'
foreach ($k in @('Application', 'AppParameters', 'AppDirectory', 'Start', 'ObjectName', 'AppRestartDelay', 'AppStdout', 'AppStderr')) {
  Write-Host ("{0} = {1}" -f $k, (Clean-Nssm (& $nssm get $ServiceName $k 2>&1)))
}
$taskXml = (& schtasks /query /tn $BootTaskName /xml 2>&1 | Out-String) -replace "`0", ''
$taskState = if ($taskXml -match '<Enabled>false</Enabled>') { '已禁用(:80 单一所有者成立)' }
elseif ($taskXml -match '<Task') { '**仍启用**(会与服务抢端口)' } else { '未判定(任务查不到或 XML 解析不出)' }
Write-Host ("开机任务 {0} = {1};回退命令 schtasks /change /tn {0} /enable" -f $BootTaskName, $taskState)
Write-Host 'IMAGE_CDN_SERVICE_OK'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
