# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""K 席·判定质量可宣称化评测（标注集 + 真实 HTTP 判定链路 + 真实本地 ONNX 推理）。

本文件证明的边界（严禁越界声称）：

- 真实 I/O：标准库 ``http.server.ThreadingHTTPServer`` 绑定 ``127.0.0.1:0``，
  真实 HTTP 客户端（``http.client``）发真实 TCP/HTTP/JSON 请求，
  整条链路 ``retrieve() -> ModelJudge -> gateway_adapter -> 真实 HTTP 客户端 -> 本地服务``，
  无 Fake 短路，server 端真实计数。
- 服务端判定器是「基于真实可计算语义信号的确定性 scorer」：
  表面词覆盖率、query 与文档的桥接/概念 bigram 共现、诱饵噪声词惩罚。
  它返回**有区分度**的分数（gold/decoy 分数不同、不是固定 0.5），
  全部基于随请求送达的真实文本计算，**不是商业 LLM**。
- 任务 1 成功支线：真实本地 ONNX 模型（Xenova/all-MiniLM-L6-v2 quantized）
  经 ``onnxruntime`` 真跑推理，以句向量余弦作为判定分接入 ``ModelJudge``，
  给出「真实本地模型判定 on/off」质量数字。这同样**不是商业 LLM 打分**。

不证明：商业 LLM 打分质量（本机无外部 key / 无 torch / 无 transformers / 无大模型端点，
已在 K-judge-quality.md 登记为资源边界），线上用户满意度，与线上 embedding 语义等价。

