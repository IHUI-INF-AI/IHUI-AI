# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-050 裁定补充夹具:声纹克隆是贵资源 —— 归属闸 + 计费闸,不能只靠路径校验。

背景(用户 2026-11-08 逐条裁定):对方要把 `token6688_voice_clone` 整只塞进
`_ADMIN_ONLY_TOOLS`,那是拿权限闸解决成本问题,会挡死 role=0 的正常对话链;
本线保留路径校验(`_validate_media_local_path`),另补两道:
  1. 归属:上游声纹库是平台共享账号、无属主概念,故本地账本 voice_id→user_id;
     list 只回自己的、get/delete 只许属主;账本里没有的存量声纹按 fail-closed 拒
     (与 AIS-096「新产物缺 sidecar 即 403」同一口径)。
  2. 计费:克隆属计费动作,复用 mcp_tool_approval.decide_credit_spend;拒绝发生
     在读音频/调上游之前(零副作用)。

改前实测(旧码):list 把全平台声纹回给任何用户、delete 可删别人的、
upload 无任何记账 —— 本文件 1~7 条全红。
"""

from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from typing import Any

import pytest

from app.services import mcp_server

WAV = b"\x00RIFF\x00\x00\x00\x00WAVEfake"
DATA_URI = "data:audio/wav;base64," + base64.b64encode(WAV).decode()


class _FakeInst:
    """上游 token6688 替身:所有调用都落进 calls,便于断言"零上游调用"。"""

    def __init__(self, voices: list[dict[str, Any]] | None = None) -> None:
        self.calls: list[tuple[str, str]] = []
        self._voices = voices or [
            {"voice_id": "v-mine", "name": "我的"},
            {"voice_id": "v-other", "name": "别人的"},
        ]

    async def list_voices(self) -> list[dict[str, Any]]:
        self.calls.append(("list", ""))
        return list(self._voices)

    async def get_voice(self, voice_id: str) -> dict[str, Any]:
        self.calls.append(("get", voice_id))
        return {"voice_id": voice_id}

    async def delete_voice(self, voice_id: str) -> dict[str, Any]:
        self.calls.append(("delete", voice_id))
        return {"ok": True, "status": "deleted", "raw": {}}

    async def upload_voice(self, audio: bytes, filename: str) -> dict[str, Any]:
        self.calls.append(("upload", filename))
        return {"voice": {"id": "v-new"}}


def _install(monkeypatch: pytest.MonkeyPatch) -> _FakeInst:
    inst = _FakeInst()
    monkeypatch.setattr(
        "app.services.video_generation._instantiate",
        lambda p: inst if p == "token6688" else None,
    )
    return inst


def _store(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, owners: dict[str, Any]) -> Path:
    path = tmp_path / "voice_owners.json"
    path.write_text(json.dumps(owners, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("VOICE_OWNER_STORE", str(path))
    return path


def _owners(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


async def test_list_only_returns_owned_voices(monkeypatch, tmp_path):
    """归属闸:list 只回当前用户的声纹;别人的必须被隐掉(旧码全量回传)。"""
    _install(monkeypatch)
    _store(monkeypatch, tmp_path, {"v-mine": {"user_id": "u-1"}})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "list", "__user_id": "u-1"}
    )
    assert out["ok"] is True, out
    assert out["count"] == 1, out
    assert [v["voice_id"] for v in out["voices"]] == ["v-mine"], out
    assert out["omitted"] == 1, out


async def test_get_denied_for_other_owner(monkeypatch, tmp_path):
    """归属闸:读别人的声纹 ⇒ VOICE_NOT_OWNED,且零上游调用。"""
    inst = _install(monkeypatch)
    _store(monkeypatch, tmp_path, {"v-other": {"user_id": "u-2"}})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "get", "voice_id": "v-other", "__user_id": "u-1"}
    )
    assert out["ok"] is False and out["errorCode"] == "VOICE_NOT_OWNED", out
    assert inst.calls == []


async def test_delete_denied_for_other_owner(monkeypatch, tmp_path):
    """归属闸:删别人的声纹 ⇒ VOICE_NOT_OWNED,上游 delete 一次都不许发。"""
    inst = _install(monkeypatch)
    _store(monkeypatch, tmp_path, {"v-other": {"user_id": "u-2"}})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "delete", "voice_id": "v-other", "__user_id": "u-1"}
    )
    assert out["ok"] is False and out["errorCode"] == "VOICE_NOT_OWNED", out
    assert inst.calls == []


async def test_legacy_unowned_voice_fails_closed(monkeypatch, tmp_path):
    """账本无记录(机制上线前存量)⇒ 无法证明归属,按 fail-closed 拒。"""
    inst = _install(monkeypatch)
    _store(monkeypatch, tmp_path, {})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "get", "voice_id": "v-legacy", "__user_id": "u-1"}
    )
    assert out["errorCode"] == "VOICE_NOT_OWNED", out
    assert inst.calls == []


async def test_missing_identity_denied(monkeypatch, tmp_path):
    """无宿主注入身份 ⇒ IDENTITY_REQUIRED(不许 fail-open 当匿名可用)。"""
    inst = _install(monkeypatch)
    _store(monkeypatch, tmp_path, {"v-mine": {"user_id": "u-1"}})
    out = await mcp_server._tool_token6688_voice_clone({"action": "list"})
    assert out["ok"] is False and out["errorCode"] == "IDENTITY_REQUIRED", out
    assert inst.calls == []


async def test_upload_records_owner_and_blocks_cross_user_get(monkeypatch, tmp_path):
    """归属闸闭环:自己克隆的记进账本;换个人 get 立刻 VOICE_NOT_OWNED。"""
    inst = _install(monkeypatch)
    path = _store(monkeypatch, tmp_path, {})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "data_uri": DATA_URI, "__user_id": "u-1"}
    )
    assert out["ok"] is True and out["voice_id"] == "v-new", out
    assert _owners(path)["v-new"]["user_id"] == "u-1", _owners(path)
    inst.calls.clear()
    denied = await mcp_server._tool_token6688_voice_clone(
        {"action": "get", "voice_id": "v-new", "__user_id": "u-2"}
    )
    assert denied["errorCode"] == "VOICE_NOT_OWNED", denied
    assert inst.calls == []


async def test_upload_credit_gate_blocks_before_upstream(monkeypatch, tmp_path):
    """计费闸:宿主盖章余额 50 < 克隆报价 100 且无批准 ⇒ 上游前拦截。"""
    inst = _install(monkeypatch)
    _store(monkeypatch, tmp_path, {})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "data_uri": DATA_URI, "__user_id": "u-1",
         "__credit_balance": 50}
    )
    assert out["ok"] is False and out["errorCode"] == "CREDIT_APPROVAL_REQUIRED", out
    assert out["creditSpend"]["quotedCredits"] == mcp_server.VOICE_CLONE_QUOTED_CREDITS
    assert inst.calls == []


async def test_upload_credit_gate_allows_with_host_approval(monkeypatch, tmp_path):
    """计费闸不是一刀切:宿主明确 granted ⇒ 放行(仍登记归属)。"""
    _install(monkeypatch)
    path = _store(monkeypatch, tmp_path, {})
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "data_uri": DATA_URI, "__user_id": "u-1",
         "__credit_balance": 50, "__credit_approval": "granted"}
    )
    assert out["ok"] is True, out
    assert _owners(path)["v-new"]["user_id"] == "u-1"


async def test_denial_is_observable(caplog, monkeypatch, tmp_path):
    """拒绝必须留可检索的结构化告警(不许静默 403)。"""
    _install(monkeypatch)
    _store(monkeypatch, tmp_path, {"v-other": {"user_id": "u-2"}})
    caplog.set_level(logging.WARNING, logger="app.services.mcp_server")
    await mcp_server._tool_token6688_voice_clone(
        {"action": "delete", "voice_id": "v-other", "__user_id": "u-1"}
    )
    messages = [r.getMessage() for r in caplog.records]
    assert any("AIS-050" in m and "VOICE_NOT_OWNED" in m for m in messages), messages
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
