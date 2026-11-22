# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""号池模型代次判定内部端点测试(2026-11-20 立)。

覆盖:鉴权三态(未配置 503 / 错密钥 401 / 对放行)、选择器口径(2026-11-20 机主取消
「历史模型」折叠区:命中过时清单、版本比较判 legacy 一律 hidden;同日追加要求
图像/视频/语音等分类模型可见,只有嵌入/重排/审核中间件 hidden;白名单新代次与 standard
不隐藏)、MODEL_CATALOG_HIDE_LEGACY=0 时整体恢复(开关语义与 /llm/models 出口共用)、
单批上限 413、以及响应里每条都带 provider(api 侧按 provider+id 成对回填,不猜归属)。
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
    # 检索类中间件(嵌入)不进聊天选择器,即使 tier 不是 legacy
    assert by_id["vendor/bge-m3"]["category"] == "embedding"
    assert by_id["vendor/bge-m3"]["hidden"] is True


async def test_模态模型可见_旧代模态仍按代次隐藏(client):
    """2026-11-20 机主追加:图像/视频/语音等分类模型要能选;

    同时"不要历史模型"的口径对模态同样成立 —— 同系列旧代次(seedream-4 对 seedream-5)
    仍由版本比较压 legacy 并隐藏,不是整类放行。
    """
    resp = await _post(
        client,
        [
            {"id": "vendor/flux-1-schnell", "provider": "vendor"},
            {"id": "vendor/step-tts-mini", "provider": "vendor"},
            {"id": "vendor/whisper-large-v3", "provider": "vendor"},
            {"id": "vendor/seedream-5", "provider": "vendor"},
            {"id": "vendor/seedream-4", "provider": "vendor"},
            {"id": "vendor/bge-reranker-v2", "provider": "vendor"},
        ],
    )
    assert resp.status_code == 200, resp.text
    by_id = {item["id"]: item for item in resp.json()["items"]}
    # 模态模型:分类正确且不被隐藏
    assert by_id["vendor/flux-1-schnell"]["category"] == "image"
    assert by_id["vendor/flux-1-schnell"]["hidden"] is False
    assert by_id["vendor/step-tts-mini"]["category"] == "tts"
    assert by_id["vendor/step-tts-mini"]["hidden"] is False
    assert by_id["vendor/whisper-large-v3"]["category"] == "asr"
    assert by_id["vendor/whisper-large-v3"]["hidden"] is False
    # 同系列模态模型:新一代显示,旧一代按代次压掉(不要历史模型)
    assert by_id["vendor/seedream-5"]["hidden"] is False
    assert by_id["vendor/seedream-4"]["model_tier"] == "legacy"
    assert by_id["vendor/seedream-4"]["hidden"] is True
    # 重排类中间件仍挡在选择器外
    assert by_id["vendor/bge-reranker-v2"]["category"] == "rerank"
    assert by_id["vendor/bge-reranker-v2"]["hidden"] is True


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


# ---------------------------------------------------------------------------
# auto-complexity(2026-11-22 立):聊天 auto 号池决策腿的复杂度评估端点。
# 判据单源 model_router.assess_complexity —— 这里只钉「端点把入参正确交给同一把尺子」,
# 不复制关键词表;关键断言与网关 _resolve_auto_model 的升级档位同源(§0.6)。
# ---------------------------------------------------------------------------

COMPLEXITY_ENDPOINT = "/internal/model-catalog/auto-complexity"


def _post_complexity(
    client,
    body: dict[str, object],
    secret: str | None = INTERNAL_SECRET,
):
    headers = {"X-Internal-Secret": secret} if secret is not None else {}
    return client.post(COMPLEXITY_ENDPOINT, json=body, headers=headers)


async def test_auto_complexity_未配置密钥时不裸奔(client, monkeypatch):
    monkeypatch.setattr(settings, "ai_callback_secret", "")
    resp = await _post_complexity(client, {"prompt_tail": "你好"}, None)
    assert resp.status_code == 503


async def test_auto_complexity_错密钥被拒(client):
    resp = await _post_complexity(client, {"prompt_tail": "你好"}, "wrong")
    assert resp.status_code == 401


async def test_auto_complexity_重构关键词判expert(client):
    """判据单源:与网关复杂度升级同一把尺子 —— 命中重构关键词必须判 expert。"""
    resp = await _post_complexity(
        client,
        {"prompt_tail": "请帮我重构这个模块的架构", "prompt_chars": 20, "has_tools": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"complexity": "expert"}


async def test_auto_complexity_长文按token折算判expert(client):
    """prompt_chars 是全文字符数(尾部截断防丢长文信号):超过 50000 token ⇒ expert。"""
    resp = await _post_complexity(
        client,
        {"prompt_tail": "随便说点", "prompt_chars": 300_000, "has_tools": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"complexity": "expert"}


async def test_auto_complexity_调试关键词判complex(client):
    """命中 complex 关键词(调试)⇒ complex(与 assess_complexity 判定规则逐字同源)。

    注意 has_code 是显式参数:网关主链 _resolve_auto_model 的调用形态(prompt/
    token_count/has_tools)不传 has_code,本端点与其对齐,代码围栏不参与判定。
    """
    resp = await _post_complexity(
        client,
        {"prompt_tail": "帮我调试这个报错", "prompt_chars": 20, "has_tools": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"complexity": "complex"}


async def test_auto_complexity_短句判trivial_空入参默认(client):
    resp = await _post_complexity(client, {"prompt_tail": "你好", "prompt_chars": 2})
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"complexity": "trivial"}

    # 全默认(空体)也必须可用:决策腿的超轻调用形态
    resp2 = await _post_complexity(client, {})
    assert resp2.status_code == 200, resp2.text
    assert resp2.json() == {"complexity": "trivial"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
