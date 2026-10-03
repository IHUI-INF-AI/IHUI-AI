# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""设置写入 → 同意闸的接线测试(2026-10-03 数据出域合规整改,第二轮)。

背景:隐私页的 `codeIndexEgressOptOut` 之前是**全仓零引用**的假开关 —— 前端写进
`user_preferences`,而闸门在另一个进程读它自己那份 `.data`,于是用户点完什么都没变。
本文件钉住接线后的语义,重点是三件容易做错的事:

  1. **极性**:偏好键是 opt-out(`true` = 阻止),同意表 `granted` 是 opt-in
     (`true` = 允许)。两者相反,转换只在 `apply_user_opt_out` 一处。
  2. **`opted_out=False` 绝不等于 `grant()`**:它只清掉表态,回到"未表态"。
     若把它写成 grant,用户 merely 表达过"我不想阻止"就被记成"他授权了代码出域" ——
     那是把缺省当同意,方向与本模块 fail-closed 第一原则相反。
  3. **默认行为不变**:缺省(用户从没碰过开关)根本不会调到这里,闸门维持默认拒绝。

纪律:全用 tmp_path 隔离持久层,不写真实 .data/。
"""

from __future__ import annotations

import pytest

from app.services import code_index_consent as cic


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    persist = str(tmp_path / "consent.json")
    monkeypatch.setattr(cic, "_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(cic, "_PERSIST_PATH", persist)
    monkeypatch.delenv(cic.ENV_GLOBAL_DEFAULT, raising=False)
    cic.reset_for_tests()
    yield persist
    cic.reset_for_tests()


# ===========================================================================
# 1. 极性:opt-out 键 ⇒ 同意表
# ===========================================================================


def test_opt_out_true_means_denied():
    """`codeIndexEgressOptOut='true'`(用户要求阻止)⇒ 显式拒绝。"""
    cic.apply_user_opt_out("u1", True)
    assert cic.has_consent("u1") is False
    st = cic.get_state("u1")
    assert st.granted is False, "必须是显式 False(不是 None),否则全局开启会把它盖回去"
    assert st.source == "user_settings"


def test_opt_out_false_does_not_grant():
    """⚠ 核心极性钉:`opted_out=False`(**不**阻止)**不是**授权出域。

    它只清掉表态、回到"未表态"。若实现写成 grant(),用户 merely 表达过
    "我不想阻止"这件事,就被记成"他授权把源码发往外部服务" ——
    这是把"缺省"读成"同意",与本模块存在的理由正好相反。
    """
    cic.apply_user_opt_out("u1", False)
    st = cic.get_state("u1")
    assert st.granted is None, "未表态必须是 None;True 意味着用户被记成了已授权(事故)"
    assert cic.has_consent("u1") is False, "未表态 + 无全局默认 ⇒ 默认拒绝"


def test_opt_out_false_returns_user_to_undecided_not_to_consent():
    """先阻止、再取消阻止 ⇒ 回到"未表态",且能重新受全局默认影响。"""
    cic.apply_user_opt_out("u1", True)
    assert cic.has_consent("u1") is False
    cic.apply_user_opt_out("u1", False)
    assert cic.get_state("u1").granted is None
    # 关键:取消阻止之后,全局默认重新起作用(证明是"清表态"而不是"记成同意")
    cic.set_global_default(True)
    assert cic.has_consent("u1") is True


# ===========================================================================
# 2. 与全局默认的叠加(逐用户永远更强)
# ===========================================================================


def test_opt_out_beats_global_enabled():
    """全局开启 + 用户阻止 ⇒ 仍拒绝。这条是"假开关"修好后的核心保证。"""
    cic.set_global_default(True)
    cic.apply_user_opt_out("u1", True)
    assert cic.has_consent("u1") is False, "用户的显式关闭不得被全局默认覆盖回去"


def test_opt_in_flow_unaffected_by_new_entry_point():
    """走 opt-out=false 之后,原有的 grant 路径仍工作(新入口没改老语义)。"""
    cic.apply_user_opt_out("u1", False)  # 回到未表态
    cic.grant("u1", source="cli_flag")
    assert cic.has_consent("u1") is True
    assert cic.get_state("u1").source == "cli_flag"


def test_default_unchanged_when_user_never_touches_switch():
    """缺省行为不变:用户从没碰过这个开关 ⇒ 闸门维持"默认拒绝"。

    这条对应任务书的"默认行为不变":`apply_user_opt_out` 只在设置被写入时
    才被调用,不写就等于没发生过。
    """
    assert cic.has_consent("u1") is False
    cic.set_global_default(True)
    assert cic.has_consent("u2") is True, "全局开启时,没表态的用户按全局走"


# ===========================================================================
# 3. 落盘与进程重启
# ===========================================================================


def test_opt_out_survives_process_restart():
    """阻止决定必须落盘:否则重启后闸门静默失效,代码又开始外发。"""
    cic.apply_user_opt_out("u1", True)
    cic.reset_for_tests()  # 模拟重启
    assert cic.has_consent("u1") is False
    assert cic.get_state("u1").granted is False


def test_cleared_statement_survives_restart_as_undecided():
    """清掉的表态重启后仍是"未表态" —— 落盘形态必须是"键消失",不是 granted=None。

    `_load` 逐条只接受 bool 型的 granted,`None` 会被当非法值跳过 ⇒ 存了也读不出来,
    是一个骗人的落库形态。这里断言的是"重启后 get_state 仍报 None"。
    """
    cic.apply_user_opt_out("u1", True)
    cic.apply_user_opt_out("u1", False)
    cic.reset_for_tests()
    assert cic.get_state("u1").granted is None
    assert "u1" not in cic._store.users, "清表态应删掉条目,而不是留一条 granted=None"


def test_clearing_absent_statement_is_idempotent():
    """清一个从未表态过的用户不报错(设置页是读-改-写,重放很常见)。"""
    cic.apply_user_opt_out("never-touched", False)
    cic.apply_user_opt_out("never-touched", False)  # 重放
    assert cic.get_state("never-touched").granted is None


def test_apply_user_opt_out_requires_user_id():
    """无法归属的表态必须报错,否则同意表会被空 user_id 污染。"""
    for opted_out in (True, False):
        with pytest.raises(ValueError):
            cic.apply_user_opt_out("", opted_out)


def test_opt_out_and_opt_out_true_are_isolated_per_user():
    """一人阻止不代表另一人阻止(per-user 隔离)。"""
    cic.set_global_default(True)  # 放行全局,只有显式阻止能压过它
    cic.apply_user_opt_out("u-blocked", True)
    assert cic.has_consent("u-blocked") is False
    assert cic.has_consent("u-other") is True, "不得跨用户泄漏"


# ===========================================================================
# 4. 接线端到端:mcp_server 的两处闸门真的读得到
# ===========================================================================


def test_gate_refuses_after_user_opts_out():
    """端到端:用户关掉开关 ⇒ `_code_index_egress_allowed` 立刻变 False。

    这条是"接线真的生效"的判据:不是"设置存进库了",而是**闸门**改判了。
    """
    from app.services import mcp_server

    cic.set_global_default(True)  # 先让全局开着,确保下面的 False 来自用户决定
    assert mcp_server._code_index_egress_allowed("u1") is True

    cic.apply_user_opt_out("u1", True)
    assert mcp_server._code_index_egress_allowed("u1") is False


async def test_tool_index_codebase_refuses_after_opt_out(tmp_path):
    """端到端:opt-out 后 `index_codebase` 不碰索引器(更谈不上外发)。"""
    from app.services import mcp_server

    called = {"n": 0}

    class _Indexer:
        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            called["n"] += 1
            return None

    import app.services.codebase_indexer as idx_mod

    orig = idx_mod.codebase_indexer
    idx_mod.codebase_indexer = _Indexer()
    try:
        out = await mcp_server._tool_index_codebase(
            {"path": str(tmp_path), "__user_id": "u1"}
        )
    finally:
        idx_mod.codebase_indexer = orig

    assert out["ok"] is False
    assert out["skipped"] == "not-consented"
    assert called["n"] == 0


async def test_lazy_index_gate_refuses_after_opt_out(tmp_path):
    """端到端:opt-out 后懒索引走 skipped-not-consented 分支,不建索引。"""
    from app.services import mcp_server

    class _Indexer:
        def __init__(self) -> None:
            self.indexed = 0

        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            self.indexed += 1
            return None

        async def search(self, *_a, **_kw):  # noqa: ANN001
            return []

    ws = tmp_path / "ws"
    ws.mkdir()
    (ws / "a.py").write_text("def f():\n    return 1\n", encoding="utf-8")

    ix = _Indexer()
    out = await mcp_server._lazy_index_and_research(
        query="f", path=str(ws), max_results=5, indexer=ix, internal_user_id="u1"
    )
    assert out.status == "skipped-not-consented"
    assert ix.indexed == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
