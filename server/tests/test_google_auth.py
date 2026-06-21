"""测试 Google OAuth 鉴权 — pcWxCode / androidWxCode / config."""

import respx
from httpx import Response

from app.api.v1.auth import google as google_mod
from app.config import settings


class TestGoogleConfig:
    def test_google_config_status(self):
        """直接调函数验证配置结构."""
        cfg = google_mod._google_config()
        assert "app_id" in cfg
        assert "secret" in cfg
        assert "token_endpoint" in cfg

    async def test_google_config_endpoint(self, client):
        """实际端点 GET /api/v1/auth/google/config"""
        resp = await client.get("/api/v1/auth/google/config")
        assert resp.status_code == 200


class TestGoogleEndpoints:
    @respx.mock
    async def test_pc_wxcode_token_exchange_failure(self, client):
        # token endpoint 返回错误
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(400, json={"error": "invalid_grant"})
        )
        # 设置必要的 app_id
        old = settings.GOOGLE_APP_ID
        settings.GOOGLE_APP_ID = "test-app-id"
        old_secret = settings.GOOGLE_SECRET
        settings.GOOGLE_SECRET = "test-secret"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=badcode")
            assert resp.status_code == 200
            data = resp.json()
            assert data["code"] != 0
            assert "失败" in data["message"]
        finally:
            settings.GOOGLE_APP_ID = old
            settings.GOOGLE_SECRET = old_secret

    async def test_pc_wxcode_no_config(self, client):
        old = settings.GOOGLE_APP_ID
        settings.GOOGLE_APP_ID = ""
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=any")
            assert resp.status_code == 200
            data = resp.json()
            assert data["code"] != 0
        finally:
            settings.GOOGLE_APP_ID = old

    @respx.mock
    async def test_android_wxcode_invalid_token(self, client):
        # tokeninfo 返回 aud 不匹配
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "wrong-aud",
                    "sub": "user-123",
                    "email": "u@x.com",
                    "name": "User",
                    "picture": "http://x",
                },
            )
        )
        old = settings.GOOGLE_ANDROID_ID
        settings.GOOGLE_ANDROID_ID = "expected-aud"
        try:
            resp = await client.get("/api/v1/auth/google/android/wxCode?id_token=fake")
            data = resp.json()
            assert data["code"] != 0  # 校验失败
        finally:
            settings.GOOGLE_ANDROID_ID = old

    @respx.mock
    async def test_android_wxcode_success(self, client):
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "android-aud-1",
                    "sub": "google-user-1",
                    "email": "user1@gmail.com",
                    "name": "User One",
                    "picture": "https://google.com/u/1.jpg",
                },
            )
        )
        old = settings.GOOGLE_ANDROID_ID
        settings.GOOGLE_ANDROID_ID = "android-aud-1"
        try:
            resp = await client.get("/api/v1/auth/google/android/wxCode?id_token=valid")
            data = resp.json()
            assert data["code"] == 0
            assert data["data"]["openId"] == "google-user-1"
            assert data["data"]["email"] == "user1@gmail.com"
            assert data["data"]["name"] == "User One"
        finally:
            settings.GOOGLE_ANDROID_ID = old


class TestVerifyHelpers:
    @respx.mock
    async def test_verify_id_token_no_token(self):
        result = await google_mod._verify_id_token("", "aud")
        assert result is None

    @respx.mock
    async def test_verify_id_token_no_aud(self):
        result = await google_mod._verify_id_token("token", "")
        assert result is None

    @respx.mock
    async def test_exchange_code_no_config(self):
        old_id = settings.GOOGLE_APP_ID
        old_secret = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = ""
        settings.GOOGLE_SECRET = ""
        try:
            result = await google_mod._exchange_code_for_token("any", "")
            assert result is None
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_secret

    @respx.mock
    async def test_to_user_info(self):
        ui = google_mod._to_user_info({"sub": "u1", "email": "e@x.com", "name": "N", "picture": "p"})
        assert ui.openId == "u1"
        assert ui.email == "e@x.com"
        assert ui.phone == "e@x.com"  # email 兜底


