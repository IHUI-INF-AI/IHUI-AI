"""支付宝工具单测 (RSA2 签名/验签 + 业务函数)."""

import base64
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import settings
from app.utils.alipay_util import (
    _load_alipay_private_key,
    _load_alipay_public_key,
    _rsa_sign,
    _rsa_verify,
    app_pay_order,
    build_signed_url,
    close_order,
    download_bill_url,
    generate_out_trade_no,
    query_order,
    refund_order,
    verify_notify,
)

# ---------------------------------------------------------------------------
# Fixtures: 动态生成一对 RSA 测试密钥
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rsa_keypair() -> tuple[str, str]:
    """生成 2048-bit RSA 密钥对, 返回 (private_pem, public_pem)."""
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
# TestKeyLoading
# ---------------------------------------------------------------------------


class TestKeyLoading:
    def test_load_private_key_success(self, keypair_files, rsa_keypair):
        priv_path, _ = keypair_files
        content = _load_alipay_private_key()
        assert content == rsa_keypair[0]

    def test_load_public_key_success(self, keypair_files, rsa_keypair):
        _, pub_path = keypair_files
        content = _load_alipay_public_key()
        assert content == rsa_keypair[1]

    def test_load_private_key_missing_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr(settings, "ALIPAY_PRIVATE_KEY_PATH", str(tmp_path / "missing.pem"))
        assert _load_alipay_private_key() == ""

    def test_load_public_key_missing_returns_empty(self, tmp_path, monkeypatch):
        monkeypatch.setattr(settings, "ALIPAY_PUBLIC_KEY_PATH", str(tmp_path / "missing.pub"))
        assert _load_alipay_public_key() == ""


# ---------------------------------------------------------------------------
# TestRSASign
# ---------------------------------------------------------------------------


class TestRSASign:
    def test_sign_returns_base64(self, rsa_keypair):
        private_pem, _ = rsa_keypair
        sig = _rsa_sign("hello world", private_pem)
        # base64 解码后是 256 bytes (2048-bit key)
        decoded = base64.b64decode(sig)
        assert len(decoded) == 256

    def test_sign_deterministic_for_same_input(self, rsa_keypair):
        private_pem, _ = rsa_keypair
        s1 = _rsa_sign("same content", private_pem)
        s2 = _rsa_sign("same content", private_pem)
        # PKCS1v15 签名对同样输入是确定性的
        assert s1 == s2

    def test_sign_different_for_different_input(self, rsa_keypair):
        private_pem, _ = rsa_keypair
        s1 = _rsa_sign("content A", private_pem)
        s2 = _rsa_sign("content B", private_pem)
        assert s1 != s2

    def test_verify_roundtrip(self, rsa_keypair):
        private_pem, public_pem = rsa_keypair
        content = "round-trip test"
        sig = _rsa_sign(content, private_pem)
        assert _rsa_verify(content, sig, public_pem) is True

    def test_verify_fails_on_tampered_content(self, rsa_keypair):
        private_pem, public_pem = rsa_keypair
        sig = _rsa_sign("original", private_pem)
        assert _rsa_verify("tampered", sig, public_pem) is False

    def test_verify_fails_on_bad_signature(self, rsa_keypair):
        _, public_pem = rsa_keypair
        assert _rsa_verify("anything", "bm90LWEtcmVhbC1zaWc=", public_pem) is False

    def test_verify_invalid_pem_returns_false(self):
        # 异常 PEM → 返回 False (不抛)
        assert _rsa_verify("x", "sig", "not a pem") is False


# ---------------------------------------------------------------------------
# TestBuildSignedUrl
# ---------------------------------------------------------------------------


