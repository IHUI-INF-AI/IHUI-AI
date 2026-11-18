# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""checkin_doubao 纯函数单测(parse/classify/validate),零网络。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.checkin_doubao import (
    TASK_CODE_DAILY_WORK,
    TASK_KIND_MILESTONE,
    _classify_code,
    _extract_generation_ids,
    _extract_prompt,
    _validate_token,
    claim_body_for,
    claim_params_missing,
    doubao_client_device_id,
    doubao_device_map_uid,
    normalize_cookie_header,
    normalize_task_status,
    parse_campaign,
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


def test_validate_token_accepts_raw_sessionid() -> None:
    """号池 tokenEnc = 裸 sessionid(实证)⇒ 校验层必须折叠而不是拒绝。"""
    assert _validate_token("") is not None
    assert _validate_token("   ") is not None
    assert _validate_token("abc123") is None
    assert _validate_token("sessionid=abc; uid_tt=1") is None
    assert _validate_token("ttwid=xyz") is None


def test_normalize_cookie_header_idempotent() -> None:
    assert normalize_cookie_header("") == ""
    assert normalize_cookie_header("abc123") == "sessionid_ss=abc123; sessionid=abc123"
    assert normalize_cookie_header("sessionid=x; a=b") == "sessionid=x; a=b"
    assert normalize_cookie_header("ttwid=x") == "ttwid=x"
    assert normalize_cookie_header("1%7Cabc") == "ttwid=1%7Cabc"


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
    assert hasattr(mod, "doubao_list_tasks")
    assert hasattr(mod, "doubao_task_sweep_account")
    assert hasattr(mod, "doubao_claim_reward")
    assert hasattr(mod, "doubao_report_event")


# ===== 任务族(2026-11-16):状态/解析/领奖参数,零网络 =====


def test_normalize_task_status_both_forms() -> None:
    for value in (0, 1, 2, 3, 4):
        assert normalize_task_status(value) == value
    assert normalize_task_status("completed") == 2
    assert normalize_task_status("Rewarded") == 3
    assert normalize_task_status("in_progress") == 4
    assert normalize_task_status("4") == 4
    assert normalize_task_status(None) == 0
    assert normalize_task_status(True) == 0
    assert normalize_task_status(99) == 0
    assert normalize_task_status("whatever") == 0


def _campaign_body() -> dict[str, Any]:
    return {
        "code": 0,
        "data": {
            "tasks": [
                {
                    "campaign_code": "daily_signin",
                    "task_kind": "daily_signin",
                    "task_status": 3,
                    "daily_checkin": {
                        "checked_in_today": True,
                        "continuous_days": 3,
                        "reward": {"reward_amount": 200},
                    },
                },
                {
                    "campaign_code": "pc_task_complete_work_task_daily",
                    "task_kind": "chat_activity",
                    "campaign_type": "WorkTaskMode",
                    "task_status": "1",
                    "reward_summaries": [{"reward_amount": 50}],
                },
                {
                    "campaign_code": "select_work_fields",
                    "task_kind": "select_work_fields",
                    "task_status": 2,
                    "task_id": 62067867336131843,
                    "reward_mode": 1,
                    "reward_summaries": [{"reward_amount": 100}],
                },
                {
                    "campaign_code": "GenWord",
                    "task_kind": "GenWord",
                    "task_status": 1,
                    "recommend_prompts": [
                        '{"prompt":"帮我写一份周报","show_prompt":"写周报"}'
                    ],
                },
            ],
            "milestones": [
                {
                    "campaign_code": "points_milestone_500",
                    "task_kind": "points_milestone",
                    "task_status": 2,
                    "milestone_threshold": 500,
                    "reward_summaries": [{"reward_amount": 200}],
                },
                {"milestone_threshold": 2000, "task_status": 1},
            ],
            "progress": {"total_amount": 800},
        },
    }


def test_parse_campaign_full_shape() -> None:
    p = parse_campaign(_campaign_body())
    assert p["code"] == 0
    assert p["checked_in"] is True
    assert p["continuous_days"] == 3
    assert p["reward"] == 200
    assert p["credits"] == 800
    assert [t["code"] for t in p["tasks"]] == [
        "daily_signin",
        "pc_task_complete_work_task_daily",
        "select_work_fields",
        "GenWord",
    ]
    select = p["tasks"][2]
    assert select["status"] == 2
    assert select["task_id"] == "62067867336131843"
    assert select["reward"] == 100
    assert p["tasks"][1]["status_text"] == "created"
    # 缺 campaign_code 的里程碑丢弃(不猜名)
    assert [m["code"] for m in p["milestones"]] == ["points_milestone_500"]
    assert p["milestones"][0]["threshold"] == 500


