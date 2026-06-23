"""CrewAI LLM 适配器.

将项目已有的 LLM 配置 (zhs_ai_model_info_unify 表) 适配为 CrewAI 可用的 LLM 对象.
当 CrewAI 未安装时, 回退为 OpenAI 客户端封装.
"""

import json
from typing import Any

from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.api.v1.llm.ws import get_effective_config


def create_crew_llm(model_id: str, temperature: float = 0.7, max_tokens: int = 2000) -> Any:
    """创建 CrewAI LLM 对象.

    Args:
        model_id: 模型 code (zhs_ai_model_info_unify.code)
        temperature: 温度参数
        max_tokens: 最大 token 数

    Returns:
        CrewAI LLM 对象, 或 OpenAI 回退对象
    """
    cfg = get_effective_config(model_id)
    if not cfg:
        logger.warning(f"LLM 配置未找到: {model_id}, 尝试回退")
        return _create_openai_fallback(model_id, temperature, max_tokens)

    api_base = cfg.get("api_base", "")
    api_key = cfg.get("api_key", "")
    model_name = cfg.get("model_name", model_id)

    try:
        from crewai import LLM

        llm = LLM(
            model=f"openai/{model_name}",
            base_url=api_base,
            api_key=api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        logger.info(f"CrewAI LLM 创建成功: {model_name}")
        return llm
    except ImportError:
        logger.info("CrewAI 未安装, 使用 OpenAI 回退")
        return _create_openai_fallback(model_id, temperature, max_tokens, cfg)


def _create_openai_fallback(
    model_id: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    cfg: dict[str, Any] | None = None,
) -> Any:
    """创建 OpenAI 回退 LLM (当 CrewAI 不可用时)."""

    class OpenAIFallback:
        """简化 LLM 接口, 兼容 CrewAI 调用模式."""

        def __init__(self, model_name: str, base_url: str, api_key: str, temp: float, max_tok: int):
            self.model_name = model_name
            self.base_url = base_url
            self.api_key = api_key
            self.temperature = temp
            self.max_tokens = max_tok

        def call(self, messages: list[dict], **kwargs) -> str:
            """同步调用 (简化版)."""
            import httpx

            url = self.base_url.rstrip("/")
            if "/chat/completions" not in url:
                url = f"{url}/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            }
            body = {
                "model": self.model_name,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            try:
                with httpx.Client(timeout=60) as client:
                    resp = client.post(url, headers=headers, json=body)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"OpenAI 回退调用失败: {e}")
                return f"[LLM 调用失败: {e}]"

    if cfg is None:
        cfg = get_effective_config(model_id) or {}

    return OpenAIFallback(
        model_name=cfg.get("model_name", model_id),
        base_url=cfg.get("api_base", ""),
        api_key=cfg.get("api_key", ""),
        temp=temperature,
        max_tok=max_tokens,
    )


def get_available_models() -> list[dict[str, Any]]:
    """查询可用的 LLM 模型列表."""
    sql = text("""
        SELECT code, name, model_code, manufacturer, type
        FROM zhs_ai_model_info_unify
        WHERE (is_del = 0 OR is_del IS NULL)
          AND url IS NOT NULL AND url != ''
        ORDER BY sort ASC
    """)
    with get_session() as db:
        try:
            rows = db.execute(sql).fetchall()
            return [
                {
                    "model_id": r[0],
                    "name": r[1],
                    "model_code": r[2],
                    "manufacturer": r[3],
                    "type": r[4],
                }
                for r in rows
            ]
        except Exception as e:
            logger.error(f"查询可用模型失败: {e}")
            return []
