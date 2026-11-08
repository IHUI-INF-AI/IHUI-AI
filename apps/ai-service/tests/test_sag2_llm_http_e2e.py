# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 遗留项 C：真实 LLM / HTTP 链路端到端（真实 TCP + 真实 HTTP + 真实 JSON/schema）。

本文件**不是** Fake 契约测试。它在 127.0.0.1:<随机端口> 起一个真实
OpenAI-compatible ``/v1/chat/completions`` 服务（标准库
``http.server.ThreadingHTTPServer``），让整条判定链路走真实网络栈：

    Sag2LexicalService.retrieve(query, Sag2Options)          真实主循环（retrieval.py）
      -> ModelJudge.score(question, candidates, evidence)    真实 provider（judge.py）
        -> LlmGatewayJudgeAdapter.structured_completion(      真实适配层（gateway_adapter.py）
              payload, model)                                组装 messages + JSON Schema
          -> llm_gateway.structured_completion(messages,     真实签名（app/core/llm_gateway.py）
              schema, model)                                json.loads + required/additionalProperties 校验
            -> llm_gateway.complete(messages, model,         真实 HTTP 出口
                  response_format=...)
              -> litellm.acompletion(**call_kwargs)          真实 OpenAI SDK / httpx
                -> POST http://127.0.0.1:<port>             真实 TCP socket + 真实 HTTP 请求/响应
                     /v1/chat/completions                   真实 JSON 序列化 / 解析
        -> _normalize -> {"scores": [...]} -> JudgeVerdict  真实归一 + 真实遥测 record()
      -> candidate.score = verdict.scores[key]              判定分真实进入排序（rank/diversify）
      -> Sag2Result(judge_mode/judge_executed/trace/paths)  真实留痕

唯一被注入的一层（**不是 Fake**）：
    * ``LLMGateway._is_stub_mode`` -> False：本机没有外部 LLM key，原实现会因
      VENDOR_ENV_KEYS 全空判定为 stub、直接返回模拟文本、不发任何网络请求。
      置 False 才让 complete() 走真实 litellm 出口。
    * ``llm_gateway._resolve`` -> 从测试 env 读 (token, base_url, model)：
      原实现从 BYOK / 号池 / .env 三级解析 api_key + api_base + litellm_model；
      这里只把**网络出口地址**指向本地 server、把凭据换成进程内随机 token。
    * 埋点 / DB / fallback 隔离、短 timeout 注入（仅超时用例）、proxy 清理：
      测试环境隔离，保证不碰外部系统、不连生产库、超时可在本地复现。
保留真实：litellm.acompletion、httpx 真实序列化与 TCP I/O、structured_completion
的 json.loads + schema 校验、适配器归一、ModelJudge、_record_metrics、retrieve 主循环。

边界（不可越界声明）：本文件证明的是「协议 / 序列化 / 超时 / 畸形响应 / 降级链路
在真实 I/O 下成立」。它**不能**证明「真实商业 LLM 的打分质量」——后者需要外部
API key，本机不可得，属资源边界而非代码缺陷，绝不伪装成已验证。

