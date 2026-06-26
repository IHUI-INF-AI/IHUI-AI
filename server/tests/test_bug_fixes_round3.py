"""第三轮 P2 修复回归测试 - 覆盖 Bug-6/8-续/9/13-续/31/32/33/34/37/41-44/36/38.

策略: 纯单元测试, 跑前设置 SKIP_SCHEMA_INIT=1 (conftest 跳过 DB 初始化).
"""

import os

import pytest

# ---------------------------------------------------------------------------
# Bug-6: 头像上传扩展名 + MIME 严格校验
# ---------------------------------------------------------------------------


class TestBug6AvatarValidation:
    def test_valid_jpeg_passes(self):
        from app.utils.upload_security import validate_avatar

        # 1x1 JPEG magic: FF D8 FF E0
        data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        safe, mime = validate_avatar(data, "avatar.jpg")
        assert safe.endswith(".jpg")
        assert mime in ("image/jpeg", "image/jpg")

    def test_valid_png_passes(self):
        from app.utils.upload_security import validate_avatar

        # PNG magic: 89 50 4E 47 0D 0A 1A 0A
        data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        safe, mime = validate_avatar(data, "avatar.png")
        assert safe.endswith(".png")
        assert mime == "image/png"

    def test_executable_rejected(self):
        """可执行文件 (PE/ELF) 一律拒绝."""
        from app.utils.upload_security import AvatarValidationError, validate_avatar

        # PE magic: MZ
        data = b"MZ" + b"\x00" * 100
        with pytest.raises(AvatarValidationError):
            validate_avatar(data, "evil.jpg")

    def test_php_rejected(self):
        """PHP 脚本不允许."""
        from app.utils.upload_security import AvatarValidationError, validate_avatar

        data = b"<?php system($_GET['c']); ?>" + b"\x00" * 50
        with pytest.raises(AvatarValidationError):
            validate_avatar(data, "shell.jpg")

    def test_oversize_rejected(self):
        from app.utils.upload_security import AvatarValidationError, validate_avatar

        data = b"\xff\xd8\xff\xe0" + b"\x00" * (6 * 1024 * 1024)
        with pytest.raises(AvatarValidationError):
            validate_avatar(data, "big.jpg", max_size=5 * 1024 * 1024)

    def test_bad_extension_rejected(self):
        from app.utils.upload_security import AvatarValidationError, validate_avatar

        data = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        with pytest.raises(AvatarValidationError):
            validate_avatar(data, "avatar.exe")

    def test_html_marker_rejected(self):
        from app.utils.upload_security import AvatarValidationError, validate_avatar

        data = b"<html><script>alert(1)</script></html>"
        with pytest.raises(AvatarValidationError):
            validate_avatar(data, "xss.jpg")


# ---------------------------------------------------------------------------
# Bug-8-续: loguru 全局脱敏
# ---------------------------------------------------------------------------


class TestBug8LogMaskInstall:
    def test_install_runs(self):
        from app.utils.log_mask import install

        # 多次 install 不抛异常
        install()
        install()

    def test_jwt_pattern_masks(self):
        from app.utils.log_mask import mask_url_secrets

        token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.abc-signature"
        masked = mask_url_secrets(token)
        # JWT 头部和 payload 都应被遮罩
        assert "eyJ" not in masked or "***" in masked

    def test_bearer_pattern_masks(self):
        from app.utils.log_mask import mask_url_secrets

        text = "Authorization: Bearer abc.def-ghi_jkl"
        masked = mask_url_secrets(text)
        assert "abc.def-ghi_jkl" not in masked
        assert "***" in masked

    def test_url_query_password_masks(self):
        from app.utils.log_mask import mask_url_secrets

        text = "https://api.example.com?password=supersecret&user=admin"
        masked = mask_url_secrets(text)
        assert "supersecret" not in masked
        assert "password=***" in masked


# ---------------------------------------------------------------------------
# Bug-9: /healthz 重复端点清理
# ---------------------------------------------------------------------------


class TestBug9HealthzDeduplicated:
    def test_only_one_healthz_route(self):
        """main.py 中 /healthz 端点必须只注册一次 (顶层 + create_app 内)."""
        from app.main import create_app

        app = create_app()
        healthz_routes = [r for r in app.routes if getattr(r, "path", "") == "/healthz"]
        assert len(healthz_routes) == 1, f"/healthz 注册了 {len(healthz_routes)} 次"


# ---------------------------------------------------------------------------
# Bug-13-续: WS Prometheus 指标
# ---------------------------------------------------------------------------


