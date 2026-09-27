# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""CSDN「点发布后被踢回登录页」的归因回归(2026-09-27 立)。

一手实测机制:扫码导入的那套 Cookie **读得过、写不过** —— 编辑器页
``blog-console-api/v3/editor/getBaseInfo`` 正常返回用户名(所以 verify_credentials 是绿的),
但点完「发布」后人被 302 到 ``https://passport.csdn.net/account/login``,并在同一浏览器会话里
轮询 ``createQrCode`` / ``checkScan``;网络面板里**一条提交请求都没有**。原实现在这里只会
等 ``**/article/details/**`` 跳转,30s 超时后回一句 ``publish timeout (no redirect)`` —— 用户
和运维都无法据此判断是平台登录墙还是我们代码坏了。

判据住在 csdn.py 的纯函数 ``classify_publish_timeout`` 里,现场采集住在
``_collect_login_wall_scene`` 里:本文件因此**不起浏览器、不连网、不连库**(AGENTS §22c
的教训 —— 判据写在内联流程里就永远测不到)。

夹具出处纪律:登录页 URL 串取自本轮实测到的形态(``from=`` 的回跳地址按实测保留
percent-encoded 形态);扫码框文字标识取自本仓既有登记表 ``app/services/scan_login.py``
的扫码 tab 候选表 —— 未实测过的 CSS 类名不当判据,所以本文件也不出现任何类名。
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.services.publish.adapters.csdn import (
    DEFAULT_TIMEOUT_MESSAGE,
    LOGIN_WALL_CATEGORY,
    TIMEOUT_CATEGORY,
    _collect_login_wall_scene,
    classify_publish_timeout,
    is_login_wall_url,
)

#: 本轮实测到的那一串(点发布后被踢到的地址)。阳性对照专用,不得"就近简化"。
REAL_LOGIN_WALL_URL = "https://passport.csdn.net/account/login?from=https%3A%2F%2Feditor.csdn.net%2Fmd%2F"
#: 仍在编辑器页(真故障:改版/选择器失效)时的现场。
STILL_ON_EDITOR_URL = "https://editor.csdn.net/md/"


class _FakeLocator:
    def __init__(self, count: int = 0, exc: Exception | None = None) -> None:
        self._count = count
        self._exc = exc

    async def count(self) -> int:
        if self._exc is not None:
            raise self._exc
        return self._count


class _FakePage:
    """鸭子类型的 Playwright Page 替身:只提供本判据用到的三个动作。"""

    def __init__(
        self,
        url: str = "",
        *,
        url_exc: Exception | None = None,
        locator_exc: Exception | None = None,
        hit_marker_text: str | None = None,
    ) -> None:
        self._url = url
        self._url_exc = url_exc
        self._locator_exc = locator_exc
        self._hit = hit_marker_text
        self.locator_calls: list[str] = []

    @property
    def url(self) -> str:
        if self._url_exc is not None:
            raise self._url_exc
        return self._url

    def locator(self, selector: str) -> _FakeLocator:
        self.locator_calls.append(selector)
        if self._locator_exc is not None:
            return _FakeLocator(exc=self._locator_exc)
        if self._hit is not None and selector == f"text={self._hit}":
            return _FakeLocator(count=1)
        return _FakeLocator(count=0)


# ---------------------------------------------------------------------------
# ① 登录域 ⇒ 判成"需重新登录",文案必须可行动
# ---------------------------------------------------------------------------


class TestLoginWallClassification:
    def test_positive_control_real_observed_url_hits(self) -> None:
        """阳性对照:喂本轮实测到的那串真 URL 必须命中。

        判据抓不到真事故形态就不叫判据 —— 这一条是整个文件的存在理由。
        """
        assert is_login_wall_url(REAL_LOGIN_WALL_URL) is True
        verdict = classify_publish_timeout(REAL_LOGIN_WALL_URL)
        assert verdict.category == LOGIN_WALL_CATEGORY

    def test_message_is_actionable(self) -> None:
        verdict = classify_publish_timeout(REAL_LOGIN_WALL_URL)
        # 动作 + 机制,两句都要在:只说"请重新登录"用户不知道为什么会话已登录 yet 被踢
        assert "重新扫码" in verdict.error_message
        assert "只够读" in verdict.error_message
        assert "不够写" in verdict.error_message

    def test_message_keeps_original_evidence_and_drops_query(self) -> None:
        verdict = classify_publish_timeout(REAL_LOGIN_WALL_URL)
        assert DEFAULT_TIMEOUT_MESSAGE in verdict.error_message  # 原始现象可追溯
        assert "passport.csdn.net/account/login" in verdict.error_message
        # query 不得进用户可见文案:回跳参数不参与定性,也不该被抄进日志/界面
        assert "from=" not in verdict.error_message

    def test_qr_login_box_alone_is_enough(self) -> None:
        """URL 还在编辑器域、但页面已出现扫码框 ⇒ 同一型,按 OR 判定成立。"""
        verdict = classify_publish_timeout(STILL_ON_EDITOR_URL, ("扫码登录",))
        assert verdict.category == LOGIN_WALL_CATEGORY

    def test_blank_marker_does_not_count_as_evidence(self) -> None:
        """空串/纯空白标识不算证据 —— 否则采集端一个 bug 就能造出登录墙。"""
        verdict = classify_publish_timeout(STILL_ON_EDITOR_URL, ("", "   "))
        assert verdict.category == TIMEOUT_CATEGORY
        assert verdict.error_message == DEFAULT_TIMEOUT_MESSAGE


# ---------------------------------------------------------------------------
# ② 真故障不得被吞成登录墙
# ---------------------------------------------------------------------------


class TestRealTimeoutStaysTimeout:
    def test_editor_url_without_markers_stays_timeout(self) -> None:
        """仍在 editor.csdn.net 且没有登录标识 ⇒ 维持原 timeout 那一类(逐字原文案)。"""
        verdict = classify_publish_timeout(STILL_ON_EDITOR_URL)
        assert verdict.category == TIMEOUT_CATEGORY
        assert verdict.error_message == "publish timeout (no redirect)"

    def test_login_url_only_inside_query_is_not_swallowed(self) -> None:
        """判据有牙的证明:登录地址只出现在 query 里(人还在编辑器页)不得判成登录墙。

        这正是"拿整串做子串匹配"的实现会犯的错 —— 它会把改版故障洗成凭据问题,
        即本票要修的那类无法归因,只是换了个方向。
        """
        url = "https://editor.csdn.net/md/?back=https%3A%2F%2Fpassport.csdn.net%2Faccount%2Flogin"
        assert is_login_wall_url(url) is False
        assert classify_publish_timeout(url).category == TIMEOUT_CATEGORY

    def test_empty_or_garbage_url_is_not_login_wall(self) -> None:
        for url in ("", "   ", "not a url at all"):
            assert classify_publish_timeout(url).category == TIMEOUT_CATEGORY


# ---------------------------------------------------------------------------
# ③ 现场采集坏了 ⇒ 退回原结论,且绝不冒出新异常
# ---------------------------------------------------------------------------


class TestSceneCollectionFailureDegrades:
    async def test_page_url_raising_raises_nothing(self) -> None:
        """本条断言的是"没有异常抛出",不是返回值 —— 判据的失效方向必须是"少说一句话",
        绝不能是"把一条已经能落库的失败变成整链 publish failed"。"""
        page = _FakePage(url_exc=RuntimeError("Target page closed"))
        try:
            url, markers = await _collect_login_wall_scene(page)
        except BaseException as exc:  # noqa: BLE001 - 故意兜到底,异常即交付事故
            pytest.fail(f"现场采集不得冒出新异常,实得 {type(exc).__name__}: {exc}")
        assert classify_publish_timeout(url, markers).error_message == DEFAULT_TIMEOUT_MESSAGE

    async def test_locator_raising_degrades_to_original_message(self) -> None:
        """URL 采得到、DOM 探针炸 ⇒ 采到的标量喂进判据仍是原 timeout 结论。"""
        page = _FakePage(STILL_ON_EDITOR_URL, locator_exc=RuntimeError("execution context destroyed"))
        try:
            url, markers = await _collect_login_wall_scene(page)
        except BaseException as exc:  # noqa: BLE001
            pytest.fail(f"探针异常不得上抛,实得 {type(exc).__name__}: {exc}")
        assert classify_publish_timeout(url, markers).category == TIMEOUT_CATEGORY

    async def test_login_domain_skips_dom_probing(self) -> None:
        """URL 已定性就不再摸 DOM(省往返,也是"不引入新等待时长"的一部分)。"""
        page = _FakePage(REAL_LOGIN_WALL_URL)
        url, markers = await _collect_login_wall_scene(page)
        assert url == REAL_LOGIN_WALL_URL
        assert markers == ()
        assert page.locator_calls == []

    async def test_happy_path_collects_marker(self) -> None:
        page = _FakePage(STILL_ON_EDITOR_URL, hit_marker_text="扫码登录")
        url, markers = await _collect_login_wall_scene(page)
        assert markers == ("扫码登录",)
        assert classify_publish_timeout(url, markers).category == LOGIN_WALL_CATEGORY


# ---------------------------------------------------------------------------
# ④ 装车锁:判据必须真挂在 publish 的超时分支上
#
# 函数在、自检过、但没人调 = 提交链上一路绿灯(本仓守门 70/76/81 同型)。
# ---------------------------------------------------------------------------


class TestWiring:
    def _src(self) -> str:
        return (
            Path(__file__).parents[1]
            / "app" / "services" / "publish" / "adapters" / "csdn.py"
        ).read_text(encoding="utf-8")

    def test_publish_calls_scene_collector_and_classifier(self) -> None:
        src = self._src()
        assert "await _collect_login_wall_scene(page)" in src
        assert "classify_publish_timeout(scene_url, scene_markers)" in src

    def test_old_message_no_longer_hardcoded_at_the_branch(self) -> None:
        """原文案只能以常量形式存在一处 —— 内联字面量回来就意味着有人绕过了定性。"""
        src = self._src()
        assert src.count('"publish timeout (no redirect)"') == 1

    def test_success_path_untouched(self) -> None:
        """约束边界:只改失败归因,成功判据那一句必须还在。"""
        assert 'wait_for_url("**/article/details/**", timeout=30000)' in self._src()


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
