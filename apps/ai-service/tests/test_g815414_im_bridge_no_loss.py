# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815414 回归:IM 桥不得在业务成功之前把消息摘走,解析失败不得静默消失。

覆盖三组**成对**判据(缺一组就无法证明修复没把功能改坏):
① 失败路径 —— 处理抛错 / 处理返回 False ⇒ 消息仍在活动队列,且下一轮能重投同一条;
② 坏内容路径 —— JSON 解析失败等 ⇒ 计入可观测的一格(QueueStatus.INVALID + 计数 + ERROR 日志),
   与「队列为空」严格不同形(成对的第②条对照就是真·空队列,它不得产生任何计数);
③ 正向对照 —— 正常路径仍能消费,且**只消费一次**(成功之后才摘走,下一轮不再重复回复)。

测试隔离(AGENTS §5):全部用注入的假 Redis + monkeypatch 的 llm_gateway/api_client,
用例体内不调 initialize() / _init_redis(),不触达生产 PostgreSQL(8810)与 Redis(8811);
conftest 的 autouse 已把 settings.redis_url 指向 127.0.0.1:1(连接立即拒绝),
本文件的用例连那一步都不走。
"""

from __future__ import annotations

import asyncio
import json
import logging
from fnmatch import fnmatch
from typing import Any

import pytest

from app.services.im_bridge import (
    _DEAD_KEY_PREFIX,
    _MAX_DELIVERY_ATTEMPTS,
    ImBridgeService,
    QueueStatus,
)

# =============================================================================
# 假实现(只实现本服务用到的 get/set/delete/scan;scan 必须按 match glob 过滤 ——
# 否则死信 key 会被当成活动队列,测试就成了假阳)
# =============================================================================


class _FakeRedis:
    """最小 async Redis 替身:get / set / delete / scan(支持 glob match)。"""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}

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

    async def scan(self, cursor: int = 0, match: str | None = None, count: int | None = None):
        keys = sorted(self._data.keys())
        if match:
            keys = [k for k in keys if fnmatch(k, match)]
        return 0, keys


class _BrokenGetRedis(_FakeRedis):
    """get 直接抛错 —— 量「读不到」那一格,不得被读成空队列。"""

    async def get(self, key: str) -> str | None:
        raise ConnectionError("redis down")


class _FakeResponse:
    def __init__(self, status_code: int = 200, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class _FakeClient:
    def __init__(self, post_impl) -> None:
        self._post = post_impl

    async def post(self, url, json=None, headers=None):  # noqa: ANN001 - 替身签名对齐 httpx
        return await self._post(url, json=json, headers=headers)


# =============================================================================
# 夹具与助手
# =============================================================================

KEY = "im:inbound:u-123:wechat"
DEAD_KEY = _DEAD_KEY_PREFIX + "u-123:wechat"


def _inbound(text: str = "你好", chat_id: str = "chat-1") -> dict[str, Any]:
    return {"text": text, "chatId": chat_id}


def _make_service(redis: _FakeRedis | None = None) -> ImBridgeService:
    svc = ImBridgeService()
    if redis is not None:
        svc._redis = redis
    return svc


def _fill(redis: _FakeRedis, *messages: dict[str, Any]) -> None:
    redis._data[KEY] = json.dumps(list(messages), ensure_ascii=False)


def _queue(redis: _FakeRedis) -> list[Any]:
    raw = redis._data.get(KEY)
    return json.loads(raw) if raw else []


@pytest.fixture(autouse=True)
def _isolate_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """把发信地址与内部凭据钉成固定值,避免 .env 真值进入断言面。"""
    monkeypatch.setattr("app.core.config.settings.api_service_url", "http://api:8802")
    monkeypatch.setattr("app.core.config.settings.ai_callback_secret", "")


def _patch_llm(monkeypatch: pytest.MonkeyPatch, impl) -> None:
    import app.core.llm_gateway as llm_mod

    monkeypatch.setattr(llm_mod.llm_gateway, "complete", impl)


def _patch_send_ok(monkeypatch: pytest.MonkeyPatch, sent: list[dict[str, Any]]) -> None:
    async def fake_post(url, json=None, headers=None):  # noqa: ANN001
        sent.append({"url": url, "payload": json, "headers": headers})
        return _FakeResponse(status_code=200)

    monkeypatch.setattr("app.services.api_client.get_api_client", lambda: _FakeClient(fake_post))


async def _fake_llm_ok(messages, owner_uuid=None):  # noqa: ANN001
    return {"content": "收到"}


# =============================================================================
# ① 失败路径:消息仍在队列且可重投
# =============================================================================


async def test_handler_raises_leaves_message_and_redelivers_same_one(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """①处理抛错 ⇒ 消息仍在队列;下一轮重投的必须是同一条;重投成功才摘走。"""
    fake = _FakeRedis()
    payload = _inbound("第一条")
    _fill(fake, payload)
    svc = _make_service(fake)

    seen: list[dict[str, Any]] = []

    async def raise_once(key: str, msg: dict[str, Any]) -> bool:
        seen.append(msg)
        if len(seen) == 1:
            raise RuntimeError("handle boom")
        return True

    monkeypatch.setattr(svc, "_handle_message", raise_once)

    await svc._scan_and_consume()
    # 抛错之后:一条都没少
    assert _queue(fake) == [payload], "失败路径不得把消息摘走"
    assert svc.metrics_snapshot().get("committed") is None

    await svc._scan_and_consume()
    assert seen == [payload, payload], "重投的应是同一条消息"
    assert _queue(fake) == [], "成功之后才提交移除"
    assert svc.metrics_snapshot()["committed"] == 1


async def test_handler_returns_false_leaves_message_for_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """①的另一半:不是只有「抛错」才留 —— 返回 False(LLM/发送失败)同样不摘走。"""
    fake = _FakeRedis()
    payload = _inbound("发不出去")
    _fill(fake, payload)
    svc = _make_service(fake)

    calls: list[str] = []

    async def always_fail(key: str, msg: dict[str, Any]) -> bool:
        calls.append(key)
        return False

    monkeypatch.setattr(svc, "_handle_message", always_fail)

    await svc._scan_and_consume()

    assert calls == [KEY]
    assert _queue(fake) == [payload]
    assert svc.metrics_snapshot()["delivery_failures"] == 1
    assert svc.metrics_snapshot().get("committed") is None


async def test_multiple_messages_are_removed_one_by_one_only_on_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """①成对:两条排队、只成功一条时,只有成功那条被摘走,前面的 audit 历史不动。"""
    fake = _FakeRedis()
    first = _inbound("a")
    second = _inbound("b")
    _fill(fake, first, second)
    svc = _make_service(fake)

    async def fail_on_b(key: str, msg: dict[str, Any]) -> bool:
        return msg != second

    monkeypatch.setattr(svc, "_handle_message", fail_on_b)
    await svc._scan_and_consume()

    # 最后一条(b)投递失败 → 仍在;它前面的 a 从未被摘走
    assert _queue(fake) == [first, second]


# =============================================================================
# ② 解析失败:可观测的一格,且不被读成空队列
# =============================================================================


async def test_parse_failure_is_counted_status_and_error_log(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """②JSON 解析失败 ⇒ status=INVALID + parse_failures 计数 + ERROR 级日志 + 原文保留。"""
    fake = _FakeRedis()
    fake._data[KEY] = "not-json{{{"
    svc = _make_service(fake)

    with caplog.at_level(logging.ERROR, logger="app.services.im_bridge"):
        peeked = await svc._peek_last_message(KEY)

    assert peeked.status is QueueStatus.INVALID
    assert peeked.message is None
    assert fake._data[KEY] == "not-json{{{"  # 不得改写别人写坏的内容
    assert svc.metrics_snapshot()["parse_failures"] == 1
    assert svc._unreadable_count() == 1
    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert errors, "解析失败必须喊到 ERROR 级,不得只 warning"
    assert any("parse_failures" in r.getMessage() for r in errors)


async def test_truly_empty_queue_is_not_counted_as_unreadable(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """②的成对正向对照:真·空队列 ⇒ EMPTY 且零计数零告警。

    没有这一条,上一例只是「什么都喊红」。
    """
    fake = _FakeRedis()
    fake._data[KEY] = json.dumps([])
    svc = _make_service(fake)

    with caplog.at_level(logging.ERROR, logger="app.services.im_bridge"):
        peeked = await svc._peek_last_message(KEY)

    assert peeked.status is QueueStatus.EMPTY
    assert svc._unreadable_count() == 0
    assert svc.metrics_snapshot() == {}
    assert [r for r in caplog.records if r.levelno >= logging.ERROR] == []
    assert KEY not in fake._data  # 空列表脏数据照旧删除


async def test_missing_key_is_empty_not_error() -> None:
    """②成对:键不存在也是 EMPTY,与「读不到」不同格。"""
    svc = _make_service(_FakeRedis())
    peeked = await svc._peek_last_message(KEY)
    assert peeked.status is QueueStatus.EMPTY
    assert svc.metrics_snapshot() == {}


async def test_read_error_is_its_own_bucket_not_empty() -> None:
    """②成对:Redis 抛错 ⇒ ERROR 格 + read_errors 计数,绝不与 EMPTY 并桶。"""
    svc = _make_service(_BrokenGetRedis())
    peeked = await svc._peek_last_message(KEY)
    assert peeked.status is QueueStatus.ERROR
    assert svc.metrics_snapshot()["read_errors"] == 1
    assert svc._unreadable_count() == 1


async def test_non_list_payload_and_bad_tail_item_are_separate_buckets() -> None:
    """②成对:整体结构不对 / 尾部元素不是对象 ⇒ 两格各计各的,不合并。"""
    fake = _FakeRedis()
    fake._data[KEY] = json.dumps({"text": "x"})
    svc = _make_service(fake)
    peeked = await svc._peek_last_message(KEY)
    assert peeked.status is QueueStatus.INVALID
    assert svc.metrics_snapshot()["invalid_payloads"] == 1
    assert fake._data[KEY] == json.dumps({"text": "x"})  # 不猜、不改写

    other = _FakeRedis()
    good = _inbound("留着")
    other._data[KEY] = json.dumps([good, "not-a-dict"])
    svc2 = _make_service(other)
    peeked2 = await svc2._peek_last_message(KEY)
    assert peeked2.status is QueueStatus.INVALID
    assert svc2.metrics_snapshot()["invalid_items"] == 1
    # 毒丸元素被摘除,前面那条一条不少
    assert _queue(other) == [good]


# =============================================================================
# ③ 正向对照:正常路径仍能消费,且只消费一次
# =============================================================================


async def test_success_path_consumes_exactly_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③正向对照:成功回复 ⇒ 摘走 ⇒ 第二轮不再重复回复同一条。"""
    fake = _FakeRedis()
    _fill(fake, _inbound("在吗"))
    svc = _make_service(fake)

    sent: list[dict[str, Any]] = []
    _patch_llm(monkeypatch, _fake_llm_ok)
    _patch_send_ok(monkeypatch, sent)

    await svc._scan_and_consume()
    assert len(sent) == 1, "正常路径必须仍然回复"
    assert sent[0]["url"] == "http://api:8802/api/im-gateway/send"
    assert sent[0]["payload"]["text"] == "收到"
    assert KEY not in fake._data
    assert svc.metrics_snapshot()["committed"] == 1

    await svc._scan_and_consume()
    assert len(sent) == 1, "只消费一次:成功后不得重投"


