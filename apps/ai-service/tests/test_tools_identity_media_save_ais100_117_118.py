# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-100 / AIS-117 / AIS-118 夹具(同一批)。

- AIS-100:codebase-index 的出域同意与索引归属主体必须只从承载层令牌取,
  请求体 `user_id` 不再被接受(旧码直接读 body ⇒ 任意登录用户可冒名恢复出域、
  把索引归属记到受害者)。
- AIS-117:video_generation 的 token6688 / agnes 两个专用分支在落盘块之前 return,
  `save_path` 被静默丢弃(agnes 载荷硬编码 `saved_path: None`)⇒ 回执 ok=true
  但盘上无文件、连白名单校验都没做。本夹具要求两条专用分支都真的落盘、
  且非法路径在专用分支同样被拒。
- AIS-118:voice_tts 的 `if ok_path:` 没有 else,校验/写盘失败被静默吞掉,
  末尾照旧 `ok: true`。现在非法 save_path 在合成前 fail-fast(零上游调用),
  写盘失败也显式回 `errorCode`。
"""

from __future__ import annotations

import inspect
import os
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.routers import tools
from app.services import mcp_server


def _allow_roots(monkeypatch: pytest.MonkeyPatch, *roots: Path) -> None:
    """把本次测试自己的受控目录登记进工作区白名单(闸本身不绕过)。"""
    monkeypatch.setenv(
        "MCP_WORKSPACE_ROOTS", os.pathsep.join(str(r) for r in roots)
    )


# ---------------------------------------------------------------------------
# AIS-100:请求体不再决定身份
# ---------------------------------------------------------------------------


def test_codebase_index_request_model_rejects_body_user_id() -> None:
    """请求体带 user_id 必须被拒(extra=forbid),身份只能从令牌来。"""
    with pytest.raises(ValidationError):
        tools.CodebaseIndexRequest(
            action="refresh",
            workspace_path=".",
            user_id="victim-uuid",
        )


def test_codebase_index_endpoint_takes_identity_dependency() -> None:
    """端点签名必须挂 require_request_user_id,而不是从 req.user_id 读。"""
    params = inspect.signature(tools.codebase_index).parameters
    assert "principal" in params, (
        "端点没接身份依赖:身份仍会从请求体自报"
    )
    assert "req" in params


async def test_codebase_index_refresh_uses_request_principal(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """refresh 的 user_id 必须等于承载层 principal,不是请求体里的值。"""
    _allow_roots(monkeypatch, tmp_path)
    captured: dict[str, object] = {}

    class _Outcome:
        action = "fresh"

        def to_dict(self) -> dict[str, str]:
            return {"action": self.action}

    async def _fake_ensure_fresh(path, repo_id=None, user_id=None, force=False, indexer=None):
        captured["user_id"] = user_id
        captured["path"] = path
        return _Outcome()

    monkeypatch.setattr(tools, "ensure_fresh", _fake_ensure_fresh)

    out = await tools.codebase_index(
        tools.CodebaseIndexRequest(
            action="refresh", workspace_path=str(tmp_path), repo_id="r1", force=True
        ),
        "principal-from-token",
    )
    assert captured["user_id"] == "principal-from-token"
    assert out["action"] == "refresh"


# ---------------------------------------------------------------------------
# AIS-117:专用 provider 分支也要落盘
# ---------------------------------------------------------------------------


class _T6688Inst:
    async def generate_video(self, prompt, model, **kw):
        return {"task_id": "t-117", "model": model or "m"}

    async def get_task_status(self, tid):
        return {"ok": True, "status": "completed", "video_url": "https://x/v117.mp4"}


class _AgnesInst:
    async def get_task_status(self, tid):
        return {"status": "completed", "video_url": "https://x/a117.mp4"}


async def test_video_token6688_path_persists_save_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """token6688 分支拿到成片后必须按 save_path 落盘。"""
    _allow_roots(monkeypatch, tmp_path)
    target = tmp_path / "t6688.mp4"
    monkeypatch.setattr(
        "app.services.video_generation._instantiate",
        lambda p: _T6688Inst() if p == "token6688" else None,
    )

    async def _fake_download(url, client):
        return b"V" * 10

    monkeypatch.setattr("app.services.mcp_server._download_media_bytes", _fake_download)
    monkeypatch.setenv("VIDEO_TOOL_WAIT_S", "15")

    out = await mcp_server._tool_video_generation(
        {"prompt": "x", "provider": "token6688", "save_path": str(target)}
    )
    assert out["ok"] is True, out
    assert out["saved_path"] == str(target), out
    assert out["file_size_bytes"] == 10, out
    assert target.exists() and target.read_bytes() == b"V" * 10


async def test_video_agnes_path_persists_save_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """agnes 分支(提交即返成片)同样必须落盘,不能再硬编码 saved_path=None。"""
    _allow_roots(monkeypatch, tmp_path)
    target = tmp_path / "agnes.mp4"

    async def _submit(inst, prompt, model, **kw):
        return (
            {"task_id": "a-117", "video_url": "https://x/a117.mp4", "model": model or "m"},
            "",
            False,
        )

    monkeypatch.setattr(mcp_server, "_agnes_submit_with_retry", _submit)
    monkeypatch.setattr(
        "app.services.video_generation._instantiate", lambda p: _AgnesInst()
    )

    async def _fake_download(url, client):
        return b"A" * 7

    monkeypatch.setattr("app.services.mcp_server._download_media_bytes", _fake_download)

    out = await mcp_server._tool_video_generation(
        {"prompt": "x", "provider": "agnes", "save_path": str(target)}
    )
    assert out["ok"] is True, out
    assert out["saved_path"] == str(target), out
    assert out["file_size_bytes"] == 7, out
    assert target.exists() and target.read_bytes() == b"A" * 7


async def test_video_specialized_branch_rejects_illegal_save_path(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """专用分支的 save_path 也要过白名单:非法路径 ⇒ 明确错误码,零落盘。"""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "outside" / "escape.mp4"
    outside.parent.mkdir()
    _allow_roots(monkeypatch, allowed)
    monkeypatch.setattr(
        "app.services.video_generation._instantiate",
        lambda p: _T6688Inst() if p == "token6688" else None,
    )
    async def _fake_download(url, client):
        return b"V" * 10

    monkeypatch.setattr("app.services.mcp_server._download_media_bytes", _fake_download)
    monkeypatch.setenv("VIDEO_TOOL_WAIT_S", "15")

    out = await mcp_server._tool_video_generation(
        {"prompt": "x", "provider": "token6688", "save_path": str(outside)}
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "PATH_NOT_ALLOWED", out
    assert not outside.exists()


# ---------------------------------------------------------------------------
# AIS-118:voice_tts 的 save_path 失败不再静默
# ---------------------------------------------------------------------------


async def test_voice_tts_illegal_save_path_fails_before_any_upstream(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """非法 save_path 必须在合成前被拒:显式 errorCode 且零上游调用。"""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "outside" / "tts.mp3"
    outside.parent.mkdir()
    _allow_roots(monkeypatch, allowed)
    calls = {"n": 0}

    async def _tts_once(eng, text, args):
        calls["n"] += 1
        return b"audio", "audio/mpeg", "v", "p", None

    monkeypatch.setattr(mcp_server, "_tts_once", _tts_once)

    out = await mcp_server._tool_voice_tts({"text": "你好", "save_path": str(outside)})
    assert out["ok"] is False, out
    assert out["errorCode"] == "PATH_NOT_ALLOWED", out
    assert calls["n"] == 0, "非法路径不该先花一次上游合成"
    assert not outside.exists()


async def test_voice_tts_write_failure_is_not_reported_success(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """写盘失败也要显式失败(旧码 ok=True + saved_path=None,静默失真)。"""
    _allow_roots(monkeypatch, tmp_path)

    async def _tts_once(eng, text, args):
        return b"audio", "audio/mpeg", "v", "p", None

    async def _persist_fail(audio_bytes, save_path):
        return False, "", 0, "WRITE_FAILED"

    monkeypatch.setattr(mcp_server, "_tts_once", _tts_once)
    monkeypatch.setattr(mcp_server, "_persist_audio_to_disk", _persist_fail)

    out = await mcp_server._tool_voice_tts(
        {"text": "你好", "save_path": str(tmp_path / "out.mp3")}
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "WRITE_FAILED", out
    assert out["saved_path"] is None


async def test_voice_tts_valid_save_path_still_persists(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """正向:合法 save_path 仍真的落盘(不把闸改成一律拒绝)。"""
    _allow_roots(monkeypatch, tmp_path)
    target = tmp_path / "ok.mp3"

    async def _tts_once(eng, text, args):
        return b"audio-bytes", "audio/mpeg", "v", "p", None

    monkeypatch.setattr(mcp_server, "_tts_once", _tts_once)

    out = await mcp_server._tool_voice_tts({"text": "你好", "save_path": str(target)})
    assert out["ok"] is True, out
    assert out["saved_path"] == str(target), out
    assert target.read_bytes() == b"audio-bytes"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