严禁硬编码真实凭据：本地服务随机端口 + 进程内 ``secrets.token_hex`` 随机 token。
ONNX 模型只落在 gitignored ``.ihui-agent/tmp/sag2-final-v2/models/``，绝不提交。
"""

from __future__ import annotations

import asyncio
import http.client
import json
import math
import random
import secrets
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import pytest

from app.services.sag2_lexical import gateway_adapter as ga
from app.services.sag2_lexical.index import LexicalIndex
from app.services.sag2_lexical.judge import (
    MODE_LEXICAL_ONLY,
    MODE_MODEL,
    MODE_UNAVAILABLE,
    LexicalOnlyJudge,
    ModelJudge,
)
from app.services.sag2_lexical.metrics import judge_metrics, reset_judge_metrics
from app.services.sag2_lexical.retrieval import Sag2Options
from app.services.sag2_lexical.service import Sag2LexicalService

# ---------------------------------------------------------------------------
# 评测集定义（确定性生成，两套不同种子各跑一遍防过拟合）
# ---------------------------------------------------------------------------

SEEDS = (20261109, 20261110)
N_QUERIES = 24          # >= 24 条确定性标注查询
N_GOLD = 3              # 每条查询 ground-truth 相关文档（需概念桥接 bigram 共现才识别）
N_DECOY = 4             # 「表面词命中但无关」的诱饵文档（表面命中全部 query 词、无桥接、高噪声）
N_FILLER = 8            # 中性填充文档（只命中 1 个 query 词，被召回但不相关）
TOP_K = 10
MAX_HOPS = 0            # 单轮判定：候选池稳定，两种子 / 两种 judge 可逐值对比

# 真实英文名词：可读、可被 onnxruntime/tokenizer 编码、无中文分词歧义。
_TOPICS = [
    "river", "vault", "lantern", "signal", "harbor", "cipher", "meadow", "furnace",
    "compass", "cobalt", "amber", "granite", "delta", "prism", "quartz", "marble",
    "cedar", "willow", "tundra", "canyon", "beacon", "orchard", "pebble", "summit",
    "lagoon", "turbine", "platinum", "cinder", "bramble", "kernel",
]
_BRIDGES = [
    "bridge", "relay", "hinge", "nexus", "conduit", "anchor", "thread", "lattice",
    "seam", "pivot", "junction", "linkage",
]
_NOISE = [
    "mumble", "drift", "clutter", "husk", "dross", "chaff", "babble", "static",
    "trivia", "junk", "blather", "prattle", "swarf", "residue", "froth", "sludge",
]
_ANSWERS = [
    "answer", "finding", "evidence", "result", "conclusion", "outcome", "verdict",
    "insight",
]


@dataclass(frozen=True)
class Doc:
    path: str
    content: str
    label: str  # "gold" / "decoy" / "filler"


@dataclass(frozen=True)
class QueryCase:
    query: str
    docs: list[Doc]
    gold_paths: frozenset[str]
    decoy_paths: frozenset[str]


def build_benchmark(seed: int) -> list[QueryCase]:
    """确定性生成 >=24 条查询，每条带 ground-truth 相关集合 + 表面命中诱饵 + 需桥接的真实答案。

    结构（query = "A B M"，A/B 主题词、M 桥接词）：
    - gold   : "A B ans"         —— A、B **相邻共现**（概念桥接 bigram (A,B) 命中）；
                                   只命中 2/3 个 query 词 ⇒ 纯词法分偏低（易被诱饵压过）。
    - decoy  : "A n M B n n n"   —— A、B、M **表面全命中**（3/3），但 A、B 不相邻、
                                   不含概念 bigram、噪声词多 ⇒ 纯词法分偏高（骗过 BM25/词法），
                                   确定性 scorer 靠 bigram 共现 + 噪声惩罚把它压下。
    - filler : "one n n n n"     —— 只命中 1 个 query 词，被召回但两种判定都给低分。
    这就是「表面词命中但无关」与「需桥接词/概念共现才相关」的可计算定义。
    """
    rng = random.Random(seed)
    cases: list[QueryCase] = []
    for qi in range(N_QUERIES):
        a = rng.choice(_TOPICS)
        b = rng.choice(_TOPICS)
        while b == a:
            b = rng.choice(_TOPICS)
        m = rng.choice(_BRIDGES)
        query = f"{a} {b} {m}"
        docs: list[Doc] = []

        answers = rng.sample(_ANSWERS, N_GOLD)
        for j in range(N_GOLD):
            docs.append(
                Doc(
                    path=f"q{qi:02d}/gold_{j}.txt",
                    content=f"{a} {b} {answers[j]}",
                    label="gold",
                )
            )
        for j in range(N_DECOY):
            n = [rng.choice(_NOISE) for _ in range(4)]
            docs.append(
                Doc(
                    path=f"q{qi:02d}/decoy_{j}.txt",
                    content=f"{a} {n[0]} {m} {b} {n[1]} {n[2]} {n[3]}",
                    label="decoy",
                )
            )
        for j in range(N_FILLER):
            one = rng.choice([a, b, m])
            n = [rng.choice(_NOISE) for _ in range(4)]
            docs.append(
                Doc(
                    path=f"q{qi:02d}/filler_{j}.txt",
                    content=f"{one} {n[0]} {n[1]} {n[2]} {n[3]}",
                    label="filler",
                )
            )
        cases.append(
            QueryCase(
                query=query,
                docs=docs,
                gold_paths=frozenset(d.path for d in docs if d.label == "gold"),
                decoy_paths=frozenset(d.path for d in docs if d.label == "decoy"),
            )
        )
    return cases


# ---------------------------------------------------------------------------
# 服务端确定性判定器：基于真实可计算语义信号，有区分度，不是固定 0.5 的 Fake
# ---------------------------------------------------------------------------


def semantic_score(question: str, content: str) -> float:
    """确定性语义判定分（只读真实送达文本，不硬编码任何 key/label/答案）。

    三类真实可计算信号：
    1. surface : query 词与文档词的表面覆盖率（诱饵全命中 ⇒ 高）。
    2. bridge  : query 相邻概念对（bigram）在文档中的共现覆盖（概念桥接；gold 命中、诱饵不命中）。
    3. noise   : 文档中与 query 无关的噪声词占比（诱饵词惩罚）。
    组合后 clip 到 [0,1]，gold 明显高于 decoy/filler，产生真实区分度。
    """
    q = [w for w in question.split() if w]
    d = [w for w in content.split() if w]
    if not q or not d:
        return 0.0
    qset, dset = set(q), set(d)
    qbig = {(q[i], q[i + 1]) for i in range(len(q) - 1)}
    dbig = {(d[i], d[i + 1]) for i in range(len(d) - 1)}
    surface = len(qset & dset) / len(qset)
    bridge = min(1.0, float(len(qbig & dbig)))  # 概念桥接 bigram 共现
    noise = sum(1 for w in d if w not in qset) / len(d)  # 诱饵/噪声词惩罚
    score = 0.05 + 0.65 * bridge + 0.10 * surface - 0.30 * noise
    return round(max(0.0, min(1.0, score)), 6)


def _extract_payload(body: Any) -> dict[str, Any] | None:
    """从真实 OpenAI messages 里解析 adapter 组装的 payload（含 question/candidates）。"""
    if not isinstance(body, dict):
        return None
    for msg in body.get("messages", []) or []:
        if not isinstance(msg, dict):
            continue
        try:
            obj = json.loads(msg.get("content", ""))
        except (TypeError, ValueError):
            continue
        if isinstance(obj, dict) and "candidates" in obj:
            return obj
    return None


class _QualityHandler(BaseHTTPRequestHandler):
    """真实 HTTP handler：记录请求、用确定性语义 scorer 生成有区分度的 scores。"""

    def do_POST(self) -> None:  # noqa: N802 - http.server 约定名
        ctl: _QualityServer = self.server.controller  # type: ignore[attr-defined]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            body: Any = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            body = None
        with ctl._lock:
            ctl.hits += 1
            mode = ctl._mode
            ctl.requests.append(
                {
                    "path": self.path,
                    "method": "POST",
                    "authorization": self.headers.get("Authorization", ""),
                    "content_type": self.headers.get("Content-Type", ""),
                    "body": body,
                }
            )
        if self.headers.get("Authorization", "") != "Bearer " + ctl.token:
            ctl._send(self, 401, {"error": "bad token"})
            return
        if mode == "timeout":
            time.sleep(1.5)  # 真实延迟，触发客户端真实超时
        if mode == "error_500":
            ctl._send(self, 500, {"error": {"message": "injected", "type": "server_error"}})
            return
        if mode == "malformed_json":
            content = "NOT_JSON_<<<"  # 合法 OpenAI 响应，但 content 不是 JSON
        else:
            payload = _extract_payload(body) or {"question": "", "candidates": []}
            scores = [
                {
                    "key": str(c.get("key", "")),
                    "score": semantic_score(str(payload.get("question", "")), str(c.get("content", ""))),
                }
                for c in payload.get("candidates", [])
                if isinstance(c, dict)
            ]
            content = json.dumps({"scores": scores})
        ctl._send(
            self,
            200,
            {
                "id": "chatcmpl-k-quality",
                "object": "chat.completion",
                "created": 0,
                "model": "local-deterministic-scorer",
                "choices": [
                    {"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    def log_message(self, *args: Any) -> None:
        return


class _QualityServer:
    """127.0.0.1:0 随机端口的真实 HTTP 服务（线程后台，进程内随机 token）。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.hits = 0
        self.requests: list[dict[str, Any]] = []
        self._mode = "ok"
        self.token = secrets.token_hex(8)
        self._srv = ThreadingHTTPServer(("127.0.0.1", 0), _QualityHandler)
        self._srv.daemon_threads = True
        self._srv.controller = self  # type: ignore[attr-defined]
        self.port = self._srv.server_address[1]
        self.path = "/v1/chat/completions"
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
            pass  # 超时后客户端已断开，属预期

    def set_mode(self, mode: str) -> None:
        with self._lock:
            self._mode = mode

    def snapshot(self) -> tuple[int, list[dict[str, Any]]]:
        with self._lock:
            return self.hits, list(self.requests)

    def close(self) -> None:
        self._srv.shutdown()
        self._srv.server_close()
        self._thread.join(timeout=2)


