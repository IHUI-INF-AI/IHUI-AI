# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 14 批(2026-10-31,R5 轮)修复钉住:checkpoint 回滚写出口 workspace 复验(F3)。

覆盖:
- 记录 path 落在工作区白名单外 ⇒ missed_paths 点名 path_outside_workspace,
  rollback_file **不被调用**(副作用未发生断言)
- 记录 path 在白名单内 ⇒ 正常进入 rollback_file
- 会话附加根(set_session_extra_roots)内同样放行
"""

from __future__ import annotations

from pathlib import Path

from app.routers import checkpoint_rewind as cr
from app.services import mcp_server


def _setup_roots(monkeypatch, tmp_path: Path) -> Path:
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
    return root


def test_rollback_rejects_outside_workspace(monkeypatch, tmp_path):
    _setup_roots(monkeypatch, tmp_path)
    calls: list[dict] = []
    monkeypatch.setattr(
        cr.file_editor,
        "rollback_file",
        lambda **kw: calls.append(kw) or {"ok": True},
    )
    outside = tmp_path / "elsewhere"
    outside.mkdir()
    out = cr._rollback_files(
        "s1", [{"path": str(outside / "a.py"), "version_id": "v1"}]
    )
    assert out["affected"] == 0
    assert out["missed_paths"][0]["reason"] == "path_outside_workspace"
    assert calls == []  # 副作用未发生:工作区外绝不执行回滚


def test_rollback_allows_inside_workspace(monkeypatch, tmp_path):
    root = _setup_roots(monkeypatch, tmp_path)
    calls: list[dict] = []
    monkeypatch.setattr(
        cr.file_editor,
        "rollback_file",
        lambda **kw: calls.append(kw) or {"ok": True},
    )
    inside = root / "proj"
    inside.mkdir(parents=True)
    out = cr._rollback_files(
        "s1", [{"path": str(inside / "a.py"), "version_id": "v1"}]
    )
    assert out["affected"] == 1
    assert out["missed_paths"] == []
    assert len(calls) == 1


def test_rollback_allows_session_extra_roots(monkeypatch, tmp_path):
    _setup_roots(monkeypatch, tmp_path)
    calls: list[dict] = []
    monkeypatch.setattr(
        cr.file_editor,
        "rollback_file",
        lambda **kw: calls.append(kw) or {"ok": True},
    )
    extra = tmp_path / "extra-ws"
    extra.mkdir()
    mcp_server.set_session_extra_roots("s-extra", [str(extra)])
    try:
        out = cr._rollback_files(
            "s-extra",
            [{"path": str(extra / "b.py"), "version_id": "v1", "session_id": "s-extra"}],
        )
        assert out["affected"] == 1
        assert calls
    finally:
        mcp_server.clear_session_extra_roots("s-extra")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
