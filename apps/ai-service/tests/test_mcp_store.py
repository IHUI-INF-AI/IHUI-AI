# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP 应用商店端点与持久化单元测试(2026-09-02 立,P2-1)。

覆盖:
- GET  /api/mcp/store                 合并目录与安装状态
- POST /api/mcp/store/install         安装成功持久化 / 缺 env 400 / 未知 key 404
                                        / 重复安装 409 / 停用后重装成功
- POST /api/mcp/store/{name}/uninstall 卸载清理持久化 + 工具表
- POST /api/mcp/store/{name}/enable|disable 状态切换(含幂等)
- mcp_store JSON 读写异常降级(损坏文件返回空 / 写失败返回 None)

隔离策略:
- monkeypatch stdio bridge 的 add_stdio_server_tool / remove_stdio_server(mock,不起子进程)
- monkeypatch mcp_store._STORE_PATH 指向 pytest tmp_path,不污染真实 data/
- clean_registry 清理 mcp_server 注册表新增工具,避免跨测试污染
"""

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp as mcp_router
from app.services import mcp_server, mcp_stdio_bridge, mcp_store

# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def store_path(tmp_path, monkeypatch):
    """把 mcp_store 持久化路径指向临时目录,隔离真实 data/。"""
    p = tmp_path / "mcp_store.json"
    monkeypatch.setattr(mcp_store, "_STORE_PATH", p)
    return p


@pytest.fixture
def bridge_mock(monkeypatch):
    """mock stdio bridge 的 add/remove,记录调用而不真实拉起子进程。"""
    calls = {"add": [], "remove": []}

    async def fake_add(name, command, args=None, env=None, description=""):
        calls["add"].append(
            {"name": name, "command": command, "args": list(args or []), "env": dict(env or {})}
        )
        return 2

    async def fake_remove(name):
        calls["remove"].append(name)
        return [f"{name}__tool1", f"{name}__tool2"]

    monkeypatch.setattr(mcp_stdio_bridge, "add_stdio_server_tool", fake_add)
    monkeypatch.setattr(mcp_stdio_bridge, "remove_stdio_server", fake_remove)
    return calls


@pytest.fixture
def api_client(store_path):
    """只挂载 mcp 路由的 FastAPI app(同步 TestClient)。"""
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def clean_registry():
    """测试后清理 mcp_server 注册表新增工具/连接,避免污染其他测试。"""
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


# =============================================================================
# GET /api/mcp/store(目录 + 安装状态合并)
# =============================================================================


def test_store_list_initial(api_client):
    """初始无安装:8 个目录条目,installed 全 False,含 server_name。"""
    r = api_client.get("/api/mcp/store")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 8
    keys = {s["key"] for s in body["servers"]}
    assert "filesystem" in keys and "github" in keys
    for s in body["servers"]:
        assert s["installed"] is False
        assert s["enabled"] is False
        assert s["tool_count"] == 0
        assert s["last_error"] == ""
        assert s["server_name"] == s["key"]


# =============================================================================
# POST /api/mcp/store/install
# =============================================================================


def test_install_success_persists(api_client, store_path, bridge_mock, clean_registry):
    """安装成功:热挂载调用参数正确 + 持久化记录 + GET store 反映 installed。"""
    r = api_client.post("/api/mcp/store/install", json={"key": "git"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["name"] == "git"
    assert body["tool_count"] == 2

    # 持久化文件存在且记录结构正确
    assert store_path.exists()
    recs = mcp_store.list_installed()
    assert len(recs) == 1
    rec = recs[0]
    assert rec["name"] == "git"
    assert rec["key"] == "git"
    assert rec["transport"] == "stdio"
    assert rec["command"] == "npx"
    assert rec["args"] == ["-y", "@modelcontextprotocol/server-git"]
    assert rec["installed"] is True
    assert rec["enabled"] is True
    assert rec["tool_count"] == 2
    assert rec["last_error"] == ""
    assert "installed_at" in rec

    # 热挂载调用参数
    assert len(bridge_mock["add"]) == 1
    assert bridge_mock["add"][0]["name"] == "git"
    assert bridge_mock["add"][0]["command"] == "npx"

    # GET store 反映 installed
    body2 = api_client.get("/api/mcp/store").json()
    git = next(s for s in body2["servers"] if s["key"] == "git")
    assert git["installed"] is True
    assert git["enabled"] is True
    assert git["tool_count"] == 2


def test_install_missing_env_400(api_client, bridge_mock, clean_registry):
    """postgres 缺 DATABASE_URL → 400,且不持久化不调用热挂载。"""
    r = api_client.post("/api/mcp/store/install", json={"key": "postgres"})
    assert r.status_code == 400
    assert "DATABASE_URL" in r.json()["error"]
    assert mcp_store.list_installed() == []
    assert bridge_mock["add"] == []


def test_install_env_supplied_ok(api_client, bridge_mock, clean_registry):
    """提供必需 env 后安装成功,env 传入热挂载并持久化。"""
    r = api_client.post(
        "/api/mcp/store/install",
        json={"key": "postgres", "env": {"DATABASE_URL": "postgres://u:p@h/db"}},
    )
    assert r.status_code == 200
    assert bridge_mock["add"][0]["env"]["DATABASE_URL"] == "postgres://u:p@h/db"
    rec = mcp_store.list_installed()[0]
    assert rec["env"]["DATABASE_URL"] == "postgres://u:p@h/db"


def test_install_unknown_key_404(api_client, bridge_mock, clean_registry):
    r = api_client.post("/api/mcp/store/install", json={"key": "no_such"})
    assert r.status_code == 404
    assert "不存在" in r.json()["error"]


def test_install_duplicate_enabled_409(api_client, bridge_mock, clean_registry):
    """已安装且启用 → 409。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200
    r = api_client.post("/api/mcp/store/install", json={"key": "git"})
    assert r.status_code == 409
    assert "已安装" in r.json()["error"]
    assert len(bridge_mock["add"]) == 1  # 未重复热挂载


