# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨会话接力闭环(P2-7)单元测试。

覆盖:
1. 生成(确定性抽取):任务目标/已完成步骤/关键决定/未完成事项/涉及文件 五段正确。
2. 生成安全路径不依赖 LLM:env 门控默认关闭时即便传入 llm_fn 也不精炼。
3. 生成 LLM 精炼:env 开启 + llm_fn 成功 → refined=True 合并;llm_fn 抛错 → 降级确定性。
4. 恢复注入:build_relay_injection 含边界标记;inject_relay_summary_into_messages 前置 system 且原消息不丢。
5. 存储:v3 migration 建表;save/get/list 接力摘要正确;跨 thread 列表倒序。
6. API 契约:{code,message,data};创建/取/列表/继续上次;404 行为。

所有 mock 在测试内定义,无外部依赖。
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from app.routers.relay import (
    continue_thread,
    create_relay_summary,
)
from app.routers.relay import (
    get_relay_summary as api_get_relay_summary,
)
from app.routers.relay import (
    list_relay_summaries as api_list_relay_summaries,
)
from app.services.session_relay import (
    RELAY_MARKER_END,
    RELAY_MARKER_START,
    RelaySummary,
    build_relay_injection,
    generate_relay_summary,
    inject_relay_summary_into_messages,
    relay_llm_refine_enabled,
)
from app.services.session_store import (
    ApprovalResponseItem,
    ErrorItem,
    FileEditItem,
    LLMMessage,
    SessionStore,
    ThreadNotFoundError,
    ToolCallItem,
    ToolResultItem,
    UserMessageItem,
)

# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture()
def store(tmp_path: Path) -> SessionStore:
    s = SessionStore(tmp_path / "relay.db")
    yield s
    s.close()


def _sample_items() -> list:
    """构造一段覆盖各 Item 类型的会话序列。"""
    return [
        UserMessageItem(content="请创建 readme.md 并调用 lint 检查 /repo/main.py"),
        ToolCallItem(call_id="c1", tool="write_file", arguments={"path": "/repo/readme.md"}),
        ToolResultItem(call_id="c1", ok=True, output="written"),
        FileEditItem(path="/repo/readme.md", op="create"),
        ToolCallItem(call_id="c2", tool="lint", arguments={"path": "/repo/main.py"}),
        ToolResultItem(call_id="c2", ok=True, output="clean"),
        ApprovalResponseItem(request_id="r1", approved=True, comment="同意写文件"),
        ErrorItem(message="网络抖动,已重试"),
        ToolCallItem(call_id="c3", tool="deploy", arguments={"env": "prod"}),  # 悬挂,未完成
    ]


# =============================================================================
# 1. 确定性生成
# =============================================================================


def test_generate_five_segments_deterministic() -> None:
    items = _sample_items()
    s = generate_relay_summary(items, thread_id="t1")
    assert s.objective  # 任务目标来自首条 user 消息
    assert "readme.md" in s.objective
    # 已完成步骤:write_file / lint / 文件编辑
    assert any("write_file" in step for step in s.completed_steps)
    assert any("lint" in step for step in s.completed_steps)
    assert any("readme.md" in step for step in s.completed_steps)
    # 关键决定:意图(创建/调用)+ 审批
    assert any("创建" in d or "create" in d.lower() for d in s.key_decisions)
    assert any("同意" in d for d in s.key_decisions)
    # 未完成:悬挂 deploy + 曾出现错误
    assert any("deploy" in u for u in s.unfinished)
    assert any("错误" in u or "网络" in u for u in s.unfinished)
    # 涉及文件
    assert "/repo/readme.md" in s.files
    assert "/repo/main.py" in s.files
    assert s.refined is False


def test_generate_empty_thread_safe() -> None:
    s = generate_relay_summary([], thread_id="empty")
    assert s.objective == ""
    assert s.completed_steps == []
    assert s.unfinished == []
    assert s.files == []
    assert s.refined is False


