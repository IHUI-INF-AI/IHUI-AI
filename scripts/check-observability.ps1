# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ================================================================
#
# check-observability.ps1 — 一键核查"监控栈是否真正在线上运行"。
#
# 背景: 仓库 monitoring/ 有完整 promise stack 配置,但线上若只跑了 deploy-online.ps1
#       (单进程 Next+API),Prometheus/Grafana 很可能只是"配置在仓库、未真正部署"。
#       本脚本在生产服务器上运行,覆盖三大判定:
#         1) 监控栈进程/容器是否存在 (9090 Prometheus / 8816 Grafana / 3100 Loki / 9093 Alertmanager)
#         2) 采集源是否活: 本地 API 的 /metrics 端点可抓取 (api 端口 8802/8803)
#         3) 观测性开关:  .env 的 PROMETHEUS_ENABLED / OTEL_EXPORTER_OTLP_ENDPOINT
#
# 用法(在【生产服务器】上,以有 docker/读 .env 权限的用户运行):
#   powershell -ExecutionPolicy Bypass -File scripts/check-observability.ps1
#
# 退出码: 0 = 全通过(监控真的在跑); 1 = 部分缺失(有缺口,见输出)
# ================================================================

$ErrorActionPreference = 'SilentlyContinue'
$fail = 0
function Report($verdict, $msg) {
  $icon = if ($verdict -eq 'PASS') { '[PASS]' } else { '[FAIL]' }
  Write-Host ("{0} {1}" -f $icon, $msg)
  if ($verdict -ne 'PASS') { $script:fail = 1 }
}
$slash = [System.IO.Path]::DirectorySeparatorChar
$root = Split-Path -Parent $PSScriptRoot

Write-Host "===== IHUI 监控栈在线核查 =====" -ForegroundColor Cyan
Write-Host ("仓库根: " + $root)

# --- 1. 监控栈端口监听状态 ----------------------------------------------
$ports = @{ 9090 = 'Prometheus'; 8816 = 'Grafana'; 3100 = 'Loki'; 9093 = 'Alertmanager'; 9080 = 'otel-collector' }
Write-Host "`n[1] 监控栈进程/端口" -ForegroundColor Cyan
foreach ($p in $ports.GetEnumerator()) {
  $listening = Get-NetTCPConnection -LocalPort $p.Key -State Listen -ErrorAction SilentlyContinue
  if ($listening) { Report PASS ("{0} 在监听端口 {1}" -f $p.Value, $p.Key) }
  else { Report FAIL ("{0} 未监听端口 {1} —— 监控栈.{2} 很可能没在跑" -f $p.Value, $p.Key, ($p.Key)) }
}

# docker 容器补充判定(若有 docker)
$dockerOn = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerOn) {
  Write-Host "`n[docker 检测]" -ForegroundColor Cyan
  $names = docker ps --format '{{.Names}}' 2>$null
  $want = @('prometheus','grafana','loki','promtail','alertmanager','otel-collector')
  foreach ($w in $want) {
    if ($names -match $w) { Report PASS "docker 容器含 $w" } else { Report FAIL "docker 容器缺 $w" }
  }
}

# --- 2. API 的 /metrics 采集源是否可抓 (api 端口 8802/8803) --------------
Write-Host "`n[2] API /metrics 采集源" -ForegroundColor Cyan
$httpCodes = @()
foreach ($apiPort in 8802, 8803) {
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/metrics" -f $apiPort) -TimeoutSec 5 -UseBasicParsing
    $httpCodes += $r.StatusCode
    if ($r.StatusCode -eq 200 -and $r.Content -match 'http_requests_total') {
      Report PASS "API :$apiPort /metrics 可抓取 (含 http_requests_total)"
    } else {
      Report FAIL "API :$apiPort /metrics 返回 $($r.StatusCode) 但内容异常"
    }
  } catch { $httpCodes += 0; Report FAIL "API :$apiPort /metrics 不可达 —— 无采集源,Prometheus 将无指标可拉" }
}

# --- 3. 观测性环境开关 ------------------------------------------------
Write-Host "`n[3] 环境开关" -ForegroundColor Cyan
$promPath = Join-Path $root ".env"
if (Test-Path $promPath) {
  $promEnabled = Select-String -Path $promPath -Pattern '^PROMETHEUS_ENABLED\s*=\s*(.+)$'
  $otlp = Select-String -Path $promPath -Pattern '^OTEL_EXPORTER_OTLP_ENDPOINT\s*=\s*(.+)$'
  $pe = if ($promEnabled) { $promEnabled.Matches[0].Groups[1].Value.Trim() } else { '(未设置)' }
  $oe = if ($otlp) { $otlp.Matches[0].Groups[1].Value.Trim() } else { '(未设置)' }
  Write-Host "      PROMETHEUS_ENABLED = $pe"
  Write-Host "      OTEL_EXPORTER_OTLP_ENDPOINT = $oe"
  if ($pe -eq 'true') { Report PASS 'PROMETHEUS_ENABLED=true' } else { Report WARN "PROMETHEUS_ENABLED=$pe (非 true,业务指标采集可能未启用)" ; $script:fail=0 }
  if ($oe -and $oe -ne 'true') { Write-Host "      [INFO] OTLP 已指向 $oe" }
} else { Report FAIL "未找到 $promPath" }

Write-Host ""
if ($fail -eq 0) {
  Write-Host "===== 结论:监控栈在跑(或有意关闭),无明确缺口 =====" -ForegroundColor Green
  exit 0
} else {
  Write-Host "===== 结论:监控栈存在缺口,请按上方 [FAIL] 项排查 =====" -ForegroundColor Yellow
  Write-Host "   · 若你期望 Prometheus/Grafana 自动抓取,需要在该仓库 monitoring/ 下 docker compose up 并让 prometheus.yml 指向 api 的 /metrics"
  exit 1
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
