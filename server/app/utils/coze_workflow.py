"""
Coze model-search workflow utility.

Ported from historical project:
  - H:/历史项目存档/ljd-交接文件/coze_zhs_py/api/coze_workflow.py (run_workflow)

Historical run_workflow queried zhs_ai_model_info, built a model list, and
called the Coze workflow API. Here we expose the same logic as a reusable
async utility function run_model_search_workflow(keyword).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx
from sqlalchemy import text

from app.config import settings
from app.database import get_session
from app.utils.coze_auth_utils import get_access_token

logger = logging.getLogger("coze_workflow")

_WORKFLOW_RUN_URL = "https://api.coze.cn/v1/workflow/run"


def _load_model_list() -> list[dict[str, Any]]:
    """Query zhs_ai_model_info for active models (sync DB call).

    Returns:
        list of {"id", "model_name", "type"} dicts; empty list on failure.
    """
    try:
        with get_session() as db:
            result = db.execute(
                text("SELECT id, source, type FROM zhs_ai_model_info WHERE is_del = 0")
            )
            rows = result.fetchall()
            return [
                {"id": row[0], "model_name": row[1], "type": row[2]}
                for row in rows
            ]
    except Exception as e:
        logger.error("[CozeWorkflow] _load_model_list error: %s", e)
        return []


def _extract_output(response_data: dict[str, Any]) -> Any | None:
    """Unwrap nested data.data.output (ported from historical coze_workflow.py).

    The Coze workflow response nests the real payload as a JSON string inside
    data.data.output. This helper unwraps it defensively.
    """
    try:
        if not response_data:
            return None
        data_field = response_data.get("data")

        if isinstance(data_field, str):
            try:
                data_obj = json.loads(data_field)
            except json.JSONDecodeError:
                return data_field
            if isinstance(data_obj, dict):
                return data_obj.get("output")
            return data_obj

        if isinstance(data_field, dict):
            inner = data_field.get("data")
            if isinstance(inner, str):
                try:
                    inner_obj = json.loads(inner)
                except json.JSONDecodeError:
                    return inner
                if isinstance(inner_obj, dict):
                    return inner_obj.get("output")
                return inner_obj
            if isinstance(inner, dict):
                return inner.get("output")
            return inner

        return data_field
    except Exception as e:
        logger.error("[CozeWorkflow] _extract_output error: %s", e)
        return None


async def run_model_search_workflow(keyword: str) -> dict[str, Any]:
    """运行 Coze 模型搜索工作流.

    1. Query zhs_ai_model_info for the active model list (run in a worker
       thread to avoid blocking the event loop).
    2. Acquire a Coze access token via coze_auth_utils.get_access_token.
    3. POST to the Coze workflow run endpoint with the model list + keyword.
    4. Unwrap the nested data.data.output string and return it.

    Args:
        keyword: user search keyword / prompt content.

    Returns:
        dict with keys: success (bool), data (Any), error (Optional[str]).
    """
    try:
        # 1. Load model list from DB (offload sync I/O to a thread).
        loop = asyncio.get_event_loop()
        model_list = await loop.run_in_executor(None, _load_model_list)

        # 2. Acquire access token.
        access_token = await get_access_token()
        if not access_token:
            logger.error("[CozeWorkflow] failed to acquire access token")
            return {
                "success": False,
                "data": None,
                "error": "认证失败：无法获取访问令牌",
            }

        # 3. Build and send workflow request.
        workflow_id = settings.COZE_MODEL_SEARCH_WORKFLOW_ID
        payload = {
            "workflow_id": workflow_id,
            "parameters": {
                "input": model_list,
                "content": keyword,
            },
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        logger.info(
            "[CozeWorkflow] run workflow_id=%s models=%d keyword_len=%d",
            workflow_id,
            len(model_list),
            len(keyword or ""),
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(_WORKFLOW_RUN_URL, headers=headers, json=payload)

        if resp.status_code != 200:
            logger.error(
                "[CozeWorkflow] HTTP %s: %s", resp.status_code, resp.text[:200]
            )
            return {
                "success": False,
                "data": None,
                "error": f"请求失败，状态码: {resp.status_code}",
            }

        response_data = resp.json()
        output_data = _extract_output(response_data)
        if isinstance(output_data, str):
            output_data = output_data.replace('"', "")
        return {"success": True, "data": output_data, "error": None}
    except Exception as e:
        logger.error("[CozeWorkflow] run_model_search_workflow error: %s", e)
        return {
            "success": False,
            "data": None,
            "error": f"处理请求时发生异常: {e}",
        }
