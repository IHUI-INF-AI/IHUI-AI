# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""api_client TLS 校验:默认校验,只有显式开发开关才能关掉。

覆盖:
- MTLS_ENABLED=false 时不再 verify=False
- production(含 NODE_ENV 优先于 settings)拒绝关闭
- 非生产且 API_CLIENT_TLS_VERIFY 为关值时,client.tls_verify 与 ssl 上下文都能看见
- 已有 CA 环境变量优先于 certifi;路径不存在则跳过,不把客户端构造打崩
- mTLS 仍校验 CA,开发开关关不掉
"""

from __future__ import annotations

import ssl
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from app.core.config import settings
from app.services import api_client as api_client_mod
from app.services.api_client import (
    API_CLIENT_TLS_VERIFY_ENV,
    get_api_client,
    resolve_api_tls_verify,
)

_CA_ENV_KEYS = (
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "CURL_CA_BUNDLE",
    "REQUESTS_CA_BUNDLE",
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_CA_CERTS",
)


@pytest.fixture(autouse=True)
async def _isolate_api_client(monkeypatch: pytest.MonkeyPatch) -> None:
    """每个用例从「生产、mTLS 关、没有开发开关、没有 CA 覆盖」起步,并清掉单例。"""
    monkeypatch.setattr(settings, "mtls_enabled", False)
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv(API_CLIENT_TLS_VERIFY_ENV, raising=False)
    for key in _CA_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    api_client_mod._api_client = None
    yield
    current = api_client_mod._api_client
    api_client_mod._api_client = None
    if current is not None and not current.is_closed:
        await current.aclose()


@asynccontextmanager
async def _built_client() -> AsyncIterator[httpx.AsyncClient]:
    client = api_client_mod._build_api_client()
    try:
        yield client
    finally:
        if not client.is_closed:
            await client.aclose()


def _tls_bits(client: httpx.AsyncClient) -> tuple[ssl.VerifyMode, bool]:
    ctx = client._transport._pool._ssl_context  # 证明 verify 真的进了 httpx,而不只是挂了属性
    return ctx.verify_mode, bool(ctx.check_hostname)


def _ca_common_names(client: httpx.AsyncClient) -> set[str]:
    ctx = client._transport._pool._ssl_context
    names: set[str] = set()
    for item in ctx.get_ca_certs():
        for rdn in item.get("subject") or ():
            for attr in rdn:
                if attr[0] == "commonName":
                    names.add(str(attr[1]))
    return names


def _write_ca(path: Path, common_name: str) -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=2))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


async def test_mtls_off_defaults_to_verifying_tls() -> None:
    """回归:mTLS 关闭且没有开发开关时,内部调用必须校验 TLS。"""
    decision = resolve_api_tls_verify(
        mtls_enabled=False,
        ca_cert_path="unused.crt",
        environ={},
        node_env="production",
    )
    assert decision.enabled is True
    assert decision.verify is True
    assert decision.source == "default"
    async with _built_client() as client:
        assert client.tls_verify == decision
        assert client.tls_verify.enabled is True
        assert _tls_bits(client) == (ssl.CERT_REQUIRED, True)


async def test_development_without_switch_still_verifies(monkeypatch: pytest.MonkeyPatch) -> None:
    """开发环境本身不是关闭校验的理由。"""
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setattr(settings, "node_env", "development")
    async with _built_client() as client:
        assert client.tls_verify.enabled is True
        assert client.tls_verify.verify is True
        assert client.tls_verify.source == "default"
        assert _tls_bits(client) == (ssl.CERT_REQUIRED, True)


@pytest.mark.parametrize("raw", ["0", "false", "no", "off", "FALSE", " Off "])
async def test_dev_switch_off_is_visible(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    """非生产里显式关值必须让测试看见 verify=False,并且 httpx 真的不校验。"""
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, raw)
    async with _built_client() as client:
        decision = client.tls_verify
        assert decision.enabled is False
        assert decision.verify is False
        assert decision.source == "dev-switch"
        assert _tls_bits(client) == (ssl.CERT_NONE, False)


@pytest.mark.parametrize("raw", ["true", "1", "yes", "on", "", "maybe"])
async def test_non_off_switch_keeps_verification(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, raw)
    async with _built_client() as client:
        assert client.tls_verify.enabled is True
        assert client.tls_verify.verify is True
        assert _tls_bits(client)[0] == ssl.CERT_REQUIRED


async def test_production_ignores_off_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    """生产默认保持校验。已有 NODE_ENV 优先于 settings.node_env。"""
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    monkeypatch.setattr(settings, "node_env", "development")
    async with _built_client() as client:
        assert client.tls_verify.enabled is True
        assert client.tls_verify.verify is True
        assert client.tls_verify.source == "production-kept"
        assert _tls_bits(client) == (ssl.CERT_REQUIRED, True)


async def test_node_env_env_beats_settings_for_dev_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    """settings 仍是 production 时,进程里的 NODE_ENV=development 允许显式关闭。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    async with _built_client() as client:
        assert client.tls_verify.source == "dev-switch"
        assert client.tls_verify.enabled is False


def test_blank_node_env_argument_stays_production() -> None:
    decision = resolve_api_tls_verify(
        mtls_enabled=False,
        ca_cert_path="unused.crt",
        environ={API_CLIENT_TLS_VERIFY_ENV: "false"},
        node_env="  ",
    )
    assert decision.enabled is True
    assert decision.source == "production-kept"