# ---------------------------------------------------------------------------
# 真实 HTTP 客户端（gateway_adapter 的「真实 gateway」）：真 TCP/HTTP/JSON，无 Fake
# ---------------------------------------------------------------------------


class _HttpGateway:
    """实现 llm_gateway 真实签名 ``structured_completion(messages, schema, model=None)``。

    用标准库 ``http.client`` 发真实 HTTP POST 到本地 ThreadingHTTPServer，
    解析 OpenAI-compatible 响应里的 JSON content，交回 adapter._normalize 归一。
    任何异常（非 200 / 畸形 / 超时）都向上抛，由 adapter 收敛为空分 → ModelJudge 诚实降级。
    """

    def __init__(self, server: _QualityServer, timeout: float = 1.5) -> None:
        self._server = server
        self._timeout = timeout
        self.calls = 0

    async def structured_completion(
        self, messages: list[dict[str, str]], schema: dict[str, Any], model: str | None = None
    ) -> dict[str, Any]:
        self.calls += 1
        body = {
            "model": model or "local-deterministic-scorer",
            "messages": messages,
            "response_format": {"type": "json_schema", "json_schema": schema},
        }
        data = json.dumps(body).encode("utf-8")
        conn = http.client.HTTPConnection("127.0.0.1", self._server.port, timeout=self._timeout)
        try:
            conn.request(
                "POST",
                self._server.path,
                body=data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + self._server.token,
                },
            )
            resp = conn.getresponse()
            raw = resp.read()
            if resp.status != 200:
                raise RuntimeError(f"server returned HTTP {resp.status}")
            obj = json.loads(raw.decode("utf-8"))
            content = obj["choices"][0]["message"]["content"]
            return dict(json.loads(content))  # {"scores": [{"key","score"}, ...]}
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# 任务 1 成功支线：真实本地 ONNX 模型推理（onnxruntime），接入 ModelJudge
# ---------------------------------------------------------------------------

