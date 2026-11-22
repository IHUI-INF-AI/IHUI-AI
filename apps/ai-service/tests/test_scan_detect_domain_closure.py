# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""扫码/检测**落库路径**的归属收口回归锁(与 test_scan_login_import_domain_filter.py 互补)。

那份测的是 `POST /import-cookies`(用户粘贴输入口)。本文件测另外三条同型生产者:
`_run_scan_task` 的两个成功分支、`detect_login_from_profile`、`detect_login_from_cdp_session` ——
它们过去共用一份"5 项 cookie 名子串黑名单",而 `BDUSS`/`.CNBlogsCookie`/`APISID` 这类异站
cookie 的名字根本不含那些子串,于是整浏览器 jar 原样落库(2026-09-27 实测:库里三行 533/537 字段)。
"""

from __future__ import annotations

import pathlib
import re
from typing import Any

from app.services.scan_login import (
    PLATFORM_SCAN_CONFIG,
    _collect_platform_relevant,
    _cookie_domain_map,
)

FIXTURE_JAR: list[dict[str, Any]] = [
    {"name": "z_c0", "value": "v", "domain": ".zhihu.com"},
    {"name": "SESSION", "value": "s", "domain": ".mp.csdn.net"},
    {"name": "BDUSS", "value": "b", "domain": ".baidu.com"},
    {"name": ".CNBlogsCookie", "value": "c", "domain": ".cnblogs.com"},
    {"name": "APISID", "value": "a", "domain": ".google.com"},
    {"name": "hm.baidu", "value": "h", "domain": ".zhihu.com"},
    {"name": "novel_only_name", "value": "n"},  # 无 domain ⇒ 只能走名称兜底
]


def _config(platform: str) -> dict[str, Any]:
    return PLATFORM_SCAN_CONFIG[platform]


def test_profile_jar_keeps_only_the_platforms_own_cookies() -> None:
    values = {c["name"]: str(c["value"]) for c in FIXTURE_JAR}
    kept = _collect_platform_relevant("zhihu", values, FIXTURE_JAR, _config("zhihu"))
    assert "z_c0" in kept, "本平台登录 cookie 必须留下"
    assert "BDUSS" not in kept and ".CNBlogsCookie" not in kept and "APISID" not in kept, (
        "异站 cookie 又被收进来了 = 混包生产者复活"
    )


def test_same_jar_under_another_platform_does_not_reuse_zhihu_state() -> None:
    values = {c["name"]: str(c["value"]) for c in FIXTURE_JAR}
    kept = _collect_platform_relevant("csdn", values, FIXTURE_JAR, _config("csdn"))
    assert "SESSION" in kept
    assert "z_c0" not in kept, "域名说了算:zhihu 域的 cookie 不得算进 csdn 账号"


def test_unregistered_platform_degrades_to_login_cookies_not_old_blacklist() -> None:
    """平台没登记归属规则时不得退回旧黑名单(那正是被证伪的口径)。"""
    values = {c["name"]: str(c["value"]) for c in FIXTURE_JAR}
    kept = _collect_platform_relevant("nosuchplatform_xyz", values, FIXTURE_JAR, _config("zhihu"))
    assert set(kept).issubset({"z_c0", "_xsrf", "d_c0"}), f"退化档收进了无关项:{sorted(kept)}"


def test_domain_map_skips_entries_without_domain() -> None:
    m = _cookie_domain_map(FIXTURE_JAR)
    assert m["z_c0"] == ".zhihu.com"
    assert "novel_only_name" not in m


def test_old_name_blacklist_is_gone_from_executable_code() -> None:
    """源码锁:整条 app/** 的可执行代码里不得再出现那份 5 项名字黑名单。

    只剥注释与文档字符串再判 —— 说明性文字也会带执行性字符(守门 131 同型),
    但判据不能因此被放宽成"看见就算"。
    """
    root = pathlib.Path(__file__).resolve().parents[1] / "app"
    pat = re.compile(r'"cnzz"\s*,\s*"_ga"|"_ga"\s*,\s*"hm\.baidu"')
    offenders: list[str] = []
    for py in root.rglob("*.py"):
        body = "\n".join(
            line for line in py.read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("#")
        )
        if pat.search(body):
            offenders.append(py.name)
    assert not offenders, f"这些文件又自己按名字剔 tracker 了:{offenders}"


def test_profile_detection_reads_domains_from_the_browser() -> None:
    """画像检测路径必须走带域名的读取出口(否则上层只能靠名字猜归属)。"""
    base = pathlib.Path(__file__).resolve().parents[1] / "app"
    src = (base / "services" / "scan_login.py").read_text(encoding="utf-8")
    assert "read_profile_cookies_with_domains" in src
    hub = (base / "services" / "browser_hub.py").read_text(encoding="utf-8")
    assert "async def read_profile_cookies_with_domains" in hub
    assert "def _cookie_domain_map" not in hub, "域名映射只该有一份(scan_login 侧)"


def test_chrome_import_does_not_keep_its_own_keyword_list() -> None:
    """第 5 处生产者曾自带一份"统计类关键字"元组(注释还写着"与 scan_login 保持一致")——
    那正是库里两份逐字节相同的 533 字段混包的形状:整浏览器 jar 被存成了两个平台账号。"""
    base = pathlib.Path(__file__).resolve().parents[1] / "app"
    src = (base / "services" / "chrome_import.py").read_text(encoding="utf-8")
    assert "_TRACKER_KEYWORDS" not in src, "又自己抄了一份关键字名单 = 第二份真相回来了"
    assert "_collect_platform_relevant(" in src, "落库前必须走唯一归属出口"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
