# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-258 B 组第四票 · 任务 1:patch 端点的 workspace root 必须落在服务端允许集合内。

修复前的病灶(``app/routers/patch.py`` 的 ``_validated_root``):它只验"绝对路径且
真实存在",于是**任何已登录用户**都能拿服务器任意文件路径当 root 去写/改 —— 跨用户
写服务器文件、越出工作区。本文件钉的是收口后的四条:

1. 允许集合内的 root 正常可用(正向对照:收紧没把合法调用方打死);
2. 集合外的 root 一律 403,且**执行侧零副作用**(不能先写再拒);
3. 比授予范围**更宽**的 root(允许根的祖先)同样 403 —— 这是"越出工作区"的入口;
4. 允许集合的**唯一来源是配置键 MCP_WORKSPACE_ROOTS**,取源复用 mcp_server 那一份
   实现;取不到集合 ⇒ fail-closed(503),绝不退化成"不限制"。

判序(先白名单、后存在性)也在这里钉:反过来会让端点变成"服务器上某路径是否存在"
的预言机。

隔离:全程 tmp_path,不连 PostgreSQL(8810)/ Redis(8811),不碰仓库真实文件。
"""

from __future__ import annotations

import ast
import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import patch as patch_router
from app.services import mcp_server

_PATCH_SOURCE = Path(patch_router.__file__).read_text(encoding="utf-8")


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(patch_router.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "patch-audit-user"
    return app


@pytest.fixture()
def client() -> Iterator[TestClient]:
    yield TestClient(_make_app())


@pytest.fixture()
def workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把 tmp_path/workspace 登记为**唯一**允许根(配置键的既有语义)。"""
    root = tmp_path / "workspace"
    root.mkdir()
    (root / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
    return root


def _update_patch(path: str, old: str, new: str) -> str:
    return (
        "*** Begin Patch\n"
        f"*** Update File: {path}\n"
        "@@\n"
        f"-{old}\n"
        f"+{new}\n"
        "*** End Patch\n"
    )


def _post(client: TestClient, url: str, root: Path, patch: str) -> Any:
    return client.post(url, json={"patch": patch, "root": str(root)})


# ---------------------------------------------------------------------------
# 1. 正向对照:登记过的根照常可用(preview 与 apply 两个端点同判据)
# ---------------------------------------------------------------------------


def test_allowed_root_still_works_on_apply(client: TestClient, workspace: Path) -> None:
    res = _post(client, "/api/patch/apply", workspace, _update_patch("a.txt", "line1", "L1"))
    assert res.status_code == 200
    assert res.json()["data"]["ok"] is True
    assert (workspace / "a.txt").read_text(encoding="utf-8") == "L1\nline2\n"


def test_allowed_root_still_works_on_preview(client: TestClient, workspace: Path) -> None:
    res = _post(
        client, "/api/patch/preview", workspace, _update_patch("a.txt", "line1", "L1")
    )
    assert res.status_code == 200
    assert res.json()["data"]["ok"] is True
    # 预览不写盘
    assert (workspace / "a.txt").read_text(encoding="utf-8") == "line1\nline2\n"


def test_subdirectory_of_allowed_root_is_allowed(client: TestClient, workspace: Path) -> None:
    """允许根**之内**的子目录可用:收紧的是"不得宽于授予范围",不是"只能恰好等于"。"""
    sub = workspace / "pkg" / "inner"
    sub.mkdir(parents=True)
    (sub / "b.txt").write_text("x\n", encoding="utf-8")
    res = client.post(
        "/api/patch/apply",
        json={"patch": _update_patch("b.txt", "x", "y"), "root": str(sub)},
    )
    assert res.status_code == 200
    assert (sub / "b.txt").read_text(encoding="utf-8") == "y\n"


# ---------------------------------------------------------------------------
# 2. 集合外:403 且零副作用
# ---------------------------------------------------------------------------


def test_root_outside_allowlist_is_rejected_without_side_effect(
    client: TestClient, workspace: Path, tmp_path: Path
) -> None:
    """允许根之外(同级另一棵树)的 root 必须 403,并且**一个字都没写**。"""
    outside = tmp_path / "other-user"
    outside.mkdir()
    (outside / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    before = (outside / "a.txt").read_text(encoding="utf-8")

    res = _post(client, "/api/patch/apply", outside, _update_patch("a.txt", "line1", "OWNED"))

    assert res.status_code == 403
    assert (outside / "a.txt").read_text(encoding="utf-8") == before


def test_ancestor_of_allowed_root_is_rejected(client: TestClient, workspace: Path) -> None:
    """允许根的**祖先**目录比授予范围更宽 ⇒ 拒。这一条就是"越出工作区"的入口。"""
    res = _post(
        client,
        "/api/patch/apply",
        workspace.parent,
        _update_patch("workspace/a.txt", "line1", "L1"),
    )
    assert res.status_code == 403
    # 真的没写:被拒的 root 下的文件仍是原内容
    assert (workspace / "a.txt").read_text(encoding="utf-8") == "line1\nline2\n"


def test_filesystem_root_is_rejected(client: TestClient, tmp_path: Path) -> None:
    """盘根/``/`` 这类"什么都覆盖"的 root 是最宽的越界,必拒。"""
    drive_root = Path(os.path.abspath(os.sep)).anchor  # Windows: "G:\\";POSIX: "/"
    res = _post(client, "/api/patch/apply", drive_root, _update_patch("x", "a", "b"))
    assert res.status_code == 403


def test_symlinked_root_escaping_allowlist_is_rejected(
    client: TestClient, workspace: Path, tmp_path: Path
) -> None:
    """白名单内的软链接指向白名单外 ⇒ 解析后落到外部,仍须拒。

    只对**判据**取证:Windows 上建目录软链接可能需要特权,失败按 skip 处理
    (与仓内 test_path_guard_parity_58.py 对 symlink 的同一处置取向 —— 不许把
    "建不出来"读成"判据过了")。
    """
    target = tmp_path / "outside-target"
    target.mkdir()
    (target / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    link = workspace / "link-out"
    try:
        link.symlink_to(target, target_is_directory=True)
    except (OSError, NotImplementedError) as e:  # pragma: no cover - 无特权环境
        pytest.skip(f"本机无法创建目录软链接,未取证 symlink 这一格: {e}")
    res = _post(client, "/api/patch/apply", link, _update_patch("a.txt", "line1", "L1"))
    assert res.status_code == 403
    assert (target / "a.txt").read_text(encoding="utf-8") == "line1\nline2\n"


# ---------------------------------------------------------------------------
# 3. 判序:先白名单、后存在性(不得成为路径存在性预言机)
# ---------------------------------------------------------------------------


def test_rejection_of_outside_root_does_not_reveal_existence(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """白名单外的 root:存在与不存在**同形回包**(同 403 同文案)。

    反过来说,如果先判存在性,攻击者就能用 400/403 的差异逐个问出"服务器上有哪些
    目录" —— 那正是本票要关的洞的一半(写)之外还剩另一半(探测)。
    """
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path / "workspace"))
    existing = tmp_path / "definitely-exists"
    existing.mkdir()
    missing = tmp_path / "definitely-missing"

    a = _post(client, "/api/patch/apply", existing, _update_patch("a", "x", "y"))
    b = _post(client, "/api/patch/apply", missing, _update_patch("a", "x", "y"))

    assert a.status_code == 403 and b.status_code == 403

    def _normalized(detail: str, root: Path) -> str:
        # 抠掉**请求方自己给的那个 root 字符串**后,两条回包必须逐字相同:
        # 也就是响应里没有比"你自己发来的那个路径"更多的信息 —— 既没说"存在",
        # 也没说"不存在"。回包里仍带 root 是刻意的(调用方要能定位自己填错了哪一条)。
        return detail.replace(str(root), "<root>")

    assert _normalized(a.json()["detail"], existing) == _normalized(
        b.json()["detail"], missing
    )
    assert "不存在" not in a.json()["detail"]


def test_inside_allowlist_but_nonexistent_root_is_400(
    client: TestClient, workspace: Path
) -> None:
    """允许集合内但不存在的目录 ⇒ 仍是 400(参数不成立),与 403 区分开。"""
    res = _post(client, "/api/patch/apply", workspace / "nope", _update_patch("a", "x", "y"))
    assert res.status_code == 400


def test_relative_root_still_400(client: TestClient, workspace: Path) -> None:
    res = client.post(
        "/api/patch/apply",
        json={"patch": _update_patch("a.txt", "x", "y"), "root": "relative/dir"},
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# 4. 允许集合的唯一来源 = 配置键;取不到 ⇒ fail-closed
# ---------------------------------------------------------------------------


def test_allowlist_follows_the_config_key(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """改配置键即改允许集合 —— 证明集合真的来自那一处,而不是端点里的硬编码。"""
    first = tmp_path / "root-a"
    second = tmp_path / "root-b"
    for d in (first, second):
        d.mkdir()
        (d / "a.txt").write_text("line1\nline2\n", encoding="utf-8")

    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(first))
    assert _post(client, "/api/patch/apply", second, _update_patch("a.txt", "line1", "L")).status_code == 403

    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(second))
    assert _post(client, "/api/patch/apply", second, _update_patch("a.txt", "line1", "L")).status_code == 200


def test_multiple_roots_separated_by_pathsep(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """集合是多条的(os.pathsep 分隔,沿用该键既有语义),任一条命中即可。"""
    a = tmp_path / "ra"
    b = tmp_path / "rb"
    for d in (a, b):
        d.mkdir()
        (d / "a.txt").write_text("line1\nline2\n", encoding="utf-8")
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", os.pathsep.join([str(a), str(b)]))
    assert _post(client, "/api/patch/apply", b, _update_patch("a.txt", "line1", "L")).status_code == 200


def test_fail_closed_when_the_root_source_breaks(
    client: TestClient, workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """取源抛错 ⇒ 503 拒绝执行,**不得**回退成"不限制"或静默放行。"""

    def _boom() -> list[str]:
        raise RuntimeError("模拟 mcp_server 取源故障")

    monkeypatch.setattr(mcp_server, "_get_workspace_roots", _boom)
    res = _post(client, "/api/patch/apply", workspace, _update_patch("a.txt", "line1", "L"))
    assert res.status_code == 503
    assert (workspace / "a.txt").read_text(encoding="utf-8") == "line1\nline2\n"


def test_fail_closed_when_the_root_registry_is_empty(
    client: TestClient, workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """登记集合为空 ⇒ 503。空集合在本判据里不是"全都允许"。"""
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [])
    res = _post(client, "/api/patch/apply", workspace, _update_patch("a.txt", "line1", "L"))
    assert res.status_code == 503


# ---------------------------------------------------------------------------
# 反向锁:端点不得自带第二份取源实现(ast 面,散文里提到键名不算违规)
# ---------------------------------------------------------------------------


def _call_site_string_args(tree: ast.AST) -> set[str]:
    """所有**作为实参出现**的字符串常量(文档字符串/注释不会落在这里)。"""
    found: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            for arg in list(node.args) + [kw.value for kw in node.keywords]:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    found.add(arg.value)
    return found


def test_router_does_not_reimplement_the_root_source() -> None:
    """patch.py 不得自己读那个环境变量键 —— 取源只有 mcp_server 那一份实现。

    这是"唯一来源"这条要求的机器判据:配置键被三处各自解析过(见 path_guard.py
    头注记的那一型事故),再抄一份就是第四处。
    """
    tree = ast.parse(_PATCH_SOURCE)
    assert "MCP_WORKSPACE_ROOTS" not in _call_site_string_args(tree)
    imported = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.mcp_server"
        for alias in node.names
    }
    assert "_get_workspace_roots" in imported, "必须复用共享取源,而不是端点内自拼"


def test_both_patch_endpoints_share_the_same_guard() -> None:
    """两个端点都走同一个 ``_run`` ⇒ 不可能出现"preview 收紧了、apply 忘了"。"""
    tree = ast.parse(_PATCH_SOURCE)
    funcs = {n.name: n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    for endpoint in ("preview_patch", "apply_patch_endpoint"):
        body = funcs[endpoint]
        called = {
            n.func.id
            for n in ast.walk(body)
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
        }
        assert "_run" in called, f"{endpoint} 必须经 _run 走同一判据"
        assert "apply_patch" not in called, f"{endpoint} 不得绕过 _run 直调引擎"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
