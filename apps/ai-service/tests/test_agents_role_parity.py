# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #47 第二格 · agents 主链的角色过桥(行为 + 结构双向锁)。

改前实测:`app/routers/agents.py` 全文 **零** 处读 `request.state.role_id` —— 两条主执行链
(execute/stream 与 resume)构造 AgentLoopV2 与装配工具时都不带角色,`call_tool` 于是按形参
默认 `user_role=0` 走,管理员经 `/api/agents/*` 永远拿不到 `_ADMIN_ONLY_TOOLS` 里的能力
(`run_command` / `write_file` / `file_edit` / `git_operations` …)。这与"引擎自带工具完全
绕开矩阵"是同一个洞的两半:一头把管理员降成平民,一头把平民当管理员。

本文件不重复 engine 侧那套判据(在 `tests/test_engine_role_parity.py`),只钉 agents 链:
① 角色取值的唯一出口 fail-closed;② 真把角色透传进了工具执行器;③ 构造点结构锁
(漏传即红),并带一条**反向对照**证明这把尺子真的会红。
"""

from __future__ import annotations

import inspect
import re
from pathlib import Path
from typing import Any

import pytest

from app.core import jwt_auth
from app.routers import agents as agents_router

ROUTERS = Path(agents_router.__file__)


class _FakeState:
    def __init__(self, **kw: object) -> None:
        for k, v in kw.items():
            setattr(self, k, v)


class _FakeRequest:
    def __init__(self, **state: object) -> None:
        self.state = _FakeState(**state)


# ---------------------------------------------------------------- ① 取值出口
@pytest.mark.parametrize(
    ("state", "expected"),
    [
        ({}, 0),  # 中间件没注入(白名单命中/未鉴权)→ 普通用户
        ({"role_id": 0}, 0),
        ({"role_id": 1}, 1),
        ({"role_id": 7}, 7),
        ({"role_id": -5}, 0),  # 负数归最低档,不变成"无限制"
        ({"role_id": None}, 0),
        ({"role_id": "1"}, 0),  # 非 int 不放行(自报字符串不得提权)
        ({"role_id": True}, 0),  # bool 是 int 子类,显式排除
    ],
)
def test_resolve_request_role_id_is_fail_closed(state: dict[str, object], expected: int) -> None:
    assert jwt_auth.resolve_request_role_id(_FakeRequest(**state)) == expected  # type: ignore[arg-type]


# ---------------------------------------------------------------- ② 真透传进执行器
@pytest.mark.asyncio
async def test_build_loop_v2_tools_passes_role_into_call_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """装配出来的执行器必须带上调用者角色 —— 这是"admin 拿得到 run_command"的唯一通道。"""
    from app.services import mcp_server as mcp_mod

    seen: list[tuple[str, int]] = []

    async def spy_call_tool(
        name: str, args: dict[str, Any], *, user_role: int = 0
    ) -> dict[str, Any]:
        seen.append((name, user_role))
        return {"ok": True, "name": name}

    # 关掉超级工具聚合支路,走内置清单装配(与无外部 MCP server 时的产线形态一致)
    async def no_pool(_tool_names: object) -> None:
        return None

    monkeypatch.setattr(agents_router, "_build_supertool_pool", no_pool)
    monkeypatch.setattr(mcp_mod.mcp_server, "call_tool", spy_call_tool)

    tools = await agents_router._build_loop_v2_tools(["run_command"], user_role=1)
    # deferral 开启时会强制并入 get_tool_schema(与本票无关的既有行为),所以判"含"不判"等值"
    assert "run_command" in [t.name for t in tools]
    by_name = {t.name: t for t in tools}
    await by_name["run_command"].executor({"command": "true"})
    assert seen == [("run_command", 1)], "角色没透传到 call_tool ⇒ admin 仍会被权限矩阵误拒"

    seen.clear()
    tools_default = await agents_router._build_loop_v2_tools(["run_command"])
    by_name2 = {t.name: t for t in tools_default}
    await by_name2["run_command"].executor({"command": "true"})
    assert seen == [("run_command", 0)], "缺省必须是 0(fail-closed),不能是「不判」"


# ---------------------------------------------------------------- ③ 构造点结构锁
def _loop_call_sites_from_source(src: str) -> list[str]:
    """用 AST 取每个 `AgentLoopV2(...)` **代码**调用点及其源码片段。

    为什么走 AST 而不是正则扫文本:本文件自己第一次就被打了脸 —— `agents.py` 的散文里
    写着「默认启用 AgentLoopV2(完整 ReAct 循环 + checkpoint 续跑…」,正则把它读成第二个
    构造点,于是这把尺子量的是注释不是代码。仓库铁律「凡从源码抽字面量必剥注释」的同型。
    """
    import ast

    tree = ast.parse(src)
    out: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            fn = node.func
            name = fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", "")
            if name == "AgentLoopV2":
                seg = ast.get_source_segment(src, node)
                if seg is not None:
                    out.append(seg)
    return out


def _loop_call_sites(path: Path) -> list[str]:
    return _loop_call_sites_from_source(path.read_text(encoding="utf-8"))


def test_every_agent_loop_construction_threads_role() -> None:
    """agents.py / engine.py 里每个 AgentLoopV2 构造点都必须带 user_role=…

    反向对照在下面那条:同一个尺子喂一段"漏传角色"的代码必须报违规 —— 否则本断言
    可能只是"尺子根本没找到构造点"。
    """
    sites = _loop_call_sites(ROUTERS)
    assert len(sites) >= 2, f"只找到 {len(sites)} 个构造点,尺子大概失效了"
    for call in sites:
        assert "user_role=" in call, f"AgentLoopV2 构造点漏传角色:\n{call[:200]}"

    engine_sites = _loop_call_sites(ROUTERS.parent / "engine.py")
    assert len(engine_sites) >= 1, "engine.py 没找到构造点"
    for call in engine_sites:
        assert "user_role=" in call, f"engine 的 AgentLoopV2 构造点漏传角色:\n{call[:200]}"


def test_ruler_actually_detects_a_missing_role() -> None:
    """负向对照:把构造点改成不带 user_role,同一把尺子必须判它违规。

    同时钉住"散文里的 AgentLoopV2( 不算构造点"—— 那是我第一版真实踩到的假阳。
    """
    broken = 'loop = AgentLoopV2(llm, tools=await _build_loop_v2_tools(req.tools), user_id="u")\n'
    sites = _loop_call_sites_from_source(broken)
    assert len(sites) == 1
    assert all("user_role=" not in c for c in sites), "反向对照失效:尺子根本没在判东西"

    prose = "# 默认启用 AgentLoopV2(完整 ReAct 循环 + checkpoint 续跑)。\n"
    assert _loop_call_sites_from_source(prose) == [], "散文里的名字被当成构造点 = 尺子在量注释"


def test_agents_router_reads_role_only_via_single_exit() -> None:
    """角色读取必须走 `resolve_request_role_id` 唯一出口,不得就地 `int(getattr(...))`。

    本仓已三次栽在"同一个值各处现抄":抄漏一处就是把管理员静默降级。
    """
    src = ROUTERS.read_text(encoding="utf-8")
    assert "resolve_request_role_id(" in src
    assert 'getattr(request.state, "role_id"' not in src, "在端点里现抄角色读取 = 第二个真相源"


def test_exit_defined_once_across_the_app() -> None:
    """`resolve_request_role_id` 全 app 只允许一处定义。"""
    app_root = ROUTERS.parents[1]
    pattern = re.compile(r"^def resolve_request_role_id", re.M)
    hits = [
        p.relative_to(app_root).as_posix()
        for p in app_root.rglob("*.py")
        if pattern.search(p.read_text(encoding="utf-8"))
    ]
    assert hits == ["core/jwt_auth.py"], f"角色出口出现多个定义: {hits}"


def test_plan_execution_stays_least_privilege() -> None:
    """异步计划执行**故意**保持 role 0(无请求上下文),这条锁住"别靠伪造 role=1 放开"。

    放开它需要把批准人角色落到 plan 记录上(数据面改造),不是在执行处拍一个 1。
    """
    src = (ROUTERS.parent / "agent_plan.py").read_text(encoding="utf-8")
    loop_calls = _loop_call_sites_from_source(src)
    assert len(loop_calls) >= 1
    assert all("user_role=" not in c for c in loop_calls), (
        "agent_plan 的循环若开始自带 user_role=,必须同时证明它取的是**批准人**的角色,"
        "而不是硬编码 1 —— 见该文件 _execute_plan 的注释。"
    )
    assert "最小权限" in src or "least privilege" in src.lower(), "该处的刻意保守必须写明理由"


def test_signature_of_resume_endpoint_exposes_request() -> None:
    """resume 端点必须能看见 request(否则角色无从取)。"""
    sig = inspect.signature(agents_router.resume_agent_execute)
    assert "request" in sig.parameters


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
