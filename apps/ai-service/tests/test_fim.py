# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/fim.py 单元测试:FIM 代码补全端点。

测试覆盖:
- POST /api/llm/fim:正常补全(stub 模式)/ 空 prefix 短路 / 网关异常静默降级
- 响应契约:{code, message, data:{completion, model, latency_ms, stub}}
- 请求模型校验:prefix 必填 → 422;max_tokens 越界 → 422

测试隔离:monkeypatch llm_gateway.complete(AsyncMock),不调用真实 LLM。
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from app.routers import fim


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件(与 test_tools_router 同规则)。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")



async def test_fim_normal_completion(client, monkeypatch):
    """正常补全:返回 {code:0, completion 非空, latency_ms 非负}。"""
    mock = AsyncMock(return_value={"content": "return a + b", "model": "stub-model", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    resp = await client.post(
        "/api/llm/fim",
        json={"prefix": "def add(a, b):\n    ", "suffix": "\n", "language": "python"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["completion"] == "return a + b"
    assert data["model"] == "stub-model"
    assert data["latency_ms"] >= 0
    # 补全调用必须是 temperature=0 + 小 max_tokens(低延迟约束)
    kwargs = mock.call_args.kwargs
    assert kwargs["temperature"] == 0.0
    assert kwargs["max_tokens"] == 128



async def test_fim_empty_prefix_short_circuit(client):
    """空 prefix 短路:不调网关,直接返回空 completion。"""
    resp = await client.post("/api/llm/fim", json={"prefix": ""})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["completion"] == ""



async def test_fim_gateway_exception_silent_degrade(client, monkeypatch):
    """网关异常:补全失败静默降级为空 completion(绝不打断打字流)。"""
    monkeypatch.setattr(
        fim.llm_gateway, "complete", AsyncMock(side_effect=RuntimeError("upstream boom"))
    )
    resp = await client.post("/api/llm/fim", json={"prefix": "const x = "})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["completion"] == ""



async def test_fim_strips_markdown_fences(client, monkeypatch):
    """模型偶发输出 ``` 围栏:剥离后返回纯代码。"""
    mock = AsyncMock(return_value={"content": "```ts\nconst a = 1;\n```", "model": "m", "stub": False})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    resp = await client.post("/api/llm/fim", json={"prefix": "x"})
    data = resp.json()["data"]
    assert data["completion"] == "const a = 1;"



async def test_fim_validation_errors(client):
    """schema 校验:缺 prefix → 422;max_tokens 超上限 → 422。"""
    resp = await client.post("/api/llm/fim", json={"suffix": "x"})
    assert resp.status_code == 422
    resp = await client.post("/api/llm/fim", json={"prefix": "x", "max_tokens": 9999})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 补全接受率闭环(2026-09-13 P1-9)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_fim_metrics():
    """指标是进程内全局状态,每个用例前后清空,保证测试相互隔离。

    同时重置 Redis 持久化状态并默认关闭 _use_redis:
    既有用例在纯内存模式运行(行为与持久化改造前一致),Redis 相关用例自行开启。
    """
    fim._METRICS_BY_MODEL.clear()
    fim._restored = False
    fim._redis_client = None
    fim._use_redis = False
    yield
    fim._METRICS_BY_MODEL.clear()
    fim._restored = False
    fim._redis_client = None
    fim._use_redis = False


async def test_fim_metrics_aggregates_by_model(client):
    """两次增量上报 → 汇总为累计值,接受率/延迟分位正确。"""
    await client.post(
        "/api/llm/fim/metrics",
        json={
            "model": "codestral-latest",
            "requestCount": 3,
            "suggestionCount": 2,
            "acceptedCount": 1,
            "failureCount": 1,
            "latencyMs": [10, 20, 30],
        },
    )
    await client.post(
        "/api/llm/fim/metrics",
        json={
            "model": "codestral-latest",
            "requestCount": 1,
            "suggestionCount": 1,
            "acceptedCount": 1,
            "latencyMs": [40, 50],
        },
    )
    resp = await client.get("/api/llm/fim/metrics/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0 and body["message"] == "ok"
    rows = body["data"]["models"]
    assert len(rows) == 1
    row = rows[0]
    assert row["model"] == "codestral-latest"
    assert row["requests"] == 4
    assert row["suggestions"] == 3
    assert row["accepted"] == 2
    assert row["acceptanceRate"] == pytest.approx(2 / 3)
    assert row["failures"] == 1
    # 延迟 [10,20,30,40,50] → p50=30;p95 线性插值 40+(50-40)*0.8=48
    assert row["p50LatencyMs"] == 30
    assert row["p95LatencyMs"] == 48
    assert row["alert"] is False  # suggestions=3 < 20,样本不足


@pytest.mark.parametrize(
    "suggestions,accepted,expected_alert",
    [
        (19, 0, False),  # 建议数 19 < 20:样本不足,不告警
        (20, 5, True),  # rate=0.25 < 0.3 且样本达标 → 告警
        (20, 6, False),  # rate=0.30 不满足严格小于 → 不告警
        (100, 29, True),  # rate=0.29 → 告警
        (100, 31, False),  # rate=0.31 → 不告警
    ],
)
async def test_fim_metrics_alert_threshold(
    client, suggestions: int, accepted: int, expected_alert: bool
):
    """告警阈值边界:suggestions >= 20 且 acceptanceRate < 0.3。"""
    await client.post(
        "/api/llm/fim/metrics",
        json={
            "model": "m",
            "requestCount": suggestions,
            "suggestionCount": suggestions,
            "acceptedCount": accepted,
        },
    )
    row = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"][0]
    assert row["alert"] is expected_alert
    if expected_alert:
        assert row["alertReason"]
    else:
        assert row["alertReason"] is None


async def test_fim_metrics_latency_null_when_no_samples(client):
    """无延迟样本时 p50/p95 返回 null,接受率为 1.0。"""
    await client.post(
        "/api/llm/fim/metrics",
        json={"model": "m", "suggestionCount": 1, "acceptedCount": 1},
    )
    row = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"][0]
    assert row["p50LatencyMs"] is None
    assert row["p95LatencyMs"] is None
    assert row["acceptanceRate"] == 1.0


async def test_fim_metrics_empty_summary_no_crash(client):
    """无任何上报时汇总为空列表,不崩。"""
    resp = await client.get("/api/llm/fim/metrics/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["models"] == []


async def test_fim_metrics_default_model_is_auto(client):
    """缺省 model → 归入 'auto' 桶(后端自选模型)。"""
    await client.post("/api/llm/fim/metrics", json={"requestCount": 1})
    row = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"][0]
    assert row["model"] == "auto"


# ---------------------------------------------------------------------------
# 补全专用档位选型(P1-9):_resolve_fim_model 接线
# ---------------------------------------------------------------------------


async def test_fim_uses_env_preferred_model(client, monkeypatch):
    """env FIM_PREFERRED_MODEL 最高优先级 → 直接作为补全模型。"""
    monkeypatch.setenv("FIM_PREFERRED_MODEL", "codestral-latest")
    mock = AsyncMock(return_value={"content": "x", "model": "codestral-latest", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    await client.post("/api/llm/fim", json={"prefix": "a"})
    assert mock.call_args.args[1] == "codestral-latest"


async def test_fim_uses_candidate_fim_model(client, monkeypatch):
    """env 未设 + auto → 取候选清单首个 fim 模型。"""
    monkeypatch.delenv("FIM_PREFERRED_MODEL", raising=False)
    monkeypatch.setattr(
        fim, "_load_fim_candidates", lambda: [{"id": "qwen2.5-coder-7b", "fim": True}]
    )
    mock = AsyncMock(return_value={"content": "c", "model": "qwen2.5-coder-7b", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    await client.post("/api/llm/fim", json={"prefix": "a"})
    assert mock.call_args.args[1] == "qwen2.5-coder-7b"


async def test_fim_explicit_model_wins_over_candidates(client, monkeypatch):
    """用户显式指定 model → 优先于候选清单。"""
    monkeypatch.delenv("FIM_PREFERRED_MODEL", raising=False)
    monkeypatch.setattr(
        fim, "_load_fim_candidates", lambda: [{"id": "qwen2.5-coder-7b", "fim": True}]
    )
    mock = AsyncMock(return_value={"content": "c", "model": "gpt-4o", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    await client.post("/api/llm/fim", json={"prefix": "a", "model": "gpt-4o"})
    assert mock.call_args.args[1] == "gpt-4o"


async def test_fim_falls_back_to_auto_without_fim_candidates(client, monkeypatch):
    """候选清单无 fim 模型 → 回退 'auto'。"""
    monkeypatch.delenv("FIM_PREFERRED_MODEL", raising=False)
    monkeypatch.setattr(fim, "_load_fim_candidates", lambda: [{"id": "gpt-4o", "fim": False}])
    mock = AsyncMock(return_value={"content": "c", "model": "auto", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    await client.post("/api/llm/fim", json={"prefix": "a"})
    assert mock.call_args.args[1] == "auto"


async def test_fim_candidate_load_failure_degrades_to_auto(client, monkeypatch):
    """候选加载抛异常 → 静默回退 'auto',补全照常返回。"""
    monkeypatch.delenv("FIM_PREFERRED_MODEL", raising=False)

    def _boom() -> list:
        raise RuntimeError("candidates boom")

    monkeypatch.setattr(fim, "_load_fim_candidates", _boom)
    mock = AsyncMock(return_value={"content": "c", "model": "auto", "stub": True})
    monkeypatch.setattr(fim.llm_gateway, "complete", mock)
    resp = await client.post("/api/llm/fim", json={"prefix": "a"})
    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    assert mock.call_args.args[1] == "auto"


# ---------------------------------------------------------------------------
# Redis 持久化(2026-09-14,H2 收尾):写穿 + 惰性恢复 + 静默降级
# 不依赖真实 Redis:极简 in-memory FakeRedis 替身(与 test_file_editor_redis 同规则)
# ---------------------------------------------------------------------------


class _FakeRedis:
    """极简 async get/set 替身,覆盖 fim.py 用到的命令。"""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str):
        self.store[key] = value
        return True


class _BrokenRedis(_FakeRedis):
    """读写一律抛异常的替身,验证静默降级。"""

    async def get(self, key: str):
        raise ConnectionError("redis get boom")

    async def set(self, key: str, value: str):
        raise ConnectionError("redis set boom")


@pytest.fixture
def fake_redis(monkeypatch) -> _FakeRedis:
    """开启 Redis 持久化并注入替身客户端。"""
    r = _FakeRedis()
    monkeypatch.setattr(fim, "_use_redis", True)
    monkeypatch.setattr(fim, "_redis_client", r)
    return r


async def test_fim_metrics_redis_write_through(client, fake_redis):
    """上报后全量快照写穿 Redis:JSON 内计数与内存一致。"""
    await client.post(
        "/api/llm/fim/metrics",
        json={"model": "m1", "requestCount": 3, "suggestionCount": 2, "acceptedCount": 1, "latencyMs": [100, 200]},
    )
    raw = fake_redis.store.get(fim._FIM_METRICS_REDIS_KEY)
    assert raw is not None
    data = json.loads(raw)
    assert data["m1"]["requests"] == 3
    assert data["m1"]["accepted"] == 1
    assert data["m1"]["latencies"] == [100.0, 200.0]


async def test_fim_metrics_redis_restore_on_first_access(client, fake_redis):
    """重启模拟:内存清零 + _restored 复位后,首次访问从 Redis 恢复(计数叠加正确)。"""
    fake_redis.store[fim._FIM_METRICS_REDIS_KEY] = json.dumps(
        {
            "m-restore": {
                "requests": 7,
                "suggestions": 5,
                "accepted": 4,
                "dismissed": 1,
                "failures": 0,
                "cancellations": 0,
                "cacheHits": 2,
                "latencies": [150.0, 700.0],
            }
        }
    )
    resp = await client.get("/api/llm/fim/metrics/summary")
    assert resp.status_code == 200
    rows = resp.json()["data"]["models"]
    assert len(rows) == 1
    row = rows[0]
    assert row["model"] == "m-restore"
    assert row["requests"] == 7
    assert row["suggestions"] == 5
    assert row["accepted"] == 4
    assert row["acceptanceRate"] == 0.8
    # 2 样本 [150,700] 线性插值:p50=(150+700)/2=425;p95=150+550*0.95=672.5→round 银行家舍入 672
    assert row["p50LatencyMs"] == 425
    assert row["p95LatencyMs"] == 672


async def test_fim_metrics_restore_merges_with_new_reports(client, fake_redis):
    """恢复与新上报叠加不丢数:Redis 旧值 + 本次增量 = 累计值,且恢复只执行一次。"""
    fake_redis.store[fim._FIM_METRICS_REDIS_KEY] = json.dumps(
        {"m-merge": {"requests": 10, "suggestions": 0, "accepted": 0, "dismissed": 0, "failures": 0, "cancellations": 0, "cacheHits": 0, "latencies": []}}
    )
    await client.post("/api/llm/fim/metrics", json={"model": "m-merge", "requestCount": 2})
    rows = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"]
    assert rows[0]["requests"] == 12


async def test_fim_metrics_redis_outage_silent_degrade(client, monkeypatch):
    """Redis 读写异常 → 上报/汇总照常 200,纯内存行为不变(绝不外抛)。"""
    broken = _BrokenRedis()
    monkeypatch.setattr(fim, "_use_redis", True)
    monkeypatch.setattr(fim, "_redis_client", broken)
    resp = await client.post("/api/llm/fim/metrics", json={"model": "m-out", "requestCount": 1, "latencyMs": [50]})
    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    rows = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"]
    assert rows[0]["model"] == "m-out"
    assert rows[0]["requests"] == 1


async def test_fim_metrics_no_redis_pure_memory(client):
    """_use_redis=False(未配置/降级)→ 行为与改造前完全一致,不触碰 Redis。"""
    await client.post("/api/llm/fim/metrics", json={"model": "m-mem", "requestCount": 1})
    rows = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"]
    assert rows[0]["model"] == "m-mem"


async def test_fim_metrics_models_cap(client):
    """伪造 51 个不同 model → 聚合模型数封顶 50,超限上报被忽略但不报错。"""
    for i in range(51):
        resp = await client.post("/api/llm/fim/metrics", json={"model": f"m-cap-{i}", "requestCount": 1})
        assert resp.status_code == 200
    rows = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"]
    assert len(rows) == fim._METRICS_MODELS_CAP
    # 既有 model 不受封顶影响:封顶后对已存在 model 的上报仍生效
    resp = await client.post("/api/llm/fim/metrics", json={"model": "m-cap-0", "requestCount": 5})
    assert resp.json()["code"] == 0
    rows = (await client.get("/api/llm/fim/metrics/summary")).json()["data"]["models"]
    target = next(r for r in rows if r["model"] == "m-cap-0")
    assert target["requests"] == 6
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