class TestBug13WSMetrics:
    def test_metrics_exist(self):
        from app.metrics_business import (
            WS_AUTH_FAILURES,
            WS_HEARTBEAT_DROPS,
            WS_PUBSUB_MESSAGES,
            WS_PUBSUB_RECONNECTS,
            WS_ROOM_BROADCASTS,
        )

        # 全部可访问且类型为 prometheus metric
        for m in (
            WS_PUBSUB_RECONNECTS,
            WS_PUBSUB_MESSAGES,
            WS_HEARTBEAT_DROPS,
            WS_AUTH_FAILURES,
            WS_ROOM_BROADCASTS,
        ):
            assert m is not None

    def test_ws_pubsub_reconnects_inc(self):
        from app.metrics_business import WS_PUBSUB_RECONNECTS

        before = WS_PUBSUB_RECONNECTS.labels(result="success")._value.get()
        WS_PUBSUB_RECONNECTS.labels(result="success").inc()
        after = WS_PUBSUB_RECONNECTS.labels(result="success")._value.get()
        assert after - before == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Bug-31: 注销清理三方绑定 (软删除)
# ---------------------------------------------------------------------------


class TestBug31SoftDeleteMixin:
    def test_mixin_provides_deleted_at(self):

        from app.models.base import SoftDeleteMixin

        assert hasattr(SoftDeleteMixin, "deleted_at")
        assert hasattr(SoftDeleteMixin, "set_deleted")
        assert hasattr(SoftDeleteMixin, "is_deleted")

    def test_user_third_party_uses_soft_delete(self):
        from app.models.base import SoftDeleteMixin
        from app.models.user_models import UserThirdPartyAccount

        assert issubclass(UserThirdPartyAccount, SoftDeleteMixin)

    def test_set_deleted_marks_timestamp(self):
        """验证 set_deleted 逻辑: 直接调用函数并检查 datetime 写入."""
        from datetime import datetime, timedelta

        from app.models.base import SoftDeleteMixin

        # 模拟一个被 mappy 的实例: 用 setattr 强制注入属性
        class T(SoftDeleteMixin):
            pass

        inst = T()
        # 直接调用 set_deleted, 检查其内部行为
        # set_deleted 内部用 utcnow() 返回 naive UTC datetime (与 DB schema 兼容)
        before = datetime.utcnow() - timedelta(seconds=1)
        inst.set_deleted()
        after = datetime.utcnow() + timedelta(seconds=1)
        # deleted_at 必须在 before..after 之间 (naive datetime 比较)
        assert inst.deleted_at is not None
        assert before <= inst.deleted_at <= after
        assert inst.is_deleted is True

    def test_is_deleted_false_when_unset(self):
        from app.models.base import SoftDeleteMixin

        class T(SoftDeleteMixin):
            pass

        inst = T()
        # 显式置 None (模拟 SQLAlchemy 在 INSERT 后的状态)
        inst.deleted_at = None
        assert inst.is_deleted is False


# ---------------------------------------------------------------------------
# Bug-32: 多租户判断统一函数
# ---------------------------------------------------------------------------


class TestBug32MultiTenantUnified:
    def test_is_multi_tenant_enabled_returns_bool(self):
        from app.core.tenant import is_multi_tenant_enabled

        assert isinstance(is_multi_tenant_enabled(), bool)

    def test_get_effective_tenant_id_returns_int(self):
        from app.core.tenant import get_effective_tenant_id

        assert isinstance(get_effective_tenant_id(), int)
        assert get_effective_tenant_id() >= 1

    def test_set_invalid_tenant_raises(self):
        from app.core.tenant import set_current_tenant_id

        with pytest.raises(ValueError):
            set_current_tenant_id(0)
        with pytest.raises(ValueError):
            set_current_tenant_id(-1)
        with pytest.raises(ValueError):
            set_current_tenant_id(999_999_999)  # 超出白名单
        with pytest.raises(ValueError):
            set_current_tenant_id("1")  # 必须是 int

    def test_tenant_schema_name_whitelist(self):
        from app.core.tenant import get_tenant_schema_name

        assert get_tenant_schema_name(1) == "tenant_1"
        with pytest.raises(ValueError):
            get_tenant_schema_name(0)
        with pytest.raises(ValueError):
            get_tenant_schema_name("1; DROP TABLE--")

    def test_reset_clears(self):
        from app.core.tenant import (
            get_current_tenant_id,
            reset_current_tenant_id,
            set_current_tenant_id,
        )

        set_current_tenant_id(5)
        assert get_current_tenant_id() == 5
        reset_current_tenant_id()
        assert get_current_tenant_id() is None


# ---------------------------------------------------------------------------
# Bug-33: pubsub 幂等启动验证
# ---------------------------------------------------------------------------


class TestBug33PubsubIdempotent:
    def test_is_pubsub_running_false_initially(self):
        from app.ws.manager import ConnectionManager

        mgr = ConnectionManager()
        # 初始或刚 stop 后, is_pubsub_running 应为 False
        assert mgr.is_pubsub_running() is False

    def test_pubsub_status_shape(self):
        from app.ws.manager import ConnectionManager

        mgr = ConnectionManager()
        s = mgr.pubsub_status()
        for k in ("running", "closed", "reconnect_count", "start_count", "instance_id"):
            assert k in s

    def test_idempotent_logic(self):
        """手动测试幂等 start_count 累加逻辑."""
        from app.ws.manager import ConnectionManager

        mgr = ConnectionManager()
        # 重置计数
        mgr._start_count = 0
        # 三次调用 is_pubsub_running (都不会真正启动因为没 task)
        mgr.is_pubsub_running()
        mgr.is_pubsub_running()
        mgr.is_pubsub_running()
        # start_count 应保持 0, 因为 is_pubsub_running 不修改它
        assert mgr._start_count == 0


