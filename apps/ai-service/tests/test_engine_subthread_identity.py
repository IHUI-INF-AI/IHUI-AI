# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""派生子线程必须继承**承载层盖章过**的身份(G-742,2026-09-29 立)。

引擎里有两处会**自己新造 params** 再去 `_handle_thread_start`:

- `_handle_thread_review`(审查模式)
- 内置工具 `spawn_subagent`(子代理)

两处此前只带 `input` / `permissionMode` / `maxIterations` / `model`,**没有 `userId`**。
而 `_handle_thread_start` 认的主体只可能是 `params["userId"]`(承载层
`routers/engine.py::_bind_principal` 写进去的那个),拿不到就是 `None` ⇒ 派生出一条
既无内存属主也无落库属主的线程。`_principal_allows` 对"无属主"的语义是
"**无从对账 ⇒ 维持改动前行为**"(它自己的注释明写这不是授权结论),于是后果是:
任何已登录连接都能往别人那条正在跑的派生线程里 prompt / 结算审批。
外层报文带没带主体都救不了这一格 —— 身份是在这一次内部构造里丢的。

判据读的是**交给主循环工厂的那份 spec 里的 `user_id`**:两条派生路径都是
"跑完即弃内存"(store 留痕),所以事后去 `engine._threads` 找那条线程是找不到的 ——
而 `_spec(thread)` 里的 `user_id` 同时决定这条线程的记忆归属、审批登记属主与重启后的
可见性,是真正会落库的那一份。

四条:
1. `spawn_subagent` 派生的那次运行带父线程主体;
2. 模型/客户端在 args 里塞 `userId` **不能**决定属主(身份是宿主事实);
3. 父线程本来就无主体时,派生运行也只能无主体 —— 反向对照,防有人把修法做成"给个默认属主";
4. `_handle_thread_review` 那条路径同测一次(两处各写各的,才会只修一处)。

全程假 loop,不发网络、不连数据库、不起 Redis。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine

#: 被审文件(形状锁读源码面,不读内存态)
ENGINE_FILE = Path(__file__).resolve().parent.parent / "app" / "services" / "agent_engine.py"

ALICE = "alice"
BOB = "bob"


@dataclass
class _FakeResult:
    final_response: str = "回答"
    stop_reason: str = "completed"
    total_tokens_used: int = 1
    messages: list[dict[str, Any]] = field(default_factory=list)


class _FakeLoop:
    """最小主循环替身:把工厂收到的 spec 留下,供判据直接读。"""

    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> _FakeResult:
        return _FakeResult()

    async def resume(self, *args: Any, **kwargs: Any) -> _FakeResult:
        return _FakeResult()

    async def cancel(self) -> str:
        return "cancelled"

    async def pause(self) -> str:
        return "paused"


def _engine() -> tuple[AgentEngine, list[_FakeLoop]]:
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    return AgentEngine(loop_factory=factory), loops


async def _start(engine: AgentEngine, principal: str | None) -> str:
    params: dict[str, Any] = {"input": "开工"}
    if principal is not None:
        # 生产里这个键只由承载层写(`_bind_principal` 用令牌主体覆盖客户端自报值)
        params["userId"] = principal
    resp = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": params}
    )
    assert resp is not None and "error" not in resp, resp
    return str(resp["result"]["threadId"])


async def _noop(_payload: dict[str, Any]) -> None:
    return None


def _derived_spec(loops: list[_FakeLoop], known: set[Any]) -> dict[str, Any]:
    """取"本次调用新起的那一次运行"的 spec。

    派生线程跑完即弃内存(`engine._threads` 里事后找不到),而 `thread.start` 又不会跑循环
    —— 所以不能按"第几次运行"数,只能按 spec 里的 `thread_id` 减去调用前已知的那批。
    """
    fresh = [l.spec for l in loops if l.spec.get("thread_id") not in known]
    assert len(fresh) == 1, (
        f"应恰好发生一次派生运行,实得 {len(fresh)}:"
        f"{[s.get('thread_id') for s in fresh]}"
    )
    return fresh[0]


def _known(loops: list[_FakeLoop]) -> set[Any]:
    return {l.spec.get("thread_id") for l in loops}


