"""LLM provider 强类型配置(2026-07-26 阶段 2 改造).

设计参考 docs/llm-provider-dict-design.md §2 目标架构 + §3 向后兼容策略.

阶段 2 关键改造:把 apps/ai-service 当前的 24 个 *_api_key + 7 个 *_api_base
扁平字段(在 Settings 中)升级为强类型 Pydantic ProviderConfig.
Settings.get_provider_config() 返回类型从 dict → ProviderConfig(强类型),
行为 100% 向后兼容(优先读 llm_providers JSON,缺省回退扁平字段).

阶段 3 计划:删除 24+7 扁平字段,LLM 调用层(apps/ai-service/app/llm/*.py)
直接消费 ProviderConfig 实例。
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ProviderConfig(BaseModel):
    """单个 LLM provider 的强类型配置.

    字段说明:
    - api_key: API 凭证(provider-specific,如 OpenAI sk-xxx / Anthropic sk-ant-xxx).
      默认空字符串(同旧扁平字段语义)。
    - api_base: API endpoint URL(OpenAI 兼容端点)。None 表示使用 provider 默认 endpoint。
    - enabled: 是否启用该 provider(未来扩展,允许在 .env 关闭特定 provider)。
    - models: 该 provider 支持的 model 列表(未来扩展,LLM 路由层用来过滤)。
    - default_model: provider 默认 model(未来扩展,无显式指定 model 时用此值)。
    """

    api_key: str = ""
    api_base: Optional[str] = None
    enabled: bool = True
    models: list[str] = Field(default_factory=list)
    default_model: Optional[str] = None

    @field_validator("api_base")
    @classmethod
    def _strip_trailing_slash(cls, v: Optional[str]) -> Optional[str]:
        """统一去掉 api_base 末尾的 /,避免拼接路径时出现 //v1 双斜杠。"""
        return v.rstrip("/") if v else v
