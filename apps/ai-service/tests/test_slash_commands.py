"""slash_commands.py 单元测试:12 个 slash 命令 + SlashCommandRegistry。

测试覆盖:
- 注册表:list/get(存在与不存在)/execute(未知命令)
- 12 个命令的成功路径 + 边界 + 错误用法
- /memory /clear /status 命令依赖 memory_store / agent_executor,需清理状态避免相互污染
"""

from __future__ import annotations

import pytest

from app.services.slash_commands import (
    SlashCommand,
    SlashCommandRegistry,
    slash_command_registry,
    _BUILTIN_COMMANDS,
)
from app.services.memory import memory_store


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 使用内存模式(测试环境无 Redis)。

    config.py 默认 redis_url,全局 memory_store 构造时 _use_redis=True,
    首次 _get_redis 会尝试连接 Redis 并超时。测试前强制降级为内存模式。
    """
    memory_store._use_redis = False
    memory_store._redis = None
    yield
    # 恢复:保持内存模式,避免影响后续测试
    memory_store._use_redis = False
    memory_store._redis = None


# =============================================================================
# 注册表基础
# =============================================================================

def test_builtin_commands_count():
    """预置 12 个 slash 命令。"""
    assert len(_BUILTIN_COMMANDS) == 12


def test_registry_list_returns_all():
    """list 返回全部 12 个命令。"""
    cmds = slash_command_registry.list()
    assert len(cmds) == 12


def test_registry_get_existing():
    """get 已存在命令返回 SlashCommand。"""
    cmd = slash_command_registry.get("help")
    assert isinstance(cmd, SlashCommand)
    assert cmd.name == "help"
    assert cmd.description


def test_registry_get_unknown_returns_none():
    """get 不存在命令返回 None。"""
    assert slash_command_registry.get("nonexistent") is None


def test_registry_list_returns_copy():
    """list 返回的列表是副本,修改不影响内部状态。"""
    lst = slash_command_registry.list()
    lst.clear()
    assert len(slash_command_registry.list()) == 12


@pytest.mark.parametrize(
    "name",
    ["goal", "loop", "skill", "plan", "memory", "persona",
     "help", "clear", "bug", "improve", "status", "version"],
)
def test_all_builtin_commands_present(name):
    """12 个命令全部可查询。"""
    assert slash_command_registry.get(name) is not None


def test_registry_independent_instance():
    """SlashCommandRegistry 独立实例不共享状态。"""
    r = SlashCommandRegistry()
    assert r.get("help") is not None
    assert len(r.list()) == 12


# =============================================================================
# /goal
# =============================================================================

async def test_goal_with_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("goal", ["完成", "迁移"], ctx)
    assert "完成" in out and "迁移" in out
    assert ctx["goal"] == "完成 迁移"


async def test_goal_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("goal", [], ctx)
    assert "未指定目标" in out
    assert ctx["goal"] == "(未指定目标)"


# =============================================================================
# /loop
# =============================================================================

async def test_loop_on():
    ctx: dict = {}
    out = await slash_command_registry.execute("loop", ["on"], ctx)
    assert "开启" in out
    assert ctx["loop_mode"] is True


async def test_loop_off():
    ctx: dict = {}
    out = await slash_command_registry.execute("loop", ["off"], ctx)
    assert "关闭" in out
    assert ctx["loop_mode"] is False


async def test_loop_numeric_iterations():
    ctx: dict = {}
    out = await slash_command_registry.execute("loop", ["5"], ctx)
    assert "5" in out
    assert ctx["max_iterations"] == 5


async def test_loop_invalid_arg():
    ctx: dict = {}
    out = await slash_command_registry.execute("loop", ["xyz"], ctx)
    assert "未知参数" in out


async def test_loop_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("loop", [], ctx)
    assert "用法" in out


# =============================================================================
# /skill
# =============================================================================

async def test_skill_list():
    ctx: dict = {}
    out = await slash_command_registry.execute("skill", [], ctx)
    assert "code-review" in out
    assert "可用 skill" in out


async def test_skill_select_existing():
    ctx: dict = {}
    out = await slash_command_registry.execute("skill", ["debug-fix"], ctx)
    assert "debug-fix" in out
    assert ctx["current_skill"] == "debug-fix"


async def test_skill_select_unknown():
    ctx: dict = {}
    out = await slash_command_registry.execute("skill", ["nonexistent"], ctx)
    assert "未找到" in out


# =============================================================================
# /plan
# =============================================================================

async def test_plan_with_task():
    ctx: dict = {}
    out = await slash_command_registry.execute("plan", ["实现", "登录"], ctx)
    assert "实现 登录" in out
    assert "需求分析" in out


async def test_plan_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("plan", [], ctx)
    assert "未指定任务" in out


# =============================================================================
# /persona
# =============================================================================

async def test_persona_select_existing():
    ctx: dict = {}
    out = await slash_command_registry.execute("persona", ["developer"], ctx)
    assert "developer" in out
    assert "全栈开发" in ctx["persona"]


async def test_persona_unknown():
    ctx: dict = {}
    out = await slash_command_registry.execute("persona", ["alien"], ctx)
    assert "未知人设" in out


async def test_persona_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("persona", [], ctx)
    assert "用法" in out


# =============================================================================
# /help
# =============================================================================

async def test_help_lists_all_commands():
    ctx: dict = {}
    out = await slash_command_registry.execute("help", [], ctx)
    # /help 输出包含 12 个命令名
    for name in ["goal", "loop", "skill", "plan", "memory", "persona",
                 "help", "clear", "bug", "improve", "status", "version"]:
        assert name in out, f"/help 输出缺少 {name}"


# =============================================================================
# /version
# =============================================================================

async def test_version_output():
    ctx: dict = {}
    out = await slash_command_registry.execute("version", [], ctx)
    assert "IHUI AI Service" in out
    assert "FastAPI" in out


# =============================================================================
# /bug
# =============================================================================

async def test_bug_with_description():
    ctx: dict = {}
    out = await slash_command_registry.execute("bug", ["登录失败"], ctx)
    assert "登录失败" in out
    assert "复现" in out


async def test_bug_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("bug", [], ctx)
    assert "未描述" in out


# =============================================================================
# /improve
# =============================================================================

async def test_improve_with_target():
    ctx: dict = {}
    out = await slash_command_registry.execute("improve", ["API", "层"], ctx)
    assert "API 层" in out
    assert "代码质量" in out


async def test_improve_without_args():
    ctx: dict = {}
    out = await slash_command_registry.execute("improve", [], ctx)
    assert "当前会话内容" in out


# =============================================================================
# /memory (依赖 memory_store,每个测试用独立 session_id)
# =============================================================================

@pytest.fixture
def memory_session():
    """每个 /memory 测试用例使用独立 session_id 并在结束时清理。"""
    sid = "test-slash-memory"
    yield sid
    # 清理:同步函数中无法 await,在测试体内清理


async def test_memory_empty_session():
    sid = "test-mem-empty"
    try:
        ctx = {"session_id": sid}
        out = await slash_command_registry.execute("memory", [], ctx)
        assert "无记忆" in out
    finally:
        await memory_store.clear(sid)


async def test_memory_view_messages():
    sid = "test-mem-view"
    try:
        await memory_store.add(sid, "user", "hello")
        await memory_store.add(sid, "assistant", "hi there")
        ctx = {"session_id": sid}
        out = await slash_command_registry.execute("memory", [], ctx)
        assert "hello" in out
        assert "hi there" in out
        assert "2 条记忆" in out
    finally:
        await memory_store.clear(sid)


async def test_memory_clear_subcommand():
    sid = "test-mem-clear"
    try:
        await memory_store.add(sid, "user", "msg")
        ctx = {"session_id": sid}
        out = await slash_command_registry.execute("memory", ["clear"], ctx)
        assert "清除" in out
        assert await memory_store.get(sid) == []
    finally:
        await memory_store.clear(sid)


async def test_memory_list_subcommand():
    sid = "test-mem-list"
    try:
        await memory_store.add(sid, "user", "msg")
        ctx = {"session_id": sid}
        out = await slash_command_registry.execute("memory", ["list"], ctx)
        assert sid in out
    finally:
        await memory_store.clear(sid)


async def test_memory_unknown_subcommand():
    sid = "test-mem-unknown"
    try:
        ctx = {"session_id": sid}
        out = await slash_command_registry.execute("memory", ["unknown"], ctx)
        assert "未知子命令" in out
    finally:
        await memory_store.clear(sid)


# =============================================================================
# /clear (依赖 memory_store)
# =============================================================================

async def test_clear_removes_session_and_context():
    sid = "test-clear"
    try:
        await memory_store.add(sid, "user", "msg")
        ctx = {"session_id": sid, "goal": "xxx", "custom": "data"}
        out = await slash_command_registry.execute("clear", [], ctx)
        assert "清除" in out
        assert await memory_store.get(sid) == []
        # /clear 同时清空 ctx
        assert ctx == {}
    finally:
        await memory_store.clear(sid)


# =============================================================================
# /status (依赖 agent_executor 全局状态)
# =============================================================================

async def test_status_no_running_tasks():
    ctx: dict = {}
    out = await slash_command_registry.execute("status", [], ctx)
    assert "Agent 状态" in out
    assert "运行中任务数" in out


# =============================================================================
# execute 通用行为
# =============================================================================

async def test_execute_unknown_command_returns_error_message():
    ctx: dict = {}
    out = await slash_command_registry.execute("nonexistent", [], ctx)
    assert "未知命令" in out
    assert "help" in out  # 提示可用命令


async def test_execute_defaults_args_and_ctx():
    """execute 不传 args/ctx 时使用默认值(空列表/空 dict),不报错。"""
    out = await slash_command_registry.execute("help")
    assert "可用命令" in out


async def test_execute_goal_default_ctx_isolated():
    """execute 传入空 ctx 时 goal 写入该 ctx,不影响全局。"""
    ctx: dict = {}
    await slash_command_registry.execute("goal", ["task"], ctx)
    assert ctx == {"goal": "task"}