_MODELS_DIR = Path(__file__).resolve().parents[3] / ".ihui-agent" / "tmp" / "sag2-final-v2" / "models"
_ONNX_MODEL = _MODELS_DIR / "model_quantized.onnx"
_ONNX_TOKENIZER = _MODELS_DIR / "tokenizer.json"


class _OnnxGateway:
    """用 onnxruntime 真跑 all-MiniLM-L6-v2，句向量余弦（候选集内 min-max 归一）作判定分。

    直接实现 ModelJudge 期望的 ``structured_completion(payload, model=None)`` 签名，
    不经过 gateway_adapter（adapter 是为真实 llm_gateway 签名准备的；ONNX 是本地推理）。
    """

    def __init__(self) -> None:
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self._np = np
        self._sess = ort.InferenceSession(str(_ONNX_MODEL), providers=["CPUExecutionProvider"])
        self._tok = Tokenizer.from_file(str(_ONNX_TOKENIZER))
        self._input_names = [i.name for i in self._sess.get_inputs()]
        self.embed_dim = int(self._sess.get_outputs()[0].shape[-1])
        self.infer_calls = 0
        self.infer_ms = 0.0

    def _embed(self, texts: list[str]):
        np = self._np
        encs = [self._tok.encode(t) for t in texts]
        ids = np.array([e.ids for e in encs], dtype=np.int64)
        attn = np.array([e.attention_mask for e in encs], dtype=np.int64)
        tids = np.array([e.type_ids for e in encs], dtype=np.int64)
        feed = {}
        for name in self._input_names:
            if name == "input_ids":
                feed[name] = ids
            elif name == "attention_mask":
                feed[name] = attn
            elif name == "token_type_ids":
                feed[name] = tids
        t0 = time.perf_counter()
        hidden = self._sess.run(None, feed)[0]  # (batch, seq, 384)
        self.infer_ms += (time.perf_counter() - t0) * 1000.0
        mask = attn[:, :, None].astype(np.float32)
        emb = (hidden * mask).sum(axis=1) / np.maximum(mask.sum(axis=1), 1e-9)
        norm = np.linalg.norm(emb, axis=1, keepdims=True)
        return emb / np.maximum(norm, 1e-9)

    async def structured_completion(
        self, payload: dict[str, Any], model: str | None = None
    ) -> dict[str, Any]:
        self.infer_calls += 1
        question = str(payload.get("question", ""))
        candidates = [c for c in payload.get("candidates", []) if isinstance(c, dict)]
        texts = [question] + [str(c.get("content", "")) for c in candidates]
        embs = self._embed(texts)
        qv = embs[0]
        cos = [float(embs[i + 1] @ qv) for i in range(len(candidates))]
        lo, hi = (min(cos), max(cos)) if cos else (0.0, 1.0)
        span = hi - lo
        scores = [
            {
                "key": str(c.get("key", "")),
                "score": round((value - lo) / span if span > 1e-9 else 0.5, 6),
            }
            for c, value in zip(candidates, cos, strict=False)
        ]
        return {"scores": scores}


# ---------------------------------------------------------------------------
# 评测执行 + 四指标
# ---------------------------------------------------------------------------


def _options() -> Sag2Options:
    return Sag2Options(candidate_k=100, seed_k=10, max_hops=MAX_HOPS, top_k=TOP_K)


