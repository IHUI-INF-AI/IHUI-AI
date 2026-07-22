"""多平台一键发布模块测试。

测试覆盖(app/services/publish/* + app/routers/publish.py):
1. AES-256-GCM 凭证加密/解密(round-trip + 边界异常)
2. 凭证加密 key 缺失时降级处理(临时密钥仍可工作)
3. 平台适配器注册表(platform registry)完整性
4. 调度器 retry 逻辑(DB 不可用、cancel_task、submit_task)
5. 发布任务状态机(success/partial/failed)

设计:
- 不依赖真实 DB / 真实平台 API,通过 mock adapter 模拟发布成功/失败。
- credentials_crypto / base_adapter 是纯函数,直接 round-trip 测试。
- scheduler 单例的 DB 不可用路径(return None)走降级,无需 mock。
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.publish.base_adapter import (
    BasePlatformAdapter,
    PublishContent,
    PublishResult,
    get_adapter,
    list_all_adapter_classes,
)
from app.services.publish.credentials_crypto import (
    decrypt,
    encrypt,
    generate_key_b64,
)
from app.services.publish.scheduler import PublishScheduler, publish_scheduler


# =============================================================================
# 覆盖 conftest.py 中引用已废弃属性的 _isolate_vector_memory fixture。
# VectorMemoryStore 用 _entries / _vectors 而非 _store,_next_id 已移除。
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture(引用了不存在的 _store / _next_id)。
    同时清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# 1. AES-256-GCM 凭证加密/解密 round-trip
# =============================================================================


def test_credentials_encrypt_decrypt_roundtrip() -> None:
    """encrypt + decrypt round-trip 还原原始 dict。"""
    credentials = {"token": "abc123", "user_id": 42, "scopes": ["read", "write"]}
    cipher = encrypt(credentials)
    assert isinstance(cipher, str)
    # 密文应非空且不等于明文
    assert len(cipher) > 0
    assert "abc123" not in cipher
    # 解密还原
    restored = decrypt(cipher)
    assert restored == credentials


def test_credentials_encrypt_decrypt_unicode_values() -> None:
    """凭证包含中文/特殊字符时仍能 round-trip。"""
    credentials = {
        "name": "测试账号",
        "cookie": "session=中文; path=/",
        "nested": {"key": "值"},
    }
    cipher = encrypt(credentials)
    restored = decrypt(cipher)
    assert restored == credentials


def test_credentials_encrypt_produces_different_ciphers() -> None:
    """同一明文多次加密得到不同密文(IV 随机)。"""
    credentials = {"token": "same"}
    c1 = encrypt(credentials)
    c2 = encrypt(credentials)
    assert c1 != c2  # IV 不同 → 密文不同


def test_credentials_decrypt_empty_string_raises() -> None:
    """decrypt 空串抛 ValueError。"""
    with pytest.raises(ValueError, match="empty cipher"):
        decrypt("")


def test_credentials_decrypt_invalid_base64_raises() -> None:
    """decrypt 非 base64 字符串抛 ValueError。"""
    with pytest.raises(ValueError, match="invalid base64 cipher"):
        decrypt("!!!not-base64!!!")


def test_credentials_decrypt_short_blob_raises() -> None:
    """decrypt 长度不足的 blob(解 base64 后 < IV_LEN + tag)抛 ValueError。"""
    short_blob = base64.b64encode(b"short").decode("ascii")
    with pytest.raises(ValueError, match="cipher blob too short"):
        decrypt(short_blob)


def test_credentials_decrypt_tampered_blob_raises() -> None:
    """decrypt 被篡改的密文抛异常(GCM tag 校验失败)。"""
    credentials = {"token": "secret"}
    cipher = encrypt(credentials)
    # 翻转最后一个字符(篡改 tag)
    tampered = cipher[:-1] + ("A" if cipher[-1] != "A" else "B")
    with pytest.raises(Exception):
        decrypt(tampered)


# =============================================================================
# 2. 凭证加密 key 缺失时降级处理
# =============================================================================


def test_credentials_key_missing_falls_back_to_ephemeral(monkeypatch: pytest.MonkeyPatch) -> None:
    """PUBLISH_CREDENTIALS_KEY 未设置时仍能加解密(进程级临时密钥)。"""
    # 清空环境变量,强制走 ephemeral 路径
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    # 重置模块级 _KEY 缓存,让 _get_key 重新走 _load_key
    import app.services.publish.credentials_crypto as crypto_mod

    monkeypatch.setattr(crypto_mod, "_KEY", None)

    # 加解密应仍能工作(临时密钥)
    credentials = {"token": "fallback-test"}
    cipher = encrypt(credentials)
    restored = decrypt(cipher)
    assert restored == credentials


def test_credentials_key_invalid_falls_back_to_ephemeral(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PUBLISH_CREDENTIALS_KEY 设置但值非法时,降级到临时密钥(打印 warning)。"""
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", "!!!invalid-base64!!!")
    import app.services.publish.credentials_crypto as crypto_mod

    monkeypatch.setattr(crypto_mod, "_KEY", None)

    credentials = {"token": "invalid-key-test"}
    cipher = encrypt(credentials)
    assert decrypt(cipher) == credentials


