# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""代码索引出域同意闸专项测试(2026-10-03 数据出域合规整改立)。

被测对象:
  - `app.services.code_index_consent` —— 同意判定/登记/撤销(fail-closed + 原子落盘)
  - `mcp_server._code_index_egress_allowed` —— 归属保障(不接受自称授权)
  - `mcp_server._lazy_index_search` 的同意闸分支 —— 未授权时不建索引
  - `mcp_server._tool_index_codebase` 的同意闸分支 —— 未授权时不碰文件

背景:语义索引会把**源码切片**送外部 embedding 服务
(`codebase_indexer._generate_embeddings_batch` → `llm_gateway.embed` →
`litellm.aembedding`)。整改前这条外发路径无任何同意闸,用户没做任何动作、
agent 一次 search_codebase 就会触发懒索引外发整个仓库 —— 与 2026-09 智谱
ZCode 事件同型。故本文件把"默认拒绝 + 显式授权才出域 + 异常倒向不出域"钉死。

纪律:全用 tmp_path 隔离持久层,不写真实 .data/。
"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import code_index_consent as cic

# ---------------------------------------------------------------------------
# 夹具:把持久层指向 tmp,并重置进程内状态
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    """每个用例独立的同意存储文件 + 干净的进程内状态 + 清空 env。"""
    persist = str(tmp_path / "consent.json")
    monkeypatch.setattr(cic, "_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(cic, "_PERSIST_PATH", persist)
    monkeypatch.delenv(cic.ENV_GLOBAL_DEFAULT, raising=False)
    cic.reset_for_tests()
    yield persist
    cic.reset_for_tests()


# ===========================================================================
# 1. 默认拒绝(整改的核心期望值)
# ===========================================================================


def test_default_is_denied():
    """从未表态 ⇒ 不同意。这是最重要的一条。"""
    assert cic.has_consent("user-1") is False
    assert cic.has_consent("user-1") is False  # 幂等
    # 未登录态同样拒绝
    assert cic.has_consent(None) is False
    assert cic.has_consent("") is False


def test_get_state_reports_undecided():
    """未表态时 granted 为 None(区别于显式 False),便于 UI 区分三态。"""
    st = cic.get_state("user-1")
    assert st.granted is None
    assert st.decided_at is None


# ===========================================================================
# 2. 显式同意/撤销
# ===========================================================================


def test_grant_then_has_consent():
    cic.grant("user-1")
    assert cic.has_consent("user-1") is True
    st = cic.get_state("user-1")
    assert st.granted is True
    assert st.decided_at, "应记录表态时间(审计/举证用)"
    assert st.source == "user_settings"


def test_revoke_after_grant():
    cic.grant("user-1")
    cic.revoke("user-1")
    assert cic.has_consent("user-1") is False
    assert cic.get_state("user-1").granted is False


def test_grant_and_revoke_require_user_id():
    """无法归属的同意/撤销必须报错,否则全局表会被一条空 user_id 污染。"""
    for fn in (cic.grant, cic.revoke):
        with pytest.raises(ValueError):
            fn("")


def test_consent_is_per_user_isolated():
    """A 同意不代表 B 同意(per-user 隔离,防止一人授权全站放行)。"""
    cic.grant("user-a")
    assert cic.has_consent("user-a") is True
    assert cic.has_consent("user-b") is False
    assert cic.has_consent(None) is False


# ===========================================================================
# 3. 全局默认 vs 逐用户决定(逐用户永远更强)
# ===========================================================================


def test_global_default_true_grants_undecided_users():
    cic.set_global_default(True)
    assert cic.has_consent("user-1") is True


def test_explicit_user_revoke_beats_global_default():
    """逐用户显式关闭必须压过全局开启(与 2026-10-03 wiki 闸同一纪律:
    「逐次/逐用户的拒绝永远强于任何全局默认」)。"""
    cic.set_global_default(True)
    cic.revoke("user-1")
    assert cic.has_consent("user-1") is False, "用户的显式关闭不得被全局默认覆盖回去"


def test_env_global_default_used_when_unset(monkeypatch):
    """持久层未设全局默认时,读 env(只有字面量 "1" 为真)。"""
    monkeypatch.setenv(cic.ENV_GLOBAL_DEFAULT, "1")
    assert cic.global_default() is True
    assert cic.has_consent("user-1") is True

    monkeypatch.setenv(cic.ENV_GLOBAL_DEFAULT, "true")  # 模糊取值不算开启
    cic.reset_for_tests()
    assert cic.global_default() is False


def test_persisted_global_default_beats_env(monkeypatch):
    """持久化的全局默认优先于 env(部署方在 UI 里改的应当压过环境变量)。"""
    cic.set_global_default(False)
    monkeypatch.setenv(cic.ENV_GLOBAL_DEFAULT, "1")
    cic.reset_for_tests()  # 强制重读盘
    assert cic.global_default() is False
    assert cic.has_consent("user-1") is False


# ===========================================================================
# 4. 持久化(重启不丢)与 fail-closed
# ===========================================================================


def test_consent_survives_process_restart(_isolated_store):
    """同意必须落盘:进程重启后仍生效(否则用户每次重启都要重授权)。"""
    cic.grant("user-1")
    cic.reset_for_tests()  # 模拟重启
    assert cic.has_consent("user-1") is True


def test_revoke_survives_process_restart(_isolated_store):
    """撤销同样要落盘(只存同意不存撤销 = 撤不回隐私授权,不可接受)。"""
    cic.revoke("user-1")
    cic.reset_for_tests()
    assert cic.has_consent("user-1") is False


def test_persisted_file_shape(_isolated_store):
    """落盘文件形状:version + global_default + users(便于日后迁移)。"""
    cic.grant("user-1", source="cli_flag")
    with open(_isolated_store, encoding="utf-8") as fh:
        raw = json.load(fh)
    assert raw["version"] == cic._SCHEMA_VERSION
    assert raw["users"]["user-1"]["granted"] is True
    assert raw["users"]["user-1"]["source"] == "cli_flag"


def test_corrupt_file_fails_closed(_isolated_store):
    """同意记录损坏 ⇒ 一律按"未同意"处理(fail-closed),绝不因为读不到就放行。"""
    with open(_isolated_store, "w", encoding="utf-8") as fh:
        fh.write("{ this is not json ")
    cic.reset_for_tests()
    assert cic.has_consent("user-1") is False
    assert cic.has_consent(None) is False


def test_file_missing_fails_closed(_isolated_store):
    """同意文件不存在(= 从未表态过)⇒ 未同意。"""
    cic.reset_for_tests()
    assert not Path(_isolated_store).exists()
    assert cic.has_consent("user-1") is False


def test_illegal_entry_values_are_ignored(_isolated_store):
    """非法字段值不得被当成"已授权" —— 逐条过滤,只接受 bool。"""
    with open(_isolated_store, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "version": 1,
                "users": {
                    "u-str": {"granted": "true"},  # 字符串,非 bool
                    "u-int": {"granted": 1},  # 数字,非 bool
                    "u-ok": {"granted": True},
                },
            },
            fh,
        )
    cic.reset_for_tests()
    assert cic.has_consent("u-str") is False
    assert cic.has_consent("u-int") is False
    assert cic.has_consent("u-ok") is True


