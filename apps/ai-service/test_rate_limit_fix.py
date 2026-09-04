#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""验证 is_model_available 对 DEGRADED + RATE_LIMITED 且已配置 key 的 provider 返回 True。"""

import sys
import os

# 设置 Python 路径
sys.path.insert(0, r"G:\IHUI-AI\apps\ai-service")

# 先加载环境变量
from dotenv import load_dotenv
load_dotenv(r"G:\IHUI-AI\apps\ai-service\.env")

from app.services.model_availability import (
    ModelAvailabilityService,
    ProviderHealthStatus,
    ProviderErrorType,
    ProviderHealth,
    _to_llm_providers_name,
)
from app.core.config import settings
from app.services.free_provider_registry import free_provider_registry, ProviderStatus

def check_has_key(code: str) -> bool:
    cfg_name = _to_llm_providers_name(code)
    cfg = settings.get_provider_config(cfg_name)
    has_key = bool(cfg.api_key) or free_provider_registry.is_key_configured(code) == ProviderStatus.CONFIGURED
    return has_key

# 创建 service 实例
svc = ModelAvailabilityService()

# 检查各 provider 的 has_key 状态
providers_to_test = ["ihui_relay", "openrouter", "stepfun", "pollinations"]
print("Provider key 配置状态:")
for code in providers_to_test:
    has_key = check_has_key(code)
    print(f"  {code}: has_key={has_key}")

# 模拟 ihui_relay 的健康状态: DEGRADED + RATE_LIMITED
svc._health["ihui_relay"] = ProviderHealth(
    status=ProviderHealthStatus.DEGRADED,
    error_type=ProviderErrorType.RATE_LIMITED,
    error="HTTP 429: rate limited",
    latency_ms=1500,
    last_check=1700000000.0,
)

# 测试 is_model_available
test_models = [
    "ihui/Auto-Model",
    "ihui/glm-5.3",
    "ihui/deepseek-v4-flash-0731",
    "ihui/gpt-5.6",
]

print("\n测试 is_model_available (ihui_relay DEGRADED + RATE_LIMITED):")
for model_id in test_models:
    result = svc.is_model_available(model_id)
    status = "✓ 显示" if result else "✗ 隐藏"
    print(f"  {model_id}: {status}")

# 测试 openrouter (如果有 key,也应该显示;如果没有 key,应该隐藏)
svc._health["openrouter"] = ProviderHealth(
    status=ProviderHealthStatus.DEGRADED,
    error_type=ProviderErrorType.RATE_LIMITED,
    error="HTTP 429: rate limited",
    latency_ms=1500,
    last_check=1700000000.0,
)

print("\n测试 is_model_available (openrouter DEGRADED + RATE_LIMITED):")
for model_id in ["openrouter/auto", "openrouter/gpt-4o"]:
    result = svc.is_model_available(model_id)
    status = "✓ 显示" if result else "✗ 隐藏"
    print(f"  {model_id}: {status}")

# 测试 pollinations (zero_cost, 应该被 RATE_LIMITED 隐藏)
svc._health["pollinations"] = ProviderHealth(
    status=ProviderHealthStatus.DEGRADED,
    error_type=ProviderErrorType.RATE_LIMITED,
    error="HTTP 429: rate limited",
    latency_ms=1500,
    last_check=1700000000.0,
)

print("\n测试 is_model_available (pollinations DEGRADED + RATE_LIMITED, zero_cost):")
for model_id in ["@cf/meta/llama-3.1", "pollinations/gpt-4o"]:
    result = svc.is_model_available(model_id)
    status = "✓ 显示" if result else "✗ 隐藏"
    print(f"  {model_id}: {status}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
