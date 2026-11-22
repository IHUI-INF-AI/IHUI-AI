# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""im_bridge.py(IM 桥接服务)单元测试。

覆盖策略:只测不依赖真实外部服务的纯逻辑分支,
Redis / LLM / im-gateway HTTP 调用全部用假实现替换。
参考 test_vector_memory.py 的 _FakeRedis 模式。
"""

import asyncio
import json

import pytest

from app.services.im_bridge import ImBridgeService

# =============================================================================
# 假实现
# =============================================================================


class _FakeRedis:
    """最小可用 async Redis 替身:get/set/delete/scan/ping/aclose。"""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}
        self.closed = False

    async def get(self, key: str) -> str | None:
        return self._data.get(key)

    async def set(self, key: str, value: str) -> None:
        self._data[key] = value

    async def delete(self, *keys: str) -> int:
        n = 0
        for k in keys:
            if k in self._data:
                del self._data[k]
                n += 1
        return n

    async def scan(self, cursor=0, match=None, count=None):
        return 0, []

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        self.closed = True


class _FakeResponse:
    def __init__(self, status_code: int = 200, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


def _make_service(fake_redis: _FakeRedis | None = None) -> ImBridgeService:
    svc = ImBridgeService()
    if fake_redis is not None:
        svc._redis = fake_redis
    return svc


def _queue_key(user_id: str = "u-123", platform: str = "wechat") -> str:
    return f"im:inbound:{user_id}:{platform}"


def _inbound(text: str = "你好", chat_id: str = "chat-1") -> dict:
    return {"text": text, "chatId": chat_id}


def _patch_llm(monkeypatch: pytest.MonkeyPatch, impl) -> None:
    """替换 llm_gateway.complete(_handle_message 内部延迟 import)。"""
    import app.core.llm_gateway as llm_mod

    monkeypatch.setattr(llm_mod.llm_gateway, "complete", impl)


def _patch_api_client(monkeypatch: pytest.MonkeyPatch, impl) -> None:
    """替换 api_client.get_api_client(_handle_message 内部延迟 import)。"""
    monkeypatch.setattr("app.services.api_client.get_api_client", impl)


# =============================================================================
# _peek_last_message / _commit_removal
# (G-815414 改:旧的 `_pop_last_message` 已**整体删除** —— 它是"移除发生在业务之前"的
#  错误语义本体,留着同名旧入口等于给下一次丢消息留入口。原 8 条用例逐条迁到新契约,
#  断言的语义一格不减:缺键/坏 JSON/非数组/空数组/单条/多条/尾元素非对象/Redis 抛错)
# =============================================================================


async def test_peek_missing_key_returns_empty():
    from app.services.im_bridge import QueueStatus

    svc = _make_service(_FakeRedis())
    peeked = await svc._peek_last_message("im:inbound:u-123:wechat")
    assert peeked.status is QueueStatus.EMPTY
    assert peeked.message is None


async def test_peek_invalid_json_returns_invalid_and_preserves_raw():
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = "not-json{{{"
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.INVALID
    assert peeked.message is None
    # 不破坏原始数据
    assert fake._data[key] == "not-json{{{"
    # G-815414:这一格必须可观测,不得与"队列为空"同形
    assert svc.metrics_snapshot()["parse_failures"] == 1


async def test_peek_not_list_returns_invalid():
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = json.dumps({"text": "x"})
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.INVALID
    assert svc.metrics_snapshot()["invalid_payloads"] == 1


async def test_peek_empty_list_deletes_key():
    """空列表脏数据:返回 EMPTY,key 被删除(2026-08-12 对齐 docstring 意图修复,语义未变)。"""
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = json.dumps([])
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.EMPTY
    assert key not in fake._data


async def test_peek_single_item_leaves_queue_untouched_and_commit_deletes():
    """G-815414 的核心改动:peek 阶段**不再**提前摘走(旧用例断言的是丢消息的那一步)。"""
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = json.dumps([_inbound()])
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.READY
    assert peeked.message == _inbound()
    assert json.loads(fake._data[key]) == [_inbound()]

    # 业务成功后才提交移除
    assert await svc._commit_removal(key, peeked.message or {}) is True
    assert key not in fake._data


async def test_peek_multiple_items_returns_last_and_commit_keeps_rest():
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = json.dumps([_inbound("a"), _inbound("b")])
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.READY
    assert peeked.message == _inbound("b")
    # 未提交前两条都在
    assert json.loads(fake._data[key]) == [_inbound("a"), _inbound("b")]

    assert await svc._commit_removal(key, _inbound("b")) is True
    remaining = json.loads(fake._data[key])
    assert remaining == [_inbound("a")]


async def test_peek_last_not_dict_returns_invalid_and_keeps_rest():
    """尾部元素不是对象 ⇒ INVALID(旧语义的"返回 None 且摘掉毒丸"保留),但新增计数。"""
    from app.services.im_bridge import QueueStatus

    fake = _FakeRedis()
    key = _queue_key()
    fake._data[key] = json.dumps([_inbound("a"), "not-a-dict"])
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(key)
    assert peeked.status is QueueStatus.INVALID
    remaining = json.loads(fake._data[key])
    assert remaining == [_inbound("a")]
    assert svc.metrics_snapshot()["invalid_items"] == 1


async def test_peek_redis_error_returns_error_not_empty():
    from app.services.im_bridge import QueueStatus

    class _BrokenRedis(_FakeRedis):
        async def get(self, key: str) -> str | None:
            raise ConnectionError("boom")

    svc = _make_service(_BrokenRedis())
    peeked = await svc._peek_last_message(_queue_key())
    assert peeked.status is QueueStatus.ERROR
    assert svc.metrics_snapshot()["read_errors"] == 1


# =============================================================================
# _handle_message
# =============================================================================


async def test_handle_message_bad_key_format_skips(monkeypatch):
    called = []

    async def fake_complete(*args, **kwargs):
        called.append(True)
        return {"content": "hi"}

    _patch_llm(monkeypatch, fake_complete)
    svc = _make_service()
    await svc._handle_message("im:inbound:u-123", _inbound())
    assert called == []


async def test_handle_message_skips_no_text_or_chat_id(monkeypatch):
    called = []

    async def fake_complete(*args, **kwargs):
        called.append(True)
        return {"content": "hi"}

    _patch_llm(monkeypatch, fake_complete)
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound(text=""))
    await svc._handle_message(_queue_key(), _inbound(chat_id=""))
    await svc._handle_message(_queue_key(), {"text": "hi", "chat_id": ""})
    assert called == []


async def test_handle_message_accepts_snake_case_chat_id(monkeypatch):
    sent = []

    async def fake_complete(messages, owner_uuid=None):
        return {"content": "回复"}

    async def fake_post(url, json=None, headers=None):
        sent.append((url, json, headers))
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), {"text": "hi", "chat_id": "c-9"})
    assert sent and sent[0][1]["chatId"] == "c-9"


async def test_handle_message_llm_timeout_skips(monkeypatch):
    sent = []

    async def fake_complete(messages, owner_uuid=None):
        raise TimeoutError()

    async def fake_post(url, json=None, headers=None):
        sent.append(url)
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound())
    assert sent == []


async def test_handle_message_llm_error_skips(monkeypatch):
    sent = []

    async def fake_complete(messages, owner_uuid=None):
        raise RuntimeError("llm down")

    async def fake_post(url, json=None, headers=None):
        sent.append(url)
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound())
    assert sent == []


async def test_handle_message_llm_empty_or_error_reply_skips(monkeypatch):
    sent = []

    async def fake_complete(messages, owner_uuid=None):
        return {}

    async def fake_post(url, json=None, headers=None):
        sent.append(url)
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound())
    assert sent == []


async def test_handle_message_llm_error_flag_skips(monkeypatch):
    sent = []

    async def fake_complete(messages, owner_uuid=None):
        return {"content": "", "error": "provider fail", "error_message": "detail"}

    async def fake_post(url, json=None, headers=None):
        sent.append(url)
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound())
    assert sent == []


async def test_handle_message_send_failure_does_not_raise(monkeypatch):
    async def fake_complete(messages, owner_uuid=None):
        return {"content": "回复"}

    def fake_get_client():
        raise RuntimeError("client broken")

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, fake_get_client)
    svc = _make_service()
    # 不应抛异常
    await svc._handle_message(_queue_key(), _inbound())


async def test_handle_message_http_error_does_not_raise(monkeypatch):
    async def fake_complete(messages, owner_uuid=None):
        return {"content": "回复"}

    async def fake_post(url, json=None, headers=None):
        return _FakeResponse(status_code=500, text="oops")

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(), _inbound())


async def test_handle_message_success_sends_expected_payload(monkeypatch):
    # 显式隔离 settings,避免 .env 中的真实值影响断言
    monkeypatch.setattr("app.core.config.settings.api_service_url", "http://localhost:8802")
    monkeypatch.setattr("app.core.config.settings.ai_callback_secret", "")
    calls = {}

    async def fake_complete(messages, owner_uuid=None):
        calls["llm_messages"] = messages
        calls["owner_uuid"] = owner_uuid
        return {"content": "收到,你好!"}

    async def fake_post(url, json=None, headers=None):
        calls["url"] = url
        calls["payload"] = json
        calls["headers"] = headers
        return _FakeResponse(status_code=200)

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))

    svc = _make_service()
    await svc._handle_message(
        _queue_key(user_id="u-123", platform="wechat"), _inbound(text="你好", chat_id="c-1")
    )

    assert calls["owner_uuid"] == "u-123"
    prompt = calls["llm_messages"][0]["content"]
    assert "wechat" in prompt and "你好" in prompt
    assert calls["url"] == "http://localhost:8802/api/im-gateway/send"
    assert calls["payload"] == {
        "platform": "wechat",
        "chatId": "c-1",
        "messageType": "text",
        "text": "收到,你好!",
    }
    assert calls["headers"]["Content-Type"] == "application/json"
    # ai_callback_secret 为空时不带鉴权头
    assert "x-internal-service-token" not in calls["headers"]
    assert "x-user-id" not in calls["headers"]


async def test_handle_message_success_with_secret_headers(monkeypatch):
    calls = {}
    monkeypatch.setattr("app.core.config.settings.api_service_url", "http://api:8802")
    monkeypatch.setattr("app.core.config.settings.ai_callback_secret", "secret-token")

    async def fake_complete(messages, owner_uuid=None):
        return {"content": "hi"}

    async def fake_post(url, json=None, headers=None):
        calls["url"] = url
        calls["headers"] = headers
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message(_queue_key(user_id="u-7", platform="tg"), _inbound())

    assert calls["url"] == "http://api:8802/api/im-gateway/send"
    assert calls["headers"]["x-internal-service-token"] == "secret-token"
    assert calls["headers"]["x-user-id"] == "u-7"


async def test_handle_message_platform_with_colon_preserved(monkeypatch):
    calls = {}

    async def fake_complete(messages, owner_uuid=None):
        return {"content": "hi"}

    async def fake_post(url, json=None, headers=None):
        calls["payload"] = json
        return _FakeResponse()

    _patch_llm(monkeypatch, fake_complete)
    _patch_api_client(monkeypatch, lambda: _FakeClient(fake_post))
    svc = _make_service()
    await svc._handle_message("im:inbound:u-1:wx:sub", _inbound())
    assert calls["payload"]["platform"] == "wx:sub"


class _FakeClient:
    def __init__(self, post_impl) -> None:
        self._post = post_impl

    async def post(self, url, json=None, headers=None):
        return await self._post(url, json=json, headers=headers)


# =============================================================================
# _scan_and_consume
# =============================================================================


async def test_scan_and_consume_no_redis_returns():
    svc = _make_service(None)
    assert await svc._scan_and_consume() is None


async def test_scan_and_consume_processes_keys(monkeypatch):
    fake = _FakeRedis()
    key1 = _queue_key("u-1", "wechat")
    key2 = _queue_key("u-2", "tg")
    fake._data[key1] = json.dumps([_inbound("a", "c1")])
    fake._data[key2] = json.dumps([_inbound("b", "c2")])
    svc = _make_service(fake)

    async def fake_scan(cursor=0, match=None, count=None):
        return 0, list(fake._data.keys())

    monkeypatch.setattr(fake, "scan", fake_scan)

    handled = []

    async def fake_handle(key, msg):
        handled.append((key, msg))

    monkeypatch.setattr(svc, "_handle_message", fake_handle)
    await svc._scan_and_consume()
    assert len(handled) == 2
    assert {h[0] for h in handled} == {key1, key2}
    assert key1 not in fake._data and key2 not in fake._data


async def test_scan_and_consume_skips_non_str_keys(monkeypatch):
    fake = _FakeRedis()
    key = _queue_key("u-1", "wechat")
    fake._data[key] = json.dumps([_inbound()])
    handled = []

    async def fake_handle(key, msg):
        handled.append(key)

    async def fake_scan(cursor=0, match=None, count=None):
        # 返回一个非字符串 key,应被跳过
        return 0, [key, b"binary-key"]

    monkeypatch.setattr(fake, "scan", fake_scan)
    svc = _make_service(fake)
    monkeypatch.setattr(svc, "_handle_message", fake_handle)
    await svc._scan_and_consume()
    assert handled == [key]


async def test_scan_and_consume_handle_error_does_not_abort(monkeypatch):
    fake = _FakeRedis()
    key = _queue_key("u-1", "wechat")
    fake._data[key] = json.dumps([_inbound()])
    svc = _make_service(fake)

    async def fake_handle(key, msg):
        raise RuntimeError("handle boom")

    monkeypatch.setattr(svc, "_handle_message", fake_handle)
    # 不抛异常,单条失败被捕获
    await svc._scan_and_consume()


async def test_scan_and_consume_iterates_cursor_pages(monkeypatch):
    fake = _FakeRedis()
    key1 = _queue_key("u-1", "wechat")
    key2 = _queue_key("u-2", "tg")
    fake._data[key1] = json.dumps([_inbound("a", "c1")])
    fake._data[key2] = json.dumps([_inbound("b", "c2")])
    svc = _make_service(fake)

    pages = [[key1], [key2]]
    page_no = [0]
    handled = []

    async def fake_scan(cursor=0, match=None, count=None):
        if page_no[0] == 0:
            page_no[0] = 1
            return 5, pages[0]  # 非 0 游标:继续
        return 0, pages[1]

    async def fake_handle(key, msg):
        handled.append(key)

    monkeypatch.setattr(fake, "scan", fake_scan)
    monkeypatch.setattr(svc, "_handle_message", fake_handle)
    await svc._scan_and_consume()
    assert handled == [key1, key2]


async def test_scan_and_consume_pop_none_skips(monkeypatch):
    fake = _FakeRedis()
    svc = _make_service(fake)
    handled = []

    async def fake_handle(key, msg):
        handled.append(key)

    monkeypatch.setattr(svc, "_handle_message", fake_handle)
    # 队列不存在 → pop 返回 None → 跳过
    await svc._scan_and_consume()
    assert handled == []


# =============================================================================
# initialize / shutdown
# =============================================================================


async def test_initialize_success_starts_consume_task(monkeypatch):
    fake = _FakeRedis()
    started = []

    async def fake_consume_loop(self):
        started.append(True)

    async def fake_init_redis(self):
        self._redis = fake

    monkeypatch.setattr(ImBridgeService, "_init_redis", fake_init_redis)
    monkeypatch.setattr(ImBridgeService, "_consume_loop", fake_consume_loop)

    svc = _make_service()
    await svc.initialize()
    assert svc._initialized is True
    assert svc._consume_task is not None
    # 让后台任务真正跑起来
    await asyncio.sleep(0)
    assert len(started) == 1
    # 幂等:再次调用不再重启
    await svc.initialize()
    await asyncio.sleep(0)
    assert len(started) == 1
    await svc.shutdown()
    assert svc._initialized is False
    # 任务已自行完成时 shutdown 不再持有引用清理逻辑,
    # _consume_task 可能保留已完成的任务对象(符合当前实现)。
    assert svc._consume_task is None or svc._consume_task.done()


async def test_initialize_redis_failure_degrades_to_noop(monkeypatch):
    async def fake_init_redis(self):
        raise ConnectionError("redis down")

    monkeypatch.setattr(ImBridgeService, "_init_redis", fake_init_redis)
    svc = _make_service()
    await svc.initialize()
    assert svc._initialized is False
    assert svc._consume_task is None


async def test_shutdown_cancels_task_and_closes_redis(monkeypatch):
    fake = _FakeRedis()

    async def fake_consume_loop(self):
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            raise

    async def fake_init_redis(self):
        self._redis = fake

    monkeypatch.setattr(ImBridgeService, "_consume_loop", fake_consume_loop)
    monkeypatch.setattr(ImBridgeService, "_init_redis", fake_init_redis)

    svc = _make_service()
    await svc.initialize()
    assert svc._consume_task is not None and not svc._consume_task.done()
    await svc.shutdown()
    assert svc._consume_task is None
    assert svc._redis is None
    assert fake.closed is True


async def test_shutdown_idempotent():
    svc = _make_service()
    await svc.shutdown()
    await svc.shutdown()


# =============================================================================
# _init_redis
# =============================================================================


async def test_init_redis_empty_url_raises(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.redis_url", "")
    svc = _make_service()
    with pytest.raises(RuntimeError):
        await svc._init_redis()


async def test_init_redis_success(monkeypatch):
    import redis.asyncio as aioredis

    fake = _FakeRedis()
    from_url_calls = []

    def fake_from_url(url, decode_responses=None, protocol=None, socket_connect_timeout=None):
        from_url_calls.append((url, decode_responses, protocol))
        return fake

    async def fake_ping():
        return True

    monkeypatch.setattr(aioredis, "from_url", fake_from_url)
    monkeypatch.setattr(fake, "ping", fake_ping)
    monkeypatch.setattr("app.core.config.settings.redis_url", "redis://localhost:6379/0")

    svc = _make_service()
    await svc._init_redis()
    assert svc._redis is fake
    assert from_url_calls[0] == (
        "redis://localhost:6379/0",
        True,
        2,
    )


async def test_init_redis_ping_failure_raises(monkeypatch):
    import redis.asyncio as aioredis

    fake = _FakeRedis()

    def fake_from_url(url, decode_responses=None, protocol=None, socket_connect_timeout=None):
        return fake

    async def fake_ping():
        raise ConnectionError("ping timeout")

    monkeypatch.setattr(aioredis, "from_url", fake_from_url)
    monkeypatch.setattr(fake, "ping", fake_ping)
    monkeypatch.setattr("app.core.config.settings.redis_url", "redis://localhost:6379/0")

    svc = _make_service()
    with pytest.raises(ConnectionError):
        await svc._init_redis()
    assert svc._redis is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