def test_persist_failure_does_not_raise(tmp_path, monkeypatch):
    """落盘失败不得抛(热路径不能因同意存储坏掉而崩),且必须仍 fail-closed。

    走真实路径:把 _DATA_DIR 指到一个**已存在的普通文件**上 —— os.makedirs 必然
    抛 FileExistsError(OSError 子类),由 _persist_locked 内部自己捕获。
    这才是在测"落盘失败"这个真实场景;早先版本把整个 _persist_locked 替换成
    会抛的替身,等于把被测逻辑一起删掉,测不出任何东西(它只证明了 grant 会调用
    那个函数,没证明失败被吞得住)。
    """
    import app.services.code_index_consent as mod

    blocker = tmp_path / "i_am_a_file_not_a_dir"
    blocker.write_text("x", encoding="utf-8")
    monkeypatch.setattr(mod, "_DATA_DIR", str(blocker))
    monkeypatch.setattr(mod, "_PERSIST_PATH", str(blocker / "c.json"))
    mod.reset_for_tests()

    mod.grant("user-1", persist=True)  # 不抛:失败被内部 try 吞掉
    assert mod.has_consent("user-1") is True, "本进程内内存表仍生效"
    mod.reset_for_tests()  # 模拟重启
    assert mod.has_consent("user-1") is False, "重启后落盘没成功 ⇒ 回到未同意(fail-closed)"


# ===========================================================================
# 5. mcp_server 接线:归属保障 + 两处闸门
# ===========================================================================


def test_egress_helper_denies_by_default():
    from app.services import mcp_server

    assert mcp_server._code_index_egress_allowed("nobody") is False
    assert mcp_server._code_index_egress_allowed(None) is False


def test_egress_helper_follows_consent():
    from app.services import mcp_server

    cic.grant("u1")
    assert mcp_server._code_index_egress_allowed("u1") is True
    assert mcp_server._code_index_egress_allowed("u2") is False, "同意不得跨用户泄漏"


def test_egress_helper_fails_closed_on_error(monkeypatch):
    """同意存储整体异常时,mcp_server 侧也必须倒向"不出域"。"""

    class _Boom:
        def has_consent(self, _uid):  # noqa: ANN001
            raise RuntimeError("store down")

    monkeypatch.setattr("app.services.code_index_consent.has_consent", _Boom().has_consent)
    from app.services import mcp_server

    assert mcp_server._code_index_egress_allowed("u1") is False