class TestGoogleFullFlow:
    """完整 OAuth 流程联调 — 用 respx 模拟 Google 端点."""

    @respx.mock
    async def test_pc_wxcode_full_success(self, client):
        """完整 PC 流程: code → token endpoint → id_token → tokeninfo → user info."""
        # 1) token endpoint 返回 id_token
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(
                200,
                json={
                    "access_token": "ya29.xxx",
                    "id_token": "valid.id.token",
                    "expires_in": 3600,
                    "token_type": "Bearer",
                },
            )
        )
        # 2) tokeninfo 验证 id_token
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "pc-app-id-1",
                    "sub": "google-pc-user-1",
                    "email": "pcuser@gmail.com",
                    "email_verified": "true",
                    "name": "PC User",
                    "picture": "https://lh3.googleusercontent.com/xxx",
                    "iss": "https://accounts.google.com",
                },
            )
        )
        old_id = settings.GOOGLE_APP_ID
        old_secret = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = "pc-app-id-1"
        settings.GOOGLE_SECRET = "pc-secret-1"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=4/0AeaYSHB-test")
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["code"] == 0, f"业务码: {data}"
            payload = data["data"]
            assert payload["openId"] == "google-pc-user-1"
            assert payload["email"] == "pcuser@gmail.com"
            assert payload["name"] == "PC User"
            assert "googleusercontent" in payload["picture"]
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_secret

    @respx.mock
    async def test_pc_wxcode_tokeninfo_aud_mismatch(self, client):
        """token 换到了但 aud 不匹配 → 校验失败."""
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(200, json={"id_token": "wrong.aud.token"})
        )
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "different-app-id",
                    "sub": "u1",
                    "email": "u1@x.com",
                    "name": "U1",
                    "picture": "",
                },
            )
        )
        old_id = settings.GOOGLE_APP_ID
        old_secret = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = "expected-app-id"
        settings.GOOGLE_SECRET = "secret-x"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=any")
            data = resp.json()
            assert data["code"] != 0
            assert "校验失败" in data["message"]
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_secret

    @respx.mock
    async def test_pc_wxcode_tokeninfo_5xx(self, client):
        """Google 服务 5xx 错误时优雅返回."""
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(200, json={"id_token": "ok.token"})
        )
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(503, json={"error": "backend down"})
        )
        old_id = settings.GOOGLE_APP_ID
        old_secret = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = "x"
        settings.GOOGLE_SECRET = "y"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=c")
            data = resp.json()
            assert data["code"] != 0
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_secret

    @respx.mock
    async def test_android_wxcode_tokeninfo_500(self, client):
        """Android 端点处理 tokeninfo 500."""
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(return_value=Response(500, text="internal error"))
        old = settings.GOOGLE_ANDROID_ID
        settings.GOOGLE_ANDROID_ID = "android-id"
        try:
            resp = await client.get("/api/v1/auth/google/android/wxCode?id_token=any")
            data = resp.json()
            assert data["code"] != 0
        finally:
            settings.GOOGLE_ANDROID_ID = old

    @respx.mock
    async def test_exchange_code_network_error(self, monkeypatch):
        """网络异常时返回 None 不抛."""

        async def _boom(*a, **kw):
            raise RuntimeError("network unreachable")

        import httpx

        monkeypatch.setattr(httpx.AsyncClient, "post", _boom)
        result = await google_mod._exchange_code_for_token("any", "client-id")
        assert result is None

    @respx.mock
    async def test_verify_id_token_network_error(self, monkeypatch):
        async def _boom(*a, **kw):
            raise RuntimeError("net down")

        import httpx

        monkeypatch.setattr(httpx.AsyncClient, "get", _boom)
        result = await google_mod._verify_id_token("tok", "aud")
        assert result is None

    async def test_android_no_config_returns_error(self, client):
        old = settings.GOOGLE_ANDROID_ID
        settings.GOOGLE_ANDROID_ID = ""
        try:
            resp = await client.get("/api/v1/auth/google/android/wxCode?id_token=any")
            data = resp.json()
            assert data["code"] != 0
            assert "未配置" in data["message"]
        finally:
            settings.GOOGLE_ANDROID_ID = old


