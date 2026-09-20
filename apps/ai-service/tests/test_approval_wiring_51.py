# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:watermark-placeholder

"""批 51b 接线测试:mcp_server 审批放行 × approval_persistence 双写/恢复语义。

对标 codex PERSIST_SESSION/PERSIST_ALWAYS + ApprovalCacheKey:
- approve_exec_command / approve_exec_prefix 登记时双写持久层(always 档);
- 进程重启模拟 = 清空内存表后,_matches_exec_prefix 仍经持久层放行;
- revoke_exec_prefix 同步撤销持久层;
- 持久层故障时 fail-closed(视为未命中,绝不放松审批)。
"""

from __future__ import annotations

import pytest


@pytest.fixture()
def mcp(monkeypatch, tmp_path):
    """独立 db 路径 + 重新导入 mcp_server 与持久层(隔离全局单例)。"""
    from pathlib import Path

    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1]))
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "grants.db")
    yield ap
    ap.close()
    # 恢复默认路径:close 只关连接,不重置路径;泄漏会使后续测试的
    # grant/check 落到本文件的 tmp db(tmp 目录在本次 pytest 运行内仍存在)
    ap.set_db_path(ap.DEFAULT_DB_PATH)


def _fresh_mcp():
    """清空审批内存表得到干净状态。

    注:不能用 importlib.reload —— reload 会原地覆盖模块 __dict__,
    使其他测试文件在 collection 时绑定的 _PR_DIFF_CACHE/_ARTIFACTS_CACHE
    等模块级全局失效(全量跑时的顺序性污染)。清空两张内存表 +
    fixture 的 tmp db 隔离即可等效"干净全局"。
    """
    from app.services import mcp_server

    mcp_server._exec_approved_commands.clear()
    mcp_server._exec_allowed_prefixes.clear()
    return mcp_server


def test_once_grant_persists_to_always_scope(mcp):
    mcp_server = _fresh_mcp()
    mcp_server.approve_exec_command("git push --force")
    rows = mcp.stats()
    assert rows["byKind"].get("exec_once", 0) >= 1


def test_prefix_grant_persists_and_survives_memory_reset(mcp):
    mcp_server = _fresh_mcp()
    prefix = mcp_server.approve_exec_prefix("git push --force", tokens=2)
    assert prefix is not None
    # 模拟重启:清空内存表
    mcp_server._exec_allowed_prefixes.clear()
    assert mcp_server._matches_exec_prefix("git push origin main") is True


def test_prefix_miss_after_memory_reset_without_persistence(mcp):
    mcp_server = _fresh_mcp()
    # 持久层为空:仅内存表登记,清空后必须不再放行(fail-closed 语义的另一面:
    # 没登记过就是没授权)。用一条从未登记过的命令验证。
    mcp_server.approve_exec_prefix("pnpm install", tokens=2)
    mcp_server._exec_allowed_prefixes.clear()
    assert mcp_server._matches_exec_prefix("cargo build --release") is False
    # 但已登记的命令在持久层仍命中(重启恢复语义,与上一测试呼应)
    assert mcp_server._matches_exec_prefix("pnpm install --frozen-lockfile") is True


def test_revoke_clears_persistence(mcp):
    mcp_server = _fresh_mcp()
    mcp_server.approve_exec_prefix("pytest -q", tokens=1)
    assert mcp_server._matches_exec_prefix("pytest tests/foo.py") is True
    assert mcp_server.revoke_exec_prefix(["pytest"]) is True
    mcp_server._exec_allowed_prefixes.clear()
    assert mcp_server._matches_exec_prefix("pytest tests/foo.py") is False


def test_persistence_failure_is_fail_closed(mcp, monkeypatch):
    mcp_server = _fresh_mcp()
    mcp_server.approve_exec_prefix("cargo build", tokens=2)

    def _boom(*a, **k):
        raise RuntimeError("db gone")

    monkeypatch.setattr(mcp, "check", _boom)
    mcp_server._exec_allowed_prefixes.clear()
    # 持久层异常 → 视为未命中(不抛、不放松)
    assert mcp_server._matches_exec_prefix("cargo build --release") is False


def test_once_key_matches_normalized_form(mcp):
    mcp_server = _fresh_mcp()
    mcp_server.approve_exec_command("git status")
    # 一次性放行仍由内存表消费(键为规范化形态),持久层只做底账。
    # 注:规范化不剥 sudo(env/sudo 剥离是 normalize_exec_key 的语义,
    # 审批键走 command_canonicalization),故 sudo 前缀命令是不同的键。
    assert mcp_server._consume_exec_approval("git status") is True
    # 持久层底账:同键 always 记录在案
    assert mcp.check(mcp_server._canonical_approval_key("git status"), "exec_once") is not None
