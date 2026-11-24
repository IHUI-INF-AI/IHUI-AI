# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""上下文引擎的 8 个端点必须只认注入身份(2026-11-01 安全强化)。

改造前这 8 个端点的身份全部来自**请求方自报**:
- `/enrich` 读 body 的 `userId`、`/sources`(GET) 读 query 的 `user_id`、
  `/sources`(PUT)/`/compression-stats`/`/visualization`/`/memory` 读 query 的 `userId`;
- `/memory`(DELETE) 和 `/visualization` 连自报值都不看,键只按 `conversationId` 派生。

而 api→ai-service 这一腿又统一走系统票(8 处 `aiServiceFetch(null, …)`) ⇒ 两层叠加后,
"谁在读写哪份上下文"在 ai-service 侧完全不可知。

这组用例钉的是**方向**:自报值必须被忽略,注入身份必须被采用。
最后一组是结构锁 —— 少了它,任何一个端点回退成 `userId: str = ""` 都不会有测试翻红
(它只会安静地重新开始相信调用方说自己是谁)。
"""

from __future__ import annotations

import inspect
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.services import context_engine as ce
from app.services.context_engine import (
    EnrichRequest,
    TrackVisualizationRequest,
    UpdateSourcesRequest,
    clear_memory_endpoint,
    compression_stats_endpoint,
    enrich_endpoint,
    memory_endpoint,
    sources_endpoint,
    track_visualization_endpoint,
    update_sources_endpoint,
    visualization_endpoint,
)

VICTIM = "11111111-1111-1111-1111-111111111111"
ATTACKER = "99999999-9999-9999-9999-999999999999"


@pytest.mark.asyncio
async def test_enrich_ignores_body_user_id() -> None:
    """请求体里写别人的 id 不生效 —— 只有注入身份说了算。"""
    req = EnrichRequest(userId=ATTACKER, query="q")
    spy = AsyncMock(return_value={"enrichedContext": "", "tokenCount": 0, "sources": []})
    with patch.object(ce.context_engine, "enrich_context", new=spy):
        await enrich_endpoint(req, VICTIM)
    assert spy.await_args is not None
    assert spy.await_args.kwargs["user_id"] == VICTIM


@pytest.mark.asyncio
async def test_memory_uses_injected_subject() -> None:
    spy = AsyncMock(return_value={"conversationId": "c1", "summary": "", "preferences": []})
    with patch.object(ce.context_engine, "_get_session_memory", new=spy):
        await memory_endpoint("c1", VICTIM)
    assert spy.await_args is not None
    assert spy.await_args.args[1] == VICTIM


@pytest.mark.asyncio
async def test_compression_stats_uses_injected_subject() -> None:
    spy = AsyncMock(return_value={"totalEvents": 0})
    with patch.object(ce.context_engine, "_get_compression_stats", new=spy):
        await compression_stats_endpoint(VICTIM)
    assert spy.await_args is not None
    assert spy.await_args.args[0] == VICTIM


@pytest.mark.asyncio
async def test_visualization_uses_injected_subject() -> None:
    spy = AsyncMock(return_value={"pie": [], "trend": [], "compressions": []})
    with patch.object(ce.context_engine, "get_visualization", new=spy):
        await visualization_endpoint("c1", VICTIM)
    assert spy.await_args is not None
    assert spy.await_args.args[1] == VICTIM


@pytest.mark.asyncio
async def test_sources_prefs_keyed_by_injected_subject() -> None:
    """偏好读的 key 必须跟着注入身份走,而不是跟着谁传了什么 query。"""
    spy = AsyncMock(return_value={})
    with patch.object(ce, "_load_user_source_prefs", new=spy):
        await sources_endpoint(VICTIM)
    assert spy.await_args is not None
    assert spy.await_args.args[0] == VICTIM


@pytest.mark.asyncio
async def test_update_sources_writes_under_injected_subject() -> None:
    """写偏好的 Redis key 必须跟着注入身份走。"""

    class FakeRedis:
        def __init__(self) -> None:
            self.keys: list[str] = []

        async def get(self, key: str) -> None:
            return None

        async def set(self, key: str, value: str) -> None:
            self.keys.append(key)

    fake = FakeRedis()
    with patch.object(ce.context_engine, "_get_redis", new=AsyncMock(return_value=fake)):
        result = await update_sources_endpoint(
            UpdateSourcesRequest(updates=[{"type": "history", "enabled": True}]), VICTIM
        )
    assert result["code"] == 0
    assert fake.keys, "一次都没写 —— 说明主体没传到写 key 的那一步"
    assert all(VICTIM in k for k in fake.keys), f"写到了别人的 key 下:{fake.keys}"


@pytest.mark.asyncio
async def test_track_visualization_requires_subject() -> None:
    """记录动作本身不需要 user,但端点必须挂身份依赖 —— 这里只验签名可被调用。"""
    req = TrackVisualizationRequest(conversationId="c1", totalTokens=1)
    with patch.object(ce.context_engine, "record_visualization", new=AsyncMock()):
        result = await track_visualization_endpoint(req, VICTIM)
    assert result["code"] == 0


@pytest.mark.asyncio
async def test_clear_memory_requires_subject() -> None:
    with patch.object(ce.context_engine, "_clear_session_memory", new=AsyncMock(return_value=True)):
        result = await clear_memory_endpoint("c1", VICTIM)
    assert result["code"] == 0


def _subject_param(fn: Any) -> inspect.Parameter | None:
    sig = inspect.signature(fn)
    for name, param in sig.parameters.items():
        if name in {"user_id", "userId"}:
            return param
    return None


@pytest.mark.parametrize(
    "endpoint",
    [
        enrich_endpoint,
        sources_endpoint,
        update_sources_endpoint,
        track_visualization_endpoint,
        visualization_endpoint,
        compression_stats_endpoint,
        memory_endpoint,
        clear_memory_endpoint,
    ],
)
def test_every_context_endpoint_declares_identity_dependency(endpoint: Any) -> None:
    """结构锁:8 个端点的身份参数必须是 Depends,不能是带默认值的裸字符串。"""
    param = _subject_param(endpoint)
    assert param is not None, f"{endpoint.__name__} 缺少主体参数"
    assert param.default is not inspect.Parameter.empty, (
        f"{endpoint.__name__} 的主体参数没有默认值 —— 应当挂 Depends(require_request_user_id)"
    )
    # Depends 对象的判据:fastapi.params.Depends 实例(直接调用时才不会被误当字符串用)
    assert type(param.default).__name__ == "Depends", (
        f"{endpoint.__name__} 的主体参数默认值是 {type(param.default).__name__},"
        "不是 Depends —— 说明它又变回自报值了"
    )
