"""第四轮 P2 修复回归测试 - 覆盖 Bug-23-续/30-续/45/46/47/48/49/50."""

import os

# 跳过 DB schema 初始化
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import asyncio
import json

import pytest

# ---------------------------------------------------------------------------
# Bug-23-续: 弱密码字典化 + 模糊匹配
# ---------------------------------------------------------------------------


class TestBug23ContinuedPasswordStrength:
    def test_common_weak_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, reasons = password_is_obviously_weak("123456")
        assert weak is True
        assert any("字典" in r or "常见" in r for r in reasons)

    def test_aaa_run_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, _ = password_is_obviously_weak("aaaaaa")
        assert weak is True

    def test_keyboard_seq_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, _ = password_is_obviously_weak("qwerty123")
        assert weak is True

    def test_user_info_match_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, reasons = password_is_obviously_weak(
            "Zhang@13812345678",
            phone="13812345678",
        )
        assert weak is True
        assert any("用户信息" in r for r in reasons)

    def test_email_prefix_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, _ = password_is_obviously_weak(
            "Zhang@johndoe2024",
            email="johndoe@x.com",
        )
        assert weak is True

    def test_strong_password_passes(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, _ = password_is_obviously_weak(
            "S3cur!Pass_#2024XYZ",
            username="jane",
            phone="13999999999",
            email="other@x.com",
        )
        assert weak is False

    def test_short_password_rejected(self):
        from app.utils.password_strength import password_is_obviously_weak

        weak, _ = password_is_obviously_weak("Ab1!")
        assert weak is True

    def test_phone_segment_match(self):
        from app.utils.password_strength import _user_context_keys

        keys = _user_context_keys(phone="13812345678")
        # 应包含完整手机号, 前 3 位, 后 4 位, 后 6 位
        for k in ("13812345678", "138", "5678", "345678"):
            assert k in keys, f"应包含 {k}"

    def test_batch_weak(self):
        from app.utils.password_strength import weak_password_batch

        out = weak_password_batch(
            ["123456", "P9k!mNoPq#rStUv", "ZhangSan@13812345678"],
            user_lookup={"ZhangSan@13812345678": {"phone": "13812345678"}},
        )
        assert len(out["weak"]) == 2
        assert len(out["ok"]) == 1


# ---------------------------------------------------------------------------
# Bug-30-续: cross_schema_query
# ---------------------------------------------------------------------------


class TestBug30ContinuedCrossSchema:
    def test_classify_table(self):
        from app.utils.cross_schema import classify_table

        assert classify_table("users") == "center"
        assert classify_table("zhs_course") == "course"
        assert classify_table("agents") == "ai"

    def test_get_session_for_engine(self):
        from app.utils.cross_schema import get_session_for_engine

        f1 = get_session_for_engine("ai")
        f2 = get_session_for_engine("center")
        f3 = get_session_for_engine("course")
        assert f1 is not None
        assert f2 is not None
        assert f3 is not None

    def test_invalid_engine_raises(self):
        from app.utils.cross_schema import get_session_for_engine

        with pytest.raises(ValueError):
            get_session_for_engine("bogus")

    def test_application_join_left(self):
        from app.utils.cross_schema import application_join

        # 模拟主表
        class P:
            def __init__(self, id, name):
                self.id = id
                self.name = name

        # 模拟副表
        class S:
            def __init__(self, user_id, level):
                self.user_id = user_id
                self.level = level

        prim = [P(1, "alice"), P(2, "bob"), P(3, "carol")]
        sec = [S(1, "gold"), S(3, "silver")]
        out = application_join(prim, sec, "id", "user_id", how="left")
        assert len(out) == 3  # left 全部保留
        sec_by_id = {row["id"]: row["secondary"] for row in out}
        assert sec_by_id[1].level == "gold"
        assert sec_by_id[2] is None
        assert sec_by_id[3].level == "silver"

    def test_application_join_inner(self):
        from app.utils.cross_schema import application_join

        class P:
            def __init__(self, id, name):
                self.id = id
                self.name = name

        class S:
            def __init__(self, user_id, level):
                self.user_id = user_id
                self.level = level

        prim = [P(1, "alice"), P(2, "bob")]
        sec = [S(1, "gold"), S(3, "silver")]
        out = application_join(prim, sec, "id", "user_id", how="inner")
        assert len(out) == 1
        assert out[0]["id"] == 1


# ---------------------------------------------------------------------------
# Bug-46: db_span
# ---------------------------------------------------------------------------


class TestBug46DBSpan:
    def test_db_span_no_otel(self):
        """otel 未启用时 db_span 应降级 (不抛异常)."""
        from app.utils.db_span import db_span

        with db_span("test.op", table="users", engine="center") as span:
            span.set_attribute("foo", 1)
        # 走到这里说明 OK

    def test_trace_db_query_decorator_sync(self):
        from app.utils.db_span import trace_db_query

        @trace_db_query("test.fn", table="users")
        def add(a, b):
            return a + b

        assert add(1, 2) == 3

    def test_trace_db_query_decorator_async(self):
        from app.utils.db_span import trace_db_query

        @trace_db_query("test.async_fn")
        async def add(a, b):
            return a + b

        result = asyncio.run(add(1, 2))
        assert result == 3

    def test_db_span_exception_propagates(self):
        from app.utils.db_span import db_span

        with pytest.raises(ValueError), db_span("test.err", table="users"):
            raise ValueError("test")

    def test_slow_op_logged(self):
        """db_span > 500ms 时降级路径会打 warning (no-op 测试)."""
        from app.utils.db_span import db_span

        with db_span("test.fast", table="users"):
            pass  # 快速, 不打 warning


# ---------------------------------------------------------------------------
# Bug-47: hot_config
# ---------------------------------------------------------------------------


class TestBug47HotConfig:
    def test_hot_get_set(self):
        from app.utils.hot_config import hot_get, hot_keys, hot_set

        hot_set("TEST_KEY_R1", "v1")
        assert hot_get("TEST_KEY_R1") == "v1"
        assert "TEST_KEY_R1" in hot_keys()

    def test_hot_default(self):
        from app.utils.hot_config import hot_get

        assert hot_get("NON_EXIST_KEY_R1", "def") == "def"

    def test_hot_snapshot(self):
        from app.utils.hot_config import hot_set, hot_snapshot

        hot_set("TEST_KEY_R2", 1)
        snap = hot_snapshot()
        assert "TEST_KEY_R2" in snap
        assert snap["TEST_KEY_R2"] == 1

    def test_watcher_fires_on_change(self):
        from app.utils.hot_config import hot_set, watch

        events = []

        def cb(old, new):
            events.append((old, new))

        watch("TEST_WATCH_R1", cb)
        hot_set("TEST_WATCH_R1", "first", notify=True)
        hot_set("TEST_WATCH_R1", "second", notify=True)
        # 变化至少 1 次
        assert len(events) >= 1
        # 最后一次变化是 first->second
        last = events[-1]
        assert last == ("first", "second")

    def test_watcher_not_fired_on_same_value(self):
        from app.utils.hot_config import hot_set, watch

        events = []

        def cb(old, new):
            events.append((old, new))

        watch("TEST_NOOP_R1", cb)
        hot_set("TEST_NOOP_R1", "v1", notify=True)
        hot_set("TEST_NOOP_R1", "v1", notify=True)  # same value
        # 不应有第二次回调
        assert len(events) == 1

    def test_reload_from_env(self, monkeypatch):
        monkeypatch.setenv("HOT_R1_TEST", "hello")
        monkeypatch.setenv("HOT_R1_NUM", "42")
        monkeypatch.setenv("HOT_R1_BOOL", "true")
        from app.utils.hot_config import hot_get, reload_now

        reload_now()
        assert hot_get("R1_TEST") == "hello"
        assert hot_get("R1_NUM") == 42
        assert hot_get("R1_BOOL") is True


# ---------------------------------------------------------------------------
# Bug-48: WS origin 白名单
# ---------------------------------------------------------------------------


class TestBug48WSOrigin:
    def test_empty_origin_allowed(self):
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("") is True

    def test_dev_localhost_allowed(self, monkeypatch):
        monkeypatch.setenv("ENV", "dev")
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("http://localhost:3000") is True
        assert _origin_allowed("http://127.0.0.1:8080") is True

    def test_prod_strict_rejects_unknown(self, monkeypatch):
        monkeypatch.setenv("ENV", "production")
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("https://evil.com") is False

    def test_exact_match_allowed(self, monkeypatch):
        monkeypatch.setenv("WS_ALLOWED_ORIGINS", "https://a.com,https://b.com")
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("https://a.com") is True
        assert _origin_allowed("https://b.com") is True
        assert _origin_allowed("https://c.com") is False

    def test_wildcard_match(self, monkeypatch):
        monkeypatch.setenv("WS_ALLOWED_ORIGINS", "*.example.com")
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("https://api.example.com") is True
        assert _origin_allowed("https://x.y.example.com") is True
        assert _origin_allowed("https://example.com") is False  # 前缀匹配不命中根域

    def test_wildcard_all(self, monkeypatch):
        monkeypatch.setenv("WS_ALLOWED_ORIGINS", "*")
        from app.ws.auth import _origin_allowed

        assert _origin_allowed("https://anywhere.com") is True


# ---------------------------------------------------------------------------
# Bug-49: CSRF token
# ---------------------------------------------------------------------------


class TestBug49CSRF:
    def test_token_round_trip(self):
        from app.utils.csrf_util import generate_csrf_token, verify_csrf_token

        token, cookie = generate_csrf_token("user-1")
        assert verify_csrf_token(token, cookie, user_uuid="user-1") is True

    def test_token_tampered_rejected(self):
        from app.utils.csrf_util import generate_csrf_token, verify_csrf_token

        token, cookie = generate_csrf_token("user-1")
        # 改 token 最后一个字符
        tampered = token[:-1] + ("x" if token[-1] != "x" else "y")
        assert verify_csrf_token(tampered, cookie, user_uuid="user-1") is False

    def test_cookie_tampered_rejected(self):
        from app.utils.csrf_util import generate_csrf_token, verify_csrf_token

        token, cookie = generate_csrf_token("user-1")
        # 改 cookie hex 第一个字符
        bad_cookie = ("ff" if cookie[:2] != "ff" else "00") + cookie[2:]
        assert verify_csrf_token(token, bad_cookie, user_uuid="user-1") is False

    def test_empty_token_rejected(self):
        from app.utils.csrf_util import verify_csrf_token

        assert verify_csrf_token("", "x") is False
        assert verify_csrf_token("x", "") is False

    def test_malformed_token_rejected(self):
        from app.utils.csrf_util import verify_csrf_token

        assert verify_csrf_token("not-a-token", "abc") is False

    def test_token_per_user(self):
        from app.utils.csrf_util import generate_csrf_token, verify_csrf_token

        token, cookie = generate_csrf_token("user-A")
        # 别的 user 不能用
        assert verify_csrf_token(token, cookie, user_uuid="user-B") is False

    def test_safe_methods_skip(self):
        """GET/HEAD/OPTIONS 不应被 CSRF 拦截."""
        from app.utils.csrf_util import csrf_protect

        # 模拟 Request 没有 token
        class FakeRequest:
            method = "GET"
            headers = {}
            cookies = {}
            state = type("S", (), {"user_uuid": None})()

        # csrf_protect 是同步函数, GET 属于 SAFE_METHODS 直接 return 不抛
        csrf_protect(FakeRequest())


# ---------------------------------------------------------------------------
# Bug-50: ELK JSON formatter
# ---------------------------------------------------------------------------


class TestBug50ELKFormatter:
    def test_format_basic(self):
        from app.utils.elk_formatter import elk_format

        record = {
            "record": {
                "time": "2026-06-15T00:00:00",
                "level": {"name": "INFO"},
                "message": "hello",
                "name": "module.x",
                "function": "fn",
                "line": 10,
                "extra": {"user_id": "u-1"},
            }
        }
        out = elk_format(record)
        obj = json.loads(out)
        assert obj["@timestamp"] == "2026-06-15T00:00:00"
        assert obj["level"] == "INFO"
        assert obj["message"] == "hello"
        assert obj["service"] == "zhs-platform"
        assert obj["user_id"] == "u-1"

    def test_format_masks_sensitive(self):
        from app.utils.elk_formatter import elk_format

        record = {
            "record": {
                "time": "2026-06-15T00:00:00",
                "level": {"name": "INFO"},
                "message": "x",
                "name": "m",
                "function": "f",
                "line": 1,
                "extra": {"password": "super-secret-value"},
            }
        }
        out = elk_format(record)
        obj = json.loads(out)
        assert obj["password"] == "***"
        assert "super-secret-value" not in out

    def test_format_handles_non_serializable(self):
        from app.utils.elk_formatter import elk_format

        class Weird:
            def __str__(self):
                return "weird-str"

        record = {
            "record": {
                "time": "2026-06-15T00:00:00",
                "level": {"name": "INFO"},
                "message": "x",
                "name": "m",
                "function": "f",
                "line": 1,
                "extra": {"obj": Weird()},
            }
        }
        out = elk_format(record)
        obj = json.loads(out)
        assert obj["obj"] == "weird-str"

    def test_install_elk_sink_idempotent(self):
        """安装 ELK sink 不应抛异常 (serialize=True)."""
        from app.utils import elk_formatter

        # 第一次安装
        ok1 = elk_formatter.install_elk_sink()
        # 第二次幂等
        ok2 = elk_formatter.install_elk_sink()
        # 第二次应返回 False (因为已经安装)
        assert ok2 is False
        # _ELK_INSTALLED 标志位 (通过模块访问, 避免 import 快照)
        assert elk_formatter._ELK_INSTALLED is True

    def test_is_elk_enabled(self):
        from app.utils.elk_formatter import is_elk_enabled

        assert isinstance(is_elk_enabled(), bool)
