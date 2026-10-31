# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批 R5 回归锁(2026-10-31)。

1. db_query 只读判据:关键词黑名单从"尾随空格子串"改词边界 regex
   (`DELETE\\nFROM` / `DELETE/**/FROM` 型变体曾可绕过),并叠加 asyncpg
   READ ONLY 事务兜底(data-modifying CTE 整族结构性封死)。
2. git_operations argv 注入:position 段(ref/分支名/tag 名)以 `-` 开头
   曾被 git 当选项解析(`show --output=<path>` 写任意文件),现全部过
   _assert_safe_git_arg(拒 `-` 前缀 + 空白/控制符)。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.mcp_server import _assert_safe_git_arg


class TestDbQueryKeywordBoundary:
    def _assert_rejected(self, sql: str) -> None:
        """不连库的静态拒绝面:构造到关键词检查即返回 ok=False。"""
        from app.services.mcp_server import _tool_db_query

        result = _run_without_db(lambda: _run_db_query(sql))
        assert result["ok"] is False
        assert "禁止关键词" in (result.get("message") or "") or not result.get("ok")

    def test_newline_variant_rejected(self):
        """`DELETE<换行>FROM`(尾随空格绕过形态)必须被拒。"""
        from app.services.mcp_server import _tool_db_query

        r = asyncio.run(
            _tool_db_query({"sql": "WITH d AS (DELETE\nFROM users RETURNING *) SELECT * FROM d"})
        )
        assert r["ok"] is False
        assert "禁止关键词" in r["message"]

    def test_comment_variant_rejected(self):
        from app.services.mcp_server import _tool_db_query

        r = asyncio.run(_tool_db_query({"sql": "SELECT 1 /**/; DROP/**/TABLE users"}))
        assert r["ok"] is False

    def test_identifier_with_keyword_suffix_allowed(self):
        """正向对照:deleted_at / created_by 这类标识符不因词边界判据误杀。"""
        from app.services.mcp_server import _tool_db_query

        r = asyncio.run(
            _tool_db_query(
                {"sql": "SELECT deleted_at, updated_by FROM users WHERE email LIKE '%x%'"}
            )
        )
        # 未配置 DATABASE_URL 时走到配置检查(而非关键词拒绝)—— 判据:消息不含"禁止关键词"
        assert "禁止关键词" not in (r.get("message") or "")


def _run_without_db(fn):
    """占位:保留函数形状给后续扩展。"""
    return fn()


def _run_db_query(sql: str):
    from app.services.mcp_server import _tool_db_query

    return _tool_db_query({"sql": sql})


class TestGitArgSafety:
    def test_dash_prefix_ref_rejected(self):
        with pytest.raises(ValueError):
            _assert_safe_git_arg("--output=/etc/pwned", "ref")

    def test_ext_diff_rejected(self):
        with pytest.raises(ValueError):
            _assert_safe_git_arg("--ext-diff", "ref")

    def test_whitespace_rejected(self):
        with pytest.raises(ValueError):
            _assert_safe_git_arg("HEAD; rm -rf /", "ref")

    def test_valid_refs_pass(self):
        assert _assert_safe_git_arg("HEAD", "ref") == "HEAD"
        assert _assert_safe_git_arg("feature/ok-name_1", "分支名") == "feature/ok-name_1"
        assert _assert_safe_git_arg("v1.2.3", "tag 名") == "v1.2.3"

    def test_show_ref_reaches_assertion(self, monkeypatch):
        """show 的 ref 以 -- 开头 ⇒ 在拼 argv 前被拒(落到既有错误形状)。"""
        from app.services.mcp_server import _tool_git_operations

        r = asyncio.run(
            _tool_git_operations(
                {"action": "show", "repo": ".", "ref": "--output=/tmp/pwned.md", "__user_role": 1}
            )
        )
        assert r["ok"] is False
        assert "非法 git ref" in r["message"]
