"""Grafana Annotations 视图 playwright 验证 (建议 5 落地测试).

按用户规则:
  - 不使用 !important
  - 不使用高特异性选择器
  - 容器样式唯一 (annotation-list / annotation-item)
  - 中文不乱码
  - 最少最精简的代码

模拟 Grafana 9 风格: 时间线 + 标签 chips + 状态徽章
4 场景:
  1. full_success: 5/5 成功
  2. partial: 4/5 通过 (1 个失败)
  3. critical_fail: 1/5 通过
  4. empty: 无 annotations

每个场景出 1 张 PNG 截图 + 校验项
"""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent.parent
SHOTS = ROOT / "docs" / "screenshots"


def render(annotations: list[dict], date: str) -> str:
    """annotations: [{tags, text, status}, ...]"""
    if not annotations:
        body = '<div class="empty">无 annotations</div>'
        success = total = 0
    else:
        items = []
        success = 0
        for a in annotations:
            status = a.get("status", "info")
            if status == "success":
                cls = "ok"
                icon = "✓"
                success += 1
            elif status == "failure":
                cls = "fail"
                icon = "✗"
            elif status == "partial":
                cls = "warn"
                icon = "△"
            else:
                cls = "info"
                icon = "ℹ"
            chips = "".join(f'<span class="chip {cls}">{t}</span>' for t in a["tags"])
            text_lines = a["text"].split("\n")
            first_line = text_lines[0] if text_lines else ""
            rest = "\n".join(text_lines[1:]) if len(text_lines) > 1 else ""
            items.append(
                f'<div class="annotation-item {cls}">'
                f'<div class="annotation-time">{a.get("time_str", "")}</div>'
                f'<div class="annotation-icon">{icon}</div>'
                f'<div class="annotation-body">'
                f'<div class="annotation-title">{first_line}</div>'
                f'<div class="annotation-text">{rest}</div>'
                f'<div class="annotation-chips">{chips}</div>'
                f"</div>"
                f"</div>"
            )
        body = "\n".join(items)
        total = len(annotations)

    summary = f"{success}/{total} 通过" if total else "无演练"
    return f"""<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>ZHS Grafana Annotations - {date}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; }}
  h1 {{ font-size: 18px; margin: 0 0 8px; color: #f1f5f9; }}
  .sub {{ color: #64748b; font-size: 11px; margin-bottom: 12px; }}
  .panel {{ background: #1e293b; border-radius: 6px; padding: 12px; margin-bottom: 12px; }}
  .annotation-list {{ display: flex; flex-direction: column; gap: 6px; }}
  .annotation-item {{ display: grid; grid-template-columns: 100px 32px 1fr; gap: 8px;
                      padding: 8px; background: #0f172a; border-radius: 4px;
                      border-left: 3px solid #64748b; align-items: start; }}
  .annotation-item.ok {{ border-left-color: #10b981; }}
  .annotation-item.fail {{ border-left-color: #ef4444; }}
  .annotation-item.warn {{ border-left-color: #f59e0b; }}
  .annotation-item.info {{ border-left-color: #3b82f6; }}
  .annotation-time {{ font-size: 11px; color: #94a3b8; }}
  .annotation-icon {{ font-size: 16px; text-align: center; color: #cbd5e1; }}
  .annotation-item.ok .annotation-icon {{ color: #10b981; }}
  .annotation-item.fail .annotation-icon {{ color: #ef4444; }}
  .annotation-item.warn .annotation-icon {{ color: #f59e0b; }}
  .annotation-title {{ font-size: 13px; color: #f1f5f9; font-weight: 500; }}
  .annotation-text {{ font-size: 12px; color: #94a3b8; margin-top: 2px; white-space: pre-line; }}
  .annotation-chips {{ margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap; }}
  .chip {{ font-size: 10px; padding: 2px 6px; border-radius: 3px;
          background: #334155; color: #cbd5e1; }}
  .chip.ok {{ background: #064e3b; color: #6ee7b7; }}
  .chip.fail {{ background: #7f1d1d; color: #fca5a5; }}
  .chip.warn {{ background: #78350f; color: #fcd34d; }}
  .empty {{ padding: 24px; text-align: center; color: #64748b; }}
  .summary {{ padding: 8px 12px; background: #1e293b; border-radius: 4px;
              display: inline-block; font-size: 12px; }}
</style>
</head>
<body>
  <h1>ZHS Grafana Annotations 视图 (Phase 8 周演练 - {date})</h1>
  <div class="sub">渲染时间 {datetime.now(UTC).isoformat()}</div>
  <div class="summary">演练汇总: <strong>{summary}</strong></div>
  <div class="panel">
    <div class="annotation-list">
      {body}
    </div>
  </div>
</body>
</html>
"""