class TestBuildSignedUrl:
    def test_contains_required_params(self, keypair_files):
        url = build_signed_url(
            biz_content={
                "out_trade_no": "O001",
                "total_amount": "100.00",
                "subject": "测试",
            },
            method="alipay.trade.page.pay",
        )
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        assert "app_id" in qs
        assert qs["app_id"] == ["2021000000000001"]
        assert qs["method"] == ["alipay.trade.page.pay"]
        assert qs["sign_type"] == ["RSA2"]
        assert "sign" in qs
        assert qs["charset"] == ["utf-8"]
        assert qs["version"] == ["1.0"]
        assert "timestamp" in qs
        assert "biz_content" in qs

    def test_url_starts_with_gateway(self, keypair_files):
        url = build_signed_url({"out_trade_no": "O001"})
        assert url.startswith("https://openapi.alipay.com/gateway.do?")

    def test_signature_verifies(self, keypair_files, rsa_keypair):
        private_pem, public_pem = rsa_keypair
        url = build_signed_url({"out_trade_no": "O001", "subject": "测试商品"})
        qs = parse_qs(urlparse(url).query)
        sign = qs["sign"][0]
        # 重建被签字符串: 除 sign 外按字典序, 同样需 quote_plus
        # (alipay_util._rsa_sign 用的就是 quote_plus(str(v)))
        from urllib.parse import quote_plus

        params = {k: v[0] for k, v in qs.items() if k != "sign"}
        sorted_str = "&".join(f"{k}={quote_plus(str(params[k]))}" for k in sorted(params.keys()))
        assert _rsa_verify(sorted_str, sign, public_pem) is True

    def test_no_key_returns_unsigned_url(self, tmp_path, monkeypatch):
        monkeypatch.setattr(settings, "ALIPAY_PRIVATE_KEY_PATH", str(tmp_path / "missing.pem"))
        url = build_signed_url({"out_trade_no": "X"})
        assert "sign=" not in url  # 无 sign 参数


# ---------------------------------------------------------------------------
# TestVerifyNotify
# ---------------------------------------------------------------------------


class TestVerifyNotify:
    def test_valid_notify_passes(self, keypair_files, rsa_keypair):
        private_pem, public_pem = rsa_keypair
        params = {
            "app_id": "2021000000000001",
            "out_trade_no": "O100",
            "trade_no": "20231114...",
            "trade_status": "TRADE_SUCCESS",
        }
        # 模仿支付宝: 先 pop sign, 排序后签名, 注入
        sign = _rsa_sign(
            "&".join(f"{k}={params[k]}" for k in sorted(params.keys())),
            private_pem,
        )
        params["sign"] = sign
        params["sign_type"] = "RSA2"
        assert verify_notify(params.copy()) is True

    def test_tampered_notify_fails(self, keypair_files, rsa_keypair):
        private_pem, _ = rsa_keypair
        params = {"out_trade_no": "O100", "trade_status": "TRADE_SUCCESS"}
        sign = _rsa_sign(
            "&".join(f"{k}={params[k]}" for k in sorted(params.keys())),
            private_pem,
        )
        params["sign"] = sign
        params["sign_type"] = "RSA2"
        # 篡改内容
        params["trade_status"] = "TRADE_CLOSED"
        assert verify_notify(params.copy()) is False

    def test_missing_sign_returns_false(self, keypair_files):
        assert verify_notify({"out_trade_no": "x"}) is False

    def test_non_rsa2_returns_false(self, keypair_files):
        assert verify_notify({"out_trade_no": "x", "sign": "x", "sign_type": "RSA1"}) is False

    def test_no_public_key_returns_true_in_dev(self, tmp_path, monkeypatch, keypair_files):
        # 私有 monkeypatch 拿掉 pub key, verify_notify 应在 dev 模式下放行
        monkeypatch.setattr(settings, "ALIPAY_PUBLIC_KEY_PATH", str(tmp_path / "missing.pub"))
        assert verify_notify({"out_trade_no": "x", "sign": "x", "sign_type": "RSA2"}) is True


# ---------------------------------------------------------------------------
# TestGenerateOutTradeNo
# ---------------------------------------------------------------------------


class TestGenerateOutTradeNo:
    def test_format(self):
        no = generate_out_trade_no()
        # 14 位时间 (yyyyMMddHHmmss) + 8 位 uuid hex
        assert len(no) == 22
        prefix = no[:14]
        assert prefix.isdigit()

    def test_unique(self):
        seen = {generate_out_trade_no() for _ in range(50)}
        assert len(seen) == 50


# ---------------------------------------------------------------------------
# TestAppPayOrder (async, 只验证组装结构)
# ---------------------------------------------------------------------------


class TestAppPayOrder:
    @pytest.mark.asyncio
    async def test_returns_signed_orderstr(self, keypair_files, rsa_keypair):
        _, public_pem = rsa_keypair
        orderstr = await app_pay_order(
            out_trade_no="OAPP001",
            total_amount="0.01",
            subject="App支付测试",
        )
        # out_trade_no / subject 等字段在 biz_content 内 (URL-encoded JSON),
        # 需先 url-decode 后再查
        from urllib.parse import parse_qs as _parse_qs
        from urllib.parse import unquote as _unquote

        qs = _parse_qs(orderstr)
        biz = _unquote(qs["biz_content"][0])
        assert '"out_trade_no"' in biz
        assert "OAPP001" in biz
        assert '"total_amount"' in biz
        assert "0.01" in biz
        assert qs["method"] == ["alipay.trade.app.pay"]
        assert "sign" in qs
        # 验证签名
        from urllib.parse import quote_plus as _qp

        params = {k: v[0] for k, v in qs.items() if k != "sign"}
        sorted_str = "&".join(f"{k}={_qp(str(params[k]))}" for k in sorted(params.keys()))
        assert _rsa_verify(sorted_str, qs["sign"][0], public_pem) is True


