# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58:引擎侧接线测试(7 个模块)。

git_workspaces_metadata / thread_originator / installation_id / turn_metadata /
feature_flags 由并行 worker 接线,此处守住"默认 off"铁律;message_history /
rollout_archive / rollout_truncation 由主会话接线,做完整四项验证。
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import agent_engine as ae  # noqa: E402

SWITCHES = [
    ("ENGINE_GIT_METADATA_ENABLED", ae._engine_git_metadata_enabled_from_env),
    ("ENGINE_THREAD_ORIGINATOR_ENABLED", ae._engine_thread_originator_enabled_from_env),
    ("ENGINE_INSTALLATION_ID_ENABLED", ae._engine_installation_id_enabled_from_env),
    ("ENGINE_TURN_METADATA_ENABLED", ae._engine_turn_metadata_enabled_from_env),
    ("ENGINE_FEATURE_FLAGS_ENABLED", ae._engine_feature_flags_enabled_from_env),
    ("ENGINE_MESSAGE_HISTORY_ENABLED", ae._engine_message_history_enabled_from_env),
    ("ENGINE_ROLLOUT_ARCHIVE_ENABLED", ae._engine_rollout_archive_enabled_from_env),
    ("ENGINE_ROLLOUT_TRUNCATION_ENABLED", ae._engine_rollout_truncation_enabled_from_env),
]


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for name, _fn in SWITCHES:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.delenv("IHUI_MESSAGE_HISTORY_PATH", raising=False)


def test_all_engine_switches_default_off():
    for name, fn in SWITCHES:
        assert fn() is False, f"{name} 默认必须 off"


@pytest.mark.parametrize("env_name,fn", SWITCHES, ids=[n for n, _ in SWITCHES])
def test_engine_switch_on_values(monkeypatch, env_name, fn):
    for v in ("on", "1", "true", "yes", "ON", " YES "):
        monkeypatch.setenv(env_name, v)
        assert fn() is True


@pytest.mark.parametrize("env_name,fn", SWITCHES, ids=[n for n, _ in SWITCHES])
def test_engine_switch_invalid_values_are_off(monkeypatch, env_name, fn):
    for v in ("", "0", "false", "no", "off", "maybe"):
        monkeypatch.setenv(env_name, v)
        assert fn() is False


# ---------------------------------------------------------------------------
# message_history:宿主历史账本
# ---------------------------------------------------------------------------


def test_message_history_off_is_off(monkeypatch, tmp_path):
    """off:开关 False(引擎不落任何历史文件)。"""
    assert ae._engine_message_history_enabled_from_env() is False


def test_message_history_on_appends(monkeypatch, tmp_path):
    """on 且配路径:多进程安全追加,内容可回读。"""
    from app.core.message_history import append_history, read_recent

    hist = tmp_path / "history.jsonl"
    append_history(hist, "sess-1", "第一条")
    append_history(hist, "sess-1", "第二条")
    recent = read_recent(hist, limit=5)
    assert len(recent) == 2
    assert recent[0]["text"] == "第二条"  # 新→旧
    assert recent[0]["session_id"] == "sess-1"


def test_message_history_corrupt_line_skipped(tmp_path):
    """损坏行容错跳过(不中断读取)。"""
    from app.core.message_history import iter_history

    p = tmp_path / "h.jsonl"
    p.write_text('{"session_id":"s","ts":1.0,"text":"ok"}\nnot-json\n', encoding="utf-8")
    assert len(list(iter_history(p))) == 1


# ---------------------------------------------------------------------------
# rollout_archive:冷导出压缩归档
# ---------------------------------------------------------------------------


def test_rollout_archive_off_is_off(monkeypatch):
    assert ae._engine_rollout_archive_enabled_from_env() is False


def test_rollout_archive_compresses_cold(tmp_path):
    """冷文件被 gzip 归档,原文删除,节余字节数可算。"""
    from app.core.rollout_archive import compress_cold_exports, is_cold, open_export_lines

    d = tmp_path / "exports"
    d.mkdir()
    f = d / "rollout.jsonl"
    f.write_text("\n".join(json.dumps({"i": i}) for i in range(200)) + "\n", encoding="utf-8")
    old = time.time() - 10 * 3600
    os.utime(f, (old, old))
    assert is_cold(f, older_than_hours=1.0) is True

    result = compress_cold_exports(d, older_than_hours=1.0, now=time.time())
    assert result["compressed"] == 1
    assert not f.exists()
    assert (d / "rollout.jsonl.gz").exists()
    assert result["bytes_saved"] > 0
    # 透明读取器仍可读回
    assert len(list(open_export_lines(f))) == 200


def test_rollout_archive_skips_hot(tmp_path):
    """热文件不压(避免刚写完就被归档)。"""
    from app.core.rollout_archive import compress_cold_exports

    d = tmp_path / "exports"
    d.mkdir()
    f = d / "hot.jsonl"
    f.write_text("x" * 4096, encoding="utf-8")
    result = compress_cold_exports(d, older_than_hours=168.0)
    assert result["skipped_hot"] == 1
    assert result["compressed"] == 0


# ---------------------------------------------------------------------------
# rollout_truncation:导出按 turn_id 截断
# ---------------------------------------------------------------------------


def test_rollout_truncation_off_is_off(monkeypatch):
    assert ae._engine_rollout_truncation_enabled_from_env() is False


def test_rollout_truncation_after_turn_id():
    """按 turn_id 定位规范边界,截断到该回合结束(保留该回合及其之前)。

    真实 rollout 中只有 TurnStarted 项声明 turn_id,其余项返回 None —— 边界即
    "下一个声明了 turn_id 的项"。
    """
    from app.core.rollout_truncation import truncate_after_turn_id

    items = [
        {"turn_id": "t1"},
        {"role": "user"},
        {"role": "assistant"},
        {"turn_id": "t2"},
        {"role": "user"},
    ]
    cut = truncate_after_turn_id(items, "t1", lambda r: r.get("turn_id"))
    assert cut == items[:3]  # t1 回合整体(截至下一个 turn 边界之前)
    cut2 = truncate_after_turn_id(items, "t2", lambda r: r.get("turn_id"))
    assert cut2 == items  # t2 之后无新边界,保留全量


def test_rollout_truncation_missing_turn_raises():
    """turn_id 不存在抛 ValueError(调用方已包 try/except 降级)。"""
    from app.core.rollout_truncation import truncate_after_turn_id

    with pytest.raises(ValueError):
        truncate_after_turn_id([{"turn_id": "t1"}], "nope", lambda r: r.get("turn_id"))


def test_rollout_truncation_has_prior_user_turns():
    from app.core.rollout_truncation import has_prior_user_turns

    items = [{"role": "user"}, {"role": "assistant"}]
    assert has_prior_user_turns(items, lambda r: r.get("role") == "user") is True
    assert has_prior_user_turns([{"role": "assistant"}], lambda r: r.get("role") == "user") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
