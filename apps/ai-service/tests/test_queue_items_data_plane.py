# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D33① queueItems 数据面测试(2026-09-26 立)。

覆盖四件事(对应任务票的 4 条功能要求):
① 形状稳定:有排队项给非空数组,无排队项给 `[]` 而不是 None / 缺键;
② 身份最小集:每项只出 id / text / createdAt,附件正文与凭据结构上进不来;
③ 穿落库链:键名与形状经 JSON 往返仍在,并对 api 侧白名单接线状态如实报数;
④ 顺序语义:FIFO 不被并行分支打乱(按声明的入队时间还原,同刻回落插入序)。

隔离性:全程零网络 / 零 PostgreSQL / 零 Redis。engine 用例只用 pytest `tmp_path`
下的 SQLite 会话库(与 tests/test_engine_harness_lifecycle_45.py 同一套夹具形态),
LLM 循环由 _FakeLoop 顶掉 —— 任何用例都不 acquire app.core.db_pool.get_shared_pool。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.queue_items import (
    MAX_QUEUE_ITEMS,
    QUEUE_ITEM_FIELDS,
    QUEUE_ITEMS_FIELD,
    TEXT_SUMMARY_LIMIT,
    QueueItemPayload,
    attach_queue_items,
    build_queue_items,
)

_BASE_MS = 1_770_000_000_000  # 固定基准,避免用例依赖真实时钟


# ---------------------------------------------------------------------------
# ① 形状稳定
# ---------------------------------------------------------------------------


def test_nonempty_queue_yields_items_and_only_whitelisted_keys() -> None:
    """engine 形态 {id, input, enqueuedAt(秒)} 归一为 {id, text, createdAt(毫秒)}。"""
    items = build_queue_items(
        [
            {"id": "q_a", "input": "先跑这条", "enqueuedAt": _BASE_MS / 1000},
            {"id": "q_b", "input": "再跑这条", "enqueuedAt": _BASE_MS / 1000 + 1},
        ]
    )
    assert [i["id"] for i in items] == ["q_a", "q_b"]
    assert [i["text"] for i in items] == ["先跑这条", "再跑这条"]
    assert [i["createdAt"] for i in items] == [_BASE_MS, _BASE_MS + 1000]
    for item in items:
        assert set(item) == set(QUEUE_ITEM_FIELDS)


def test_steer_iso_shape_is_normalised_to_epoch_millis() -> None:
    """llm.py steer 队列形态 {text, queuedAt(ISO)} 同样进这一份真相源。"""
    items = build_queue_items([{"text": "中途引导", "queuedAt": "2026-02-02T00:00:00+00:00"}])
    assert len(items) == 1
    assert items[0]["text"] == "中途引导"
    assert items[0]["createdAt"] == _iso_ms("2026-02-02T00:00:00+00:00")
    assert items[0]["id"].startswith("q_")  # 无 id 来源 ⇒ 派生,但仍带既有前缀


def _iso_ms(text: str) -> int:
    from datetime import UTC, datetime

    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return int(parsed.timestamp() * 1000)


@pytest.mark.parametrize("source", [None, [], [{"text": "   "}], ["不是映射"], [{}]])
def test_empty_input_gives_empty_array_never_none_or_missing_key(
    source: Any,
) -> None:
    """空 / 不可用项一律退化为 `[]`(判据是"数组",不是"键在不在")。"""
    built = build_queue_items(source)
    assert built == []
    assert isinstance(built, list)

    body: dict[str, Any] = {"content": "回复正文"}
    attach_queue_items(body, source)
    # 与 toolCalls/planSteps/steerApplied 的"非空才写"刻意不同:键必须在位。
    assert QUEUE_ITEMS_FIELD in body
    assert body[QUEUE_ITEMS_FIELD] == []
    assert body[QUEUE_ITEMS_FIELD] is not None