严禁硬编码真实凭据：token 由 secrets.token_hex 在进程内随机生成，仅经 env 注入；
server 用 127.0.0.1:0 随机端口，fixture 负责 shutdown。
"""

from __future__ import annotations

import asyncio
import json
import os
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
from typing import Any

import pytest

import app.core.llm_gateway as lgw
from app.services.sag2_lexical import gateway_adapter as ga
from app.services.sag2_lexical.index import LexicalIndex
from app.services.sag2_lexical.judge import (
    MODE_LEXICAL_ONLY,
    MODE_MODEL,
    MODE_UNAVAILABLE,
)
from app.services.sag2_lexical.metrics import judge_metrics, reset_judge_metrics
from app.services.sag2_lexical.retrieval import Sag2Options
from app.services.sag2_lexical.service import Sag2LexicalService

# 通过 env 注入到真实适配器链路（见模块 docstring）。
_BASE_URL_ENV = "SAG2_E2E_LLM_BASE_URL"
_TOKEN_ENV = "SAG2_E2E_LLM_TOKEN"
_MODEL = "openai/gpt-4o-mini"  # OpenAI-compatible 前缀，litellm 才会用 api_base 发真实 HTTP
_SHORT_TIMEOUT = 0.6

_QUERY = "量子"
_DOCS = [
    (f"kb/d{i:02d}.txt", f"量子计算进展报告编号{i}：量子比特与量子纠错研究。")
    for i in range(4)
]


def _options() -> Sag2Options:
    # max_hops=0：单轮判定，pool 与 candidate keys 稳定，便于钉死「分数影响结果」。
    return Sag2Options(candidate_k=100, seed_k=10, max_hops=0, top_k=10)


def _make_index() -> LexicalIndex:
    index = LexicalIndex()
    for path, content in _DOCS:
        index.add_document(path, content)
    return index


def _candidate_keys(body: Any) -> list[str]:
    """从真实 HTTP 请求体里解出 ModelJudge payload 的 candidates keys。

    ``_build_messages`` 把 candidates 放进 user message 的 JSON 文本里；这里做真实解析，
    供 server 生成与候选 key 一一对应的分数（而不是返回无关占位 key）。
    """
    if not isinstance(body, dict):
        return []
    for msg in body.get("messages", []) or []:
        if not isinstance(msg, dict):
            continue
        try:
            obj = json.loads(msg.get("content", ""))
        except (TypeError, ValueError):
            continue
        if isinstance(obj, dict) and "candidates" in obj:
            return [str(c.get("key")) for c in obj["candidates"]]
    return []


def _content_for(mode: str, strategy: str, keys: list[str]) -> str:
    """按场景生成 OpenAI chat completion 的 message.content（真实 JSON 字符串）。"""
    ordered = sorted(keys)
    if mode == "malformed_json":
        return "NOT_JSON_<<<"  # 合法 OpenAI 响应，但 content 不是 JSON
    if mode == "missing_scores":
        return json.dumps({"answer": "x"})  # 缺 required: scores
    if mode == "schema_mismatch":
        return json.dumps({"scores": [], "extra": 1})  # additionalProperties: False 违规
    if not ordered:
        return json.dumps({"scores": []})
    hi: str | None
    if strategy == "last_high":
        hi = ordered[-1]
    elif strategy == "flat":
        hi = None
    else:  # first_high
        hi = ordered[0]
    scores = [
        {
            "key": k,
            "score": 0.95 if k == hi else (0.7 if strategy == "flat" else 0.05),
        }
        for k in ordered
    ]
    return json.dumps({"scores": scores})


class _Handler(BaseHTTPRequestHandler):
    """真实 HTTP handler：记录请求、按场景返回真实 OpenAI-compatible 响应体。"""

    def do_POST(self) -> None:  # noqa: N802 - http.server 约定名
        ctl: _LocalOpenAIServer = self.server.controller  # type: ignore[attr-defined]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            body: Any = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            body = None
        with ctl._lock:
            ctl.hits += 1
            mode = ctl._mode
            strategy = ctl._score_strategy
            ctl.requests.append(
                {
                    "path": self.path,
                    "method": "POST",
                    "authorization": self.headers.get("Authorization", ""),
                    "content_type": self.headers.get("Content-Type", ""),
                    "body": body,
                }
            )
        if mode == "timeout":
            # 真实延迟，让 litellm 客户端真实超时（client 断开后写响应会抛
            # ConnectionAbortedError，由 _send 静默吞掉，属正常超时路径）。
            time.sleep(2.0)
        if mode == "error_500":
            ctl._send(
                self,
                500,
                {"error": {"message": "injected server error", "type": "server_error"}},
            )
            return
        keys = _candidate_keys(body)
        content = _content_for(mode, strategy, keys)
        ctl._send(
            self,
            200,
            {
                "id": "chatcmpl-e2e",
                "object": "chat.completion",
                "created": 0,
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 1,
                    "total_tokens": 2,
                },
            },
        )

    def log_message(self, *args: Any) -> None:
        return  # 不打访问日志，保持 pytest 输出干净


class _LocalOpenAIServer:
    """127.0.0.1:0 随机端口的真实 OpenAI-compatible HTTP 服务（线程后台）。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.hits = 0
        self.requests: list[dict[str, Any]] = []
        self._mode = "ok"
        self._score_strategy = "first_high"
        self._srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._srv.daemon_threads = True  # 超时线程不阻塞 shutdown / 进程退出
        self._srv.controller = self  # type: ignore[attr-defined]
        self.port = self._srv.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}/v1"
        self._thread = threading.Thread(target=self._srv.serve_forever, daemon=True)
        self._thread.start()

    @staticmethod
    def _send(handler: BaseHTTPRequestHandler, code: int, obj: Any) -> None:
        data = json.dumps(obj).encode("utf-8")
        try:
            handler.send_response(code)
            handler.send_header("Content-Type", "application/json")
            handler.send_header("Content-Length", str(len(data)))
            handler.end_headers()
            handler.wfile.write(data)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
            pass  # 超时后 client 已断开，属预期

    def set_mode(self, mode: str, strategy: str = "first_high") -> None:
        with self._lock:
            self._mode = mode
            self._score_strategy = strategy

    def snapshot(self) -> tuple[int, list[dict[str, Any]]]:
        with self._lock:
            return self.hits, list(self.requests)

    def close(self) -> None:
        self._srv.shutdown()
        self._srv.server_close()
        self._thread.join(timeout=2)


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def http_server():
    srv = _LocalOpenAIServer()
    yield srv
    srv.close()


