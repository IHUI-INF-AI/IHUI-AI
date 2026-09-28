# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""商店写侧「无主记录只有管理员能改」(2026-09-29 机主拍板)。

拍板原话:「连接器那边维持现状(无主记录对所有人不可见,只有人工认领才复活);
**商店那边改成只有管理员能改**。」所以 `connector_store` 的读侧语义**一行未动**,
本文件只测商店侧,并且刻意不去断言连接器那一面 —— 两处若哪天又要改,得各留各的证据。

判据三态(唯一实现 `mcp_store.mutate_decision`;`can_mutate` 只是它的布尔投影):
- **喂"记录属主 == 调用者"** ⇒ 绿(角色无关,普通用户即可改自己的)。反过来说这一档
  **喂什么都不会红** —— 把管理员那条判据写坏也拦不住属主本人,所以正向对照必须留着。
- **喂"记录无属主 + 角色 < 1"** ⇒ 红(403);**喂"无属主 + 角色 >= 1"** ⇒ 绿。
  这一档就是本票收紧的那一格:改前它是"任何已登录主体皆绿",所以旧测
  `test_mcp_store_owner_authz` 里那条"回退档"断言被就地翻红(那里的注释留了旧行为原文)。
- **喂"记录属主是别人"** ⇒ 普通用户一律红;**管理员绿且必须留痕**(warning 点名是谁改的)。
  理由:管理员是这一台的运维主体,否则平台装的 Server 出了故障没人能停。
  没带角色的调用(缺 `roleId`)**不算管理员**:判据 fail-closed,见
  `test_role_absent_is_not_admin_fail_closed`。

副作用口径(本仓"越权用例必须断言副作用没发生"):403 之外还要逐字段比对记录未变,
并断言 stdio bridge 一次都没被叫 —— 只断状态码会放过"先改了再抛 403"这一种写法。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.jwt_auth import require_request_user_id
from app.routers import mcp as mcp_router
from app.services import mcp_server, mcp_stdio_bridge, mcp_store
from app.services.mcp_store import (
    ADMIN_ROLE_ID,
    MUTATE_BY_ADMIN,
    MUTATE_BY_OWNER,
    MUTATE_DENIED,
    MUTATE_MISSING,
    MUTATE_NEEDS_ADMIN,
    OWNER_FIELD,
)

PLAIN = "user-plain"
OTHER = "user-other"
ADMIN = "admin-root"

#: 被审文件本体 —— `test_no_boolean_projection_of_the_decision` 判的是"入口形状",
#: 只能读源码面(与 `tests/test_mcp_unscoped_exits_are_fenced.py` 同一类回归锁)。
MCP_STORE_PATH = Path(__file__).resolve().parent.parent / "app" / "services" / "mcp_store.py"

# =============================================================================
# fixtures / helpers
# =============================================================================


@pytest.fixture
def store_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def bridge_spy(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[str]]:
    """记录 bridge 调用,不真起子进程 —— 403 那一侧断言它**空**。"""
    calls: dict[str, list[str]] = {"add": [], "remove": []}

    async def fake_add(name, command, args=None, env=None, description=""):  # noqa: ANN001
        calls["add"].append(name)
        return 2

    async def fake_remove(name):  # noqa: ANN001
        calls["remove"].append(name)
        return [f"{name}__tool1"]

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


@pytest.fixture
def clean_registry():
    """端点会调 `unregister_external_tools`,跑完把注册表恢复,别污染别的套件。"""
    before_handlers = set(mcp_server._TOOL_HANDLERS.keys())
    before_tools = {t.name for t in mcp_server._TOOLS}
    before_external = set(mcp_server._EXTERNAL_TOOL_NAMES)
    before_servers = dict(mcp_stdio_bridge._STDIO_SERVERS)
    yield
    for name in list(mcp_server._TOOL_HANDLERS.keys()):
        if name not in before_handlers:
            del mcp_server._TOOL_HANDLERS[name]
    mcp_server._TOOLS[:] = [t for t in mcp_server._TOOLS if t.name in before_tools]
    mcp_server._EXTERNAL_TOOL_NAMES.clear()
    mcp_server._EXTERNAL_TOOL_NAMES.update(before_external)
    mcp_stdio_bridge._STDIO_SERVERS.clear()
    mcp_stdio_bridge._STDIO_SERVERS.update(before_servers)


