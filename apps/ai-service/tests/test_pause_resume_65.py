# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #65(2026-09-28 立)pause / resume 对外出口回归测试。

覆盖五条判据,逐条对应任务书的验收项:
  ① 正常暂停后 loop **真的停在检查点**(不是"标志位设了但没人停")
  ② resume 从那个检查点**续跑**(不是从头再跑一遍)
  ③ 越权(别人的会话)被拒,且**未发出任何查询** —— 断言"没查库",不是只断 403
  ④ 重复 pause 幂等,但**与首次暂停可分辨**(守门 134 那一型:改了 0 不许回成"成功")
  ⑤ 持久层 / loop 不可用时**显式报错不静默**(503 与 404 两格不得合并)

真实 loop 用例(①②)与 HTTP 面用例(③④⑤)分开:前者证机制,后者证接线。
`agent_loop_v2.py` 本票禁止改动(有代理在飞),所以这里只**消费**它的公开契约
(`pause()` / `resume_from_checkpoint()`),不 patch、不重写。

测试隔离(AGENTS.md §5 铁律):一律零生产存储。见 `_forbid_production_storage`。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core import jwt_auth
from app.core.config import settings
from app.services import agent_checkpoint as ckpt_mod
from app.services import agent_run_control as run_control
from app.services import run_ownership
from app.services.agent_checkpoint import AgentCheckpointManager, AgentLoopCheckpoint
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

pytestmark = pytest.mark.real_jwt

TEST_SECRET = "test-jwt-secret-for-pause-resume-65-only"
USER_A = "user-a-pause65"
USER_B = "user-b-pause65"


def _token(user_id: str) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "ihui-ai-users",
            "iat": now,
            "exp": now + 3600,
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def _auth(user_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id)}"}


# ---------------------------------------------------------------------------
# 夹具:零生产存储 + 独占控制面 + 独占 checkpoint manager
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _forbid_production_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS.md §5:不得连生产 PG(8810)/ Redis(8811)。

    生产 PG 这一侧是**真拦**:建池即抛。Redis 不需要在这里拦 —— conftest 的
    `_isolate_llm_env` 已把 `settings.redis_url` 钉到 `redis://127.0.0.1:1/0`
    (不可达端口,见 conftest:349 注释),而把它换成一个返回协程的替身会让
    orchestration_hub 之类的调用方拿到一个假客户端,产出一堆与判据无关的噪声。
    checkpoint 层的 PG 持久面另由 `_PSYCOPG_AVAILABLE=False` 关掉,本文件所有
    用例用的都是显式注入的内存 manager。
    """

    def _no_asyncpg_pool(*args: object, **kwargs: object) -> None:
        raise AssertionError("pause/resume 用例不得创建 asyncpg 连接池(生产库禁连)")

    monkeypatch.setattr("asyncpg.create_pool", _no_asyncpg_pool)
    monkeypatch.setattr(ckpt_mod, "_PSYCOPG_AVAILABLE", False)


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """jwt_secret 非空 ⇒ `require_request_user_id` 不允许 DEV_ANONYMOUS 降级。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)


@pytest.fixture(autouse=True)
def _isolate_registries() -> Any:
    """控制面与属主表都是进程内单例,前后各清一次(残留会让断言失去意义)。"""
    run_control.clear_all()
    run_ownership.clear_all()
    yield
    run_control.clear_all()
    run_ownership.clear_all()


def memory_manager() -> AgentCheckpointManager:
    """纯内存 checkpoint manager(无 redis_url / 无 db_url)。"""
    return AgentCheckpointManager(redis_url=None, db_url=None)