def test_attach_is_unconditional_while_sibling_fields_stay_untouched() -> None:
    body: dict[str, Any] = {"toolCalls": [{"id": "t1"}]}
    attach_queue_items(body, [{"id": "q_1", "input": "x", "enqueuedAt": _BASE_MS / 1000}])
    assert body["toolCalls"] == [{"id": "t1"}]  # 不越界改别的落库字段
    assert len(body[QUEUE_ITEMS_FIELD]) == 1


# ---------------------------------------------------------------------------
# ② 身份最小集:不得携带原始附件内容 / 凭据
# ---------------------------------------------------------------------------


def test_attachment_content_and_credentials_are_never_persisted() -> None:
    entry: dict[str, Any] = {
        "id": "q_leak",
        "text": "帮我把这张图改一下 data:image/png;base64," + "A" * 4096,
        "createdAt": _BASE_MS,
        # 下列键全部是"调用方可能顺手塞进来"的东西,一律不得出现在落库形状里
        "files": [{"name": "a.png", "contentBase64": "B" * 512}],
        "attachments": ["C" * 512],
        "authorization": "Bearer sk-live-abcdef123456",
        "apiKey": "ihui_supersecretkey",
        "password": "hunter2",
    }
    items = build_queue_items([entry])
    assert len(items) == 1
    assert set(items[0]) == QUEUE_ITEM_FIELDS  # 白名单:多一个键即红
    serialised = json.dumps(items, ensure_ascii=False)
    for marker in ("base64", "AAAA", "BBBB", "CCCC", "sk-live", "ihui_supersecretkey", "hunter2"):
        assert marker not in serialised
    assert items[0]["text"] == "帮我把这张图改一下 [attachment omitted]"


def test_overlong_text_is_summarised_with_repo_standard_truncation_marker() -> None:
    long_text = "字" * (TEXT_SUMMARY_LIMIT + 37)
    items = build_queue_items([{"id": "q_big", "text": long_text, "createdAt": _BASE_MS}])
    text = items[0]["text"]
    assert text.endswith("...[truncated 37 chars]")
    assert len(text) == TEXT_SUMMARY_LIMIT + len("...[truncated 37 chars]")
    assert text.startswith("字" * TEXT_SUMMARY_LIMIT)


def test_volume_guard_keeps_fifo_head() -> None:
    """超上限只截尾(保留下一个要跑的那批),不改变相对顺序。"""
    entries = [
        {"id": f"q_{n}", "text": f"第{n}条", "createdAt": _BASE_MS + n}
        for n in range(MAX_QUEUE_ITEMS + 4)
    ]
    items = build_queue_items(entries)
    assert len(items) == MAX_QUEUE_ITEMS
    assert [i["id"] for i in items] == [f"q_{n}" for n in range(MAX_QUEUE_ITEMS)]


# ---------------------------------------------------------------------------
# ④ 顺序语义:FIFO 不被并行分支打乱
# ---------------------------------------------------------------------------


def test_concurrent_branches_are_ordered_by_declared_enqueue_time() -> None:
    """两个并行分支乱序 append(晚到的入队时间更早)⇒ 按声明时间还原真实 FIFO。

    这正是 engine 的现实形态:`_handle_thread_enqueue` 在任意时刻追加,而 drain
    循环从头 pop;若按数组下标出数,读回侧会把"先按 Enter 的消息"显示在后面。
    """
    branch_a = [
        {"id": "a1", "text": "A 先到", "createdAt": _BASE_MS},
        {"id": "a2", "text": "A 后到", "createdAt": _BASE_MS + 30},
    ]
    branch_b = [
        {"id": "b1", "text": "B 先到", "createdAt": _BASE_MS + 10},
        {"id": "b2", "text": "B 后到", "createdAt": _BASE_MS + 20},
    ]
    interleaved = [*branch_a, *branch_b]  # 归并顺序与时间顺序无关
    assert [i["id"] for i in build_queue_items(interleaved)] == ["a1", "b1", "b2", "a2"]
    # 反序归并必须给出同一结果:输出只由声明的入队时间决定
    assert build_queue_items([*branch_b, *branch_a]) == build_queue_items(interleaved)


