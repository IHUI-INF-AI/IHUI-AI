# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Qoder 能力对齐 · Skill 工具 + allowed-tools 会话授权。

钉住的行为(不是实现细节):

1. ``skill`` 工具能按名返回 SKILL.md 指令正文(渐进披露),而不是把全部技能塞进系统提示;
2. ``allowed-tools`` 是**授权**,不是限制(Qoder 原文见 skill_scope.py 头注):
   名单内工具在本会话免走高危审批,**名单外工具照常可用**(不会被拒);
3. 授权按 (user_id, session_id) 隔离,别的会话不受影响;
4. 别名工具名也能命中授权(``read`` 声明 ⇒ ``read_file`` 获授权);
5. 未声明 allowed-tools 的技能不产生任何授权(默认零行为差异);
6. 授权**不越过硬边界**:普通用户即使拿到 write_file 授权,角色矩阵仍先给
   PERMISSION_DENIED(授权只跳过审批,不扩权)。
"""

from __future__ import annotations

import pytest

import app.services.mcp_server as mcp_mod
from app.services import skill_scope
from app.services.session_todo import todo_board
from app.services.skills import Skill, SkillRegistry

_DEMO = Skill(
    name="scope-demo",
    description="演示用只读技能",
    prompt_template="按 {target} 只读调查,不要写文件。",
    allowed_tools=("read_file", "list_files"),
)


@pytest.fixture(autouse=True)
def _isolate_state():
    skill_scope.reset_scopes_for_tests()
    todo_board.reset()
    yield
    skill_scope.reset_scopes_for_tests()
    todo_board.reset()


@pytest.fixture
def demo_skill(monkeypatch):
    monkeypatch.setattr(
        mcp_mod.skill_registry, "get", lambda name: _DEMO if name == _DEMO.name else None
    )
    return _DEMO


def test_parse_allowed_tools_handles_specifiers_and_commas():
    """``Bash(git add, git commit)`` 不能按逗号切碎;``(*)`` 后缀要剥掉。"""
    parsed = skill_scope.parse_allowed_tools(
        "Read, Grep, Bash(git add, git commit), Write(*)"
    )
    assert parsed == ("Read", "Grep", "Bash", "Write")


def test_parse_allowed_tools_dedupes_case_insensitively():
    assert skill_scope.parse_allowed_tools("Read, read, READ") == ("Read",)


def test_parse_allowed_tools_empty_means_no_grant():
    assert skill_scope.parse_allowed_tools("") == ()
    assert skill_scope.parse_allowed_tools(None) == ()


def test_builtin_skill_default_has_no_allowed_tools():
    """内置技能不声明工具范围 ⇒ 接线前后零行为差异。"""
    assert Skill(name="x", description="d", prompt_template="p").allowed_tools == ()


def test_registry_reads_allowed_tools_from_skill_md(tmp_path, monkeypatch):
    """SKILL.md 的 allowed-tools 真正进入运行期(此前只在 extra 里躺着)。"""
    (tmp_path / "scoped.md").write_text(
        "---\n"
        "name: scoped-demo\n"
        "description: 只读技能\n"
        "allowed-tools: read_file, list_files\n"
        "---\n"
        "按用户给定的路径只读调查。\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("IHUI_SKILL_SCAN_ROOTS", str(tmp_path))
    registry = SkillRegistry()
    skill = registry.get("scoped-demo")
    assert skill is not None, registry.list_skills()
    assert skill.allowed_tools == ("read_file", "list_files")


def test_scope_grant_rules_pure():
    """纯判据:名单内授权、名单外不授权;空名单不授权任何工具。"""
    scope = skill_scope.SkillScope(
        skill="s", allowed=("read_file",), activated_at=0.0, expires_at=10.0
    )
    assert scope.grants("read_file") is True
    assert scope.grants("READ_FILE") is True
    assert scope.grants("write_file") is False

    empty = skill_scope.SkillScope(
        skill="s", allowed=(), activated_at=0.0, expires_at=10.0
    )
    assert empty.grants("read_file") is False


def test_activate_scope_requires_session():
    """没有 session 就不落授权 —— 宁可"不免审批",也不能跨会话串授权。"""
    assert (
        skill_scope.activate_skill_scope(
            user_id="u", session_id="", skill="s", allowed_tools=["read_file"]
        )
        is None
    )
    assert (
        skill_scope.scope_grants(
            user_id="u", session_id="", tool_name="read_file"
        )
        is False
    )


def test_scope_expires():
    scope = skill_scope.activate_skill_scope(
        user_id="u",
        session_id="s",
        skill="demo",
        allowed_tools=["read_file"],
        ttl_seconds=10,
        now=100.0,
    )
    assert scope is not None
    assert (
        skill_scope.get_active_skill_scope(user_id="u", session_id="s", now=105.0)
        is not None
    )
    assert (
        skill_scope.get_active_skill_scope(user_id="u", session_id="s", now=111.0)
        is None
    )


@pytest.mark.asyncio
async def test_skill_tool_returns_instructions_and_registers_grant(demo_skill):
    out = await mcp_mod.mcp_server.call_tool(
        "skill",
        {"name": _DEMO.name, "arguments": {"target": "src/app.ts"}},
        user_id="u1",
        session_id="s1",
    )
    assert out["ok"] is True, out
    assert out["data"]["name"] == _DEMO.name
    assert "src/app.ts" in out["data"]["instructions"]
    assert out["data"]["scope"]["granted"] is True
    assert out["data"]["scope"]["allowedTools"] == ["read_file", "list_files"]

    assert (
        skill_scope.scope_grants(
            user_id="u1", session_id="s1", tool_name="read_file"
        )
        is True
    )
    # 名单外的工具**不会**被拒(这是"授权"而非"收窄"的关键判据)。
    assert (
        skill_scope.scope_grants(
            user_id="u1", session_id="s1", tool_name="write_file"
        )
        is False
    )
    allowed_out = await mcp_mod.mcp_server.call_tool(
        "todo_read", {}, user_id="u1", session_id="s1"
    )
    assert allowed_out["ok"] is True


@pytest.mark.asyncio
async def test_grant_does_not_bypass_role_matrix(demo_skill, monkeypatch):
    """硬边界必须仍在授权之前生效:普通用户拿到 write_file 授权也不扩权。"""
    broad = Skill(
        name="broad-demo",
        description="宽授权技能",
        prompt_template="演示",
        allowed_tools=("write_file",),
    )
    monkeypatch.setattr(
        mcp_mod.skill_registry, "get", lambda name: broad if name == broad.name else None
    )
    out = await mcp_mod.mcp_server.call_tool(
        "skill", {"name": broad.name}, user_role=0, user_id="u", session_id="s"
    )
    assert out["ok"] is True

    denied = await mcp_mod.mcp_server.call_tool(
        "write_file",
        {"path": "C:/definitely-not-writable/qoder-grant-test.txt", "content": "x"},
        user_role=0,
        user_id="u",
        session_id="s",
    )
    assert denied["ok"] is False
    assert denied["errorCode"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_grant_is_per_session(demo_skill):
    await mcp_mod.mcp_server.call_tool(
        "skill", {"name": _DEMO.name}, user_id="u1", session_id="s1"
    )
    assert (
        skill_scope.scope_grants(
            user_id="u1", session_id="s1", tool_name="read_file"
        )
        is True
    )
    assert (
        skill_scope.scope_grants(
            user_id="u1", session_id="s2", tool_name="read_file"
        )
        is False
    )


@pytest.mark.asyncio
async def test_skill_alias_cannot_miss_grant(monkeypatch):
    """声明 ``read`` ⇒ 归一成 read_file;两种写法都命中授权。"""
    alias_skill = Skill(
        name="alias-demo",
        description="别名技能",
        prompt_template="只读",
        allowed_tools=("read",),
    )
    monkeypatch.setattr(
        mcp_mod.skill_registry,
        "get",
        lambda name: alias_skill if name == alias_skill.name else None,
    )
    out = await mcp_mod.mcp_server.call_tool(
        "skill", {"name": alias_skill.name}, user_id="u", session_id="s"
    )
    assert out["ok"] is True
    assert out["data"]["scope"]["allowedTools"] == ["read_file"]
    assert (
        skill_scope.scope_grants(
            user_id="u",
            session_id="s",
            tool_name="read",
            normalize=mcp_mod._normalize_tool_name,
        )
        is True
    )
    assert (
        skill_scope.scope_grants(
            user_id="u",
            session_id="s",
            tool_name="read_file",
            normalize=mcp_mod._normalize_tool_name,
        )
        is True
    )
    assert (
        skill_scope.scope_grants(
            user_id="u",
            session_id="s",
            tool_name="write_file",
            normalize=mcp_mod._normalize_tool_name,
        )
        is False
    )


@pytest.mark.asyncio
async def test_release_lifts_grant(demo_skill):
    await mcp_mod.mcp_server.call_tool(
        "skill", {"name": _DEMO.name}, user_id="u", session_id="s"
    )
    released = await mcp_mod.mcp_server.call_tool(
        "skill", {"release": True}, user_id="u", session_id="s"
    )
    assert released["ok"] is True
    assert released["data"]["released"] is True
    assert (
        skill_scope.scope_grants(
            user_id="u", session_id="s", tool_name="read_file"
        )
        is False
    )


@pytest.mark.asyncio
async def test_skill_without_allowed_tools_does_not_grant(monkeypatch):
    plain = Skill(name="plain-demo", description="无声明", prompt_template="做点事")
    monkeypatch.setattr(
        mcp_mod.skill_registry, "get", lambda name: plain if name == plain.name else None
    )
    out = await mcp_mod.mcp_server.call_tool(
        "skill", {"name": plain.name}, user_id="u", session_id="s"
    )
    assert out["ok"] is True
    assert out["data"]["scope"]["granted"] is False
    assert (
        skill_scope.scope_grants(
            user_id="u", session_id="s", tool_name="write_file"
        )
        is False
    )


@pytest.mark.asyncio
async def test_skill_unknown_and_missing_session(demo_skill):
    missing = await mcp_mod.mcp_server.call_tool("skill", {"name": "nope"})
    # 缺 session 的 fail-closed 发生在查表之前。
    assert missing["ok"] is False
    assert missing["errorCode"] == "SESSION_REQUIRED"

    unknown = await mcp_mod.mcp_server.call_tool(
        "skill", {"name": "nope"}, user_id="u", session_id="s"
    )
    assert unknown["ok"] is False
    assert unknown["errorCode"] == "SKILL_NOT_FOUND"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