class RecordingManager:
    """哨兵:记录每次查询调用,用于断言"越权路径根本没去查库"。"""

    def __init__(self, inner: AgentCheckpointManager) -> None:
        self._inner = inner
        self.calls: list[str] = []

    async def load_checkpoint(self, checkpoint_id: str) -> AgentLoopCheckpoint | None:
        self.calls.append("load_checkpoint")
        return await self._inner.load_checkpoint(checkpoint_id)

    async def load_latest_by_session(
        self, session_id: str
    ) -> AgentLoopCheckpoint | None:
        self.calls.append("load_latest_by_session")
        return await self._inner.load_latest_by_session(session_id)

    async def list_checkpoints(
        self, session_id: str | None = None
    ) -> list[AgentLoopCheckpoint]:
        self.calls.append("list_checkpoints")
        return await self._inner.list_checkpoints(session_id=session_id)

    def __getattr__(self, name: str) -> Any:  # pragma: no cover - 透传未记录属性
        return getattr(self._inner, name)


# ---------------------------------------------------------------------------
# 真实 loop 的公共件
# ---------------------------------------------------------------------------


async def _chatty_executor(args: dict[str, Any]) -> dict[str, str]:
    return {"echo": str(args.get("city", ""))}


def _chatty_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=_chatty_executor,
    )


def _endless_tool_calling_llm() -> Any:
    """每轮都要求调工具、且**每轮参数都不同**的 LLM 替身:循环不会自己结束。

    参数必须逐轮变化 —— loop 自带的 doom-loop 检测会在连续 3 次同模式工具调用时
    判 `stop_reason="error"` 直接退出(实测踩过),那样测的就不是暂停而是别的东西。
    """
    counter = {"n": 0}

    async def mock_llm(messages: Any, tools: Any) -> dict[str, Any]:
        counter["n"] += 1
        await asyncio.sleep(0.02)
        n = counter["n"]
        return {
            "content": f"第 {n} 次查询",
            "tool_calls": [
                {"id": f"c{n}", "name": "get_weather", "args": {"city": f"城市{n}"}}
            ],
        }

    return mock_llm


async def _start_real_loop(
    session_id: str, user_id: str, *, min_iterations: int = 1
) -> tuple[AgentCheckpointManager, asyncio.Task[Any]]:
    """起一个真 loop,并在它**确实在跑**(已完成过至少一轮)之后交还句柄。

    就绪信号用 `_current_iteration` 而不是"已有几个 checkpoint":循环并不是每轮都
    落一个检查点,拿检查点数量当"在跑"的代理指标会让用例挂在等待上,而不是挂在该
    断的东西上。

    等待按**挂钟 deadline** 计而不是固定轮数:每轮都会往 hook/orchestration_hub 发
    事件,而 conftest 把 redis_url 钉到不可达地址(127.0.0.1:1),每次发事件都要吃一个
    连接超时 —— 单轮耗时因此是秒级而非毫秒级,固定轮数会在慢机上闪断。
    等到 task 未结束才返回 ⇒ 此时按暂停才有意义;否则测到的是"对一个已经结束的循环
    按暂停" —— 那种调用在 loop 层走"从未运行"分支,也会落一个 checkpoint,
    看起来同样"暂停成功"。
    """
    manager = memory_manager()
    loop = AgentLoopV2(
        _endless_tool_calling_llm(),
        [_chatty_tool()],
        max_iterations=500,
        enable_checkpoint=True,
        session_id=session_id,
        checkpoint_manager=manager,
        user_id=user_id,
        enable_memory=False,
    )
    await run_control.register_run(session_id, owner_user_id=user_id, loop=loop)
    run_ownership.record_ownership(session_id, user_id)
    run_task: asyncio.Task[Any] = asyncio.create_task(
        loop.run([{"role": "user", "content": "一直查天气"}])
    )
    deadline = asyncio.get_running_loop().time() + 90.0
    while asyncio.get_running_loop().time() < deadline:
        if run_task.done():
            pytest.fail("循环提前退出,暂停无用武之地(测不到在途暂停)")
        if int(getattr(loop, "_current_iteration", 0)) >= min_iterations:
            return manager, run_task
        await asyncio.sleep(0.05)
    pytest.fail("循环未在 90s 内推进到可暂停的轮次")


