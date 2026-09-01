# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""内置 MCP Server 目录单测。

覆盖:
- 目录条目完整(8 个,含 key/name/description/source/transport)
- get_entry 命中与未命中
- to_client_config 转换(filesystem 工作区参数注入 / postgres 环境变量校验)
- 必需环境变量缺失提示
- 端点:GET /api/mcp/directory / POST 一键注册(缺 env 400 / 未知 key 404)
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import mcp
from app.services.mcp_directory import get_directory, get_entry, to_client_config

app = FastAPI()
app.include_router(mcp.router, prefix="/api")
client = TestClient(app)


class TestDirectory:
    def test_entries_complete(self):
        entries = get_directory()
        assert len(entries) >= 8
        expected = {
            "filesystem", "git", "fetch", "memory",
            "sequential-thinking", "time", "postgres", "github",
        }
        keys = {e["key"] for e in entries}
        assert expected <= keys
        for e in entries:
            assert e["key"] and e["name"] and e["description"]
            assert e["source"] in {"official", "community"}
            assert e["transport"] in {"stdio", "sse"}

    def test_get_entry_hit_and_miss(self):
        assert get_entry("filesystem") is not None
        assert get_entry("no_such") is None

    def test_to_client_config_filesystem_workspace(self):
        cfg = to_client_config("filesystem", workspace_path="G:/ihui")
        assert cfg is not None
        assert cfg["name"] == "mcp:filesystem"
        assert cfg["command"] == "npx"
        assert cfg["args"][-1] == "G:/ihui"

    def test_to_client_config_postgres_env(self):
        cfg = to_client_config("postgres", env_overrides={"DATABASE_URL": "postgres://u:p@h/db"})
        assert cfg is not None
        assert cfg["_missing_env"] == []
        assert cfg["env"]["DATABASE_URL"] == "postgres://u:p@h/db"

    def test_to_client_config_postgres_missing_env(self):
        cfg = to_client_config("postgres")
        assert cfg is not None
        assert cfg["_missing_env"] == ["DATABASE_URL"]

    def test_to_client_config_unknown_key(self):
        assert to_client_config("no_such") is None


class TestDirectoryEndpoint:
    def test_list_directory(self):
        r = client.get("/api/mcp/directory")
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 8
        keys = {e["key"] for e in d["servers"]}
        assert "filesystem" in keys and "github" in keys

    def test_register_missing_env_400(self):
        """postgres 缺 DATABASE_URL → 400。"""
        r = client.post("/api/mcp/directory/postgres/register", json={"name": "mcp:postgres"})
        assert r.status_code == 400
        assert "DATABASE_URL" in r.json()["error"]

    def test_register_unknown_key_404(self):
        r = client.post("/api/mcp/directory/no_such/register", json={"name": "x"})
        assert r.status_code == 404