async def test_peek_does_not_mutate_the_queue() -> None:
    """③成对:peek 本身一字不动队列(弹出发生在成功之后)。"""
    fake = _FakeRedis()
    _fill(fake, _inbound("a"), _inbound("b"))
    svc = _make_service(fake)

    peeked = await svc._peek_last_message(KEY)
    assert peeked.status is QueueStatus.READY
    assert peeked.message == _inbound("b")
    assert _queue(fake) == [_inbound("a"), _inbound("b")]

    # 提交之后才只剩 a
    assert await svc._commit_removal(KEY, _inbound("b")) is True
    assert _queue(fake) == [_inbound("a")]


async def test_commit_removal_keeps_messages_pushed_during_handling(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """③成对:处理期间写入方 push 的新消息,不得被旧快照写回抹掉(提交走重读而非整串覆盖)。"""
    fake = _FakeRedis()
    mine = _inbound("正在处理")
    _fill(fake, mine)
    svc = _make_service(fake)
    newcomer = _inbound("新来的")

    async def handle_and_have_writer_push(key: str, msg: dict[str, Any]) -> bool:
        current = json.loads(fake._data[key])
        current.append(newcomer)
        fake._data[key] = json.dumps(current, ensure_ascii=False)
        return True

    monkeypatch.setattr(svc, "_handle_message", handle_and_have_writer_push)
    assert await svc._consume_one(KEY) is True
    assert _queue(fake) == [newcomer], "只准摘走刚处理完那一条,新 push 的必须留着"


async def test_http_error_is_not_a_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    """③成对:路由回 4xx/5xx ⇒ 不算送达,消息留下(而不是「发过了就摘」)。"""
    fake = _FakeRedis()
    _fill(fake, _inbound("hi"))
    svc = _make_service(fake)

    async def fake_complete(messages, owner_uuid=None):  # noqa: ANN001
        return {"content": "收到"}

    async def fake_post(url, json=None, headers=None):  # noqa: ANN001
        return _FakeResponse(status_code=503, text="upstream busy")

    _patch_llm(monkeypatch, fake_complete)
    monkeypatch.setattr("app.services.api_client.get_api_client", lambda: _FakeClient(fake_post))

    await svc._scan_and_consume()
    assert _queue(fake) == [_inbound("hi")]
    assert svc.metrics_snapshot()["delivery_failures"] == 1


# =============================================================================
# 附加不变量(本次修复新引入的行为,成对钉住)
# =============================================================================


async def test_repeated_failures_move_to_dead_letter_and_stop_hot_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """连续失败达上限 ⇒ 移入 im:bridge:dead:*(可人工重投,不算丢),活动队列不再热循环。"""
    fake = _FakeRedis()
    payload = _inbound("永远失败")
    _fill(fake, payload)
    svc = _make_service(fake)

    rounds = {"n": 0}

    async def always_raise(key: str, msg: dict[str, Any]) -> bool:
        rounds["n"] += 1
        raise RuntimeError("provider down")

    monkeypatch.setattr(svc, "_handle_message", always_raise)

    for _ in range(_MAX_DELIVERY_ATTEMPTS):
        await svc._scan_and_consume()

    assert rounds["n"] == _MAX_DELIVERY_ATTEMPTS
    assert KEY not in fake._data, "达上限后必须移出活动队列"
    dead = json.loads(fake._data[DEAD_KEY])
    assert isinstance(dead, list) and len(dead) == 1
    assert dead[0]["message"] == payload
    assert dead[0]["attempts"] == _MAX_DELIVERY_ATTEMPTS
    assert dead[0]["queueKey"] == KEY
    assert svc.metrics_snapshot()["dead_lettered"] == 1

    # 死信 key 不在 SCAN 匹配面内 ⇒ 不会被反复捞回
    await svc._scan_and_consume()
    assert rounds["n"] == _MAX_DELIVERY_ATTEMPTS


async def test_cancellation_is_not_a_delivery_and_keeps_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """取消(shutdown 打断)不是投递失败:原样留队列,并把 CancelledError 抛回去。"""
    fake = _FakeRedis()
    payload = _inbound("正被打断")
    _fill(fake, payload)
    svc = _make_service(fake)

    async def cancelled(key: str, msg: dict[str, Any]) -> bool:
        raise asyncio.CancelledError()

    monkeypatch.setattr(svc, "_handle_message", cancelled)

    with pytest.raises(asyncio.CancelledError):
        await svc._consume_one(KEY)

    assert _queue(fake) == [payload]
    assert svc.metrics_snapshot().get("delivery_failures") is None


async def test_unanswered_message_is_acked_and_counted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """无文本/无 chatId:重投也没意义 ⇒ 可 ACK,但必须单独计一格(不与「已回复」混)。"""
    fake = _FakeRedis()
    junk = {"text": "", "chatId": ""}
    _fill(fake, junk)
    svc = _make_service(fake)

    llm_calls: list[Any] = []

    async def fake_complete(messages, owner_uuid=None):  # noqa: ANN001
        llm_calls.append(messages)
        return {"content": "不该被调用"}

    _patch_llm(monkeypatch, fake_complete)

    await svc._scan_and_consume()
    assert llm_calls == []
    assert KEY not in fake._data
    assert svc.metrics_snapshot()["skipped_unanswered"] == 1
    assert svc.metrics_snapshot()["committed"] == 1


async def test_bad_queue_key_format_is_not_silently_consumed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """key 格式坏(拿不出 userId)⇒ 回 False,不摘走;达上限后进死信而不是蒸发。"""
    fake = _FakeRedis()
    bad_key = "im:inbound:only-user"
    payload = _inbound("坏 key")
    fake._data[bad_key] = json.dumps([payload], ensure_ascii=False)
    svc = _make_service(fake)

    for _ in range(_MAX_DELIVERY_ATTEMPTS):
        await svc._consume_one(bad_key)

    assert bad_key not in fake._data, "达上限后必须移出活动队列"
    dead = json.loads(fake._data[_DEAD_KEY_PREFIX + "only-user"])
    assert dead[0]["message"] == payload
    assert dead[0]["reason"] == "delivery_failed"
    assert svc.metrics_snapshot()["delivery_failures"] == _MAX_DELIVERY_ATTEMPTS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