def _converging_llm() -> Any:
    """续跑后第一轮就给出最终答复(无 tool_calls)的 LLM 替身。"""

    async def mock_llm(messages: Any, tools: Any) -> dict[str, Any]:
        return {"content": "收尾完成", "tool_calls": None}

    return mock_llm


# ===========================================================================
# ① 正常暂停后 loop 真的停在检查点
# ===========================================================================


async def test_pause_makes_real_loop_stop_at_persisted_checkpoint() -> None:
    """真 `AgentLoopV2` + 真(内存)checkpoint 存储:暂停后必须停在**已落盘的**检查点上。

    判的不是"`pause()` 被调过",而是三件事同时成立:
      - 循环确实退出了,且 `stop_reason == "paused"`;
      - 它带回来的 `checkpoint_id` 就是控制面返回的那个;
      - 该 id 在存储里读得到,`status == "paused"` 且带完整消息历史与属主。
    只断前一条会放过"标志设了但循环没停"和"停了但没恢复点"两种失败形态。
    """
    session_id = "sess-65-real-pause"
    manager, run_task = await _start_real_loop(session_id, USER_A)

    verdict = await run_control.pause_session(session_id, USER_A)
    assert verdict.outcome is run_control.PauseOutcome.PAUSED, verdict
    assert verdict.changed is True
    assert verdict.checkpoint_id

    result = await asyncio.wait_for(run_task, timeout=90)

    assert result.stop_reason == "paused", (
        f"循环没有停在暂停点上,而是 {result.stop_reason}"
    )

    # 一次暂停落**两个**检查点(实测确认的 loop 层既有形状):
    #   ① `verdict.checkpoint_id` —— pause() 在"此刻"立刻存的(响应当场能带回一个 id)
    #   ② `result.checkpoint_id`  —— 循环在轮次边界真正停下时存的
    # 两者都必须是可续跑的 paused 检查点;而**权威续跑点是 ②(按 session 取最新)**,
    # 所以这里不再天真地断两串 id 相等 —— 那会把一个真实存在的双快照形状藏起来。
    assert verdict.checkpoint_id and result.checkpoint_id
    eager = await manager.load_checkpoint(verdict.checkpoint_id)
    boundary = await manager.load_checkpoint(result.checkpoint_id)
    assert eager is not None and eager.status == "paused"
    assert boundary is not None and boundary.status == "paused"
    latest = await manager.load_latest_by_session(session_id)
    assert latest is not None
    assert latest.checkpoint_id == result.checkpoint_id, (
        "按会话取到的最新暂停点不是循环真正停下的那一个 —— 续跑会退回旧轮次"
    )
    assert latest.session_id == session_id
    assert latest.messages, "暂停点必须带消息历史,否则续跑等于从头再跑"
    assert latest.owner_user_id == USER_A


# ===========================================================================
# ② resume 续跑
# ===========================================================================


