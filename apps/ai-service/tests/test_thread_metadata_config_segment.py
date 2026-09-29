# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎写过的配置段不得被客户端 `thread/metadata` 整写冲掉(2026-09-27 G-255)。

实测到的现状(修复前;同一份流程跑修复前的 HEAD 归档即报下面这些红):

  · `thread.start` 之后**内存** `thread.metadata` 是空 dict,而**库里那一行**的 metadata
    带着引擎写过的全部配置键(sessionId/model/permissionMode/maxIterations/toolNames/
    workspace/conversationId/approvalPolicies/modelParams/reasoning/denyTools/
    tokenBudget/goal/outputSchema/autoCompact/autoCompactThreshold/role/
    systemPromptSource/systemPrompt + 身份键 userId);
  · 一次 `thread/metadata` 的 merge=False 整写就把库里那份**整体替换**成 patch,只留
    patch 的键 + 身份键 ⇒ 重启恢复按缺省还原(表现为"线程配置在重启后悄悄换了一套",
    而进程内任何一次响应体都看不见这一格)。

批 60(G-249)的身份清单只盖住 `userId`/`roleId`,所以这一型当时仍然无人看守。
本票口径由负责人拍板:**引擎 owns 的段 = `_persist_thread_created` 写进库的全部键**,
由 `session_store.ENGINE_OWNED_METADATA_KEYS` 一具名清单给出;守的位置是 RPC 处理器
`_handle_thread_metadata`(客户端 metadata 的唯一入口);真值取**线程当前生效的配置**
而不是库里旧值。

最后一条是本票最关键的风险点,所以专门留了正向对照
`test_settings_then_replace_keeps_the_new_tier_not_the_stored_old_one`:合法写者
(`thread.settings`)与客户端整写走的是同一个 `update_thread_metadata(merge=False)`
出口,若把真值来源换成"库里那行旧值",刚改的档位会被这一次整写悄悄回滚 —— 那条用例
必须红(变异取证见交付报告),否则本票只是把一种静默失效换成另一种。

隔离(§5 测试隔离铁律):SQLite 一律落 pytest 的 tmp_path,不碰 data/sessions.db、
不碰生产 PG(8810)/ Redis(8811);不派生服务、不发网络请求、不跑主循环。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from app.services import agent_engine as ae
from app.services.agent_engine import AgentEngine, EngineThread
from app.services.session_store import (
    ENGINE_OWNED_METADATA_KEYS,
    IDENTITY_METADATA_KEYS,
    SessionStore,
    carry_engine_owned_keys,
)

# ---------------------------------------------------------------------------
# 夹具(与 tests/test_thread_identity_immutable.py 同形:只走 RPC 面,不跑主循环)
# ---------------------------------------------------------------------------

_START_CONFIG: dict[str, Any] = {
    "model": "gpt-4o",
    "permissionMode": "plan",
    "maxIterations": 8,
    "tools": ["read_file"],
    "workspace": "/srv/demo",
    "systemPrompt": "You are a helpful agent.",
    "tokenBudget": 12345,
    "goal": "ship G-255",
}


async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
    class _Loop:
        def __init__(self) -> None:
            self.spec = spec

        async def run(self, messages: list[Any]) -> Any:
            raise AssertionError("本文件不跑主循环")

    return _Loop()


def _tmp_store(tmp_path: Path) -> SessionStore:
    return SessionStore(str(tmp_path / "g255.db"))


def _engine_with(store: SessionStore) -> AgentEngine:
    return AgentEngine(loop_factory=_factory, store=store)


async def _rpc(
    engine: AgentEngine,
    method: str,
    params: dict[str, Any],
    *,
    principal: str | None = None,
    rid: int = 1,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "jsonrpc": "2.0",
        "id": rid,
        "method": method,
        "params": dict(params),
    }
    if principal is not None:
        payload["params"]["userId"] = principal
    response = await engine.handle_message(payload)
    assert response is not None
    return response


async def _start(engine: AgentEngine, principal: str | None = "alice") -> str:
    response = await _rpc(engine, "thread.start", dict(_START_CONFIG), principal=principal)
    assert "result" in response, response
    return str(response["result"]["threadId"])