def _metrics(ranked_keys: list[str], case: QueryCase) -> dict[str, float]:
    top = [k.split("#")[0] for k in ranked_keys[:TOP_K]]
    gold, decoy = case.gold_paths, case.decoy_paths
    recall = sum(1 for p in top if p in gold) / max(1, len(gold))
    rr = 0.0
    for rank, p in enumerate(top, 1):
        if p in gold:
            rr = 1.0 / rank
            break
    dcg = sum(1.0 / math.log2(i + 2) for i, p in enumerate(top) if p in gold)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(len(gold), TOP_K)))
    ndcg = dcg / idcg if idcg > 0 else 0.0
    decoy_top5 = sum(1 for p in top[:5] if p in decoy)
    return {"recall": recall, "mrr": rr, "ndcg": ndcg, "decoy_top5": float(decoy_top5)}


def _run_eval(cases: list[QueryCase], judge: Any, options: Sag2Options) -> dict[str, Any]:
    """跑一遍评测集；judge OFF / ON 共用同一函数。

    只有 ``judge_executed=True`` 的轮次计入四指标；降级轮次单独计数、不污染质量统计。
    """
    totals = {"recall": 0.0, "mrr": 0.0, "ndcg": 0.0, "decoy_top5": 0.0}
    counted = executed = degraded = 0
    for case in cases:
        index = LexicalIndex()
        for doc in case.docs:
            index.add_document(doc.path, doc.content)
        service = Sag2LexicalService(index=index)
        service.judge = judge
        result = asyncio.run(service.retrieve(case.query, options))
        payload = result.to_dict()
        if payload["judge"]["executed"] is True:
            executed += 1
        # 只把「异常降级」(unavailable) 排除并单独计数；judge OFF(lexical-only)
        # 是主动选择的基线、本就 executed=False，必须正常计入质量统计。
        if payload["judge"]["mode"] == MODE_UNAVAILABLE:
            degraded += 1
            continue
        m = _metrics([r["key"] for r in payload["results"]], case)
        for k in totals:
            totals[k] += m[k]
        counted += 1
    avg = {k: round(v / counted, 6) if counted else 0.0 for k, v in totals.items()}
    return {
        "queries": len(cases),
        "counted": counted,
        "executed": executed,
        "degraded": degraded,
        **avg,
        "decoy_top5_total": int(totals["decoy_top5"]),
    }


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def quality_server():
    srv = _QualityServer()
    yield srv
    srv.close()


@pytest.fixture(autouse=True)
def _isolate_sag2(monkeypatch: pytest.MonkeyPatch):
    for key in ("SAG2_JUDGE_ENABLED", "SAG2_JUDGE_MODEL"):
        monkeypatch.delenv(key, raising=False)
    reset_judge_metrics()
    monkeypatch.setattr(ga, "last_resolve_reason", ga.DISABLED_REASON)
    monkeypatch.setattr(ga, "last_adapter_error", "")


# ---------------------------------------------------------------------------
# 用例
# ---------------------------------------------------------------------------


def test_scorer_is_discriminative_not_flat() -> None:
    """确定性 scorer 必须有区分度：gold > decoy/filler，且不是固定 0.5 的 Fake。"""
    case = build_benchmark(SEEDS[0])[0]
    gold = [semantic_score(case.query, d.content) for d in case.docs if d.label == "gold"]
    decoy = [semantic_score(case.query, d.content) for d in case.docs if d.label == "decoy"]
    filler = [semantic_score(case.query, d.content) for d in case.docs if d.label == "filler"]
    assert gold and decoy and filler
    assert min(gold) > max(decoy), "gold 必须严格高于诱饵（有区分度）"
    assert min(gold) > max(filler)
    all_scores = gold + decoy + filler
    assert all(0.0 <= s <= 1.0 for s in all_scores)
    assert any(abs(s - 0.5) > 1e-6 for s in all_scores), "不得是固定返回 0.5 的 Fake"
    assert len({round(s, 6) for s in all_scores}) >= 2, "分数必须有变化"
    print(f"[K-SCORER] gold={gold} decoy={decoy} filler={filler}")


