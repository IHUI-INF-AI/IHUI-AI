"""Dashboard Panel 9/10 视觉化 HTML 生成器 (本轮收尾).

生成 HTML 模拟 Grafana panel 9 (抑制比) + panel 10 (时钟漂移), 用于 playwright 视觉验证.
按用户规则:
  - 不使用 !important
  - 不使用高特异性选择器
  - 容器类样式 (grid / panel) 全局唯一
  - 最少最精简最直接的代码

输出: docs/screenshots/_render_panel_extensions.html
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


def render(inhibit_ratio: float, clock_drift: float, max_clock_drift: float) -> str:
    """根据实时数据渲染 2 panel HTML."""
    # 抑制比颜色: < 50% 绿, 50-80% 黄, > 80% 红
    if inhibit_ratio >= 0.8:
        inh_class, inh_text = "panel-bad", "高抑制"
        inh_color = "#ef4444"
    elif inhibit_ratio >= 0.5:
        inh_class, inh_text = "panel-warn", "中等抑制"
        inh_color = "#f59e0b"
    else:
        inh_class, inh_text = "panel-good", "正常"
        inh_color = "#10b981"

    # 时钟漂移颜色: < 10s 绿, 10-30s 黄, > 30s 红
    if clock_drift > 30:
        clk_class = "panel-bad"
        clk_color = "#ef4444"
    elif clock_drift > 10:
        clk_class = "panel-warn"
        clk_color = "#f59e0b"
    else:
        clk_class = "panel-good"
        clk_color = "#10b981"

    # 30 个历史点 (drift 趋势)
    import math

    history = []
    for i in range(30):
        h = clock_drift * (0.5 + 0.5 * math.sin(i / 4.0)) + (i / 30) * (max_clock_drift - clock_drift)
        history.append(round(h, 1))
    max_h = max(history + [1.0])
    bars = "".join(
        f'<div class="ts-bar" style="height:{int(v / max_h * 140)}px;background:{clk_color}"></div>' for v in history
    )

    return f"""<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>ZHS Dashboard - Panel 9/10</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; }}
  h1 {{ font-size: 18px; margin: 0 0 8px; color: #f1f5f9; }}
  .sub {{ color: #64748b; font-size: 11px; margin-bottom: 12px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }}
  .panel {{ background: #1e293b; border-radius: 6px; padding: 12px; min-height: 90px; }}
  .panel-title {{ font-size: 12px; color: #94a3b8; margin-bottom: 6px; }}
  .panel-value {{ font-size: 32px; font-weight: 600; color: #f1f5f9; }}
  .panel-good .panel-value {{ color: #10b981; }}
  .panel-warn .panel-value {{ color: #f59e0b; }}
  .panel-bad  .panel-value {{ color: #ef4444; }}
  .panel-sub {{ font-size: 11px; color: #64748b; margin-top: 4px; }}
  .ts-row {{ display: flex; align-items: flex-end; height: 140px; gap: 1px; margin-top: 8px; }}
  .ts-bar {{ flex: 1; min-height: 1px; }}
  .footer {{ font-size: 10px; color: #475569; text-align: right; margin-top: 8px; }}
</style>
</head>
<body>
  <h1>ZHS Dashboard 扩展面板 (Panel 9 + 10)</h1>
  <div class="sub">Grafana UID=zhs-monitor-health / 渲染时间 {datetime.now(UTC).isoformat()}</div>
  <div class="grid">
    <div class="panel {inh_class}" id="inhibit">
      <div class="panel-title">告警抑制比 (1h 窗口)</div>
      <div class="panel-value">{inhibit_ratio:.1%}</div>
      <div class="panel-sub">{inh_text} / 阈值 50% 黄 / 80% 红</div>
    </div>
    <div class="panel {clk_class}" id="clock">
      <div class="panel-title">App 时钟漂移趋势 (近 30 个采样点)</div>
      <div class="ts-row">{bars}</div>
      <div class="panel-sub">当前 {clock_drift:.1f}s / 阈值 30s 触发 ZHSMonitorClockDrift</div>
    </div>
  </div>
  <div class="footer">ZHS Platform - Phase 8 - Panel 9/10 视觉化 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
</body>
</html>
"""


def main() -> int:
    out = ROOT / "docs" / "screenshots" / "_render_panel_extensions.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    # 默认场景: 抑制 26.7% (正常), drift 5s (正常)
    html = render(inhibit_ratio=0.267, clock_drift=5.0, max_clock_drift=35.0)
    out.write_text(html, encoding="utf-8")
    print(f"OK 写入 {out} ({out.stat().st_size} bytes)")
    # 同时输出 4 状态版本
    scenarios = [
        ("normal", 0.20, 5.0, 15.0),
        ("warn_inhibit", 0.60, 8.0, 20.0),
        ("high_inhibit", 0.85, 12.0, 35.0),
        ("clock_drift", 0.30, 45.0, 60.0),
    ]
    for name, inh, clk, mx in scenarios:
        p = ROOT / "docs" / "screenshots" / f"_render_panel_extensions_{name}.html"
        p.write_text(render(inh, clk, mx), encoding="utf-8")
        print(f"  - {p.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