async def test_existing_ca_env_beats_later_bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """SSL_CERT_FILE 优先于后面的 CURL_CA_BUNDLE,信任库里能看见前者的 CN。"""
    first = tmp_path / "first.pem"
    second = tmp_path / "second.pem"
    _write_ca(first, "ihui-ca-first")
    _write_ca(second, "ihui-ca-second")
    monkeypatch.setenv("SSL_CERT_FILE", str(first))
    monkeypatch.setenv("CURL_CA_BUNDLE", str(second))
    async with _built_client() as client:
        assert client.tls_verify.enabled is True
        assert client.tls_verify.source == "SSL_CERT_FILE"
        assert client.tls_verify.verify == str(first)
        assert "ihui-ca-first" in _ca_common_names(client)
        assert "ihui-ca-second" not in _ca_common_names(client)
        assert _tls_bits(client) == (ssl.CERT_REQUIRED, True)


async def test_missing_ca_file_falls_through_without_breaking_client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """指向不存在文件的 SSL_CERT_FILE 被跳过,客户端仍按默认库校验。"""
    monkeypatch.setenv("SSL_CERT_FILE", str(tmp_path / "missing.pem"))
    async with _built_client() as client:
        assert client.tls_verify.source == "default"
        assert client.tls_verify.verify is True
        assert _tls_bits(client) == (ssl.CERT_REQUIRED, True)


async def test_production_off_switch_still_prefers_existing_ca(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """生产里关开关无效;已有 CA 环境变量仍优先于 certifi。"""
    ca_file = tmp_path / "prod.pem"
    _write_ca(ca_file, "ihui-ca-prod")
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    monkeypatch.setenv("REQUESTS_CA_BUNDLE", str(ca_file))
    async with _built_client() as client:
        assert client.tls_verify.enabled is True
        assert client.tls_verify.source == "REQUESTS_CA_BUNDLE"
        assert client.tls_verify.verify == str(ca_file)
        assert "ihui-ca-prod" in _ca_common_names(client)


async def test_dev_switch_off_beats_ca_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """非生产里显式关闭优先于 CA 环境变量,并且关闭结果仍能被看见。"""
    ca_file = tmp_path / "dev.pem"
    _write_ca(ca_file, "ihui-ca-dev")
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    monkeypatch.setenv("SSL_CERT_FILE", str(ca_file))
    async with _built_client() as client:
        assert client.tls_verify.enabled is False
        assert client.tls_verify.verify is False
        assert client.tls_verify.source == "dev-switch"
        assert _tls_bits(client) == (ssl.CERT_NONE, False)


async def test_ssl_cert_dir_is_visible_when_it_is_a_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    capath = tmp_path / "certs"
    capath.mkdir()
    monkeypatch.setenv("SSL_CERT_DIR", str(capath))
    async with _built_client() as client:
        assert client.tls_verify.source == "SSL_CERT_DIR"
        assert client.tls_verify.verify == str(capath)
        assert client.tls_verify.enabled is True
        assert _tls_bits(client)[0] == ssl.CERT_REQUIRED


def test_mtls_keeps_ca_verify_even_if_dev_switch_off() -> None:
    decision = resolve_api_tls_verify(
        mtls_enabled=True,
        ca_cert_path="apps/api/certs/mtls/ca.crt",
        environ={API_CLIENT_TLS_VERIFY_ENV: "false", "NODE_ENV": "development"},
    )
    assert decision.enabled is True
    assert decision.verify == "apps/api/certs/mtls/ca.crt"
    assert decision.source == "mtls-ca"


def test_mtls_builder_passes_cert_and_ca(monkeypatch: pytest.MonkeyPatch) -> None:
    """mTLS 构造把 CA 路径交给 httpx.verify,不因开发开关改成 False。"""
    captured: dict[str, object] = {}

    class _FakeClient:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)
            self.is_closed = False

        async def aclose(self) -> None:
            self.is_closed = True

    monkeypatch.setattr(settings, "mtls_enabled", True)
    monkeypatch.setattr(settings, "mtls_client_cert_path", "client.crt")
    monkeypatch.setattr(settings, "mtls_client_key_path", "client.key")
    monkeypatch.setattr(settings, "mtls_ca_cert_path", "ca.crt")
    monkeypatch.setenv("NODE_ENV", "development")
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    monkeypatch.setattr(api_client_mod, "_ApiHttpClient", _FakeClient)

    client = api_client_mod._build_api_client()
    assert captured["verify"] == "ca.crt"
    assert captured["cert"] == ("client.crt", "client.key")
    assert client.tls_verify.enabled is True
    assert client.tls_verify.verify == "ca.crt"
    assert client.tls_verify.source == "mtls-ca"


async def test_singleton_exposes_decision_and_rebuilds_after_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """关掉开关后,下一次新建的共享客户端必须让测试看见 verify=False。"""
    monkeypatch.setenv("NODE_ENV", "development")
    first = get_api_client()
    assert first.tls_verify.enabled is True
    assert get_api_client() is first
    monkeypatch.setenv(API_CLIENT_TLS_VERIFY_ENV, "false")
    assert get_api_client() is first
    await api_client_mod.close_api_client()
    second = get_api_client()
    assert second is not first
    assert second.tls_verify.enabled is False
    assert second.tls_verify.verify is False
    assert second.tls_verify.source == "dev-switch"
    assert _tls_bits(second) == (ssl.CERT_NONE, False)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
