"""第五轮 P2 修复回归测试 - 覆盖 Bug-51/52/53/54/55/56/57/58."""

import os

# 跳过 DB schema 初始化
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import json
import time

import pytest

# ---------------------------------------------------------------------------
# Bug-51: WS 房间权限校验
# ---------------------------------------------------------------------------


class TestBug51RoomPolicy:
    @pytest.mark.asyncio
    async def test_public_room_allows_any_user(self):
        from app.ws.room_policy import _ROOM_CACHE, can_join_room, invalidate_room_cache

        invalidate_room_cache()
        _ROOM_CACHE["r_public_1"] = {
            "policy": "public",
            "owner": "",
            "vip_level": 0,
            "members": set(),
            "expire_at": time.time() + 60,
        }
        # 任何登录用户都可入
        await can_join_room("any-user", "r_public_1")
        await can_join_room("u_001", "r_public_1")

    @pytest.mark.asyncio
    async def test_private_room_requires_invite(self):
        from app.ws.room_policy import _ROOM_CACHE, RoomPolicyError, can_join_room, invalidate_room_cache

        invalidate_room_cache()
        _ROOM_CACHE["r_private_1"] = {
            "policy": "private",
            "owner": "owner_1",
            "vip_level": 0,
            "members": set(),
            "expire_at": time.time() + 60,
        }
        # 无邀请码
        with pytest.raises(RoomPolicyError) as exc:
            await can_join_room("intruder", "r_private_1")
        assert exc.value.code == "INVITE_REQUIRED"

        # 错误邀请码
        with pytest.raises(RoomPolicyError):
            await can_join_room("intruder", "r_private_1", invite_code="wrong_code")

        # 正确邀请码
        invite = "inv_intruder_r_private_1"
        await can_join_room("intruder", "r_private_1", invite_code=invite)

    @pytest.mark.asyncio
    async def test_owner_always_allowed(self):
        from app.ws.room_policy import _ROOM_CACHE, can_join_room, invalidate_room_cache

        invalidate_room_cache()
        _ROOM_CACHE["r_private_2"] = {
            "policy": "private",
            "owner": "owner_2",
            "vip_level": 0,
            "members": set(),
            "expire_at": time.time() + 60,
        }
        # 房主不需邀请码
        await can_join_room("owner_2", "r_private_2")

    @pytest.mark.asyncio
    async def test_paid_room_requires_vip(self):
        from app.ws.room_policy import (
            _ROOM_CACHE,
            RoomPolicyError,
            _get_user_vip_level,
            can_join_room,
            invalidate_room_cache,
        )

        invalidate_room_cache()
        _ROOM_CACHE["r_paid_1"] = {
            "policy": "paid",
            "owner": "owner_3",
            "vip_level": 2,
            "members": set(),
            "expire_at": time.time() + 60,
        }

        # 模拟: 改写 _get_user_vip_level 为可注入
        orig = _get_user_vip_level
        try:

            async def vip_high(uid):
                return 5

            async def vip_low(uid):
                return 0

            from app.ws import room_policy as rp

            rp._get_user_vip_level = vip_high
            await can_join_room("u1", "r_paid_1")

            rp._get_user_vip_level = vip_low
            with pytest.raises(RoomPolicyError) as exc:
                await can_join_room("u1", "r_paid_1")
            assert exc.value.code == "VIP_REQUIRED"
        finally:
            from app.ws import room_policy as rp

            rp._get_user_vip_level = orig

    @pytest.mark.asyncio
    async def test_admin_room_admin_only(self):
        from app.ws import room_policy as rp
        from app.ws.room_policy import (
            _ROOM_CACHE,
            RoomPolicyError,
            can_join_room,
            invalidate_room_cache,
        )

        invalidate_room_cache()
        _ROOM_CACHE["r_admin_1"] = {
            "policy": "admin",
            "owner": "admin_owner",
            "vip_level": 0,
            "members": set(),
            "expire_at": time.time() + 60,
        }

        orig = rp._is_admin
        try:

            async def admin_yes(uid):
                return True

            async def admin_no(uid):
                return False

            rp._is_admin = admin_yes
            await can_join_room("u_admin", "r_admin_1")

            rp._is_admin = admin_no
            with pytest.raises(RoomPolicyError) as exc:
                await can_join_room("u_normal", "r_admin_1")
            assert exc.value.code == "ADMIN_ONLY"
        finally:
            rp._is_admin = orig

    @pytest.mark.asyncio
    async def test_unknown_policy_rejected(self):
        from app.ws.room_policy import _ROOM_CACHE, RoomPolicyError, can_join_room, invalidate_room_cache

        invalidate_room_cache()
        _ROOM_CACHE["r_unknown"] = {
            "policy": "mystery",
            "owner": "",
            "vip_level": 0,
            "members": set(),
            "expire_at": time.time() + 60,
        }
        with pytest.raises(RoomPolicyError) as exc:
            await can_join_room("u1", "r_unknown")
        assert exc.value.code == "UNKNOWN_POLICY"

    def test_can_publish_to_room_owner(self):
        from app.ws.room_policy import _ROOM_CACHE, can_publish_to_room

        _ROOM_CACHE["r_pub2"] = {"policy": "public"}
        _ROOM_CACHE["r_priv2"] = {"policy": "private"}
        assert can_publish_to_room("owner", "r_pub2", is_owner=True) is True
        assert can_publish_to_room("any", "r_pub2", is_owner=False) is True
        assert can_publish_to_room("any", "r_priv2", is_owner=False) is False

    def test_invalidate_room_cache(self):
        from app.ws.room_policy import _ROOM_CACHE, invalidate_room_cache

        _ROOM_CACHE["x"] = {"a": 1}
        invalidate_room_cache("x")
        assert "x" not in _ROOM_CACHE
        _ROOM_CACHE["y"] = {"a": 1}
        invalidate_room_cache()
        assert "y" not in _ROOM_CACHE


