# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""批 47:SessionStore.update_thread_metadata 线程元数据 patch 更新测试。

对标 OpenAI codex thread-store update_thread_metadata + ThreadMetadataPatch。
自包含,直接 from app.services.session_store import SessionStore。
"""

from __future__ import annotations

from pathlib import Path

from app.services.session_store import SessionStore


def _new_store(tmp_path: Path, name: str = "m47.db") -> SessionStore:
    return SessionStore(str(tmp_path / name))


# 1. merge 深合并:嵌套 dict 递归合并,标量覆盖
def test_merge_deep_nested_and_scalar_override(tmp_path: Path) -> None:
    store = _new_store(tmp_path)
    t = store.create_thread(metadata={"a": {"b": 1}, "c": 2})
    out = store.update_thread_metadata(t.thread_id, {"a": {"d": 3}, "c": 9})
    assert out == {"a": {"b": 1, "d": 3}, "c": 9}


# 2. None 删除键(对标 codex ClearableField)
def test_patch_none_deletes_key(tmp_path: Path) -> None:
    store = _new_store(tmp_path)
    t = store.create_thread(metadata={"a": 1, "c": 2})
    out = store.update_thread_metadata(t.thread_id, {"c": None})
    assert "c" not in out
    assert out == {"a": 1}


# 3. replace 模式:整体替换为 patch
def test_replace_mode_sets_metadata_exactly(tmp_path: Path) -> None:
    store = _new_store(tmp_path)
    t = store.create_thread(metadata={"old": 1, "keep": 2})
    out = store.update_thread_metadata(t.thread_id, {"x": 9}, merge=False)
    assert out == {"x": 9}
    reread = store.get_thread(t.thread_id)
    assert reread is not None and reread.metadata == {"x": 9}


# 4. 线程不存在返回 None
def test_missing_thread_returns_none(tmp_path: Path) -> None:
    store = _new_store(tmp_path)
    assert store.update_thread_metadata("nope", {"a": 1}) is None
    assert store.update_thread_metadata("nope", {"a": 1}, merge=False) is None


# 5. updated_at 单调不减(先记录旧值,再断言 new >= old;规避 _now() 粒度)
def test_updated_at_is_monotonic(tmp_path: Path) -> None:
    store = _new_store(tmp_path)
    t = store.create_thread(title="orig")
    # 先改一次名,得到基线 updated_at
    store.set_thread_name(t.thread_id, "renamed")
    before = store.get_thread(t.thread_id)
    assert before is not None
    old = before.updated_at
    out = store.update_thread_metadata(t.thread_id, {"k": "v"})
    assert out is not None
    after = store.get_thread(t.thread_id)
    assert after is not None
    assert after.updated_at >= old


# 6. get_thread 回读一致 + 跨新实例持久化(指向同 db 文件)
def test_persisted_and_readable_across_instances(tmp_path: Path) -> None:
    db = tmp_path / "persist.db"
    s1 = SessionStore(str(db))
    t = s1.create_thread(metadata={"a": {"b": 1}})
    s1.update_thread_metadata(t.thread_id, {"a": {"c": 2}, "d": 3})
    s1.close()

    s2 = SessionStore(str(db))
    reread = s2.get_thread(t.thread_id)
    assert reread is not None
    assert reread.metadata == {"a": {"b": 1, "c": 2}, "d": 3}
    # replace 模式跨实例持久化
    s2.update_thread_metadata(t.thread_id, {"plain": True}, merge=False)
    s2.close()

    s3 = SessionStore(str(db))
    final = s3.get_thread(t.thread_id)
    assert final is not None
    assert final.metadata == {"plain": True}
    s3.close()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