async def test_resume_continues_from_the_paused_checkpoint() -> None:
    """从①留下的暂停点续跑:轮次必须**接着往上加**,不是从 0 重来。"""
    session_id = "sess-65-real-resume"
    manager, run_task = await _start_real_loop(session_id, USER_A)

    verdict = await run_control.pause_session(session_id, USER_A)
    assert verdict.outcome is run_control.PauseOutcome.PAUSED
    paused_result = await asyncio.wait_for(run_task, timeout=90)
    assert paused_result.stop_reason == "paused"
    paused_iteration = paused_result.iterations[-1].iteration

    resumed_iterations: list[int] = []

    class _ResumeProbe:
        """替身 runner:用真 loop 续跑,并记下实际开始的轮次。"""

        async def __call__(
            self, checkpoint: AgentLoopCheckpoint, requester: str
        ) -> dict[str, Any]:
            assert checkpoint.status == "paused"
            cont = AgentLoopV2(
                _converging_llm(),
                [_chatty_tool()],
                max_iterations=20,
                enable_checkpoint=True,
                session_id=checkpoint.session_id,
                checkpoint_manager=manager,
                user_id=requester,
                enable_memory=False,
            )
            res = await cont.resume_from_checkpoint(checkpoint.checkpoint_id)
            resumed_iterations.extend(it.iteration for it in res.iterations)
            return {
                "stop_reason": res.stop_reason,
                "checkpoint_id": res.checkpoint_id,
                "success": res.success,
            }

    async def loader(sid: str) -> AgentLoopCheckpoint:
        # 注入与本用例同一个 manager:控制面的默认 loader 读的是全局单例,
        # 而这里跑的是私有的内存实例 —— 不接上就会读到一个空表。
        latest = await manager.load_latest_by_session(sid)
        if latest is None:
            raise run_control.SessionNotFoundError(sid)
        return latest

    outcome = await run_control.resume_session(
        session_id,
        USER_A,
        load_latest=loader,  # type: ignore[arg-type]
        runner=_ResumeProbe(),  # type: ignore[arg-type]
    )
    assert outcome.outcome is run_control.ResumeOutcome.RESUMED, outcome
    assert outcome.changed is True
    # 续跑用的必须是**循环真正停下**的那个暂停点(按 session 取最新),而不是 pause()
    # 当场带回的 eager 快照 —— 拿后者会重跑一轮工具调用。
    assert outcome.checkpoint_id == paused_result.checkpoint_id, (
        "续跑点不是循环停下的那一轮:会重跑已执行过的工具调用"
    )
    # 续跑从 iteration = 暂停时轮次 + 1 起跑(agent_loop_v2.resume_from_checkpoint 的语义)
    assert resumed_iterations, "续跑没有产出任何轮次 = 根本没跑"
    assert min(resumed_iterations) > paused_iteration, (
        f"续跑轮次 {resumed_iterations} 未接在暂停轮次 {paused_iteration} 之后"
    )


async def test_resume_lets_a_session_be_paused_again() -> None:
    """续跑后控制面记录必须回到可暂停态(否则一次 resume 就把会话永久锁死)。"""
    session_id = "sess-65-resume-then-pause"
    manager = memory_manager()
    await manager.save_checkpoint(
        session_id=session_id,
        iteration=3,
        messages=[{"role": "user", "content": "hi"}],
        tool_state={},
        status="paused",
        metadata={"owner_user_id": USER_A},
    )
    saved = (await manager.list_checkpoints(session_id=session_id))[0]

    async def loader(sid: str) -> AgentLoopCheckpoint:
        assert sid == session_id
        return saved

    class Runner:
        async def __call__(
            self, cp: AgentLoopCheckpoint, requester: str
        ) -> dict[str, Any]:
            assert cp.owner_user_id == requester, "runner 必须收到已判过属主的检查点"
            return {"stop_reason": "completed", "checkpoint_id": None}

    first = await run_control.resume_session(
        session_id, USER_A, load_latest=loader, runner=Runner()  # type: ignore[arg-type]
    )
    assert first.outcome is run_control.ResumeOutcome.RESUMED
    # 跑完即从控制面消失:不留一条"已完成却挂着"的记录骗后来人
    assert await run_control.snapshot_records(session_id) == {}


# ===========================================================================
# ③ 越权被拒且**未发出查询**
# ===========================================================================


def _pause_app(recorder: RecordingManager) -> FastAPI:
    """把 checkpoint manager 换成哨兵,再挂真 agents 路由(真中间件)。"""

    app = FastAPI()
    app.add_middleware(jwt_auth.JWTAuthMiddleware)
    from app.routers import agents as agents_mod

    app.include_router(agents_mod.router, prefix="/api")
    return app


