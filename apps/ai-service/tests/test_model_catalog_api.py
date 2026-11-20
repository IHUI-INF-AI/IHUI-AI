# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""号池模型代次判定内部端点测试(2026-11-20 立)。

覆盖:鉴权三态(未配置 503 / 错密钥 401 / 对放行)、选择器口径(2026-11-20 机主取消
「历史模型」折叠区:命中过时清单、版本比较判 legacy、非对话专用用途三条并集一律
hidden;白名单新代次与 standard 不隐藏)、MODEL_CATALOG_HIDE_LEGACY=0 时整体恢复
(开关语义与 /llm/models 出口共用)、单批上限 413、以及响应里每条都带 provider
(api 侧按 provider+id 成对回填,不猜归属)。
"""

from __future__ import annotations

import pytest

from app.core.config import settings

INTERNAL_SECRET = "test-internal-secret"
ENDPOINT = "/internal/model-catalog/classify"


@pytest.fixture(autouse=True)
def _internal_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "ai_callback_secret", INTERNAL_SECRET)


def _post(client, models: list[dict[str, str]], secret: str | None = INTERNAL_SECRET):
    headers = {"X-Internal-Secret": secret} if secret is not None else {}
    return client.post(ENDPOINT, json={"models": models}, headers=headers)


async def test_未配置密钥时不裸奔(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", "")
    resp = await _post(client, [{"id": "workbuddy/kimi-k2.5", "provider": "workbuddy"}], None)
    assert resp.status_code == 503


async def test_错密钥被拒(client):
    resp = await _post(client, [{"id": "workbuddy/kimi-k2.5", "provider": "workbuddy"}], "wrong")
    assert resp.status_code == 401


async def test_过时清单命中即隐藏_白名单新代次不隐藏_未知原样放行(client):
    resp = await _post(
        client,
        [
            {"id": "workbuddy/kimi-k2.5", "provider": "workbuddy"},
            {"id": "workbuddy/glm-4.7", "provider": "workbuddy"},
            {"id": "workbuddy/kimi-k3", "provider": "workbuddy"},
            {"id": "mystery/vendor-model-x", "provider": "mystery"},
        ],
    )
    assert resp.status_code == 200, resp.text
    by_id = {item["id"]: item for item in resp.json()["items"]}

    # 两个都在 LEGACY_MODEL_IDS 里 ⇒ 与 /llm/models 出口一样被摘掉
    assert by_id["workbuddy/kimi-k2.5"]["hidden"] is True
    assert by_id["workbuddy/glm-4.7"]["hidden"] is True
    # 白名单新代次:不隐藏,且 tier=latest(前端默认区)
    assert by_id["workbuddy/kimi-k3"]["hidden"] is False
    assert by_id["workbuddy/kimi-k3"]["model_tier"] == "latest"
    # 清单外的新模型默认显示(policy 的设计哲学:未知不误伤)
    assert by_id["mystery/vendor-model-x"]["hidden"] is False
    # provider 原样回传,api 侧按 provider+id 成对回填
    assert by_id["mystery/vendor-model-x"]["provider"] == "mystery"
    # 用途分类同源下发(chat 兜底路径也必须是合法枚举值)
    assert by_id["workbuddy/kimi-k3"]["category"] == "chat"


async def test_同系列旧代号按代次比较判legacy并隐藏(client):
    """清单没收录的同族旧代,也应由版本比较判 legacy 并直接隐藏(2026-11-20 取消折叠区)。"""
    resp = await _post(
        client,
        [
            {"id": "vendor/gpt-4o", "provider": "vendor"},
            {"id": "vendor/gpt-5.1", "provider": "vendor"},
            {"id": "vendor/gpt-5.6", "provider": "vendor"},
            {"id": "vendor/bge-m3", "provider": "vendor"},
        ],
    )
    assert resp.status_code == 200, resp.text
    by_id = {item["id"]: item for item in resp.json()["items"]}
    # 主版本落后一整代 → legacy 且选择器不展示
    assert by_id["vendor/gpt-4o"]["model_tier"] == "legacy"
    assert by_id["vendor/gpt-4o"]["hidden"] is True
    # 同主版本、次版本偏低 → standard,仍展示(能调通的不能藏)
    assert by_id["vendor/gpt-5.1"]["model_tier"] == "standard"
    assert by_id["vendor/gpt-5.1"]["hidden"] is False
    assert by_id["vendor/gpt-5.6"]["model_tier"] == "latest"
    # 非对话专用用途(嵌入)不进聊天选择器,即使 tier 不是 legacy
    assert by_id["vendor/bge-m3"]["category"] == "embedding"
    assert by_id["vendor/bge-m3"]["hidden"] is True


async def test_隐藏开关关闭时清单不生效(client, monkeypatch):
    """MODEL_CATALOG_HIDE_LEGACY=0 是排障档:隐藏必须同步关闭,不能只关目录那一侧。"""
    monkeypatch.setenv("MODEL_CATALOG_HIDE_LEGACY", "0")
    resp = await _post(client, [{"id": "workbuddy/kimi-k2.5", "provider": "workbuddy"}])
    assert resp.status_code == 200, resp.text
    item = resp.json()["items"][0]
    assert item["hidden"] is False


async def test_单批上限(client):
    models = [{"id": f"vendor/model-{i}", "provider": "vendor"} for i in range(501)]
    resp = await _post(client, models)
    assert resp.status_code == 413


async def test_空批次返回空items(client):
    resp = await _post(client, [])
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
