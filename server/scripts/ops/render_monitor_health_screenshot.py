"""ZHS Monitor Health Dashboard 渲染脚本 (Phase 8 建议 4).

启动 app + 触发 monitor 实例化 + 注入测试数据 + 用 playwright 截图 dashboard 样子.
输出: docs/screenshots/zhs_monitor_health.png (1920x1080)

不是替代 Grafana, 是给 SOP 文档 / 团队周会用一张可视化静态图.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))


DASHBOARD_HTML = """
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>ZHS Monitor Health (Phase 8)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; }
    h1 { font-size: 18px; margin: 0 0 12px; color: #f1f5f9; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .panel { background: #1e293b; border-radius: 6px; padding: 12px; min-height: 90px; }
    .panel-title { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
    .panel-value { font-size: 32px; font-weight: 600; color: #f1f5f9; }
    .panel-value.green { color: #10b981; }
    .panel-value.red { color: #ef4444; }
    .panel-value.yellow { color: #f59e0b; }
    .panel-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .row2 { grid-column: span 2; min-height: 160px; }
    .row4 { grid-column: span 4; min-height: 220px; }
    .bar-row { display: flex; align-items: center; margin: 6px 0; font-size: 12px; }
    .bar-label { width: 160px; color: #cbd5e1; }
    .bar-track { flex: 1; background: #334155; height: 14px; border-radius: 3px; position: relative; }
    .bar-fill { height: 100%; background: #3b82f6; border-radius: 3px; }
    .bar-value { width: 80px; text-align: right; color: #94a3b8; }
    .ts-row { display: flex; align-items: flex-end; height: 140px; gap: 1px; margin-top: 8px; }
    .ts-bar { flex: 1; background: #3b82f6; min-height: 1px; }
    .ts-bar.warn { background: #f59e0b; }
    .ts-bar.crit { background: #ef4444; }
    .refresh { font-size: 10px; color: #475569; text-align: right; }
  </style>
</head>
<body>
  <h1>ZHS Monitor Health <span style="color:#64748b;font-size:12px;">(Phase 8 渲染样例 / Grafana UID=zhs-monitor-health)</span></h1>
  <div class="refresh" id="refresh"></div>
  <div class="grid">
    <div class="panel">
      <div class="panel-title">监听器运行状态</div>
      <div class="panel-value {running_class}" id="running">--</div>
      <div class="panel-sub">ZHSMonitorDown 告警阈值 2m</div>
    </div>
    <div class="panel">
      <div class="panel-title">总缓存记录数</div>
      <div class="panel-value {cached_class}" id="cached">--</div>
      <div class="panel-sub">ZHSMonitorRecordsCacheBurst 阈值 10万</div>
    </div>
    <div class="panel">
      <div class="panel-title">近 5 分钟过期处理速率</div>
      <div class="panel-value {expired_class}" id="expired">--</div>
      <div class="panel-sub">rate × 60 (条/分钟) / ZHSMonitorExpiredBurst 阈值 500</div>
    </div>
    <div class="panel">
      <div class="panel-title">近 1 分钟检测周期数</div>
      <div class="panel-value green" id="checks">--</div>
      <div class="panel-sub">期望 ~6 (10s 间隔) / ZHSMonitorChecksStalled 阈值 0</div>
    </div>

    <div class="panel row2">
      <div class="panel-title">缓存中待过期记录数 (按表)</div>
      <div id="by-table" style="margin-top:8px;">--</div>
    </div>
    <div class="panel row2">
      <div class="panel-title">过期处理速率 (按表, 条/分钟)</div>
      <div id="by-table-expired" style="margin-top:8px;">--</div>
    </div>

    <div class="panel row4">
      <div class="panel-title">缓存刷新耗时 P50 / P95 / P99 (秒, 模拟 30 个数据点)</div>
      <div class="ts-row" id="refresh-ts"></div>
      <div class="panel-sub">ZHSMonitorRefreshSlow 阈值 30s</div>
    </div>

    <div class="panel row4">
      <div class="panel-title">检测周期累计 (rate, 条/分钟, 模拟 30 个数据点)</div>
      <div class="ts-row" id="checks-ts"></div>
      <div class="panel-sub">ZHSMonitorChecksStalled 阈值 0 (持续 10min)</div>
    </div>
  </div>

<script>
async function fetchMetrics() {
  try {
    const r = await fetch('http://127.0.0.1:18801/metrics');
    return await r.text();
  } catch (e) {
    return '';
  }
}
function parseMetric(body, name) {
  const lines = body.split('\\n').filter(l => l.startsWith(name + '{') || l.startsWith(name + ' '));
  return lines;
}
function valGreatherEq(v, t) { return v >= t ? 'crit' : (v >= t/2 ? 'warn' : ''); }
async function render() {
  const body = await fetchMetrics();
  // running
  const running = body.split('\\n').find(l => l.startsWith('zhs_biz_monitor_running '));
  const runV = running ? parseFloat(running.split(' ')[1]) : 0;
  document.getElementById('running').textContent = runV > 0.5 ? 'RUNNING' : 'STOPPED';
  document.getElementById('running').className = 'panel-value ' + (runV > 0.5 ? 'green' : 'red');
  // cached
  const cached = body.split('\\n').filter(l => l.startsWith('zhs_biz_monitor_records_cached{'));
  const total = cached.reduce((s, l) => s + parseFloat(l.split(' ')[1] || 0), 0);
  document.getElementById('cached').textContent = total.toLocaleString();
  document.getElementById('cached').className = 'panel-value ' + (total > 100000 ? 'red' : (total > 50000 ? 'yellow' : 'green'));
  // expired
  const exp = body.split('\\n').find(l => l.startsWith('zhs_biz_monitor_expired_total '));
  const expV = exp ? parseFloat(exp.split(' ')[1]) : 0;
  document.getElementById('expired').textContent = expV.toLocaleString();
  document.getElementById('expired').className = 'panel-value ' + (expV > 500 ? 'red' : (expV > 100 ? 'yellow' : 'green'));
  // checks
  const chk = body.split('\\n').find(l => l.startsWith('zhs_biz_monitor_checks_total '));
  const chkV = chk ? parseFloat(chk.split(' ')[1]) : 0;
  document.getElementById('checks').textContent = chkV.toString();
  // by table
  const byTableHtml = cached.map(l => {
    const m = l.match(/table_name="([^"]+)"/);
    const v = parseFloat(l.split(' ')[1] || 0);
    const t = m ? m[1] : '?';
    return `<div class="bar-row"><div class="bar-label">${t}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, v/1000*100).toFixed(1)}%"></div></div><div class="bar-value">${v.toLocaleString()}</div></div>`;
  }).join('') || '<div class="panel-sub">无缓存记录 (监控未启或无待过期数据)</div>';
  document.getElementById('by-table').innerHTML = byTableHtml;
  document.getElementById('by-table-expired').innerHTML = byTableHtml.replace(/bar-fill/g, 'bar-fill');
  // ts (mock 30 data points 模拟曲线)
  const refreshTs = document.getElementById('refresh-ts');
  const checksTs = document.getElementById('checks-ts');
  for (let i = 0; i < 30; i++) {
    const r = document.createElement('div');
    r.className = 'ts-bar';
    r.style.height = (5 + Math.random() * 20).toFixed(1) + 'px';
    refreshTs.appendChild(r);
    const c = document.createElement('div');
    c.className = 'ts-bar';
    c.style.height = (40 + Math.random() * 90).toFixed(1) + 'px';
    checksTs.appendChild(c);
  }
  document.getElementById('refresh').textContent = '刷新时间: ' + new Date().toLocaleString('zh-CN');
}
render();
</script>
</body>
</html>
"""


async def main() -> int:
    out_dir = ROOT / "docs" / "screenshots"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "zhs_monitor_health.png"
    html_path = out_dir / "_render_monitor_health.html"
    html_path.write_text(DASHBOARD_HTML, encoding="utf-8")
    print(f"[init] HTML 模板写入: {html_path}")
    print(f"[init] 截图输出: {out_path}")

    # 探测 /metrics 是否有数据
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get("http://127.0.0.1:18801/metrics")
            body = r.text
            has_running = "zhs_biz_monitor_running" in body
            print(f"[check] /metrics 含 monitor_running: {has_running}")
    except Exception as e:
        print(f"[warn] /metrics 不可达: {e}")
        print("  请先启动: uvicorn app.main:app --port 18801 --log-level warning")
        return 1

    # 启动 playwright 渲染
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True,
        )
        page = await ctx.new_page()
        url = f"file:///{html_path.as_posix()}"
        print(f"[render] 打开: {url}")
        await page.goto(url)
        # 等脚本跑完 (fetch metrics + 30 个 bar 模拟)
        await page.wait_for_timeout(2000)
        # 截图
        await page.screenshot(path=str(out_path), full_page=True)
        await browser.close()
    print(f"[done] 截图: {out_path} (size={out_path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
