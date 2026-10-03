# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""出域类命令的「前缀永久放行」禁令专项测试(2026-10-03 数据出域合规整改立)。

背景:2026-09 智谱 ZCode 未经知情把用户仓库数据传上 MaaS 引发争议,事后紧急上线
"数据内容不留存"。本仓存在两条同型出域通道,本文件钉死其中"命令执行"这一条:

  1. `git push` 原先不在 exec_policy 的 PROMPT 名单里(只有 --force 变体在),
     命中 command_policy.json 的 `git` 白名单后直接判 ALLOW ⇒ agent 可无确认
     把代码推到任意 remote/URL。已由 exec_policy.py 修复(裸 push 提为 PROMPT)。

  2. 前缀放行规则(`approve_exec_prefix` + `approval_persistence` 持久层)是
     **永久**授权机制。若它能覆盖出域命令,第 1 条的闸门可被一次性绕过,而且
     绕得比看上去宽得多:
       - 默认 tokens=2:为 `git push --force origin main` 点一次"以后都允许",
         登记的是 ("git","push") ⇒ 之后所有 git push 永久放行;
       - tokens=1 更极端:登记 ("git",) 等于给 git 全部子命令开万能钥匙。
     已由 mcp_server._NON_PERSISTABLE_PREFIXES 修复,**登记侧与匹配侧双堵**
     (匹配侧是为堵上线前已落盘的存量授权,否则整改等于没生效)。

