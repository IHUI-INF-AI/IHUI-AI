# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 51 审批持久化模块测试(纯同步,对标 codex approvals.rs 两级 scope)。

覆盖:
① grant + check 命中 always
② session 级命中(无过期)
③ session 级过期后返回 None 且记录被删
④ revoke 后不命中
⑤ normalize_exec_key:sudo 前缀剥离 / env 前缀剥离 / 大小写归一
⑥ grant 幂等(重复 grant 不报错不重复)
⑦ stats / purge_expired 计数正确
"""

from __future__ import annotations

import pytest

from app.services import approval_persistence as ap


@pytest.fixture(autouse=True)
def _isolate_db(tmp_path):
    """每个测试注入独立 db 路径并隔离(测试不污染 data/ 默认库)。"""
    ap.set_db_path(tmp_path / "approval_grants.db")
    yield
    ap.close()


# =============================================================================
# ① always 级命中
# =============================================================================


def test_grant_check_always():
    ap.grant(ap.SCOPE_ALWAYS, "git:push", ap.KIND_EXEC_PREFIX)
    assert ap.check("git:push", ap.KIND_EXEC_PREFIX) == ap.SCOPE_ALWAYS
    # 再次 check 仍命中(永久)
    assert ap.check("git:push", ap.KIND_EXEC_PREFIX) == ap.SCOPE_ALWAYS


# =============================================================================
# ② session 级命中(无过期)
# =============================================================================


def test_grant_check_session():
    ap.grant(ap.SCOPE_SESSION, "pytest", ap.KIND_EXEC_ONCE)
    assert ap.check("pytest", ap.KIND_EXEC_ONCE) == ap.SCOPE_SESSION
    # session 级未过期应持续命中
    assert ap.check("pytest", ap.KIND_EXEC_ONCE) == ap.SCOPE_SESSION


# =============================================================================
# ③ session 级过期后返回 None 且记录被删
# =============================================================================


def test_session_expired_returns_none_and_deleted():
    # ttl_seconds=0 → expires_at 落在本秒;check 时已过本秒(或同秒等值比较
    # expires > now 为 False),确定性过期,无需 sleep。
    ap.grant(ap.SCOPE_SESSION, "tmp:cmd", ap.KIND_EXEC_ONCE, ttl_seconds=0)
    assert ap.check("tmp:cmd", ap.KIND_EXEC_ONCE) is None
    # 记录已被清理
    assert ap.stats()["total"] == 0


# =============================================================================
# ④ revoke 后不命中
# =============================================================================


def test_revoke_clears_both_scopes():
    key, kind = "rm:rf", ap.KIND_EXEC_ONCE
    ap.grant(ap.SCOPE_ALWAYS, key, kind)
    ap.grant(ap.SCOPE_SESSION, key, kind)
    assert ap.check(key, kind) == ap.SCOPE_ALWAYS  # always 优先
    ap.revoke(key, kind)
    assert ap.check(key, kind) is None


# =============================================================================
# ⑤ normalize_exec_key
# =============================================================================


def test_normalize_strips_sudo():
    assert ap.normalize_exec_key(["SUDO", "Git", "Status"]) == "git\x1fstatus"


def test_normalize_strips_env_prefix():
    assert ap.normalize_exec_key(["FOO=bar", "Git", "Status"]) == "git\x1fstatus"


def test_normalize_case_fold():
    assert ap.normalize_exec_key(["Git", "Status"]) == "git\x1fstatus"


def test_normalize_env_then_sudo_then_cmd():
    # 连续 env 赋值 + sudo 前缀都应被剥去
    assert ap.normalize_exec_key(["FOO=1", "BAR=2", "sudo", "Git", "Status"]) == (
        "git\x1fstatus"
    )


# =============================================================================
# ⑥ grant 幂等
# =============================================================================


def test_grant_idempotent():
    ap.grant(ap.SCOPE_ALWAYS, "k", ap.KIND_MCP_TOOL)
    ap.grant(ap.SCOPE_ALWAYS, "k", ap.KIND_MCP_TOOL)  # 不应报错/重复
    ap.grant(ap.SCOPE_ALWAYS, "k", ap.KIND_MCP_TOOL)
    assert ap.stats()["total"] == 1
    assert ap.stats()["byKind"][ap.KIND_MCP_TOOL] == 1


# =============================================================================
# ⑦ stats / purge_expired 计数
# =============================================================================


def test_stats_counts():
    ap.grant(ap.SCOPE_ALWAYS, "a", ap.KIND_EXEC_PREFIX)
    ap.grant(ap.SCOPE_SESSION, "b", ap.KIND_EXEC_ONCE)
    ap.grant(ap.SCOPE_SESSION, "c", ap.KIND_MCP_TOOL)
    s = ap.stats()
    assert s["total"] == 3
    assert s["byScope"][ap.SCOPE_ALWAYS] == 1
    assert s["byScope"][ap.SCOPE_SESSION] == 2
    assert s["byKind"][ap.KIND_EXEC_PREFIX] == 1
    assert s["byKind"][ap.KIND_EXEC_ONCE] == 1
    assert s["byKind"][ap.KIND_MCP_TOOL] == 1


def test_purge_expired_counts():
    # 2 条已过期 session(ttl=0) + 1 条未过期 session + 1 条 always
    ap.grant(ap.SCOPE_SESSION, "e1", ap.KIND_EXEC_ONCE, ttl_seconds=0)
    ap.grant(ap.SCOPE_SESSION, "e2", ap.KIND_EXEC_ONCE, ttl_seconds=0)
    ap.grant(ap.SCOPE_SESSION, "live", ap.KIND_EXEC_ONCE)  # 无过期
    ap.grant(ap.SCOPE_ALWAYS, "perm", ap.KIND_MCP_TOOL)
    assert ap.stats()["total"] == 4

    deleted = ap.purge_expired()
    assert deleted == 2  # 仅两条过期 session 被清

    s = ap.stats()
    assert s["total"] == 2
    assert s["byScope"][ap.SCOPE_ALWAYS] == 1
    assert s["byScope"][ap.SCOPE_SESSION] == 1
    # 未过期的 session 仍在
    assert ap.check("live", ap.KIND_EXEC_ONCE) == ap.SCOPE_SESSION