def test_install_after_disable_reenables(api_client, bridge_mock, clean_registry):
    """安装后停用,再安装 → 成功(重新热挂载 + enabled 回到 True),不 409。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200
    assert api_client.post("/api/mcp/store/git/disable").status_code == 200
    r = api_client.post("/api/mcp/store/install", json={"key": "git"})
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert mcp_store.get_installed("git")["enabled"] is True
    assert len(bridge_mock["add"]) == 2


def test_install_workspace_path_used(api_client, bridge_mock, clean_registry):
    """filesystem 支持 workspace_path 替换 args 尾部参数。"""
    r = api_client.post(
        "/api/mcp/store/install",
        json={"key": "filesystem", "workspace_path": "G:/ihui"},
    )
    assert r.status_code == 200
    assert bridge_mock["add"][0]["args"][-1] == "G:/ihui"
    assert mcp_store.get_installed("filesystem")["args"][-1] == "G:/ihui"


# =============================================================================
# POST /api/mcp/store/{name}/uninstall
# =============================================================================


def test_uninstall_cleans_store_and_tools(api_client, store_path, bridge_mock, clean_registry):
    """卸载:关闭子进程 + 从工具表清理 + 删除持久化记录。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200
    # 模拟该 server 注入过两个工具到外部工具名单
    injected = {"git__tool1", "git__tool2"}
    mcp_server._EXTERNAL_TOOL_NAMES.update(injected)

    r = api_client.post("/api/mcp/store/git/uninstall")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["tools_removed"] == 2

    # remove_stdio_server 被调用
    assert bridge_mock["remove"] == ["git"]
    # 外部工具名单被清理
    assert not injected & mcp_server._EXTERNAL_TOOL_NAMES
    # 持久化记录删除
    assert mcp_store.get_installed("git") is None
    assert mcp_store.list_installed() == []
    # GET store 恢复未安装
    git = next(
        s for s in api_client.get("/api/mcp/store").json()["servers"] if s["key"] == "git"
    )
    assert git["installed"] is False


def test_uninstall_unknown_404(api_client, bridge_mock):
    r = api_client.post("/api/mcp/store/nope/uninstall")
    assert r.status_code == 404
    assert "未安装" in r.json()["error"]