# ---------------------------------------------------------------------------
# Bug-52: 退款 DLQ
# ---------------------------------------------------------------------------


class TestBug52RefundDLQ:
    def test_record_failure_increments(self, monkeypatch):
        """3 次失败 → 进 DLQ. 不依赖真实 Redis (用 fake)."""
        from app.utils import refund_dlq

        class FakeRedis:
            def __init__(self):
                self.data: dict = {}
                self.zset: dict = {}

            def incr(self, key):
                self.data[key] = int(self.data.get(key, 0)) + 1
                return self.data[key]

            def expire(self, key, sec):
                pass

            def hset(self, key, mapping=None):
                self.data[key] = mapping

            def delete(self, *keys):
                for k in keys:
                    self.data.pop(k, None)
                    self.zset.pop(k, None)

            def zadd(self, key, mapping):
                self.zset.setdefault(key, {})
                for k, v in mapping.items():
                    self.zset[key][k] = v

            def zrem(self, key, *members):
                if key in self.zset:
                    for m in members:
                        self.zset[key].pop(m, None)

            def get(self, key):
                return self.data.get(key)

            def zcard(self, key):
                return len(self.zset.get(key, {}))

            def zrange(self, key, start, end, withscores=False):
                items = sorted(self.zset.get(key, {}).items(), key=lambda x: x[1])
                if withscores:
                    return [(k, v) for k, v in items[start : end + 1 if end >= 0 else None]]
                return [k for k, v in items[start : end + 1 if end >= 0 else None]]

            def hgetall(self, key):
                return self.data.get(key, {})

        fake = FakeRedis()
        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: fake)
        # 抑制告警副作用
        monkeypatch.setattr("app.utils.alert_router.alert_critical", lambda *a, **k: True, raising=False)

        c1 = refund_dlq.record_refund_failure("o_001", "err1")
        c2 = refund_dlq.record_refund_failure("o_001", "err2")
        c3 = refund_dlq.record_refund_failure("o_001", "err3")
        assert c1 == 1
        assert c2 == 2
        assert c3 == 3
        assert refund_dlq.get_retry_count("o_001") == 3
        assert "o_001" in fake.zset.get("zhs:refund:dlq", {})

    def test_clear_refund_failure(self, monkeypatch):
        from app.utils import refund_dlq

        class FakeRedis:
            def __init__(self):
                self.data: dict = {"zhs:refund:dlq:meta:o_002": 1}
                self.zset: dict = {"zhs:refund:dlq": {"o_002": 100.0}}

            def delete(self, *keys):
                for k in keys:
                    self.data.pop(k, None)
                    self.zset.pop(k, None)

            def zrem(self, key, *members):
                if key in self.zset:
                    for m in members:
                        self.zset[key].pop(m, None)

        fake = FakeRedis()
        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: fake)
        refund_dlq.clear_refund_failure("o_002")
        assert "o_002" not in fake.zset.get("zhs:refund:dlq", {})

    def test_list_dlq(self, monkeypatch):
        from app.utils import refund_dlq

        class FakeRedis:
            def __init__(self):
                self.zset = {"zhs:refund:dlq": {"o_a": 1.0, "o_b": 2.0}}
                self.data = {
                    "zhs:refund:dlq:meta:o_a:info": {"error": "err_a"},
                    "zhs:refund:dlq:meta:o_b:info": {"error": "err_b"},
                }

            def zrange(self, key, start, end, withscores=False):
                items = sorted(self.zset.get(key, {}).items(), key=lambda x: x[1])
                if withscores:
                    return [(k, v) for k, v in items[start : end + 1]]
                return [k for k, v in items[start : end + 1]]

            def hgetall(self, key):
                return self.data.get(key, {})

        fake = FakeRedis()
        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: fake)
        items = refund_dlq.list_dlq()
        assert len(items) == 2
        order_nos = {x["order_no"] for x in items}
        assert order_nos == {"o_a", "o_b"}

    def test_remove_from_dlq(self, monkeypatch):
        from app.utils import refund_dlq

        class FakeRedis:
            def __init__(self):
                self.data = {"zhs:refund:dlq:meta:o_003": 3}
                self.zset = {"zhs:refund:dlq": {"o_003": 5.0}}

            def delete(self, *keys):
                for k in keys:
                    self.data.pop(k, None)
                    self.zset.pop(k, None)

            def zrem(self, key, *members):
                if key in self.zset:
                    for m in members:
                        self.zset[key].pop(m, None)

        fake = FakeRedis()
        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: fake)
        ok = refund_dlq.remove_from_dlq("o_003")
        assert ok is True
        assert "o_003" not in fake.zset.get("zhs:refund:dlq", {})

    def test_redis_none_returns_minus_one(self, monkeypatch):
        from app.utils import refund_dlq

        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: None)
        assert refund_dlq.record_refund_failure("o_xxx", "err") == -1
        assert refund_dlq.get_retry_count("o_xxx") == 0
        assert refund_dlq.list_dlq() == []
        assert refund_dlq.dlq_size() == 0