@pytest.fixture(autouse=True)
def _isolate_sag2(monkeypatch: pytest.MonkeyPatch):
    for key in (
        "SAG2_JUDGE_ENABLED",
        "SAG2_JUDGE_MODEL",
        _BASE_URL_ENV,
        _TOKEN_ENV,
    ):
        monkeypatch.delenv(key, raising=False)
    reset_judge_metrics()
    monkeypatch.setattr(ga, "last_resolve_reason", ga.DISABLED_REASON)


@pytest.fixture
def wired(monkeypatch: pytest.MonkeyPatch, http_server: _LocalOpenAIServer):
    """把真实适配器链路的**网络出口地址 / 凭据来源**注入到本地 server。

    见模块 docstring：不改 llm_gateway.structured_completion / complete / litellm /
    适配器 / ModelJudge / retrieve 任何一层，只让它们真的把 HTTP 发到本机。
    """
    token = secrets.token_hex(8)  # 进程内随机 token，绝不硬编码真实凭据
    monkeypatch.setenv("SAG2_JUDGE_ENABLED", "1")
    monkeypatch.setenv("SAG2_JUDGE_MODEL", _MODEL)
    monkeypatch.setenv(_BASE_URL_ENV, http_server.base_url)
    monkeypatch.setenv(_TOKEN_ENV, token)
    # 清代理：llm_gateway 模块导入期可能 setdefault 了真实代理，litellm 会走它。
    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "http_proxy",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
        "NO_PROXY",
    ):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("NO_PROXY", "127.0.0.1,localhost")

    # 测试隔离：埋点 / 失败流水 / fallback / combo 不碰生产库、不连外部厂商。
    monkeypatch.setattr(lgw, "record_llm_outcome", lambda *a, **k: None)
    monkeypatch.setattr(lgw, "_emit_llm_call_log", lambda *a, **k: None)
    monkeypatch.setattr(lgw, "_get_combo_router", lambda: None)
    monkeypatch.setattr(lgw, "is_quota_exhaustion_error", lambda e: False)

    async def _no_external_fallback(*a: Any, **k: Any) -> dict[str, Any]:
        return {"error": True, "error_message": "e2e-isolated"}

    if hasattr(lgw, "fallback_router"):
        monkeypatch.setattr(
            lgw.fallback_router, "complete_with_fallback", _no_external_fallback
        )

    # 注入 1：模式判定。无 vendor key 时原实现走 stub，不发任何网络请求。
    monkeypatch.setattr(
        type(lgw.llm_gateway),
        "_is_stub_mode",
        staticmethod(lambda: False),
    )

    # 注入 2：只替换「网络出口地址 / 凭据 / 模型名」的解析来源（三级解析 -> 测试 env）。
    async def _resolve_from_env(model: str, owner_uuid: str | None = None):
        return (
            os.environ[_TOKEN_ENV],
            os.environ[_BASE_URL_ENV],
            os.environ["SAG2_JUDGE_MODEL"],
            None,
            None,
        )

    monkeypatch.setattr(lgw.llm_gateway, "_resolve", _resolve_from_env)

    def enable_short_timeout(seconds: float = _SHORT_TIMEOUT) -> None:
        """仅超时用例：在真实的 capability 过滤之后把 client timeout 调小。

        保留原 filter_call_kwargs 的全部行为，只是在最后注入短超时，让 server
        的真实延迟触发 litellm 真实超时（不是 mock 出来的假超时）。
        """
        original = lgw.filter_call_kwargs

        def with_short(call_kwargs: dict, provider_code: str, used_model: str) -> None:
            original(call_kwargs, provider_code, used_model)
            call_kwargs["timeout"] = seconds

        monkeypatch.setattr(lgw, "filter_call_kwargs", with_short)

    def build_service() -> Sag2LexicalService:
        real = ga.resolve_sag2_gateway()
        assert real is lgw.llm_gateway, (
            "resolve_sag2_gateway 必须返回真实 llm_gateway 单例，不得是 Fake"
        )
        adapter = ga.LlmGatewayJudgeAdapter(real)
        return Sag2LexicalService(index=_make_index(), gateway=adapter)

    return SimpleNamespace(
        server=http_server,
        token=token,
        model=_MODEL,
        gateway=lgw.llm_gateway,
        enable_short_timeout=enable_short_timeout,
        build_service=build_service,
    )