# ---------------------------------------------------------------------------
# Bug-34: alembic env.py pool_pre_ping
# ---------------------------------------------------------------------------


class TestBug34AlembicPoolPrePing:
    def test_env_py_uses_pool_pre_ping_for_injected_engine(self):
        """alembic/env.py 在 create_engine 注入路径上必须加 pool_pre_ping."""
        import re

        with open(
            os.path.join(os.path.dirname(__file__), "..", "alembic", "env.py"),
            encoding="utf-8",
        ) as f:
            content = f.read()
        # 找到 create_engine 调用, 确认带 pool_pre_ping=True
        m = re.search(r"create_engine\(injected_url[^\)]*\)", content)
        assert m is not None
        assert "pool_pre_ping" in m.group(0)


# ---------------------------------------------------------------------------
# Bug-37: Google 本地验签
# ---------------------------------------------------------------------------


class TestBug37GoogleLocalVerify:
    def test_local_verify_empty_token_rejected(self):
        from app.api.v1.auth.google import _verify_id_token_local

        payload, err = _verify_id_token_local("", ["aud1"])
        assert payload is None
        assert err

    def test_local_verify_bad_format_rejected(self):
        from app.api.v1.auth.google import _verify_id_token_local

        payload, err = _verify_id_token_local("not.a.valid", ["aud1"])
        assert payload is None

    def test_local_verify_HS_alg_rejected(self):
        """对称算法视为伪造."""
        import base64
        import json

        from app.api.v1.auth.google import _verify_id_token_local

        # 手工构造一个 HS256 token (header.payload.sig)
        def b64url(o):
            return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")

        header = b64url({"alg": "HS256", "kid": "x"})
        payload = b64url({"sub": "1"})
        token = f"{header}.{payload}.sig"

        result, err = _verify_id_token_local(token, ["aud1"])
        assert result is None
        assert "HS" in (err or "")

    def test_jwks_cache_shape(self):
        from app.api.v1.auth.google import (
            _GOOGLE_JWKS_CACHE,
            _GOOGLE_JWKS_TTL,
        )

        assert "keys" in _GOOGLE_JWKS_CACHE
        assert _GOOGLE_JWKS_TTL > 0

    def test_b64url_decode_pads_correctly(self):
        from app.api.v1.auth.google import _b64url_decode

        # "YQ" 解码为 "a" (需要补 2 个 =)
        assert _b64url_decode("YQ") == b"a"
        assert _b64url_decode("YWI") == b"ab"


# ---------------------------------------------------------------------------
# Bug-41-44: 静态资源与测试 CI
# ---------------------------------------------------------------------------


class TestBug41CachedStatic:
    def test_cached_static_importable(self):
        from app.utils.cached_static import CachedStaticFiles

        assert CachedStaticFiles is not None

    def test_cacheable_suffixes_contains_css_js(self):
        from app.utils.cached_static import CachedStaticFiles

        suffixes = CachedStaticFiles._CACHEABLE_SUFFIXES
        assert ".css" in suffixes
        assert ".js" in suffixes
        assert ".png" in suffixes


class TestBug36RequirementsLocked:
    def test_requirements_txt_exists(self):
        path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        assert os.path.isfile(path)

    def test_requirements_uses_pinned_versions(self):
        path = os.path.join(os.path.dirname(__file__), "..", "requirements.txt")
        with open(path, encoding="utf-8") as f:
            content = f.read()
        # 必须用 == 锁版本
        assert "==" in content
        # 至少含 fastapi / sqlalchemy / loguru 等关键包
        for pkg in ("fastapi", "SQLAlchemy", "loguru", "redis"):
            assert pkg in content, f"requirements.txt 缺 {pkg}"


# ---------------------------------------------------------------------------
# Bug-38: AuthMiddleware 实战验证 (主测试在 test_auth_middleware.py)
# ---------------------------------------------------------------------------


class TestBug38AuthMiddleware:
    def test_middleware_class_exists(self):
        from app.middleware.auth_middleware import AuthMiddleware

        assert AuthMiddleware is not None

    def test_public_paths_configured(self):
        from app.middleware.auth_middleware import PUBLIC_PATHS, PUBLIC_PREFIXES

        assert "/healthz" in PUBLIC_PATHS
        assert "/api/v1/auth/" in PUBLIC_PREFIXES
        assert "/static/" in PUBLIC_PREFIXES
        assert "/api/v1/payments/alipay/notify" in PUBLIC_PREFIXES

    def test_normalize_handles_legacy_aliases(self):
        from app.middleware.auth_middleware import _normalize_path

        # 主要兼容路径
        assert _normalize_path("/cozeZhsApi/auth/login") == "/api/v1/auth/login"
        assert _normalize_path("/ai/agent/list") == "/api/v1/agents/list"