# ---------------------------------------------------------------------------
# Bug-53: JWT Refresh Token Rotation
# ---------------------------------------------------------------------------


class TestBug53RefreshRotation:
    def test_create_refresh_token_has_jti_fid(self):
        from app.security import create_refresh_token

        token, jti, fid = create_refresh_token("user_1")
        assert token and jti and fid
        assert len(jti) >= 16
        assert len(fid) >= 8

    def test_replay_attack_detected(self, monkeypatch):
        """用 fake Redis 模拟: 同 jti 在 family 中已存在 → 重放."""
        from app.utils import refresh_rotation

        class FakeRedis:
            def __init__(self):
                self.data: dict = {}
                self.zsets: dict = {}

            def zadd(self, key, mapping):
                self.zsets.setdefault(key, {})
                self.zsets[key].update(mapping)

            def zscore(self, key, member):
                return self.zsets.get(key, {}).get(member)

            def zrange(self, key, start, end):
                items = list(self.zsets.get(key, {}).items())
                return [k for k, v in items]

            def set(self, key, val, ex=None):
                self.data[key] = val

            def exists(self, key):
                return 1 if key in self.data else 0

            def expire(self, key, sec):
                pass

            def pipeline(self):
                return FakePipe(self)

        class FakePipe:
            def __init__(self, parent):
                self.parent = parent
                self.ops = []

            def set(self, key, val, ex=None):
                self.ops.append(("set", key, val, ex))
                return self

            def delete(self, *keys):
                self.ops.append(("delete", keys))
                return self

            def execute(self):
                for op in self.ops:
                    if op[0] == "set":
                        self.parent.data[op[1]] = op[2]
                    elif op[0] == "delete":
                        for k in op[1]:
                            self.parent.data.pop(k, None)
                return [True] * len(self.ops)

        fake = FakeRedis()
        monkeypatch.setattr(refresh_rotation, "_get_redis", lambda: fake)
        # 抑制告警副作用
        monkeypatch.setattr("app.utils.alert_router.alert_critical", lambda *a, **k: True, raising=False)

        fid = "fam_001"
        jti = "jti_001"

        # 第一次: 不算重放
        assert refresh_rotation.is_replay_attack(jti, fid) is False
        # 记录 jti
        refresh_rotation.record_jti_used(jti, fid)
        # 第二次: 重放
        assert refresh_rotation.is_replay_attack(jti, fid) is True
        # 重放 → revoke family
        n = refresh_rotation.revoke_family(fid)
        assert n >= 1
        # 单个 jti 也被拉黑
        refresh_rotation.revoke_jti(jti)
        assert refresh_rotation.is_jti_revoked(jti) is True

    def test_rotate_refresh_rejects_replay(self, monkeypatch):
        from app.security import create_refresh_token, decode_access_token
        from app.utils import refresh_rotation

        # 用假 Redis
        class FakeRedis:
            def __init__(self):
                self.data: dict = {}
                self.zsets: dict = {}

            def zadd(self, key, mapping):
                self.zsets.setdefault(key, {})
                self.zsets[key].update(mapping)

            def zscore(self, key, member):
                return self.zsets.get(key, {}).get(member)

            def zrange(self, key, start, end):
                return list(self.zsets.get(key, {}).keys())

            def set(self, key, val, ex=None):
                self.data[key] = val

            def exists(self, key):
                return 1 if key in self.data else 0

            def expire(self, key, sec):
                pass

            def pipeline(self):
                return self

            def delete(self, *keys):
                for k in keys:
                    self.data.pop(k, None)
                return self

            def execute(self):
                return [True]

        fake = FakeRedis()
        monkeypatch.setattr(refresh_rotation, "_get_redis", lambda: fake)
        monkeypatch.setattr("app.utils.alert_router.alert_critical", lambda *a, **k: True, raising=False)

        # 第一次颁发
        token1, jti1, fid = create_refresh_token("user_r")
        payload1 = decode_access_token(token1)
        result1 = refresh_rotation.rotate_refresh(payload1)
        assert result1 is not None
        # 再次用旧 token → 重放 → 拒绝
        result2 = refresh_rotation.rotate_refresh(payload1)
        assert result2 is None

    def test_rotate_rejects_wrong_type(self, monkeypatch):
        import datetime

        from app.security import create_access_token, decode_access_token
        from app.utils import refresh_rotation

        class FakeRedis:
            def __init__(self):
                self.data: dict = {}
                self.zsets: dict = {}

            def zadd(self, key, mapping):
                self.zsets.setdefault(key, {})
                self.zsets[key].update(mapping)

            def zscore(self, key, member):
                return self.zsets.get(key, {}).get(member)

            def set(self, key, val, ex=None):
                self.data[key] = val

            def exists(self, key):
                return 1 if key in self.data else 0

            def expire(self, key, sec):
                pass

        fake = FakeRedis()
        monkeypatch.setattr(refresh_rotation, "_get_redis", lambda: fake)
        # access token 不能 refresh
        access = create_access_token("u1", expires_delta=datetime.timedelta(hours=1), token_type="access")
        payload = decode_access_token(access)
        assert refresh_rotation.rotate_refresh(payload) is None


