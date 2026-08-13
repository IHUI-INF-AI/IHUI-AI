"""eval 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

覆盖策略:mock 掉 eval_service 单例,直接调用端点 async 函数测
响应包装/HTTPException 错误分支/stub LLM 逻辑/结果字段转换。
"""

from __future__ import annotations

import types

import pytest
from fastapi import HTTPException

from app.routers import eval as eval_router
from app.routers.eval import (
    CompareRunsRequest,
    CreateDatasetRequest,
    RunEvalRequest,
    compare_eval_runs,
    create_dataset,
    create_eval_run,
    delete_dataset,
    get_dataset,
    get_eval_run,
    list_datasets,
    list_eval_runs,
)
from app.services.eval_service import EvalResult, EvalRun


def _make_run() -> EvalRun:
    """构造一个含 2 条结果的 EvalRun。"""
    return EvalRun(
        id="run-1",
        dataset_name="ds-1",
        model="gpt-4",
        prompt_name="qa",
        results=[
            EvalResult(
                input="你好",
                expected_output="世界",
                actual_output="stub response for: 你好",
                score=0.9,
                duration_ms=12.0,
                error=None,
            ),
            EvalResult(
                input="q2",
                expected_output="a2",
                actual_output="",
                score=0.0,
                duration_ms=3.5,
                error="timeout",
            ),
        ],
        avg_score=0.45,
        total_duration_ms=100.0,
        created_at="2026-08-13T00:00:00Z",
    )


@pytest.fixture(autouse=True)
def _mock_eval_service(monkeypatch):
    """默认 mock eval_service 单例(返回假数据)。"""
    svc = types.SimpleNamespace(
        list_datasets=lambda: [{"name": "ds-1", "item_count": 2}],
        create_dataset=lambda name, items, description: {
            "name": name,
            "description": description,
            "item_count": len(items),
        },
        get_dataset=lambda name: {"name": name, "item_count": 2} if name == "ds-1" else None,
        delete_dataset=lambda name: name == "ds-1",
        list_runs=lambda: [{"id": "run-1", "model": "gpt-4"}],
        get_run=lambda run_id: _make_run() if run_id == "run-1" else None,
        compare_runs=lambda run_ids: {"runs": run_ids, "winner": "run-1"},
    )
    # run_eval 单独处理(需要捕获 llm_complete_fn)
    svc.run_eval = None
    monkeypatch.setattr(eval_router, "eval_service", svc)
    return svc


# =============================================================================
# 数据集端点
# =============================================================================


async def test_list_datasets(_mock_eval_service):
    resp = await list_datasets()
    assert resp == {"code": 0, "message": "success", "data": [{"name": "ds-1", "item_count": 2}]}


async def test_create_dataset_success(_mock_eval_service):
    resp = await create_dataset(
        CreateDatasetRequest(name="ds-2", items=[{"input": "i1"}], description="d")
    )
    assert resp["code"] == 0
    assert resp["data"] == {"name": "ds-2", "description": "d", "item_count": 1}


async def test_create_dataset_conflict_409(_mock_eval_service):
    """重名数据集 → ValueError → 409。"""
    _mock_eval_service.create_dataset = lambda **kw: (_ for _ in ()).throw(
        ValueError("数据集已存在: ds-1")
    )
    with pytest.raises(HTTPException) as ei:
        await create_dataset(CreateDatasetRequest(name="ds-1"))
    assert ei.value.status_code == 409
    assert "数据集已存在" in ei.value.detail


async def test_get_dataset_found(_mock_eval_service):
    resp = await get_dataset("ds-1")
    assert resp["code"] == 0
    assert resp["data"]["name"] == "ds-1"


async def test_get_dataset_not_found_404(_mock_eval_service):
    with pytest.raises(HTTPException) as ei:
        await get_dataset("missing")
    assert ei.value.status_code == 404
    assert "数据集不存在" in ei.value.detail


async def test_delete_dataset_success(_mock_eval_service):
    resp = await delete_dataset("ds-1")
    assert resp == {"code": 0, "message": "success", "data": {"deleted": True}}