# ---------------------------------------------------------------------------
# TestQueryOrder (async, mock httpx)
# ---------------------------------------------------------------------------


class TestQueryOrder:
    @pytest.mark.asyncio
    async def test_query_returns_response(self, keypair_files, monkeypatch):
        # Mock httpx.AsyncClient.get
        class _MockResp:
            def json(self_inner):
                return {
                    "alipay_trade_query_response": {
                        "code": "10000",
                        "msg": "Success",
                        "out_trade_no": "OQ001",
                        "trade_status": "TRADE_SUCCESS",
                    },
                    "sign": "ignored-in-mock",
                }

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await query_order("OQ001")
        assert result["alipay_trade_query_response"]["code"] == "10000"
        assert result["alipay_trade_query_response"]["trade_status"] == "TRADE_SUCCESS"


# ---------------------------------------------------------------------------
# TestRefundOrder
# ---------------------------------------------------------------------------


class TestRefundOrder:
    @pytest.mark.asyncio
    async def test_refund_success(self, keypair_files, monkeypatch):
        class _MockResp:
            def json(self_inner):
                return {
                    "alipay_trade_refund_response": {
                        "code": "10000",
                        "msg": "Success",
                        "out_trade_no": "OR001",
                        "refund_amount": "10.00",
                    },
                    "sign": "x",
                }

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await refund_order("OR001", "10.00")
        assert "out_request_no" in result
        assert result["alipay_trade_refund_response"]["code"] == "10000"

    @pytest.mark.asyncio
    async def test_refund_exception_returns_code_neg1(self, keypair_files, monkeypatch):
        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                raise RuntimeError("network down")

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await refund_order("OR002", "5.00")
        assert result["code"] == -1
        assert "out_request_no" in result

    @pytest.mark.asyncio
    async def test_refund_default_request_no_generated(self, keypair_files, monkeypatch):
        captured = {}

        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                captured["url"] = url
                raise RuntimeError("x")

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        await refund_order("OR003", "1.00")
        # out_request_no 在 biz_content 内 (URL-encoded JSON), url-decode 后查
        from urllib.parse import parse_qs as _parse_qs
        from urllib.parse import unquote as _unquote
        from urllib.parse import urlparse as _urlparse

        qs = _parse_qs(_urlparse(captured["url"]).query)
        biz = _unquote(qs["biz_content"][0])
        assert "out_request_no" in biz
        import re

        m = re.search(r'"out_request_no"\s*:\s*"(r[^"]+)"', biz)
        assert m is not None
        assert m.group(1).startswith("r")


# ---------------------------------------------------------------------------
# TestCloseOrder
# ---------------------------------------------------------------------------


class TestCloseOrder:
    @pytest.mark.asyncio
    async def test_close_success(self, keypair_files, monkeypatch):
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
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await close_order("OC001")
        assert result["alipay_trade_close_response"]["code"] == "10000"

    @pytest.mark.asyncio
    async def test_close_error_returns_neg1(self, keypair_files, monkeypatch):
        class _MockClient:
            def __init__(self_inner, *a, **kw):
                pass

            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, *a):
                return False

            async def get(self_inner, url):
                raise RuntimeError("net error")

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await close_order("OC002")
        assert result["code"] == -1


# ---------------------------------------------------------------------------
# TestDownloadBillUrl
# ---------------------------------------------------------------------------


class TestDownloadBillUrl:
    @pytest.mark.asyncio
    async def test_download_returns_url(self, keypair_files, monkeypatch):
        class _MockResp:
            def json(self_inner):
                return {
                    "alipay_data_dataservice_bill_downloadurl_query_response": {
                        "code": "10000",
                        "bill_download_url": "https://example.com/bill.csv",
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
                return _MockResp()

        import httpx

        monkeypatch.setattr(httpx, "AsyncClient", _MockClient)
        result = await download_bill_url("2023-11-14")
        # result 是 nested dict (alipay 接口返回的原始 JSON)
        body = result["alipay_data_dataservice_bill_downloadurl_query_response"]
        assert "bill_download_url" in body
        assert body["bill_download_url"].startswith("https://")
