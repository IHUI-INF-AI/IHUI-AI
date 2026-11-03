# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""全平台微信登录入口批量探针(2026-09-30)。

遍历 PLATFORM_SCAN_CONFIG 全部平台,打开各自登录页,找「微信」可点击入口。
输出:平台 | 有入口(元素 tag.cls text) | 无 —— 决定哪些平台能接微信码。

用法:cd apps/ai-service && .venv/Scripts/python.exe scripts/probe_all_wechat.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# 以脚本自身位置定位 ai-service 根(不硬编码盘符,任意检出路径均可跑)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.sync_api import sync_playwright  # noqa: E402

from app.services.scan_login import PLATFORM_SCAN_CONFIG  # noqa: E402

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

JS_FIND_WECHAT = """() => {
    const out = [];
    for (const el of document.querySelectorAll('button,a,div,span,li,p,label,i,em')) {
        const r = el.getBoundingClientRect();
        if (r.width < 25 || r.height < 12 || r.width > 420) continue;
        const t = (el.textContent || '').trim();
        if (!t || t.length > 12) continue;
        if (!/微信|weixin|wechat/i.test(t)) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue;
        out.push({tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), text: t.slice(0, 12)});
        if (out.length >= 3) break;
    }
    return out;
}"""


def main() -> None:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(user_agent=UA, viewport={"width": 1280, "height": 800})
        for platform, cfg in PLATFORM_SCAN_CONFIG.items():
            if platform == "toutiao_app":
                continue  # 与 toutiao 同站点,微信码已由 toutiao 通道覆盖
            url = cfg.get("login_url")
            if not url:
                print(f"{platform}: NO login_url", flush=True)
                continue
            pg = ctx.new_page()
            try:
                pg.goto(url, wait_until="domcontentloaded", timeout=25_000)
                pg.wait_for_timeout(4_000)
                hits = pg.evaluate(JS_FIND_WECHAT)
                if hits:
                    hs = " | ".join(f"{h['tag']}.{h['cls']}[{h['text']}]" for h in hits)
                    print(f"{platform}: HAS_WECHAT {hs}", flush=True)
                else:
                    print(f"{platform}: none ({pg.url[:60]})", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"{platform}: ERROR {type(e).__name__}", flush=True)
            finally:
                pg.close()
        b.close()


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
