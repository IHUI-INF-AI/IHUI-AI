# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 patches 在 LLM 请求链路上的接线测试。"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers.llm import LLMCompleteRequest, _apply_request_patches


def _request(**overrides: object) -> LLMCompleteRequest:
    payload: dict[str, object] = {
        "messages": [
            {"role": "user", "content": "old", "cache_id": "m1"},
        ],
        "tools": [
            {
                "type": "function",
                "function": {"name": "read_file", "parameters": {}},
                "cache_id": "t1",
            },
        ],
    }
    payload.update(overrides)
    return LLMCompleteRequest.model_validate(payload)


def test_update_message_before_model_call() -> None:
    req = _request(
        patches={
            "messages": {
                "patches": [
                    {"cache_id": "m1", "action": "update", "content": {"content": "new"}},
                ]
            }
        }
    )
    _apply_request_patches(req)
    assert req.messages[0]["content"] == "new"
    assert req.messages[0]["cache_id"] == "m1"


def test_add_tool_and_rename_tool() -> None:
    req = _request(
        patches={
            "tools": {
                "patches": [
                    {"cache_id": "t1", "action": "rename", "rename_to": "read_file_v2"},
                    {
                        "cache_id": "t2",
                        "action": "add",
                        "content": {"type": "function", "function": {"name": "write_file"}},
                    },
                ]
            }
        }
    )
    _apply_request_patches(req)
    assert [tool.get("name") or tool["function"]["name"] for tool in req.tools or []] == [
        "read_file_v2",
        "write_file",
    ]


def test_unknown_channel_is_rejected() -> None:
    req = _request(patches={"images": {"patches": []}})
    with pytest.raises(HTTPException) as caught:
        _apply_request_patches(req)
    assert caught.value.status_code == 400
    assert caught.value.detail["code"] == "PATCH_CHANNEL_UNKNOWN"


def test_failed_patch_is_atomic_and_named() -> None:
    req = _request(
        patches={
            "messages": {
                "patches": [
                    {"cache_id": "missing", "action": "delete"},
                ]
            }
        }
    )
    with pytest.raises(HTTPException) as caught:
        _apply_request_patches(req)
    assert caught.value.status_code == 400
    assert caught.value.detail["code"] == "PATCH_TARGET_MISSING"
    assert req.messages[0]["content"] == "old"