async def test_pause_foreign_session_is_403_and_issues_no_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """别人的会话:403,并且**一次存储查询都没发出**。

    断言 `recorder.calls == []` 才是这条用例的重点。只断 403 会放过这样一种实现:
    它先按 session 把别人的 checkpoint 读出来、再判属主 —— 那既是越权读取,
    又把"判定"建立在自己不该碰的数据上。判据顺序(属主先于 I/O)由这条钉住。
    """
    recorder = RecordingManager(memory_manager())
    monkeypatch.setattr(
        ckpt_mod, "get_agent_checkpoint_manager", lambda: recorder
    )

    session_id = "sess-65-foreign"
    # A 的在飞 run:属主登记在 A 名下(B 来暂停必须被拒)
    run_ownership.record_ownership(session_id, USER_A)
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_FakeLoop(checkpoint_id="ck-65-x")
    )

    app = _pause_app(recorder)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://pause65.test") as ac:
        resp = await ac.post(f"/api/agents/{session_id}/pause", headers=_auth(USER_B))

    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["errorCode"] == "AGENT_PAUSE_FORBIDDEN"
    # 核心断言:判定全程没有碰存储
    assert recorder.calls == [], f"越权判定前不得发出任何查询,实得 {recorder.calls}"
    # 也不得把 A 的身份回显给 B
    assert USER_A not in resp.text


async def test_resume_foreign_session_is_403_with_in_process_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """resume 同型:暂停记录在进程内时,拒绝他人也不发查询。"""
    recorder = RecordingManager(memory_manager())
    monkeypatch.setattr(
        ckpt_mod, "get_agent_checkpoint_manager", lambda: recorder
    )
    session_id = "sess-65-foreign-resume"
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_FakeLoop(checkpoint_id="ck-65-y")
    )
    # 走到 paused 态:先暂停一次(detach 后记录保留)
    run_ownership.record_ownership(session_id, USER_A)
    first = await run_control.pause_session(session_id, USER_A)
    assert first.outcome is run_control.PauseOutcome.PAUSED
    await run_control.detach_run(session_id, owner_user_id=USER_A)
    recorder.calls.clear()

    app = _pause_app(recorder)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://pause65.test"
    ) as ac:
        resp = await ac.post(
            f"/api/agents/{session_id}/resume", json={}, headers=_auth(USER_B)
        )

    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["errorCode"] == "AGENT_RESUME_FORBIDDEN"
    assert recorder.calls == [], f"resume 越权判定发出了查询:{recorder.calls}"


async def test_anonymous_pause_and_resume_are_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """匿名一律 401:未识别身份前不得进入任何属主判定分支。"""
    recorder = RecordingManager(memory_manager())
    monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", lambda: recorder)
    app = _pause_app(recorder)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://pause65.test"
    ) as ac:
        for path in (
            "/api/agents/sess-anon/pause",
            "/api/agents/sess-anon/resume",
        ):
            resp = await ac.post(path, json={})
            assert resp.status_code == 401, f"{path} 仍可匿名可达: {resp.status_code}"
    assert recorder.calls == []


# ===========================================================================
# ④ 重复 pause 幂等且可分辨
# ===========================================================================


class _FakeLoop:
    """满足 `PausableLoop` 契约的替身:记录调用次数,按指定方式返回。"""

    def __init__(self, checkpoint_id: str | None = "ck-65-fake") -> None:
        self.checkpoint_id = checkpoint_id
        self.pause_calls = 0

    async def pause(self) -> str | None:
        self.pause_calls += 1
        return self.checkpoint_id


async def test_second_pause_is_idempotent_yet_distinguishable() -> None:
    """第二次 pause:幂等(不再次触碰 loop),但响应必须与首次**分得出来**。

    "改了 0 也回成功"是守门 134 立项的那一型。这里两条都判:
      - 首次 `outcome=paused` / `changed=True`;
      - 二次 `outcome=already_paused` / `changed=False`,且 `loop.pause()` 没被再调一次。
    两次都回 200 是刻意的(期望状态已达成),可分辨性由 outcome + changed 两个字段承担。
    """
    session_id = "sess-65-idem"
    fake = _FakeLoop(checkpoint_id="ck-65-idem")
    await run_control.register_run(session_id, owner_user_id=USER_A, loop=fake)  # type: ignore[arg-type]
    run_ownership.record_ownership(session_id, USER_A)

    first = await run_control.pause_session(session_id, USER_A)
    second = await run_control.pause_session(session_id, USER_A)

    assert first.outcome is run_control.PauseOutcome.PAUSED
    assert first.changed is True
    assert second.outcome is run_control.PauseOutcome.ALREADY_PAUSED
    assert second.changed is False
    assert second.checkpoint_id == first.checkpoint_id
    assert fake.pause_calls == 1, "幂等路径不得再次触碰 loop(第二次会重复落检查点)"


