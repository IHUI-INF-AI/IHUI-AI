# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-3 安全三件套:security_config + /agent/security-config 端点测试。

覆盖:
- 默认配置(全部开启 + enforce + sanitize)
- set_security_config 合法/非法更新(未知字段、非法枚举 → ValueError)
- reset_security_config 回 env 默认
- 端点 GET / PUT(合法部分更新、非法枚举 400、空更新 400)
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers.agents import (
    SecurityConfigUpdateRequest,
    get_agent_security_config,
    update_agent_security_config,
)
from app.routers.agents import (
    router as agents_router,
)
from app.services.security_config import (
    GUARD_POLICIES,
    POLICY_MODES,
    get_security_config,
    reset_security_config,
    set_security_config,
)


@pytest.fixture(autouse=True)
def _restore_config():
    """每条用例后重置为 env 默认,防进程内配置串扰。"""
    yield
    reset_security_config()


# =============================================================================
# security_config 模块
# =============================================================================


def test_default_config_all_on() -> None:
    cfg = get_security_config()
    assert cfg.prompt_guard_enabled is True
    assert cfg.prompt_guard_policy == "sanitize"
    assert cfg.exec_policy_mode == "enforce"
    assert cfg.input_scan_enabled is True
    assert cfg.pipeline_record_enabled is True
    assert cfg.to_dict() == {
        "prompt_guard_enabled": True,
        "prompt_guard_policy": "sanitize",
        "exec_policy_mode": "enforce",
        "input_scan_enabled": True,
        "pipeline_record_enabled": True,
    }


def test_set_and_get_partial_update() -> None:
    cfg = set_security_config(exec_policy_mode="audit", prompt_guard_enabled=False)
    assert cfg.exec_policy_mode == "audit"
    assert cfg.prompt_guard_enabled is False
    # 未传字段保持不变
    assert cfg.input_scan_enabled is True
    assert cfg.prompt_guard_policy == "sanitize"
    assert get_security_config() is cfg


def test_set_rejects_unknown_field() -> None:
    with pytest.raises(ValueError, match="未知安全配置字段"):
        set_security_config(nonexistent_field=True)  # type: ignore[call-arg]


def test_set_rejects_invalid_enum() -> None:
    with pytest.raises(ValueError, match="exec_policy_mode"):
        set_security_config(exec_policy_mode="yolo")
    with pytest.raises(ValueError, match="prompt_guard_policy"):
        set_security_config(prompt_guard_policy="nuke")
    # 失败后配置不变
    assert get_security_config().exec_policy_mode == "enforce"


def test_policy_constants() -> None:
    assert frozenset({"enforce", "audit", "off"}) == POLICY_MODES
    assert frozenset({"flag", "sanitize", "refuse"}) == GUARD_POLICIES


def test_reset_restores_env_default() -> None:
    set_security_config(exec_policy_mode="off", input_scan_enabled=False)
    reset_security_config()
    cfg = get_security_config()
    assert cfg.exec_policy_mode == "enforce"
    assert cfg.input_scan_enabled is True


# =============================================================================
# /agent/security-config 端点(直调 + ASGI 两种通路)
# =============================================================================


async def test_endpoint_functions_direct() -> None:
    data = (await get_agent_security_config())["data"]
    assert data["exec_policy_mode"] == "enforce"

    req = SecurityConfigUpdateRequest(exec_policy_mode="audit")
    resp = await update_agent_security_config(req)
    assert resp["code"] == 0
    assert resp["data"]["exec_policy_mode"] == "audit"
    assert get_security_config().exec_policy_mode == "audit"


def test_endpoint_partial_update_request_model() -> None:
    req = SecurityConfigUpdateRequest(prompt_guard_enabled=False)
    dumped = req.model_dump()
    assert dumped["prompt_guard_enabled"] is False
    assert dumped["exec_policy_mode"] is None  # 未传字段为 None(端点侧过滤)


@pytest.fixture
async def ac() -> AsyncClient:
    app = FastAPI()
    app.include_router(agents_router)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


async def test_endpoint_get(ac: AsyncClient) -> None:
    res = await ac.get("/agent/security-config")
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["prompt_guard_enabled"] is True


async def test_endpoint_put_valid(ac: AsyncClient) -> None:
    res = await ac.put(
        "/agent/security-config",
        json={"exec_policy_mode": "off", "input_scan_enabled": False},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["exec_policy_mode"] == "off"
    assert body["data"]["input_scan_enabled"] is False
    assert get_security_config().exec_policy_mode == "off"


async def test_endpoint_put_invalid_enum_400(ac: AsyncClient) -> None:
    res = await ac.put("/agent/security-config", json={"exec_policy_mode": "yolo"})
    assert res.status_code == 400
    assert "exec_policy_mode" in res.json()["detail"]


async def test_endpoint_put_empty_400(ac: AsyncClient) -> None:
    res = await ac.put("/agent/security-config", json={})
    assert res.status_code == 400
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
