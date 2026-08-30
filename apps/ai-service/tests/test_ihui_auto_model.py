"""智汇 Auto-Model 网关拦截逻辑单元测试(_resolve_ihui_auto_model)。

覆盖(2026-08-31 立):
- 池内模型全部可用时,随机路由结果必须落在 get_ihui_auto_pool() 池内
- 池内模型全部不可用时走兜底路径,仍返回原始池内模型
- 池不含 'ihui/auto-model' 自身(防双重随机路由),且所选模型倍率 <= 6.0
- 池为空时返回硬兜底常量 'ihui/MiniMax-M2.7'
- 元规则防漂移:池内每个模型倍率 <= 6 且已配 _IHUI_POINTS_MAP 映射
- complete() 入口拦截 'ihui/auto-model',调 _resolve_ihui_auto_model 而非透传
"""

from __future__ import annotations

from app.core.llm_gateway import _resolve_ihui_auto_model, llm_gateway
from app.services import free_provider_registry
from app.services.free_provider_registry import (
    get_ihui_auto_pool,
    infer_points_multiplier,
)


def _patch_availability(monkeypatch, available: bool) -> None:
    """把 model_availability.is_model_available 固定为恒返回 available。

    _resolve_ihui_auto_model 在函数体内延迟导入 model_availability 单例,
    每次调用都重新解析,因此 patch 单例实例属性即可生效。
    """
    monkeypatch.setattr(
        "app.services.model_availability.model_availability.is_model_available",
        lambda model_id: available,
    )


def test_auto_model_routes_to_pool(monkeypatch):
    """池内模型全部可用:返回值必须落在 get_ihui_auto_pool() 结果内。"""
    _patch_availability(monkeypatch, available=True)
    chosen = _resolve_ihui_auto_model()
    assert chosen in get_ihui_auto_pool()


def test_auto_model_filters_unavailable(monkeypatch):
    """池内模型全部不可用:走兜底路径,仍返回原始池内模型。"""
    _patch_availability(monkeypatch, available=False)
    chosen = _resolve_ihui_auto_model()
    pool = get_ihui_auto_pool()
    assert pool, "原始池定义保证非空,兜底路径必须有候选"
    assert chosen in pool


def test_auto_model_excludes_system_auto(monkeypatch):
    """池不含 'ihui/auto-model'(防双重随机路由),且所选模型倍率 <= 6.0。"""
    _patch_availability(monkeypatch, available=True)
    pool = get_ihui_auto_pool()
    # 防双重随机路由:系统 auto 不得进入 ihui auto 池(大小写不敏感)
    assert all(mid.lower() != "ihui/auto-model" for mid in pool)
    chosen = _resolve_ihui_auto_model()
    # 成本可控:池准入要求映射倍率 <= 6(极速扣费 1:1~1:2)
    assert infer_points_multiplier(chosen) <= 6.0


def test_auto_model_fallback_constant(monkeypatch):
    """池为空:返回硬兜底常量 'ihui/MiniMax-M2.7'(理论不可达的最后一道防线)。"""
    # llm_gateway 内是函数内延迟导入(from ..services.free_provider_registry
    # import get_ihui_auto_pool),每次调用重新解析 → patch 源头模块属性即生效
    monkeypatch.setattr(
        "app.services.free_provider_registry.get_ihui_auto_pool", lambda: []
    )
    # 两级兜底后仍为空 → 必须返回硬编码常量,而非抛错或空池 random.choice
    assert _resolve_ihui_auto_model() == "ihui/MiniMax-M2.7"


def test_auto_pool_multiplier_meta_rule():
    """元规则防漂移:池内每个模型必须倍率 <= 6 且已配 _IHUI_POINTS_MAP 映射。

    防止后续向 _IHUI_AUTO_POOL 追加模型时漏配映射(infer_points_multiplier
    退回关键词推断,可能放大消耗)或混入系统 auto 自身/高倍率模型。
    """
    pool = get_ihui_auto_pool()
    assert pool, "池定义保证非空(get_ihui_auto_pool 过滤后仍应有候选)"
    for mid in pool:
        # a) 成本可控:极速扣费 1:1~1:2 档(映射倍率 <= 6)
        assert infer_points_multiplier(mid) <= 6.0, mid
        # b) 防双重随机路由:系统 auto 不得进入池(大小写不敏感)
        assert mid.lower() != "ihui/auto-model", mid
        # c) 防漏配:池保留原始大小写,_IHUI_POINTS_MAP 键为小写,
        #    infer_points_multiplier 内部 lowercase 后查表 → 统一小写核对
        assert mid.lower() in free_provider_registry._IHUI_POINTS_MAP, mid


async def test_complete_intercepts_auto_model(monkeypatch):
    """入口分支回归:complete() 收到 'ihui/Auto-Model' 时调解析器而非透传。

    conftest autouse 隔离(_isolate_llm_env)保证 stub 模式:complete() 在
    模型解析后直接返回 stub 响应,响应的 model 字段即下游实际使用的模型。
    monkeypatch 模块级 _resolve_ihui_auto_model(拦截分支的全局名字解析点)。
    """
    monkeypatch.setattr(
        "app.core.llm_gateway._resolve_ihui_auto_model",
        lambda: "ihui/MiniMax-M2.7",
    )
    result = await llm_gateway.complete(
        [{"role": "user", "content": "你好"}], model="ihui/Auto-Model"
    )
    assert result["stub"] is True, "conftest 隔离下必须走 stub 路径"
    # 拦截生效:透传的话 model 会原样保持 'ihui/Auto-Model'
    assert result["model"] == "ihui/MiniMax-M2.7"
    assert result["model"].lower() != "ihui/auto-model"


async def test_astream_intercepts_auto_model(monkeypatch):
    """入口分支回归:astream() 收到 'ihui/Auto-Model' 时调解析器而非透传。

    与 complete() 用例同模式(llm_gateway.astream 内 model.lower() ==
    'ihui/auto-model' 分支)。conftest autouse 隔离(_isolate_llm_env)保证
    stub 模式:stub 路径内部转发调 self.complete(model='ihui/Auto-Model')
    (再次经过拦截分支),最终 done 事件的 model 字段即下游实际使用的模型。
    monkeypatch 模块级 _resolve_ihui_auto_model(拦截分支的全局名字解析点)。
    """
    sentinel = "ihui/MiniMax-M2.7"
    monkeypatch.setattr(
        "app.core.llm_gateway._resolve_ihui_auto_model",
        lambda: sentinel,
    )
    events = [
        evt
        async for evt in llm_gateway.astream(
            [{"role": "user", "content": "你好"}], model="ihui/Auto-Model"
        )
    ]
    # stub 路径先 yield 内容 chunk,再收尾 done 事件(契约见 astream docstring)
    assert any(e.get("type") == "chunk" for e in events), "stub 流式必须产出内容 chunk"
    done = next(e for e in events if e.get("type") == "done")
    assert done["stub"] is True, "conftest 隔离下必须走 stub 路径"
    # 拦截生效:透传的话 model 会原样保持 'ihui/Auto-Model'
    assert done["model"] == sentinel
    assert done["model"].lower() != "ihui/auto-model"
