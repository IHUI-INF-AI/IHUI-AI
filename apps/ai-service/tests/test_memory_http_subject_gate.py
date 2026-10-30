# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""出站 /api/memory 的主体闸(2026-10-28 立,治生产 `GET /api/memory -> 500` × 18/24h)。

一手现场与判序(全部本机复跑过):
- 生产 `api_logs`:`GET /api/memory` 近 24h 18 次 500,UA=python-httpx/0.28.1(=本服务),
  `user_id` 列空,`duration` 6–11ms(快速失败)。
- 本机 8802 用**本服务自己的** `internal_service_headers` 出口重放同一形请求:
  主体 `system-worker` / `1` ⇒ HTTP 500,真异常 `DrizzleQueryError` ← Postgres
  `22P02 invalid input syntax for type uuid`;换成合法 uuid 形态 ⇒ 401 User not found。
- 即:`users.id` 是 uuid 列,而网关注入的系统身份 `sub='system-worker'`
  (apps/api/src/utils/system-access-token.ts)被本服务原样当主体转了回来 ——
  它在 `users` 表结构上不可能有行,这一枪本来就不该打。

覆盖四条,缺一不可:
  ① 伪身份 ⇒ **零出站请求**(读侧返回 []、写侧直接跳过);
  ② 写侧还额外要求 **零 LLM 调用 + 零隐私查询**(闸门在拼文本之前,不是"照提取不入库"的假开关);
  ③ 正向对照:合法 uuid 主体**照常出站**、两把头照发、`sub` 就是它自己
     (否则本闸就成了 §12e 那种一刀切的恒红闸);
  ④ 判据只有一份:本文件 import 源函数的 `_memory_http_subject`,不复制第二套形状尺(§22c)。

全程纯单元:httpx 客户端与 LLM 网关全换假件,不连生产 Redis(8811)/PG(8810)。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)
from app.services.memory_service import MemoryService, _memory_http_subject

UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"
SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
#: 生产里真实打出来的那一枚伪身份(网关系统 token 的 sub),以及同型的数字 legacy id。
PSEUDO_SUBJECTS = ("system-worker", "1", "abc", "", "   ")


class _FakeResp:
    def __init__(self, payload: dict[str, Any] | None = None) -> None:
        self._payload: dict[str, Any] = payload if payload is not None else {}
        self.status_code = 200
        self.text = ""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


def _make_fake_httpx(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, dict[str, str]]]:
    """替换 httpx.AsyncClient,返回捕获表 [(method, url, headers)];空表 = 一发都没打。"""
    captured: list[tuple[str, str, dict[str, str]]] = []

    class _FakeClient:
        def __init__(self, **kwargs: Any) -> None:
            return None

        async def __aenter__(self) -> _FakeClient:
            return self

        async def __aexit__(self, *exc: Any) -> bool:
            return False

        async def get(self, url: str, **kwargs: Any) -> _FakeResp:
            captured.append(("GET", url, dict(kwargs.get("headers") or {})))
            return _FakeResp({"data": {"entries": []}})

        async def post(self, url: str, **kwargs: Any) -> _FakeResp:
            captured.append(("POST", url, dict(kwargs.get("headers") or {})))
            return _FakeResp()

    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)
    return captured


@pytest.fixture()
def svc() -> MemoryService:
    return MemoryService(gateway=object())


@pytest.fixture()
def with_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)


# ── 0. 判据本身:形状归形状,身份归身份 ────────────────────────────────────
def test_闸_伪身份与非形式主体一律读成无主体() -> None:
    for subject in PSEUDO_SUBJECTS:
        assert _memory_http_subject(subject) is None, subject
    assert _memory_http_subject(None) is None
    # 合法 uuid(含系统属主那枚全零形态)必须原样通过,只去首尾空白
    assert _memory_http_subject(UID) == UID
    assert _memory_http_subject(f"  {UID}  ") == UID
    assert _memory_http_subject("00000000-0000-0000-0000-000000000000") == (
        "00000000-0000-0000-0000-000000000000"
    )


# ── 1. 读侧 ──────────────────────────────────────────────────────────────
async def test_读侧_伪身份零出站且返回空(svc: MemoryService, monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _make_fake_httpx(monkeypatch)
    for subject in ("system-worker", "1"):
        got = await svc._fetch_memory_entries(subject, scope="user")
        assert got == []
    # 副作用未发生:一条出站请求都没发(生产那 18 次 500 的通道就此断掉)
    assert captured == []


async def test_读侧_正向对照_合法主体照常出站且两把头同发(
    svc: MemoryService, monkeypatch: pytest.MonkeyPatch, with_jwt_secret: None
) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "legacy-secret")
    captured = _make_fake_httpx(monkeypatch)
    got = await svc._fetch_memory_entries(UID, scope="user")
    assert got == []  # 假件返回空桶,这里量的是"发没发",不是"有没有记忆"
    assert len(captured) == 1
    method, url, headers = captured[0]
    assert method == "GET"
    assert url.endswith("/api/memory")
    assert headers[USER_ID_HEADER] == UID
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert INTERNAL_TICKET_HEADER in headers


# ── 2. 写侧 ──────────────────────────────────────────────────────────────
class _RecordingGateway:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, messages: Any, **kwargs: Any) -> dict[str, Any]:
        self.calls += 1
        return {"content": '[{"type": "preference", "text": "喜欢简洁回复"}]'}


async def test_写侧_伪身份零出站零LLM零隐私查询(monkeypatch: pytest.MonkeyPatch) -> None:
    gateway = _RecordingGateway()
    svc = MemoryService(gateway=gateway)
    privacy = AsyncMock(return_value=True)
    monkeypatch.setattr(svc, "_is_auto_memory_enabled", privacy)
    captured = _make_fake_httpx(monkeypatch)

    await svc.save_insights_from_conversation(
        "system-worker", [{"role": "user", "content": "我喜欢简洁"}]
    )
    # 副作用未发生三连:不发 LLM(省算力也省数据出域)、不读隐私开关、不落任何人的记忆桶
    assert captured == []
    assert gateway.calls == 0
    assert privacy.await_count == 0


async def test_写侧_正向对照_合法主体照常提取并落库(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: None
) -> None:
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "legacy-secret")
    gateway = _RecordingGateway()
    svc = MemoryService(gateway=gateway)
    monkeypatch.setattr(svc, "_is_auto_memory_enabled", AsyncMock(return_value=True))
    captured = _make_fake_httpx(monkeypatch)

    await svc.save_insights_from_conversation(
        UID, [{"role": "user", "content": "我喜欢简洁"}]
    )
    assert gateway.calls == 1
    assert len(captured) == 1
    method, url, headers = captured[0]
    assert method == "POST"
    assert url.endswith("/api/memory")
    assert headers[USER_ID_HEADER] == UID
    assert headers["Content-Type"] == "application/json"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
