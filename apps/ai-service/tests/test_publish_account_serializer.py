# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍
from __future__ import annotations

"""钉 `_serialize_account.hasCredentials` 派生口径(2026-09-30 用户反馈)。

背景:2026-09-27 混包凭证处置把知乎/B站/头条置空凭证 + status='disabled',
前端把这种行显示成"已禁用",用户误解为"平台不让用"。口径改为:
status='disabled' 且 hasCredentials=False ⇒ 前端显示"待重新扫码登录"。
本测试钉住序列化层的 hasCredentials 布尔派生,防止字段漂移/漏返回。
"""

from typing import Any

from app.routers.publish import _serialize_account


def _row(credentials_enc: Any) -> dict[str, Any]:
    """构造只含序列化所需键的假行(_serialize_account 只做下标访问,dict 即可)。"""
    return {
        "id": 7,
        "user_id": "u1",
        "platform": "bilibili",
        "display_name": "B站",
        "status": "disabled",
        "credentials_enc": credentials_enc,
        "last_verified_at": None,
        "last_verify_msg": "整浏览器混包凭证已按 2026-09-27 决定清除",
        "created_at": None,
        "updated_at": None,
    }


def test_disabled_with_cleared_credentials_has_credentials_false() -> None:
    out = _serialize_account(_row(""))  # type: ignore[arg-type]
    assert out["status"] == "disabled"
    assert out["hasCredentials"] is False


def test_disabled_with_credentials_present_has_credentials_true() -> None:
    out = _serialize_account(_row("iv:ciphertext:tag"))  # type: ignore[arg-type]
    assert out["status"] == "disabled"
    assert out["hasCredentials"] is True


def test_null_credentials_has_credentials_false() -> None:
    out = _serialize_account(_row(None))  # type: ignore[arg-type]
    assert out["hasCredentials"] is False