async def test_pause_route_returns_distinguishable_outcomes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """HTTP 面同样可分辨:两次 200,但 `outcome` / `changed` 必须不同。"""
    recorder = RecordingManager(memory_manager())
    monkeypatch.setattr(ckpt_mod, "get_agent_checkpoint_manager", lambda: recorder)
    session_id = "sess-65-route-idem"
    fake = _FakeLoop(checkpoint_id="ck-65-route")
    await run_control.register_run(session_id, owner_user_id=USER_A, loop=fake)  # type: ignore[arg-type]
    run_ownership.record_ownership(session_id, USER_A)

    app = _pause_app(recorder)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://pause65.test"
    ) as ac:
        r1 = await ac.post(f"/api/agents/{session_id}/pause", json={}, headers=_auth(USER_A))
        await run_control.detach_run(session_id, owner_user_id=USER_A)
        r2 = await ac.post(f"/api/agents/{session_id}/pause", json={}, headers=_auth(USER_A))

    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)
    d1, d2 = r1.json()["data"], r2.json()["data"]
    assert d1["outcome"] == "paused" and d1["changed"] is True
    assert d2["outcome"] == "already_paused" and d2["changed"] is False
    assert d2["checkpoint_id"] == d1["checkpoint_id"]


# ===========================================================================
# ⑤ 持久层 / loop 不可用时显式报错,不静默
# ===========================================================================


async def test_pause_with_no_checkpoint_landed_is_503_not_success() -> None:
    """loop.pause() 返回 None(检查点没落盘)必须判不可用,绝不能记成功。"""
    session_id = "sess-65-no-ckpt"
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_FakeLoop(checkpoint_id=None)  # type: ignore[arg-type]
    )
    run_ownership.record_ownership(session_id, USER_A)

    verdict = await run_control.pause_session(session_id, USER_A)
    assert verdict.outcome is run_control.PauseOutcome.CHECKPOINT_UNAVAILABLE
    assert verdict.checkpoint_id is None
    assert verdict.detail


class _RaisingLoop:
    async def pause(self) -> str | None:
        raise RuntimeError("存储写入失败")


async def test_pause_when_loop_raises_is_503_with_reason() -> None:
    """loop 抛错必须转成显式结论(带异常类型),不得冒泡成空 500 也不得记成功。"""
    session_id = "sess-65-loop-raises"
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_RaisingLoop()  # type: ignore[arg-type]
    )
    run_ownership.record_ownership(session_id, USER_A)

    verdict = await run_control.pause_session(session_id, USER_A)
    assert verdict.outcome is run_control.PauseOutcome.CHECKPOINT_UNAVAILABLE
    assert "RuntimeError" in (verdict.detail or "")


async def test_pause_unknown_session_is_404() -> None:
    """本实例不认识的会话:404(与"认识但没在跑"的 409 是两格)。"""
    verdict = await run_control.pause_session("sess-65-never-seen", USER_A)
    assert verdict.outcome is run_control.PauseOutcome.UNKNOWN_SESSION


async def test_pause_known_but_not_running_is_409() -> None:
    """认识它但它已退出执行作用域:409,不是 404 也不是"暂停成功"。

    `detach_run` 对非暂停记录是整条删除(→ 404 UNKNOWN),而 loop 引用被摘掉、
    记录还在的这一格对应"生成器已退但记录未回收"的在途形态 —— 两种结论不同,
    必须各自有断言,不得都被并成"没找到"。
    """
    session_id = "sess-65-not-running"
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_FakeLoop()  # type: ignore[arg-type]
    )
    async with run_control._lock:  # noqa: SLF001 - 白盒造现场:摘掉 loop 引用
        run_control._records[session_id].loop = None  # noqa: SLF001

    verdict = await run_control.pause_session(session_id, USER_A)
    assert verdict.outcome is run_control.PauseOutcome.NOT_RUNNING


