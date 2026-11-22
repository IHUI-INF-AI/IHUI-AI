# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 30 批:Eval 数据集删除归属。

缺陷(现读):
  `/api/v1/ai/eval/datasets` 由 web rewrites 直连 ai-service 8803,8 个端点只有全局
  JWT(必须登录)。数据集是**共享**资源(GET 列表/详情、POST /runs 对所有人开放是既有
  产品语义),但 DELETE 是破坏性动作:任何登录用户知道名字就能删掉别人的评测数据集,
  而服务端没有任何归属记录 —— 连"谁建的"都无从判定。

修法:
  · `create_dataset` 记录 `owner_user_id`(承载层注入,不是请求体字段),get/list 回显;
  · 新增 `delete_dataset_guarded(name, actor_user_id, is_admin)` 三态
    (`ok` / `not_found` / `forbidden`)—— 归属判据唯一实现,路由不做"先查后删";
  · 路由 create/delete 挂 `Depends(get_current_principal)`;删除仅属主或 ADMIN/OWNER,
    别人的与不存在的同形 404;
  · 读/跑保持登录即可(数据集共享语义不变)。

用例:
  A service:创建写 owner + get/list 回显;无主数据集不拦(存量口径)。
  B service:`delete_dataset_guarded` 四档(不存在/无主/他人/属主/管理员)。
  C 路由:他人删除 404 且数据仍在;管理员可删;创建写入主体。
  D 接线锁:create/delete 签名含 get_current_principal 依赖。
"""

from __future__ import annotations

import inspect
import types

import pytest
from fastapi import HTTPException

from app.core.rbac import Role
from app.routers import eval as eval_router
from app.routers.eval import CreateDatasetRequest
from app.services import eval_service as eval_service_mod
from app.services.eval_service import EvalService


def _principal(user_id: str, role: Role = Role.MEMBER) -> types.SimpleNamespace:
    return types.SimpleNamespace(user_id=user_id, role=role)


@pytest.fixture
def svc(monkeypatch) -> EvalService:
    """每个用例独立实例,并挂到路由单例上(不碰进程内全局状态)。"""
    service = EvalService()
    monkeypatch.setattr(eval_router, "eval_service", service)
    return service


# ---------------------------------------------------------------------------
# A:创建写归属 / 回显
# ---------------------------------------------------------------------------


def test_create_records_owner_and_echoes_it(svc: EvalService):
    created = svc.create_dataset(
        name="ds-a", items=[{"input": "i1"}], description="d", owner_user_id="alice"
    )
    assert created["owner_user_id"] == "alice"
    assert svc.get_dataset("ds-a")["owner_user_id"] == "alice"
    listed = {d["name"]: d for d in svc.list_datasets()}
    assert listed["ds-a"]["owner_user_id"] == "alice"


def test_unowned_dataset_is_out_of_scope(svc: EvalService):
    svc.create_dataset(name="legacy", items=[], description="")
    assert svc.get_dataset("legacy")["owner_user_id"] is None
    assert svc.delete_dataset_guarded("legacy", actor_user_id="bob") == "ok"


# ---------------------------------------------------------------------------
# B:三态判定
# ---------------------------------------------------------------------------


def test_delete_guarded_outcomes(svc: EvalService):
    assert svc.delete_dataset_guarded("missing", actor_user_id="alice") == "not_found"

    svc.create_dataset(name="ds-b", items=[], owner_user_id="alice")
    assert svc.delete_dataset_guarded("ds-b", actor_user_id="bob") == "forbidden"
    assert svc.get_dataset("ds-b") is not None, "被拒的删除不得真的删掉"

    assert svc.delete_dataset_guarded("ds-b", actor_user_id="alice") == "ok"
    assert svc.get_dataset("ds-b") is None

    svc.create_dataset(name="ds-c", items=[], owner_user_id="alice")
    assert svc.delete_dataset_guarded("ds-c", actor_user_id="bob", is_admin=True) == "ok"
    assert svc.get_dataset("ds-c") is None


def test_delete_guarded_without_actor_keeps_internal_path(svc: EvalService):
    svc.create_dataset(name="ds-d", items=[], owner_user_id="alice")
    assert svc.delete_dataset_guarded("ds-d", actor_user_id=None) == "ok"


# ---------------------------------------------------------------------------
# C:路由层
# ---------------------------------------------------------------------------


async def test_route_create_writes_principal_as_owner(svc: EvalService):
    resp = await eval_router.create_dataset(
        CreateDatasetRequest(name="ds-route", items=[{"input": "x"}]), _principal("alice")
    )
    assert resp["code"] == 0
    assert svc.get_dataset("ds-route")["owner_user_id"] == "alice"


async def test_route_delete_denied_for_stranger(svc: EvalService):
    await eval_router.create_dataset(
        CreateDatasetRequest(name="ds-route", items=[]), _principal("alice")
    )
    with pytest.raises(HTTPException) as exc:
        await eval_router.delete_dataset("ds-route", _principal("bob"))
    assert exc.value.status_code == 404
    # 别人的与"不存在"同形:不给出存在性差异
    assert "数据集不存在" in exc.value.detail
    assert svc.get_dataset("ds-route") is not None


async def test_route_delete_allowed_for_owner_and_admin(svc: EvalService):
    await eval_router.create_dataset(
        CreateDatasetRequest(name="ds-own", items=[]), _principal("alice")
    )
    await eval_router.delete_dataset("ds-own", _principal("alice"))
    assert svc.get_dataset("ds-own") is None

    await eval_router.create_dataset(
        CreateDatasetRequest(name="ds-adm", items=[]), _principal("alice")
    )
    await eval_router.delete_dataset("ds-adm", _principal("root", Role.OWNER))
    assert svc.get_dataset("ds-adm") is None


# ---------------------------------------------------------------------------
# D:接线锁
# ---------------------------------------------------------------------------


def test_routes_are_wired_to_principal():
    for fn in (eval_router.create_dataset, eval_router.delete_dataset):
        src = inspect.getsource(fn)
        assert "get_current_principal" in src, f"{fn.__name__} 未接主体依赖"


def test_service_guarded_is_single_source():
    """归属判定只能有一份:delete_dataset 是底层,guarded 才做归属。"""
    assert hasattr(eval_service_mod.EvalService, "delete_dataset_guarded")
    src = inspect.getsource(EvalService.delete_dataset_guarded)
    assert "forbidden" in src and "not_found" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
