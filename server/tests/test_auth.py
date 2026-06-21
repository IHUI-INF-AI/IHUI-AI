"""认证模块单元测试."""

from datetime import timedelta

from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class TestPassword:
    def test_hash_and_verify_ok(self):
        pwd = "Test1234"  # bcrypt 限制 ≤72 字节
        h = hash_password(pwd)
        assert h != pwd
        assert verify_password(pwd, h) is True

    def test_verify_wrong_password(self):
        h = hash_password("Correct")
        assert verify_password("WrongPass", h) is False


class TestJwt:
    def test_create_and_decode(self):
        token = create_access_token("user-uuid-1", expires_delta=timedelta(hours=1))
        assert token
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-uuid-1"
        assert "exp" in payload

    def test_invalid_token(self):
        """非法 token 返回 None（不抛异常）."""
        result = decode_access_token("not.a.valid.jwt")
        assert result is None

    def test_expired_token(self):
        token = create_access_token("u", expires_delta=timedelta(seconds=-5))
        result = decode_access_token(token)
        # 过期 token 返回 None
        assert result is None
