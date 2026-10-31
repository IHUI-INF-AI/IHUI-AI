# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Apache-2.0 须保留本声明与 NOTICE。
"""金标重标器 `bench/relabel_golden_answers.py` 的行为钉(纯内存 + tmp_path,零连库)。

钉住的六件事(AGENTS §5 测试隔离铁律:不碰 PG 8810 / Redis 8811,不碰网络):

1. 期望答案本就是源文件逐字子串 ⇒ `verbatim_keep`,一个字都不动。
2. 空围栏 ⇒ `empty_refetch`,重取的是**源文件真实字节**且仍是子串。
3. 改写句 ⇒ `paraphrase_refetch`,同样只可能是源文件切片。
4. 取不到 ⇒ `unsourceable`:既不进打分集(`SCORING_KINDS` 不含它、runner 显式剔除并计数),
   也不被丢(行仍在新金标件里,原文原样保留)。
5. **全量**断言:凡进打分集的期望串,对它声称的源文件必须逐字命中(不是抽样)。
6. 重标器只读原金标件:运行前后 sha256 逐字节相同。

判据不复制(AGENTS §0.6 / §22c):一律 import 源模块的 `__test__` 出口与
`run_retrieval_golden` 的 `Leaf`/`norm_for_anchor`/`unsourceable_ids`。
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import pytest

AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from bench import run_retrieval_golden as RRG
from bench.relabel_golden_answers import __test__ as RL  # noqa: E402
from bench.run_retrieval_golden import (  # noqa: E402
    CORPUS_DOCS,
    Leaf,
    norm_for_anchor,
    unsourceable_ids,
)

DOC_TEXT = (
    "# 部署指南\n"
    "\n"
    "## 服务拓扑\n"
    "### api\n"
    "后端服务监听 8802 端口，由 Fastify 5 承载。\n"
    "### web\n"
    "前端站点监听 8801 端口，由 Next.js 16 承载。\n"
)
API_LINE = "后端服务监听 8802 端口，由 Fastify 5 承载。"
LEAVES = [
    Leaf("topo#p00.l00", "topo#p00", "deploy", "api", API_LINE),
    Leaf("topo#p00.l01", "topo#p00", "deploy", "web", "前端站点监听 8801 端口，由 Next.js 16 承载。"),
]
CFG = RL["Config"](min_shared_tokens=2, min_score=0.05)


def item(qid: str, question: str, answer: str, doc: str = "deploy") -> dict[str, Any]:
    return {
        "question_id": qid,
        "question": question,
        "ground_truth_answer": answer,
        "expected_chunk_ids": ["deadbeefcafe0001"],
        "source_doc_id": doc,
        "difficulty": "easy",
        "tags": ["标题"],
    }


@pytest.fixture()
def located() -> list[Any]:
    return RL["locate_leaves"](DOC_TEXT, LEAVES, "deploy")


def run(items: list[dict[str, Any]], docs: dict[str, str | None], located: dict[str, list[Any]]):
    rel_of = {d: CORPUS_DOCS.get(d, f"docs/{d}.md") for d in docs}
    return RL["relabel_items"](items, docs, rel_of, located, CFG)


# ---------------------------------------------------------------------------
# 1 / 2 / 3 —— 三档判定
# ---------------------------------------------------------------------------


def test_verbatim_substring_is_left_byte_identical(located: list[Any]) -> None:
    rec = RL["relabel_one"](item("q-keep", "什么是后端服务？", API_LINE), DOC_TEXT, "docs/deploy.md", located, CFG)
    assert rec["kind"] == RL["KIND_KEEP"]
    assert rec["after"] == API_LINE  # 一个字都没动
    assert rec["leaf_id"] == "topo#p00.l00"
    assert rec["source_line_start"] == DOC_TEXT.count("\n", 0, DOC_TEXT.index(API_LINE)) + 1


def test_empty_fence_refetches_real_source_bytes_and_stays_substring(located: list[Any]) -> None:
    it = item("q-empty", f"什么是{API_LINE}？", "```")
    rec = RL["relabel_one"](it, DOC_TEXT, "docs/deploy.md", located, CFG)
    assert rec["kind"] == RL["KIND_EMPTY"]
    assert rec["before"] == "```"
    assert rec["after"] != rec["before"]
    assert rec["after"] in DOC_TEXT  # 取的是源文件真实字节
    assert norm_for_anchor(rec["after"]) != ""  # 锚得住:归一化后非空
    assert "```" not in rec["after"]


def test_paraphrase_refetch_is_a_slice_of_the_source_file(located: list[Any]) -> None:
    rec = RL["relabel_one"](
        item("q-para", "后端怎么部署？", "API 服务跑在 8802 上头，用 Fastify 承载"),
        DOC_TEXT,
        "docs/deploy.md",
        located,
        CFG,
    )
    assert rec["kind"] == RL["KIND_PARA"]
    assert rec["after"] in DOC_TEXT  # 红线:期望串只能是源文件切片
    assert rec["after"] != "API 服务跑在 8802 上头，用 Fastify 承载"  # 改写文本已被换掉


# ---------------------------------------------------------------------------
# 4 —— unsourceable:不进打分集,也不被丢
# ---------------------------------------------------------------------------


def test_missing_source_doc_lands_unsourceable_and_keeps_original_text() -> None:
    it = item("q-ghost", "什么问题？", "某句改写答案", doc="ghost-doc")
    rows, audit = run([it], {"ghost-doc": None}, {})
    assert audit[0]["kind"] == RL["KIND_UNSRC"]
    assert audit[0]["reason"] == "source_doc_missing"
    assert rows[0]["ground_truth_answer"] == "某句改写答案"  # 不编、不润、不删


def test_below_floor_selection_is_unsourceable_not_a_guess(located: list[Any]) -> None:
    it = item("q-noise", "无关问题", "Completely unrelated Latin sentence about kubernetes")
    rows, audit = run([it], {"deploy": DOC_TEXT}, {"deploy": located})
    assert audit[0]["kind"] == RL["KIND_UNSRC"]
    assert audit[0]["reason"].startswith("below_floor")
    assert rows[0]["ground_truth_answer"] == it["ground_truth_answer"]
    assert rows[0]["relabel"]["kind"] == RL["KIND_UNSRC"]


def test_unsourceable_row_is_excluded_from_scoring_but_not_deleted(tmp_path: Path) -> None:
    items = [
        item("q-keep", "什么是后端服务？", API_LINE),
        item("q-noise", "无关问题", "Completely unrelated Latin sentence about kubernetes"),
    ]
    rows, _ = run(items, {"deploy": DOC_TEXT}, {"deploy": RL["locate_leaves"](DOC_TEXT, LEAVES, "deploy")})
    assert len(rows) == len(items)  # 一条都没丢
    assert RL["KIND_UNSRC"] not in RL["SCORING_KINDS"]
    scored = [r for r in rows if r["relabel"]["kind"] in RL["SCORING_KINDS"]]
    assert [r["question_id"] for r in scored] == ["q-keep"]

    gpath = tmp_path / "g.jsonl"
    gpath.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    assert unsourceable_ids(gpath) == {"q-noise"}  # runner 侧显式剔除集(计数靠它)


# ---------------------------------------------------------------------------
# 5 —— 打分侧闭环:剔除条目既不进分母,也没被删行
# ---------------------------------------------------------------------------


def test_runner_excludes_unsourceable_from_denominator(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    src = AI_ROOT / "bench" / "fixtures_golden" / "golden_retrieval_kb.jsonl"
    if not src.is_file():
        pytest.skip("仓内无原金标件")
    rows = []
    for i, it in enumerate(RL["read_jsonl"](src)[:2]):
        r = dict(it)
        r["relabel"] = {"kind": RL["KIND_KEEP"] if i == 0 else RL["KIND_UNSRC"]}
        if i:
            r["ground_truth_answer"] = "Completely unrelated Latin sentence about kubernetes"
        rows.append(r)
    gp = tmp_path / "mixed.jsonl"
    gp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")

    assert unsourceable_ids(gp) == {rows[1]["question_id"]}
    rc = RRG.main(["--goldens", str(gp), "--mode", "text_only", "--no-write", "--json"])
    assert rc in (0, 2), f"runner 必须跑到判定或未判定,不得报输入面错误(1),实得 {rc}"
    summary = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert summary["golden_total"] == 2
    assert summary["golden_excluded_unsourceable"] == 1
    en = summary["runs"][0]["tracks"]["evidence_span"]
    assert en["judged"] + en["unjudged"] == 1, "被剔除的条目不得进分母"
    assert summary["runs"][0]["tracks"]["id_native"]["unjudged"] == 1
    assert len(RL["read_jsonl"](gp)) == 2, "剔除只发生在打分集层面,不得删行"


def test_legacy_golden_without_relabel_field_is_untouched(tmp_path: Path) -> None:
    """旧金标件没有 `relabel` 字段 ⇒ 剔除集必须是空集(加这道腿不得改旧行为)。"""
    src = AI_ROOT / "bench" / "fixtures_golden" / "golden_retrieval_kb.jsonl"
    if not src.is_file():
        pytest.skip("仓内无原金标件")
    gp = tmp_path / "legacy.jsonl"
    gp.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    assert unsourceable_ids(gp) == set()


# ---------------------------------------------------------------------------
# 6 —— 全量断言(对已交付的重标件,不是抽样)
# ---------------------------------------------------------------------------


def test_shipped_relabelled_golden_exists_or_skips() -> None:
    """交付面必须真落过盘:重标件 + 审计流水成对存在,行数等于原金标。"""
    out = next(iter(sorted((AI_ROOT / "bench" / "fixtures_golden").glob("golden_retrieval_kb.relabelled-*.jsonl"))), None)
    if out is None:
        pytest.skip("本席未落盘重标件(无对照物可全量断言)")
    audit_dir = Path(AI_ROOT) / "bench" / "reports"
    aud = next(iter(sorted(audit_dir.glob("golden-relabel-*.jsonl"))), None)
    rows = RL["read_jsonl"](out)
    assert rows, "重标件不得为空"
    assert aud is not None and len(RL["read_jsonl"](aud)) == len(rows)
    # 全量:每条期望串对它声称的源文件逐字命中(unsourceable 除外)
    texts, _located = RL["load_corpus"](sorted({str(r["source_doc_id"]) for r in rows}))
    checked = 0
    for r in rows:
        if r["relabel"]["kind"] == RL["KIND_UNSRC"]:
            assert r["ground_truth_answer"]  # 原文保留,不静默清空
            continue
        txt = texts.get(str(r["source_doc_id"]))
        assert txt is not None, f'{r["question_id"]} 的源文件读不到'
        assert r["ground_truth_answer"] in txt, f'{r["question_id"]} 期望串不是源文件子串'
        checked += 1
    assert checked > 0


# ---------------------------------------------------------------------------
# 7 —— 原金标件只读
# ---------------------------------------------------------------------------


def test_cli_does_not_touch_the_original_golden(tmp_path: Path) -> None:
    src = Path(AI_ROOT) / "bench" / "fixtures_golden" / "golden_retrieval_kb.jsonl"
    if not src.is_file():
        pytest.skip("仓内无原金标件")
    copy = tmp_path / "orig.jsonl"
    copy.write_bytes(src.read_bytes())
    before = hashlib.sha256(copy.read_bytes()).hexdigest()
    out = tmp_path / "relabelled.jsonl"
    aud = tmp_path / "audit.jsonl"
    rc = RL["main"]([
        "--goldens",
        str(copy),
        "--out",
        str(out),
        "--audit",
        str(aud),
        "--date",
        "1970-01-01",
        "--write",
    ])
    assert rc == 0
    assert hashlib.sha256(copy.read_bytes()).hexdigest() == before  # 前后逐字节相同
    assert out.is_file() and aud.is_file()
    assert len(RL["read_jsonl"](out)) == len(RL["read_jsonl"](copy))
    # 重标后的条目里,至少一条真进了打分集(否则整轮是空跑)
    assert any(json.loads(l)["relabel"]["kind"] != RL["KIND_UNSRC"] for l in out.read_text(encoding="utf-8").splitlines() if l.strip())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
