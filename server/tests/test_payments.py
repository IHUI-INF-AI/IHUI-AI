"""支付工具类单元测试（不涉及真实 API 调用）."""

import base64
import json


class TestWxUtil:
    def test_decrypt_roundtrip(self):
        """AES-256-GCM 加解密往返一致."""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        from app.config import settings

        # 用 32 字节 (256-bit) 测试 key (与生产无关, 仅单元测试加解密往返)
        old_key = settings.WX_PAY_V3_KEY
        settings.WX_PAY_V3_KEY = "0123456789abcdef0123456789abcdef"  # 32 chars = 32 bytes
        try:
            key = settings.WX_PAY_V3_KEY.encode("utf-8")
            assert len(key) == 32, f"key 必须 32 字节, 实际 {len(key)}"
            nonce = "zhs_nonce_2026"  # ≥8 字节
            associated_data = "zhs"
            plaintext = json.dumps({"out_trade_no": "test_123", "trade_state": "SUCCESS"}).encode("utf-8")
            ct = AESGCM(key).encrypt(nonce.encode(), plaintext, associated_data.encode())
            from app.utils.wechat_pay_util import decrypt_callback

            decoded = decrypt_callback(base64.b64encode(ct).decode(), nonce, associated_data)
            assert decoded["out_trade_no"] == "test_123"
            assert decoded["trade_state"] == "SUCCESS"
        finally:
            settings.WX_PAY_V3_KEY = old_key


class TestAlipayUtil:
    def test_sign_and_verify_roundtrip(self):
        """生成临时 RSA 密钥对，签名+验签一致。"""
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        from app.utils.alipay_util import _rsa_sign, _rsa_verify

        content = "app_id=test&method=test&timestamp=2026-06-12"
        sig = _rsa_sign(content, private_pem)
        assert _rsa_verify(content, sig, public_pem) is True
        assert _rsa_verify(content, "fake_sign", public_pem) is False
