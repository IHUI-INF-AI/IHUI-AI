"""Playwright 深度样式校验 - Panel 9/10 视觉化.

按用户规则校验:
  - 4 状态切换 (normal / warn_inhibit / high_inhibit / clock_drift)
  - panel-good / panel-warn / panel-bad 三种颜色 class 都存在
  - 30 个 ts-bar 真实数据点
  - 中文不乱码
  - 容器样式唯一 (grid + panel 类只出现一次)
  - 无 !important
  - 4 角度各出 1 张 PNG
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
SHOTS = ROOT / "docs" / "screenshots"


async def audit(page, state: str) -> dict:
    await page.wait_for_timeout(500)
    html = await page.content()
    body_text = await page.locator("body").inner_text()
    panel_count = await page.locator(".panel").count()
    ts_count = await page.locator(".ts-bar").count()
    inh_value = await page.locator("#inhibit .panel-value").inner_text()
    clk_value = await page.locator("#clock .panel-sub").inner_text()
    inh_classes = await page.locator("#inhibit").get_attribute("class")
    clk_classes = await page.locator("#clock").get_attribute("class")
    garbled = "?" in body_text and "ZHS" not in body_text.split("?")[0]
    return {
        "state": state,
        "panel_count": panel_count,
        "ts_bars": ts_count,
        "inh_value": inh_value.strip(),
        "inh_class": inh_classes,
        "clk_class": clk_classes,
        "has_grid": "grid" in html,
        "has_important": "!important" in html,
        "grid_unique": len(re.findall(r"\.grid\s*{", html)) == 1,
        "panel_unique": len(re.findall(r"\.panel\s*{", html)) == 1,
        "garbled": garbled,
    }


async def main() -> int:
    states = [
        ("normal", "_render_panel_extensions_normal.html"),
        ("warn_inhibit", "_render_panel_extensions_warn_inhibit.html"),
        ("high_inhibit", "_render_panel_extensions_high_inhibit.html"),
        ("clock_drift", "_render_panel_extensions_clock_drift.html"),
    ]
    SHOTS.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1200, "height": 600},
            device_scale_factor=2,
        )
        page = await ctx.new_page()
        for s, html in states:
            p_html = SHOTS / html
            await page.goto(f"file:///{p_html.as_posix()}")
            r = await audit(page, s)
            png = SHOTS / f"zhs_panel_extensions_{s}.png"
            await page.screenshot(path=str(png), full_page=True)
            results.append((s, r, png))
            print(
                f"[{s}] inh={r['inh_value']} inh_class={r['inh_class']} clk_class={r['clk_class']} ts={r['ts_bars']} panel={r['panel_count']} grid唯一={r['grid_unique']} panel唯一={r['panel_unique']} !important={r['has_important']} 乱码={r['garbled']} → {png.name} ({png.stat().st_size}B)"
            )
        await browser.close()

    print("\n=== 样式深度分析 ===")
    ok = True
    classes_seen = set()
    for s, r, _ in results:
        if r["panel_count"] < 2:
            print(f"  ✗ {s}: panel 不足 2 (实际 {r['panel_count']})")
            ok = False
        if r["ts_bars"] < 30:
            print(f"  ✗ {s}: ts-bar 不足 30 (实际 {r['ts_bars']})")
            ok = False
        if r["has_important"]:
            print(f"  ✗ {s}: 使用了 !important (用户规则禁止)")
            ok = False
        if not r["grid_unique"]:
            print(f"  ✗ {s}: .grid 容器样式重复定义")
            ok = False
        if not r["panel_unique"]:
            print(f"  ✗ {s}: .panel 容器样式重复定义")
            ok = False
        if r["garbled"]:
            print(f"  ✗ {s}: 中文乱码")
            ok = False
        # 收集 class
        for c in (r["inh_class"] or "").split():
            classes_seen.add(c)
        for c in (r["clk_class"] or "").split():
            classes_seen.add(c)
    # 4 状态应至少覆盖 3 种 class (good/warn/bad)
    expected = {"panel-good", "panel-warn", "panel-bad"}
    miss = expected - classes_seen
    if miss:
        print(f"  ✗ 缺失 class: {miss}")
        ok = False
    else:
        print(f"  ✓ 4 角度覆盖全部 3 种类: {sorted(classes_seen & expected)}")
    if ok:
        print("  ✓ 全部通过, 4 角度 PNG 已生成")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