# ---------------------------------------------------------------------------
# 断言 helpers
# ---------------------------------------------------------------------------


def _assert_real_request_shape(requests: list[dict[str, Any]], token: str) -> None:
    """server 端看到的必须是真实 OpenAI-compatible POST，而非 Fake 短路。"""
    assert requests, "server 端必须收到真实 HTTP 请求"
    for req in requests:
        assert req["method"] == "POST"
        assert req["path"] == "/v1/chat/completions"
        assert req["authorization"] == "Bearer " + token
        assert "application/json" in req["content_type"]
        body = req["body"]
        assert isinstance(body, dict)
        assert body.get("model") == "gpt-4o-mini"
        assert isinstance(body.get("messages"), list) and body["messages"]
        assert "response_format" in body  # structured_completion 的真实 json_schema 协议


def _assert_honest_degradation(
    payload: dict[str, Any],
    wired: Any,
    server: _LocalOpenAIServer,
    *,
    min_hits: int,
) -> None:
    """畸形 / 500 / 超时：不抛异常、诚实降级、recall 留痕、遥测不虚增、真实请求确实发出。"""
    assert payload["status"] == "ok"  # 检索本身完成，未把失败抛成异常
    assert payload["judge"]["executed"] is False
    assert payload["judge"]["mode"] == MODE_UNAVAILABLE
    assert payload["judge"]["mode"] != MODE_MODEL
    # trace：每轮判定尝试都留痕，且明确标 executed=False + 非空 reason
    assert payload["trace"], "trace 不得为空"
    assert payload["trace"][0]["judge_executed"] is False
    assert payload["trace"][0]["judge_reason"]
    # recall 留痕：hop0 记下本轮真实召回数量与降级原因，绝不静默吞掉
    hop0 = payload["paths"]["hop0"]
    assert hop0["raw_count"] >= 1, "本轮确实发生过召回（不是零请求降级）"
    assert hop0["reason"], "降级原因必须写进 paths"
    # 遥测：调用进分母、执行不进分子、降级留痕
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] >= 1
    assert snap["judge_executed"] == 0
    assert snap["judge_degraded"] == snap["judge_calls"]
    assert snap["judge_execution_rate"] == 0.0
    assert snap["last_reason"]
    assert MODE_UNAVAILABLE in snap["by_mode"]
    # 真实 I/O 确实发生：Fake 短路不会产生任何 TCP 请求
    hits, reqs = server.snapshot()
    assert hits >= min_hits, "失败路径也必须留下真实 HTTP 请求轨迹"
    _assert_real_request_shape(reqs, wired.token)


