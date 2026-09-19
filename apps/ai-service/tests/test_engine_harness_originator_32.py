# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core 线程 originator/存储归一测试 — 第三十二批(对标 Codex thread_manager.rs 纯函数)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.thread_originator import (
    KNOWN_ORIGINATORS,
    originator_from_service_name,
    effective_originator_value,
    ResumedHistory,
    stored_thread_to_initial_history,
    ThreadStoreErrorKind,
    map_thread_store_read_error,
    map_thread_store_metadata_update_error,
)


# ---------- originator_from_service_name ----------

def test_originator_exact_hit():
    assert originator_from_service_name("codex_work_desktop") == "codex_work_desktop"

def test_originator_case_insensitive():
    assert originator_from_service_name("ChatGPT_CCA") == "chatgpt_cca"

def test_originator_trims_whitespace():
    assert originator_from_service_name("  codex_work_web  ") == "codex_work_web"

def test_originator_unknown_none():
    assert originator_from_service_name("my_custom_app") is None

def test_originator_none_input():
    assert originator_from_service_name(None) is None

def test_originator_full_set_covered():
    assert len(KNOWN_ORIGINATORS) == 5


# ---------- effective_originator_value ----------

def test_effective_metrics_wins():
    v = effective_originator_value("CODEX_WORK_MOBILE", "env-o", "persisted-o", "inherited-o", "def")
    assert v == "codex_work_mobile"

def test_effective_persisted_over_inherited_env_default():
    assert effective_originator_value(None, "env-o", "persisted-o", "inherited-o", "def") == "persisted-o"

def test_effective_inherited_over_env():
    assert effective_originator_value(None, "env-o", None, "inherited-o", "def") == "inherited-o"

def test_effective_env_over_default():
    assert effective_originator_value(None, "env-o", None, None, "def") == "env-o"

def test_effective_default_fallback():
    assert effective_originator_value(None, None, None, None, "default-o") == "default-o"


# ---------- stored_thread_to_initial_history ----------

def test_stored_thread_resumed_norm():
    out = stored_thread_to_initial_history({
        "thread_id": "t-1",
        "history": {"items": [{"a": 1}], "rollout_path": "/x.jsonl"},
        "rollout_path": "/outer.jsonl",
    })
    assert isinstance(out, ResumedHistory)
    assert out.conversation_id == "t-1"
    assert out.items == [{"a": 1}]
    assert out.rollout_path == "/outer.jsonl"  # 显式参数优先

def test_stored_thread_rollout_path_fallback_history():
    out = stored_thread_to_initial_history({
        "thread_id": "t-2",
        "history": {"items": [], "rollout_path": "/inner.jsonl"},
    })
    assert out.rollout_path == "/inner.jsonl"

def test_stored_thread_missing_history_fatal():
    with pytest.raises(ValueError, match="did not include persisted history"):
        stored_thread_to_initial_history({"thread_id": "t-3"})


# ---------- thread store 错误映射 ----------

def test_read_error_not_found():
    msg = map_thread_store_read_error({"kind": ThreadStoreErrorKind.THREAD_NOT_FOUND, "thread_id": "t9"})
    assert "t9" in msg and "not found" in msg

def test_read_error_invalid_request():
    msg = map_thread_store_read_error({"kind": ThreadStoreErrorKind.INVALID_REQUEST, "message": "bad"})
    assert "bad" in msg

def test_read_error_other_folded_fatal():
    msg = map_thread_store_read_error({"kind": "weird"})
    assert "failed to read thread" in msg

def test_metadata_error_unsupported():
    msg = map_thread_store_metadata_update_error("t1", {"kind": ThreadStoreErrorKind.UNSUPPORTED, "operation": "rename"})
    assert "not supported" in msg and "rename" in msg

def test_metadata_error_not_found():
    msg = map_thread_store_metadata_update_error("t1", {"kind": ThreadStoreErrorKind.THREAD_NOT_FOUND})
    assert "t1" in msg
