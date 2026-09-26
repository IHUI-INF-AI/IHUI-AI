# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D27 任务完成交付清单测试:聚合器 / LRU store / loop 接线 / 路由端点。

测试覆盖:
- DeliverablesCollector:toolsSummary 统计、filesChanged 生命周期
  (add→update→delete 定格)、citations 去重与上限、filesChanged 上限
- build():跨端契约形状(camelCase)、outputSummary 截断 500、generatedAt ISO8601
- 模块级 store:save/get 往返、未命中 None、LRU 256 淘汰、get 触达防淘汰
- AgentEventStream.session_end:deliverables 可选参数(None 不进 wire payload)
- AgentLoopV2 接线:成功 run 落库 / 失败 run 不落库 / citation 按工具名映射
- GET /api/agents/sessions/{session_id}/deliverables:命中 200 / 未命中 200+null
"""

from __future__ import annotations

from datetime import datetime

from app.services import agent_deliverables as ad
from app.services.agent_deliverables import (
    DeliverablesCollector,
    get_deliverables,
    save_deliverables,
)
from app.services.agent_loop_v2 import (
    AgentEventStream,
    AgentLoopV2,
    ToolDefinition,
)

# =============================================================================
# 1. toolsSummary 统计
# =============================================================================


def test_collector_tools_summary():
    c = DeliverablesCollector()
    c.record_tool_call("c1", "t_a", {}, None)
    c.record_tool_call("c2", "t_a", {}, None)
    c.record_tool_call("c3", "t_b", {}, None)
    data = c.build("")
    assert data["toolsSummary"]["total"] == 3
    assert data["toolsSummary"]["byTool"] == {"t_a": 2, "t_b": 1}


# =============================================================================
# 2. filesChanged 生命周期(add → update → delete 定格)
# =============================================================================


def test_collector_files_changed_lifecycle():
    c = DeliverablesCollector()
    # 新建:before 空 after 非空 → add
    c.record_tool_call(
        "c1", "write_file", {},
        {"tool": "write_file", "path": "/a.py", "before": "", "after": "line1\nline2"},
    )
    # 再次编辑同 path → update
    c.record_tool_call(
        "c2", "edit_file", {},
        {"tool": "edit_file", "path": "/a.py", "before": "line1", "after": "line1\nline3"},
    )
    # 删除同 path → delete 定格
    c.record_tool_call(
        "c3", "delete_file", {},
        {"tool": "delete_file", "path": "/a.py", "before": "l1\nl2\nl3", "after": ""},
    )
    files = c.build("")["filesChanged"]
    assert len(files) == 1
    f = files[0]
    assert f["path"] == "/a.py"
    assert f["kind"] == "delete"
    assert f["stepIds"] == ["c1", "c2", "c3"]
    assert f["deletions"] == 3
    assert f["additions"] == 0


# =============================================================================
# 3. citations 去重 + 上限 20
# =============================================================================


def test_collector_citations_dedupe_and_cap():
    c = DeliverablesCollector()
    c.record_citation("wiki", "页面A", "/repo-wiki")
    c.record_citation("wiki", "页面A", "/repo-wiki")  # 完全重复,应被去重
    for i in range(19):
        c.record_citation("memory", f"m{i}", None)
    data = c.build("")
    assert len(data["citations"]) == 20
    assert data["citations"][0] == {
        "source": "wiki", "label": "页面A", "url": "/repo-wiki",
    }
    # 第 21 条被拒(上限)
    c.record_citation("mcp", "新条目", "/mcp-projects")
    assert len(c.build("")["citations"]) == 20


# =============================================================================
# 4. filesChanged 上限 100(新 path 受限,已有 path 合并不受限)
# =============================================================================


def test_collector_files_cap():
    c = DeliverablesCollector()
    for i in range(120):
        c.record_tool_call(
            f"c{i}", "write_file", {},
            {"tool": "write_file", "path": f"/f{i}.txt", "before": "", "after": "x"},
        )
    files = c.build("")["filesChanged"]
    assert len(files) == 100
    assert files[0]["path"] == "/f0.txt"


# =============================================================================
# 5. build():契约形状 + outputSummary 截断 + generatedAt ISO8601
# =============================================================================


def test_build_shape_and_output_truncation():
    c = DeliverablesCollector()
    c.record_tool_call("c1", "get_weather", {}, None)
    data = c.build("x" * 800)
    assert set(data.keys()) == {
        "citations", "filesChanged", "toolsSummary", "outputSummary", "generatedAt",
    }
    assert data["outputSummary"] == "x" * 500
    assert data["toolsSummary"] == {"total": 1, "byTool": {"get_weather": 1}}
    # generatedAt 必须是可解析的 ISO8601(带时区)
    parsed = datetime.fromisoformat(data["generatedAt"])
    assert parsed.tzinfo is not None


# =============================================================================
# 6. store:save/get 往返 + LRU 256 淘汰 + get 触达防淘汰
# =============================================================================


def test_store_roundtrip_and_lru():
    ad._deliverables_store.clear()
    save_deliverables("s1", {"v": 1})
    assert get_deliverables("s1") == {"v": 1}
    assert get_deliverables("missing") is None
    # 触达 s1(移到尾部),s2 留在头部;随后灌 255 个新会话(总 257)只淘汰 s2
    save_deliverables("s2", {"v": 2})
    get_deliverables("s1")
    for i in range(255):
        save_deliverables(f"bulk-{i}", {"i": i})
    assert get_deliverables("s1") is not None
    assert get_deliverables("s2") is None
    assert len(ad._deliverables_store) == 256


# =============================================================================
# 7. AgentEventStream.session_end:deliverables 可选参数
# =============================================================================


async def test_session_end_optional_deliverables():
    captured: list[tuple[str, dict]] = []

    async def fake_emit(event, payload):
        captured.append((event, payload))

    stream = AgentEventStream()
    stream.emit = fake_emit
    # 不传 deliverables:wire payload 不含该键(老前端零影响)
    await stream.session_end(
        session_id="s", user_id="u", success=True,
        stop_reason="completed", total_iterations=1, total_duration_ms=1.0,
    )
    assert captured[0][0] == "session.end"
    assert "deliverables" not in captured[0][1]
    # 传入 deliverables:原样携带
    mark = {
        "citations": [], "filesChanged": [],
        "toolsSummary": {"total": 0, "byTool": {}},
        "outputSummary": "", "generatedAt": "2026-01-01T00:00:00+00:00",
    }
    await stream.session_end(
        session_id="s", user_id="u", success=True,
        stop_reason="completed", total_iterations=1, total_duration_ms=1.0,
        deliverables=mark,
    )
    assert captured[1][1]["deliverables"] is mark


# =============================================================================
# 8. AgentLoopV2 接线:成功 run 构建并存库
# =============================================================================


async def test_loop_v2_wiring_success(monkeypatch):
    # write_file 属高危写工具,默认走审批门;测试环境无审批者会等待 60s 超时,
    # 导致工具未执行(tr.error 非空)→ diff 不进 filesChanged。
    # 此处将审批替换为立即放行:工具真实执行,diff 由 derive_step_evidence 从 args 推导。
    async def approve_all(self, tc):
        return None

    monkeypatch.setattr(AgentLoopV2, "_request_approval", approve_all)

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来写入文件",
                "tool_calls": [{
                    "id": "c1", "name": "write_file",
                    "args": {"path": "/tmp/d27_demo.py", "content": "print('hi')"},
                }],
            }
        return {"content": "文件已写入完成", "tool_calls": None}

    async def write_executor(args):
        return {"ok": True, "path": args.get("path")}

    write_tool = ToolDefinition(
        name="write_file",
        description="写文件",
        parameters={
            "type": "object",
            "properties": {"path": {"type": "string"}, "content": {"type": "string"}},
        },
        executor=write_executor,
    )
    loop = AgentLoopV2(
        mock_llm,
        [write_tool],
        max_iterations=5,
        session_id="sess-d27-wiring",
        # V3 #47 第二格(2026-09-26):本例的样本工具是 `write_file`,它同在
        # `mcp_server._ADMIN_ONLY_TOOLS` 里,而角色闸现在排在审批门**之前**(默认 0 = 普通
        # 用户即拒)。这里声明 role=1 是为了让本文件继续测它声称测的那件事
        # (产物采集链路),不是把角色判据削掉 —— 角色门自身的正反例在
        # `tests/test_engine_role_parity.py` 与 `tests/test_agents_role_parity.py`。
        user_role=1,
    )
    result = await loop.run([
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "写一个 demo 文件"},
    ])
    assert result.success is True

    data = get_deliverables("sess-d27-wiring")
    assert data is not None
    assert data["toolsSummary"] == {"total": 1, "byTool": {"write_file": 1}}
    assert len(data["filesChanged"]) == 1
    f = data["filesChanged"][0]
    assert f["path"] == "/tmp/d27_demo.py"
    assert f["kind"] == "add"
    assert f["stepIds"] == ["c1"]
    assert data["outputSummary"] == "文件已写入完成"
    assert datetime.fromisoformat(data["generatedAt"]).tzinfo is not None


# =============================================================================
# 9. AgentLoopV2 接线:失败 run 不落库
# =============================================================================


async def test_loop_v2_wiring_failure_skips():
    async def mock_llm(messages, tools):
        raise RuntimeError("LLM 网关连接失败")

    loop = AgentLoopV2(
        mock_llm, [], max_iterations=3, llm_retry_max=0,
        session_id="sess-d27-fail",
    )
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is False
    assert result.stop_reason == "error"
    assert get_deliverables("sess-d27-fail") is None


# =============================================================================
# 10. citation 按工具名映射(wiki/memory/skill/mcp)
# =============================================================================


async def test_citation_mapping_by_tool_name():
    async def mock_llm(messages, tools):
        return {"content": "ok", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [], max_iterations=1, session_id="sess-d27-cite")
    loop._record_deliverable_citation("wiki_search", {"title": "架构页"})
    loop._record_deliverable_citation("memory_search", {"id": "e42", "query": "q"})
    loop._record_deliverable_citation("skill_evolution", {"source_url": "/s/1", "name": "review"})
    # 非 mcp 名单内的未知工具:不产生 citation
    loop._record_deliverable_citation("totally_unknown", {})
    data = loop._deliverables.build("")
    by_src = {c["source"]: c for c in data["citations"]}
    assert set(by_src.keys()) == {"wiki", "memory", "skill"}
    assert by_src["wiki"] == {"source": "wiki", "label": "架构页", "url": "/repo-wiki"}
    assert by_src["memory"]["url"] == "/memory/e42"
    assert by_src["skill"] == {"source": "skill", "label": "review", "url": "/s/1"}


# =============================================================================
# 11. GET /api/agents/sessions/{session_id}/deliverables:命中 / 未命中
# =============================================================================


async def test_endpoint_hit_and_miss(client):
    sample = {
        "citations": [],
        "filesChanged": [],
        "toolsSummary": {"total": 1, "byTool": {"t": 1}},
        "outputSummary": "done",
        "generatedAt": "2026-01-01T00:00:00+00:00",
    }
    save_deliverables("sess-d27-endpoint", sample)
    resp = await client.get("/api/agents/sessions/sess-d27-endpoint/deliverables")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "sess-d27-endpoint"
    assert body["deliverables"]["toolsSummary"]["total"] == 1

    # 未命中:同样 200,deliverables 为 null
    resp2 = await client.get("/api/agents/sessions/sess-d27-missing/deliverables")
    assert resp2.status_code == 200
    assert resp2.json()["session_id"] == "sess-d27-missing"
    assert resp2.json()["deliverables"] is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
