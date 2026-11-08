# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP stdio 注册与目录一键注册的两道闸(2026-10-31 立)。

现读缺陷两条,都出在 `app/routers/mcp.py`:

① `POST /mcp/external/servers` 的 stdio 档:`command/args/env` 全由请求方给出,
   注册成功后立刻 `client.connect()` → `mcp_client.py` 里
   `create_subprocess_exec(resolved_command, *args, env=proc_env)`。
   端点只有 `require_request_user_id` 这一道身份闸,没有角色、没有可执行文件约束 ⇒
   **任一登录用户 = 服务端任意进程执行**(env 还能带解释器启动选项)。
   修法:stdio 档必须同时过"管理员角色"与"部署级可执行文件白名单"两道;白名单
   未配置时为空 ⇒ 该能力对所有人关闭(fail-closed,不以"没配"当作"放开")。

② `POST /mcp/directory/{key}/register`:`req.args[0]` 实为 filesystem 类 server 的
   工作目录载体,被 `to_client_config` 拼进 catalog 条目的 args 第三位后真按它读写文件
   ⇒ 不校验等于允许任一登录用户把服务端文件系统挂到仓根或用户目录去读 .env。
   修法:复用 `mcp_server._validate_path_in_workspace`(进程级 MCP_WORKSPACE_ROOTS
   白名单 + symlink 防护,本仓唯一一份该判据的实现),`extra_roots=()` 表示注册期
   只认进程级白名单。

成对钉法:每一档都有"应当放行"的正向对照,防止判据被改成"恒拒绝"式假绿。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.routers import mcp as mcp_router
from app.routers.mcp import (
    ExternalServerRegisterRequest,
    register_directory_server,
    register_external_server,
    stdio_command_allowed,
)


def _request_with_role(role_id: int | None) -> SimpleNamespace:
    """伪造中间件注入形态:request.state.role_id(resolve_request_role_id 的唯一读点)。"""
    state = SimpleNamespace()
    if role_id is not None:
        state.role_id = role_id
    return SimpleNamespace(state=state)


# ---------------------------------------------------------------------------
# ① 可执行文件白名单:纯判据档
# ---------------------------------------------------------------------------


def test_allowlist_unset_denies_everything(monkeypatch: pytest.MonkeyPatch) -> None:
    """未配置 ⇒ 任何 command 都不放行(含看起来人畜无害的 npx)。"""
    monkeypatch.delenv("MCP_STDIO_COMMAND_ALLOWLIST", raising=False)
    assert stdio_command_allowed("npx") is False
    assert stdio_command_allowed("") is False
    assert stdio_command_allowed("C:\\Windows\\System32\\cmd.exe") is False


def test_allowlist_matches_exact_and_basename_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MCP_STDIO_COMMAND_ALLOWLIST", "npx,C:\\tools\\node.exe")
    assert stdio_command_allowed("npx") is True
    assert stdio_command_allowed("NPX") is True  # Windows 大小写不敏感
    assert stdio_command_allowed("c:/tools/node.exe") is True
    assert stdio_command_allowed("cmd") is False
    # 前缀不得算命中:否则 "/usr/bin/py" 会命中 "/usr/bin/python" 这类清单目
    assert stdio_command_allowed("C:\\tools\\node.ex") is False
    assert stdio_command_allowed("node.exe --eval") is False


# ---------------------------------------------------------------------------
# ① 端点档:角色闸 + 白名单闸
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stdio_register_requires_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    """普通用户 + 白名单已放行 ⇒ 仍因角色不足被拒(两道闸是"与",不是一道)。"""
    monkeypatch.setenv("MCP_STDIO_COMMAND_ALLOWLIST", "npx")
    req = ExternalServerRegisterRequest(
        name="evil", transport="stdio", command="npx", args=["-y", "some-pkg"]
    )

    res = await register_external_server(
        request=_request_with_role(0), req=req, user_id="user-plain"
    )

    assert getattr(res, "status_code", None) == 403


@pytest.mark.asyncio
async def test_stdio_register_role_unjudged_denies(monkeypatch: pytest.MonkeyPatch) -> None:
    """state 里根本没有 role_id ⇒ 归一到 0 ⇒ 拒(取不到角色绝不等于放开)。"""
    monkeypatch.setenv("MCP_STDIO_COMMAND_ALLOWLIST", "npx")
    req = ExternalServerRegisterRequest(name="evil", transport="stdio", command="npx")

    res = await register_external_server(
        request=_request_with_role(None), req=req, user_id="user-plain"
    )

    assert getattr(res, "status_code", None) == 403


@pytest.mark.asyncio
async def test_stdio_register_admin_still_needs_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """管理员 + 白名单为空 ⇒ 照旧拒:白名单不是给管理员开的后门。"""
    monkeypatch.delenv("MCP_STDIO_COMMAND_ALLOWLIST", raising=False)
    req = ExternalServerRegisterRequest(name="x", transport="stdio", command="cmd")

    res = await register_external_server(
        request=_request_with_role(1), req=req, user_id="admin-1"
    )

    assert getattr(res, "status_code", None) == 403
    assert "ALLOWLIST" in res.body.decode("utf-8")


@pytest.mark.asyncio
async def test_sse_register_untouched_by_stdio_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正向对照:sse 档不经过 stdio 两道闸 ⇒ 普通用户仍能走到后面的逻辑。

    这一枚存在的意义是把"把闸门装错到所有 transport"读成红 —— 断源只针对本地进程执行面。
    """
    monkeypatch.delenv("MCP_STDIO_COMMAND_ALLOWLIST", raising=False)

    async def _boom(*_a: object, **_k: object) -> object:
        raise RuntimeError("sentinel-reached-later-stage")

    monkeypatch.setattr(mcp_router, "get_mcp_client_manager", _boom)
    req = ExternalServerRegisterRequest(
        name="sse-ok", transport="sse", url="https://example.invalid/sse"
    )

    res = await register_external_server(
        request=_request_with_role(0), req=req, user_id="user-plain"
    )

    # 走到 except 分支 ⇒ 说明没被 403 拦下(该分支把异常包成 500 文案)
    assert getattr(res, "status_code", None) != 403


# ---------------------------------------------------------------------------
# ② 目录一键注册的工作目录档
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_directory_register_rejects_path_outside_roots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", "D:\\allowed\\only")
    req = ExternalServerRegisterRequest(
        name="fs", transport="stdio", command="", args=["D:\\IHUI-AI"]
    )

    res = await register_directory_server(key="filesystem", req=req, user_id="u")

    assert getattr(res, "status_code", None) == 403
    assert "工作目录" in res.body.decode("utf-8")


@pytest.mark.asyncio
async def test_directory_register_allows_path_inside_roots(
    monkeypatch: pytest.MonkeyPatch, tmp_path: object
) -> None:
    """正向对照:白名单内的目录不被拒(判据不得被改成恒 403)。

    放行后会继续走 to_client_config;本用例只要求"不是因为工作目录被拒"。
    """
    root = str(tmp_path)  # 真实存在的目录:校验器会做 realpath 归一
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", root)
    req = ExternalServerRegisterRequest(
        name="fs", transport="stdio", command="", args=[root]
    )

    res = await register_directory_server(key="filesystem", req=req, user_id="u")

    body = res.body.decode("utf-8") if hasattr(res, "body") else str(res)
    assert "工作目录不在允许范围内" not in body
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
