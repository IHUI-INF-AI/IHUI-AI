# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #84 生产者侧(2026-10-07):发起侧耐久视野声明回归测试。

覆盖三面,逐面正反成对:

  ① 循环层(`TestLoopStamps`):声明了 `durable_horizon_seconds` 的
     AgentLoopV2,落每一行 checkpoint 时 metadata 都带
     `durable_horizon_seconds` + `durable_launched_at`(键唯一真源
     durable_resume),且发起时刻在**构造时刻**固定、不随落盘漂移 ——
     续期差额要的是"任务几点发起",不是"这行 checkpoint 几点落"。
     反向:未声明(缺省)的循环一个耐久键都不写,metadata=None 原样
     透传连空 dict 都不多造,与现状逐零差异;声明路径是复制合并,
     调用方传入的原 dict 不得被改。
  ② HTTP 入口(`TestHttpRequestModels`):execute / resume /
     session-resume 三条入口字段面同形(省略 = None = 非耐久),边界
     ge=1 / le=7天上限,上限数字只引 DURABLE_HORIZON_MAX_SECONDS
     唯一真源(agent_loop_v2/agents.py 都不抄第二份)。
  ③ 接线(`TestWiring`):唯一构造入口 `_new_v2_loop` 真把声明透传进
     循环(替身捕获实证);`_resume_run_from_checkpoint` 与四个端点
     函数都取 `req.durable_horizon_seconds`。

测试隔离(AGENTS.md §5 铁律):零生产存储 —— checkpoint 管理器是显式
注入的内存替身,循环只构造不运行,不触 PG(8810)/ Redis(8811)。
"""

from __future__ import annotations

import inspect
from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from app.services import durable_resume as dr

T0 = 1_800_000_000.0  # 固定基准时刻:断言不跟真实时钟漂
CAP = int(dr.DURABLE_HORIZON_MAX_SECONDS)  # 唯一真源读出的 7 天上限(秒)

HORIZON_KEY = dr.DURABLE_HORIZON_METADATA_KEY
LAUNCHED_KEY = dr.DURABLE_LAUNCHED_AT_METADATA_KEY


# ---------------------------------------------------------------------------
# 构造件
# ---------------------------------------------------------------------------


def _fixed_clock() -> datetime:
    return datetime.fromtimestamp(T0, tz=UTC)


async def _llm(messages: Any, tools: Any) -> dict[str, Any]:
    return {"content": "", "tool_calls": None}  # pragma: no cover - 本文件不起循环


class _RecordingCheckpoints:
    """内存替身:原样记录 save_checkpoint 收到的全部入参。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def save_checkpoint(self, **kwargs: Any) -> str:
        self.calls.append(kwargs)
        return f"ckpt-{len(self.calls)}"


def _make_loop(**kwargs: Any) -> tuple[Any, _RecordingCheckpoints]:
    stub = _RecordingCheckpoints()
    from app.services.agent_loop_v2 import AgentLoopV2

    loop = AgentLoopV2(
        _llm,
        [],
        max_iterations=1,
        checkpoint_manager=stub,
        time_provider=_fixed_clock,
        **kwargs,
    )
    return loop, stub


# ---------------------------------------------------------------------------
# ① 循环层:声明即落键、缺省即零差异
# ---------------------------------------------------------------------------