async def test_tool_index_codebase_refuses_when_not_consented():
    """未授权时 index_codebase 直接拒,且**不碰任何文件**。"""
    from app.services import mcp_server

    called = {"n": 0}

    class _Indexer:
        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            called["n"] += 1
            return SimpleNamespace(errors=[], repo_id="r", files_scanned=0, files_indexed=0,
                                   files_unchanged=0, files_deleted=0, chunks_created=0,
                                   chunks_vectorized=0, merkle_root="")

    class _Fake:
        codebase_indexer = _Indexer()

    import app.services.codebase_indexer as idx_mod

    orig = idx_mod.codebase_indexer
    idx_mod.codebase_indexer = _Fake.codebase_indexer
    try:
        out = await mcp_server._tool_index_codebase({"path": ".", "__user_id": "nobody"})
    finally:
        idx_mod.codebase_indexer = orig

    assert out["ok"] is False
    assert out["skipped"] == "not-consented"
    assert called["n"] == 0, "未授权时绝不能触碰索引器(更谈不上外发代码)"


async def test_tool_index_codebase_proceeds_after_grant():
    """已授权时正常放行(闸门不能把功能打死)。"""
    from app.services import mcp_server

    cic.grant("u1")

    class _Indexer:
        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            return SimpleNamespace(errors=[], repo_id="r", files_scanned=3, files_indexed=3,
                                   files_unchanged=0, files_deleted=0, chunks_created=5,
                                   chunks_vectorized=5, merkle_root="m")

    import app.services.codebase_indexer as idx_mod

    orig = idx_mod.codebase_indexer
    idx_mod.codebase_indexer = _Indexer()
    try:
        out = await mcp_server._tool_index_codebase({"path": ".", "__user_id": "u1"})
    finally:
        idx_mod.codebase_indexer = orig

    assert out["ok"] is True
    assert out["files_indexed"] == 3


async def test_tool_index_codebase_no_consent_flag_in_arguments():
    """**不接受**调用方自称已授权 —— 授权只认服务端 per-user 记录。

    这条钉的是防伪造:若将来有人加一个 `consent=true` 入参,任何 agent 都能
    给自己造授权,闸门形同虚设。
    """
    from app.services import mcp_server

    called = {"n": 0}

    class _Indexer:
        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            called["n"] += 1
            return SimpleNamespace(errors=[], repo_id="r", files_scanned=1, files_indexed=1,
                                   files_unchanged=0, files_deleted=0, chunks_created=1,
                                   chunks_vectorized=1, merkle_root="m")

    import app.services.codebase_indexer as idx_mod

    orig = idx_mod.codebase_indexer
    idx_mod.codebase_indexer = _Indexer()
    try:
        # 调用方自称已授权 + 自称 admin,均无效
        out = await mcp_server._tool_index_codebase(
            {"path": ".", "__user_id": "nobody", "consent": True,
             "i_agree": True, "admin": True}
        )
    finally:
        idx_mod.codebase_indexer = orig

    assert out["ok"] is False
    assert out["skipped"] == "not-consented"
    assert called["n"] == 0


async def test_lazy_index_gate_returns_not_consented(tmp_path):
    """懒索引在未授权时给出 skipped-not-consented,且不调用 index_repository。"""
    from app.services import mcp_server

    called = {"n": 0}

    class _Indexer:
        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            called["n"] += 1
            return None

        async def search(self, *_a, **_kw):  # noqa: ANN001
            return []

    ws = tmp_path / "ws"
    ws.mkdir()
    (ws / "a.py").write_text("def f():\n    return 1\n", encoding="utf-8")

    out = await mcp_server._lazy_index_and_research(
        query="f", path=str(ws), max_results=5,
        indexer=_Indexer(), internal_user_id="nobody",
    )

    assert out.status == "skipped-not-consented"
    assert out.results == []
    assert called["n"] == 0, "未授权时绝不能建索引"
    assert out.reason, "必须给出可读理由(供调用方投影进响应)"


async def test_lazy_index_gate_allows_after_grant(tmp_path):
    """已授权时懒索引正常执行(闸门不能把语义检索打死)。"""
    from app.services import mcp_server

    cic.grant("u1")

    class _Indexer:
        def __init__(self) -> None:
            self.indexed = 0

        async def index_repository(self, *_a, **_kw):  # noqa: ANN001
            self.indexed += 1
            return None

        async def search(self, *_a, **_kw):  # noqa: ANN001
            return [{"file": "a.py", "line": 1, "text": "def f"}]

    ws = tmp_path / "ws"
    ws.mkdir()
    (ws / "a.py").write_text("def f():\n    return 1\n", encoding="utf-8")

    ix = _Indexer()
    out = await mcp_server._lazy_index_and_research(
        query="f", path=str(ws), max_results=5,
        indexer=ix, internal_user_id="u1",
    )

    assert out.status == "searched"
    assert ix.indexed == 1
    assert out.results, "已授权时应拿到结果"


def test_not_consented_status_projects_into_response():
    """新状态格必须能被 as_response_field 投影(契约要求每格都带 reason)。"""
    from app.services import mcp_server

    out = lazy = mcp_server.LazyIndexOutcome(
        results=[], status="skipped-not-consented", reason="未授权"
    )
    field = lazy.as_response_field()
    assert field["status"] == "skipped-not-consented"
    assert field["reason"] == "未授权"
    assert out is lazy
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
