# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨进程同意同步端点的身份与极性测试(2026-10-03 数据出域合规整改,第二轮)。

被测对象:
  - `app.routers.code_index_consent_api` —— api 把用户开关推给 ai-service 的通道
  - `code_index_consent.preload_opt_outs_from_db` —— 启动自愈(容器重建不丢闸门)

为什么这组测试重要
------------------
同步端点是**唯一**能在线把"用户已关闭代码出域"写进同意表的入口。身份一旦破了,
后果不是"多一个功能",而是**任意用户可被伪造为已授权出域** —— 直接击穿
`code_index_consent` 存在的理由。故此处钉四件事:

  1. **身份只来自 JWT**:请求模型里**没有** `user_id` 字段。这是结构判据,比
     "运行时忽略 body 里的 user_id"更强 —— 后者可能被下一个人"顺手用上"。
     (共享密钥方案里,任何持有密钥的进程都能给任意 user_id 写"已授权";
     本实现第一版就是共享密钥,实测被 JWT 中间件 401 挡在路由之前,见端点文件头。)
  2. 解析不到身份 ⇒ 401(由 `require_request_user_id` 承担)。
  3. 极性:`opted_out=False` 只清表态,**绝不** `grant()`。
  4. 启动自愈的降级方向:读库失败**不得**擦掉已登记的拒绝(必须倒向"不出域")。
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace

import pytest