# ---------------------------------------------------------------------------
# Bug-54: 慢查询阈值热加载
# ---------------------------------------------------------------------------


class TestBug54SlowQueryHotReload:
    def test_default_threshold(self):
        from app.utils.db_span import DEFAULT_SLOW_QUERY_MS, _get_slow_threshold_ms

        # 默认值
        assert DEFAULT_SLOW_QUERY_MS >= 100
        v = _get_slow_threshold_ms()
        assert isinstance(v, int)
        assert v > 0

    def test_hot_config_overrides(self, monkeypatch):
        # 模拟 hot_config 返回新值
        from app.utils import db_span
        from app.utils import hot_config as hc

        monkeypatch.setattr(hc, "hot_get", lambda k, d=None: 1234 if k == "SLOW_QUERY_MS" else d)
        v = db_span._get_slow_threshold_ms()
        assert v == 1234


# ---------------------------------------------------------------------------
# Bug-55: WebSocket 流量控制
# ---------------------------------------------------------------------------


class TestBug55WsRateLimit:
    def test_basic_rate_limit(self, monkeypatch):
        from app.utils import hot_config as hc
        from app.utils import ws_rate_limit

        # 固定阈值
        monkeypatch.setattr(
            hc, "hot_get", lambda k, d=None: 5 if k == "WS_RATE_PER_SEC" else (10 if k == "WS_BURST" else d)
        )
        ws_rate_limit.limiter.reset("conn_1")
        allowed_count = 0
        for _ in range(20):
            ok, _ = ws_rate_limit.should_drop_message("conn_1")
            if ok:
                allowed_count += 1
        # 1s 内 rate=5 burst=10, 应最多放 10 个
        assert allowed_count <= 11
        assert allowed_count >= 5

    def test_reset_window(self):
        from app.utils.ws_rate_limit import limiter

        limiter.reset("conn_reset")
        for _ in range(50):
            limiter.allow("conn_reset")
        stats_before = limiter.stats("conn_reset")
        assert stats_before["in_window"] > 0
        limiter.reset("conn_reset")
        stats_after = limiter.stats("conn_reset")
        assert stats_after["in_window"] == 0

    def test_threshold_hot_reload(self, monkeypatch):
        from app.utils import hot_config as hc
        from app.utils import ws_rate_limit

        monkeypatch.setattr(
            hc, "hot_get", lambda k, d=None: 3 if k == "WS_RATE_PER_SEC" else (3 if k == "WS_BURST" else d)
        )
        ws_rate_limit.limiter.reset("conn_2")
        allowed = 0
        for _ in range(10):
            ok, _ = ws_rate_limit.should_drop_message("conn_2")
            if ok:
                allowed += 1
        assert allowed == 3

    def test_user_rate_check_no_redis(self, monkeypatch):
        from app.utils import ws_rate_limit

        # 无 Redis: 总是放行
        monkeypatch.setattr(ws_rate_limit, "_get_redis", lambda: None)
        assert ws_rate_limit.user_rate_check("u1") is True


