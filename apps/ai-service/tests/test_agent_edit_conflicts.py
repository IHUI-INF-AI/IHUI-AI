# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""并行编辑冲突检测/消解 + 团队编排接入测试。

覆盖:
  ① 两个 agent 改同一文件不同区域 → merged,两份改动都在,应用顺序确定;
  ② 改同一区域 → conflict,整批不产出可写内容(无 last-write-wins);
  ③ 三方以上并发 → 决策确定(重复执行 / 顺序打乱结果一致);
  ④ 无法判定(base 缺失 / base 版本不符 / anchor 缺失或多处命中 /
     整文件覆盖与他人并存 / 意图损坏)→ replan_required,拒绝写入;
  ⑤ 冲突与消解决策写进审计 + 事件(可回答"为什么保留这份改动");
  ⑥ 路由 /teams/edits/resolve 的 0/409/422 映射。
"""

import hashlib

from app.routers import team_orchestration as router_module
from app.services.agent_edit_conflicts import (
    EditIntent,
    EditResolution,
    TeamEditAuditor,
    resolve_team_edit_conflicts,
)
from app.services.agent_teams import TeamContributor, TeamOrchestrator

BASE = "alpha\nbeta\ngamma\ndelta\n"


def _intent(
    agent: str,
    old: str,
    new: str,
    path: str = "app.py",
    *,
    replace_all: bool = False,
    base_revision: str = "",
) -> EditIntent:
    return EditIntent(
        agent=agent,
        path=path,
        old_string=old,
        new_string=new,
        replace_all=replace_all,
        base_revision=base_revision,
    )


class _Recorder:
    """审计出口替身:记录调用并返回固定条目 id。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def __call__(self, action, actor, target, detail):
        self.calls.append(
            {"action": action, "actor": actor, "target": target, "detail": detail}
        )
        return "audit-edit-1"


