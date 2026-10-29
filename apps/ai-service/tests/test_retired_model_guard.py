# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""入站显式档退役守卫单测(2026-10-26 立)。

背景(生产实测,不是推演):
    退役除名原本只在「默认模型解析」层(app/core/default_model.py 的
    default_chat_model)设了守卫 —— 而**入站请求显式指定 model=stepfun/xxx**
    这条路径完全绕过它:llm_gateway.complete() 的 `used_model = model` 分支
    照旧把退役档发往上游。
    线上表现(2026-10-26 现读):ai-service 日志持续出现
    `LLM 链路失败(provider=stepfun, status=5xx, model=stepfun/step-3.7-flash)`,
    Prometheus `ihui_llm_provider_errors_total{provider="stepfun",status="5xx"}`
    持续增长(30 分钟 +18.5)⇒ 退役厂商仍在消耗真实调用额度并污染告警面。

本测保证:
1. 入站守卫对退役档返回 410(MODEL_RETIRED),**不**把它当 key 缺失/充值类问题;
2. 非退役档与空值一律放行(不得误伤正常调用);
3. 错误文案不含「充值/补 key」类出路措辞(机主令:厂商账户状态不进人通道)。
"""

from __future__ import annotations

import json

import pytest

from app.routers.llm import _retired_model_error


@pytest.mark.parametrize(
    "model",
    [
        "stepfun/step-3.7-flash",
        "stepfun/step-3.5-flash",
        "stepfun/step-router-v1",
        "STEPFUN/Step-3.7-Flash",
        "  stepfun/step-3.7-flash  ",
    ],
)
def test_retired_model_is_rejected_with_410(model: str) -> None:
    resp = _retired_model_error(model)
    assert resp is not None, f"退役档未被拒绝:{model}"
    assert resp.status_code == 410, f"退役档应返回 410,实得 {resp.status_code}"


@pytest.mark.parametrize(
    "model",
    ["agnes/agnes-2.5-flash", "pollinations/openai-fast", "gpt-4o", "", None],
)
def test_non_retired_model_passes(model: str | None) -> None:
    assert _retired_model_error(model) is None


def test_error_body_shape_and_no_recharge_wording() -> None:
    """错误体必须带 message 与 errorCode,且不得出现充值/补 key 类出路措辞。"""
    resp = _retired_model_error("stepfun/step-3.7-flash")
    assert resp is not None
    body = json.loads(bytes(resp.body).decode("utf-8"))
    assert body["errorCode"] == "MODEL_RETIRED"
    assert "stepfun/step-3.7-flash" in body["message"]
    assert body["code"] == 1
    # 机主令:厂商账户状态不作为"待补 key/充值"出路出现。
    for forbidden in ("充值", "补 key", "补充 key", "余额不足", "续费"):
        assert forbidden not in body["message"], f"错误文案含出路措辞:{forbidden}"


def test_free_provider_dashboard_excludes_retired_providers() -> None:
    """用户可见面板(GET /llm/free-providers)不得再列已退役厂商。

    实测依据(2026-10-26):该端点无鉴权且 web 端有转发 ⇒ 是用户可见的
    「免费 provider 矩阵」;留着已退役厂商 = 用户仍看得到它的申请入口与默认模型档。
    """
    from app.services.free_provider_registry import free_provider_registry

    rows = free_provider_registry.to_dashboard_dict()
    codes = [str(r.get("provider_code") or "") for r in rows]
    assert "stepfun" not in codes, "用户可见面板仍在列已退役厂商 stepfun"
    assert len(rows) > 0, "面板被过滤空了(取不到输入 ≠ 判绿)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