class TestLoopStamps:
    async def test_declared_loop_stamps_both_keys_on_every_checkpoint(self) -> None:
        """声明了视野的循环,每行 checkpoint 都自带两枚耐久键(续期闸的判据)。"""
        loop, stub = _make_loop(durable_horizon_seconds=3600)
        assert await loop._save_checkpoint_safe(1, [], "running") is not None
        assert await loop._save_checkpoint_safe(2, [], "paused") is not None
        assert len(stub.calls) == 2
        for call in stub.calls:
            assert call["metadata"][HORIZON_KEY] == 3600
            assert call["metadata"][LAUNCHED_KEY] == pytest.approx(T0)

    async def test_launched_at_is_fixed_at_construction_not_per_save(self) -> None:
        """发起时刻在构造时刻固定:落盘时刻再走,launched_at 也不漂。

        用一支**构造后持续推进**的假钟把这条语义钉死 —— 若实现错成
        "每次落盘现取时刻",两行 checkpoint 的发起时刻必然不同。
        """
        now = {"t": T0}

        def _ticking_clock() -> datetime:
            now["t"] += 100.0
            return datetime.fromtimestamp(now["t"], tz=UTC)

        stub = _RecordingCheckpoints()
        from app.services.agent_loop_v2 import AgentLoopV2

        loop = AgentLoopV2(
            _llm,
            [],
            max_iterations=1,
            checkpoint_manager=stub,
            time_provider=_ticking_clock,
            durable_horizon_seconds=60,
        )
        await loop._save_checkpoint_safe(1, [], "running")
        await loop._save_checkpoint_safe(2, [], "running")
        stamps = [c["metadata"][LAUNCHED_KEY] for c in stub.calls]
        assert stamps == [pytest.approx(T0 + 100.0)] * 2, "两行落盘必须是同一发起时刻"

    async def test_undeclared_loop_writes_no_durable_keys(self) -> None:
        """缺省(非耐久)循环一个耐久键都不写 —— 不代没点名的任务决定要活多久。"""
        loop, stub = _make_loop()
        await loop._save_checkpoint_safe(
            1,
            [{"role": "user", "content": "hi"}],
            "running",
            metadata={"origin": "iter.end"},
        )
        meta = stub.calls[0]["metadata"]
        assert HORIZON_KEY not in meta
        assert LAUNCHED_KEY not in meta
        assert meta["origin"] == "iter.end"

    async def test_undeclared_none_metadata_stays_none_untouched(self) -> None:
        """未声明路径与现状逐零差异:metadata=None 原样透传,连空 dict 都不多造。"""
        loop, stub = _make_loop()
        await loop._save_checkpoint_safe(1, [], "running", metadata=None)
        assert stub.calls[0]["metadata"] is None
        caller: dict[str, Any] = {"origin": "tool.pause"}
        await loop._save_checkpoint_safe(2, [], "running", metadata=caller)
        assert stub.calls[1]["metadata"] is caller, "原 dict 对象必须原样透传"

    async def test_declared_merge_is_copy_caller_dict_not_mutated(self) -> None:
        """声明路径是复制合并:调用方键保留进落盘 metadata,原 dict 不被改。"""
        loop, stub = _make_loop(durable_horizon_seconds=60)
        caller = {"origin": "tool.pause"}
        await loop._save_checkpoint_safe(1, [], "paused", metadata=caller)
        meta = stub.calls[0]["metadata"]
        assert meta["origin"] == "tool.pause", "调用方既有键必须保留"
        assert meta[HORIZON_KEY] == 60
        assert meta[LAUNCHED_KEY] == pytest.approx(T0)
        assert caller == {"origin": "tool.pause"}, "调用方原 dict 不得被改"

    async def test_declared_none_metadata_still_stamps(self) -> None:
        """声明了视野但调用方没传 metadata:None 造空 dict 后照常落键。"""
        loop, stub = _make_loop(durable_horizon_seconds=60)
        await loop._save_checkpoint_safe(1, [], "running", metadata=None)
        meta = stub.calls[0]["metadata"]
        assert meta[HORIZON_KEY] == 60
        assert meta[LAUNCHED_KEY] == pytest.approx(T0)


# ---------------------------------------------------------------------------
# ② HTTP 入口:三条入口字段面同形,边界由唯一真源钉
# ---------------------------------------------------------------------------

# (模型名, 构造该模型所需的最小合法字段)
_ENTRY_MODELS: list[tuple[str, dict[str, Any]]] = [
    ("AgentExecuteRequest", {"goal": "g"}),
    ("AgentResumeRequest", {"checkpoint_id": "c"}),
    ("AgentSessionResumeRequest", {}),
]