def _row(store: SessionStore, tid: str) -> dict[str, Any]:
    thread = store.get_thread(tid)
    assert thread is not None
    return dict(thread.metadata or {})


def _probe_thread(engine: AgentEngine) -> EngineThread:
    return EngineThread(
        thread_id="thr_probe",
        session_id="sess-probe",
        model="gpt-4o",
        permission_mode="plan",
        max_iterations=8,
        tool_names=["read_file"],
        workspace="/srv/demo",
        user_id="alice",
        conversation_id="conv-1",
        messages=[{"role": "system", "content": "You are a helpful agent."}],
    )


# ---------------------------------------------------------------------------
# 0. 清单与算值处的双向对账(行为全部建立在这三条结构判据上)
# ---------------------------------------------------------------------------


def test_identity_and_engine_segments_are_disjoint() -> None:
    """身份族与配置族**必须**是两条独立通道、键集不相交。

    共键 = 同一条不变量有两份互相矛盾的判序(身份要"以已落库那份为准",配置要
    "以线程当前生效值为准")—— 把配置名塞进 `IDENTITY_METADATA_KEYS` 就是拿前者
    覆盖后者,表现为"刚改的档位被下一次整写回滚成库里旧值"。
    """
    assert not (set(ENGINE_OWNED_METADATA_KEYS) & set(IDENTITY_METADATA_KEYS))


def test_engine_config_keys_are_exactly_the_ledger(tmp_path: Path) -> None:
    """清单 = 写侧实际写了什么(逐键、不重不漏、顺序无关)。"""
    engine = _engine_with(_tmp_store(tmp_path))
    values = engine._engine_config_of(_probe_thread(engine))
    assert set(values) == set(ENGINE_OWNED_METADATA_KEYS)
    assert len(ENGINE_OWNED_METADATA_KEYS) == len(set(ENGINE_OWNED_METADATA_KEYS))


def test_ledger_drift_raises_instead_of_silently_ignoring(tmp_path: Path) -> None:
    """清单与算值处漂开必须**当场抛**。

    漂开时 `_handle_thread_metadata` 仍会按清单去裁配置段:少算一个键 ⇒ 那个键被
    客户端整写抹掉而账面全绿(门给自己发合格证那一型)。这条判据让"加配置键忘了登记
    / 删登记忘了删值"变成一次显式故障,而不是一格静默敞口。
    """
    engine = _engine_with(_tmp_store(tmp_path))
    thread = _probe_thread(engine)
    original = ae.ENGINE_OWNED_METADATA_KEYS
    ae.ENGINE_OWNED_METADATA_KEYS = (*original, "ghostKey")
    try:
        with pytest.raises(RuntimeError, match="ghostKey"):
            engine._engine_config_of(thread)
    finally:
        ae.ENGINE_OWNED_METADATA_KEYS = original
    # 还原后必须照旧可用(证明上一条红的是判据,不是夹具坏了)
    assert "ghostKey" not in engine._engine_config_of(thread)


def test_carry_helper_drops_unprovided_engine_keys() -> None:
    """出口单测:`provided` 里没有的引擎键,不得留下调用方写的值。

    与 `carry_identity_keys` 同一条判序 —— 引擎不再产出该配置项时,客户端不能替它
    占位(否则"删掉一个配置档"永远删不动,而伪造值还能留在库里)。
    """
    out = carry_engine_owned_keys(
        {"model": "gpt-4o"},
        {"model": "evil", "permissionMode": "bypass", "biz": "order"},
    )
    assert out == {"model": "gpt-4o", "biz": "order"}


# ---------------------------------------------------------------------------
# 1. merge=False 整写:配置段必须在位、值 = 线程当前生效值,业务段仍可整体替换
# ---------------------------------------------------------------------------