def test_uninstall_not_injected_tools_ok(api_client, bridge_mock, clean_registry):
    """已安装但工具表未注入(如重启后)卸载也不报错,幂等清理。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "time"}).status_code == 200
    # 清掉外部工具名单模拟"重启后丢失"
    mcp_server._EXTERNAL_TOOL_NAMES.clear()
    r = api_client.post("/api/mcp/store/time/uninstall")
    assert r.status_code == 200
    assert r.json()["tools_removed"] == 0


# =============================================================================
# POST /api/mcp/store/{name}/enable | disable
# =============================================================================


def test_disable_then_enable_cycle(api_client, store_path, bridge_mock, clean_registry):
    """停用 → 关闭子进程 + 清理工具 + 持久化 enabled=False;启用 → 重新热挂载。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200

    # disable
    r = api_client.post("/api/mcp/store/git/disable")
    assert r.status_code == 200
    assert r.json()["enabled"] is False
    assert bridge_mock["remove"] == ["git"]
    assert mcp_store.get_installed("git")["enabled"] is False
    git = next(
        s for s in api_client.get("/api/mcp/store").json()["servers"] if s["key"] == "git"
    )
    assert git["installed"] is True
    assert git["enabled"] is False

    # enable
    r = api_client.post("/api/mcp/store/git/enable")
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    assert r.json()["tool_count"] == 2
    assert len(bridge_mock["add"]) == 2  # install 一次 + enable 一次
    assert bridge_mock["add"][1]["name"] == "git"
    assert mcp_store.get_installed("git")["enabled"] is True
    assert mcp_store.get_installed("git")["tool_count"] == 2
    assert mcp_store.get_installed("git")["last_error"] == ""


def test_disable_idempotent(api_client, bridge_mock, clean_registry):
    """重复停用幂等,不重复关闭子进程。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200
    assert api_client.post("/api/mcp/store/git/disable").status_code == 200
    r = api_client.post("/api/mcp/store/git/disable")
    assert r.status_code == 200
    assert r.json()["enabled"] is False
    assert bridge_mock["remove"] == ["git"]


def test_enable_idempotent(api_client, bridge_mock, clean_registry):
    """已启用再 enable 幂等,不重复热挂载。"""
    assert api_client.post("/api/mcp/store/install", json={"key": "git"}).status_code == 200
    r = api_client.post("/api/mcp/store/git/enable")
    assert r.status_code == 200
    assert r.json()["enabled"] is True
    assert len(bridge_mock["add"]) == 1


def test_disable_unknown_404(api_client):
    r = api_client.post("/api/mcp/store/nope/disable")
    assert r.status_code == 404
    assert "未安装" in r.json()["error"]


def test_enable_unknown_404(api_client):
    r = api_client.post("/api/mcp/store/nope/enable")
    assert r.status_code == 404
    assert "未安装" in r.json()["error"]


# =============================================================================
# mcp_store JSON 持久化异常降级
# =============================================================================


def test_corrupt_json_returns_empty(store_path):
    """持久化文件损坏 → list_installed 返回空列表,不崩服务。"""
    store_path.write_text("{not valid json", encoding="utf-8")
    assert mcp_store.list_installed() == []
    assert mcp_store.get_installed("git") is None


def test_non_list_json_returns_empty(store_path):
    """文件内容非列表 → 视为空。"""
    store_path.write_text(json.dumps({"a": 1}), encoding="utf-8")
    assert mcp_store.list_installed() == []


def test_write_failure_returns_none(store_path, monkeypatch):
    """写失败(目标父目录被文件占用)→ save_installed 返回 None、remove 返回 False。"""
    store_path.write_text("[]", encoding="utf-8")
    # 把存储路径放到已存在文件的下级目录,迫使 mkdir 失败
    monkeypatch.setattr(mcp_store, "_STORE_PATH", store_path / "sub" / "x.json")
    assert mcp_store.save_installed({"name": "git", "key": "git"}) is None
    assert mcp_store.remove_installed("git") is False


def test_set_enabled_missing_returns_none(store_path):
    assert mcp_store.set_enabled("git", True) is None
