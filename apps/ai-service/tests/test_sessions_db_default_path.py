# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""sessions router 默认 DB 路径解析测试(G-283)。

锚定判据:缺省路径必须由模块自身位置推导(`<ai-service 根>/data/sessions.db`),
不得依赖进程 cwd —— 从仓根起服务时旧实现会在工作树根部写出库文件(用户会话数据)。

隔离(§5 测试隔离铁律):本文件**不落任何盘** —— 只调 `resolve_session_db_path()`
这个纯解析函数,不调用 `get_session_store()`(单例建立会真实建库文件);
env 分支把 `SESSION_STORE_DB_PATH` 指向 pytest tmp_path,同样不创建 store。
"""

from __future__ import annotations

from pathlib import Path

from app.routers.sessions import resolve_session_db_path


def test_default_path_is_absolute_and_module_anchored(monkeypatch) -> None:
    """不带 env 时:绝对路径 == <ai-service 根>/data/sessions.db,且不随 cwd 漂移。"""
    monkeypatch.delenv("SESSION_STORE_DB_PATH", raising=False)
    app_root = Path(__file__).resolve().parents[1]  # tests/ → ai-service 根
    repo_root = app_root.parent
    # 把 cwd 挪到仓库根 —— 这正是 G-283 修的那一型(旧实现会解析成 <repo>/data/sessions.db)
    monkeypatch.chdir(repo_root)
    p = Path(resolve_session_db_path())
    assert p.is_absolute(), f"默认路径必须是绝对路径,实得: {p}"
    assert p == app_root / "data" / "sessions.db", (
        f"默认路径应锚定模块位置(routers→app→ai-service 根),实得: {p}"
    )
    # 关键反例断言:cwd 在仓库根时不得跟着走(不落 <repo>/data/)
    assert p != repo_root / "data" / "sessions.db"


def test_env_override_fully_honored(monkeypatch, tmp_path: Path) -> None:
    """带 env SESSION_STORE_DB_PATH 时:完全采用 env 值(既有语义回归锁)。"""
    override = tmp_path / "env_override.db"
    monkeypatch.setenv("SESSION_STORE_DB_PATH", str(override))
    assert resolve_session_db_path() == str(override)