class TestGoogleMultiClient:
    """多 client ID 支持测试."""

    async def test_split_client_ids(self):
        from app.api.v1.auth import google as google_mod

        assert google_mod._split_client_ids("") == []
        assert google_mod._split_client_ids("a") == ["a"]
        assert google_mod._split_client_ids("a,b,c") == ["a", "b", "c"]
        assert google_mod._split_client_ids("a; b , c; a") == ["a", "b", "c"]  # 去重保序
        assert google_mod._split_client_ids("  a  ,  b  ") == ["a", "b"]  # 去空白

    @respx.mock
    async def test_pc_wxcode_multi_client_aud_match_any(self, client):
        """多 client ID 列表中任一匹配 aud 即可通过校验."""
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(200, json={"id_token": "ok.token"})
        )
        # tokeninfo 返回的 aud 是列表中的第二个
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "second-id.apps.googleusercontent.com",
                    "sub": "user-2",
                    "email": "u2@x.com",
                    "name": "U2",
                    "picture": "",
                },
            )
        )
        old_ids = settings.GOOGLE_APP_IDS
        old_id = settings.GOOGLE_APP_ID
        old_sec = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_IDS = "first-id.apps.googleusercontent.com,second-id.apps.googleusercontent.com,third-id"
        settings.GOOGLE_APP_ID = ""  # 多 client 模式
        settings.GOOGLE_SECRET = "sec"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=c")
            data = resp.json()
            assert data["code"] == 0, f"应通过: {data}"
            assert data["data"]["openId"] == "user-2"
        finally:
            settings.GOOGLE_APP_IDS = old_ids
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_sec

    @respx.mock
    async def test_pc_wxcode_multi_client_aud_not_in_list(self, client):
        """多 client 模式下, 不在白名单的 aud 拒绝."""
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=Response(200, json={"id_token": "ok.token"})
        )
        respx.get("https://oauth2.googleapis.com/tokeninfo").mock(
            return_value=Response(
                200,
                json={
                    "aud": "evil-attacker.apps.googleusercontent.com",
                    "sub": "evil",
                    "email": "evil@x.com",
                    "name": "Evil",
                    "picture": "",
                },
            )
        )
        old_ids = settings.GOOGLE_APP_IDS
        old_id = settings.GOOGLE_APP_ID
        old_sec = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_IDS = "first-id,second-id"
        settings.GOOGLE_APP_ID = ""
        settings.GOOGLE_SECRET = "sec"
        try:
            resp = await client.get("/api/v1/auth/google/pc/wxCode?code=c")
            data = resp.json()
            assert data["code"] != 0
            assert "校验失败" in data["message"]
        finally:
            settings.GOOGLE_APP_IDS = old_ids
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_SECRET = old_sec

    async def test_config_endpoint_multi_count(self, client):
        old_ids = settings.GOOGLE_APP_IDS
        old_aids = settings.GOOGLE_ANDROID_IDS
        settings.GOOGLE_APP_IDS = "a1,a2,a3"
        settings.GOOGLE_ANDROID_IDS = "b1,b2"
        try:
            resp = await client.get("/api/v1/auth/google/config")
            data = resp.json()
            cfg = data["data"]
            assert cfg["app_id_count"] == 3
            assert cfg["android_id_count"] == 2
        finally:
            settings.GOOGLE_APP_IDS = old_ids
            settings.GOOGLE_ANDROID_IDS = old_aids


class TestGoogleConfigEndpoint:
    """Google /config 端点运维视图."""

    async def test_config_endpoint_all_unset(self, client):
        old_id = settings.GOOGLE_APP_ID
        old_aid = settings.GOOGLE_ANDROID_ID
        old_sec = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = ""
        settings.GOOGLE_ANDROID_ID = ""
        settings.GOOGLE_SECRET = ""
        try:
            resp = await client.get("/api/v1/auth/google/config")
            data = resp.json()
            assert data["code"] == 0
            cfg = data["data"]
            assert cfg["app_id_configured"] is False
            assert cfg["android_id_configured"] is False
            assert cfg["secret_configured"] is False
            assert "googleapis" in cfg["token_endpoint"]
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_ANDROID_ID = old_aid
            settings.GOOGLE_SECRET = old_sec

    async def test_config_endpoint_all_set(self, client):
        old_id = settings.GOOGLE_APP_ID
        old_aid = settings.GOOGLE_ANDROID_ID
        old_sec = settings.GOOGLE_SECRET
        settings.GOOGLE_APP_ID = "x.apps.googleusercontent.com"
        settings.GOOGLE_ANDROID_ID = "android-id-2"
        settings.GOOGLE_SECRET = "secret-val"
        try:
            resp = await client.get("/api/v1/auth/google/config")
            data = resp.json()
            assert data["code"] == 0
            cfg = data["data"]
            assert cfg["app_id_configured"] is True
            assert cfg["android_id_configured"] is True
            assert cfg["secret_configured"] is True
        finally:
            settings.GOOGLE_APP_ID = old_id
            settings.GOOGLE_ANDROID_ID = old_aid
            settings.GOOGLE_SECRET = old_sec
