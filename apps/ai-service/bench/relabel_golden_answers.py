# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Apache-2.0 须保留本声明与 NOTICE。
"""金标答案重标器(2026-11-01 立,goal-b47 席 V)。

**它解决的问题**:`bench/fixtures_golden/golden_retrieval_kb.jsonl` 里有一部分条目的
`ground_truth_answer` 不是源文档的逐字片段(只剩裸 ``` 围栏,或是改写/摘要句)。
`bench/run_retrieval_golden.py` 的 `evidence_span` 轨按「金标答案归一化后落在哪一块」
找相关块,于是这些数据缺陷会让"答对了"的题也记不中,把召回指标往下拽。本器把
**数据缺陷**与**检索真差**分开量。

三档判定(逐条,不抽样):

- `verbatim_keep` —— 期望答案本就是所引用文件的逐字子串 ⇒ 原样不动。
- `empty_refetch` / `paraphrase_refetch` —— 空围栏或改写句 ⇒ 从源文件**重取一段逐字片段**。
- `unsourceable` —— 源文件取不到(文件缺失 / 无任何逐字片段可达 / 相似度低于地板)
  ⇒ 保留原文并打标记,由 runner 显式从打分集剔除并计数(不静默删、也不留在打分集里
  冒充"答错了")。

红线(**结构性保证,不靠自觉**):重标后的期望串只能是 `doc_text` 的字节切片
(`cand = doc_text[start:end]`),取片的候选位置来自 `run_retrieval_golden.build_corpus()`
的叶子块区间,选哪一段由「与探针的 token 重合度」决定并逐条写进审计流水。本器没有任何
一处把模型/人工文本写进期望字段:改写只发生在**选取**,不发生在**内容**。

判据单源(AGENTS §0.6):归一化 `norm_for_anchor`、分词 `tokenize`、语料与切块
`build_corpus`、文档映射 `CORPUS_DOCS` 一律 import `bench.run_retrieval_golden`,
本文件不重写第二份。

用法(默认档零连库、零模型、零网络):

```bash
cd apps/ai-service && python bench/relabel_golden_answers.py            # 只算,打印分档计数
python bench/relabel_golden_answers.py --write                          # 另存新金标 + 审计流水
python bench/relabel_golden_answers.py --write --date 2026-11-01         # 指定文件名日期后缀
```

退出码:0 = 判完(哪怕全 `unsourceable`);1 = 输入面错误(金标读不到 / 校验未过);
2 = 未判定(一条都判不了 —— 例如金标为空)。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

AI_ROOT = Path(__file__).resolve().parents[1]  # apps/ai-service
REPO_ROOT = AI_ROOT.parents[1]  # 仓根
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from bench.run_retrieval_golden import (  # noqa: E402  (必须先立 sys.path)
    CORPUS_DOCS,
    GOLDEN_PATH,
    build_corpus,
    norm_for_anchor,
    tokenize,
)

FIXTURES_DIR = AI_ROOT / "bench" / "fixtures_golden"
REPORTS_DIR = AI_ROOT / "bench" / "reports"

KIND_KEEP = "verbatim_keep"
KIND_EMPTY = "empty_refetch"
KIND_PARA = "paraphrase_refetch"
KIND_UNSRC = "unsourceable"
KINDS: tuple[str, ...] = (KIND_KEEP, KIND_EMPTY, KIND_PARA, KIND_UNSRC)
_SENT_HEAD_RE = re.compile("[。；;\\n]")
SCORING_KINDS: frozenset[str] = frozenset({KIND_KEEP, KIND_EMPTY, KIND_PARA})


@dataclass(frozen=True)
class Config:
    """选取地板:低于它就不许编,直接落 unsourceable。"""

    min_shared_tokens: int = 2
    min_score: float = 0.05
    max_window_lines: int = 3
    max_candidate_chars: int = 400


@dataclass(frozen=True)
class Candidate:
    text: str
    start: int
    end: int
    leaf_id: str
    parent_id: str
    score: float
    shared: int


@dataclass(frozen=True)
class LocatedLeaf:
    leaf_id: str
    parent_id: str
    start: int
    end: int


# ---------------------------------------------------------------------------
# 纯判据层(可被测试直接注入,不碰磁盘)
# ---------------------------------------------------------------------------


def question_core(question: str) -> str:
    """金标题干形如「什么是<原文片段>？」—— 去掉包裹词后就是原文探针。"""
    s = (question or "").strip()
    for lead in ("什么是", "简述", "请说明", "请描述"):
        if s.startswith(lead):
            s = s[len(lead) :]
            break
    return s.strip().rstrip("？?。.，,、 ").strip()


def dice(tokens_a: Sequence[str], tokens_b: Sequence[str]) -> tuple[float, int]:
    """Sørenson–Dice(token 集合)+ 共有 token 数;两侧都空 ⇒ 0。"""
    a, b = set(tokens_a), set(tokens_b)
    if not a or not b:
        return 0.0, 0
    inter = len(a & b)
    return 2.0 * inter / (len(a) + len(b)), inter


def line_spans(text: str) -> list[tuple[int, int]]:
    """每行的 [start, end) 字符区间(不含行尾换行符)。"""
    starts = [0]
    for i, ch in enumerate(text):
        if ch == "\n":
            starts.append(i + 1)
    out = []
    for k, st in enumerate(starts):
        en = starts[k + 1] - 1 if k + 1 < len(starts) else len(text)
        out.append((st, en))
    return out


def locate_leaves(doc_text: str, leaves: Sequence[Any], doc_id: str) -> list[LocatedLeaf]:
    """把 runner 的叶子块映射回源文件字符区间;定位不到的叶子不参与取片(不猜位置)。

    `leaves` 接受任何带 `leaf_id/parent_id/text` 的对象(生产用 `build_corpus()` 的 `Leaf`,
    测试可注入同形状的替身),不额外要求 `doc_id` 字段。
    """
    out: list[LocatedLeaf] = []
    for lf in leaves:
        if getattr(lf, "doc_id", doc_id) != doc_id:
            continue
        body = str(getattr(lf, "text", ""))
        if not body.strip():
            continue
        idx = doc_text.find(body)
        if idx < 0:
            continue  # 归一化差异等导致对不上 ⇒ 宁缺毋滥
        out.append(
            LocatedLeaf(str(lf.leaf_id), str(lf.parent_id), idx, idx + len(body))
        )
    return out


def _runs_of_nonblank_lines(spans: Sequence[tuple[int, int]], text: str, lo: int, hi: int) -> list[list[tuple[int, int]]]:
    """叶子区间内的「连续非空行游程」(空行断开游程,避免取片横跨空白噪声)。"""
    runs: list[list[tuple[int, int]]] = []
    cur: list[tuple[int, int]] = []
    for st, en in spans:
        if st < lo or en > hi:
            if cur:
                runs.append(cur)
                cur = []
            continue
        if not text[st:en].strip():
            if cur:
                runs.append(cur)
                cur = []
            continue
        cur.append((st, en))
    if cur:
        runs.append(cur)
    return runs


def _clause_slices(doc_text: str, st: int, en: int) -> list[tuple[int, int]]:
    """行内子句切片(句子终止符断开)——一行是一条长 bullet 时,子句才是「对应内容」。"""
    out: list[tuple[int, int]] = []
    cur = st
    for i in range(st, en):
        if doc_text[i] in "。!?；;":
            j = i + 1
            while j < en and doc_text[j] in "”』）」)":
                j += 1
            if doc_text[cur:j].strip():
                out.append((cur, j))
            cur = j
    if doc_text[cur:en].strip():
        out.append((cur, en))
    return out


def span_candidates(
    doc_text: str, located: Sequence[LocatedLeaf], cfg: Config
) -> Iterable[tuple[str, int, int, LocatedLeaf]]:
    """全部合法逐字片段候选:行游程内 1..max_window_lines 行的**原样切片** + 行内子句 + 整块。"""
    spans = line_spans(doc_text)
    for lf in located:
        for run in _runs_of_nonblank_lines(spans, doc_text, lf.start, lf.end):
            for i in range(len(run)):
                for st, en in _clause_slices(doc_text, run[i][0], run[i][1]):
                    cand = doc_text[st:en]
                    if 0 < len(cand) <= cfg.max_candidate_chars and norm_for_anchor(cand):
                        yield cand, st, en, lf
                for j in range(i, min(i + cfg.max_window_lines, len(run))):
                    start, end = run[i][0], run[j][1]
                    cand = doc_text[start:end]
                    if 0 < len(cand) <= cfg.max_candidate_chars and norm_for_anchor(cand):
                        yield cand, start, end, lf
        whole = doc_text[lf.start : lf.end]
        if 0 < len(whole) <= cfg.max_candidate_chars and norm_for_anchor(whole):
            yield whole, lf.start, lf.end, lf


def probe_needles(probe: str) -> list[str]:
    """探针自身可当针尖用的形态:整条探针 / 首句 / 去掉题干包裹词后的核心。

    命中即「期望串本身就是源文件里的这段字节」—— 比窗口档更强的证据(逐字等值,不是重合)。
    """
    out: list[str] = []
    for needle in (
        probe.strip(),
        _SENT_HEAD_RE.split(probe.strip())[0] if probe.strip() else "",
        question_core(probe),
    ):
        n = needle.strip().strip("`* ").strip()
        if n and n not in out:
            out.append(n)
    return out


def pick_span(
    probe: str,
    doc_text: str,
    located: Sequence[LocatedLeaf],
    cfg: Config,
) -> Candidate | None:
    """重合度最高的逐字片段;一个都造不出来 ⇒ None(不回落、不编)。"""
    probe_tokens = tokenize(probe)
    best: Candidate | None = None
    for needle in probe_needles(probe):
        if len(needle) > cfg.max_candidate_chars or not norm_for_anchor(needle):
            continue
        idx = doc_text.find(needle)
        if idx < 0:
            continue  # 针尖不是源文件字节 ⇒ 不许用
        holder = next((l for l in located if l.start <= idx and idx + len(needle) <= l.end), None)
        if holder is None:
            continue  # 在文件里但跨出了 runner 的块边界 ⇒ 锚不到块,不用
        sc, sh = dice(probe_tokens, tokenize(needle))
        best = Candidate(needle, idx, idx + len(needle), holder.leaf_id, holder.parent_id, sc, sh)
        break  # 探针自身已逐字在源文件里,没有更贴的切片了
    for cand, start, end, lf in span_candidates(doc_text, located, cfg):
        sc, sh = dice(probe_tokens, tokenize(cand))
        if best is not None and (sc, -start) <= (best.score, -best.start):
            continue
        if norm_for_anchor(cand) not in norm_for_anchor(doc_text[lf.start : lf.end]):
            continue  # 双保险:必须落得进这一块
        best = Candidate(cand, start, end, lf.leaf_id, lf.parent_id, sc, sh)
    return best


def relabel_one(
    item: dict[str, Any], doc_text: str | None, doc_rel: str, located: Sequence[LocatedLeaf], cfg: Config
) -> dict[str, Any]:
    """一条金标 ⇒ 一条审计记录(含 `after` 与分档 `kind`)。"""
    before = str(item.get("ground_truth_answer", ""))
    rec: dict[str, Any] = {
        "question_id": str(item.get("question_id", "")),
        "kind": "",
        "before": before,
        "after": before,
        "source_file": doc_rel,
        "source_line_start": 0,
        "source_line_end": 0,
        "leaf_id": "",
        "parent_id": "",
        "overlap": 0.0,
        "shared_tokens": 0,
        "reason": "",
    }
    if doc_text is None:
        rec["kind"] = KIND_UNSRC  # 源文件取不到
        rec["reason"] = "source_doc_missing"
        return rec
    text = doc_text

    def fill(cand: Candidate) -> None:
        rec["after"] = cand.text
        rec["leaf_id"] = cand.leaf_id
        rec["parent_id"] = cand.parent_id
        rec["overlap"] = round(cand.score, 6)
        rec["shared_tokens"] = cand.shared
        rec["source_line_start"] = text.count("\n", 0, cand.start) + 1
        rec["source_line_end"] = text.count("\n", 0, cand.end) + 1

    nans = norm_for_anchor(before)
    if nans and before in text:
        rec["kind"] = KIND_KEEP
        rec["overlap"] = 1.0
        holder = _locate_exact(before, located, doc_text)
        if holder is not None:
            fill(holder)
        return rec

    empty_answer = not nans
    probe = str(item.get("question", "")) if empty_answer else before
    if not norm_for_anchor(probe):
        rec["kind"] = KIND_UNSRC
        rec["reason"] = "no_probe_text"
        return rec
    best = pick_span(probe, doc_text, located, cfg)
    if best is None:
        rec["kind"] = KIND_UNSRC
        rec["reason"] = "no_verbatim_span"
        return rec
    rec["overlap"] = round(best.score, 6)
    rec["shared_tokens"] = best.shared
    if best.shared < cfg.min_shared_tokens or best.score < cfg.min_score:
        rec["kind"] = KIND_UNSRC
        rec["reason"] = f"below_floor(shared>={cfg.min_shared_tokens},score>={cfg.min_score})"
        return rec
    fill(best)
    rec["kind"] = KIND_EMPTY if empty_answer else KIND_PARA
    return rec


def _locate_exact(needle: str, located: Sequence[LocatedLeaf], doc_text: str) -> Candidate | None:
    """已逐字命中的条目只做定位登记(取片=原文,不改一个字节)。"""
    idx = doc_text.find(needle)
    if idx < 0:
        return None
    for lf in located:
        if lf.start <= idx and idx + len(needle) <= lf.end:
            return Candidate(needle, idx, idx + len(needle), lf.leaf_id, lf.parent_id, 1.0, len(set(tokenize(needle))))
    return None


# ---------------------------------------------------------------------------
# 装配层
# ---------------------------------------------------------------------------


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            out.append(json.loads(line))
    return out


def relabel_items(
    items: Sequence[dict[str, Any]],
    doc_texts: dict[str, str | None],
    doc_rel_of: dict[str, str],
    leaves_by_doc: dict[str, list[LocatedLeaf]],
    cfg: Config = Config(),
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """返回 (新金标行, 审计行)。新金标行 = 原 7 键 + `relabel` 溯源块(不原地覆盖)。"""
    audit: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for it in items:
        doc_id = str(it.get("source_doc_id", ""))
        doc_text = doc_texts.get(doc_id)
        rec = relabel_one(it, doc_text, doc_rel_of.get(doc_id, ""), leaves_by_doc.get(doc_id, []), cfg)
        audit.append(rec)
        row = dict(it)
        if rec["kind"] != KIND_UNSRC:
            row["ground_truth_answer"] = rec["after"]
        row["relabel"] = {k: rec[k] for k in (
            "kind", "source_file", "source_line_start", "source_line_end", "leaf_id", "parent_id", "overlap", "reason"
        )}
        rows.append(row)
    return rows, audit


def load_corpus(doc_ids: Iterable[str]) -> tuple[dict[str, str | None], dict[str, list[LocatedLeaf]]]:
    """读源文件 + runner 的切块,映射成逐字取片区间(全走单源 import,不复算)。"""
    texts: dict[str, str | None] = {}
    for d in doc_ids:
        rel = CORPUS_DOCS.get(d, "")
        if not rel:
            texts[d] = None
            continue
        path = REPO_ROOT / rel
        texts[d] = path.read_text(encoding="utf-8") if path.is_file() else None
    cor = build_corpus()
    located = {d: locate_leaves(t, cor.leaves, d) for d, t in texts.items() if t is not None}
    return texts, located


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="金标答案重标器(零连库、零模型、零网络)")
    ap.add_argument("--goldens", default=str(GOLDEN_PATH), help="被重标的金标件路径")
    ap.add_argument("--out", default="", help="新金标件路径(默认 fixtures_golden/golden_retrieval_kb.relabelled-<date>.jsonl)")
    ap.add_argument("--audit", default="", help="审计流水路径(默认 reports/golden-relabel-<date>.jsonl)")
    ap.add_argument("--date", default="", help="文件名日期后缀,默认今天(UTC)")
    ap.add_argument("--min-score", type=float, default=Config.min_score, help="选取地板:Dice 重合度下限")
    ap.add_argument("--min-shared", type=int, default=Config.min_shared_tokens, help="选取地板:共有 token 数下限")
    ap.add_argument("--write", action="store_true", help="落盘(默认只算并打印分档计数)")
    args = ap.parse_args(argv)

    cfg = Config(min_shared_tokens=args.min_shared, min_score=args.min_score)
    gpath = Path(args.goldens)
    if not gpath.is_file():
        print(f"INPUT-ERROR: 金标文件不存在:{gpath}")
        return 1
    items = read_jsonl(gpath)
    if not items:
        print("UNJUDGED: 金标 0 条,无可判对象")
        return 2
    doc_ids = sorted({str(it.get("source_doc_id", "")) for it in items})
    doc_texts, located = load_corpus(doc_ids)
    doc_rel_of = {d: CORPUS_DOCS.get(d, "") for d in doc_ids}
    before_sha = sha256_of(gpath)

    rows, audit = relabel_items(items, doc_texts, doc_rel_of, located, cfg)

    # 全量断言(不是抽样):凡进了打分集的期望串,必须对它声称的源文件逐字命中
    bad: list[str] = []
    for r in rows:
        if r["relabel"]["kind"] == KIND_UNSRC:
            continue
        rel = r["relabel"]["source_file"]
        txt = doc_texts.get(str(r.get("source_doc_id", "")))
        if txt is None or not rel or r["ground_truth_answer"] not in txt:
            bad.append(str(r.get("question_id", "")))
    counts = {k: sum(1 for a in audit if a["kind"] == k) for k in KINDS}
    print(json.dumps({
        "golden": _rel(gpath),
        "golden_sha256_before": before_sha,
        "items": len(items),
        "kinds": counts,
        "scoring_set": sum(counts[k] for k in SCORING_KINDS),
        "excluded_unsourceable": counts[KIND_UNSRC],
        "substring_assert_failed": len(bad),
        "unsourceable_reasons": _reason_hist(audit),
    }, ensure_ascii=False, indent=2, sort_keys=True))
    if bad:
        print(f"ASSERT-FAIL: {len(bad)} 条期望串不是源文件子串,例:{bad[:5]}")
        return 1
    if not args.write:
        print("DRY-RUN: 未落盘(加 --write 才写文件)")
        return 0
    date = args.date or datetime.now(UTC).strftime("%Y-%m-%d")
    out = Path(args.out) if args.out else FIXTURES_DIR / f"golden_retrieval_kb.relabelled-{date}.jsonl"
    aud = Path(args.audit) if args.audit else REPORTS_DIR / f"golden-relabel-{date}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    aud.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(json.dumps(r, ensure_ascii=False, sort_keys=False) + "\n" for r in rows), encoding="utf-8")
    aud.write_text("".join(json.dumps(a, ensure_ascii=False, sort_keys=False) + "\n" for a in audit), encoding="utf-8")
    if sha256_of(gpath) != before_sha:
        print("ASSERT-FAIL: 原金标件被改动(重标器只读不写原件)")
        return 1
    for p in (out, aud):
        print(f"written: {p}")
    return 0


def _reason_hist(audit: Sequence[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for a in audit:
        if a["kind"] == KIND_UNSRC and a["reason"]:
            out[a["reason"]] = out.get(a["reason"], 0) + 1
    return out


if __name__ == "__main__":
    sys.exit(main())

__test__ = {
    "Config": Config,
    "Candidate": Candidate,
    "LocatedLeaf": LocatedLeaf,
    "KINDS": KINDS,
    "KIND_KEEP": KIND_KEEP,
    "KIND_EMPTY": KIND_EMPTY,
    "KIND_PARA": KIND_PARA,
    "KIND_UNSRC": KIND_UNSRC,
    "SCORING_KINDS": SCORING_KINDS,
    "question_core": question_core,
    "dice": dice,
    "line_spans": line_spans,
    "locate_leaves": locate_leaves,
    "span_candidates": span_candidates,
    "probe_needles": probe_needles,
    "pick_span": pick_span,
    "_clause_slices": _clause_slices,
    "relabel_one": relabel_one,
    "relabel_items": relabel_items,
    "load_corpus": load_corpus,
    "read_jsonl": read_jsonl,
    "main": main,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