def test_quality_off_vs_http_on_two_seeds(quality_server: _QualityServer) -> None:
    """主评测：judge OFF（纯词法多跳）vs judge ON（真实 HTTP 判定），两套种子四指标。

    真链路：retrieve -> ModelJudge -> gateway_adapter -> 真实 HTTP 客户端 -> 本地服务。
    server 端计数 >= N_QUERIES * len(SEEDS)，杜绝 Fake 短路。
    """
    srv = quality_server
    srv.set_mode("ok")
    http_gateway = _HttpGateway(srv, timeout=1.5)
    adapter = ga.LlmGatewayJudgeAdapter(http_gateway)
    on_judge = ModelJudge(adapter)
    off_judge = LexicalOnlyJudge()
    options = _options()

    report: dict[str, Any] = {}
    for seed in SEEDS:
        cases = build_benchmark(seed)
        assert len(cases) == N_QUERIES
        for label, judge in (("off", off_judge), ("http_on", on_judge)):
            res = _run_eval(cases, judge, options)
            report[f"seed={seed}/{label}"] = res
            assert res["queries"] == N_QUERIES
            assert res["counted"] == N_QUERIES, "正常模式不得有降级轮次污染质量统计"
            assert res["degraded"] == 0
            if label == "http_on":
                assert res["executed"] == N_QUERIES, "HTTP ON 每轮都必须真跑模型判定"
            else:
                assert res["executed"] == 0, "OFF 是纯词法基线，不得伪造 executed"
            assert 0.0 <= res["recall"] <= 1.0
            assert 0.0 <= res["mrr"] <= 1.0
            assert 0.0 <= res["ndcg"] <= 1.0
            assert res["decoy_top5_total"] >= 0

    hits, reqs = srv.snapshot()
    expected_min = N_QUERIES * len(SEEDS)
    assert hits >= expected_min, f"server 端真实请求数须 >= {expected_min}，实际 {hits}"
    assert http_gateway.calls >= expected_min
    # 真实请求形状（不是 Fake 短路）
    for req in reqs:
        assert req["method"] == "POST"
        assert req["path"] == srv.path
        assert req["authorization"] == "Bearer " + srv.token
        assert "application/json" in req["content_type"]
        assert isinstance(req["body"], dict) and req["body"].get("messages")
    # 遥测：调用进分母，只有 model 判定轮次进分子；OFF(lexical-only) 计入降级分母。
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] == expected_min * 2
    assert snap["judge_executed"] == expected_min
    assert snap["judge_degraded"] == expected_min
    assert snap["by_mode"].get(MODE_MODEL) == expected_min
    assert snap["by_mode"].get(MODE_LEXICAL_ONLY) == expected_min
    print("[K-QUALITY] " + json.dumps({"server_hits": hits, "gateway_calls": http_gateway.calls, "report": report}, ensure_ascii=False))
    print(f"[K-QUALITY-HITS] server_hits={hits} expected_min={expected_min} telemetry={snap}")


@pytest.mark.parametrize("bad_mode", ["malformed_json", "error_500", "timeout"])
def test_degradation_honest_and_excluded_from_quality(
    quality_server: _QualityServer, bad_mode: str
) -> None:
    """畸形 JSON / 500 / 超时：诚实降级、不抛异常、真实 HTTP 仍发出、降级轮次单独计数。"""
    srv = quality_server
    timeout = 0.4 if bad_mode == "timeout" else 1.5
    gw = _HttpGateway(srv, timeout=timeout)
    adapter = ga.LlmGatewayJudgeAdapter(gw)
    judge = ModelJudge(adapter)
    srv.set_mode(bad_mode)
    case = build_benchmark(SEEDS[0])[0]
    index = LexicalIndex()
    for doc in case.docs:
        index.add_document(doc.path, doc.content)
    service = Sag2LexicalService(index=index)
    service.judge = judge
    before, _ = srv.snapshot()

    payload = asyncio.run(service.retrieve(case.query, _options())).to_dict()
    assert payload["status"] == "ok"
    assert payload["judge"]["executed"] is False
    assert payload["judge"]["mode"] == MODE_UNAVAILABLE
    assert payload["judge"]["reason"]
    assert payload["trace"][0]["judge_executed"] is False
    assert payload["trace"][0]["judge_reason"]
    # 降级轮次单独计数，不进四指标（此处模拟 _run_eval 的排除逻辑）
    res = _run_eval([case], judge, _options())
    assert res["counted"] == 0 and res["degraded"] >= 1
    # 遥测：调用进分母、执行不进分子、降级留痕
    snap = judge_metrics.snapshot()
    assert snap["judge_calls"] >= 1
    assert snap["judge_executed"] == 0
    assert snap["judge_degraded"] == snap["judge_calls"]
    assert snap["judge_execution_rate"] == 0.0
    # 真实 I/O 确实发生
    hits, reqs = srv.snapshot()
    assert hits - before >= 1, "失败路径也必须留下真实 HTTP 请求轨迹"
    assert reqs[-1]["authorization"] == "Bearer " + srv.token
    print(f"[K-DEGRADE] mode={bad_mode} server_hits={hits} telemetry={snap}")