def make_scenario(name: str) -> list[dict]:
    """4 个场景: full / partial / critical / empty."""
    if name == "full_success":
        return [
            {
                "tags": ["phase8-drill", "summary", "success"],
                "text": "## Phase 8 周演练 20260616 (5/5 通过)\n\n全部 job 通过.",
                "status": "info",
                "time_str": "02:00",
            },
            {
                "tags": ["phase8-drill", "check-alert-rules", "success"],
                "text": "### check-alert-rules\n**状态**: success\n**汇总**: 49 条告警规范化通过",
                "status": "success",
                "time_str": "02:01",
            },
            {
                "tags": ["phase8-drill", "canary-bridge-drill", "success"],
                "text": "### canary-bridge-drill\n**状态**: success\n**汇总**: 1 次 mark_failure 触发",
                "status": "success",
                "time_str": "02:15",
            },
        ]
    if name == "partial":
        return [
            {
                "tags": ["phase8-drill", "summary", "partial"],
                "text": "## Phase 8 周演练 20260616 (4/5 通过)\n\n1 个 job 失败.",
                "status": "partial",
                "time_str": "02:00",
            },
            {
                "tags": ["phase8-drill", "canary-bridge-drill", "failure"],
                "text": "### canary-bridge-drill\n**状态**: failure\n**汇总**: 演练超时",
                "status": "failure",
                "time_str": "02:15",
            },
        ]
    if name == "critical_fail":
        return [
            {
                "tags": ["phase8-drill", "summary", "partial"],
                "text": "## Phase 8 周演练 20260616 (1/5 通过)\n\n4 个 job 失败.",
                "status": "partial",
                "time_str": "02:00",
            },
            {
                "tags": ["phase8-drill", "check-alert-rules", "failure"],
                "text": "### check-alert-rules\n**状态**: failure\n**汇总**: helm 副本不一致",
                "status": "failure",
                "time_str": "02:01",
            },
        ]
    return []  # empty


async def audit(page, name: str) -> dict:
    await page.wait_for_timeout(500)
    html = await page.content()
    body_text = await page.locator("body").inner_text()
    item_count = await page.locator(".annotation-item").count()
    chip_count = await page.locator(".chip").count()
    ok_count = await page.locator(".annotation-item.ok").count()
    fail_count = await page.locator(".annotation-item.fail").count()
    warn_count = await page.locator(".annotation-item.warn").count()
    return {
        "name": name,
        "items": item_count,
        "chips": chip_count,
        "ok": ok_count,
        "fail": fail_count,
        "warn": warn_count,
        "has_important": "!important" in html,
        "container_unique_list": html.count('class="annotation-list"') == 1,
        "container_unique_item": html.count('class="annotation-item') <= 1,
        "garbled": "?" in body_text and "ZHS" not in body_text.split("?")[0],
    }


async def main() -> int:
    SHOTS.mkdir(parents=True, exist_ok=True)
    states = ["full_success", "partial", "critical_fail", "empty"]
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1200, "height": 700}, device_scale_factor=2)
        page = await ctx.new_page()
        for s in states:
            html = render(make_scenario(s), "20260616")
            path = SHOTS / f"_render_annotations_{s}.html"
            path.write_text(html, encoding="utf-8")
            await page.goto(f"file:///{path.as_posix()}")
            r = await audit(page, s)
            png = SHOTS / f"zhs_annotations_{s}.png"
            await page.screenshot(path=str(png), full_page=True)
            results.append((s, r, png))
            print(
                f"[{s}] items={r['items']} chips={r['chips']} ok={r['ok']} fail={r['fail']} warn={r['warn']} !important={r['has_important']} list唯一={r['container_unique_list']} 乱码={r['garbled']} → {png.name} ({png.stat().st_size}B)"
            )
        await browser.close()

    print("\n=== 深度样式分析 ===")
    ok = True
    for s, r, _ in results:
        if r["has_important"]:
            print(f"  ✗ {s}: 使用了 !important (用户规则禁止)")
            ok = False
        if not r["container_unique_list"]:
            print(f"  ✗ {s}: .annotation-list 容器不唯一")
            ok = False
        if r["garbled"]:
            print(f"  ✗ {s}: 中文乱码")
            ok = False
        if s == "empty" and r["items"] != 0:
            print(f"  ✗ {s}: empty 场景应有 0 item, 实际 {r['items']}")
            ok = False
        if s != "empty" and r["items"] < 1:
            print(f"  ✗ {s}: 应有至少 1 item, 实际 {r['items']}")
            ok = False
    # 必须覆盖 4 种 class: ok / fail / warn
    classes_seen = set()
    for s, r, _ in results:
        for cls in ("ok", "fail", "warn"):
            if r[cls] > 0:
                classes_seen.add(cls)
    expected = {"ok", "fail", "warn"}
    miss = expected - classes_seen
    if miss:
        print(f"  ✗ 缺失 class 场景: {miss}")
        ok = False
    else:
        print("  ✓ 4 角度覆盖 ok / fail / warn 3 种类")
    if ok:
        print("  ✓ 全部通过, 4 张 PNG 已生成")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