async def test_replace_mode_keeps_engine_segment_in_the_row(tmp_path: Path) -> None:
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)
    before = _row(store, tid)
    assert before, "前置:thread.start 必须已把配置段落库"

    response = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"biz": "order"}, "merge": False},
        principal="alice",
    )
    assert "error" not in response, response
    result = response["result"]
    assert result["persisted"] is True
    meta = dict(result["metadata"])
    row = _row(store, tid)

    for key in ENGINE_OWNED_METADATA_KEYS:
        assert key in meta, f"结果 metadata 丢了引擎段键 {key}"
        assert key in row, f"库里的引擎段键 {key} 被整写冲掉了"
        assert row[key] == before[key], f"{key} 的值被整写改写了"
    assert meta["model"] == "gpt-4o"
    assert meta["permissionMode"] == "plan"
    assert meta["maxIterations"] == 8
    assert meta["systemPrompt"] == "You are a helpful agent."
    # 身份通道照旧生效(批 60 的既有契约不得被本票带崩)
    assert meta["userId"] == "alice" and row["userId"] == "alice"
    # 业务段:整写之后只剩 patch 的键 ⇒ "整体替换"没有被冻住
    business = set(row) - set(ENGINE_OWNED_METADATA_KEYS) - set(IDENTITY_METADATA_KEYS)
    assert business == {"biz"}


async def test_replace_mode_still_clears_previous_business_keys(tmp_path: Path) -> None:
    """正向对照(防"把修复做成把功能改坏"):旧业务键必须被整写清掉。"""
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)
    await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"stale": 1, "note": "x"}},
        principal="alice",
    )
    mid = _row(store, tid)
    assert mid["stale"] == 1 and mid["note"] == "x"

    second = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"only": True}, "merge": False},
        principal="alice",
    )
    assert "error" not in second, second
    assert second["result"]["metadata"]["only"] is True
    row = _row(store, tid)
    assert "stale" not in row and "note" not in row, "整写没能替换业务段 ⇒ 收得太宽"


async def test_client_cannot_forge_an_engine_segment_value(tmp_path: Path) -> None:
    """patch 里塞同名配置键 ⇒ 以线程当前生效值为准,伪造不写进内存也不写进库。"""
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)
    response = await _rpc(
        engine,
        "thread.metadata",
        {
            "threadId": tid,
            "patch": {"model": "evil-model", "permissionMode": "bypassPermissions"},
            "merge": False,
        },
        principal="alice",
    )
    assert "error" not in response, response
    meta = dict(response["result"]["metadata"])
    row = _row(store, tid)
    assert meta["model"] == "gpt-4o" and row["model"] == "gpt-4o"
    assert meta["permissionMode"] == "plan" and row["permissionMode"] == "plan"


# ---------------------------------------------------------------------------
# 2. 真值来源=线程当前生效值(本票最大风险点):合法档位改动不得被回滚
# ---------------------------------------------------------------------------


async def test_settings_then_replace_keeps_the_new_tier_not_the_stored_old_one(
    tmp_path: Path,
) -> None:
    """改档位 → 再整写 metadata ⇒ 档位必须是**新值**。

    为什么这条是本票的生死线:`thread.settings` 与 `thread/metadata` 都经由同一个
    `update_thread_metadata(..., merge=False)` 落库。若守卫的真值取"库里那一行",
    那么 `thread.settings` 改完档位(只改内存 `EngineThread` 字段、库行仍是旧值)之后
    的任何一次 metadata 整写,都会把刚生效的档位回滚成改之前的旧值 —— 那等于用一种
    静默失效换掉另一种。故真值只能取线程当前生效值。

    变异取证:把 `_handle_thread_metadata` 里的 `engine_config` 换成
    `_row(store, tid)`(库里旧值)⇒ 本用例必红在 `gpt-5` 这一行。
    """
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)

    settings = await _rpc(
        engine,
        "thread.settings",
        {"threadId": tid, "settings": {"model": "gpt-5", "maxIterations": 99}},
        principal="alice",
    )
    assert "error" not in settings, settings
    assert sorted(settings["result"]["applied"]) == ["maxIterations", "model"]
    # 前置:此刻**库里那一行**仍是旧值(合法写者只改内存字段)
    assert _row(store, tid)["model"] == "gpt-4o"
    assert _row(store, tid)["maxIterations"] == 8

    response = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"biz": "after-tier-change"}, "merge": False},
        principal="alice",
    )
    assert "error" not in response, response
    meta = dict(response["result"]["metadata"])
    row = _row(store, tid)
    assert meta["model"] == "gpt-5", "整写把刚改的档位回滚成库里旧值"
    assert row["model"] == "gpt-5"
    assert meta["maxIterations"] == 99 and row["maxIterations"] == 99
    assert meta["biz"] == "after-tier-change"