@pytest.mark.asyncio
async def test_spawn_subagent_derived_run_keeps_owner() -> None:
    engine, loops = _engine()
    tid = await _start(engine, ALICE)
    parent = engine._threads[tid]
    known = _known(loops)

    out = await engine._spawn_subagent_tool(parent).executor({"prompt": "替我查一下"})
    assert "error" not in str(out)[:60].lower(), out

    spec = _derived_spec(loops, known)
    assert spec.get("user_id") == ALICE, (
        "派生的子线程无属主 ⇒ `_principal_allows` 按'无从对账'放过,"
        "任何已登录连接都能接着用它 prompt / 结算它的审批"
    )


@pytest.mark.asyncio
async def test_spawn_subagent_ignores_identity_supplied_in_args() -> None:
    """args 里塞 `userId` 不得改变属主 —— 身份是宿主事实,不是模型可填的参数。"""
    engine, loops = _engine()
    tid = await _start(engine, ALICE)
    parent = engine._threads[tid]
    known = _known(loops)

    await engine._spawn_subagent_tool(parent).executor(
        {"prompt": "替我查一下", "userId": BOB}
    )

    spec = _derived_spec(loops, known)
    assert spec.get("user_id") == ALICE, f"模型自报的身份赢了承载层:{spec.get('user_id')!r}"


@pytest.mark.asyncio
async def test_spawn_from_unowned_parent_stays_unowned() -> None:
    """反向对照:父线程本来无主体 ⇒ 派生运行也只能无主体,不得凭空造一个身份。

    这条防的是把修法做成"给个默认属主 / 取第一个看着像的人" —— 那是把漏传换成伪造,
    比原缺陷更响(伪造的属主会同时骗过审计与恢复侧)。
    """
    engine, loops = _engine()
    tid = await _start(engine, None)
    parent = engine._threads[tid]
    known = _known(loops)
    assert parent.user_id is None, "夹具前提:父线程应无主体"

    await engine._spawn_subagent_tool(parent).executor({"prompt": "替我查一下"})

    spec = _derived_spec(loops, known)
    assert spec.get("user_id") is None, f"派生运行凭空长出属主:{spec.get('user_id')!r}"


@pytest.mark.asyncio
async def test_thread_review_derived_run_keeps_owner() -> None:
    """审查模式那条路同一形状,单独测一次 —— 两处各写各的,才会只修其中一处。"""
    engine, loops = _engine()
    tid = await _start(engine, ALICE)
    known = _known(loops)

    await engine._handle_thread_review({"threadId": tid, "focus": "看有没有漏"}, _noop)

    spec = _derived_spec(loops, known)
    assert spec.get("user_id") == ALICE, "审查子线程无属主(与 spawn 同一格,独立站点)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# =============================================================================
# 常驻形状锁:派生点的身份继承不得被"顺手新造一份 params"绕过
# =============================================================================


def test_every_fresh_sub_params_carries_identity() -> None:
    """凡"自己新造 dict 再喂 `_handle_thread_start`"的地方,必须带 `_identity_of(thread)`。

    为什么要有这条形状锁而不是只测行为:G-742 这一族有两个站点(`_handle_thread_review`
    与 `spawn_subagent`),两处各写各的 —— 只修一处时行为测试仍然只盯到自己那一条路径,
    第二处可以悄无声息地留着。形状锁问的是"还有没有第三个不带身份的派生点",
    它不依赖我想到哪几个函数。

    只走 `_handle_thread_start(params, …)` 那一种(承载层已绑过主体)是合法的,所以判据
    只约束**新造字面量 dict** 的那些站点:每个 `sub_params: dict[str, Any] = {…}` 块
    必须含 `**_identity_of(`。站点数与"带身份的块数"必须相等,少一个即红。
    """
    src = ENGINE_FILE.read_text(encoding="utf-8")
    sites = src.count("_handle_thread_start(") - src.count("async def _handle_thread_start(")
    built = src.count("sub_params: dict[str, Any] = {")
    carried = src.count("**_identity_of(thread)")
    assert sites == 3, f"派生入口数与本判据的既有口径不等(sites={sites}):需要重新判一次,不是顺手改数"
    assert built == carried, (
        f"有 {built} 处新造 sub_params 却只有 {carried} 处继承身份 ⇒ 新增的派生点在铸无属主线程"
    )
