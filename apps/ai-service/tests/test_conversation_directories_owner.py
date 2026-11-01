# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""会话附加目录端点:必须带主体 + 必须落在允许根内(2026-11-01 安全强化,严重)。

原缺陷:`POST /llm/conversations/{conversation_id}/directories` 无任何鉴权,而
`conversation_id` 在对话链里就是客户端自报的 `metadata.conversationId` ——
`{"paths":["/"]}` 即可把任意会话的工具根变成整盘,`read_file` 随后按
`relative_to(root)` 放行 `/proc/self/environ` 与其他租户目录。

本文件钉三件事(每条都带"摘闸即红"的方向):
① 无主体 ⇒ 401(依赖被摘掉时这条会直接不抛);
② 登记键含主体 ⇒ 别的用户读不到;
③ 目录必须落在允许根内,系统根一律拒。
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.config import settings
from app.routers.llm import post_conversation_directories
from app.services import mcp_server

TEST_SECRET = "conversation-directories-owner-secret"


def _request(user_id: str | None = None) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "path": "/api/llm/conversations/x/directories",
        "raw_path": b"/api/llm/conversations/x/directories",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    req = Request(scope)
    if user_id:
        req.state.user_id = user_id
    return req


@pytest.fixture()
def enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """关掉 conftest 的开发放行(AI_DEV_NO_AUTH):本文件要的是"真鉴权"语义。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)


async def test_endpoint_rejects_anonymous_caller(enforce_jwt: None) -> None:
    """无已验签主体 ⇒ 401。

    变异方向:把 `require_request_user_id(request)` 那行摘掉(回到"谁都能登记"),
    本用例会直接不抛异常 ⇒ 红。
    """
    with pytest.raises(HTTPException) as exc:
        await post_conversation_directories("conv-1", _request(), {"paths": []})
    assert exc.value.status_code == 401


async def test_registration_is_scoped_to_authenticated_owner(
    enforce_jwt: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """登记表键 = (主体, 会话):本人读得到,他人读不到。"""
    docs = tmp_path / "docs"
    docs.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))

    out = await post_conversation_directories(
        "conv-owner", _request("alice"), {"paths": [str(docs)]}
    )
    assert out["ok"] is True
    assert out["additionalDirectories"] == [str(docs.resolve())]

    # 正向:本人按 (alice, conv) 读得到 —— 变异成"只按会话登记"时这里仍然是 (),
    # 因为端点会把主体传进 set_session_extra_roots;本断言锁住那条传递。
    assert mcp_server.get_session_extra_roots("conv-owner", user_id="alice") == (
        str(docs.resolve()),
    )
    # 反向:同一会话 id、不同主体 ⇒ 读不到
    assert mcp_server.get_session_extra_roots("conv-owner", user_id="bob") == ()

    mcp_server.clear_session_extra_roots("conv-owner", user_id="alice")


async def test_other_user_cannot_reach_the_registered_directory(
    enforce_jwt: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A 登记的附加目录不得成为 B 的可读面(旧实现:会话 id 相同即共享)。"""
    docs = tmp_path / "docs"
    docs.mkdir()
    secret = docs / "secret.txt"
    secret.write_text("only-alice", encoding="utf-8")
    # 工具根与登记允许根分开:MCP 根里没有 docs,只有 IHUI 登记根覆盖到它 ⇒
    # 能否读到 docs 完全取决于"谁登记的"这一维(否则进程白名单会替我们把用例判绿)。
    tool_root = tmp_path / "ws"
    tool_root.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tool_root))
    monkeypatch.setenv("IHUI_WORKSPACE_ROOTS", str(tmp_path))

    await post_conversation_directories("conv-x", _request("alice"), {"paths": [str(docs)]})

    ok_alice, _ = mcp_server._validate_path_in_workspace(
        str(secret), extra_roots=mcp_server.get_session_extra_roots("conv-x", user_id="alice")
    )
    ok_bob, _ = mcp_server._validate_path_in_workspace(
        str(secret), extra_roots=mcp_server.get_session_extra_roots("conv-x", user_id="bob")
    )
    assert ok_alice is True
    assert ok_bob is False, "跨主体共享附加根 ⇒ 旧漏洞原样复活"

    mcp_server.clear_session_extra_roots("conv-x", user_id="alice")


async def test_endpoint_rejects_filesystem_root(
    enforce_jwt: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`/`(以及本机盘符根)一律拒 —— 判定对象是 resolve 之后的路径。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", os.getcwd())
    root = os.path.abspath(os.sep)  # POSIX "/" / Windows 当前盘符根
    resp = await post_conversation_directories("conv-root", _request("alice"), {"paths": [root]})
    assert getattr(resp, "status_code", None) == 422
    body = resp.body.decode("utf-8")
    assert "系统根" in body or "允许根" in body


async def test_endpoint_rejects_directory_outside_allowed_roots(
    enforce_jwt: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """不在任何允许根内的目录(这里是 pytest 临时目录)⇒ 422。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", os.getcwd())
    outside = tmp_path / "outside"
    outside.mkdir()
    resp = await post_conversation_directories(
        "conv-out", _request("alice"), {"paths": [str(outside)]}
    )
    assert getattr(resp, "status_code", None) == 422
    assert "允许根" in resp.body.decode("utf-8")


async def test_endpoint_accepts_directory_inside_allowed_root(
    enforce_jwt: None, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """正向对照:允许根之内的子目录照常可选(闸不是"一律拒")。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    inside = tmp_path / "sub"
    inside.mkdir()
    out = await post_conversation_directories(
        "conv-in", _request("alice"), {"paths": [str(inside)]}
    )
    assert out["ok"] is True and out["additionalDirectories"] == [str(inside.resolve())]
    mcp_server.clear_session_extra_roots("conv-in", user_id="alice")


def test_extra_directory_helper_rejects_symlink_into_system_dir(tmp_path: Path) -> None:
    """符号链接指向系统目录 ⇒ resolve 之后按目标判,仍拒(不是只看链接名)。"""
    link = tmp_path / "innocent"
    try:
        link.symlink_to(Path(os.sep), target_is_directory=True)
    except (OSError, NotImplementedError):  # pragma: no cover - 无符号链接权限的机器
        pytest.skip("本机不允许创建符号链接")
    ok, reason = mcp_server._validate_extra_directory(str(link), allowed_roots=[str(tmp_path)])
    assert ok is False
    assert "系统根" in reason