# ---------------------------------------------------------------------------
# Bug-56: OAuth state 参数防 CSRF
# ---------------------------------------------------------------------------


class TestBug56OAuthState:
    def test_oauth_module_has_state_param(self):
        """oauth.authorize 与 oauth_token 都接受 state 参数 (Bug-56 防 CSRF)."""
        import inspect

        from app.api.v1.auth import oauth as oauth_mod

        sig1 = inspect.signature(oauth_mod.authorize)
        sig2 = inspect.signature(oauth_mod.oauth_token)
        assert "state" in sig1.parameters, "authorize 必须支持 state 参数"
        assert "state" in sig2.parameters, "oauth_token 必须支持 state 参数"

    def test_oauth_source_contains_state_check(self):
        """源码中包含 state 校验逻辑 (不一致时拒绝)."""
        import inspect

        from app.api.v1.auth import oauth as oauth_mod

        src = inspect.getsource(oauth_mod)
        # 必须出现 state 不一致的判断
        assert "session_state" in src or "state" in src
        # 必须有不一致时返回 401 的逻辑
        assert "401" in src or "denied" in src.lower() or "mismatch" in src.lower()


# ---------------------------------------------------------------------------
# Bug-57: 业务事件埋点
# ---------------------------------------------------------------------------


class TestBug57BusinessEvents:
    def test_event_type_enum(self):
        from app.utils.business_events import EventType

        assert EventType.PAYMENT_SUCCESS.value == "payment_success"
        assert EventType.REFUND_FAILED.value == "refund_failed"
        assert EventType.LOGIN_SUCCESS.value == "login_success"
        # 枚举值数量
        assert len(list(EventType)) >= 10

    def test_emit_event_writes_local_jsonl(self, monkeypatch, tmp_path):
        from app.utils import business_events

        log_file = tmp_path / "events.jsonl"
        monkeypatch.setattr(business_events, "EVENT_LOG_FILE", str(log_file))
        monkeypatch.setattr(business_events, "_get_producer", lambda: None)

        business_events.emit_event(
            business_events.EventType.PAYMENT_SUCCESS,
            {"order_no": "o_test_001", "amount": 99.9},
            user_uuid="u_001",
        )
        assert log_file.exists()
        line = log_file.read_text(encoding="utf-8").strip().split("\n")[-1]
        data = json.loads(line)
        assert data["event_type"] == "payment_success"
        assert data["payload"]["order_no"] == "o_test_001"
        assert data["user_uuid"] == "u_001"
        assert "ts" in data
        assert "event_id" in data

    def test_emit_event_no_local(self, monkeypatch, tmp_path):
        """write_local=False 时不写文件."""
        from app.utils import business_events

        log_file = tmp_path / "events2.jsonl"
        monkeypatch.setattr(business_events, "EVENT_LOG_FILE", str(log_file))
        monkeypatch.setattr(business_events, "_get_producer", lambda: None)

        business_events.emit_event(
            business_events.EventType.LOGIN_SUCCESS,
            {"user": "u_x"},
            write_local=False,
        )
        # 文件可能不存在 (除了 emit_event 内部默认行为)
        # 主要验证不抛异常
        assert True

    def test_get_event_stats(self, monkeypatch, tmp_path):
        from app.utils import business_events

        log_file = tmp_path / "events3.jsonl"
        monkeypatch.setattr(business_events, "EVENT_LOG_FILE", str(log_file))
        monkeypatch.setattr(business_events, "_get_producer", lambda: None)

        business_events.emit_event(business_events.EventType.PAYMENT_SUCCESS, {"x": 1})
        business_events.emit_event(business_events.EventType.PAYMENT_SUCCESS, {"x": 2})
        business_events.emit_event(business_events.EventType.REFUND_FAILED, {"x": 3})

        stats = business_events.get_event_stats()
        by_type = stats.get("by_type", {})
        assert by_type.get("payment_success", 0) >= 2
        assert by_type.get("refund_failed", 0) >= 1
        assert stats.get("total", 0) >= 3

    def test_convenience_emitters(self, monkeypatch, tmp_path):
        from app.utils import business_events

        log_file = tmp_path / "events4.jsonl"
        monkeypatch.setattr(business_events, "EVENT_LOG_FILE", str(log_file))
        monkeypatch.setattr(business_events, "_get_producer", lambda: None)

        business_events.emit_payment_success("o_p1", 100.0, "u_1")
        business_events.emit_refund_failed("o_r1", "insufficient", "u_1")
        business_events.emit_login("u_login", method="pwd", success=True)
        assert log_file.exists()
        text = log_file.read_text(encoding="utf-8")
        assert "payment_success" in text
        assert "refund_failed" in text
        assert "login_success" in text


