# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""档位判据必须 fail-closed(2026-11-01 安全强化)。

原判据是 ``if settings.node_env == "production": 拒`` —— 它把"精确字符串相等"
当成了"这是生产"的**充分条件**。于是每一种"没写对"的形态都不等于 ``production``:

    NODE_ENV 漏配 / 写成 prod / 写成 Production / 带尾空格 / 全大写

这些统统掉进 ``_dev_fallback_principal()``,拿到 ``scopes={ALL_SCOPES}`` 的匿名主体,
而 ALL_SCOPES 是通配全权 —— 也就是说,**配置越是不完整,权限反而越大**。

本文件每条用例对应一个写错的形态,断言必须是 401。反向牙口在最后一组:把判据改回
``== "production"``,前面几条必须红 —— 少了这个牙口,"闸其实装错了方向"这件事
会静默变成假绿,而那正是本枚要根治的失效型。
"""

from __future__ import annotations

import time

import pytest

from app.core.config import settings
from app.services import capability_gate as cg


def _headers(**extra: str) -> dict[str, str]:
    base: dict[str, str] = {"content-type": "application/json"}
    base.update(extra)
    return base


@pytest.mark.parametrize(
    "node_env",
    [
        "production",
        "",  # 漏配:最常见的一种,原来会放行
        "prod",  # 简写
        "Production",  # 首字母大写
        "PRODUCTION",  # 全大写
        "production ",  # 尾空格
        " staging",  # 没见过的档位:不猜,按生产处理
        None,  # 显式空值
    ],
)
def test_unrecognized_env_never_falls_back(
    monkeypatch: pytest.MonkeyPatch, node_env: str | None
) -> None:
    monkeypatch.setattr(settings, "node_env", node_env)
    with pytest.raises(cg.PrincipalAuthError) as exc:
        cg.resolve_principal_from_headers(_headers())
    assert exc.value.http_status == 401


@pytest.mark.parametrize(
    "node_env",
    ["development", "Development", "dev", "test", "local", " DEVELOPMENT "],
)
def test_declared_dev_env_still_falls_back(
    monkeypatch: pytest.MonkeyPatch, node_env: str
) -> None:
    """白名单内的开发档位照旧可用 —— 收权不得把本地开发一起收掉。"""
    monkeypatch.setattr(settings, "node_env", node_env)
    principal = cg.resolve_principal_from_headers(_headers())
    assert principal.kind == "dev-anonymous"
    assert cg.ALL_SCOPES in principal.scopes


def test_fallback_whitelist_contains_no_production_spelling() -> None:
    """结构锁:白名单里不许出现任何"生产"写法,否则等于把闸又拆了。"""
    lowered = {v.strip().lower() for v in cg._DEV_FALLBACK_ENVS}
    assert "production" not in lowered
    assert "prod" not in lowered
    assert "" not in lowered


def test_principal_header_bypasses_fallback_regardless_of_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """有可信凭据时走凭据通道,档位判据只在"无凭据"这条路上生效。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setattr(settings, "ihui_principal_secret", "test-principal-secret")
    header = cg.build_principal_header(
        sub="user-1", role=0, scopes=["chat:write"], exp=time.time() + 60
    )
    principal = cg.resolve_principal_from_headers(_headers(**{"x-ihui-principal": header}))
    assert principal.kind == "internal"
    assert principal.sub == "user-1"
