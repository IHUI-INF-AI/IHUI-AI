# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""产物访问 token 的签名密钥必须 fail-closed(2026-11-01 安全强化)。

修前的形态(现读原文,已在本票删除):

    _DEV_SIGNING_KEY = "ihui-artifacts-dev-key"
    def _signing_key() -> str:
        return settings.jwt_secret or _DEV_SIGNING_KEY

同一文件第 54 行的注释写着"生产环境 jwt_secret 必填(fail-closed)",而**没有任何启动校验
支撑这句话** —— `core/config.py` 里只有 `validate_cors_origin` 与 `validate_mtls_config`,
两者都不看 `jwt_secret`(实测:`jwt_secret referenced in any validator body: False`)。
于是"漏配 JWT_SECRET 的部署"静默落回一个躺在**公开仓**里的 22 字节常量。
而 `/api/artifacts/f/` 就在 `JWT_PUBLIC_PATHS` 名单内(`config.py` 的默认档),匿名可达,
唯一门槛正是这枚签名 token ⇒ 后果是"知道常量的人可伪造任意 `file` 路径,读白名单目录内文件"。
附带:22 字节还触发 pyjwt 的 `InsecureKeyLengthWarning`。

本文件钉四件事,每件都有成对反证(§"修复要带变异自证"):
① 空密钥 ⇒ `_signing_key()` 抛、签发被拒、校验一律拒绝(不返回路径);
② 强密钥 ⇒ 签/验往返正常(证明①不是"什么都拒绝"的假绿);
③ `validate_secrets()` 在生产档把空 JWT_SECRET 判成起不来,非生产档不拦;
④ 接线锁:`create_app` 里真的调了这条校验,且那个公开常量不再出现在源码里。

测试隔离(AGENTS §5):不建连接、不起服务、不读 .env —— 全部用内存里 monkeypatch 的 settings。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core import config as config_mod
from app.routers import artifacts

STRONG = "f3f439a939fbf16d5bee36fbec536aba0f3502fd16203e61715e480915ce6f05"  # 64hex,形态与真值同


class TestSigningKeyFailClosed:
    def test_empty_secret_raises_instead_of_falling_back(self, monkeypatch) -> None:
        monkeypatch.setattr(artifacts.settings, "jwt_secret", "")
        with pytest.raises(RuntimeError) as ei:
            artifacts._signing_key()
        assert "JWT_SECRET" in str(ei.value)

    def test_none_like_secret_also_rejected(self, monkeypatch) -> None:
        # 只有空白也视为未配置(strip 判据),否则 "   " 会签出一个几乎必然可猜的 token
        monkeypatch.setattr(artifacts.settings, "jwt_secret", "   ")
        with pytest.raises(RuntimeError):
            artifacts._signing_key()

    def test_sign_is_refused_without_key(self, monkeypatch) -> None:
        monkeypatch.setattr(artifacts.settings, "jwt_secret", "")
        with pytest.raises(RuntimeError):
            artifacts.sign_artifact_token("tmp/charts/payload.png")

    def test_verify_rejects_forgery_with_public_literal(self, monkeypatch) -> None:
        """本票的核心反例:拿公开常量当密钥伪造 ⇒ 必须验不过,而不是返回文件路径。"""
        import jwt as pyjwt

        forged = pyjwt.encode(
            {
                "file": "tmp/charts/payload.png",
                "iat": 1_700_000_000,
                "exp": 4_000_000_000,
                "iss": artifacts.TOKEN_ISSUER,
                "aud": artifacts.TOKEN_AUDIENCE,
            },
            "ihui-artifacts-dev-key",
            algorithm="HS256",
        )
        # 配了真密钥时:公开常量伪造不出来
        monkeypatch.setattr(artifacts.settings, "jwt_secret", STRONG)
        assert artifacts.verify_artifact_token(forged) is None
        # 漏配时:同样拒绝(而不是"恰好能用常量验通"),并且不抛成 500
        monkeypatch.setattr(artifacts.settings, "jwt_secret", "")
        assert artifacts.verify_artifact_token(forged) is None

    def test_positive_control_roundtrip(self, monkeypatch) -> None:
        monkeypatch.setattr(artifacts.settings, "jwt_secret", STRONG)
        token = artifacts.sign_artifact_token("tmp/charts/payload.png")
        assert artifacts.verify_artifact_token(token) == "tmp/charts/payload.png"


class TestBootValidator:
    def _s(self, node_env: str, jwt_secret: str) -> config_mod.Settings:
        return config_mod.Settings(  # type: ignore[call-arg]
            node_env=node_env, jwt_secret=jwt_secret, cors_origin="https://aizhs.top"
        )

    def test_production_with_empty_secret_refuses_to_boot(self) -> None:
        with pytest.raises(ValueError):
            self._s("production", "").validate_secrets()

    def test_production_with_secret_passes(self) -> None:
        self._s("production", STRONG).validate_secrets()

    def test_non_production_not_blocked_at_validator(self) -> None:
        # 非生产档由"取值侧"拒绝(上面四例),"启动拦不拦"与"能不能签"是两格,不混判
        self._s("development", "").validate_secrets()


class TestWiring:
    def test_validator_is_called_at_app_construction(self) -> None:
        src = (
            Path(__file__).resolve().parents[1] / "app" / "main.py"
        ).read_text(encoding="utf-8")
        assert "settings.validate_secrets()" in src, (
            "校验器写了但没在 create_app 里调用 ⇒ 这一档是装饰,不是闸"
        )

    def test_public_literal_is_gone_from_the_resolver(self) -> None:
        src = (
            Path(__file__).resolve().parents[1] / "app" / "routers" / "artifacts.py"
        ).read_text(encoding="utf-8")
        # 允许出现在注释里(历史说明),但不得再作为可执行字面量存在
        code = "\n".join(
            ln for ln in src.splitlines() if not ln.lstrip().startswith("#")
        )
        assert '"ihui-artifacts-dev-key"' not in code
        assert "or _DEV_SIGNING_KEY" not in code

    def test_mutation_proof_the_old_fallback_would_have_passed(self) -> None:
        """反向自证:把旧回落式复刻出来,伪造 token 必须验得过 —— 证明①②真的在拦这件事。"""
        import jwt as pyjwt

        old_style_key = "ihui-artifacts-dev-key"
        forged = pyjwt.encode(
            {
                "file": "tmp/charts/payload.png",
                "iat": 1_700_000_000,
                "exp": 4_000_000_000,
                "iss": artifacts.TOKEN_ISSUER,
                "aud": artifacts.TOKEN_AUDIENCE,
            },
            old_style_key,
            algorithm="HS256",
        )
        decoded = pyjwt.decode(
            forged,
            old_style_key,
            algorithms=["HS256"],
            issuer=artifacts.TOKEN_ISSUER,
            audience=artifacts.TOKEN_AUDIENCE,
        )
        assert decoded["file"] == "tmp/charts/payload.png"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