from app.routers import code_index_consent_api as mod
from app.services import code_index_consent as cic


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    persist = str(tmp_path / "consent.json")
    monkeypatch.setattr(cic, "_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(cic, "_PERSIST_PATH", persist)
    monkeypatch.delenv(cic.ENV_GLOBAL_DEFAULT, raising=False)
    cic.reset_for_tests()
    yield
    cic.reset_for_tests()


def _payload(opted_out: bool) -> mod.ConsentSyncRequest:
    return mod.ConsentSyncRequest(opted_out=opted_out)


# ===========================================================================
# 1. 身份:只来自 JWT,body 不许自称
# ===========================================================================


def test_request_model_has_no_user_id_field():
    """结构判据:同步请求模型**没有** user_id 字段。

    字段根本不存在 ⇒ 下一个想加它的人必须显式改这个模型并被 review 看见。
    """
    assert "user_id" not in mod.ConsentSyncRequest.model_fields


def test_endpoints_take_user_id_from_dependency_not_from_caller():
    """两个端点的 user_id 都是 `Depends(require_request_user_id)`,不是入参。"""
    from fastapi import params as fastapi_params

    for fn in (mod.sync_own_consent, mod.read_own_consent_state):
        sig = inspect.signature(fn)
        params = sig.parameters
        assert "user_id" in params, f"{fn.__name__} 缺少 user_id 依赖"
        default = params["user_id"].default
        assert isinstance(default, fastapi_params.Depends), (
            f"{fn.__name__} 的 user_id 不是 Depends 默认值(实际 {type(default).__name__})"
        )
        # 依赖的落点就是 require_request_user_id 本身,不是某个匿名包装
        assert default.dependency is not None, f"{fn.__name__} 的依赖没有指定 callable"


def test_state_endpoint_takes_no_arbitrary_user_id_parameter():
    """只读端点不接受"查别人"的口子:签名里没有可选的 user_id 查询参数。"""
    params = inspect.signature(mod.read_own_consent_state).parameters
    # 唯一的 user_id 是那个依赖默认值,不是用户可传的 query/path 参数
    assert list(params) == ["user_id"]


async def test_missing_identity_is_401_when_auth_enforced(monkeypatch):
    """解析不到身份 ⇒ 401(前提:本进程真的在强制鉴权)。

    `require_request_user_id` 有一条"开发降级":`jwt_secret` 为空且
    node_env == development 时回落到 dev 身份(那是为 in-process 测试准备的,
    不是安全结论)。本用例显式打开强制鉴权再断言 401,免得在开发配置下
    静默"通过"而掩盖了生产行为。
    """
    from fastapi import HTTPException

    from app.core import jwt_auth

    monkeypatch.setattr(jwt_auth, "auth_globally_enforced", lambda: True)
    monkeypatch.setattr(
        jwt_auth, "resolve_request_user_id", lambda _request: None, raising=False
    )
    with pytest.raises(HTTPException) as ei:
        await jwt_auth.require_request_user_id(
            SimpleNamespace(state=SimpleNamespace(user_id=None))
        )
    assert ei.value.status_code == 401


async def test_resolved_identity_is_passed_through(monkeypatch):
    """身份解析得到什么,端点就用什么(不做任何改写)。"""
    from app.core import jwt_auth

    monkeypatch.setattr(jwt_auth, "auth_globally_enforced", lambda: True)
    monkeypatch.setattr(jwt_auth, "resolve_request_user_id", lambda _r: "u-resolved", raising=False)
    got = await jwt_auth.require_request_user_id(SimpleNamespace(state=SimpleNamespace()))
    assert got == "u-resolved"


async def test_decision_lands_on_jwt_subject_only():
    """决定必须落在"JWT 解析出的那个 user_id"名下(此处显式传参模拟)。"""
    out = await mod.sync_own_consent(_payload(True), user_id="u-from-jwt")
    assert cic.has_consent("u-from-jwt") is False
    assert cic.get_state("u-from-jwt").granted is False
    assert out["data"]["has_consent"] is False
    # 别的用户不受影响
    assert cic.get_state("u-someone-else").granted is None


# ===========================================================================
# 2. 极性
# ===========================================================================


async def test_opt_out_true_denies():
    out = await mod.sync_own_consent(_payload(True), user_id="u1")
    assert out["code"] == 0
    assert cic.has_consent("u1") is False
    assert cic.get_state("u1").granted is False
    # 回带判定结果,让 api 侧日志能直接落"闸门现在怎么看"
    assert out["data"]["has_consent"] is False


async def test_opt_out_false_clears_statement_not_grant():
    """推送"不阻止" ⇒ 清除表态(回到未表态),**不是** grant。

    本端点最关键的一条:写反了等于把"用户没反对"记成"用户授权代码出域"。
    """
    await mod.sync_own_consent(_payload(True), user_id="u1")
    assert cic.get_state("u1").granted is False

    out = await mod.sync_own_consent(_payload(False), user_id="u1")
    assert out["data"]["granted"] is None, "未表态必须是 None;True 意味着被记成已授权"
    assert cic.has_consent("u1") is False


async def test_per_user_isolation():
    """同步只作用于调用者自己,不得跨用户泄漏。"""
    await mod.sync_own_consent(_payload(True), user_id="u-blocked")
    assert cic.has_consent("u-blocked") is False
    assert cic.get_state("u-other").granted is None


async def test_sync_is_idempotent():
    """重放同一份设置结果相同(设置页是读-改-写,重放很常见)。"""
    for _ in range(3):
        await mod.sync_own_consent(_payload(True), user_id="u1")
    st = cic.get_state("u1")
    assert st.granted is False
    assert st.decided_at, "最后一次表态时间应被刷新"


# ===========================================================================
# 3. 只读端点
# ===========================================================================


async def test_state_distinguishes_undecided_from_denied():
    """三态可读:未表态(None)与显式拒绝(False)必须能区分。"""
    r1 = await mod.read_own_consent_state(user_id="u1")
    assert r1["data"]["granted"] is None
    await mod.sync_own_consent(_payload(True), user_id="u1")
    r2 = await mod.read_own_consent_state(user_id="u1")
    assert r2["data"]["granted"] is False


# ===========================================================================
# 4. 启动自愈(preload_opt_outs_from_db)
# ===========================================================================


class _FakeConn:
    def __init__(self, rows: object) -> None:
        self._rows = rows

    async def fetch(self, *_a, **_kw):  # noqa: ANN001
        if isinstance(self._rows, Exception):
            raise self._rows
        return self._rows

    async def __aenter__(self):  # noqa: ANN204
        return self

    async def __aexit__(self, *_a):  # noqa: ANN002, ANN204
        return False


class _FakePool:
    def __init__(self, rows: object) -> None:
        self._conn = _FakeConn(rows)

    def acquire(self):  # noqa: ANN201
        return self._conn


def _stub_pool(monkeypatch, rows: object) -> None:
    import app.services.memory_service as ms

    async def _get_pool():  # noqa: ANN202
        return _FakePool(rows)

    monkeypatch.setattr(ms, "_get_pool", _get_pool)


async def test_preload_restores_opt_outs_after_container_rebuild(monkeypatch):
    """容器重建(.data 丢失)⇒ 启动自愈把已 opt-out 的用户补回闸门。

    不补的话,在 IHUI_CODE_INDEX_EGRESS=1 的部署上,已关闭代码出域的用户会被
    **静默恢复出域** —— 正是这次整改要消除的行为。
    """
    cic.reset_for_tests()  # 模拟容器重建:进程内状态全空
    assert cic.has_consent("u1") is False

    _stub_pool(monkeypatch, [{"user_id": "u1", "value": "true"}])
    assert await cic.preload_opt_outs_from_db() == 1
    assert cic.get_state("u1").granted is False, "必须登记为显式拒绝,才能压过全局开启"

    # 关键:全局开启时也仍拒绝 ⇒ 证明补回的是"拒绝",不是"回到未表态"
    cic.set_global_default(True)
    assert cic.has_consent("u1") is False


async def test_preload_ignores_non_true_rows(monkeypatch):
    """只认字面量 'true';其余值不当成"已阻止"。"""
    _stub_pool(
        monkeypatch,
        [
            {"user_id": "u-false", "value": "false"},
            {"user_id": "u-null", "value": None},
            {"user_id": "u-junk", "value": "yes"},
        ],
    )
    assert await cic.preload_opt_outs_from_db() == 0
    for uid in ("u-false", "u-null", "u-junk"):
        assert cic.get_state(uid).granted is None


async def test_preload_read_failure_keeps_existing_state(monkeypatch):
    """读库失败**不得**擦掉已登记的表态(降级必须倒向"不出域")。"""
    await mod.sync_own_consent(_payload(True), user_id="u1")
    assert cic.get_state("u1").granted is False

    _stub_pool(monkeypatch, RuntimeError("db down"))
    assert await cic.preload_opt_outs_from_db() == 0
    assert cic.get_state("u1").granted is False, "读库失败不该把用户的拒绝擦掉"
    assert cic.has_consent("u1") is False


async def test_preload_persists_once(monkeypatch):
    """自愈结果要落盘(否则下次重启又得再补,且期间窗口是"未表态")。"""
    _stub_pool(
        monkeypatch,
        [{"user_id": "u1", "value": "true"}, {"user_id": "u2", "value": "true"}],
    )
    assert await cic.preload_opt_outs_from_db() == 2
    cic.reset_for_tests()  # 模拟重启
    assert cic.get_state("u1").granted is False
    assert cic.get_state("u2").granted is False


async def test_preload_source_is_auditable(monkeypatch):
    """自愈登记的来源要可审计(与用户亲手点的区分开)。"""
    _stub_pool(monkeypatch, [{"user_id": "u1", "value": "true"}])
    await cic.preload_opt_outs_from_db()
    assert cic.get_state("u1").source == "startup_rehydrate"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