async def test_delete_dataset_not_found_404(_mock_eval_service):
    with pytest.raises(HTTPException) as ei:
        await delete_dataset("missing")
    assert ei.value.status_code == 404


# =============================================================================
# 评估运行端点
# =============================================================================


async def test_create_eval_run_success(_mock_eval_service):
    """EvalRun → 响应 data 字段转换(results 展平为 dict 列表)。"""
    captured = {}

    async def _fake_run_eval(**kw):
        captured.update(kw)
        return _make_run()

    _mock_eval_service.run_eval = _fake_run_eval
    resp = await create_eval_run(RunEvalRequest(dataset_name="ds-1", model="gpt-4", prompt_name="qa"))
    assert resp["code"] == 0
    data = resp["data"]
    assert data["id"] == "run-1"
    assert data["dataset_name"] == "ds-1"
    assert data["model"] == "gpt-4"
    assert data["avg_score"] == 0.45
    assert data["total_duration_ms"] == 100.0
    assert data["created_at"] == "2026-08-13T00:00:00Z"
    # results 被转换为纯 dict 列表
    assert data["results"][0] == {
        "input": "你好",
        "expected_output": "世界",
        "actual_output": "stub response for: 你好",
        "score": 0.9,
        "duration_ms": 12.0,
        "error": None,
    }
    assert data["results"][1]["error"] == "timeout"


async def test_create_eval_run_not_found_404(_mock_eval_service):
    """数据集不存在 → ValueError → 404。"""
    _mock_eval_service.run_eval = _fake_raise(ValueError("数据集不存在: ds-9"))
    with pytest.raises(HTTPException) as ei:
        await create_eval_run(RunEvalRequest(dataset_name="ds-9", model="gpt", prompt_name="p"))
    assert ei.value.status_code == 404
    assert "数据集不存在" in ei.value.detail


async def test_create_eval_run_stub_llm_logic(_mock_eval_service):
    """stub LLM 完成函数:取最后一条消息 content,前缀 stub response,截断 50 字符。"""
    captured = {}

    async def _fake_run_eval(**kw):
        captured["llm"] = kw["llm_complete_fn"]
        return _make_run()

    _mock_eval_service.run_eval = _fake_run_eval
    await create_eval_run(RunEvalRequest(dataset_name="ds-1", model="gpt", prompt_name="p"))
    fn = captured["llm"]

    # 空 messages → 空 content
    out = await fn([])
    assert out == {"content": "stub response for: ", "tool_calls": None}

    # 取最后一条消息 content
    out = await fn([{"content": "前一条"}, {"content": "实际内容"}])
    assert out["content"] == "stub response for: 实际内容"

    # 超过 50 字符被截断
    long_text = "x" * 100
    out = await fn([{"content": long_text}])
    assert out["content"] == "stub response for: " + "x" * 50


async def test_list_eval_runs(_mock_eval_service):
    resp = await list_eval_runs()
    assert resp["code"] == 0
    assert resp["data"] == [{"id": "run-1", "model": "gpt-4"}]


async def test_get_eval_run_found(_mock_eval_service):
    resp = await get_eval_run("run-1")
    assert resp["code"] == 0
    assert resp["data"]["id"] == "run-1"
    assert resp["data"]["results"][1]["error"] == "timeout"


async def test_get_eval_run_not_found_404(_mock_eval_service):
    with pytest.raises(HTTPException) as ei:
        await get_eval_run("run-999")
    assert ei.value.status_code == 404
    assert "评估运行不存在" in ei.value.detail


async def test_compare_eval_runs(_mock_eval_service):
    resp = await compare_eval_runs(CompareRunsRequest(run_ids=["run-1", "run-2"]))
    assert resp["code"] == 0
    assert resp["data"]["runs"] == ["run-1", "run-2"]
    assert resp["data"]["winner"] == "run-1"


def _fake_raise(exc):
    async def _f(*a, **k):
        raise exc

    return _f