class TestHttpRequestModels:
    @pytest.mark.parametrize(("model_name", "minimal"), _ENTRY_MODELS)
    def test_three_entries_share_the_same_optional_horizon_field(
        self, model_name: str, minimal: dict[str, Any]
    ) -> None:
        """字段面同形且省略 = None = 非耐久(与现状零差异)。"""
        from app.routers import agents as agents_router

        model = getattr(agents_router, model_name)
        assert "durable_horizon_seconds" in model.model_fields
        info = model.model_fields["durable_horizon_seconds"]
        assert info.is_required() is False
        assert info.annotation == (int | None)
        assert model(**minimal).durable_horizon_seconds is None

    @pytest.mark.parametrize(("model_name", "minimal"), _ENTRY_MODELS)
    @pytest.mark.parametrize("value", [0, -5, CAP + 1])
    def test_out_of_bounds_horizon_is_rejected(
        self, model_name: str, minimal: dict[str, Any], value: int
    ) -> None:
        from app.routers import agents as agents_router

        model = getattr(agents_router, model_name)
        with pytest.raises(ValidationError):
            model(**{**minimal, "durable_horizon_seconds": value})

    @pytest.mark.parametrize(("model_name", "minimal"), _ENTRY_MODELS)
    @pytest.mark.parametrize("value", [1, CAP])
    def test_in_bounds_horizon_is_accepted(
        self, model_name: str, minimal: dict[str, Any], value: int
    ) -> None:
        from app.routers import agents as agents_router

        model = getattr(agents_router, model_name)
        assert (
            model(**{**minimal, "durable_horizon_seconds": value}).durable_horizon_seconds
            == value
        )


# ---------------------------------------------------------------------------
# ③ 接线:声明真的能从 HTTP 面走进循环
# ---------------------------------------------------------------------------


class _CaptureLoop:
    """替身:只记构造入参,不做任何真实初始化。"""

    instances: list[_CaptureLoop] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.args = args
        self.kwargs = kwargs
        type(self).instances.append(self)

    async def resume_from_checkpoint(self, checkpoint_id: str) -> str:  # pragma: no cover
        return f"resumed:{checkpoint_id}"


class TestWiring:
    async def test_new_v2_loop_passes_horizon_to_the_loop(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """唯一构造入口把 durable_horizon_seconds 原样透传(替身捕获实证)。"""
        import app.services.agent_loop_v2 as loop_mod
        from app.routers import agents as agents_router

        _CaptureLoop.instances = []
        monkeypatch.setattr(loop_mod, "AgentLoopV2", _CaptureLoop)
        monkeypatch.setattr(agents_router, "_make_loop_v2_llm", lambda model: object())

        async def _no_tools(*_a: Any, **_k: Any) -> list[Any]:
            return []

        monkeypatch.setattr(agents_router, "_build_loop_v2_tools", _no_tools)

        await agents_router._new_v2_loop(
            model=None,
            tools=None,
            max_iterations=None,
            session_id=None,
            current_user="wire-user",
            user_role=0,
            permission_mode=None,
            durable_horizon_seconds=123,
        )
        (built,) = _CaptureLoop.instances
        assert built.kwargs["durable_horizon_seconds"] == 123

    def test_resume_chain_and_four_endpoints_take_the_request_field(self) -> None:
        """resume 链与四个端点都取 `req.durable_horizon_seconds`(结构锁)。"""
        from app.routers import agents as agents_router

        resume_src = inspect.getsource(agents_router._resume_run_from_checkpoint)
        assert "durable_horizon_seconds=durable_horizon_seconds" in resume_src
        for fn in (
            agents_router.execute_agent,
            agents_router.execute_agent_stream,
            agents_router.resume_agent_execute,
            agents_router.resume_agent_session,
        ):
            assert (
                "durable_horizon_seconds=req.durable_horizon_seconds"
                in inspect.getsource(fn)
            ), fn.__name__
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
