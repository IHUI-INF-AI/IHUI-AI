# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""agnes 视频提交的重试判据(2026-10-29)。

钉住三件在真机上量到的事:
1. 免费档 `503 video queue is full` 是**常态**(同一分钟连撞 6 次)—— 必须退避重放,
   而不是一次就判"视频功能不可用";
2. 参数错/鉴权错(非 503)**立刻返回**,不拿排队的时间预算去重放注定失败的请求;
3. 重放耗尽后把"是否排队类"如实交回给工具层 —— 显式点名 agnes 时要回 `PROVIDER_BUSY`
   且标 `retryable`,好让模型转述成"稍后再试"而不是"坏了"。

判据实现在 `app.services.mcp_server._agnes_submit_with_retry`,本测试直接 import 它,
不复制一份实现(§0.6 单一真相源;§22c 禁止在测试里重写判据)。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.providers.base_provider import ProviderError
from app.services.mcp_server import _agnes_submit_with_retry


class _FakeAgnes:
    """按预置剧本返回/抛错的替身,并记录被调次数与每次的 wait 值。"""

    def __init__(self, script: list[Any]) -> None:
        self.script = list(script)
        self.calls: list[dict[str, Any]] = []

    async def generate_video(self, prompt: str, model: str = "", **kwargs: Any) -> dict[str, Any]:
        self.calls.append({"prompt": prompt, "model": model, **kwargs})
        item = self.script.pop(0) if self.script else ProviderError("剧本用尽", 500)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    """把退避步长压到 0:测的是判据,不是等待。"""
    monkeypatch.setenv("VIDEO_BUSY_BACKOFF_S", "0")
    monkeypatch.setenv("VIDEO_BUSY_RETRIES", "3")


@pytest.mark.asyncio
async def test_success_first_attempt_does_not_mark_busy() -> None:
    fake = _FakeAgnes([{"task_id": "task_abc", "video_url": None}])
    res, err, busy = await _agnes_submit_with_retry(fake, "猫", "m", duration=5)
    assert res == {"task_id": "task_abc", "video_url": None}
    assert (err, busy) == ("", False)
    assert len(fake.calls) == 1
    # 提交态必须是非阻塞的:否则工具层拿不到 task_id,对话会被挂死
    assert fake.calls[0]["wait"] is False
    assert fake.calls[0]["duration"] == 5


@pytest.mark.asyncio
async def test_queue_full_is_retried_then_succeeds() -> None:
    fake = _FakeAgnes([
        ProviderError("Agnes 调用失败: 503 video queue is full", 503),
        ProviderError("Agnes 调用失败: 503 video queue is full", 503),
        {"task_id": "task_ok"},
    ])
    res, err, busy = await _agnes_submit_with_retry(fake, "猫", "m", duration=5)
    assert res == {"task_id": "task_ok"}, "排队满两次后应重放到成功"
    assert (err, busy) == ("", False)
    assert len(fake.calls) == 3


@pytest.mark.asyncio
async def test_queue_full_exhausted_reports_busy() -> None:
    errs = [ProviderError("503 video queue is full", 503) for _ in range(3)]
    fake = _FakeAgnes(errs)
    res, err, busy = await _agnes_submit_with_retry(fake, "猫", "m", duration=5)
    assert res is None
    assert busy is True, "排队类失败必须回带 busy=True,供工具层映射 PROVIDER_BUSY/retryable"
    assert "queue is full" in err
    assert len(fake.calls) == 3, "默认重试 3 次(含首次);不许多打到上游"


@pytest.mark.asyncio
async def test_non_retryable_error_returns_immediately() -> None:
    fake = _FakeAgnes([ProviderError("Agnes 视频生成缺 prompt", 400)])
    res, err, busy = await _agnes_submit_with_retry(fake, "猫", "m", duration=5)
    assert res is None
    assert busy is False
    assert "缺 prompt" in err
    assert len(fake.calls) == 1, "400 类错误重放只会重复烧配额"


@pytest.mark.asyncio
async def test_unexpected_exception_is_not_marked_busy() -> None:
    fake = _FakeAgnes([RuntimeError("boom")])
    res, err, busy = await _agnes_submit_with_retry(fake, "猫", "m", duration=5)
    assert res is None
    assert busy is False
    assert "RuntimeError" in err and "boom" in err
