# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# IHUI 防火墙加固看门狗 —— 由 nssm 托管为常驻服务(IHUI-Firewall-Watchdog,SYSTEM,开机自启)
#
# 职责:周期性重放 deploy/win/ihui-firewall-hardening.ps1,对抗 Windows Update /
# 软件安装把宽松入站规则写回来。
#
# 2026-10-30 迁户:原实现把加固脚本与日志都放在 `outputs/SECURITY-HARDENING-2026-10-28/`,
# 而 `outputs/*` 被 .gitignore 忽略 —— 那是**边界的唯一自愈层**,却不在版本控制里:
# 任何人清一次 outputs/(它是"产物"目录,清它是常规操作),看门狗就会在下一次重放时
# 点源一个不存在的路径,ErrorActionPreference=Continue 下只会记一行 ERROR,
# 服务仍是 Running —— 器件在、台账在、实际没人守。迁到 deploy/win/ 与硬化脚本同目录,
# 路径改由 $PSScriptRoot 推导,仓库内搬目录也不会断。日志落到 §15b 批准的
# D:\DevEnv\logs\(同样不在项目树的会被清理的产物目录里)。
#
# 关键约束:本机安全策略把"由 powershell 启动的【嵌套】powershell 子进程"限成几乎
# 无命令可用(Write-Host/New-Object 等全部报"不被识别")。因此这里用【点源 dot-source】
# 在【当前进程】内执行加固脚本,绝不另起 powershell 子进程 —— 改回 `& powershell -File`
# 会让看门狗静默失效(服务照常 Running,规则却一条都没重放)。
#
# 重放间隔:默认 6h。2026-10-30 曾按"被篡改最长暴露窗"把它收到 1h,当天又按实测收回 ——
# 加固脚本对每条规则是 **先 delete 再 add**(不是"已达标就跳过"),一次重放在这台机上要
# 跑 11~13 分钟(netsh 单调用 10~60s),于是"1h 间隔"= 每小时有十几分钟在逐条拆建边界,
# 单条 DENY 在拆与建之间是**不存在**的。间隔越短,这种窗口越多,与"缩短篡改暴露窗"的初衷相反。
# 真正的修法是让加固脚本先读后改(合规即跳过),那之前保持长间隔更安全,也更省机时
# (重放期间 netsh 密集调用会把同机的 git 判据压到超时,见门 25/30a/47 的 rc=2/killed)。
# 可用环境变量 IHUI_FW_WATCHDOG_INTERVAL_SEC 覆盖(nssm AppEnvironmentExtra 注入),不必改脚本。

$ErrorActionPreference = 'Continue'

# 加固脚本与本文件同目录 —— 不写死绝对路径,仓库整体搬移不会把自愈层弄断。
$script      = Join-Path $PSScriptRoot 'ihui-firewall-hardening.ps1'
$logDir      = if ($env:IHUI_FW_WATCHDOG_LOG_DIR) { $env:IHUI_FW_WATCHDOG_LOG_DIR } else { 'D:\DevEnv\logs' }
$log         = Join-Path $logDir 'ihui-firewall-watchdog.log'
$auditScript = Join-Path $PSScriptRoot 'ihui-audit-policy.ps1'
$intervalSec = if ($env:IHUI_FW_WATCHDOG_INTERVAL_SEC) { [int]$env:IHUI_FW_WATCHDOG_INTERVAL_SEC } else { 21600 }
# 日志轮转:单文件超过 8MB 就改名为 .1 重开一个(只保留一份历史,不堆备份)
$logMaxBytes = 8MB

function Log($msg) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  try {
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    if ((Test-Path $log) -and ((Get-Item $log).Length -gt $logMaxBytes)) {
      Move-Item -Path $log -Destination "$log.1" -Force -ErrorAction SilentlyContinue
    }
    Add-Content -Path $log -Value "$ts [IHUI-FW-Watchdog] $msg" -Encoding UTF8 -ErrorAction SilentlyContinue
  } catch {}
}

# 启动自检:加固脚本不在位必须让服务**可见地失败**。
# 旧写法只 Log FATAL 然后照常进 while($true):服务仍 Running、日志里一行 FATAL 被
# 后面的 INFO 淹没,实际一条规则都没重放 —— 正是 2026-10-30 迁户记录里那种"器件在、
# 台账在、实际没人守"。这里直接 exit 3,让 nssm/SCM 把服务标成 stopped/failed。
if (-not (Test-Path $script)) {
  Log "FATAL 加固脚本不在位:$script —— 看门狗无法重放,拒绝启动(exit 3),请先恢复 deploy/win/ihui-firewall-hardening.ps1"
  exit 3
}

Log "watchdog started (pid=$pid, interval=${intervalSec}s, script=$script, powershell=$($PSVersionTable.PSVersion))"
while ($true) {
  # 运行期复核:脚本可能在服务启动后被清理(outputs/ 清理、手工误删)。缺失时同样
  # 拒绝空转 —— 否则每一轮都只记 ERROR 再睡 6h,服务状态仍是 Running。
  if (-not (Test-Path $script)) {
    Log "FATAL 加固脚本在运行期消失:$script —— 拒绝继续空转(exit 3)"
    exit 3
  }
  try {
    Log "=== applying hardening (dot-sourced, no nested pwsh) ==="
    # 在子作用域里点源加固脚本,既避开嵌套子进程约束,又不污染看门狗自身作用域
    $out = & { . $script -BlockRemoteAdmin -PruneAppRules } *>&1
    Log "hardening finished; output_lines=$($out.Count)"
    foreach ($line in $out) { if ($line) { Log "  | $line" } }
  } catch {
    Log "ERROR applying hardening: $($_.Exception.Message)"
  }
  # 主机审计基线同轮重放(2026-10-30 接入):4688 进程创建审核 + 命令行 + PowerShell 脚本块
  # 日志 + Security 日志容量,同样会被组策略刷新 / Windows Update 改回去,和防火墙规则
  # 是同一类漂移。被重放的脚本一律不得含 exit(会终止本进程),见 ihui-audit-policy.ps1 收尾注释。
  if (Test-Path $auditScript) {
    try {
      Log "=== applying host audit baseline (dot-sourced) ==="
      $out2 = & { . $auditScript -Apply } *>&1
      foreach ($line in $out2) { if ($line) { Log "  | $line" } }
    } catch {
      Log "ERROR applying audit baseline: $($_.Exception.Message)"
    }
  } else {
    Log "WARN 审计基线脚本不在位:$auditScript(跳过,不阻断防火墙腿)"
  }
  Log "sleeping $intervalSec s ..."
  Start-Sleep -Seconds $intervalSec
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