class _Sink:
    """事件出口替身。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def __call__(self, event_type, payload):
        self.calls.append({"event_type": event_type, "payload": payload})
        return "event-edit-1"


def _auditor(recorder: _Recorder | None = None, sink: _Sink | None = None) -> TeamEditAuditor:
    return TeamEditAuditor(
        sink=sink or _Sink(),
        recorder=recorder or _Recorder(),
    )


# ---------------------------------------------------------------------------
# ① 不同区域 → 合并
# ---------------------------------------------------------------------------


def test_disjoint_edits_merge_and_both_present() -> None:
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "BETA"), _intent("b", "delta", "DELTA")],
        {"app.py": BASE},
    )

    assert resolution.status == "merged"
    assert len(resolution.files) == 1
    file_result = resolution.files[0]
    assert file_result.status == "merged"
    assert file_result.content == "alpha\nBETA\ngamma\nDELTA\n"
    # 两份改动都在(不是"后写覆盖先写")
    assert "BETA" in (file_result.content or "")
    assert "DELTA" in (file_result.content or "")
    # 应用顺序:base 偏移从后往前(先 delta 后 beta),避免偏移漂移
    assert [item["agent"] for item in resolution.applied_edits] == ["b", "a"]
    assert file_result.base_revision[:16] == hashlib.sha256(BASE.encode()).hexdigest()[:16]


def test_adjacent_lines_are_disjoint() -> None:
    """行区间半开:上一行末尾与下一行开头相接不算重叠。"""
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "alpha", "ALPHA"), _intent("b", "beta", "BETA")],
        {"app.py": BASE},
    )
    assert resolution.status == "merged"
    assert resolution.files[0].content == "ALPHA\nBETA\ngamma\ndelta\n"


# ---------------------------------------------------------------------------
# ② 同一区域 → 冲突(不静默覆盖)
# ---------------------------------------------------------------------------


def test_same_region_conflict_is_reported_without_content() -> None:
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "A-WIN"), _intent("b", "beta", "B-WIN")],
        {"app.py": BASE},
    )

    assert resolution.status == "conflict"
    file_result = resolution.files[0]
    assert file_result.status == "conflict"
    # 关键:非 merged 时不提供任何可写内容 → 不存在"拿到空内容继续写盘"路径
    assert file_result.content is None
    assert resolution.applied_edits == []
    assert len(resolution.conflicts) == 1
    conflict = resolution.conflicts[0]
    assert conflict["agents"] == ["a", "b"]
    assert conflict["identical_replacement"] is False
    assert [r["start_line"] for r in conflict["regions"]] == [1, 1]
    assert "拒绝写入" in resolution.rationale
    assert "last-write-wins" in resolution.rationale


def test_same_region_identical_replacement_still_flags_conflict() -> None:
    """同区域即使替换文本相同也报冲突:同一行已被两个 agent 占用,必须显式裁决。"""
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "SAME"), _intent("b", "beta", "SAME")],
        {"app.py": BASE},
    )
    assert resolution.status == "conflict"
    assert resolution.conflicts[0]["identical_replacement"] is True
    assert resolution.files[0].content is None


def test_same_line_different_char_positions_is_conflict() -> None:
    """行粒度保守判据:同一行不同字符位置也算同区域,不做字符级缝隙合并。"""
    base = "value = old_a + old_b\n"
    resolution = resolve_team_edit_conflicts(
        [
            _intent("a", "old_a", "new_a"),
            _intent("b", "old_b", "new_b"),
        ],
        {"app.py": base},
    )
    assert resolution.status == "conflict"
    assert resolution.conflicts[0]["regions"][0]["start_line"] == 0
    assert resolution.conflicts[0]["regions"][1]["start_line"] == 0


# ---------------------------------------------------------------------------
# ③ 三方以上并发 → 决策确定
# ---------------------------------------------------------------------------


def test_three_agents_disjoint_is_deterministic() -> None:
    base = "l0\nl1\nl2\nl3\nl4\n"
    edits = [
        _intent("a", "l1", "L1"),
        _intent("b", "l2", "L2"),
        _intent("c", "l4", "L4"),
    ]

    first = resolve_team_edit_conflicts(edits, {"app.py": base})
    second = resolve_team_edit_conflicts(edits, {"app.py": base})
    shuffled = resolve_team_edit_conflicts(list(reversed(edits)), {"app.py": base})

    assert first.status == second.status == shuffled.status == "merged"
    assert first.files[0].content == "l0\nL1\nL2\nl3\nL4\n"
    assert first.to_dict() == second.to_dict() == shuffled.to_dict()


def test_three_agents_with_overlap_rejects_whole_batch() -> None:
    """a/b 重叠时,即使 c 的区域独立也不做部分写入(整批拒绝)。"""
    base = "l0\nl1\nl2\nl3\nl4\n"
    resolution = resolve_team_edit_conflicts(
        [
            _intent("a", "l1", "A"),
            _intent("b", "l1", "B"),
            _intent("c", "l4", "C"),
        ],
        {"app.py": base},
    )

    assert resolution.status == "conflict"
    assert resolution.applied_edits == []
    assert resolution.files[0].content is None
    # 只报真正重叠的那一对,不会把 c 误报成冲突方
    assert [c["agents"] for c in resolution.conflicts] == [["a", "b"]]


# ---------------------------------------------------------------------------
# ④ 无法判定 → replan_required
# ---------------------------------------------------------------------------


def _replan_reason(resolution: EditResolution, path: str = "app.py") -> set[str]:
    return {u["reason"] for u in resolution.undeterminable}


def test_missing_base_requires_replan() -> None:
    resolution = resolve_team_edit_conflicts([_intent("a", "beta", "B")], {})
    assert resolution.status == "replan_required"
    assert resolution.files[0].content is None
    assert _replan_reason(resolution) == {"base_missing"}


def test_stale_base_revision_requires_replan() -> None:
    stale = hashlib.sha256(b"another-version").hexdigest()
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "B", base_revision=stale)],
        {"app.py": BASE},
    )
    assert resolution.status == "replan_required"
    assert _replan_reason(resolution) == {"base_revision_mismatch"}


def test_anchor_not_in_base_requires_replan() -> None:
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "not-there", "X")], {"app.py": BASE}
    )
    assert resolution.status == "replan_required"
    assert _replan_reason(resolution) == {"anchor_not_in_base"}


def test_ambiguous_anchor_requires_replan() -> None:
    base = "dup\ndup\n"
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "dup", "X")], {"app.py": base}
    )
    assert resolution.status == "replan_required"
    assert _replan_reason(resolution) == {"ambiguous_anchor"}


def test_concurrent_overwrite_requires_replan() -> None:
    resolution = resolve_team_edit_conflicts(
        [
            EditIntent(agent="a", path="app.py", old_string="", new_string="whole-file"),
            _intent("b", "beta", "B"),
        ],
        {"app.py": BASE},
    )
    assert resolution.status == "replan_required"
    assert "concurrent_overwrite" in _replan_reason(resolution)
    assert resolution.files[0].content is None


def test_single_overwrite_without_peers_is_allowed() -> None:
    resolution = resolve_team_edit_conflicts(
        [EditIntent(agent="a", path="app.py", old_string="", new_string="whole-file")],
        {"app.py": BASE},
    )
    assert resolution.status == "merged"
    assert resolution.files[0].content == "whole-file"


def test_invalid_intent_forces_replan_and_is_not_dropped() -> None:
    resolution = resolve_team_edit_conflicts(
        [EditIntent(agent="a", path="", parse_error="缺少 path")],
        {"app.py": BASE},
    )
    assert resolution.status == "replan_required"
    assert _replan_reason(resolution) == {"invalid_intent"}
    assert resolution.undeterminable[0]["agent"] == "a"


def test_replace_all_is_supported_without_ambiguity() -> None:
    base = "dup\ndup\n"
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "dup", "X", replace_all=True)],
        {"app.py": base},
    )
    assert resolution.status == "merged"
    assert resolution.files[0].content == "X\nX\n"


# ---------------------------------------------------------------------------
# ⑤ 审计 / 事件留痕
# ---------------------------------------------------------------------------


async def test_conflict_resolution_is_audited_with_rationale() -> None:
    recorder = _Recorder()
    sink = _Sink()
    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "A"), _intent("b", "beta", "B")],
        {"app.py": BASE},
    )

    receipt = await _auditor(recorder, sink).record_resolution("team-1", "round-9", resolution)

    assert receipt["audit_id"] == "audit-edit-1"
    assert receipt["event_id"] == "event-edit-1"
    assert recorder.calls[0]["action"] == "team.edit_conflict_resolution"
    assert recorder.calls[0]["target"] == "team-1"
    detail = recorder.calls[0]["detail"]
    assert isinstance(detail, dict)
    assert detail["status"] == "conflict"
    assert detail["files"][0]["conflicts"][0]["agents"] == ["a", "b"]
    # "为什么保留/为什么拒绝"必须能从事后审计里读出来
    assert "拒绝写入" in str(detail["rationale"])
    assert sink.calls[0]["event_type"] == "subagent.edit_conflict_resolution"
    assert sink.calls[0]["payload"]["status"] == "conflict"


async def test_audit_failure_does_not_change_decision() -> None:
    def broken_recorder(action, actor, target, detail):
        raise RuntimeError("audit store down")

    resolution = resolve_team_edit_conflicts(
        [_intent("a", "beta", "BETA")], {"app.py": BASE}
    )
    receipt = await TeamEditAuditor(sink=_Sink(), recorder=broken_recorder).record_resolution(
        "team-1", "round-9", resolution
    )

    assert receipt["status"] == "merged"
    assert receipt["audit_id"] is None
    assert receipt["audit_error"] == "audit store down"
    assert resolution.status == "merged"


# ---------------------------------------------------------------------------
# 团队编排接入
# ---------------------------------------------------------------------------


async def _edit_runner(tasks, max_concurrency):
    return [
        TeamContributor(
            name=str(task.get("name", "")),
            task=str(task.get("task", "")),
            status="completed",
            output="ok",
            duration_ms=1.0,
            edits=[EditIntent.from_dict(raw) for raw in task.get("edits") or []],
        )
        for task in tasks
    ]


async def test_run_round_merges_disjoint_edits_and_reports_in_summary() -> None:
    orchestrator = TeamOrchestrator()

    result = await orchestrator.run_round(
        objective="并行改同一文件",
        tasks=[
            {
                "name": "a",
                "task": "改 beta",
                "edits": [
                    {"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "BETA"}
                ],
            },
            {
                "name": "b",
                "task": "改 delta",
                "edits": [
                    {"agent": "b", "path": "app.py", "old_string": "delta", "new_string": "DELTA"}
                ],
            },
        ],
        runner=_edit_runner,
        team_id="team-merge",
        edit_bases={"app.py": BASE},
        edit_auditor=_auditor(),
    )

    assert result.edit_resolution is not None
    assert result.edit_resolution["status"] == "merged"
    assert result.edit_resolution["files"][0]["content"] == "alpha\nBETA\ngamma\nDELTA\n"
    assert result.edit_resolution["audit"]["audit_id"] == "audit-edit-1"
    assert "并行编辑消解: merged" in result.summary_context
    assert result.aggregate["edit_resolution"]["status"] == "merged"


async def test_run_round_conflict_shows_up_in_summary_not_silently_written() -> None:
    orchestrator = TeamOrchestrator()

    result = await orchestrator.run_round(
        objective="并行改同一行",
        tasks=[
            {
                "name": "a",
                "task": "改 beta",
                "edits": [
                    {"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "A"}
                ],
            },
            {
                "name": "b",
                "task": "也改 beta",
                "edits": [
                    {"agent": "b", "path": "app.py", "old_string": "beta", "new_string": "B"}
                ],
            },
        ],
        runner=_edit_runner,
        team_id="team-conflict",
        edit_bases={"app.py": BASE},
        edit_auditor=_auditor(),
    )

    assert result.edit_resolution is not None
    assert result.edit_resolution["status"] == "conflict"
    assert result.edit_resolution["files"][0]["content"] is None
    assert "并行编辑消解: conflict" in result.summary_context
    assert "未写入 app.py" in result.summary_context


# ---------------------------------------------------------------------------
# ⑥ 路由:0 / 409 / 422
# ---------------------------------------------------------------------------


def _patch_auditor(monkeypatch, recorder: _Recorder, sink: _Sink) -> None:
    monkeypatch.setattr(router_module, "team_edit_auditor", _auditor(recorder, sink))


def _resolve_body(edits: list[dict], files: list[dict] | None = None) -> dict:
    return {
        "team_id": "team-route",
        "round_id": "round-route",
        "files": files if files is not None else [{"path": "app.py", "base": BASE}],
        "edits": edits,
    }


async def test_route_resolve_merged(client, monkeypatch) -> None:
    _patch_auditor(monkeypatch, _Recorder(), _Sink())

    resp = await client.post(
        "/api/orchestration/teams/edits/resolve",
        json=_resolve_body(
            [
                {"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "BETA"},
                {"agent": "b", "path": "app.py", "old_string": "delta", "new_string": "DELTA"},
            ]
        ),
    )
    payload = resp.json()

    assert payload["code"] == 0
    assert payload["message"] == "merged"
    assert payload["data"]["files"][0]["content"] == "alpha\nBETA\ngamma\nDELTA\n"
    assert payload["data"]["audit"]["audit_id"] == "audit-edit-1"


async def test_route_resolve_conflict_returns_409_without_content(client, monkeypatch) -> None:
    _patch_auditor(monkeypatch, _Recorder(), _Sink())

    resp = await client.post(
        "/api/orchestration/teams/edits/resolve",
        json=_resolve_body(
            [
                {"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "A"},
                {"agent": "b", "path": "app.py", "old_string": "beta", "new_string": "B"},
            ]
        ),
    )
    payload = resp.json()

    assert payload["code"] == 409
    assert payload["message"] == "conflict"
    assert payload["data"]["files"][0]["content"] is None
    assert payload["data"]["conflicts"][0]["agents"] == ["a", "b"]


async def test_route_resolve_replan_returns_422(client, monkeypatch) -> None:
    _patch_auditor(monkeypatch, _Recorder(), _Sink())

    resp = await client.post(
        "/api/orchestration/teams/edits/resolve",
        json=_resolve_body(
            [{"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "B"}],
            files=[],
        ),
    )
    payload = resp.json()

    assert payload["code"] == 422
    assert payload["message"] == "replan_required"
    assert payload["data"]["undeterminable"][0]["reason"] == "base_missing"


async def test_route_resolve_rejects_duplicate_base_path(client, monkeypatch) -> None:
    _patch_auditor(monkeypatch, _Recorder(), _Sink())

    resp = await client.post(
        "/api/orchestration/teams/edits/resolve",
        json=_resolve_body(
            [
                {"agent": "a", "path": "app.py", "old_string": "beta", "new_string": "B"},
                {"agent": "b", "path": "app.py", "old_string": "delta", "new_string": "D"},
            ],
            files=[
                {"path": "app.py", "base": BASE},
                {"path": "app.py", "base": BASE},
            ],
        ),
    )
    assert resp.json()["code"] == 400
    assert resp.json()["message"] == "duplicate_base_path"