async def test_restart_after_replace_restores_effective_config(tmp_path: Path) -> None:
    """票面后果本身:整写之后重启(内存清空)恢复出的配置必须还是那套。"""
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)
    await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"biz": "order"}, "merge": False},
        principal="alice",
    )
    engine._threads.clear()  # 进程重启:只剩库里那一行
    restored = await _rpc(engine, "thread.state", {"threadId": tid}, principal="alice")
    assert "error" not in restored, restored
    thread = engine._threads[tid]
    assert thread.model == "gpt-4o"
    assert thread.permission_mode == "plan"
    assert thread.max_iterations == 8
    assert thread.tool_names == ["read_file"]
    assert thread.workspace == "/srv/demo"
    assert thread.token_budget == 12345
    assert thread.goal == "ship G-255"
    assert thread.user_id == "alice"


# ---------------------------------------------------------------------------
# 3. merge=True:落库不再抹配置段,而客户端可见形状一字未变(既有契约)
# ---------------------------------------------------------------------------


async def test_merge_true_persists_segment_without_changing_response_shape(
    tmp_path: Path,
) -> None:
    """merge=True 也走同一个 merge=False 落库出口 ⇒ 它同样会整行替换库里的配置段。

    所以守卫必须覆盖这一支;但这一支的**响应体/内存 metadata 形状**是既有契约
    (tests/test_engine_harness_query_46.py、tests/test_thread_identity_immutable.py
    都按业务键集合逐字钉着),所以只在交给 store 的那份上带引擎段。
    """
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine)

    first = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"env": {"os": "win"}, "flag": 1}},
        principal="alice",
    )
    assert first["result"]["metadata"] == {
        "env": {"os": "win"},
        "flag": 1,
        "userId": "alice",
    }

    second = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"env": {"arch": "x64"}, "flag": None}},
        principal="alice",
    )
    assert second["result"]["metadata"] == {
        "env": {"os": "win", "arch": "x64"},
        "userId": "alice",
    }
    row = _row(store, tid)
    for key in ENGINE_OWNED_METADATA_KEYS:
        assert key in row, f"merge=True 把库里的引擎段键 {key} 冲掉了"
    assert row["env"] == {"os": "win", "arch": "x64"}
    assert "flag" not in row, "patch 值为 None 的删除语义必须照旧生效"


async def test_event_payload_carries_the_stored_segment(tmp_path: Path) -> None:
    """`thread.metadata.updated` 事件说的是"库里现在长这样",不得缺配置段。"""
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    events: list[tuple[str, dict[str, Any]]] = []

    async def emit(message: dict[str, Any]) -> None:
        params = message.get("params") or {}
        events.append((str(params.get("event", "")), dict(params.get("payload") or {})))

    tid = str(
        (
            await engine.handle_message(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "thread.start",
                    "params": dict(_START_CONFIG),
                }
            )
        )["result"]["threadId"]
    )
    await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.metadata",
            "params": {"threadId": tid, "patch": {"biz": "b"}, "merge": False},
        },
        emit=emit,
    )
    payloads = [p for e, p in events if e == "thread.metadata.updated"]
    assert len(payloads) == 1
    meta = dict(payloads[0]["metadata"])
    for key in ENGINE_OWNED_METADATA_KEYS:
        assert key in meta
    assert meta["biz"] == "b"


# ---------------------------------------------------------------------------
# 4. 无身份线程(未鉴权通道)的正向对照:本票不得把身份面的既有行为改坏
# ---------------------------------------------------------------------------


async def test_unowned_thread_still_replaces_business_segment(tmp_path: Path) -> None:
    store = _tmp_store(tmp_path)
    engine = _engine_with(store)
    tid = await _start(engine, principal=None)
    response = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"only": True}, "merge": False},
        principal=None,
    )
    assert "error" not in response, response
    meta = dict(response["result"]["metadata"])
    assert meta["only"] is True
    assert "userId" not in meta, "未绑定身份不得凭空长出一个 userId"
    business = set(_row(store, tid)) - set(ENGINE_OWNED_METADATA_KEYS)
    assert business == {"only"}