async def test_resume_no_checkpoint_is_404_and_unavailable_store_is_503() -> None:
    """"查不到"(404)与"查不了"(503)必须是两格 —— 合并成一个就等于静默降级。"""
    session_id = "sess-65-store-states"

    async def loader_missing(sid: str) -> AgentLoopCheckpoint:
        raise run_control.SessionNotFoundError(sid)

    async def loader_down(sid: str) -> AgentLoopCheckpoint:
        raise run_control.CheckpointUnavailable("持久层无响应")

    got_missing = await run_control.resume_session(
        session_id,
        USER_A,
        load_latest=loader_missing,  # type: ignore[arg-type]
        runner=_NoopRunner(),  # type: ignore[arg-type]
    )
    got_down = await run_control.resume_session(
        session_id,
        USER_A,
        load_latest=loader_down,  # type: ignore[arg-type]
        runner=_NoopRunner(),  # type: ignore[arg-type]
    )

    assert got_missing.outcome is run_control.ResumeOutcome.NO_CHECKPOINT
    assert got_down.outcome is run_control.ResumeOutcome.RESUME_FAILED
    assert got_down.changed is False
    assert "持久层" in (got_down.detail or "")


class _NoopRunner:
    async def __call__(
        self, checkpoint: AgentLoopCheckpoint, requester: str
    ) -> dict[str, Any]:
        return {"stop_reason": "completed", "checkpoint_id": None}


async def test_resume_failure_does_not_wedge_the_session() -> None:
    """续跑失败后记录必须回到暂停态:否则一次故障就把会话永久卡在"正在执行中"。"""
    session_id = "sess-65-resume-recover"
    checkpoint = AgentLoopCheckpoint(
        checkpoint_id="ck-65-recover",
        session_id=session_id,
        iteration=2,
        messages=[{"role": "user", "content": "hi"}],
        tool_state={},
        status="paused",
        created_at=time.time(),
        expires_at=time.time() + 600,
        metadata={"owner_user_id": USER_A},
    )

    class _Boom:
        async def __call__(
            self, cp: AgentLoopCheckpoint, requester: str
        ) -> dict[str, Any]:
            raise RuntimeError("循环起不来")

    async def loader(sid: str) -> AgentLoopCheckpoint:
        return checkpoint

    first = await run_control.resume_session(
        session_id, USER_A, load_latest=loader, runner=_Boom()  # type: ignore[arg-type]
    )
    assert first.outcome is run_control.ResumeOutcome.RESUME_FAILED

    again = await run_control.resume_session(
        session_id, USER_A, load_latest=loader, runner=_NoopRunner()  # type: ignore[arg-type]
    )
    assert again.outcome is run_control.ResumeOutcome.RESUMED, (
        f"续跑失败后无法再试(实得 {again.outcome})= 会话被卡死"
    )


async def test_resume_while_running_is_409_not_second_concurrent_run() -> None:
    """正在跑的会话不能"续跑";这也挡住同一次暂停被并发续跑两遍。"""
    session_id = "sess-65-resume-while-running"
    await run_control.register_run(
        session_id, owner_user_id=USER_A, loop=_FakeLoop()  # type: ignore[arg-type]
    )
    got = await run_control.resume_session(
        session_id,
        USER_A,
        load_latest=_unused_loader,  # type: ignore[arg-type]
        runner=_NoopRunner(),  # type: ignore[arg-type]
    )
    assert got.outcome is run_control.ResumeOutcome.NOT_PAUSED


async def _unused_loader(sid: str) -> AgentLoopCheckpoint:
    raise AssertionError("running 态应在触达存储之前就被拒")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