纪律:
- 每条用例都从干净的内存表 + 隔离持久层出发,用例间不串味。
- 不触网、不执行任何真实 git;只验决策与授权登记层。
"""

from __future__ import annotations

import pytest

from app.services import mcp_server


@pytest.fixture
def srv(monkeypatch):
    """干净的 mcp_server 视图:清空内存前缀表 + 隔离持久层。"""

    class _FakeAp:
        """内存版持久层替身,复刻 grant/check 的键语义。"""

        def __init__(self) -> None:
            self.store: dict[tuple[str, str], dict] = {}

        SCOPE_ALWAYS = "always"
        KIND_EXEC_PREFIX = "exec_prefix"

        @staticmethod
        def normalize_exec_key(tokens) -> str:
            return " ".join(str(t) for t in tokens)

        def grant(self, scope, key, kind, **_kw) -> None:
            self.store[(kind, key)] = {"scope": scope}

        def check(self, key, kind, **_kw):
            return self.store.get((kind, key))

        def revoke(self, key, kind, **_kw) -> bool:
            return self.store.pop((kind, key), None) is not None

    fake = _FakeAp()
    monkeypatch.setattr(mcp_server, "approval_persistence", fake, raising=False)
    monkeypatch.setitem(
        __import__("sys").modules, "app.services.approval_persistence", fake
    )
    mcp_server._exec_allowed_prefixes.clear()
    yield mcp_server
    mcp_server._exec_allowed_prefixes.clear()


# ---------------------------------------------------------------------------
# 1. 判据本身:哪些前缀算"覆盖了出域命令"
# ---------------------------------------------------------------------------


def test_is_non_persistable_prefix_covers_all_overlap_forms():
    """两条覆盖形态都要判为不可固化。

    - 精确/更长:(git,push)、(git,push,--force)
    - 更短万能钥匙:(git,) —— 它是 (git,push) 的前缀,登记它等于一次放行一大片
    """
    assert mcp_server._is_non_persistable_prefix(("git", "push")) is True
    assert mcp_server._is_non_persistable_prefix(("git", "push", "--force")) is True
    assert mcp_server._is_non_persistable_prefix(("git",)) is True


def test_is_non_persistable_prefix_allows_normal_commands():
    """正常高频命令不得被误伤,否则审批会变成噪声,用户最终只会全点同意。"""
    for p in (
        ("pnpm", "install"),
        ("pytest",),
        ("cargo", "build"),
        ("git", "status"),
        ("git", "log"),
        ("npm", "run"),
    ):
        assert mcp_server._is_non_persistable_prefix(p) is False, f"{p} 不该被禁"


# ---------------------------------------------------------------------------
# 2. 登记侧:approve_exec_prefix 必须拒绝登记出域前缀
# ---------------------------------------------------------------------------


def test_approve_refuses_git_push_prefix(srv):
    """对 git push 登记"以后都允许"必须失败(返回 None)。"""
    assert srv.approve_exec_prefix("git push origin main", tokens=2) is None
    assert srv.approve_exec_prefix("git push --force origin main", tokens=2) is None
    assert srv.approve_exec_prefix("git push", tokens=1) is None
    # 关键:一条都不该落进内存表
    assert srv._exec_allowed_prefixes == set()


def test_approve_still_allows_normal_prefix(srv):
    """对照组:非出域命令的"以后都允许"必须照常可用(整改不能把功能打死)。"""
    assert srv.approve_exec_prefix("pnpm install --frozen-lockfile", tokens=2) == (
        "pnpm",
        "install",
    )
    assert srv._matches_exec_prefix("pnpm install --prod") is True


# ---------------------------------------------------------------------------
# 3. 匹配侧:存量持久层授权必须被堵(否则整改等于没生效)
# ---------------------------------------------------------------------------


def test_persisted_legacy_git_push_grant_is_ignored(srv):
    """**存量**遗留授权也必须失效。

    模拟本次整改上线前用户已对 git push 登记过前缀(那批记录连同 SCOPE_ALWAYS
    授权已落盘)。只堵登记侧的话,这些老规则会继续永久放行出域命令 ——
    这是本条用例存在的唯一理由,也是"登记侧+匹配侧双堵"中匹配侧的必要性证明。
    """
    ap = mcp_server.approval_persistence
    # 直接写持久层,绕开登记口(模拟历史数据)
    ap.grant(ap.SCOPE_ALWAYS, ap.normalize_exec_key(["git", "push"]), ap.KIND_EXEC_PREFIX)
    ap.grant(ap.SCOPE_ALWAYS, ap.normalize_exec_key(["git"]), ap.KIND_EXEC_PREFIX)

    assert srv._matches_exec_prefix("git push origin main") is False
    assert srv._matches_exec_prefix("git push") is False


def test_memory_table_legacy_entry_is_ignored(srv):
    """内存表里的存量 ("git",) 条目同样不得放行 git push。"""
    srv._exec_allowed_prefixes.add(("git",))
    assert srv._matches_exec_prefix("git push origin main") is False
    # 反向护栏:同一把钥匙对只读命令仍然有效(不是把功能整体打死)
    assert srv._matches_exec_prefix("git status") is True


def test_legacy_grant_still_blocks_after_restart(srv):
    """重启后(内存表清空)存量授权恢复,匹配侧仍须拦住出域命令。"""
    ap = mcp_server.approval_persistence
    ap.grant(ap.SCOPE_ALWAYS, ap.normalize_exec_key(["git", "push"]), ap.KIND_EXEC_PREFIX)
    srv._exec_allowed_prefixes.clear()  # 模拟重启
    assert srv._matches_exec_prefix("git push origin main") is False


# ---------------------------------------------------------------------------
# 4. 逐次决策权仍然保留(不把用户逼到只能全盘拒绝功能)
# ---------------------------------------------------------------------------


def test_one_shot_allow_still_works_for_git_push(srv):
    """禁令针对的是"永久放行",**不是**禁止执行。

    用户在审批弹窗里选"仅本次放行"(走一次性通道、不入前缀表)仍应能执行,
    否则就把"逐次确认"变成了"永久不可用",那是过度整改。
    """
    ap = mcp_server.approval_persistence
    ap.grant(ap.SCOPE_ALWAYS, ap.normalize_exec_key(["git", "push"]), ap.KIND_EXEC_PREFIX)
    # 一次性放行的键形态与前缀规则不同(带 once 语义),此处只验前缀表未污染:
    # 即便持久层有存量,前缀表也应保持为空 ⇒ 新的放行必须来自显式逐次决策。
    srv._exec_allowed_prefixes.clear()
    assert srv._exec_allowed_prefixes == set()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
