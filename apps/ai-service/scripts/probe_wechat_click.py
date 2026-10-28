# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""候选平台「点击微信入口→出码」全链路实测 + 3 个失败平台重试(2026-09-30)。

每平台:打开登录页 → 点微信入口 → 等出码 → DOM 证据判定(微信扫码文本/新码图)。
截图存档供人工复核。

用法:cd apps/ai-service && .venv/Scripts/python.exe scripts/probe_wechat_click.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# 以脚本自身位置定位 ai-service 根(不硬编码盘符,任意检出路径均可跑)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.sync_api import sync_playwright  # noqa: E402

from app.services.scan_login import PLATFORM_SCAN_CONFIG  # noqa: E402

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
import tempfile

OUT = str(Path(tempfile.gettempdir()) / "ihui-probe-wechat")

# 平台 → (登录页覆盖, 微信入口 selector 列表, 前置点击)
CANDIDATES: dict[str, tuple[str | None, tuple[str, ...], tuple[str, ...]]] = {
    "segmentfault": (None, ('button:has-text("微信登录")',), ()),
    "qq": (None, ('span.tab-text:has-text("微信登录")', 'li:text-is("微信登录")'), ()),
    "douban": (None, ('a.link-3rd-wx',), ()),
    "baidu_zhidao": (None, ('.pass-phoenix-btn a:has-text("微信")', 'a:has-text("微信")'), ()),
    "baidu_tieba": (None, ('.pass-phoenix-btn a:has-text("微信")', 'a:has-text("微信")'), ()),
    "acfun": (None, ('a.i-o-ewm',), ()),
    "lofter": (None, ('div:text-is("微信")',), ()),
    "sina": (None, ('span:text("微信登录")', 'div:has-text("微信登录")'), ()),
    # 失败重试(仅探测入口)
    "oschina": (None, ('a:has-text("微信")', 'button:has-text("微信")'), ()),
    "36kr": (None, ('a:has-text("微信")', 'button:has-text("微信")'), ()),
    "people": (None, ('a:has-text("微信")', 'button:has-text("微信")'), ()),
}

JS_EVIDENCE = """() => {
    const txt = document.body.innerText || '';
    const hasWechatScan = /微信扫一扫|微信扫码|使用微信|打开微信|扫一扫登录/.test(txt);
    const codes = [...document.querySelectorAll('img,canvas')].filter(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 110 || r.height < 110) return false;
        if (el.tagName === 'CANVAS') return true;
        return el.src.startsWith('data:image') || /qr|code/i.test(el.src);
    }).map(el => ({tag: el.tagName.toLowerCase(), w: Math.round(el.getBoundingClientRect().width), src: (el.src || '').slice(0, 40)}));
    return {hasWechatScan, codes: codes.slice(0, 3)};
}"""


def run() -> None:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(user_agent=UA, viewport={"width": 1280, "height": 800})
        for platform, (override_url, sels, _pre) in CANDIDATES.items():
            url = override_url or PLATFORM_SCAN_CONFIG[platform].get("login_url")
            if not url:
                print(f"{platform}: no login_url", flush=True)
                continue
            pg = ctx.new_page()
            verdict = "none"
            try:
                pg.goto(url, wait_until="domcontentloaded", timeout=28_000)
                pg.wait_for_timeout(4_000)
                clicked = None
                for sel in sels:
                    try:
                        loc = pg.locator(sel).first
                        box = loc.bounding_box()
                        if box:
                            loc.click(timeout=3_000)
                            clicked = sel
                            break
                    except Exception:  # noqa: BLE001
                        continue
                pg.wait_for_timeout(3_500)
                ev = pg.evaluate(JS_EVIDENCE)
                if ev["codes"]:
                    verdict = f"QR_SHOWN clicked={clicked} codes={ev['codes']}"
                elif ev["hasWechatScan"]:
                    verdict = f"TEXT_ONLY clicked={clicked} (微信扫码文本出现,码图未定位)"
                else:
                    verdict = f"no_qr clicked={clicked} url={pg.url[:55]}"
            except Exception as e:  # noqa: BLE001
                verdict = f"ERROR {type(e).__name__}"
            finally:
                try:
                    pg.screenshot(path=rf"{OUT}\wc-{platform}.png", type="png")
                except Exception:  # noqa: BLE001
                    pass
                print(f"{platform}: {verdict}", flush=True)
                pg.close()
        b.close()


if __name__ == "__main__":
    run()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
