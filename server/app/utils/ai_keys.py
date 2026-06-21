"""统一外部 AI 提供方 API Key 解析.

优先级:
  1. 调用方显式传入的 api_key (请求参数)
  2. 平台统一配置 (app.config.settings 中的 DASHSCOPE_API_KEY / DOUBAO_API_KEY / OPENROUTER_API_KEY / LUYALA_API_KEY 等)
  3. 都没有则返回空字符串 (业务侧负责处理 401 / 提示)
"""

from app.config import settings


def resolve_key(explicit: str | None, *candidates: str) -> str:
    """解析 API key.

    Args:
        explicit: 调用方传入的 key (最高优先)
        candidates: 配置项名列表 (依次回退)

    Returns:
        第一个非空 key, 都没有则返回空字符串.
    """
    if explicit:
        return explicit
    for name in candidates:
        val = getattr(settings, name, "")
        if val:
            return val
    return ""


def luyala_key(explicit: str | None = None) -> str:
    return resolve_key(explicit, "LUYALA_API_KEY")


def openrouter_key(explicit: str | None = None) -> str:
    return resolve_key(explicit, "OPENROUTER_API_KEY")


def doubao_key(explicit: str | None = None) -> str:
    return resolve_key(explicit, "DOUBAO_API_KEY", "DOUBAO_JM_API_KEY")


def dashscope_key(explicit: str | None = None) -> str:
    return resolve_key(explicit, "DASHSCOPE_API_KEY")


def zhipu_key(explicit: str | None = None) -> str:
    return resolve_key(explicit, "ZHIPU_API_KEY")


def openai_key(explicit: str | None = None) -> str:
    """OpenAI 通用 key: 用 OPENROUTER_API_KEY 兜底 (兼容内部代理)."""
    return resolve_key(explicit, "OPENAI_API_KEY", "OPENROUTER_API_KEY")
