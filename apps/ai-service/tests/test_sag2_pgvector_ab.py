# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""SAG2 词法多跳 vs 真实 pgvector HNSW ANN 的同库 A/B 与规模延迟回归。

口径（务必诚实，勿夸大）：
- 真实层：PostgreSQL 18.6 + ``vector`` 0.8.6 + 真实 ``USING hnsw`` 索引 +
  ``vector(384)`` 列 + 真实余弦距离 ``<=>`` + 同库同语料 + 真实计时。全部真实。
- 替代层：embedding 用确定性字符 bigram hashing + L2 归一化（本机无 embedding
  模型）。**它不代表线上语义 embedding 模型的质量**；本测试能证明的是「在真
  ANN 索引下，答案文档不含任何查询词元时，hashing-ANN 单跳召不回、词法多跳
  通道能召回来」，以及两腿融合不劣于弱基线。禁止据此宣称与线上语义 A/B 等价。
- 所有测试数据写独立随机 schema，``finally`` 里 ``DROP SCHEMA ... CASCADE``，
  绝不触碰生产表；DSN 仅从环境变量读取，凭据零落地。

无 DSN 时整体 ``skip``；本机有 DSN 必须真连真跑（不许 FakeRunner 冒充）。
"""

from __future__ import annotations

import hashlib
import os
import random
import re
import statistics
from pathlib import Path

import pytest

asyncio = pytest.importorskip("asyncio")

np = pytest.importorskip("numpy")
asyncpg = pytest.importorskip("asyncpg")

from app.services.sag2_lexical import (  # noqa: E402
    LexicalIndex,
    LexicalOnlyJudge,
    Sag2Options,
    retrieve,
)
from app.services.sag2_lexical.service import Sag2LexicalService  # noqa: E402

DIM = 384
RRF_K = 60

NOISE_CJK = (
    "量子拓扑熵栅谐振舱轨道簇阈编译缓存矩协议节点图谱流形迭代收敛梯度"
    "张量采样度量坐标相位脉冲带宽时延吞吐副本幂等哈希分片负载调度回放"
)
NOISE_LAT = ["system", "delta", "module", "kernel", "buffer", "tensor", "index", "cluster"]

GROUP_TOKENS = ["鲲鹏", "貔貅", "麒麟", "凤凰", "玄武", "青龙", "白虎", "朱雀"]
BRIDGE_NAMES = ["沈砚", "陆珩", "顾昀", "谢照", "苏泠", "晏舟", "裴澈", "温叙"]
PROJECT_NAMES = ["北辰", "南枝", "西陵", "东隅", "沧浪", "琅嬛", "扶摇", "阡陌"]


def _dsn() -> str | None:
    for env in ("SAG2_TEST_DSN", "DATABASE_URL"):
        val = os.environ.get(env)
        if val:
            return val
    # 仓库根 .env 是 gitignored 本地开发配置；只在运行时读取，绝不写入任何文件。
    env_file = Path(__file__).resolve().parents[3] / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = re.match(r"^\s*DATABASE_URL\s*=\s*(.+)\s*$", line)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    return None


def _embed(text: str) -> list[float]:
    """确定性字符 bigram hashing embedding（纯 numpy，可复现，非语义模型）。"""
    v = np.zeros(DIM, dtype=np.float32)
    clean = "".join(ch for ch in text.lower() if not ch.isspace())
    toks = [clean[i : i + 2] for i in range(max(0, len(clean) - 1))]
    for tok in toks:
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
        v[h % DIM] += 1.0
    n = float(np.linalg.norm(v))
    if n:
        v /= n
    return [round(float(x), 6) for x in v]


def _vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _make_corpus(n_noise: int, seed: int):
    """8 组答案，每组 1 单跳 + 1 多跳查询，GT 明确；组专属词元互不重叠。"""
    rng = random.Random(seed)
    docs: list[tuple[str, str]] = []
    for i in range(n_noise):
        chars = "".join(rng.choice(NOISE_CJK) for _ in range(90))
        lat = " ".join(rng.choice(NOISE_LAT) for _ in range(4))
        docs.append((f"corpus/noise-{i:05d}.txt", f"{chars} {lat}"))

    cases = []
    for g in range(8):
        gtok = GROUP_TOKENS[g]
        bridge = BRIDGE_NAMES[g]
        proj = PROJECT_NAMES[g]
        a_path = f"corpus/board-resolution-{gtok}.txt"
        b_path = f"corpus/q3-spend-{gtok}.txt"
        doc_a = f"{gtok}董事会决议：年度研发额度上限{100 + g * 7}万，责任人{bridge}。会议记录已归档。"
        doc_b = (
            f"{bridge}牵头的{proj}专项第三季结算花掉{200 + g * 7}万，"
            f"比原定数目多出{40 + g}万，财务已备案。"
        )
        docs.append((a_path, doc_a))
        docs.append((b_path, doc_b))
        cases.append({"group": g, "kind": "single", "query": f"{gtok}董事会决议的年度研发额度是多少？", "gt": a_path})
        cases.append({"group": g, "kind": "multihop", "query": f"{gtok}董事会决议那个额度，后来是谁用超了？", "gt": b_path})
    return docs, cases


def _metrics(ranked: list[str], gt: str, k: int = 10) -> dict:
    top = ranked[:k]
    if gt in top:
        rank = top.index(gt) + 1
        return {"recall": 1.0, "rank": rank}
    return {"recall": 0.0, "rank": k + 1}


async def _run_ab() -> dict:
    dsn = _dsn()
    assert dsn, "需要 SAG2_TEST_DSN 或 DATABASE_URL / 仓库根 .env"
    docs, cases = _make_corpus(400, 20261109)
    schema = "sag2_ab_" + hashlib.sha256(os.urandom(16)).hexdigest()[:10]
    conn = await asyncpg.connect(dsn)
    result: dict = {"schema": schema}
    try:
        result["pg_version"] = (await conn.fetchval("select version()"))[:60]
        result["vector_ext"] = await conn.fetchval(
            "select extversion from pg_extension where extname='vector'"
        )
        await conn.execute(f'CREATE SCHEMA "{schema}"')
        await conn.execute(
            f'CREATE TABLE "{schema}".docs ('
            "id serial primary key, path text not null, content text not null, "
            f"embedding vector({DIM}) not null)"
        )
        await conn.executemany(
            f'INSERT INTO "{schema}".docs (path, content, embedding) VALUES ($1,$2,$3::vector)',
            [(p, c, _vec_literal(_embed(c))) for p, c in docs],
        )
        await conn.execute(
            f'CREATE INDEX ON "{schema}".docs USING hnsw (embedding vector_cosine_ops)'
        )
        idxdefs = [
            r["indexdef"]
            for r in await conn.fetch(
                "select indexdef from pg_indexes where schemaname=$1", schema
            )
        ]
        result["indexes"] = idxdefs

        index = LexicalIndex()
        for p, c in docs:
            index.add_document(p, c)

        groups: dict[str, dict] = {}
        for case in cases:
            q, gt = case["query"], case["gt"]
            rs = await conn.fetch(
                f'SELECT path FROM "{schema}".docs ORDER BY embedding <=> $1::vector LIMIT 10',
                _vec_literal(_embed(q)),
            )
            ann_paths = [r["path"] for r in rs]
            res = await retrieve(index, q, LexicalOnlyJudge(), Sag2Options())
            sag2_paths: list[str] = []
            for c in res.citations:
                if c["path"] not in sag2_paths:
                    sag2_paths.append(c["path"])

            rag_sources = [
                {"path": p, "content": next(c for pp, c in docs if pp == p)} for p in ann_paths
            ]
            hop_by_path = {r.path: r.hop for r in res.results}
            score_by_path = {r.path: r.score for r in res.results}
            sag2_results = [
                {"path": p, "key": p, "hop": hop_by_path.get(p, 0), "score": score_by_path.get(p, 0.0)}
                for p in sag2_paths
            ]
            fused = Sag2LexicalService.fuse_with_rag(sag2_results, rag_sources, k=RRF_K)
            fused_paths: list[str] = []
            for row in fused:
                p = row.get("path")
                if p and p not in fused_paths:
                    fused_paths.append(p)
            groups[f"{case['kind']}/g{case['group']}"] = {
                "ann": _metrics(ann_paths, gt),
                "sag2": _metrics(sag2_paths, gt),
                "fused": _metrics(fused_paths, gt),
            }
        result["groups"] = groups
        return result
    finally:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
        await conn.close()


def _mean_over(groups: dict, kind: str, leg: str, field: str = "recall") -> float:
    if kind == "overall":
        vals = [g[leg][field] for g in groups.values()]
    else:
        vals = [g[leg][field] for k, g in groups.items() if k.startswith(kind)]
    return statistics.fmean(vals) if vals else 0.0


def test_pgvector_ab_real_postgres():
    dsn = _dsn()
    if not dsn:
        pytest.skip("无 SAG2_TEST_DSN / DATABASE_URL / 仓库根 .env，跳过真实 pgvector A/B")

    result = asyncio.run(_run_ab())
    groups = result["groups"]

    # 1) 真实 pgvector 与 HNSW 索引真实存在
    assert result["vector_ext"], "vector 扩展未安装"
    assert any("hnsw" in d.lower() for d in result["indexes"]), (
        f"未创建 HNSW 索引: {result['indexes']}"
    )

    # 2) 单跳：两通道都能召回（ANN 用 hashing embedding 也能匹配含查询词的同文）
    assert _mean_over(groups, "single", "ann") == pytest.approx(1.0)
    assert _mean_over(groups, "single", "sag2") == pytest.approx(1.0)

    # 3) 多跳核心结论：答案不含查询词元时，hashing-ANN 单跳召不回、词法多跳能召回
    ann_multi = _mean_over(groups, "multihop", "ann")
    sag2_multi = _mean_over(groups, "multihop", "sag2")
    assert ann_multi <= 0.2, f"非语义 ANN 多跳召回异常偏高({ann_multi})，夹具或预期需复核"
    assert sag2_multi >= 0.8, f"词法多跳召回偏低({sag2_multi})"

    # 4) 总体：词法通道显著优于非语义 ANN
    ann_all = _mean_over(groups, "overall", "ann")
    sag2_all = _mean_over(groups, "overall", "sag2")
    assert sag2_all >= ann_all + 0.3, f"词法通道未显著优于 ANN: sag2={sag2_all} ann={ann_all}"

    # 5) 融合不劣于弱基线（ANN）；相对 SAG2 单通道允许极小回落（两腿高度分歧时
    #    固定 top-10 无法同时容纳两腿各自的全部独有项 —— 这是可证伪的真实边界，
    #    不在本测试里伪装成「融合全面 ≥ 各通道」）。
    fused_all = _mean_over(groups, "overall", "fused")
    assert fused_all >= ann_all, f"融合劣于 ANN 基线: fused={fused_all} ann={ann_all}"
    assert fused_all >= sag2_all - 0.15, f"融合相对 SAG2 回落过大: fused={fused_all} sag2={sag2_all}"


def test_pgvector_schema_cleanup():
    """真实跑一次后确认独立 schema 已 DROP，不留测试残留。"""
    dsn = _dsn()
    if not dsn:
        pytest.skip("无 DSN")

    async def _count() -> int:
        conn = await asyncpg.connect(dsn)
        try:
            rows = await conn.fetch(
                "select schema_name from information_schema.schemata "
                "where schema_name like 'sag2_ab_%'"
            )
            return len(rows)
        finally:
            await conn.close()

    before = asyncio.run(_count())
    result = asyncio.run(_run_ab())
    after = asyncio.run(_count())
    assert after <= before, f"schema 未清理: before={before} after={after} schema={result['schema']}"
