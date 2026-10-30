# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G5 编译式知识引擎核心层测试(2026-10-30 立项)。

隔离策略(§5b):sources 全部经注入缝给替身,零网络/零 LLM/零真实索引;
落盘全在 tmp_path。覆盖:① 幂等(同 source_hash 重编译=覆盖不追加,逐字节不变);
② 无锚条目拒绝编译;③ 读取面 TTL 过期过滤;④ wiki 锚点回链(相对路径+行号);
⑤ dry_run 零写盘;⑥ 源条目顺序无关的 source_hash 稳定性。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.services.knowledge_compiler import (
    compile_project,
    compute_source_hash,
    load_active_cards,
    select_relevant_cards,
    slugify,
)

# =============================================================================
# 源替身
# =============================================================================


def _codebase_sources() -> list[dict[str, Any]]:
    return [
        {
            "file_path": "src/app/main.py",
            "line_start": 12,
            "line_end": 30,
            "content": "def bootstrap():\n    ...",
            "symbol_name": "bootstrap",
            "symbol_type": "function",
            "score": 0.9,
        },
        {
            "file_path": "src/util/str.py",
            "line_start": 5,
            "line_end": 9,
            "content": "# 统一使用 snake_case 命名",
            "symbol_name": None,
            "symbol_type": None,
            "score": 0.7,
        },
    ]


def _summary_sources() -> list[dict[str, Any]]:
    return [
        {
            "session_id": "sess-001",
            "summary": "会话摘要",
            "key_facts": ["部署走 Cloud Run"],
            "key_decisions": ["统一使用 pnpm workspace 管理依赖"],
            "end_time": "2026-10-01T00:00:00Z",
        }
    ]


def _sources() -> dict[str, list[dict[str, Any]]]:
    return {"codebase": _codebase_sources(), "summaries": _summary_sources()}


# =============================================================================
# ① 幂等:同 source_hash 重编译 = 覆盖不追加
# =============================================================================


@pytest.mark.asyncio
async def test_recompile_same_hash_is_byte_identical(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    r1 = await compile_project("proj-a", ws, sources=_sources())
    cards_path = ws / ".ihui" / "knowledge" / "cards" / "proj-a.json"
    first_bytes = cards_path.read_bytes()
    assert r1["cards"] == 4  # 2 fact(codebase) + 1 fact + 1 convention(session)
    r2 = await compile_project("proj-a", ws, sources=_sources())
    assert r2["source_hash"] == r1["source_hash"]
    # 覆盖不追加:第二次编译后卡数不变、文件逐字节相同(compiled_at 沿用)
    assert r2["cards"] == r1["cards"]
    data = json.loads(cards_path.read_text(encoding="utf-8"))
    assert len(data) == 4
    assert cards_path.read_bytes() == first_bytes


@pytest.mark.asyncio
async def test_source_hash_ignores_entry_order(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    src_a = _sources()
    src_b = {
        "codebase": list(reversed(src_a["codebase"])),
        "summaries": list(reversed(src_a["summaries"])),
    }
    r1 = await compile_project("proj-a", ws, sources=src_a, dry_run=True)
    r2 = await compile_project("proj-a", ws, sources=src_b, dry_run=True)
    assert r1["source_hash"] == r2["source_hash"]


# =============================================================================
# ② 无锚条目拒绝编译
# =============================================================================


@pytest.mark.asyncio
async def test_entries_without_anchor_are_rejected(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    sources = {
        "codebase": [
            {"file_path": "", "line_start": 1, "content": "x", "symbol_name": "x"},
            {"file_path": "ok.py", "line_start": 2, "content": "print(1)", "symbol_name": None},
        ],
        "summaries": [
            {"session_id": "", "key_facts": ["无锚事实"], "key_decisions": ["无锚约定"]},
        ],
    }
    r = await compile_project("proj-b", ws, sources=sources)
    assert r["cards"] == 1  # 只有 ok.py 那条产卡
    reasons = [x["reason"] for x in r["rejected"]]
    assert any("file_path" in x for x in reasons)
    assert any("session_id" in x for x in reasons)
    data = json.loads((ws / ".ihui" / "knowledge" / "cards" / "proj-b.json").read_text(encoding="utf-8"))
    assert len(data) == 1
    assert data[0]["anchors"][0]["ref"] == "ok.py"


# =============================================================================
# ③ 读取面 TTL 过滤
# =============================================================================


def test_load_active_cards_filters_expired(tmp_path):
    cards_dir = tmp_path / ".ihui" / "knowledge" / "cards"
    cards_dir.mkdir(parents=True)
    now = datetime.now(UTC)
    fresh = {"id": "k1", "kind": "fact", "statement": "新鲜卡", "anchors": [], "compiled_at": now.isoformat(), "ttl_days": 30, "source_hash": "h"}
    stale = {"id": "k2", "kind": "fact", "statement": "过期卡", "anchors": [], "compiled_at": (now - timedelta(days=40)).isoformat(), "ttl_days": 30, "source_hash": "h"}
    (cards_dir / "proj.json").write_text(json.dumps([fresh, stale], ensure_ascii=False), encoding="utf-8")
    active = load_active_cards(tmp_path, "proj")
    assert [c["id"] for c in active] == ["k1"]
    # 无过期卡时按 slug 读取全量;不存在的 slug 返回空
    assert load_active_cards(tmp_path) == [fresh]
    assert load_active_cards(tmp_path, "nope") == []


# =============================================================================
# ④ wiki 锚点回链(相对路径 + 行号)
# =============================================================================


@pytest.mark.asyncio
async def test_wiki_contains_relative_anchor_backlinks(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    r = await compile_project("proj-c", ws, sources=_sources())
    assert r["wiki_files"] == 1
    wiki = (ws / ".ihui" / "wiki" / "proj-c.md").read_text(encoding="utf-8")
    # 头部:编译时间 + 源 hash
    assert "编译时间:" in wiki
    assert f"sha256:{r['source_hash']}" in wiki
    # file 锚:相对 wiki 目录的路径 + #L 行号片段
    assert "[src/app/main.py:12](../../src/app/main.py#L12)" in wiki
    # transcript 锚:session 凭据
    assert "transcript:sess-001" in wiki
    # 分节:kind 分组存在
    assert "## 约定(convention)" in wiki
    assert "## 事实(fact)" in wiki


# =============================================================================
# ⑤ dry_run 零写盘
# =============================================================================


@pytest.mark.asyncio
async def test_dry_run_writes_nothing(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    r = await compile_project("proj-d", ws, sources=_sources(), dry_run=True)
    assert r["cards"] == 4
    assert r["wiki_files"] == 0
    assert not (ws / ".ihui").exists()


# =============================================================================
# 辅助面:slug / 命中选卡
# =============================================================================


def test_slugify_rules():
    assert slugify("My Project_2026") == "my-project-2026"
    assert slugify("  ") == "project"
    assert slugify("你好世界") == "project"  # 非 ASCII 清洗后为空 ⇒ 回退


@pytest.mark.asyncio
async def test_select_relevant_cards_keyword_hit(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    await compile_project("proj-e", ws, sources=_sources())
    hits = select_relevant_cards(ws, "bootstrap 怎么启动")
    assert hits and hits[0]["statement"].startswith("src/app/main.py:12")
    assert select_relevant_cards(ws, "完全不相关zzz词") == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