def _client(principal: str, *, role_id: int | None = 0) -> TestClient:
    """主体经依赖覆写注入;角色经中间件写进 `request.state.role_id`。

    `role_id=None` = **中间件根本没设过这个属性**(JWT 里没有 roleId / 走了白名单早退),
    这一档必须被当普通用户 —— 它就是"只带 user_id 不带角色的调用不得被当管理员"的现场。
    """
    app = FastAPI()

    if role_id is not None:

        @app.middleware("http")
        async def _inject_role(request: Request, call_next):  # type: ignore[no-untyped-def]
            request.state.role_id = role_id
            return await call_next(request)

    app.include_router(mcp_router.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: principal
    return TestClient(app)


def _seed(name: str, *, owner: str = "", enabled: bool = True) -> None:
    """直接落一条记录(绕开安装流程)—— 存量**无主**记录只能这么造。"""
    record: dict[str, Any] = {
        "name": name,
        "key": name,
        "transport": "stdio",
        "command": "echo",
        "args": [],
        "env": {},
        "installed": True,
        "enabled": enabled,
        "installed_at": mcp_store.now_iso(),
        "tool_count": 0,
        "last_error": "",
    }
    if owner:
        record[OWNER_FIELD] = owner
    mcp_store.save_installed(record)


def _snapshot() -> str:
    """整份存储的规范化 JSON —— 逐字段比对的证据(键序无关)。"""
    return json.dumps(mcp_store.list_installed(), sort_keys=True, ensure_ascii=False)


def _admin() -> TestClient:
    return _client(ADMIN, role_id=ADMIN_ROLE_ID)


def _plain() -> TestClient:
    return _client(PLAIN)


# =============================================================================
# 判据层:三态各正反成对
# =============================================================================


def test_mutate_decision_three_states(store_path: Path) -> None:
    """三档各喂一次红、一次绿,外加"没这条"这一档 —— 判据有牙的证明。"""
    _seed("mine", owner=PLAIN)
    _seed("theirs", owner=OTHER)
    _seed("legacy")  # 无主存量

    # 档①:属主本人 —— 角色无关,普通用户即可
    assert mcp_store.mutate_decision("mine", PLAIN) == MUTATE_BY_OWNER
    assert mcp_store.mutate_decision("mine", OTHER) != MUTATE_BY_OWNER

    # 档②:无主记录 —— 普通用户红、管理员绿(本次收紧的那一格)
    assert mcp_store.mutate_decision("legacy", PLAIN) == MUTATE_NEEDS_ADMIN
    assert mcp_store.mutate_decision("legacy", PLAIN, ADMIN_ROLE_ID) == MUTATE_BY_ADMIN

    # 档③:别人的记录 —— 普通用户红、属主绿、管理员绿(管理员档不得静默,留痕在端点侧)
    assert mcp_store.mutate_decision("theirs", PLAIN) == MUTATE_DENIED
    assert mcp_store.mutate_decision("theirs", OTHER) == MUTATE_BY_OWNER
    assert mcp_store.mutate_decision("theirs", PLAIN, ADMIN_ROLE_ID) == MUTATE_BY_ADMIN

    # 第四档:没有这条 —— 与"不是你的"刻意不同形(列表全站可见,详情装看不见会自相矛盾)
    assert mcp_store.mutate_decision("nope", PLAIN, ADMIN_ROLE_ID) == MUTATE_MISSING


def test_admin_threshold_is_fail_closed(store_path: Path) -> None:
    """角色取不到/形状不对一律按普通用户 ——"缺省即管理员"是最容易复发的写法。"""
    _seed("legacy")

    assert mcp_store.is_admin_role(ADMIN_ROLE_ID) is True
    assert mcp_store.is_admin_role(ADMIN_ROLE_ID + 6) is True
    assert mcp_store.is_admin_role(0) is False
    assert mcp_store.is_admin_role(-5) is False
    assert mcp_store.is_admin_role(True) is False  # bool 是 int 子类,显式排除
    assert mcp_store.is_admin_role(None) is False  # type: ignore[arg-type]
    assert mcp_store.is_admin_role("9") is False  # type: ignore[arg-type]

    assert mcp_store.mutate_decision("legacy", PLAIN, ADMIN_ROLE_ID) == MUTATE_BY_ADMIN
    for not_admin in (0, -1, True, None, "9"):
        assert mcp_store.mutate_decision("legacy", PLAIN, not_admin) == MUTATE_NEEDS_ADMIN  # type: ignore[arg-type]
    # 空主体不得与无主记录"同属主":owner == "" 那一档只有管理员进得去
    assert mcp_store.mutate_decision("legacy", "") == MUTATE_NEEDS_ADMIN


def test_no_boolean_projection_of_the_decision() -> None:
    """布尔投影不得回来 —— 它把"没这条"与"不是你的"压成同一个 False。

    这一面**刻意**区分那两档(商店列表全站可见),而且端点必须能认出"管理员越档"那一档
    才能留痕;留一个更弱的入口,下一次就有人拿它去回 403,把 404 那一档抹平。
    曾用过的 `can_mutate` 于 2026-09-29 随其调用方全部改读 `mutate_decision` 而删除。
    """
    src = MCP_STORE_PATH.read_text(encoding="utf-8")
    assert not any("def can_mutate" in line for line in src.splitlines()), (
        "mcp_store 里又出现了布尔归属出口 —— 判据应只有 mutate_decision 一个入口"
    )
    assert "def mutate_decision(" in src, "唯一归属判据被摘线"


# =============================================================================
# 端点面:无主记录
# =============================================================================


def test_ownerless_plain_user_403_and_no_side_effects(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """喂"无主 + 普通用户" ⇒ 停用/卸载/启用都红,且记录逐字段未变、bridge 一次都没被叫。"""
    _seed("legacy", enabled=True)
    before = _snapshot()

    b = _plain()
    dis = b.post("/api/mcp/store/legacy/disable")
    un = b.post("/api/mcp/store/legacy/uninstall")
    en = b.post("/api/mcp/store/legacy/enable")

    assert dis.status_code == 403, dis.text
    assert un.status_code == 403, un.text
    assert en.status_code == 403, en.text
    assert _snapshot() == before
    assert bridge_spy == {"add": [], "remove": []}


def test_the_two_denials_say_different_things(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """两档拒绝的**句子**必须不同 —— 收紧无主档后同一条 403 说的不是一回事。

    2026-09-29 第一版把两档压成同一个 MUTATE_DENIED,于是四处端点对"无属主的存量安装"
    回的是「MCP Server 由他人安装,无权停用」:那台**根本没有"他人"**,提示把人引导成
    "去找装它的人",而正确出路是"找管理员"。同形只该用在会泄露存在性的场合 —— 商店清单
    本来就全站可见,拿同形当省事就是把话说错。
    """
    _seed("legacy")  # 无属主的存量安装
    _seed("theirs", owner=OTHER)  # 别人装的:同一个 403,但该说的是"由他人安装"

    b = _plain()
    ownerless = b.post("/api/mcp/store/legacy/disable").json()
    foreign = b.post("/api/mcp/store/theirs/disable").json()

    assert "无属主" in ownerless["error"] and "管理员" in ownerless["error"], ownerless
    assert "他人" in foreign["error"], foreign
    assert ownerless["error"] != foreign["error"], "两档拒绝又被合成同一句"
    # 桥接器一次都没被叫(拒绝发生在任何副作用之前)
    assert bridge_spy == {"add": [], "remove": []}


def test_ownerless_admin_can_disable_and_uninstall(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """喂"无主 + 管理员" ⇒ 绿:停用真的把 enabled 落盘,卸载真的删了记录。"""
    _seed("legacy", enabled=True)
    a = _admin()

    assert a.post("/api/mcp/store/legacy/disable").status_code == 200
    assert mcp_store.get_installed("legacy")["enabled"] is False
    assert bridge_spy["remove"] == ["legacy"]

    assert a.post("/api/mcp/store/legacy/uninstall").status_code == 200
    assert mcp_store.get_installed("legacy") is None
    assert mcp_store.list_installed() == []


def test_role_absent_is_not_admin_fail_closed(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """只带 user_id、`request.state` 里压根没有 role_id 的调用 ⇒ 普通用户,不是管理员。"""
    _seed("legacy", enabled=True)
    before = _snapshot()

    no_role = _client(PLAIN, role_id=None)
    r = no_role.post("/api/mcp/store/legacy/disable")

    assert r.status_code == 403, r.text
    assert _snapshot() == before
    assert bridge_spy == {"add": [], "remove": []}
    # 同一主体同一记录,补上角色即放行 —— 拦住它的是"没有角色",不是"这个人不认识"
    assert _admin().post("/api/mcp/store/legacy/disable").status_code == 200


# =============================================================================
# 端点面:有主记录(正向对照 + 越权 + 留痕)
# =============================================================================


def test_owner_can_still_toggle_positive_control(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """喂"属主本人 + 角色 0" ⇒ 绿。少了这条,本票可能只是把功能整个改坏了。"""
    cli = _plain()
    installed = cli.post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})
    assert installed.status_code == 200, installed.text
    assert mcp_store.owner_of("git") == PLAIN
    bridge_spy["add"].clear()

    assert cli.post("/api/mcp/store/git/disable").status_code == 200
    assert cli.post("/api/mcp/store/git/enable").status_code == 200
    assert [r["enabled"] for r in mcp_store.list_installed()] == [True]
    assert bridge_spy["remove"] == ["git"]


def test_foreign_record_admin_override_is_loud_not_silent(
    store_path: Path, bridge_spy, clean_registry, caplog: pytest.LogCaptureFixture
) -> None:
    """别人的记录:另一个普通用户 ⇒ 红;管理员 ⇒ 绿,但**必须在日志里点名**。"""
    _seed("theirs", owner=OTHER, enabled=True)
    before = _snapshot()

    with caplog.at_level(logging.WARNING, logger="app.routers.mcp"):
        denied = _client(PLAIN).post("/api/mcp/store/theirs/disable")
        assert denied.status_code == 403, denied.text
        assert _snapshot() == before
        assert bridge_spy == {"add": [], "remove": []}
        # 反向对照:被拦下时不得顺手写一条"管理员越档"日志(那会把拦截伪装成放行)
        assert not [r for r in caplog.records if "管理员越档" in r.getMessage()]

        allowed = _admin().post("/api/mcp/store/theirs/disable")
        assert allowed.status_code == 200, allowed.text

    warnings = [r.getMessage() for r in caplog.records if "管理员越档" in r.getMessage()]
    assert len(warnings) == 1, warnings
    assert "theirs" in warnings[0] and OTHER in warnings[0] and ADMIN in warnings[0]
    assert mcp_store.get_installed("theirs")["enabled"] is False


# =============================================================================
# install 覆盖同名记录:无主那一支只有管理员能覆盖
# =============================================================================


def test_install_overwrite_ownerless_requires_admin(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """无主的 disabled 记录:普通用户 install ⇒ 红且不落盘;管理员 install ⇒ 绿并重盖属主。

    disabled 是刻意选的:enabled 的记录在归属闸之后还会撞 409,那样这条判据等于没被走到。
    """
    _seed("git", enabled=False)
    before = _snapshot()

    denied = _client(PLAIN).post(
        "/api/mcp/store/install", json={"key": "git", "confirm_risk": True}
    )
    assert denied.status_code == 403, denied.text
    assert _snapshot() == before
    assert bridge_spy == {"add": [], "remove": []}

    ok = _admin().post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})
    assert ok.status_code == 200, ok.text
    rec = mcp_store.get_installed("git")
    assert rec is not None and rec[OWNER_FIELD] == ADMIN and rec["enabled"] is True


def test_install_overwrite_foreign_still_denied_for_third_party(
    store_path: Path, bridge_spy, clean_registry
) -> None:
    """同名的别人记录:第三个普通用户不得覆盖(档③),属主自己则可以(档①)。"""
    _seed("git", owner=OTHER, enabled=False)
    before = _snapshot()

    b = _client(PLAIN).post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})
    assert b.status_code == 403, b.text
    assert _snapshot() == before
    assert bridge_spy == {"add": [], "remove": []}

    o = _client(OTHER).post("/api/mcp/store/install", json={"key": "git", "confirm_risk": True})
    assert o.status_code == 200, o.text
    assert mcp_store.get_installed("git")["enabled"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
