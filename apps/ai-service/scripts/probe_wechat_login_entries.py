# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:

"""探针:实测各平台登录页是否存在「微信登录/微信扫码」入口(2026-09-30)。

背景:用户要求"尽量都用微信登录"。通用扫码架构(scan_login.py)已有
scan_tab_selectors「有则点、无则跳」点击计划机制(搜狐号即由此点出微信圆标)。
本脚本逐平台打开登录页,静态+展开探测微信入口候选,输出 selector 证据,
供人工确认后配置进 PLATFORM_SCAN_CONFIG。

用法:cd apps/ai-service && python scripts/probe_wechat_login_entries.py
"""

from __future__ import annotations

import json
import sys
import time
from typing import Any

from playwright.sync_api import sync_playwright

# 探测目标:常用平台 pill(头条已有微信码通道,公众号/视频号为微信系原生,不探)
TARGETS: dict[str, str] = {
    "zhihu": "https://www.zhihu.com/signin",
    "csdn": "https://passport.csdn.net/login",
    "juejin": "https://juejin.cn/login",
    "xiaohongshu": "https://www.xiaohongshu.com/explore",
    "bilibili": "https://passport.bilibili.com/login",
    "douyin": "https://www.douyin.com/",
    "kuaishou": "https://www.kuaishou.com/",
    "weibo": "https://passport.weibo.com/sso/signin?entry=miniblog&source=miniblog&disp=popup&url=https%3A%2F%2Fweibo.com%2Fu%2F0",
}

# 微信入口信号:CSS 候选(常见第三方登录排/圆标类名)
CSS_SIGNALS = [
    ".third .wx", ".third .wechat", "[class*='third'] [class*='wx']",
    "[class*='wechat']:not(script):not(style)", "[class*='weixin']:not(script):not(style)",
    "[class*='WxLogin']", "[alt*='微信']", "[aria-label*='微信']",
    "img[src*='weixin']", "img[src*='wechat']", "img[src*='wx']",
]

# 文本信号:节点可见文本
TEXT_SIGNALS = ["微信登录", "微信扫码", "微信扫一扫", "微信"]

# 兜底展开:部分平台把微信藏进「其他方式/更多」折叠排
EXPAND_SELECTORS = [
    "text=其他方式", "text=更多登录", "text=更多方式", "text=其他登录",
    "text=其它登录", "[class*='more']", "text=展开", "text=其它方式",
]


def visible(e: Any) -> bool:
    try:
        box = e.bounding_box()
        return bool(box) and (box["width"] > 2 or box["height"] > 2)
    except Exception:
        return False


def probe(platform: str, url: str, page: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"platform": platform, "found": [], "notes": []}
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(4_000)
        for sel in CSS_SIGNALS:
            try:
                for e in page.query_selector_all(sel)[:5]:
                    if visible(e):
                        outer = (e.evaluate("el => el.outerHTML") or "")[:120]
                        result["found"].append({"css": sel, "outer": outer})
            except Exception:
                pass
        # 文本信号(精确短语优先,裸「微信」只在有微信性类名/图标并存时记录)
        for text in TEXT_SIGNALS:
            try:
                loc = page.get_by_text(text, exact=False)
                if loc.count() > 0:
                    first = loc.first
                    if visible(first.element_handle()):
                        tag = first.evaluate("el => el.tagName + '|' + (el.className||'')")
                        result["found"].append({"text": text, "el": tag[:100]})
            except Exception:
                pass
        # 未命中则尝试展开折叠排再探一轮
        if not result["found"]:
            for ex in EXPAND_SELECTORS:
                try:
                    loc = page.get_by_text(ex, exact=False)
                    if loc.count() > 0 and visible(loc.first.element_handle()):
                        loc.first.click(timeout=2_000)
                        page.wait_for_timeout(1_500)
                        result["notes"].append(f"expanded:{ex}")
                        for sel in CSS_SIGNALS:
                            try:
                                for e in page.query_selector_all(sel)[:3]:
                                    if visible(e):
                                        result["found"].append({"css_after_expand": sel})
                            except Exception:
                                pass
                        for text in TEXT_SIGNALS[:3]:
                            try:
                                loc2 = page.get_by_text(text, exact=False)
                                if loc2.count() > 0 and visible(loc2.first.element_handle()):
                                    result["found"].append({"text_after_expand": text})
                            except Exception:
                                pass
                        break
                except Exception:
                    pass
        if not result["found"]:
            result["notes"].append("no wechat entry detected")
    except Exception as exc:  # 平台挂了不拖累整批
        result["notes"].append(f"error: {type(exc).__name__}: {exc}"[:200])
    return result


def main() -> int:
    report: list[dict[str, Any]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        for platform, url in TARGETS.items():
            page = ctx.new_page()
            t0 = time.time()
            r = probe(platform, url, page)
            r["elapsed_s"] = round(time.time() - t0, 1)
            report.append(r)
            page.close()
            print(f"[{platform}] found={len(r['found'])} {r['notes']}", file=sys.stderr)
        browser.close()
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
