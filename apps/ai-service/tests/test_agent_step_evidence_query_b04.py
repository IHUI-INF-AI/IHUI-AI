# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""B04(2026-10-28 立)证据回指的**消费面**回归:录制步骤按账行编号反查。

前序格子(test_tool_invocation_ledger_b04.py 的 I3)只钉了"四键在归一化白名单里、
超长截断、缺省空串"—— 那是**写侧**形状。此处钉的是写完之后**读得出来**:

 J1 落盘往返:append_step 写进 step_records.json 的四要素,换一个进程内实例重读
    仍在(证据面靠文件持久化,不往返就等于重启即丢)。
 J2 按编号反查:同一编号落在不同 run 也查得到(B04 的编号是全局幂等键,不与 run 同域);
    未命中 found=false 且 total=0(不把"没有"说成"有一行")。
 J3 空/空白编号:不扫全表、不冒充命中(scanned_runs=0)—— 空串是"本次没派发"的
    合法值,拿它扫会把所有未标注步当命中。
 J4 limit 生效:total 报截断前命中数、list 报本轮实数(不静默少报)。
 J5 时间线消费点:GET /api/timeline 用的 `_step_event` meta 必须带四要素
    (此前只透传 decision/reason,前端指不回账行)。
 J6 路由消费点:GET /api/agent-recorder/invocations/{id}/steps 回 code=0 + 命中行,
    鉴权沿用 get_current_user_id(不新开匿名面)。

全程 tmp_path 文件 + 进程内记录器,不连库不发网(§5 测试隔离铁律)。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import step_recorder as step_recorder_router
from app.services import agent_step_recorder as asr
from app.services import agent_timeline
from app.services.agent_step_recorder import EVIDENCE_FIELDS, AgentStepRecorder

INV = "6f1b2c3d-0000-4000-8000-000000000001"
USER = "11111111-2222-4333-8444-555555555555"


def _evidence(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "invocation_id": INV,
        "permission_decision": "approved",
        "permission_cause": "",
        "operator_id": USER,
    }
    base.update(over)
    return base


def _recorder(tmp_path: Path) -> AgentStepRecorder:
    return AgentStepRecorder(file_path=tmp_path / "step_records.json")


# =============================================================================
# J1 落盘往返
# =============================================================================


def test_j1_evidence_quartet_survives_disk_roundtrip(tmp_path: Path) -> None:
    """四要素写进文件、换实例重读仍在(证据面持久化不丢键)。"""
    path = tmp_path / "step_records.json"
    rec = AgentStepRecorder(file_path=path)
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell", **_evidence()})

    raw = json.loads(path.read_text(encoding="utf-8"))
    stored = raw["run-a"]["steps"][0]
    for name in EVIDENCE_FIELDS:
        assert name in stored, f"落盘形状缺 {name}"
    assert stored["invocation_id"] == INV
    assert stored["operator_id"] == USER

    replay = AgentStepRecorder(file_path=path).replay("run-a")["steps"][0]
    assert replay["invocation_id"] == INV
    assert replay["permission_decision"] == "approved"


def test_j1b_missing_evidence_stays_empty_not_fabricated(tmp_path: Path) -> None:
    """未标注 = 空串(不编造编号/身份),且空编号不会被反查当成命中。"""
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell"})
    step = rec.replay("run-a")["steps"][0]
    assert [step[name] for name in EVIDENCE_FIELDS] == ["", "", "", ""]
    assert rec.get_steps_by_invocation_id("")["found"] is False


# =============================================================================
# J2 按编号反查(跨 run)
# =============================================================================


def test_j2_lookup_finds_step_across_runs(tmp_path: Path) -> None:
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell", **_evidence()})
    rec.append_step(
        "run-b",
        {"type": "tool", "tool_name": "read_file", **_evidence(invocation_id="other-inv")},
    )
    rec.append_step("run-b", {"type": "tool", "tool_name": "edit_file", **_evidence()})

    hit = rec.get_steps_by_invocation_id(INV)
    assert hit["found"] is True
    assert hit["total"] == 2
    assert hit["invocation_id"] == INV
    assert {row["run_id"] for row in hit["list"]} == {"run-a", "run-b"}
    assert {row["tool_name"] for row in hit["list"]} == {"shell", "edit_file"}
    # 回指行本身要带得出四要素(消费方拿它去对账行)
    assert all(row["permission_decision"] == "approved" for row in hit["list"])