def test_same_millisecond_falls_back_to_stable_insertion_order() -> None:
    same = [{"id": f"q_{n}", "text": f"{n}", "createdAt": _BASE_MS} for n in range(5)]
    assert [i["id"] for i in build_queue_items(same)] == ["q_0", "q_1", "q_2", "q_3", "q_4"]


def test_ids_are_reused_when_present_and_deterministic_when_absent() -> None:
    """无 id 来源(llm.py steer 队列)派生的 id 必须可重放:同输入 ⇒ 同 id。"""
    entry = {"text": "同一句话", "queuedAt": "2026-02-02T00:00:00+00:00"}
    first = build_queue_items([entry])
    second = build_queue_items([entry])
    assert first == second
    assert first[0]["id"].startswith("q_") and len(first[0]["id"]) == 14
    other = {"text": "另一句话", "queuedAt": entry["queuedAt"]}
    assert build_queue_items([other]) != first
    assert build_queue_items([{"id": "  ", "text": "空 id 视同没给", "createdAt": _BASE_MS}])[0][
        "id"
    ].startswith("q_")


# ---------------------------------------------------------------------------
# ③ 穿落库链:JSON 往返 + 白名单接线状态如实报数
# ---------------------------------------------------------------------------


def test_field_survives_json_round_trip_of_callback_body() -> None:
    """落库经 httpx json= → api 浅合并 → jsonb,任何一环丢形状都先在这里红。"""
    body: dict[str, Any] = {"content": "回复"}
    attach_queue_items(
        body,
        [
            {"id": "q_1", "input": "第一条", "enqueuedAt": _BASE_MS / 1000},
            {"id": "q_2", "input": "第二条", "enqueuedAt": _BASE_MS / 1000 + 1},
        ],
        now_ms=_BASE_MS,
    )
    revived: dict[str, Any] = json.loads(json.dumps(body, ensure_ascii=False))
    assert QUEUE_ITEMS_FIELD in revived
    assert revived[QUEUE_ITEMS_FIELD] == [
        {"id": "q_1", "text": "第一条", "createdAt": _BASE_MS},
        {"id": "q_2", "text": "第二条", "createdAt": _BASE_MS + 1000},
    ]
    assert isinstance(revived[QUEUE_ITEMS_FIELD][0]["createdAt"], int)


def _payload() -> QueueItemPayload:
    return {"id": "q_x", "text": "x", "createdAt": _BASE_MS}


def test_typeddict_shape_is_exactly_the_three_identity_fields() -> None:
    assert set(_payload()) == QUEUE_ITEM_FIELDS


REPO_ROOT = Path(__file__).resolve().parents[3]
API_CALLBACK_ROUTE = REPO_ROOT / "apps" / "api" / "src" / "routes" / "ai-callback.ts"


def test_api_callback_whitelist_carries_the_field_once_wired() -> None:
    """白名单对账:api 侧 `ai-callback.ts` 的 callbackSchema 必须逐字段承接。

    该文件不在本票可改清单内(且链路其余环节在他人脏文件 llm.py 里),因此本用例
    刻意设计成**接线一落地就自动生效的门**:未接线时 skip 并喊出缺口与归口,已接线时
    要求"schema 声明 + 解构 + metadata 构造点"三处齐备 —— 只加一处会被浅合并静默丢掉。
    """
    assert API_CALLBACK_ROUTE.is_file(), f"落库白名单文件路径漂移:{API_CALLBACK_ROUTE}"
    source = API_CALLBACK_ROUTE.read_text(encoding="utf-8")
    hits = source.count(QUEUE_ITEMS_FIELD)
    if hits == 0:
        pytest.skip(
            "queueItems 尚未进 api 侧 zod 白名单(发送端 llm.py 也在他人未提交改动中)。"
            "补齐三处即自动转判据:callbackSchema 字段 / parsed.data 解构 / metadata 构造点。"
        )
    assert hits >= 3, f"白名单接线不完整:{QUEUE_ITEMS_FIELD} 仅出现 {hits} 次,需 ≥3(schema/解构/落库)"


