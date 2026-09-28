# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""G-258 B 组第四票 · 任务 2:沙箱策略档位不得由请求方自带。

修复前(``app/routers/sandbox_exec.py`` 的 ``/run``):整份 ``SandboxPolicy`` 走
``SandboxPolicy.from_dict(body.policy)``,而本模块的字段语义里
- ``readable_paths = []`` ⇒ **不限制读**(os_sandbox.py ``can_read``),
- ``restrict_token = False`` ⇒ **不收紧令牌**,
所以任何已登录用户都能给自己签发最宽松档 —— 拿到的不是沙箱,是"带日志的裸子进程"。

收口后的四条判据(本文件逐条正反成对):
1. 自带任何一条"限制开关"字段 ⇒ 400,并且**子进程一次都没起**(副作用断言,
   不是只断言状态码);
2. 档位只能来自服务端登记表 ``SANDBOX_POLICY_TIERS``;未知档位 ⇒ 400 + 不执行;
3. 未点名档位 ⇒ fail-closed 到最严档(``DEFAULT_POLICY_TIER``);
4. 请求方可以在档位内**收窄**(数值更小 / denied_paths 更多),但不能放宽。

隔离:所有执行侧都换成替身(``_StubHandle``),不真起沙箱子进程、不写系统目录,
也不连 PostgreSQL(8810)/ Redis(8811)。
"""

from __future__ import annotations

import ast
from collections.abc import Iterator, Sequence
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.jwt_auth import get_current_user_id
from app.routers import sandbox_exec as sandbox_exec_module
from app.services import mcp_server, os_sandbox
from app.services.os_sandbox import (
    DEFAULT_POLICY_TIER,
    POLICY_TIER_READ_ONLY,
    POLICY_TIER_WORKSPACE_WRITE,
    SANDBOX_POLICY_TIERS,
    TIER_TUNABLE_FIELDS,
    ExecResult,
    PolicyError,
    PolicyTier,
    build_tier_policy,
    resolve_policy_tier,
)

_SANDBOX_ROUTER_SOURCE = Path(sandbox_exec_module.__file__).read_text(encoding="utf-8")

#: 语义 = "关掉这条限制"的字段:一律不得由请求方提供
RESTRICTION_FIELDS: tuple[str, ...] = (
    "readable_paths",
    "writable_paths",
    "allow_network",
    "restrict_token",
    "env_whitelist",
    "base_dir",
)


class _StubHandle:
    """SandboxHandle 替身:记录本次真正生效的策略,不派生任何子进程。"""

    instances: list[_StubHandle] = []

    def __init__(self, policy: os_sandbox.SandboxPolicy, backend: str | None = None) -> None:
        self.policy = policy
        self.backend = backend
        self.calls: list[dict[str, Any]] = []
        _StubHandle.instances.append(self)

    def run(
        self,
        cmd: str | Sequence[str],
        cwd: str = ".",
        env: Any = None,
    ) -> ExecResult:
        self.calls.append({"cmd": cmd, "cwd": cwd})
        return ExecResult(
            cmd=[cmd] if isinstance(cmd, str) else list(cmd),
            returncode=0,
            stdout="stub",
            stderr="",
            duration_ms=1.0,
            backend=self.backend or "stub_backend",
        )


@pytest.fixture(autouse=True)
def _reset_stub() -> Iterator[None]:
    _StubHandle.instances = []
    yield


@pytest.fixture()
def stub_handle(monkeypatch: pytest.MonkeyPatch) -> type[_StubHandle]:
    monkeypatch.setattr(sandbox_exec_module, "SandboxHandle", _StubHandle)
    return _StubHandle


@pytest.fixture()
def roots(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """服务端登记的工作区根(唯一来源那条配置键)。"""
    granted = tmp_path / "granted"
    granted.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(granted))
    return [str(granted.resolve(strict=False))]


@pytest.fixture()
def client() -> Iterator[TestClient]:
    app = FastAPI()
    app.include_router(sandbox_exec_module.router, prefix="/api")
    app.dependency_overrides[get_current_user_id] = lambda: "sandbox-audit-user"
    yield TestClient(app)


def _run(client: TestClient, payload: dict[str, Any]) -> Any:
    return client.post("/api/sandbox/run", json={"cmd": ["printf", "hi"], **payload})


def _last_policy() -> os_sandbox.SandboxPolicy:
    assert _StubHandle.instances, "沙箱执行侧根本没被走到 —— 断言无意义"
    return _StubHandle.instances[-1].policy


# ---------------------------------------------------------------------------
# 1. 自带限制开关 ⇒ 400,且一次都没执行
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("field", RESTRICTION_FIELDS)
def test_requester_cannot_supply_a_restriction_field(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str], field: str
) -> None:
    """每个"限制开关"字段都要各自点名拒 —— 只拦其中一条等于留了一扇能关限制的窗。"""
    payload: dict[str, Any] = {"readable_paths": [], "writable_paths": [], "allow_network": True,
                              "restrict_token": False, "env_whitelist": ["SECRET"], "base_dir": "/"}
    res = _run(client, {"policy": {field: payload[field]}})
    assert res.status_code == 400
    assert "策略非法" in res.json()["detail"]
    assert field in res.json()["detail"]
    assert stub_handle.instances == []  # 副作用没发生


def test_empty_readable_paths_from_requester_is_not_treated_as_unrestricted(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    """修复前的最危险写法(``readable_paths: []`` = 不限制读)必须报错而不是放行。"""
    res = _run(client, {"policy": {"readable_paths": []}})
    assert res.status_code == 400
    assert stub_handle.instances == []


# ---------------------------------------------------------------------------
# 2/3. 档位只能来自登记表;缺省 fail-closed 到最严档
# ---------------------------------------------------------------------------


def test_default_tier_is_the_strictest_one(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    res = _run(client, {})
    assert res.status_code == 200
    policy = _last_policy()
    assert policy.readable_paths == roots, "可读根必须来自服务端登记的根集合"
    assert policy.writable_paths == []
    assert policy.allow_network is False
    assert policy.restrict_token is True
    assert res.json()["data"]["tier"] == DEFAULT_POLICY_TIER


def test_unknown_tier_is_rejected_and_never_executes(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    """点了登记表里没有的名字 ⇒ 400 + 不执行(不回退宽松档,也不静默换成默认档)。"""
    res = _run(client, {"tier": "danger-full-access"})
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "未知策略档位" in detail
    # 报错里必须给出可选档位名 —— 否则调用方无从知道该点哪个,只会回头继续自带 policy
    for name in SANDBOX_POLICY_TIERS:
        assert name in detail
    assert stub_handle.instances == []


def test_tier_selector_cannot_widen_beyond_the_registry(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    """请求方能"在已授予的档位里选一个",但选不到比登记表更宽的东西。

    正向对照:workspace_write 这一档确实给了写(证明档位选择不是装饰品);
    但它写的范围仍是服务端那批根,不是请求方指定的目录。
    """
    res = _run(client, {"tier": POLICY_TIER_WORKSPACE_WRITE})
    assert res.status_code == 200
    policy = _last_policy()
    assert policy.writable_paths == roots
    # 写集只能等于服务端那批根:登记表里没有"任意目录可写"的档位,
    # 所以没有任何一种选择能让写集宽于授予范围(roots 逐条绝对路径)。
    assert all(Path(r).is_absolute() for r in policy.writable_paths)
    assert set(policy.writable_paths) == set(policy.readable_paths)


def test_every_registered_tier_keeps_the_two_locks_on(roots: list[str]) -> None:
    """**档位表里每一条**都必须关着"不限制读"和"不收紧令牌"这两格。

    这是本判据的"正向证明":不是只测默认档恰好严,而是登记表整体不产出宽松形态;
    新增档位若把 restrict_token 关掉、把读集合留空、或让写集宽于读集,本例会直接红。
    """
    for name, tier in SANDBOX_POLICY_TIERS.items():
        policy = build_tier_policy(tier, roots)
        assert policy.restrict_token is True, f"档位 {name} 关掉了令牌收紧"
        assert policy.readable_paths, f"档位 {name} 的可读集合为空 ⇒ 等于不限制读"
        assert set(policy.writable_paths) <= set(policy.readable_paths), (
            f"档位 {name} 的写集宽于读集(write ⊆ read 不变式被档位自己破坏)"
        )
        if not tier.writable:
            assert policy.writable_paths == [], f"档位 {name} 未授予写却有可写路径"


def test_roots_empty_fails_closed_at_service_layer(tmp_path: Path) -> None:
    """服务层同样不承认"没有根 = 不限制"。"""
    tier = resolve_policy_tier(None)
    with pytest.raises(PolicyError):
        build_tier_policy(tier, [])


# ---------------------------------------------------------------------------
# 4. 收窄可以,放宽不行
# ---------------------------------------------------------------------------


def test_narrowing_inside_the_tier_is_accepted(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    ceiling = SANDBOX_POLICY_TIERS[DEFAULT_POLICY_TIER].timeout_s
    res = _run(client, {"policy": {"timeout_s": ceiling - 1}})
    assert res.status_code == 200
    assert _last_policy().timeout_s == ceiling - 1


def test_widening_a_limit_is_rejected(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str]
) -> None:
    tier = SANDBOX_POLICY_TIERS[DEFAULT_POLICY_TIER]
    res = _run(client, {"policy": {"memory_mb": tier.memory_mb + 1}})
    assert res.status_code == 400
    assert "只能收窄" in res.json()["detail"]
    assert stub_handle.instances == []


@pytest.mark.parametrize("bad", [0, -5, "30", True])
def test_non_positive_or_non_integer_limits_rejected(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str], bad: Any
) -> None:
    res = _run(client, {"policy": {"timeout_s": bad}})
    assert res.status_code == 400
    assert stub_handle.instances == []


def test_extra_denied_paths_are_accepted_as_narrowing(
    client: TestClient, stub_handle: type[_StubHandle], roots: list[str], tmp_path: Path
) -> None:
    denied = (tmp_path / "granted" / "private").as_posix()
    res = _run(client, {"tier": POLICY_TIER_WORKSPACE_WRITE, "policy": {"denied_paths": [denied]}})
    assert res.status_code == 200
    assert _last_policy().denied_paths == [denied]


def test_tunable_field_list_is_the_only_door() -> None:
    """可收窄集合里**不得**出现任何限制开关字段(名单腐烂 = 又把窗开回去)。"""
    assert set(TIER_TUNABLE_FIELDS) & set(RESTRICTION_FIELDS) == set()
    assert frozenset(
        {"timeout_s", "memory_mb", "cpu_seconds", "max_processes", "denied_paths"}
    ) == TIER_TUNABLE_FIELDS


# ---------------------------------------------------------------------------
# 反向锁:登记表与路由的归属
# ---------------------------------------------------------------------------


def test_router_does_not_own_a_second_tier_table() -> None:
    """档位表只能住在 os_sandbox(与被约束的策略模型同层)。

    路由里再抄一份 dict 就是第二份真相 —— 本仓对这一型记过多次(见
    app/services/path_guard.py 头注:四处各持一份常量时,加固不会传导)。
    """
    tree = ast.parse(_SANDBOX_ROUTER_SOURCE)
    assigned = {
        t.id
        for node in ast.walk(tree)
        if isinstance(node, (ast.Assign, ast.AnnAssign))
        for t in ([node.target] if isinstance(node, ast.AnnAssign) else node.targets)
        if isinstance(t, ast.Name)
    }
    assert "SANDBOX_POLICY_TIERS" not in assigned
    assert "TIER_TUNABLE_FIELDS" not in assigned
    # 路由不得自己构造档位条目(只能从登记表取)
    constructed = [
        n.func.id
        for n in ast.walk(tree)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "PolicyTier"
    ]
    assert constructed == []
    imported = {
        alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module == "app.services.os_sandbox"
        for alias in node.names
    }
    assert {"resolve_policy_tier", "build_tier_policy"} <= imported


def test_backend_matrix_advertises_tiers_as_a_projection_of_the_registry(
    client: TestClient,
) -> None:
    """`GET /api/sandbox/backends` 的 policy_tiers 必须是登记表的投影,不是第二份名单。

    登记表新增/改名而这里没跟着动,本例会红(名字集合必须逐项等值)。
    """
    res = client.get("/api/sandbox/backends")
    assert res.status_code == 200
    advertised = res.json()["data"]["policy_tiers"]
    assert [t["name"] for t in advertised] == [t.name for t in SANDBOX_POLICY_TIERS.values()]
    defaults = [t for t in advertised if t["is_default"]]
    assert len(defaults) == 1 and defaults[0]["name"] == DEFAULT_POLICY_TIER


def test_tier_registry_types_are_explicit() -> None:
    """登记表键值类型对账:mypy 判不了"键 == 条目名",这里判。"""
    for key, tier in SANDBOX_POLICY_TIERS.items():
        assert isinstance(tier, PolicyTier)
        assert tier.name == key, f"登记键 {key} 与档位自身名字 {tier.name} 不一致"
    assert DEFAULT_POLICY_TIER in SANDBOX_POLICY_TIERS
    assert POLICY_TIER_READ_ONLY in SANDBOX_POLICY_TIERS


def test_workspace_root_source_failure_fails_closed(
    client: TestClient, stub_handle: type[_StubHandle], monkeypatch: pytest.MonkeyPatch
) -> None:
    """取不到服务端根集合 ⇒ 拒绝(503),不得退化为"没有根 = 不限制读"。"""

    def _boom() -> list[str]:
        raise RuntimeError("模拟 mcp_server 取源故障")

    monkeypatch.setattr(mcp_server, "_get_workspace_roots", _boom)
    res = _run(client, {})
    assert res.status_code == 503
    assert stub_handle.instances == []
