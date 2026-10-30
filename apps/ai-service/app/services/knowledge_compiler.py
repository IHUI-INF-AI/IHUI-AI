# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G5 编译式知识引擎·核心层(2026-10-30 立项)。

把散落在代码索引(codebase_indexer)与跨会话记忆(long_term_memory)里的条目,
**确定性地**编译为两类产物(全程零 LLM 调用):

  1. 机读卡:`<workspace>/.ihui/knowledge/cards/<slug>.json`(卡片数组,整体覆盖写)
     字段:{id, kind(convention|fact|procedure), statement,
           anchors:[{type:file|transcript, ref, line?}],
           compiled_at, ttl_days, source_hash}
  2. 人读 wiki:`<workspace>/.ihui/wiki/<slug>.md`
     文件头带编译时间与源 hash;正文按 kind 分节,每条带锚点回链(相对路径+行号)。

纪律(设计拍板,不得漂):
- **无锚条目拒绝编译**:缺 file_path / session_id 的条目进 rejected[{reason}],不产卡。
  锚点是卡片可溯源的唯一凭据;无锚卡片等于把幻觉写进知识库。
- **同 source_hash 重编译 = 覆盖不追加**:写盘前读卡内既有 source_hash,相同则沿用
  旧 compiled_at ⇒ 重编译产物逐字节幂等。
- **读取时过滤 TTL 过期**:load_active_cards 按 compiled_at + ttl_days 剔除过期卡,
  过期即不可见(宁缺毋滥,不做"过期宽限")。

sources 参数为测试/调用方注入缝:缺省内部调 codebase_indexer.search +
long_term_memory.recall_cross_session;注入时形态同
{"codebase": [...], "summaries": [...]}。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

# kind 枚举:procedure 为 schema 预留档,当前确定性映射只产 fact/convention。
CARD_KINDS = frozenset({"convention", "fact", "procedure"})

_CARDS_SUBDIR = Path(".ihui") / "knowledge" / "cards"
_WIKI_SUBDIR = Path(".ihui") / "wiki"

_STATEMENT_MAX_CHARS = 300


def slugify(project_id: str) -> str:
    """项目 id → 文件安全 slug:小写、非字母数字折叠为 -,空回退 'project'。"""
    s = re.sub(r"[^a-z0-9]+", "-", str(project_id or "").strip().lower()).strip("-")
    return s or "project"


