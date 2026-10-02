# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D208 默认模型链回归:默认链解析出健康模型 + 退役档不再出现在新账号可见目录。

背景(docs/benchmark-evidence/2026-10/d150-runtime-reconciliation.md §六①②):
- 原默认链 litellm_model=stepfun/step-router-v1 经 auto-route 落到 llm7/gpt-oss:20b
  → 上游 InternalServerError,新注册用户首条消息直接报错;
- 目录 gemini/gemini-2.5-flash 对新账号 Google 404(no longer available to new users)。
"""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import Settings
from app.core.llm_gateway import _AUTO_ROUTE_EXCLUDED, _default_model_chain

# 新账号可见目录数据源(routers/llm.py _load_default_models 读的就是这份文件)
_CATALOG = (
    Path(__file__).resolve().parents[1] / "app" / "data" / "default_models.json"
)


def test_default_chain_primary_and_fallback(monkeypatch):
    """默认链 = 首选 gemini-3.8-flash + 同族兜底 @cf/glm-4.7-flash(均为 D150 实测健康档)。"""
    monkeypatch.delenv("LITELLM_MODEL", raising=False)
    monkeypatch.delenv("LITELLM_FALLBACK_MODEL", raising=False)
    assert Settings(_env_file=None).litellm_model == "gemini/gemini-3.8-flash"
    assert _default_model_chain() == [
        "gemini/gemini-3.8-flash",
        "@cf/zai-org/glm-4.7-flash",
    ]


def test_default_chain_dedup_and_degenerate(monkeypatch):
    """链去重保序;两键均空时回退历史硬编码档,不做单点空串。"""
    monkeypatch.setattr("app.core.config.settings.litellm_model", "@cf/x")
    monkeypatch.setattr("app.core.config.settings.litellm_fallback_model", "@cf/x")
    assert _default_model_chain() == ["@cf/x"]
    monkeypatch.setattr("app.core.config.settings.litellm_model", "")
    monkeypatch.setattr("app.core.config.settings.litellm_fallback_model", "")
    assert _default_model_chain() == ["stepfun/step-3.7-flash"]


def test_llm7_excluded_from_auto_route():
    """D150 实证 llm7/gpt-oss:20b 上游 InternalServerError,必须被 auto 候选集排除。"""
    assert "llm7/gpt-oss:20b" in _AUTO_ROUTE_EXCLUDED


def test_retired_models_absent_or_marked_in_catalog():
    """退役档处理:gemini-2.5-flash 不再出现在新账号可见目录;健康替代档在位。"""
    data = json.loads(_CATALOG.read_text(encoding="utf-8"))
    ids = [m.get("id") for m in data.get("models", [])]
    # D150 实证 Google 404(no longer available to new users)→ 已替换,不得回流
    assert "gemini/gemini-2.5-flash" not in ids
    assert "gemini/gemini-3.8-flash" in ids
    # llm7 上游 500(D150 实证):默认链不可用,条目须带 ⚠️ 标记且被 auto 排除
    llm7 = next(m for m in data["models"] if m.get("id") == "llm7/gpt-oss:20b")
    assert "⚠️" in llm7["name"]
    assert "llm7/gpt-oss:20b" in _AUTO_ROUTE_EXCLUDED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