# ---------------------------------------------------------------------------
# 用例
# ---------------------------------------------------------------------------


def test_real_http_happy_path_executed_scores_affect_results(wired: Any) -> None:
    """正常结构化返回：judge_executed=True、遥测递增正确、判定分真实影响检索结果。"""
    server: _LocalOpenAIServer = wired.server
    server.set_mode("ok", strategy="first_high")
    service = wired.build_service()
    assert type(service.judge).__name__ == "ModelJudge"
    assert service.judge._model == wired.model  # env 注入的 model 透传到 ModelJudge
    hits_before = server.snapshot()[0]

    async def scenario():
        first = await service.retrieve(_QUERY, _options())
        server.set_mode("ok", strategy="last_high")  # 反转分数策略
        second = await service.retrieve(_QUERY, _options())
        return first.to_dict(), second.to_dict()

    d1, d2 = asyncio.run(scenario())

    # 判定真跑（不是 lexical-only，也不是伪装 executed=True）
    assert d1["judge"]["executed"] is True
    assert d1["judge"]["mode"] == MODE_MODEL
    assert d1["judge"]["mode"] != MODE_LEXICAL_ONLY
    assert d2["judge"]["executed"] is True
    assert d1["trace"][0]["judge_executed"] is True
    assert d1["trace"][0]["judge_reason"] == ""  # ModelJudge 成功路径 reason 为空

    # 遥测：两次 retrieve，各 +1 call，executed 同步递增，无降级
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 2
    assert snap["judge_executed"] == 2
    assert snap["judge_degraded"] == 0
    assert snap["judge_execution_rate"] == 1.0
    assert snap["by_mode"] == {MODE_MODEL: 2}

    # 分数影响结果：first_high 把字典序第一的 key 给 0.95，last_high 把最后一个给 0.95。
    keys1 = [r["key"] for r in d1["results"]]
    keys2 = [r["key"] for r in d2["results"]]
    assert keys1 and keys2
    hi1 = max(d1["results"], key=lambda r: r["score"])
    hi2 = max(d2["results"], key=lambda r: r["score"])
    assert hi1["score"] == pytest.approx(0.95)
    assert hi2["score"] == pytest.approx(0.95)
    assert hi1["key"] == sorted(keys1)[0]
    assert hi2["key"] == sorted(keys2)[-1]
    assert hi1["key"] != hi2["key"], "反转策略后高分 key 改变 => 分数来自服务端，不是 BM25 先验"
    assert any(r["score"] == pytest.approx(0.05) for r in d1["results"])

    # 真实 HTTP 请求确实发出（server 端计数 >= 2，防 Fake 短路）
    hits, reqs = server.snapshot()
    assert hits - hits_before >= 2
    _assert_real_request_shape(reqs, wired.token)
    assert all(len(_candidate_keys(r["body"])) >= 1 for r in reqs)
    print(f"[C-E2E-HITS] happy_path server_hits={hits}")


