# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""反向桥不再自报归属主体(Y-24 真漂①的最后一米,Z58 2026-11-06)。

apps/api 侧 `/api/internal/relay/user-pool/{upsert,delete}` 的主体已改由承载层注入
(短期票 sub → request.userId),body 的 ownerUserId 降级为兼容窗核对位(不等 403、相等
出声)。Z51 点名的真漂① = 发送侧还在塞这个同值键:再无权威但字面还在线上跑,本票摘它。

四把锁(纯单元,HTTP 在 httpx.AsyncClient 层拦截;api 侧「缺主体 401 不落 500」的承载层
用例在 apps/api/tests/internal-relay-user-pool-owner-subject.test.ts,本席只作指针):
① 桥发出的 payload 不含 ownerUserId(键级断言,不是断言值相等)—— upsert/delete 两型;
② 正向对照:主体仍逐字落在票 sub 与 X-User-Id 上(body 无键 ≠ 没主体);
③ 缺主体 ⇒ 桥结构上不发这一枪;即便对端回 401 也只落 pending,不冒 500;
④ 读点锁:全仓运行代码面再无向该端点自报主体的生产点。
"""

from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)
from app.services import checkin_user_pool_bridge as ub

OWNER = "00000000-0000-4000-8000-00000000000c"
LEGACY = "legacy-callback-secret"
BODY_OWNER_KEY = "ownerUserId"  # 被摘除的自报主体键名(只判键,不判断言取值)

_APP_ROOT = Path(__file__).resolve().parents[1] / "app"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_USER_POOL_PATHS = ("relay/user-pool/upsert", "relay/user-pool/delete")
_SCAN_SUFFIXES = frozenset({".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".vue"})
_SKIP_DIR_NAMES = frozenset({"node_modules", "dist", ".next", ".turbo", "build", "coverage"})


@pytest.fixture()
def with_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    """凭据由用例供,不靠本机 .env;jwt_secret 必须是真值才签得出票。"""
    monkeypatch.setattr(
        settings, "jwt_secret", "unit-test-shared-jwt-secret-0123456789-abcdefgh", raising=False
    )
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setattr(settings, "ai_callback_secret", LEGACY, raising=False)
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)


@pytest.fixture()
def real_bridge(monkeypatch: pytest.MonkeyPatch) -> Any:
    """拿回未被 autouse 隔离桩替换的真实现(conftest._isolate_checkin_pool_bridge)。

    reload 在原模块对象上重跑 → 其他用例的桩仍由那个 autouse 夹具负责,互不影响。
    身份解析一并钉死,免得用例随 derive_account_identity 的平台规则漂移。
    """
    mod = importlib.reload(ub)
    monkeypatch.setattr(mod, "derive_account_identity", lambda *_a, **_k: "uid-fixed")
    return mod


def _claims(headers: dict[str, str]) -> dict[str, Any]:
    """解出票面声明(主体必须住在票里,不住在 body 里)。"""
    return pyjwt.decode(
        headers[INTERNAL_TICKET_HEADER],
        settings.jwt_secret,
        algorithms=["HS256"],
        audience="ihui-internal-service",
    )


class _Recorder:
    """httpx.AsyncClient 替身:记下载体与头,并按脚本回状态码。"""

    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code
        self.calls: list[dict[str, Any]] = []

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        recorder = self

        class FakeResp:
            status_code = recorder.status_code

            @property
            def text(self) -> str:
                return '{"code":401,"message":"缺少内部票主体"}'

            def json(self) -> dict[str, Any]:
                return {"data": {"poolAccountId": "pa-1"}}

        class FakeClient:
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                pass

            async def __aenter__(self) -> FakeClient:
                return self

            async def __aexit__(self, *args: Any) -> None:
                return None

            async def post(self, url: str, **kwargs: Any) -> FakeResp:
                recorder.calls.append({"url": url, "json": kwargs["json"], "headers": kwargs["headers"]})
                return FakeResp()

        monkeypatch.setattr(ub.httpx, "AsyncClient", FakeClient)


# ── ① + ② 键级断言与正向对照 ────────────────────────────────────────────────
async def test_upsert_桥发出的载荷_键级不含自报主体_主体在票上(
    real_bridge: Any, with_secrets: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    rec = _Recorder()
    rec.install(monkeypatch)
    changed, dm = await real_bridge.sync_upsert(
        owner_user_id=OWNER,
        account_id=7,
        platform="qoder",
        name="号位A",
        jwt="jwt-value",
        device_map={"uid": "uid-1"},
        enabled=True,
    )
    assert len(rec.calls) == 1, "upsert 型必须且只发一枪"
    body = rec.calls[0]["json"]
    headers = rec.calls[0]["headers"]
    assert BODY_OWNER_KEY not in body, f"body 仍在自报主体: {sorted(body)}"
    # 正向对照:摘掉 body 那一位之后,归属主体依旧签进短期票
    assert headers[USER_ID_HEADER] == OWNER
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    claims = _claims(headers)
    assert claims["sub"] == OWNER, "主体必须住在票里,不住在 body 里"
    assert claims["scope"] == "ai-callback"
    assert changed is True and dm["pool_account_id"] == "pa-1"


async def test_delete_桥发出的载荷_键级不含自报主体_主体在票上(
    real_bridge: Any, with_secrets: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    rec = _Recorder()
    rec.install(monkeypatch)
    await real_bridge.sync_delete(owner_user_id=OWNER, pool_account_id="pa-1")
    assert len(rec.calls) == 1, "delete 型必须且只发一枪"
    body = rec.calls[0]["json"]
    headers = rec.calls[0]["headers"]
    assert BODY_OWNER_KEY not in body, f"body 仍在自报主体: {sorted(body)}"
    assert body == {"poolAccountId": "pa-1"}
    assert headers[USER_ID_HEADER] == OWNER
    assert _claims(headers)["sub"] == OWNER


# ── ③ 缺主体:不发枪 / 对端 401 也不冒 500 ──────────────────────────────────
async def test_缺主体一律不发这一枪(
    real_bridge: Any, with_secrets: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    rec = _Recorder()
    rec.install(monkeypatch)
    for blank in ("", "   "):
        changed, dm = await real_bridge.sync_upsert(
            owner_user_id=blank,
            account_id=7,
            platform="qoder",
            name="号位A",
            jwt="jwt-value",
            device_map={"uid": "uid-1"},
            enabled=True,
        )
        await real_bridge.sync_delete(owner_user_id=blank, pool_account_id="pa-1")
        assert changed is False and "pool_bridge_pending" not in dm
    assert rec.calls == [], "无主体的反向同步结构上不该发出任何请求"
    with pytest.raises(RuntimeError, match="缺少归属主体"):
        await real_bridge._post(ub.UPSERT_PATH, {"platform": "qoder"}, owner_user_id="")


async def test_票缺主体被对端拒_桥只留待重试不冒500(
    real_bridge: Any, with_secrets: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """承载层拿不到主体时对端回 401;桥是旁路,失败摘要落 pending,绝不把 401 变成 500。"""
    rec = _Recorder(status_code=401)
    rec.install(monkeypatch)
    changed, dm = await real_bridge.sync_upsert(
        owner_user_id=OWNER,
        account_id=7,
        platform="qoder",
        name="号位A",
        jwt="jwt-value",
        device_map={"uid": "uid-1"},
        enabled=True,
    )
    assert changed is True
    pending = dm["pool_bridge_pending"]
    assert "HTTP 401" in pending["error"]


# ── ④ 读点锁:引用该端点的源文件再无该键的生产点 ───────────────────────────
def _iter_code_faces() -> list[tuple[Path, str]]:
    """全仓运行代码面(apps + packages,跳过依赖/构建产物),一次读完带文本。"""
    out: list[tuple[Path, str]] = []
    for base in (_REPO_ROOT / "apps", _REPO_ROOT / "packages"):
        for path in base.rglob("*"):
            rel = path.relative_to(_REPO_ROOT).parts
            if not path.is_file() or path.suffix not in _SCAN_SUFFIXES:
                continue
            if _SKIP_DIR_NAMES & {part.lower() for part in rel} or rel[:2] == ("apps", "api"):
                continue  # apps/api = 接收侧,兼容窗核对位住在它的 schema 里,不是生产点
            if _is_test_file(rel, path.name):
                continue  # 用例里的键名是断言对象,不是生产点
            try:
                out.append((path, path.read_text(encoding="utf-8")))
            except (OSError, UnicodeDecodeError):
                continue
    return out


def _is_test_file(rel_parts: tuple[str, ...], name: str) -> bool:
    return bool({"tests", "__tests__"} & set(rel_parts)) or name.startswith("test_") or (
        ".test." in name or name.startswith("conftest.")
    )  # 用例里的键名是断言对象,不是生产点


def test_读点锁_全仓代码面再无向号池端点自报主体() -> None:
    """工作树代码面(唯一能判「现在还在发」的那一面);HEAD 面/索引面同判序由 git grep 核过。

    三面扫过的结果记在状态件:发送侧候选全仓只有本模块一个 —— 故本用例一旦在
    「候选集为空」或「候选集里没有桥」时判死,绝不用 0 冒充绿。
    """
    senders = [
        (path, text)
        for path, text in _iter_code_faces()
        if any(marker in text for marker in _USER_POOL_PATHS)
    ]
    assert senders, "扫描面枚举到 0 个候选 = 判据失效,不算绿"
    assert any(p.name == "checkin_user_pool_bridge.py" for p, _ in senders), (
        f"桥自身不在候选集里,扫描面已漂: {[str(p) for p, _ in senders]}"
    )
    quoted = (f'"{BODY_OWNER_KEY}"', f"'{BODY_OWNER_KEY}'")
    offenders = [str(p.relative_to(_REPO_ROOT)) for p, t in senders if any(k in t for k in quoted)]
    assert offenders == [], f"仍在向 relay user-pool 端点自报主体的文件: {offenders}"


def test_读点锁_票与头侧主体出口仍只有一处() -> None:
    """摘 body 那一位不许把主体顺手摘没:鉴权头仍必须经 internal_service_headers 唯一出口。"""
    src = (_APP_ROOT / "services" / "checkin_user_pool_bridge.py").read_text(encoding="utf-8")
    assert "internal_service_headers(" in src
    assert 'headers["X-User-Id"]' not in src, "手拼主体头 = 绕开短期票唯一出口(门 120)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