def test_generate_no_llm_when_env_off_even_if_fn_passed(monkeypatch) -> None:
    """默认安全路径:env 关闭时即便传入 llm_fn 也不精炼(refined=False)。"""
    monkeypatch.delenv("IHUI_SESSION_RELAY_LLM_REFINE", raising=False)
    assert relay_llm_refine_enabled() is False
    called: dict[int, int] = {}

    def _llm(prompt: str) -> dict:
        called[1] = called.get(1, 0) + 1
        return {"objective": "被精炼的目标", "completed_steps": ["精炼步骤"]}

    s = generate_relay_summary(_sample_items(), thread_id="t", llm_refine=True, llm_fn=_llm)
    assert called == {}  # 根本没调用 LLM
    assert s.refined is False
    assert "readme.md" in s.objective  # 仍是确定性结果


# =============================================================================
# 2. LLM 精炼(开关 + 降级)
# =============================================================================


def test_generate_llm_refine_success(monkeypatch) -> None:
    monkeypatch.setenv("IHUI_SESSION_RELAY_LLM_REFINE", "1")
    assert relay_llm_refine_enabled() is True

    def _llm(prompt: str) -> dict:
        return {
            "objective": "精炼后的目标",
            "completed_steps": ["步骤A", "步骤B"],
            "key_decisions": ["决定X"],
            "unfinished": ["待办Y"],
            "files": ["/repo/x.py"],
        }

    s = generate_relay_summary(_sample_items(), thread_id="t", llm_refine=True, llm_fn=_llm)
    assert s.refined is True
    assert s.objective == "精炼后的目标"
    assert s.completed_steps == ["步骤A", "步骤B"]
    assert s.files == ["/repo/x.py"]


def test_generate_llm_refine_failure_degrades(monkeypatch) -> None:
    monkeypatch.setenv("IHUI_SESSION_RELAY_LLM_REFINE", "1")

    def _llm(prompt: str) -> dict:
        raise RuntimeError("模型挂了")

    s = generate_relay_summary(_sample_items(), thread_id="t", llm_refine=True, llm_fn=_llm)
    assert s.refined is False  # 降级回确定性
    assert "readme.md" in s.objective  # 确定性结果仍在


def test_generate_llm_refine_bad_json_degrades(monkeypatch) -> None:
    monkeypatch.setenv("IHUI_SESSION_RELAY_LLM_REFINE", "1")

    def _llm(prompt: str) -> str:
        return "这不是 JSON"

    s = generate_relay_summary(_sample_items(), thread_id="t", llm_refine=True, llm_fn=_llm)
    assert s.refined is False


# =============================================================================
# 3. 恢复注入(边界标记,防污染)
# =============================================================================


def test_build_injection_has_markers_and_segments() -> None:
    s = generate_relay_summary(_sample_items(), thread_id="t")
    text = build_relay_injection(s)
    assert text.startswith(RELAY_MARKER_START)
    assert RELAY_MARKER_END in text
    assert "任务目标" in text
    assert "已完成步骤" in text
    assert "关键决定" in text
    assert "未完成事项" in text
    assert "涉及文件" in text


def test_inject_prepends_system_keeps_originals() -> None:
    s = generate_relay_summary(_sample_items(), thread_id="t")
    orig: list[LLMMessage] = [
        LLMMessage(role="user", content="继续"),
        LLMMessage(role="assistant", content="好的"),
    ]
    out = inject_relay_summary_into_messages(s, orig)
    assert len(out) == 3
    assert out[0].role == "system"
    assert RELAY_MARKER_START in out[0].content
    assert out[1] is orig[0]
    assert out[2] is orig[1]


# =============================================================================
# 4. 存储(v3 migration + CRUD)
# =============================================================================


def test_store_v3_relay_table_ready(store: SessionStore) -> None:
    assert store.schema_version >= 3
    # 空列表不抛
    assert store.list_relay_summaries() == []
    assert store.get_relay_summary("nope") is None


