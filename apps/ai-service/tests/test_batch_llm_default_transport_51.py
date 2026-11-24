# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51 存量收口 · batch_llm 的**生产默认传输口**回归锁。

为什么单列这一条(而不是"再造一个调用点"):

`run_in_background` 的六类真实 executor 在 `ac4352047` 已全部接进唯一分派出口,
门 136 现读"未接线 0 类"。但门与既有测试都看不见这一格 ——

- `batch_llm` 的**全部**既有用例都从 `TaskContext.llm_call` 注入假实现
  (`test_background_task_executors.py` 的并发/隔离用例、`test_background_task_type_wiring_51.py`
  的幂等与续跑用例),于是 `_default_llm_call`(`task_executors.py:843`)里
  `llm_gateway.complete(messages, model)` 这一跳**从未被任何测试问过**。
  生产路径确实走它:`run_in_background` 不传 seams ⇒ `submit_typed` 记下
  `llm_call=None` ⇒ `_typed_factory` 原样喂给 `execute_task`。
- 同一族的 `web_batch` 有它的对偶判据(`test_background_task_executors.py:299`
  用 MockTransport 只换 socket),`batch_llm` 没有 ⇒ 网关签名一改
  (参数改关键字-only、新增必填位、改名)就是"账面全绿、线上 batch_llm 全失败"。

三条断言各挡一种漂移:
1. **绑定检查**(真实 `complete` 的签名仍能吃下生产那两个位置参数)⇒ 网关签名漂移即红;
2. **可达性**(不注入 seams 时,生产函数真的调到网关、模板与 model 原样传下去)⇒ 分派漂移即红;
3. **隔离**(AGENTS §5:生产连接池出口一调就炸)⇒ 本用例结构上不碰 PG/Redis,
   且把它做成回归锁而不是"当前恰好没连"。

判据与聚合逻辑一行都不在本文件复制(§22c):这里只喂输入、读输出。
"""

from __future__ import annotations

import inspect
import uuid
from typing import Any

import pytest

from app.core import db_pool
from app.services import task_executors as te


def _uid() -> str:
    return uuid.uuid4().hex[:10]


@pytest.fixture(autouse=True)
def _never_touch_production_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    """AGENTS §5 测试隔离铁律:生产库出口在任何断言之前就被钉成"一调即炸"。

    刻意做成 autouse 而非用例体内 monkeypatch —— 本文件的真实写入风险点是
    `llm_gateway.complete`(它会读模型配置表),而**替换发生在任何 execute_task 之前**。
    """

    def _boom(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("executor 不得触碰 app.core.db_pool.get_shared_pool(生产库)")

    monkeypatch.setattr(db_pool, "get_shared_pool", _boom)


async def test_batch_llm_reaches_gateway_through_production_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """不注入 `llm_call` ⇒ 真走 `_default_llm_call` → `llm_gateway.complete`(仅网关被换)。"""
    import app.core.llm_gateway as gateway_mod

    gateway = gateway_mod.llm_gateway
    real_complete = gateway.complete

    # ---- 断言 1:真实签名仍能吃下生产的那两个位置参数(漂移即在换实现之前就红) ----
    try:
        inspect.signature(real_complete).bind([{"role": "user", "content": "probe"}], None)
    except TypeError as e:  # pragma: no cover - 只在网关签名漂移时到达
        raise AssertionError(
            f"task_executors._default_llm_call 以 (messages, model) 位置调用网关,"
            f"而真实签名已不认这种调用:{e}"
        ) from e

    calls: list[tuple[list[dict[str, Any]], Any, dict[str, Any]]] = []

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        calls.append((messages, model, kwargs))
        return {"content": f"echo::{messages[-1]['content']}"}

    monkeypatch.setattr(gateway, "complete", fake_complete)

    result = await te.execute_task(
        "batch_llm",
        {
            "items": ["alpha", "beta"],
            "concurrency": 2,
            "prompt_template": "请总结:{item}",
            "model": "ihui-p51-probe-model",
        },
        store=te.CheckpointStore(),
        task_id=f"p51-default-{_uid()}",
    )

    assert len(calls) == 2, f"batch_llm 没有走到生产默认传输口(实际调到 {len(calls)} 次)"
    # 模板替换与 model 透传都必须在网关这一侧看得见,否则"接到了"只是名字
    assert [c[0][-1]["content"] for c in calls] == ["请总结:alpha", "请总结:beta"], calls
    assert {c[1] for c in calls} == {"ihui-p51-probe-model"}, "model 未原样传给网关"
    for _msgs, _model, extra in calls:
        assert extra == {}, f"生产调用多带了关键字参数({sorted(extra)}),网关侧行为不可预期"

    assert result["executed"] is True and result["stub"] is False
    assert result["analysis_depth"] == "real"
    assert result["succeeded"] == 2 and result["failed"] == 0 and result["ok"] is True


async def test_batch_llm_default_path_passes_model_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """省略 `model` 时生产路径必须传 None(而不是空串)—— 网关按 None 走默认档。"""
    import app.core.llm_gateway as gateway_mod

    seen: list[Any] = []

    async def fake_complete(
        messages: list[dict[str, Any]], model: str | None = None, **_k: Any
    ) -> dict[str, Any]:
        seen.append(model)
        return {"content": "ok"}

    monkeypatch.setattr(gateway_mod.llm_gateway, "complete", fake_complete)

    result = await te.execute_task(
        "batch_llm",
        {"items": ["only-one"]},
        store=te.CheckpointStore(),
        task_id=f"p51-none-{_uid()}",
    )
    assert seen == [None], seen
    assert result["model"] is None and result["succeeded"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
