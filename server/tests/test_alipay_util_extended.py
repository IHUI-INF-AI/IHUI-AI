"""P15-B 业务模块加测: alipay_util 边界 + 异常路径.

目标: 补充 test_alipay_util.py 没覆盖的边界 (generate_out_trade_no 格式细化) +
      异常 (refund_order 自定义 out_request_no、_rsa_verify 解码失败、关闭单异常)
      路径. 跟 test_alipay_util.py 互补, 不重复.
"""

import base64
import re
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.utils.alipay_util import (
    _rsa_sign,
    _rsa_verify,
    close_order,
    generate_out_trade_no,
    query_order,
    refund_order,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rsa_keypair() -> tuple[str, str]:
    """生成 2048-bit RSA 密钥对."""
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = (
        private.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
    )
    return private_pem, public_pem


@pytest.fixture
def keypair_files(rsa_keypair, tmp_path, monkeypatch) -> tuple[Path, Path]:
    """把 RSA 密钥写入临时文件, monkeypatch settings 指向它们."""
    private_pem, public_pem = rsa_keypair
    priv_path = tmp_path / "alipay_priv.pem"
    pub_path = tmp_path / "alipay_pub.pem"
    priv_path.write_text(private_pem, encoding="utf-8")
    pub_path.write_text(public_pem, encoding="utf-8")
    monkeypatch.setattr(settings, "ALIPAY_PRIVATE_KEY_PATH", str(priv_path))
    monkeypatch.setattr(settings, "ALIPAY_PUBLIC_KEY_PATH", str(pub_path))
    monkeypatch.setattr(settings, "ALIPAY_APP_ID", "2021000000000001")
    monkeypatch.setattr(settings, "ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do")
    return priv_path, pub_path


# ---------------------------------------------------------------------------
# TestGenerateOutTradeNoExtended: 细化格式
# ---------------------------------------------------------------------------


class TestGenerateOutTradeNoExtended:
    """generate_out_trade_no() 22 字符 (14 位时间 + 8 位 hex)."""

    def test_format_exact(self):
        no = generate_out_trade_no()
        assert len(no) == 22
        # 前 14 位是 yyyyMMddHHmmss
        prefix = no[:14]
        assert prefix.isdigit()
        # 14 位对应 4+2+2+2+2+2 = 14 数字
        assert len(prefix) == 14
        # 后 8 位是 hex
        suffix = no[14:]
        assert re.match(r"^[0-9a-f]{8}$", suffix), f"suffix '{suffix}' not hex"

    def test_prefix_is_current_time(self):
        import time

        before_str = time.strftime("%Y%m%d%H%M%S", time.localtime(time.time() - 1))
        no = generate_out_trade_no()
        after_str = time.strftime("%Y%m%d%H%M%S", time.localtime(time.time() + 1))
        # 14 位 yyyyMMddHHmmss 字符串比较
        prefix_str = no[:14]
        assert before_str <= prefix_str <= after_str, f"prefix {prefix_str} 不在 [{before_str}, {after_str}] 范围内"

    def test_concurrent_calls_have_different_suffix(self):
        """100 次连续生成, 后 8 位 (uuid hex) 都不应相同 (高概率)."""
        seen = set()
        for _ in range(100):
            seen.add(generate_out_trade_no()[14:])
        assert len(seen) == 100


# ---------------------------------------------------------------------------
# TestRsaVerifyEdgeCases: 验签异常分支
# ---------------------------------------------------------------------------


class TestRsaVerifyEdgeCases:
    """_rsa_verify 异常路径: 解码失败 / 公钥异常 / 签名长度错."""

    def test_empty_signature_returns_false(self, rsa_keypair):
        _, public_pem = rsa_keypair
        assert _rsa_verify("content", "", public_pem) is False

    def test_non_base64_signature_returns_false(self, rsa_keypair):
        _, public_pem = rsa_keypair
        # base64 解码会失败
        assert _rsa_verify("content", "!!! not base64 !!!", public_pem) is False

    def test_short_signature_returns_false(self, rsa_keypair):
        _, public_pem = rsa_keypair
        # base64 合法但签名长度不够 (RSA-2048 签名应为 256 字节)
        short_sig = base64.b64encode(b"x" * 10).decode("utf-8")
        assert _rsa_verify("content", short_sig, public_pem) is False

    def test_wrong_key_returns_false(self, rsa_keypair):
        """用其他 RSA 密钥签的内容, 用本公钥验 → False."""
        private_pem, public_pem = rsa_keypair
        # 单独生成一对
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        other_pem = other.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
        sig = _rsa_sign("content", other_pem)
        # 用我的公钥验对方的签名 → False
        assert _rsa_verify("content", sig, public_pem) is False


# ---------------------------------------------------------------------------
# TestRefundOrderCustomRequestNo: 退款自定义请求号
# ---------------------------------------------------------------------------


class TestRefundOrderCustomRequestNo:
    """refund_order 自定义 out_request_no (避免重复退款被拒)."""

    @pytest.mark.asyncio
    async def test_custom_out_request_no_used(self, keypair_files, monkeypatch):
        captured = {}

        class _MockResp:
            def json(self_inner):
                return {
                    "alipay_trade_refund_response": {
                        "code": "10000",
                        "msg": "Success",
                        "out_trade_no": "OR001",
                    }
                }

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                captured["url"] = url
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await refund_order("OR001", "10.00", out_request_no="my-custom-r-12345")
        assert result["out_request_no"] == "my-custom-r-12345"
        # 验证 URL 中 biz_content 含自定义 out_request_no
        qs = parse_qs(urlparse(captured["url"]).query)
        biz = unquote(qs["biz_content"][0])
        assert "my-custom-r-12345" in biz

    @pytest.mark.asyncio
    async def test_custom_reason_passed_through(self, keypair_files, monkeypatch):
        captured = {}

        class _MockResp:
            def json(self_inner):
                return {
                    "alipay_trade_refund_response": {
                        "code": "10000",
                        "msg": "Success",
                    }
                }

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                captured["url"] = url
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        await refund_order("OR002", "5.00", reason="客户主动取消订单", out_request_no="r-cancel-001")
        qs = parse_qs(urlparse(captured["url"]).query)
        biz = unquote(qs["biz_content"][0])
        # 中文 reason 应原样保留在 biz_content JSON 中
        assert "客户主动取消订单" in biz

    @pytest.mark.asyncio
    async def test_amount_zero_in_request(self, keypair_files, monkeypatch):
        """退款金额 0 → biz_content.total_amount 是 "0" / "0.00" 之一 (字符串)."""
        captured = {}

        class _MockResp:
            def json(self_inner):
                return {"alipay_trade_refund_response": {"code": "10000", "msg": "Success"}}

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                captured["url"] = url
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        await refund_order("OR003", "0", out_request_no="r-zero-001")
        qs = parse_qs(urlparse(captured["url"]).query)
        biz = unquote(qs["biz_content"][0])
        # amount 原样传
        assert '"refund_amount": "0"' in biz or '"refund_amount":"0"' in biz


# ---------------------------------------------------------------------------
# TestQueryOrderEdgeCases: query_order 异常路径
# ---------------------------------------------------------------------------


class TestQueryOrderEdgeCases:
    """query_order 异常: 网络错误/超时 → unhandled (返回 .json() 错误)."""

    @pytest.mark.asyncio
    async def test_query_network_error_propagates(self, keypair_files, monkeypatch):
        """query_order 没 try/except, 网络错误应向上抛."""
        import httpx

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                raise RuntimeError("network unreachable")

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        with pytest.raises(RuntimeError, match="network unreachable"):
            await query_order("OQ999")


# ---------------------------------------------------------------------------
# TestCloseOrderUnicode: close_order 业务字段 unicode
# ---------------------------------------------------------------------------


class TestCloseOrderUnicode:
    """close_order unicode 字段透传 (虽然没有 user-facing 字段, 但应该稳定)."""

    @pytest.mark.asyncio
    async def test_close_with_unicode_out_trade_no(self, keypair_files, monkeypatch):
        captured = {}

        class _MockResp:
            def json(self_inner):
                return {"alipay_trade_close_response": {"code": "10000", "msg": "Success"}}

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                captured["url"] = url
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await close_order("OC-中文-001")
        assert result["alipay_trade_close_response"]["code"] == "10000"
        qs = parse_qs(urlparse(captured["url"]).query)
        biz = unquote(qs["biz_content"][0])
        assert "OC-中文-001" in biz