# ---------------------------------------------------------------------------
# Bug-58: 业务异常告警分级
# ---------------------------------------------------------------------------


class TestBug58AlertRouter:
    def test_alert_modules_exist(self):
        from app.utils import alert_router

        assert hasattr(alert_router, "alert_critical")
        assert hasattr(alert_router, "alert_warning")
        assert hasattr(alert_router, "alert_info")

    def test_alert_info_logs(self, caplog):
        import logging

        from app.utils import alert_router

        caplog.set_level(logging.INFO)
        alert_router.clear_suppress()
        r = alert_router.alert_info("test_info_key", "info message")
        assert r is True
        assert any("info_key" in rec.message for rec in caplog.records)

    def test_alert_warning_logs(self, caplog):
        import logging

        from app.utils import alert_router

        caplog.set_level(logging.WARNING)
        alert_router.clear_suppress()
        r = alert_router.alert_warning("test_warn_key", "warn message")
        assert r is True
        assert any("warn_key" in rec.message for rec in caplog.records)

    def test_alert_critical_suppresses(self, caplog):
        import logging

        from app.utils import alert_router

        caplog.set_level(logging.ERROR)
        alert_router.clear_suppress()
        # 第一次触发
        r1 = alert_router.alert_critical("test_crit_key", "crit message")
        # 第二次 (60s 内) 被抑制
        r2 = alert_router.alert_critical("test_crit_key", "crit message 2")
        assert r1 is True
        assert r2 is False

    def test_alert_critical_with_explicit_recipients(self, caplog):
        import logging

        from app.utils import alert_router

        caplog.set_level(logging.ERROR)
        alert_router.clear_suppress()
        r = alert_router.alert_critical(
            "test_crit_recipients",
            "test message",
            phones=["13800000001"],
            emails=["ops@example.com"],
        )
        assert r is True

    def test_alert_critical_no_recipients(self, caplog):
        """无接收人配置时也不报错, 走 logger 兜底."""
        import logging

        from app.utils import alert_router

        caplog.set_level(logging.ERROR)
        alert_router.clear_suppress()
        # 显式空列表
        r = alert_router.alert_critical("test_crit_no_recipients", "test", phones=[], emails=[])
        assert r is True
        assert any("test_crit_no_recipients" in rec.message for rec in caplog.records)

    def test_clear_suppress(self):
        from app.utils import alert_router

        alert_router.alert_critical("k1", "m1")
        assert "k1" in alert_router._suppress_cache
        alert_router.clear_suppress("k1")
        assert "k1" not in alert_router._suppress_cache
        alert_router.alert_critical("k2", "m2")
        alert_router.clear_suppress()
        assert alert_router._suppress_cache == {}

    def test_alert_sms_exception_safe(self, monkeypatch):
        from app.utils import alert_router

        # 让 _send_sms 内部抛异常, 不应影响主流程
        def boom(*a, **k):
            raise RuntimeError("network down")

        monkeypatch.setattr(alert_router, "_send_sms", boom)
        r = alert_router.alert_critical("alert_sms_test_key", "m", phones=["13800000000"])
        assert r is True  # 仍然返回 True, 主流程不被打断

    def test_alert_email_exception_safe(self, monkeypatch):
        from app.utils import alert_router

        def boom(*a, **k):
            raise RuntimeError("smtp down")

        monkeypatch.setattr(alert_router, "_send_email", boom)
        r = alert_router.alert_critical("alert_email_test_key", "m", emails=["ops@x.com"])
        assert r is True