# ---------------------------------------------------------------------------
# 装车证明:产出端真的在调用,而不是"造好没人跑"
# ---------------------------------------------------------------------------


class _FakeLoop:
    async def run(self, messages: Any) -> None:  # pragma: no cover - 不应被触发
        raise AssertionError("queueItems 数据面测试不应触发 LLM 运行")


class _Collector:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message: dict[str, Any]) -> None:
        params: dict[str, Any] = message.get("params") or {}
        self.events.append((str(params.get("event", "")), dict(params.get("payload") or {})))


async def _rpc(
    engine: Any, method: str, params: dict[str, Any], emit: _Collector, req_id: int = 1
) -> dict[str, Any]:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}, emit=emit
    )
    assert response is not None and "error" not in response, response
    result: dict[str, Any] = response["result"]
    return result


async def test_agent_engine_thread_state_actually_emits_queue_items(tmp_path: Path) -> None:
    """thread.state 真的带出 queueItems(engine 是本票唯一可在脏文件外落地的产出点)。

    这条用例是"造好没装车"的对照:删掉 agent_engine.py 里的调用即红,哪怕
    app/core/queue_items.py 全部单测仍绿。
    """
    from app.services.agent_engine import AgentEngine
    from app.services.session_store import SessionStore

    async def factory(spec: Any, host_tools: Any) -> _FakeLoop:
        return _FakeLoop()

    engine = AgentEngine(loop_factory=factory, store=SessionStore(str(tmp_path / "qi.db")))
    emit = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit))["threadId"]

    # 空队列:键在位且为空数组(不是 None、不是缺键)
    empty_state = await _rpc(engine, "thread.state", {"threadId": tid}, emit)
    assert QUEUE_ITEMS_FIELD in empty_state
    assert empty_state[QUEUE_ITEMS_FIELD] == []
    assert empty_state["queued"] == 0

    first = await _rpc(engine, "thread.enqueue", {"threadId": tid, "input": "第一条排队"}, emit)
    second = await _rpc(engine, "thread.enqueue", {"threadId": tid, "input": "第二条排队"}, emit)

    state = await _rpc(engine, "thread.state", {"threadId": tid}, emit)
    queued_ids = [item["id"] for item in state[QUEUE_ITEMS_FIELD]]
    assert queued_ids == [first["id"], second["id"]]  # FIFO:入队序即读出序
    assert [item["text"] for item in state[QUEUE_ITEMS_FIELD]] == ["第一条排队", "第二条排队"]
    assert state["queued"] == len(state[QUEUE_ITEMS_FIELD]) == 2
    stamps = [item["createdAt"] for item in state[QUEUE_ITEMS_FIELD]]
    assert stamps == sorted(stamps)
    assert all(isinstance(stamp, int) and stamp > 1e12 for stamp in stamps)  # 毫秒量级

    # 删中间项后顺序仍由剩余项的入队序决定,不产生空洞或错位
    await _rpc(
        engine, "thread.queue.delete", {"threadId": tid, "queuedSubmissionId": first["id"]}, emit
    )
    after_delete = await _rpc(engine, "thread.state", {"threadId": tid}, emit)
    assert [i["id"] for i in after_delete[QUEUE_ITEMS_FIELD]] == [second["id"]]
    assert after_delete["queued"] == 1


def test_queue_items_single_source_is_importable_from_app_core() -> None:
    """发送端(llm.py)接线时的唯一入口存在且在位(禁第二份实现)。"""
    from app.core import queue_items

    assert callable(queue_items.attach_queue_items)
    assert callable(queue_items.build_queue_items)
    assert queue_items.QUEUE_ITEMS_FIELD == "queueItems"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
