# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""发布能力验收矩阵 — 纯分类函数单测(不连 DB / 不起浏览器)。"""
from __future__ import annotations

from app.services.publish.acceptance import (
    _classify,
    _has_public_evidence,
    _is_weak_public_url,
    _verify_ok,
)


def test_verify_ok_accepts_known_success_shapes() -> None:
    assert _verify_ok("OK", "OK: connected")
    assert _verify_ok("LOGIN_OK", "LOGIN_OK jar=10")
    assert _verify_ok(None, "OK: web cookie valid")
    assert not _verify_ok("FAIL", "FAIL: cookie expired")
    assert not _verify_ok(None, "missing access_token")


def test_verify_ok_negative_message_overrides_ok_result() -> None:
    """小红书 8 的真实脏数据: result=OK, message=FAIL: cookie expired。"""
    assert not _verify_ok("OK", "FAIL: cookie expired (redirected to login)")
    assert not _verify_ok("OK", "token invalid ip 1.2.3.4 not in whitelist")
    assert not _verify_ok("OK", "未完成实名认证/账号信息审核中")


def test_classify_marks_real_publish_as_verified() -> None:
    status, readiness, _ = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=True,
        verify_message="OK: connected",
        needs_browser=True,
        missing=[],
        evidence={"published_url": "https://example.com/p/1"},
    )
    assert status == "verified"
    assert readiness == "verified"


def test_classify_marks_api_cookie_mismatch_as_login_only() -> None:
    status, readiness, _ = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=True,
        verify_message="OK: web cookie valid; API 适配器凭据仍缺,发布能力需网页版适配器",
        needs_browser=False,
        missing=["access_token"],
        evidence=None,
    )
    assert status == "login_only"
    assert readiness == "blocked"


def test_classify_browser_adapter_with_login_is_likely() -> None:
    status, readiness, _ = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=True,
        verify_message="OK: web cookie valid; API 适配器凭据仍缺,发布能力需网页版适配器",
        needs_browser=True,
        missing=["UserSecret"],
        evidence=None,
    )
    assert status == "browser_likely"
    assert readiness == "likely"


def test_classify_platform_blocked_is_login_only() -> None:
    status, readiness, next_action = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=False,
        verify_message="OK: web cookie valid; API token invalid ip 1.2.3.4 not in whitelist",
        needs_browser=False,
        missing=[],
        evidence=None,
        platform_blocked=True,
        blocked_reason="平台 API 出口 IP 未加入白名单",
    )
    assert status == "login_only"
    assert readiness == "blocked"
    assert "IP" in next_action


def test_classify_expired_login_is_reauth_required() -> None:
    status, readiness, _ = _classify(
        has_adapter=True, active_count=1, disabled_count=0, login_ok=False,
        verify_message="FAIL: cookie expired (redirected to login)",
        needs_browser=True, missing=[], evidence=None,
        platform_blocked=True,
        blocked_reason="登录态已过期,需重新扫码",
    )
    assert status == "reauth_required"
    assert readiness == "reauth"


def test_classify_web_probe_failure_is_login_only() -> None:
    status, readiness, next_action = _classify(
        has_adapter=True, active_count=1, disabled_count=0, login_ok=True,
        verify_message="OK: web cookie valid",
        needs_browser=False, missing=["access_token"], evidence=None,
        web_fallback=True,
        web_probe_error="[WEB_PROBE] article/publish 返回 code=7050 保存失败",
    )
    assert status == "login_only"
    assert readiness == "blocked"
    assert "7050" in next_action


def test_classify_platform_hard_block_is_login_only() -> None:
    status, readiness, next_action = _classify(
        has_adapter=True, active_count=1, disabled_count=0, login_ok=True,
        verify_message="LOGIN_OK connected (writer accessible)",
        needs_browser=True, missing=[], evidence=None,
        publish_failure="API 403: 您帐号被冻结，暂时无法发布文章哦~",
    )
    assert status == "login_only"
    assert readiness == "blocked"
    assert "冻结" in next_action


def test_classify_session_degraded_overrides_cookie_login() -> None:
    """公众号真实脏数据:cookie 能进后台、API 凭据字段齐全,但出口 IP 不在白名单。"""
    status, readiness, next_action = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=True,
        verify_message="Cookie 保活成功,访问 https://mp.weixin.qq.com/",
        needs_browser=False,
        missing=[],
        evidence=None,
        session_status="degraded",
        session_error="get token failed: errcode=40164 invalid ip not in whitelist",
    )
    assert status == "login_only"
    assert readiness == "blocked"
    assert "whitelist" in next_action


def test_classify_session_reauth_required_overrides_login_ok() -> None:
    status, readiness, _ = _classify(
        has_adapter=True,
        active_count=1,
        disabled_count=0,
        login_ok=True,
        verify_message="Cookie 保活成功,访问 https://www.xiaohongshu.com/explore",
        needs_browser=True,
        missing=[],
        evidence=None,
        session_status="reauth_required",
        session_error="cookie expired (redirected to login)",
    )
    assert status == "reauth_required"
    assert readiness == "reauth"


def test_classify_no_active_account() -> None:
    assert _classify(
        has_adapter=True, active_count=0, disabled_count=0, login_ok=False,
        verify_message="", needs_browser=True, missing=[], evidence=None,
    )[0] == "no_account"
    assert _classify(
        has_adapter=True, active_count=0, disabled_count=1, login_ok=False,
        verify_message="", needs_browser=True, missing=[], evidence=None,
    )[0] == "disabled"


def test_editor_and_publish_landing_urls_are_not_public_evidence() -> None:
    """知乎 /edit 与掘金 /published 都只是编辑器/落地页，不能算 verified。"""
    editor_row = {
        "success": True,
        "published_url": "https://zhuanlan.zhihu.com/p/2083163112501425288/edit",
        "platform_content_id": "edit",
    }
    landing_row = {
        "success": True,
        "published_url": "https://juejin.cn/published",
        "platform_content_id": "",
    }
    assert _is_weak_public_url(editor_row["published_url"])
    assert _is_weak_public_url(landing_row["published_url"])
    assert not _has_public_evidence(editor_row)
    assert not _has_public_evidence(landing_row)


def test_real_public_article_url_or_numeric_id_is_evidence() -> None:
    for url, content_id in (
        ("https://zhuanlan.zhihu.com/p/2109557512118744116", "2109557512118744116"),
        ("https://juejin.cn/post/7689415591787315226", "7689415591787315226"),
    ):
        row = {"success": True, "published_url": url, "platform_content_id": content_id}
        assert not _is_weak_public_url(url)
        assert _has_public_evidence(row)
    # 平台只返回数字作品 ID、没有拼公开 URL 时，仍可作为真实作品证据。
    assert _has_public_evidence(
        {"success": True, "published_url": "", "platform_content_id": "19812123"}
    )