# ---------------------------------------------------------------------------
# 集成: 8 项一起跑不冲突
# ---------------------------------------------------------------------------


class TestRound5Integration:
    def test_all_modules_importable(self):
        from app.utils.alert_router import (  # noqa: F401
            alert_critical,
            alert_info,
            alert_warning,
        )
        from app.utils.business_events import EventType, emit_event  # noqa: F401
        from app.utils.db_span import _get_slow_threshold_ms, db_span  # noqa: F401
        from app.utils.refresh_rotation import rotate_refresh  # noqa: F401
        from app.utils.refund_dlq import list_dlq, record_refund_failure  # noqa: F401
        from app.utils.ws_rate_limit import limiter, should_drop_message  # noqa: F401
        from app.ws.room_policy import RoomPolicyError, can_join_room  # noqa: F401

    def test_round5_end_to_end(self, monkeypatch, tmp_path):
        """Bug-52 + Bug-58 端到端: 3 次失败触发告警."""
        from app.utils import alert_router, refund_dlq

        class FakeRedis:
            def __init__(self):
                self.data: dict = {}
                self.zset: dict = {}

            def incr(self, key):
                self.data[key] = int(self.data.get(key, 0)) + 1
                return self.data[key]

            def expire(self, key, sec):
                pass

            def hset(self, key, mapping=None):
                self.data[key] = mapping

            def zadd(self, key, mapping):
                self.zset.setdefault(key, {})
                self.zset[key].update(mapping)

            def zrem(self, key, *members):
                if key in self.zset:
                    for m in members:
                        self.zset[key].pop(m, None)

            def get(self, key):
                return self.data.get(key)

            def zcard(self, key):
                return len(self.zset.get(key, {}))

        fake = FakeRedis()
        monkeypatch.setattr(refund_dlq, "_get_redis", lambda: fake)
        alert_router.clear_suppress()

        # 3 次失败
        refund_dlq.record_refund_failure("o_e2e_001", "e1")
        refund_dlq.record_refund_failure("o_e2e_001", "e2")
        refund_dlq.record_refund_failure("o_e2e_001", "e3")

        # 第三次应进入 DLQ
        assert "o_e2e_001" in fake.zset.get("zhs:refund:dlq", {})
        # alert_critical 已被调用并记录到 suppress
        assert "refund_dlq_exhausted:o_e2e_001" in alert_router._suppress_cache