def test_store_save_and_get_latest(store: SessionStore) -> None:
    t = store.create_thread(title="src")
    sid = store.save_relay_summary(
        t.thread_id,
        objective="目标",
        completed_steps=["s1"],
        key_decisions=["d1"],
        unfinished=["u1"],
        files=["/a.py"],
        refined=False,
    )
    assert sid
    row = store.get_relay_summary(t.thread_id)
    assert row is not None
    summary = RelaySummary.from_store_row(row)
    assert summary.objective == "目标"
    assert summary.completed_steps == ["s1"]
    assert summary.files == ["/a.py"]
    assert summary.refined is False


def test_store_get_missing_returns_none(store: SessionStore) -> None:
    assert store.get_relay_summary("ghost") is None


def test_store_save_requires_existing_thread(store: SessionStore) -> None:
    with pytest.raises(ThreadNotFoundError):
        store.save_relay_summary("ghost", objective="x", completed_steps=[], key_decisions=[], unfinished=[], files=[])


def test_store_list_cross_thread_desc(store: SessionStore) -> None:
    t1 = store.create_thread()
    t2 = store.create_thread()
    store.save_relay_summary(t1.thread_id, objective="old", completed_steps=[], key_decisions=[], unfinished=[], files=[])
    time.sleep(0.01)
    store.save_relay_summary(t2.thread_id, objective="new", completed_steps=[], key_decisions=[], unfinished=[], files=[])
    rows = store.list_relay_summaries()
    assert len(rows) == 2
    assert RelaySummary.from_store_row(rows[0]).objective == "new"  # 倒序
    # 分页
    page = store.list_relay_summaries(limit=1, offset=0)
    assert len(page) == 1


# =============================================================================
# 5. API 契约(直接调用 handler,复用 {code,message,data})
# =============================================================================


def _seed_thread_with_items(store: SessionStore) -> str:
    t = store.create_thread(title="项目A")
    turn = store.start_turn(t.thread_id)
    store.append_item(
        turn.turn_id,
        UserMessageItem(content="请创建 /repo/app.py 并运行测试"),
        thread_id=t.thread_id,
    )
    store.append_item(
        turn.turn_id,
        ToolCallItem(call_id="x1", tool="write_file", arguments={"path": "/repo/app.py"}),
        thread_id=t.thread_id,
    )
    store.append_item(
        turn.turn_id,
        ToolResultItem(call_id="x1", ok=True, output="ok"),
        thread_id=t.thread_id,
    )
    return t.thread_id


def test_api_create_summary_contract(store: SessionStore) -> None:
    from app.routers.relay import _CreateSummaryBody

    tid = _seed_thread_with_items(store)
    resp = create_relay_summary(_CreateSummaryBody(thread_id=tid), store=store)
    assert resp["code"] == 0
    assert resp["message"] == "ok"
    data = resp["data"]
    assert data["thread_id"] == tid
    assert data["objective"]
    assert "/repo/app.py" in data["files"]


def test_api_get_summary_404(store: SessionStore) -> None:
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        api_get_relay_summary("ghost", store=store)
    assert exc.value.status_code == 404


def test_api_list_summaries_contract(store: SessionStore) -> None:
    tid = _seed_thread_with_items(store)
    from app.routers.relay import _CreateSummaryBody

    create_relay_summary(_CreateSummaryBody(thread_id=tid), store=store)
    resp = api_list_relay_summaries(limit=10, offset=0, store=store)
    assert resp["code"] == 0
    assert resp["data"]["total"] == 1
    assert resp["data"]["summaries"][0]["thread_id"] == tid


def test_api_continue_thread_injects_boundary(store: SessionStore) -> None:
    tid = _seed_thread_with_items(store)
    resp = continue_thread(tid, store=store)
    assert resp["code"] == 0
    data = resp["data"]
    assert data["thread"]["parent_thread_id"] == tid
    assert data["summary"]["prev_thread_id"] == tid
    assert RELAY_MARKER_START in data["injection"]
    assert RELAY_MARKER_END in data["injection"]
    # 新 thread 也能取回自己的接力摘要
    new_tid = data["thread"]["thread_id"]
    assert store.get_relay_summary(new_tid) is not None


def test_api_continue_missing_thread_404(store: SessionStore) -> None:
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        continue_thread("ghost", store=store)
    assert exc.value.status_code == 404
