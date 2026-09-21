# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58:补丁回执 diff / 远程压缩预算 / SSE 契约诊断 三处接线测试。

三者均由主会话接线,共同纪律:默认 off 时与接线前逐字节等价;on 时能力真实生效;
模块抛异常一律降级,绝不阻断主链路。
"""

from __future__ import annotations

import sys
import tempfile
import warnings
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.routers.llm import _sse  # noqa: E402
from app.services.patch_engine import apply_patch  # noqa: E402
from app.services.token_compaction import CompactionStrategy, TokenCompactor  # noqa: E402

PATCH = """*** Begin Patch
*** Update File: a.txt
@@
 line1
-old
+new
 line3
*** End Patch"""


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for k in (
        "PATCH_DIFF_ENABLED",
        "REMOTE_COMPACT_V2_ENABLED",
        "REMOTE_COMPACT_MAX_TOKENS",
        "SSE_CONTRACT_VALIDATE_ENABLED",
    ):
        monkeypatch.delenv(k, raising=False)


def _workspace(text: str = "line1\nold\nline3\n") -> str:
    d = tempfile.mkdtemp()
    (Path(d) / "a.txt").write_text(text, encoding="utf-8")
    return d


# ---------------------------------------------------------------------------
# patch_diff:apply_patch 回执带 unified diff
# ---------------------------------------------------------------------------


def test_patch_diff_off_zero_diff():
    """off:回执字段集与接线前一致(无 unified_diff)。"""
    result = apply_patch(PATCH, _workspace())
    keys = set(result.to_dict()["files"][0].keys())
    assert "unified_diff" not in keys


def test_patch_diff_on_provides_diff(monkeypatch):
    """on:回执附带真实 unified diff 内容。"""
    monkeypatch.setenv("PATCH_DIFF_ENABLED", "1")
    result = apply_patch(PATCH, _workspace())
    fd = result.to_dict()["files"][0]
    assert "unified_diff" in fd
    assert "-old" in fd["unified_diff"]
    assert "+new" in fd["unified_diff"]


def test_patch_diff_exception_isolated(monkeypatch):
    """模块抛异常:补丁照常应用,仅回执不展示 diff。"""
    import app.core.patch_diff as pd

    monkeypatch.setenv("PATCH_DIFF_ENABLED", "1")
    monkeypatch.setattr(pd, "unified_diff_from_chunks", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    result = apply_patch(PATCH, _workspace())
    assert result.to_dict()["files"][0]["path"] == "a.txt"


def test_patch_diff_invalid_env_is_off(monkeypatch):
    monkeypatch.setenv("PATCH_DIFF_ENABLED", "0")
    result = apply_patch(PATCH, _workspace())
    assert "unified_diff" not in set(result.to_dict()["files"][0].keys())


# ---------------------------------------------------------------------------
# remote_compact:压缩预算截断
# ---------------------------------------------------------------------------


def _messages(n: int = 30) -> list[dict]:
    return [{"role": "user", "content": "hello world " * 200} for _ in range(n)]


def test_remote_compact_off_zero_diff():
    """off:压缩条数与接线前一致(不被额外截断)。"""
    compactor = TokenCompactor()
    out = compactor.compact_messages(_messages(), CompactionStrategy.CAVEMAN)
    assert len(out.compressed_messages) == 30


def test_remote_compact_on_truncates(monkeypatch):
    """on:按 MAX_TOKENS 预算截断(条数显著变少)。"""
    monkeypatch.setenv("REMOTE_COMPACT_V2_ENABLED", "1")
    monkeypatch.setenv("REMOTE_COMPACT_MAX_TOKENS", "500")
    compactor = TokenCompactor()
    out = compactor.compact_messages(_messages(), CompactionStrategy.CAVEMAN)
    assert len(out.compressed_messages) < 30


def test_remote_compact_exception_isolated(monkeypatch):
    """模块抛异常:降级走原压缩路径,条数不受影响。"""
    import app.core.remote_compact as rc

    monkeypatch.setenv("REMOTE_COMPACT_V2_ENABLED", "1")
    for name in ("compact_remote", "truncate_to_budget", "apply_remote_compact"):
        if hasattr(rc, name):
            monkeypatch.setattr(rc, name, lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    compactor = TokenCompactor()
    out = compactor.compact_messages(_messages(), CompactionStrategy.CAVEMAN)
    assert len(out.compressed_messages) == 30


def test_remote_compact_invalid_env_is_off(monkeypatch):
    monkeypatch.setenv("REMOTE_COMPACT_V2_ENABLED", "nope")
    compactor = TokenCompactor()
    out = compactor.compact_messages(_messages(), CompactionStrategy.CAVEMAN)
    assert len(out.compressed_messages) == 30


# ---------------------------------------------------------------------------
# sse_contract:SSE 帧契约漂移诊断(只诊断,不改帧)
# ---------------------------------------------------------------------------


def test_sse_contract_off_no_warning():
    """off:不产出任何诊断告警。"""
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        frame = _sse("done", {"model": "m"})
    assert len(w) == 0
    assert frame == 'event: done\ndata: {"model": "m"}\n\n'


def test_sse_contract_on_diagnoses_and_keeps_frame(monkeypatch):
    """on:产出契约漂移告警,但帧内容零改写。"""
    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "1")
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        frame = _sse("done", {"model": "m"})
    assert len(w) >= 1
    # 帧内容必须与接线前逐字节一致
    assert frame == 'event: done\ndata: {"model": "m"}\n\n'


def test_sse_contract_exception_isolated(monkeypatch):
    """校验模块抛异常:帧照常产出,不冒泡。"""
    import app.core.sse_contract as sc

    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "1")
    for name in ("validate_event", "validate_frame", "diagnose"):
        if hasattr(sc, name):
            monkeypatch.setattr(sc, name, lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    with warnings.catch_warnings(record=True):
        warnings.simplefilter("ignore")
        frame = _sse("done", {"model": "m"})
    assert frame.startswith("event: done")


def test_sse_contract_invalid_env_is_off(monkeypatch):
    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "false")
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        _sse("done", {"model": "m"})
    assert len(w) == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