def _canonical(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_source_hash(entries: list[dict[str, Any]]) -> str:
    """源条目指纹:逐条 canonical JSON 排序后整体 sha256(条目顺序无关)。"""
    canon = sorted(_canonical(e) for e in entries)
    return hashlib.sha256("\n".join(canon).encode("utf-8")).hexdigest()


def _truncate(text: str) -> str:
    t = " ".join(str(text).split())
    return t[:_STATEMENT_MAX_CHARS]


# =============================================================================
# 缺省源读取(测试经 sources 注入替身,不打这里)
# =============================================================================


async def _default_sources(
    project_id: str,
    user_id: str | None,
    api_token: str | None,
) -> dict[str, list[dict[str, Any]]]:
    """读取两源:代码索引切片 + 跨会话记忆摘要。任一源失败按空降级(编译不因它翻红)。"""
    from .codebase_indexer import codebase_indexer
    from .long_term_memory import long_term_memory

    codebase: list[dict[str, Any]] = []
    try:
        codebase = await codebase_indexer.search(
            query=project_id,
            repo_id=project_id,
            internal_user_id=user_id,
            api_token=api_token,
        )
    except Exception:  # noqa: BLE001 — 检索面失败 ⇒ 该源为空,继续编译另一源
        codebase = []
    summaries: list[dict[str, Any]] = []
    if user_id:
        try:
            summaries = await long_term_memory.recall_cross_session(user_id, project_id)
        except Exception:  # noqa: BLE001
            summaries = []
    return {"codebase": codebase, "summaries": summaries}


# =============================================================================
# 条目 → 卡片映射(纯确定性)
# =============================================================================


def _build_cards(
    slug: str,
    codebase_chunks: list[dict[str, Any]],
    summaries: list[dict[str, Any]],
    *,
    ttl_days: int,
) -> tuple[list[dict[str, Any]], list[dict[str, str]], list[dict[str, Any]]]:
    """源条目 → (卡片, 拒绝, 规范化源记录)。无锚条目一律进 rejected,不产卡。"""
    cards: list[dict[str, Any]] = []
    rejected: list[dict[str, str]] = []
    raw: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    def _add(kind: str, statement: str, anchor: dict[str, Any]) -> None:
        card_id = "kc-%s-%s" % (
            slug,
            hashlib.sha256(_canonical([kind, statement, [anchor]]).encode("utf-8")).hexdigest()[:16],
        )
        if card_id in seen_ids:  # 同源重复条目去重(幂等的一部分)
            return
        seen_ids.add(card_id)
        cards.append(
            {
                "id": card_id,
                "kind": kind,
                "statement": statement,
                "anchors": [anchor],
                "compiled_at": "",  # 写盘前统一盖章
                "ttl_days": ttl_days,
                "source_hash": "",  # 写盘前统一盖章
            }
        )

    for chunk in codebase_chunks:
        if not isinstance(chunk, dict):
            rejected.append({"reason": "codebase 切片形态非法(非对象),拒绝编译"})
            continue
        raw.append({"source": "codebase", "entry": chunk})
        fp = str(chunk.get("file_path") or "").strip()
        if not fp:
            rejected.append({"reason": "codebase 切片缺少 file_path 锚点,拒绝编译"})
            continue
        line = chunk.get("line_start")
        line = int(line) if isinstance(line, (int, float)) else None
        anchor: dict[str, Any] = {"type": "file", "ref": fp}
        if line is not None:
            anchor["line"] = line
        symbol = str(chunk.get("symbol_name") or "").strip()
        stype = str(chunk.get("symbol_type") or "").strip()
        if symbol:
            statement = _truncate(
                f"{fp}:{line if line is not None else '?'} 存在 {stype or 'symbol'} {symbol}"
            )
        else:
            content = str(chunk.get("content") or "").strip()
            head = content.splitlines()[0].strip() if content else ""
            if not head:
                rejected.append({"reason": f"codebase 切片 {fp} 无符号且内容为空,拒绝编译"})
                continue
            statement = _truncate(f"{fp}:{line if line is not None else '?'} 代码事实: {head}")
        _add("fact", statement, anchor)

    for summary in summaries:
        if not isinstance(summary, dict):
            rejected.append({"reason": "会话摘要形态非法(非对象),拒绝编译"})
            continue
        raw.append({"source": "session", "entry": summary})
        sid = str(summary.get("session_id") or "").strip()
        facts = summary.get("key_facts") or []
        decisions = summary.get("key_decisions") or []
        if not sid:
            if facts or decisions:
                rejected.append({"reason": "会话摘要缺少 session_id 锚点,拒绝编译"})
            continue
        for kind, items in (("fact", facts), ("convention", decisions)):
            for item in items:
                text = _truncate(item if isinstance(item, str) else _canonical(item))
                if not text:
                    rejected.append({"reason": f"会话 {sid} 存在空陈述条目,拒绝编译"})
                    continue
                _add(kind, text, {"type": "transcript", "ref": sid})

    return cards, rejected, raw


# =============================================================================
# wiki 渲染
# =============================================================================


_KIND_SECTION: dict[str, tuple[str, str]] = {
    "convention": ("约定(convention)", "约定"),
    "fact": ("事实(fact)", "事实"),
    "procedure": ("流程(procedure)", "流程"),
}


def _anchor_backlink(card: dict[str, Any], workspace_root: Path, wiki_dir: Path) -> str:
    """锚点回链:file 锚 → [path:line](相对wiki路径#Lline);transcript 锚 → 纯文本凭据。"""
    parts: list[str] = []
    for anchor in card.get("anchors") or []:
        atype = str(anchor.get("type") or "")
        ref = str(anchor.get("ref") or "")
        line = anchor.get("line")
        if atype == "file" and ref:
            try:
                target = Path(ref) if os.path.isabs(ref) else workspace_root / ref
                rel = os.path.relpath(target, wiki_dir).replace("\\", "/")
            except ValueError:  # 跨盘符无法取相对路径 ⇒ 原样落文本
                rel = ref.replace("\\", "/")
            label = f"{ref}:{line}" if line is not None else ref
            frag = f"#L{line}" if line is not None else ""
            parts.append(f"[{label}]({rel}{frag})")
        elif atype == "transcript" and ref:
            parts.append(f"transcript:{ref}")
        else:
            parts.append(f"{atype or 'anchor'}:{ref}")
    return "; ".join(parts)


def _render_wiki(
    slug: str,
    project_id: str,
    cards: list[dict[str, Any]],
    rejected_count: int,
    *,
    workspace_root: Path,
    wiki_dir: Path,
) -> str:
    """人读 wiki:头部编译时间+源hash,正文按 kind 分节,每条带锚点回链。"""
    compiled_at = cards[0]["compiled_at"] if cards else ""
    source_hash = cards[0]["source_hash"] if cards else ""
    lines = [
        f"# {slug} — 编译式知识卡片(人读视图)",
        "",
        f"- 项目: {project_id}",
        f"- 编译时间: {compiled_at}",
        f"- 源指纹: sha256:{source_hash}",
        f"- 卡片: {len(cards)} | 拒绝条目: {rejected_count}",
        "",
    ]
    for kind, (title, _) in _KIND_SECTION.items():
        group = [c for c in cards if c.get("kind") == kind]
        if not group:
            continue
        lines.append(f"## {title}")
        lines.append("")
        for c in group:
            lines.append(f"- {c['statement']}")
            backlink = _anchor_backlink(c, workspace_root, wiki_dir)
            if backlink:
                lines.append(f"  - 锚点: {backlink}")
        lines.append("")
    if not cards:
        lines.append("_本次编译未产出任何有效卡片(全部条目被拒绝或源为空)。_")
        lines.append("")
    return "\n".join(lines)


# =============================================================================
# 编译主入口
# =============================================================================


async def compile_project(
    project_id: str,
    workspace_root: str | Path,
    *,
    user_id: str | None = None,
    api_token: str | None = None,
    dry_run: bool = False,
    ttl_days: int = 30,
    sources: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """编译一个项目的知识卡片 + wiki。返回 {cards, wiki_files, rejected, source_hash}。

    cards/wiki_files 为**产出数量**;dry_run=True 只算不写盘。
    同 source_hash 重编译 ⇒ 覆盖写且沿用旧 compiled_at(逐字节幂等)。
    """
    workspace_root = Path(workspace_root)
    slug = slugify(project_id)
    if sources is None:
        sources = await _default_sources(project_id, user_id, api_token)
    cards, rejected, raw = _build_cards(
        slug,
        list(sources.get("codebase") or []),
        list(sources.get("summaries") or []),
        ttl_days=ttl_days,
    )
    source_hash = compute_source_hash(raw)

    cards_dir = workspace_root / _CARDS_SUBDIR
    cards_path = cards_dir / f"{slug}.json"
    wiki_dir = workspace_root / _WIKI_SUBDIR
    wiki_path = wiki_dir / f"{slug}.md"

    # 幂等盖章:既有卡库源指纹相同 ⇒ 沿用旧 compiled_at(重编译逐字节不变)。
    compiled_at = ""
    if cards_path.exists():
        try:
            prev = json.loads(cards_path.read_text(encoding="utf-8"))
            if isinstance(prev, list) and prev and str(prev[0].get("source_hash") or "") == source_hash:
                compiled_at = str(prev[0].get("compiled_at") or "")
        except (OSError, ValueError):
            compiled_at = ""
    if not compiled_at:
        compiled_at = datetime.now(UTC).isoformat()
    for c in cards:
        c["compiled_at"] = compiled_at
        c["source_hash"] = source_hash

    wiki_files = 0
    if not dry_run:
        cards_dir.mkdir(parents=True, exist_ok=True)
        cards_path.write_text(
            json.dumps(cards, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        wiki_dir.mkdir(parents=True, exist_ok=True)
        wiki_path.write_text(
            _render_wiki(slug, project_id, cards, len(rejected), workspace_root=workspace_root, wiki_dir=wiki_dir),
            encoding="utf-8",
        )
        wiki_files = 1

    return {
        "cards": len(cards),
        "wiki_files": wiki_files,
        "rejected": rejected,
        "source_hash": source_hash,
    }


# =============================================================================
# 读取面(TTL 过滤)
# =============================================================================


def _parse_ts(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def load_active_cards(
    workspace_root: str | Path,
    slug: str | None = None,
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """读取有效卡片:compiled_at + ttl_days 已过期的卡一律过滤(读取时判活,不落盘删除)。"""
    base = Path(workspace_root) / _CARDS_SUBDIR
    if not base.exists():
        return []
    files = [base / f"{slug}.json"] if slug else sorted(base.glob("*.json"))
    now = now or datetime.now(UTC)
    active: list[dict[str, Any]] = []
    for f in files:
        if not f.exists():
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(data, list):
            continue
        for card in data:
            if not isinstance(card, dict):
                continue
            compiled = _parse_ts(card.get("compiled_at"))
            ttl = card.get("ttl_days")
            ttl = int(ttl) if isinstance(ttl, (int, float)) else 30
            if compiled is not None and compiled + timedelta(days=ttl) <= now:
                continue  # TTL 过期 ⇒ 不可见
            active.append(card)
    return active


def _query_tokens(query: str) -> list[str]:
    """确定性关键词切分:ASCII 词(≥2 字符)+ 中日韩双字组(单字段落保留单字)。"""
    q = query.lower()
    tokens = re.findall(r"[a-z0-9_]{2,}", q)
    for seg in re.findall(r"[\u4e00-\u9fff]+", q):
        if len(seg) == 1:
            tokens.append(seg)
        else:
            tokens.extend(seg[i : i + 2] for i in range(len(seg) - 1))
    return tokens


def select_relevant_cards(
    workspace_root: str | Path,
    query: str,
    *,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """关键词命中选卡(注入面唯一出口):按命中数降序,零命中不返回。"""
    tokens = _query_tokens(str(query or ""))
    if not tokens:
        return []
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for idx, card in enumerate(load_active_cards(workspace_root)):
        hay = str(card.get("statement") or "").lower() + " " + " ".join(
            str(a.get("ref") or "") for a in card.get("anchors") or []
        ).lower()
        score = sum(1 for tok in tokens if tok in hay)
        if score > 0:
            scored.append((-score, idx, card))
    scored.sort(key=lambda t: (t[0], t[1]))
    return [c for _, _, c in scored[:limit]]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
