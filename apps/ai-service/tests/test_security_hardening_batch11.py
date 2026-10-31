# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 11 批(2026-10-31)修复钉住。

覆盖:
- workspace_roots:env 空 fail-closed / 白名单内通过 / 白名单外拒绝 / 错误文案不回显服务器路径
- lsp._resolve_file:绝对路径越界 400、``..`` 逃逸 400、白名单内正常、工作区内不存在 404
- knowledge._resolve_workspace_root:白名单外 400(修复前 = 任意目录写 + 目录存在性 oracle)
- connectors._safe:extra 值布尔化(凭据值不出)、500 固定文案(异常原文不回传)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.v1.lsp import _resolve_file
from app.routers import connectors as connectors_router
from app.routers.connectors import ConnectorConfigRequest, _safe
from app.routers.knowledge import _resolve_workspace_root
from app.services import workspace_roots


@pytest.fixture()
def roots_env(monkeypatch, tmp_path):
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv(workspace_roots.WORKSPACE_ROOTS_ENV, str(root))
    return root


# ---------------------------------------------------------------------------
# workspace_roots 判据本体
# ---------------------------------------------------------------------------


def test_roots_fail_closed_when_env_empty(monkeypatch):
    monkeypatch.delenv(workspace_roots.WORKSPACE_ROOTS_ENV, raising=False)
    with pytest.raises(HTTPException) as ei:
        workspace_roots.assert_workspace_root(str(Path.cwd()))
    assert ei.value.status_code == 400
    assert "未登记任何工作区根" in str(ei.value.detail)


def test_roots_accepts_registered_and_rejects_outside(roots_env, tmp_path):
    inside = workspace_roots.assert_workspace_root(str(roots_env))
    assert Path(inside) == roots_env.resolve()
    with pytest.raises(HTTPException) as ei:
        workspace_roots.assert_workspace_root(str(tmp_path / "elsewhere"))
    assert ei.value.status_code == 400


def test_roots_message_does_not_leak_server_paths(roots_env, tmp_path):
    with pytest.raises(HTTPException) as ei:
        workspace_roots.assert_workspace_root(str(tmp_path / "elsewhere"))
    assert str(tmp_path) not in str(ei.value.detail)


def test_roots_subpath_of_registered_root_is_inside(roots_env):
    sub = Path(roots_env) / "proj" / "src"
    assert workspace_roots.assert_workspace_root(str(sub)) == str(sub.resolve())


# ---------------------------------------------------------------------------
# lsp 任意文件读收口
# ---------------------------------------------------------------------------


def test_lsp_resolve_file_rejects_absolute_outside_ws(roots_env, tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("x", encoding="utf-8")
    with pytest.raises(HTTPException) as ei:
        _resolve_file(str(secret), str(roots_env))
    assert ei.value.status_code == 400
    assert "不在工作区内" in str(ei.value.detail)


def test_lsp_resolve_file_rejects_dotdot_escape(roots_env, tmp_path):
    outside = tmp_path / "outside.py"
    outside.write_text("x", encoding="utf-8")
    with pytest.raises(HTTPException) as ei:
        _resolve_file("../outside.py", str(roots_env))
    assert ei.value.status_code == 400


def test_lsp_resolve_file_allows_inside_file(roots_env):
    f = Path(roots_env) / "a.py"
    f.write_text("print(1)", encoding="utf-8")
    assert _resolve_file("a.py", str(roots_env)) == str(f.resolve())


def test_lsp_resolve_file_missing_inside_ws_404(roots_env):
    with pytest.raises(HTTPException) as ei:
        _resolve_file("nope.py", str(roots_env))
    assert ei.value.status_code == 404


# ---------------------------------------------------------------------------
# knowledge 任意目录写收口
# ---------------------------------------------------------------------------


def test_knowledge_workspace_root_rejects_outside(roots_env, tmp_path):
    with pytest.raises(HTTPException) as ei:
        _resolve_workspace_root(str(tmp_path / "elsewhere"))
    assert ei.value.status_code == 400


def test_knowledge_workspace_root_accepts_inside(roots_env):
    assert _resolve_workspace_root(str(roots_env)) == roots_env.resolve()


def test_knowledge_workspace_root_default_cwd_also_gated(monkeypatch, roots_env, tmp_path):
    """缺省 cwd 分支同样过闸:cwd 不在白名单 ⇒ 400,且不回显服务器路径。"""
    unregistered = tmp_path / "elsewhere-not-registered"
    unregistered.mkdir()
    monkeypatch.chdir(unregistered)
    with pytest.raises(HTTPException) as ei:
        _resolve_workspace_root(None)
    assert ei.value.status_code == 400
    assert str(tmp_path) not in str(ei.value.detail)


# ---------------------------------------------------------------------------
# connectors:extra 脱敏 + 500 固定文案
# ---------------------------------------------------------------------------


def test_connectors_safe_extra_booleanized():
    rec = {
        "key": "feishu:k1",
        "type": "feishu",
        "name": "n",
        "app_id": "cli_a",
        "extra": {"folder_token": "fldbXXX-secret", "user": "u1"},
        "enabled": True,
    }
    out = _safe(rec)
    assert out["extra"] == {"folder_token": True, "user": True}
    assert "fldbXXX-secret" not in json.dumps(out)
    assert out["configured"] is True


def test_connectors_safe_extra_empty_stays_configured_false():
    out = _safe({"key": "k", "type": "feishu", "extra": {}})
    assert out["extra"] == {}
    assert out["configured"] is False


async def test_connectors_save_error_fixed_message(monkeypatch):
    def _boom(*_a, **_k):
        raise RuntimeError("PermissionError: data/connector_store.json")

    monkeypatch.setattr(connectors_router.connector_store, "save", _boom)
    req = ConnectorConfigRequest(
        key="feishu:k1", type="feishu", name="n", app_id="a", app_secret="s"
    )
    resp = await connectors_router.save_connector_config(req, user_id="u1")
    assert resp.status_code == 500
    body = json.loads(resp.body.decode())
    assert "PermissionError" not in body["error"]
    assert "保存连接器配置失败" in body["error"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
