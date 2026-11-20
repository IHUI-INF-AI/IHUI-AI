# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话检索索引(v5 pg_trgm)的真库判据。

钉住三件:
 1. 建库后 `idx_items_search_trgm` 真在 pg_indexes 里(不是"代码里写了 CREATE INDEX"就算);
 2. 语义不变 —— 索引在不在,`ILIKE '%kw%'` 的命中集必须一致(子串匹配不因索引改变);
 3. 扩展不可用时降级成全表扫,版本行如实写明,不得把"慢"当"坏"报。

无 DSN ⇒ 整文件跳过(§0.3:取不到输入不记绿也不冒红)。
"""

from __future__ import annotations

import os
import pathlib

import pytest

from app.services.session_store import SessionStore, UserMessageItem


def _live_dsn() -> str:
    dsn = os.environ.get("SESSION_PG_DSN") or os.environ.get("DATABASE_URL")
    if dsn:
        return dsn
    env = pathlib.Path(__file__).resolve().parents[1] / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return ""


DSN = _live_dsn()

pytestmark = pytest.mark.skipif(not DSN, reason="无 DATABASE_URL/SESSION_PG_DSN ⇒ 真库面不判")


@pytest.fixture()
def store(tmp_path):
    s = SessionStore(tmp_path / "sessions.db")
    try:
        yield s
    finally:
        s.close()


def _indexes(store: SessionStore) -> set[str]:
    # 用 store 自己的连接:它的 search_path 已指向本库私有 schema,问的就是这一面。
    rows = store._conn.execute(
        "SELECT indexname AS name FROM pg_indexes WHERE schemaname = current_schema()"
    ).fetchall()
    return {str(r["name"]) for r in rows}


def test_trgm_index_created_and_visible(store) -> None:
    names = _indexes(store)
    assert "idx_items_search_trgm" in names, f"索引未落库,现读={sorted(names)}"


def test_ilike_semantics_unchanged_by_index(store) -> None:
    th = store.create_thread(title="trgm 语义")
    turn = store.start_turn(th.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="锅包肉 与 溜肉段"))
    store.append_item(turn.turn_id, UserMessageItem(content="酸菜白肉"))

    hits = store.full_text_search("锅包肉", thread_id=th.thread_id)
    assert hits, "子串命中集不得因索引而变空"
    miss = store.full_text_search("佛跳墙", thread_id=th.thread_id)
    assert not miss, "不存在的子串不得凭空命中"


def test_version_row_records_degradation_honestly(store) -> None:
    row = store._conn.execute(
        "SELECT description FROM schema_version WHERE version = ?", (5,)
    ).fetchone()
    assert row is not None, "v5 版本行必须存在"
    desc = str(row["description"])
    assert desc.startswith("search: "), desc
    assert ("pg_trgm" in desc) or ("降级" in desc), desc
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