def test_adapter_degradation_error_is_diagnosable(quality_server: _QualityServer) -> None:
    """回归（gateway_adapter 最小修复）：三种故障降级根因可区分、成功路径清空。

    修复前 ``except Exception: return {"scores": []}`` 吞掉具体异常，畸形 JSON /
    500 / 超时三种故障的 judge_reason 都是同一句「模型返回空打分」，无法区分根因。
    修复后 ``get_last_adapter_error()`` 保留具体异常类型与消息，但返回契约不变。
    """
    srv = quality_server
    gw = _HttpGateway(srv, timeout=0.4)
    adapter = ga.LlmGatewayJudgeAdapter(gw)
    judge = ModelJudge(adapter)
    case = build_benchmark(SEEDS[0])[0]
    index = LexicalIndex()
    for doc in case.docs:
        index.add_document(doc.path, doc.content)
    service = Sag2LexicalService(index=index)
    service.judge = judge

    seen: dict[str, str] = {}
    for mode in ("malformed_json", "error_500", "timeout", "ok"):
        srv.set_mode(mode)
        asyncio.run(service.retrieve(case.query, _options()))
        seen[mode] = ga.get_last_adapter_error()

    assert seen["ok"] == "", "成功路径必须清空最近一次降级根因"
    for mode in ("malformed_json", "error_500", "timeout"):
        assert seen[mode], f"{mode} 的降级根因不得被吞掉"
    assert len({seen[m] for m in ("malformed_json", "error_500", "timeout")}) == 3, (
        "三种故障的根因必须可区分"
    )
    print("[K-DIAG] " + json.dumps(seen, ensure_ascii=False))


@pytest.mark.skipif(
    not (_ONNX_MODEL.exists() and _ONNX_TOKENIZER.exists()),
    reason="ONNX 模型未下载（gitignored 资源边界，任务 1 失败时跳过）",
)
def test_onnx_real_inference_quality() -> None:
    """任务 1 成功支线：真实本地 ONNX 模型真跑推理，给 judge OFF vs 真实模型 ON 的质量数字。

    模型：Xenova/all-MiniLM-L6-v2 quantized；onnxruntime CPUExecutionProvider；
    last_hidden_state(1,128,384) mean-pooling → 句向量余弦（候选集内归一）作判定分。
    """
    gw = _OnnxGateway()
    on_judge = ModelJudge(gw)
    off_judge = LexicalOnlyJudge()
    options = _options()
    report: dict[str, Any] = {}
    for seed in SEEDS:
        cases = build_benchmark(seed)
        for label, judge in (("off", off_judge), ("onnx_on", on_judge)):
            res = _run_eval(cases, judge, options)
            report[f"seed={seed}/{label}"] = res
            assert res["counted"] == N_QUERIES
            assert res["degraded"] == 0
            if label == "onnx_on":
                assert res["executed"] == N_QUERIES, "ONNX 判定每轮都必须真跑模型"
    assert gw.infer_calls >= N_QUERIES * len(SEEDS)
    assert gw.embed_dim == 384
    assert gw.infer_ms > 0.0
    # 分数来自真实模型输出、非恒定：直接取一次 structured_completion 验证有区分度
    case = build_benchmark(SEEDS[0])[0]
    sample = asyncio.run(
        gw.structured_completion(
            {
                "question": case.query,
                "candidates": [{"key": d.path, "content": d.content} for d in case.docs],
            },
            None,
        )
    )
    vals = [s["score"] for s in sample["scores"]]
    assert len(vals) == len(case.docs)
    assert len({round(v, 6) for v in vals}) >= 2, "真实模型分数必须有区分度、非 Fake 常量"
    assert all(0.0 <= v <= 1.0 for v in vals)
    print("[K-ONNX] " + json.dumps({"embed_dim": gw.embed_dim, "infer_calls": gw.infer_calls, "infer_ms": round(gw.infer_ms, 1), "report": report}, ensure_ascii=False))
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