def test_j2b_lookup_miss_reports_zero_not_a_fake_row(tmp_path: Path) -> None:
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell", **_evidence()})
    miss = rec.get_steps_by_invocation_id("no-such-invocation")
    assert miss == {
        "invocation_id": "no-such-invocation",
        "found": False,
        "total": 0,
        "list": [],
        "scanned_runs": 1,
    }


# =============================================================================
# J3 空编号不扫全表
# =============================================================================


@pytest.mark.parametrize("blank", ["", "   ", "\t\n"])
def test_j3_blank_invocation_does_not_scan(tmp_path: Path, blank: str) -> None:
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell", **_evidence()})
    out = rec.get_steps_by_invocation_id(blank)
    assert out["found"] is False
    assert out["total"] == 0
    assert out["scanned_runs"] == 0, "空编号必须就地返回,不许拿它去扫全表"


# =============================================================================
# J4 limit / total 口径
# =============================================================================


def test_j4_limit_truncates_list_but_total_reports_real_hits(tmp_path: Path) -> None:
    rec = _recorder(tmp_path)
    for i in range(3):
        rec.append_step(f"run-{i}", {"type": "tool", "tool_name": "shell", **_evidence()})
    out = rec.get_steps_by_invocation_id(INV, limit=2)
    assert out["total"] == 3, "total 报的是截断前的真实命中数"
    assert len(out["list"]) == 2, "list 报本轮实数"
    # 上限钳制:超 PAGE_SIZE_MAX 的入参不得放大扫描面
    assert rec.get_steps_by_invocation_id(INV, limit=10**6)["total"] == 3
    assert rec.get_steps_by_invocation_id(INV, limit=0)["total"] == 3


# =============================================================================
# J5 时间线消费点
# =============================================================================


def test_j5_timeline_meta_carries_evidence_quartet(tmp_path: Path) -> None:
    """`_step_event` 是 GET /api/timeline 的 step 投影:四要素必须进 meta。"""
    step = asr._normalize_step({"type": "tool", "tool_name": "shell", **_evidence()}, 0)
    event = agent_timeline._step_event(step)
    meta = event["meta"]
    for name in EVIDENCE_FIELDS:
        assert meta[name] == step[name]
    assert meta["invocation_id"] == INV
    assert meta["operator_id"] == USER
    assert event["ref_id"] == "step-0", "ref_id 语义不动(前端按 step-N 寻址)"


def test_j5b_timeline_meta_blank_when_not_dispatched() -> None:
    """未派发的步在 meta 里是空串,不是缺键、也不是假的编号。"""
    step = asr._normalize_step({"type": "tool", "tool_name": "shell"}, 0)
    meta = agent_timeline._step_event(step)["meta"]
    assert [meta[name] for name in EVIDENCE_FIELDS] == ["", "", "", ""]


# =============================================================================
# J6 路由消费点
# =============================================================================


@pytest.fixture
def api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    rec.append_step("run-a", {"type": "tool", "tool_name": "shell", **_evidence()})
    monkeypatch.setattr(step_recorder_router, "agent_step_recorder", rec)
    app = FastAPI()
    app.include_router(step_recorder_router.router, prefix="/api")

    async def _uid() -> str:
        return USER

    app.dependency_overrides[get_current_user_id] = _uid
    return app


async def test_j6_router_returns_hits(api: FastAPI) -> None:
    transport = ASGITransport(app=api)
    async with AsyncClient(transport=transport, base_url="http://t") as client:
        resp = await client.get(f"/api/agent-recorder/invocations/{INV}/steps")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["found"] is True and data["total"] == 1
    assert data["list"][0]["run_id"] == "run-a"
    assert data["list"][0]["invocation_id"] == INV


async def test_j6b_router_miss_is_200_found_false(api: FastAPI) -> None:
    """未命中不是 404:查不到是正常结论(与 replay 越界 found=false 同形)。"""
    transport = ASGITransport(app=api)
    async with AsyncClient(transport=transport, base_url="http://t") as client:
        resp = await client.get("/api/agent-recorder/invocations/nope/steps")
    assert resp.status_code == 200
    assert resp.json()["data"]["found"] is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
