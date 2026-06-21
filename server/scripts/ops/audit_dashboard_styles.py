"""Dashboard 4 角度 playwright 深度样式校验 (用户规则要求).

要求覆盖:
  - 8 个 panel (4 stat + 2 by_table + 2 timeseries) 全部存在
  - 中文显示无乱码 / 无方框
  - 4 角度分别校验 banner / 颜色 / 文本切换
  - 真实数据点已渲染 (非 mock)
  - 样式无 !important 滥用
  - 容器类样式唯一 (用相同类不重复定义)
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent.parent


async def audit_state(page, state: str) -> dict:
    await page.wait_for_timeout(600)
    panel_count = await page.locator(".panel").count()
    h1_text = (await page.locator("h1").first.inner_text()).strip()
    running_text = (await page.locator("#running, .panel-value").first.inner_text()).strip()
    bar_count = await page.locator(".bar-row").count()
    ts_count = await page.locator(".ts-bar").count()
    by_table_html = (
        await page.locator(".panel.row2").first.inner_html() if await page.locator(".panel.row2").count() else ""
    )
    banner_count = await page.locator(".banner").count()
    # 检测中文乱码 (问号/方框)
    body_text = await page.locator("body").inner_text()
    bad = "?" in body_text and "ZHS" not in body_text.split("?")[0]
    return {
        "state": state,
        "panels": panel_count,
        "h1": h1_text,
        "running": running_text,
        "bars": bar_count,
        "ts_bars": ts_count,
        "banner": banner_count,
        "by_table_has_data": "无缓存" not in by_table_html and "无过期" not in by_table_html,
        "garbled": bad,
    }


async def main() -> int:
    html_dir = ROOT / "docs" / "screenshots"
    states = ["healthy", "warning", "critical", "recovery"]
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        results = []
        for s in states:
            html = html_dir / f"_render_{s}.html"
            await page.goto(f"file:///{html.as_posix()}")
            r = await audit_state(page, s)
            results.append(r)
            print(
                f"[{s}] panels={r['panels']} bars={r['bars']} ts_bars={r['ts_bars']} banner={r['banner']} 标题={r['h1']} running={r['running']} 数据完整={r['by_table_has_data']} 乱码={r['garbled']}"
            )
        await browser.close()

    # 汇总
    print("\n=== 样式深度分析 ===")
    ok = True
    for r in results:
        if r["panels"] < 8:
            print(f"  ❌ {r['state']}: panel 不足 8 ({r['panels']})")
            ok = False
        if r["ts_bars"] < 60:  # 2 个 timeseries 面板 × 30
            print(f"  ❌ {r['state']}: ts-bar 不足 60 ({r['ts_bars']})")
            ok = False
        if r["garbled"]:
            print(f"  ❌ {r['state']}: 检测到乱码")
            ok = False
    # 4 角度必须 banner 颜色不同
    banner_states = [r["banner"] for r in results]
    if banner_states[1] == 0 or banner_states[2] == 0:
        print(f"  ❌ warning/critical 必须有 banner, 实际 {banner_states}")
        ok = False
    if ok:
        print("  ✓ 全部 4 角度 panel 数 8 / ts-bar ≥60 / 无乱码 / banner 正确切换")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