@pytest.mark.parametrize(
    "bad_mode", ["malformed_json", "missing_scores", "schema_mismatch"]
)
def test_malformed_response_degrades_honestly_with_recall_trace(
    wired: Any, bad_mode: str
) -> None:
    """服务端畸形 JSON / 缺 scores / schema 不符：不抛异常，诚实降级且 recall 留痕。"""
    server: _LocalOpenAIServer = wired.server
    server.set_mode(bad_mode)
    service = wired.build_service()
    payload = asyncio.run(service.retrieve(_QUERY, _options())).to_dict()
    # structured_completion max_retries=1：每次 score 至少 2 次真实 HTTP。
    _assert_honest_degradation(payload, wired, server, min_hits=2)
    hits, _ = server.snapshot()
    print(f"[C-E2E-HITS] {bad_mode} server_hits={hits}")


@pytest.mark.parametrize("bad_mode", ["error_500", "timeout"])
def test_server_error_and_timeout_degrade_honestly(
    wired: Any, bad_mode: str
) -> None:
    """服务端 500 / 真实超时：同样诚实降级，不吞失败且不留「假已判定」。"""
    server: _LocalOpenAIServer = wired.server
    if bad_mode == "timeout":
        wired.enable_short_timeout(_SHORT_TIMEOUT)
    server.set_mode(bad_mode)
    service = wired.build_service()
    payload = asyncio.run(service.retrieve(_QUERY, _options())).to_dict()
    _assert_honest_degradation(payload, wired, server, min_hits=1)
    hits, _ = server.snapshot()
    print(f"[C-E2E-HITS] {bad_mode} server_hits={hits}")


def test_real_http_requests_counted_on_server_side(wired: Any) -> None:
    """server 端计数 >= 3：证明真实 HTTP 请求确实发出，Fake 短路不可能产生 TCP 请求。"""
    server: _LocalOpenAIServer = wired.server
    server.set_mode("ok", strategy="flat")
    service = wired.build_service()

    async def scenario():
        for _ in range(3):
            await service.retrieve(_QUERY, _options())

    asyncio.run(scenario())
    hits, reqs = server.snapshot()
    assert hits >= 3, "server 端必须收到 >= 3 次真实 HTTP 请求"
    assert len(reqs) >= 3
    _assert_real_request_shape(reqs, wired.token)
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 3
    assert snap["judge_executed"] == 3
    assert snap["judge_execution_rate"] == 1.0
    print(f"[C-E2E-HITS] counted_ge_3 server_hits={hits}")


def test_no_base_url_no_env_is_lazy_and_never_networks(
    monkeypatch: pytest.MonkeyPatch, http_server: _LocalOpenAIServer
) -> None:
    """无 base_url / 零 env：惰性不 import、不联网，retrieve 走 lexical-only 诚实降级。"""
    for key in (
        "SAG2_JUDGE_ENABLED",
        "SAG2_JUDGE_MODEL",
        _BASE_URL_ENV,
        _TOKEN_ENV,
    ):
        monkeypatch.delenv(key, raising=False)
    calls = {"n": 0}

    def _must_not_import():
        calls["n"] += 1
        raise AssertionError("未开启时不得 import 真实 gateway / 不得联网")

    monkeypatch.setattr(ga, "_import_gateway", _must_not_import)
    assert ga.resolve_sag2_gateway() is None
    assert calls["n"] == 0, "零环境变量时绝不 import / 构造真实 gateway"

    service = Sag2LexicalService(index=_make_index())
    assert type(service.judge).__name__ == "LexicalOnlyJudge"
    payload = asyncio.run(service.retrieve(_QUERY, _options())).to_dict()
    assert payload["judge"]["mode"] == MODE_LEXICAL_ONLY
    assert payload["judge"]["executed"] is False
    assert payload["judge"]["reason"]
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == 1
    assert snap["judge_executed"] == 0
    assert snap["judge_execution_rate"] == 0.0
    assert snap["judge_degraded"] == 1

    # server 端零请求：确实没联网、没被 Fake 之外的东西触发网络。
    hits, reqs = http_server.snapshot()
    assert hits == 0
    assert reqs == []
    print(f"[C-E2E-HITS] zero_env_no_network server_hits={hits}")

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
