# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""机器判据:内部服务向 apps/api 的请求,绝不出现"只带 x-user-id"的出站形态。

背景(F-03 收尾,2026-11-05):
  默认档 `INTERNAL_SERVICE_AUTH_MODE=ticket` 只认短期票。旧实现里
  `internal_service_headers` 在拿不到票时仍会带一枚裸 `x-user-id`,
  看起来"有身份",实际零凭据,对侧只能 401 —— 配置缺失被伪装成了权限问题。
  现在:
    - `x-user-id` 只与凭据(**票** / 旧密钥)同现;
    - `api_tools_bridge` 等要求显式失败的调用方抛 `InternalServiceCredentialError`;
    - 生产代码(app/)里任何人手拼 `{"x-user-id": ...}` 都会被本测试拦下。

判据分两层:
  1) 运行时矩阵:唯一出口 `internal_service_headers` 在任意凭据组合下都不产出裸身份头;
  2) 静态扫描:遍历 `apps/ai-service/app/**/*.py` 的 AST,凡字典字面量/下标赋值
     写入 `x-user-id` 的,必须同 dict 带凭据头;下标赋值只允许在唯一出口模块
     `core/internal_ticket.py`。

真红验证方式:在 `app/services/` 下临时放一个
``def h(uid): return {"x-user-id": uid}``,本测试必须失败;删掉后恢复绿。

扫描范围说明:只扫生产代码 `app/`(出站面);`tests/` 里的夹具可以合法地构造
"坏形态"用于验证本门,不算生产出站。
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
    InternalServiceCredentialError,
    internal_service_headers,
    require_internal_service_headers,
)

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"

# 允许与 x-user-id 同现的凭据头。旧密钥在显式 dual/legacy 档才有意义,
# 但它仍是"凭据",所以并入允许集;票是默认档的唯一凭据。
CREDENTIAL_HEADERS = {
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    "x-internal-secret",
}


def _clear_all_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    for key in ("JWT_SECRET", "AI_CALLBACK_SECRET", "INTERNAL_SERVICE_TOKEN"):
        monkeypatch.delenv(key, raising=False)


def _assert_no_bare_identity(headers: dict[str, str]) -> None:
    """若带 x-user-id,必须同时至少带一枚凭据头;否则判红。"""
    if USER_ID_HEADER in headers:
        assert set(headers) & CREDENTIAL_HEADERS, (
            "出现了裸 x-user-id 出站头,没有任何凭据伴随: "
            f"{sorted(headers)}"
        )


class TestRuntimeInvariant:
    """唯一出口的运行时矩阵。"""

    def test_no_credential_never_emits_identity_header(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _clear_all_secrets(monkeypatch)
        headers = internal_service_headers(UID, "api-tools")
        assert headers == {}
        _assert_no_bare_identity(headers)

    def test_extra_credential_but_no_internal_credential_never_emits_identity(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """另一套闸(X-Internal-Secret)存在时,也不得顺手带裸 x-user-id。"""
        _clear_all_secrets(monkeypatch)
        headers = internal_service_headers(
            UID, "api-tools", extra={"X-Internal-Secret": "legacy-other-gate"}
        )
        assert headers == {"X-Internal-Secret": "legacy-other-gate"}
        assert USER_ID_HEADER not in headers

    def test_legacy_token_emits_identity_only_with_credential(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _clear_all_secrets(monkeypatch)
        headers = internal_service_headers(UID, "api-tools", legacy_token="old-secret")
        assert headers[INTERNAL_TOKEN_HEADER] == "old-secret"
        assert headers[USER_ID_HEADER] == UID
        _assert_no_bare_identity(headers)

    def test_ticket_emits_identity_only_with_credential(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _clear_all_secrets(monkeypatch)
        monkeypatch.setattr(settings, "jwt_secret", "unit-test-shared-secret-0123456789abcdef")
        headers = internal_service_headers(UID, "api-tools")
        assert INTERNAL_TICKET_HEADER in headers
        assert INTERNAL_TOKEN_HEADER not in headers
        assert headers[USER_ID_HEADER] == UID
        _assert_no_bare_identity(headers)

    def test_require_variant_raises_when_nothing_available(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _clear_all_secrets(monkeypatch)
        with pytest.raises(InternalServiceCredentialError):
            require_internal_service_headers(UID, "api-tools")

    def test_require_variant_passes_with_legacy_credential(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _clear_all_secrets(monkeypatch)
        headers = require_internal_service_headers(
            UID, "api-tools", legacy_token="old-secret"
        )
        assert headers[INTERNAL_TOKEN_HEADER] == "old-secret"
        _assert_no_bare_identity(headers)


def _const_key(node: ast.AST) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value.strip().lower()
    return ""


def _subscript_key(node: ast.AST) -> str:
    slice_node = node.slice if isinstance(node, ast.Subscript) else None
    if isinstance(slice_node, ast.Constant) and isinstance(slice_node.value, str):
        return slice_node.value.strip().lower()
    if isinstance(slice_node, ast.Name) and slice_node.id == "USER_ID_HEADER":
        return USER_ID_HEADER
    return ""


def _scan_bare_identity_headers() -> list[str]:
    offenders: list[str] = []
    for path in sorted(APP_ROOT.rglob("*.py")):
        rel = path.relative_to(APP_ROOT.parent).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError as exc:  # 语法坏文件不静默跳过
            offenders.append(f"{rel}: 无法解析({exc})")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                keys = {_const_key(k) for k in node.keys if k is not None}
                if USER_ID_HEADER in keys and not (keys & CREDENTIAL_HEADERS):
                    offenders.append(f"{rel}:{node.lineno} 字典字面量只有 x-user-id")
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Subscript) and _subscript_key(target) == USER_ID_HEADER:
                        # 唯一允许写身份头的地方是唯一出口构造器本身
                        if path.name != "internal_ticket.py":
                            offenders.append(
                                f"{rel}:{node.lineno} 绕过 internal_ticket 手写 x-user-id"
                            )
    return offenders


def test_static_scan_no_bare_identity_headers() -> None:
    """生产代码里不允许任何"只带 x-user-id"的出站头构造。"""
    offenders = _scan_bare_identity_headers()
    assert offenders == [], (
        "发现裸 x-user-id 出站形态(必须改为带票/旧密钥,或直接失败):\n"
        + "\n".join(offenders)
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
