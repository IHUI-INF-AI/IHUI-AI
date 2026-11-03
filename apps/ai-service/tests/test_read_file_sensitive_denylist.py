# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""read_file 的敏感面:目录级 denylist + 形态补全(2026-11-01 安全强化,严重)。

原缺陷:黑名单只按 basename/扩展名判,而真实落盘的凭据与会话库都不带那些后缀 ——
`data/credentials_key`、`data/checkin_fernet_key`、`data/sessions.db`、
`.uploads/publish/<他人>/*` 全不命中;read_file 又不在 admin 工具表里 ⇒
任意登录用户一条 `tools/call` 就能整库拉走。

反向牙:摘掉目录级判据(或把 `data` 从 segments 里删掉),`test_read_file_blocks_*`
会从"拒绝"变成"真读到内容" ⇒ 红。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import mcp_server

APP_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = APP_ROOT / "data"


@pytest.fixture(autouse=True)
def _workspace_is_app_root(monkeypatch: pytest.MonkeyPatch) -> None:
    """工具根钉成 apps/ai-service:与线上"空 MCP_WORKSPACE_ROOTS 回落 cwd"同形。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(APP_ROOT))


@pytest.mark.parametrize(
    "rel",
    ["data/credentials_key", "data/checkin_fernet_key", "data/sessions.db"],
)
async def test_read_file_blocks_real_credential_files(rel: str) -> None:
    """三个**真实存在**的落盘路径必须被拒(且路径本身在工作区内 —— 只有 denylist 在挡)。"""
    target = APP_ROOT / rel
    assert target.exists(), f"夹具前提不成立:{target} 不存在"

    ok_path, info = mcp_server._validate_path_in_workspace(rel)
    assert ok_path is True, "路径本身应在工作区内 —— 否则测不到 denylist 这一层"

    result = await mcp_server._tool_read_file({"path": rel})
    assert result["ok"] is False
    assert result.get("errorCode") == "SENSITIVE_FILE_BLOCKED"
    assert result["content"] == ""


async def test_read_file_blocks_dot_uploads_of_other_users(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`.uploads/publish/<他人>/x.png` 整目录拒(图片后缀不再是免罪符)。"""
    other = tmp_path / ".uploads" / "publish" / "other-user"
    other.mkdir(parents=True)
    png = other / "x.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\nfake")

    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    result = await mcp_server._tool_read_file({"path": ".uploads/publish/other-user/x.png"})

    assert result["ok"] is False
    assert result.get("errorCode") == "SENSITIVE_FILE_BLOCKED"


async def test_dotdot_traversal_into_data_is_still_blocked() -> None:
    """`a/../data/sessions.db` 先 resolve 再判 ⇒ 与 `data/sessions.db` 同判(拒)。"""
    result = await mcp_server._tool_read_file({"path": "a/../data/sessions.db"})
    assert result["ok"] is False
    assert result.get("errorCode") == "SENSITIVE_FILE_BLOCKED"


async def test_normal_workspace_file_is_still_readable(tmp_path: Path) -> None:
    """正向对照:普通文件照常可读(闸不是"全拒")。"""
    normal = APP_ROOT / "app" / "routers" / "health.py"
    assert normal.exists()
    result = await mcp_server._tool_read_file({"path": "app/routers/health.py"})
    assert result["ok"] is True
    assert result["content"]


async def test_plaintext_file_under_data_is_blocked_even_though_readable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`data/` 下**确实是合法 UTF-8 文本**的文件也被整目录拒。

    这条专门证明"是 denylist 在挡,不是解码失败在挡":文件本身可被 Python 读成文本,
    摘掉目录级判据后 read_file 会直接把内容返回 ⇒ 用例红。
    """
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    target = data_dir / "app_config.json"
    target.write_text('{"apiKey": "sk-live-should-not-leak"}', encoding="utf-8")
    assert target.read_text(encoding="utf-8").startswith('{"apiKey"')

    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    out = await mcp_server._tool_read_file({"path": "data/app_config.json"})
    assert out["ok"] is False
    assert out.get("errorCode") == "SENSITIVE_FILE_BLOCKED"
    assert "should-not-leak" not in out["content"]


@pytest.mark.parametrize(
    "name",
    [
        "signing_key",          # 无扩展名 `*_key`
        "checkin_fernet_key",
        "session_store.db",     # 数据库
        "state.sqlite",
        "cache.sqlite3",
        "id_rsa",               # SSH 私钥
        "id_rsa.pub",           # 同族(含前缀)
        ".env.production",      # `.env*`
        ".envrc",
    ],
)
def test_sensitive_basename_shapes(name: str, tmp_path: Path) -> None:
    assert mcp_server._is_sensitive_file(str(tmp_path / name), roots=[str(tmp_path)]) is True


def test_directory_denylist_is_first_segment_only(tmp_path: Path) -> None:
    """只判"相对根的第一段":工作区深处的同名目录不被误伤。"""
    nested = tmp_path / "src" / "data" / "fixture.json"
    nested.parent.mkdir(parents=True)
    nested.write_text("{}", encoding="utf-8")
    assert mcp_server._is_sensitive_file(str(nested), roots=[str(tmp_path)]) is False

    top = tmp_path / "data" / "fixture.json"
    top.parent.mkdir(parents=True)
    top.write_text("{}", encoding="utf-8")
    assert mcp_server._is_sensitive_file(str(top), roots=[str(tmp_path)]) is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