def test_credentials_key_wrong_length_falls_back(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PUBLISH_CREDENTIALS_KEY 解码后长度非 32 字节 → 降级到临时密钥。"""
    # 16 字节短密钥(合法 base64,但长度不对)
    short_key = base64.b64encode(b"0" * 16).decode("ascii")
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", short_key)
    import app.services.publish.credentials_crypto as crypto_mod

    monkeypatch.setattr(crypto_mod, "_KEY", None)

    credentials = {"token": "short-key-test"}
    cipher = encrypt(credentials)
    assert decrypt(cipher) == credentials


def test_generate_key_b64_returns_valid_32_byte_key() -> None:
    """generate_key_b64 返回合法的 base64 编码 32 字节密钥。"""
    key_b64 = generate_key_b64()
    assert isinstance(key_b64, str)
    decoded = base64.b64decode(key_b64, validate=True)
    assert len(decoded) == 32  # AES-256 需要 32 字节密钥


def test_generate_key_b64_produces_different_keys() -> None:
    """generate_key_b64 每次调用返回不同密钥(随机生成)。"""
    k1 = generate_key_b64()
    k2 = generate_key_b64()
    assert k1 != k2


def test_encrypt_with_explicit_valid_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """显式设置合法 PUBLISH_CREDENTIALS_KEY 后,加解密使用该密钥。"""
    valid_key = generate_key_b64()
    monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", valid_key)
    import app.services.publish.credentials_crypto as crypto_mod

    monkeypatch.setattr(crypto_mod, "_KEY", None)

    credentials = {"token": "explicit-key-test"}
    cipher = encrypt(credentials)
    assert decrypt(cipher) == credentials


# =============================================================================
# 3. 平台适配器注册表
# =============================================================================


def test_list_all_adapter_classes_returns_at_least_9_http_adapters() -> None:
    """list_all_adapter_classes 至少返回 9 个 HTTP 适配器(Playwright 可选)。"""
    classes = list_all_adapter_classes()
    assert len(classes) >= 9
    # 9 个 HTTP 适配器的 platform_id 都应非空
    for cls in classes:
        assert cls.platform_id, f"{cls.__name__} 缺少 platform_id"
        assert cls.platform_name, f"{cls.__name__} 缺少 platform_name"


def test_list_all_adapter_classes_includes_core_platforms() -> None:
    """9 个核心 HTTP 平台都在注册表里(WordPress/Medium/YouTube/Bilibili/Wechat/Toutiao/Douyin/Kuaishou/Weibo)。"""
    classes = list_all_adapter_classes()
    platform_ids = {cls.platform_id for cls in classes}
    expected = {"wordpress", "medium", "youtube", "bilibili", "wechat", "toutiao", "douyin", "kuaishou", "weibo"}
    missing = expected - platform_ids
    assert not missing, f"缺少核心平台适配器: {missing}"


def test_adapter_classes_have_class_attrs() -> None:
    """每个适配器类都有 platform_id / platform_name / supported_formats / requires_credentials 类属性。"""
    classes = list_all_adapter_classes()
    for cls in classes:
        assert hasattr(cls, "platform_id")
        assert hasattr(cls, "platform_name")
        assert hasattr(cls, "supported_formats")
        assert hasattr(cls, "requires_credentials")
        assert hasattr(cls, "needs_browser")
        assert isinstance(cls.supported_formats, list)
        assert isinstance(cls.requires_credentials, list)


def test_get_adapter_returns_instance_for_known_platform() -> None:
    """get_adapter 对已知平台返回适配器实例。"""
    adapter = get_adapter("wordpress")
    assert adapter is not None
    assert isinstance(adapter, BasePlatformAdapter)
    assert adapter.platform_id == "wordpress"


def test_get_adapter_returns_none_for_unknown_platform() -> None:
    """get_adapter 对未知平台返回 None。"""
    adapter = get_adapter("nonexistent-platform-xyz")
    assert adapter is None


def test_publish_result_dataclass_defaults() -> None:
    """PublishResult dataclass 默认值正确。"""
    r = PublishResult(success=True, platform="wordpress")
    assert r.success is True
    assert r.platform == "wordpress"
    assert r.published_url is None
    assert r.platform_content_id is None
    assert r.error_message is None
    assert r.duration_ms == 0
    assert r.payload == {}


def test_publish_content_dataclass_defaults() -> None:
    """PublishContent dataclass 默认值正确。"""
    c = PublishContent(format="md", title="测试标题")
    assert c.format == "md"
    assert c.title == "测试标题"
    assert c.text is None
    assert c.file_path is None
    assert c.cover_path is None
    assert c.html is None
    assert c.images == []
    assert c.extra == {}


# =============================================================================
# 4. 调度器 retry 逻辑(DB 不可用、cancel_task、submit_task)
# =============================================================================


def test_scheduler_list_running_initially_empty() -> None:
    """新 PublishScheduler 实例 list_running 返回空列表。"""
    sched = PublishScheduler()
    assert sched.list_running() == []


def test_scheduler_list_history_initially_empty() -> None:
    """新 PublishScheduler 实例 list_history 返回空列表。"""
    sched = PublishScheduler()
    assert sched.list_history() == []


async def test_scheduler_cancel_nonexistent_task_returns_false() -> None:
    """cancel_task 对不存在的 task_id 返回 False。"""
    sched = PublishScheduler()
    result = await sched.cancel_task("nonexistent-task-id")
    assert result is False


async def test_scheduler_retry_platforms_db_unavailable_returns_error() -> None:
    """retry_platforms 在 DB 不可用时返回 {'ok': False, 'error': 'db unavailable'}。"""
    sched = PublishScheduler()
    # mock _get_conn 返回 None(模拟 DB 不可用)
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    result = await sched.retry_platforms("some-task-id")
    assert result["ok"] is False
    assert result["error"] == "db unavailable"


async def test_scheduler_submit_task_immediate_returns_running() -> None:
    """submit_task 无 scheduled_at 时返回 status=running(立即执行)。"""
    sched = PublishScheduler()
    # mock DB 不可用(submit_task 仍能执行,只是不持久化)
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    # mock _spawn_task 避免真正创建 task(防止 _run_task 真的跑起来)
    spawned: list[Any] = []
    sched._spawn_task = lambda coro: spawned.append(coro)  # type: ignore[assignment]
    content = PublishContent(format="md", title="测试", text="hello")
    targets = [{"platform": "wordpress", "account_id": 1, "config": {}}]
    result = await sched.submit_task("task-1", "user-1", content, targets)
    assert result["ok"] is True
    assert result["status"] == "running"
    assert result["task_id"] == "task-1"
    # 立即执行应触发 _spawn_task
    assert len(spawned) == 1


async def test_scheduler_submit_task_scheduled_returns_scheduled() -> None:
    """submit_task 带 scheduled_at 时返回 status=scheduled(不立即执行)。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    # mock _spawn_task 验证 scheduled 任务不触发立即执行
    spawned: list[Any] = []
    sched._spawn_task = lambda coro: spawned.append(coro)  # type: ignore[assignment]
    content = PublishContent(format="md", title="定时任务", text="hello")
    targets = [{"platform": "wordpress", "account_id": 1, "config": {}}]
    scheduled_at = datetime(2099, 1, 1, tzinfo=timezone.utc)
    result = await sched.submit_task("task-2", "user-1", content, targets, scheduled_at=scheduled_at)
    assert result["ok"] is True
    assert result["status"] == "scheduled"
    assert result["scheduled_at"] == scheduled_at.isoformat()
    # 定时任务不应触发 _spawn_task
    assert len(spawned) == 0


# =============================================================================
# 5. 发布任务状态机(success/partial/failed)
# =============================================================================


async def test_scheduler_run_task_no_targets_returns_failed_status() -> None:
    """_run_task 无目标平台时,状态机判定为 failed(无目标平台)。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    # mock notifications 避免真实推送
    from app.services.publish import notifications

    notifications.notify_publish_complete = AsyncMock(return_value={"sio": False, "db": False})  # type: ignore[assignment]
    content = PublishContent(format="md", title="空任务", text="hello")
    # 无 targets
    await sched._run_task("task-empty", "user-1", content, [])

    history = sched.list_history(limit=10)
    assert len(history) == 1
    assert history[0]["status"] == "failed"
    assert history[0]["total"] == 0
    assert history[0]["success_count"] == 0


async def test_scheduler_run_task_all_success_returns_success_status() -> None:
    """_run_task 所有平台成功时,状态机判定为 success。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    from app.services.publish import notifications

    notifications.notify_publish_complete = AsyncMock(return_value={"sio": False, "db": False})  # type: ignore[assignment]
    # mock _run_single_platform 返回成功
    async def _fake_single(task_id, user_id, content, target):  # type: ignore[no-untyped-def]
        return PublishResult(success=True, platform=target["platform"], published_url="https://example.com/post")

    sched._run_single_platform = _fake_single  # type: ignore[assignment]
    content = PublishContent(format="md", title="全部成功", text="hello")
    targets = [
        {"platform": "wordpress", "account_id": 1, "config": {}},
        {"platform": "medium", "account_id": 2, "config": {}},
    ]
    await sched._run_task("task-success", "user-1", content, targets)

    history = sched.list_history(limit=10)
    assert len(history) == 1
    assert history[0]["status"] == "success"
    assert history[0]["total"] == 2
    assert history[0]["success_count"] == 2


async def test_scheduler_run_task_all_fail_returns_failed_status() -> None:
    """_run_task 所有平台失败时,状态机判定为 failed。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    from app.services.publish import notifications

    notifications.notify_publish_complete = AsyncMock(return_value={"sio": False, "db": False})  # type: ignore[assignment]
    async def _fake_single(task_id, user_id, content, target):  # type: ignore[no-untyped-def]
        return PublishResult(success=False, platform=target["platform"], error_message="发布失败")

    sched._run_single_platform = _fake_single  # type: ignore[assignment]
    content = PublishContent(format="md", title="全部失败", text="hello")
    targets = [
        {"platform": "wordpress", "account_id": 1, "config": {}},
        {"platform": "medium", "account_id": 2, "config": {}},
    ]
    await sched._run_task("task-failed", "user-1", content, targets)

    history = sched.list_history(limit=10)
    assert len(history) == 1
    assert history[0]["status"] == "failed"
    assert history[0]["total"] == 2
    assert history[0]["success_count"] == 0


async def test_scheduler_run_task_partial_returns_partial_status() -> None:
    """_run_task 部分平台成功时,状态机判定为 partial。"""
    sched = PublishScheduler()
    sched._get_conn = AsyncMock(return_value=None)  # type: ignore[assignment]
    from app.services.publish import notifications

    notifications.notify_publish_complete = AsyncMock(return_value={"sio": False, "db": False})  # type: ignore[assignment]
    # mock: wordpress 成功,medium 失败
    async def _fake_single(task_id, user_id, content, target):  # type: ignore[no-untyped-def]
        if target["platform"] == "wordpress":
            return PublishResult(success=True, platform="wordpress", published_url="https://wp.com/post")
        return PublishResult(success=False, platform=target["platform"], error_message="失败")

    sched._run_single_platform = _fake_single  # type: ignore[assignment]
    content = PublishContent(format="md", title="部分成功", text="hello")
    targets = [
        {"platform": "wordpress", "account_id": 1, "config": {}},
        {"platform": "medium", "account_id": 2, "config": {}},
        {"platform": "bilibili", "account_id": 3, "config": {}},
    ]
    await sched._run_task("task-partial", "user-1", content, targets)

    history = sched.list_history(limit=10)
    assert len(history) == 1
    assert history[0]["status"] == "partial"
    assert history[0]["total"] == 3
    assert history[0]["success_count"] == 1


# =============================================================================
# 6. HTTP 端点(路由层)
# =============================================================================


async def test_publish_platforms_endpoint(client) -> None:
    """GET /api/publish/platforms 返回所有支持的平台元数据。"""
    resp = await client.get("/api/publish/platforms")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "count" in data
    assert data["count"] >= 9
    assert len(data["items"]) == data["count"]
    # 每个平台都应有 platformId / platformName
    for item in data["items"]:
        assert "platformId" in item
        assert "platformName" in item
        assert "supportedFormats" in item
        assert "requiresCredentials" in item
        assert "needsBrowser" in item


async def test_publish_credentials_key_generate_endpoint(client) -> None:
    """GET /api/publish/credentials-key/generate 返回合法 base64 密钥。"""
    resp = await client.get("/api/publish/credentials-key/generate")
    assert resp.status_code == 200
    data = resp.json()
    assert "key" in data
    # 解码验证是 32 字节
    decoded = base64.b64decode(data["key"], validate=True)
    assert len(decoded) == 32


async def test_publish_running_endpoint(client) -> None:
    """GET /api/publish/running 返回当前运行中任务 + 历史。"""
    resp = await client.get("/api/publish/running")
    assert resp.status_code == 200
    data = resp.json()
    assert "running" in data
    assert "history" in data
    assert isinstance(data["running"], list)
    assert isinstance(data["history"], list)
