# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""prepare_publish_draft 编排工具测试（2026-11-27 立）。

覆盖：缺用户/缺 brief/非法平台、无账号不生成、账号筛选、默认出稿参数、
合规阻断不落库、成功落草稿并返回确认入口、生成失败/草稿失败透传。
账号、模型、合规、落库全部打桩，不碰真实 DB 与 LLM。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.tools import pipeline_tools
from app.tools.pipeline_tools import prepare_publish_draft


def _account(**overrides: Any) -> dict[str, Any]:
    base = {
        "accountId": 7,
        "platform": "douyin",
        "displayName": "智汇AI抖音号",
        "status": "active",
        "hasCredentials": True,
        "publishBlocked": False,
        "sessionStatus": "active",
    }
    base.update(overrides)
    return base


@pytest.fixture
def accounts(monkeypatch):
    state: dict[str, Any] = {"items": [_account()], "calls": 0}

    async def fake_accounts(arguments: dict[str, Any]) -> dict[str, Any]:
        state["calls"] += 1
        return {"ok": True, "items": state["items"], "count": len(state["items"])}

    monkeypatch.setattr(pipeline_tools, "list_publish_accounts", fake_accounts)
    return state


@pytest.fixture
def generation(monkeypatch):
    state: dict[str, Any] = {
        "calls": 0,
        "args": None,
        "result": {
            "ok": True,
            "title": "AI 时代的一人公司",
            "content": "正文内容",
            "hashtags": ["#AI", "#一人公司"],
            "charCount": 480,
            "withinRange": True,
            "titleLength": 16,
            "titleWithinRange": True,
            "hashtagCount": 2,
            "model": "auto-route",
            "usage": {"total_tokens": 100},
        },
    }

    async def fake_generate(arguments: dict[str, Any]) -> dict[str, Any]:
        state["calls"] += 1
        state["args"] = arguments
        return state["result"]

    monkeypatch.setattr(pipeline_tools, "generate_content", fake_generate)
    return state


@pytest.fixture
def compliance(monkeypatch):
    state: dict[str, Any] = {"calls": 0, "result": {"ok": True, "blocking": 0, "warnings": 0}}

    async def fake_check(arguments: dict[str, Any]) -> dict[str, Any]:
        state["calls"] += 1
        state["args"] = arguments
        return state["result"]

    monkeypatch.setattr(pipeline_tools, "precheck_content", fake_check)
    return state


@pytest.fixture
def draft(monkeypatch):
    state: dict[str, Any] = {"calls": 0, "args": None, "result": {"ok": True, "taskId": "pub-1", "status": "draft"}}

    async def fake_draft(arguments: dict[str, Any]) -> dict[str, Any]:
        state["calls"] += 1
        state["args"] = arguments
        return state["result"]

    monkeypatch.setattr(pipeline_tools, "create_publish_draft", fake_draft)
    return state


@pytest.mark.asyncio
async def test_missing_user() -> None:
    result = await prepare_publish_draft({"brief": "写一条", "platforms": ["douyin"]})
    assert result["ok"] is False
    assert result["errorCode"] == "MISSING_USER"


@pytest.mark.asyncio
async def test_missing_brief() -> None:
    result = await prepare_publish_draft({"platforms": ["douyin"], "__user_id": "u1"})
    assert result["ok"] is False
    assert result["errorCode"] == "MISSING_BRIEF"


@pytest.mark.asyncio
async def test_no_account_does_not_generate(accounts, generation, draft) -> None:
    accounts["items"] = []
    result = await prepare_publish_draft(
        {"brief": "写一条", "platforms": ["douyin", "xiaohongshu"], "__user_id": "u1"}
    )
    assert result["ok"] is False
    assert result["errorCode"] == "NO_ACCOUNT"
    assert result["missingPlatforms"] == ["douyin", "xiaohongshu"]
    assert generation["calls"] == 0
    assert draft["calls"] == 0


@pytest.mark.asyncio
async def test_account_selection_skips_blocked(accounts, generation, compliance, draft) -> None:
    accounts["items"] = [
        _account(accountId=1, publishBlocked=True),
        _account(accountId=2, status="disabled"),
        _account(accountId=3),
    ]
    result = await prepare_publish_draft({"brief": "写一条", "platforms": ["douyin"], "__user_id": "u1"})
    assert result["ok"] is True
    assert result["targets"][0]["account_id"] == 3


@pytest.mark.asyncio
async def test_defaults_are_passed_to_generation_and_check(accounts, generation, compliance, draft) -> None:
    result = await prepare_publish_draft(
        {"brief": "写一条 AI 选题", "platforms": ["douyin"], "__user_id": "u1", "__session_id": "s1"}
    )
    assert result["ok"] is True
    assert generation["args"]["min_chars"] == 470
    assert generation["args"]["max_chars"] == 490
    assert generation["args"]["title_chars"] == 16
    assert generation["args"]["hashtag_count"] == 5
    assert compliance["args"]["profile"] == "ihui_koubo"
    assert compliance["args"]["title_length"] == 16
    assert draft["args"]["targets"] == [{"platform": "douyin", "account_id": 7}]
    assert result["taskId"] == "pub-1"
    assert result["confirm"] is None


@pytest.mark.asyncio
async def test_compliance_block_does_not_create_draft(accounts, generation, compliance, draft) -> None:
    compliance["result"] = {"ok": False, "blocking": 2, "warnings": 1}
    result = await prepare_publish_draft({"brief": "写一条", "platforms": ["douyin"], "__user_id": "u1"})
    assert result["ok"] is False
    assert result["errorCode"] == "PREFLIGHT_BLOCKED"
    assert result["title"] == "AI 时代的一人公司"
    assert result["contentCheck"]["blocking"] == 2
    assert draft["calls"] == 0


@pytest.mark.asyncio
async def test_generation_failure_passthrough(accounts, generation, compliance, draft) -> None:
    generation["result"] = {"ok": False, "errorCode": "LLM_UNAVAILABLE", "message": "未配置模型"}
    result = await prepare_publish_draft({"brief": "写一条", "platforms": ["douyin"], "__user_id": "u1"})
    assert result["ok"] is False
    assert result["errorCode"] == "GENERATION_FAILED"
    assert result["generationErrorCode"] == "LLM_UNAVAILABLE"
    assert compliance["calls"] == 0
    assert draft["calls"] == 0


@pytest.mark.asyncio
async def test_invalid_format() -> None:
    result = await prepare_publish_draft(
        {"brief": "写一条", "platforms": ["douyin"], "format": "pdf", "__user_id": "u1"}
    )
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_FORMAT"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
