# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""checkin_doubao 纯函数单测(parse/classify/validate),零网络。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.checkin_doubao import (
    _classify_code,
    _validate_token,
    doubao_device_map_uid,
    parse_detail,
)


def _detail_body(checked_in: bool, reward: int = 200, total: int = 6600) -> dict[str, Any]:
    return {
        "code": 0,
        "data": {
            "tasks": [
                {
                    "task_kind": "daily_signin",
                    "daily_checkin": {
                        "checked_in_today": checked_in,
                        "continuous_days": 5,
                        "reward": {"reward_amount": reward},
                    },
                }
            ],
            "progress": {"total_amount": total},
        },
    }


def test_parse_detail_checked_in_today_true() -> None:
    p = parse_detail(_detail_body(True))
    assert p["code"] == 0
    assert p["checked_in"] is True
    assert p["reward"] == 200
    assert p["credits"] == 6600
    assert p["continuous_days"] == 5


def test_parse_detail_missing_task_is_unchecked() -> None:
    p = parse_detail({"code": 0, "data": {"tasks": []}})
    assert p["checked_in"] is False
    assert p["reward"] is None


def test_parse_detail_non_dict_is_safe() -> None:
    p = parse_detail(None)
    assert p["code"] is None
    assert p["checked_in"] is False
    p2 = parse_detail({"code": 710012001, "msg": "login invalid"})
    assert p2["code"] == 710012001
    assert p2["message"] == "login invalid"


def test_classify_session_dead_permanent() -> None:
    assert _classify_code(710012001, 200) == {"type": "SessionDead", "cooldown_seconds": -1}
    assert _classify_code(None, 401) == {"type": "SessionDead", "cooldown_seconds": -1}


def test_classify_blocked_and_ratelimit_cooldown_3600() -> None:
    for code in (710010702, 710022002):
        cls = _classify_code(code, 200)
        assert cls == {"type": "BusinessError", "cooldown_seconds": 3600}


def test_classify_other_codes_none() -> None:
    assert _classify_code(0, 200) is None
    assert _classify_code(None, 200) is None
    assert _classify_code(None, 502) == {"type": "SoftRate", "cooldown_seconds": 300}


def test_validate_token_requires_sessionid() -> None:
    assert _validate_token("") is not None
    assert _validate_token("foo=bar") is not None
    assert _validate_token("sessionid=abc; uid_tt=1") is None


def test_device_map_uid_forms() -> None:
    assert doubao_device_map_uid({"uid": "744846990510748"}) == "744846990510748"
    assert doubao_device_map_uid({"user_id": 123}) == "123"
    assert doubao_device_map_uid({}) is None
    assert doubao_device_map_uid(None) is None


@pytest.mark.parametrize("path", ["checkin_doubao"])
def test_module_importable(path: str) -> None:
    import importlib

    mod = importlib.import_module(f"app.services.{path}")
    assert hasattr(mod, "doubao_checkin_account")
    assert hasattr(mod, "doubao_probe_status")
    assert hasattr(mod, "doubao_query_credits")