def test_parse_campaign_bad_shape_is_safe() -> None:
    p = parse_campaign(None)
    assert p["code"] is None
    assert p["tasks"] == [] and p["milestones"] == []
    p2 = parse_campaign({"code": 710012001, "msg": "login invalid", "data": {"tasks": "oops"}})
    assert p2["code"] == 710012001
    assert p2["tasks"] == []


def test_claim_body_for_three_branches() -> None:
    daily_work = {
        "code": TASK_CODE_DAILY_WORK,
        "kind": "chat_activity",
        "task_id": "111",
    }
    assert claim_body_for(daily_work) == {
        "task_id": "111",
        "campaign_group_code": "pc_incentive_task_mvp_v3",
        "campaign_item_code": TASK_CODE_DAILY_WORK,
    }
    milestone = {"code": "points_milestone_500", "kind": TASK_KIND_MILESTONE}
    assert claim_body_for(milestone) == {
        "campaign_group_code": "pc_incentive_task_mvp_v3",
        "campaign_item_code": "points_milestone_500",
    }
    completed = {"code": "select_work_fields", "kind": "select_work_fields", "task_id": "222"}
    assert claim_body_for(completed) == {"task_id": "222"}
    direct = {"code": "x", "kind": "y", "reward_mode": 2}
    assert claim_body_for(direct) == {
        "campaign_group_code": "pc_incentive_task_mvp_v3",
        "campaign_item_code": "x",
    }
    assert claim_body_for({"code": "x", "kind": "y"}) == {}
    assert claim_params_missing({"code": "x", "kind": "y"}) is not None
    assert claim_params_missing(completed) is None


def test_extract_prompt_json_and_plain() -> None:
    assert _extract_prompt({"recommend_prompts": ['{"prompt":"写周报"}']}) == "写周报"
    assert _extract_prompt({"recommend_prompts": ["直接用这句"]}) == "直接用这句"
    assert _extract_prompt({"recommend_prompts": []}) is None
    assert _extract_prompt({}) is None


def test_client_device_id_stable_and_distinct() -> None:
    a = doubao_client_device_id({"uid": "744846990510748"})
    b = doubao_client_device_id({"uid": "744846990510748"})
    c = doubao_client_device_id({"uid": "744846990510749"})
    assert a == b
    assert a != c
    assert a.isdigit() and len(a) == 16
    assert doubao_client_device_id({"uid": "1", "doubao_device_id": "1976300013104096"}) == (
        "1976300013104096"
    )


def test_extract_generation_ids_from_sse_ack() -> None:
    sse = (
        "event: SSE_ACK\ndata: {\"query_list\":[{\"question_id\":\"62098947715516930\","
        "\"local_message_id\":\"x\",\"message_index\":1}],\"ack_client_meta\":"
        "{\"conversation_id\":\"38454206016500226\",\"local_conversation_id\":\"y\","
        "\"conversation_info\":{\"conversation_id\":\"38454206016500226\"}}}\n\n"
    )
    assert _extract_generation_ids(sse) == ("62098947715516930", "38454206016500226")
    assert _extract_generation_ids("") == (None, None)


# ===== 2026-11-17 回归:读态 detail 一律客户端指纹(web 指纹恒 code=2) =====


def test_read_state_detail_calls_use_client_fingerprint() -> None:
    """三处读态(doubao_checkin_account/probe_status/query_credits)的 detail 预检
    必须带 use_client_fingerprint=True,否则 web 指纹 detail 恒 code=2
    campaign not found,签到/探针/余额全误判。零网络 AST 静态断言。"""
    import ast
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "app/services/checkin_doubao.py"
    tree = ast.parse(src.read_text(encoding="utf-8"))
    targets = {"doubao_checkin_account", "doubao_probe_status", "doubao_query_credits"}
    found: dict[str, bool] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in targets:
            has_client_fp = False
            for sub in ast.walk(node):
                if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id == "_db_request":
                    # 第一个位置参数是 PATH_DETAIL,或关键字里 use_client_fingerprint=True
                    is_detail = any(
                        isinstance(a, ast.Name) and a.id == "PATH_DETAIL" for a in sub.args
                    ) or any(
                        k.arg == "path" and isinstance(k.value, ast.Name) and k.value.id == "PATH_DETAIL"
                        for k in sub.keywords
                    )
                    if is_detail:
                        has_client_fp = any(
                            k.arg == "use_client_fingerprint"
                            and isinstance(k.value, ast.Constant)
                            and k.value.value is True
                            for k in sub.keywords
                        )
            found[node.name] = has_client_fp
    assert set(found) == targets, f"未找到全部目标函数: {sorted(found)}"
    for name, ok in found.items():
        assert ok, f"{name} 的 detail 预检未用客户端指纹(web 指纹会 code=2 campaign not found)"
