"""
N8N Workflow API proxy route.

Proxies workflow execution requests to an N8N instance.
Supports: listing workflows, adding agents via N8N, and running workflows.

Ported from coze_zhs_py/api/n8n_proxy.py
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class N8NWorkflowsRequest(BaseModel):
    n8n_domain: str = Field(..., description="N8N实例域名, e.g. 'zhangsan12.app.n8n.cloud'")
    api_key: str = Field(..., description="N8N API Key (X-N8N-API-KEY)")


class AddAgentRequest(BaseModel):
    agent_name: str = Field(..., description="智能体名称")
    agent_description: str = Field(..., description="智能体功能描述")
    connector_user_id: str = Field(..., description="Coze连接器用户ID")
    agent_variables: dict[str, Any] = Field(..., description="智能体变量配置JSON")
    agent_model: str = Field(..., description="使用的AI模型名称")
    agent_avatar: str | None = Field(None, description="智能体头像图片URL地址")


class WorkflowRunRequest(BaseModel):
    workflow_id: str | None = Field(None, description="工作流ID")
    webhook_path: str | None = Field(None, description="Webhook路径, 默认使用配置中的路径")
    input_data: dict[str, Any] | None = Field(None, description="工作流输入数据")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _format_timestamp(ts: str | None) -> str | None:
    """Converts ISO 8601 timestamp string to 'YYYY-MM-DD HH:mm:ss' format."""
    if not ts or not isinstance(ts, str):
        return None
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        dt_obj = datetime.fromisoformat(ts)
        if dt_obj.tzinfo:
            dt_obj = dt_obj.astimezone(tz=None)
        return dt_obj.strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return ts


# ---------------------------------------------------------------------------
# Routes -- List N8N Workflows
# ---------------------------------------------------------------------------


@router.post("/workflows", summary="查询N8N工作流列表")
async def get_n8n_workflows(request_body: N8NWorkflowsRequest):
    """
    Queries n8n workflows and returns a formatted list.
    Matches the original n8n_proxy.py /workflows endpoint.

    /cozeZhsApi/n8n/workflows -> POST here
    """
    api_url = f"https://{request_body.n8n_domain}/api/v1/workflows"
    headers = {
        "X-N8N-API-KEY": request_body.api_key,
    }

    query_params = {"active": "true"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(api_url, headers=headers, params=query_params)
            resp.raise_for_status()
            n8n_data = resp.json()
    except httpx.RequestError as e:
        return error(f"Upstream request error: {e}")
    except Exception as e:
        return error(f"An unexpected error occurred: {e}")

    if "data" not in n8n_data or not isinstance(n8n_data["data"], list):
        return success([])

    formatted_data = []
    for item in n8n_data["data"]:
        formatted_data.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "createdAt": _format_timestamp(item.get("createdAt")),
                "updatedAt": _format_timestamp(item.get("updatedAt")),
            }
        )

    return success(formatted_data)


# ---------------------------------------------------------------------------
# Routes -- Add Agent via N8N
# ---------------------------------------------------------------------------


@router.post("/addAgent", summary="通过N8N接口新增智能体")
def add_agent(agent_data: AddAgentRequest, user_uuid: str = Depends(require_login)):
    """
    Add a new agent to the agents table and create an examination record.
    Matches the original n8n_proxy.py /addAgent endpoint.
    """
    from app.database import SessionFactory1, SessionFactory2, get_session

    agent_id = f"n8n_{uuid.uuid4().hex}"
    avatar = agent_data.agent_avatar or "https://file.aizhs.top/sys-backs/2025/09/24/391_42_20250924094836A218.png"

    try:
        agent_variables_json = json.dumps(agent_data.agent_variables)
    except TypeError as e:
        return error(f"Invalid agent_variables format: {e}", code="400")

    now = datetime.now()

    try:
        with get_session(factory=SessionFactory1) as db1, get_session(factory=SessionFactory2) as db2:
            # 1. Insert into agents table (data source 1)
            insert_query = text(
                """
                INSERT INTO agents (
                    agent_id, agent_name, agent_description, connector_user_id, bot_id,
                    agent_variables, agent_avatar, publish_status, source,
                    publish_time, created_at, updated_at, prologue, agent_model
                )
                VALUES (
                    :agent_id, :agent_name, :agent_description, :connector_user_id, :bot_id,
                    :agent_variables, :agent_avatar, :publish_status, :source,
                    :publish_time, :created_at, :updated_at, :prologue, :agent_model
                )
            """
            )
            db1.execute(
                insert_query,
                {
                    "agent_id": agent_id,
                    "bot_id": agent_id,
                    "agent_name": agent_data.agent_name,
                    "agent_description": agent_data.agent_description,
                    "connector_user_id": agent_data.connector_user_id,
                    "agent_variables": agent_variables_json,
                    "agent_avatar": avatar,
                    "publish_status": "pending",
                    "source": "n8n",
                    "publish_time": now,
                    "created_at": now,
                    "updated_at": now,
                    "prologue": agent_data.agent_description,
                    "agent_model": agent_data.agent_model,
                },
            )

            # 2. Query username from User model (data source 2)
            start_user_name = None
            from app.models.user_models import User

            user_record = db2.query(User).filter(User.uuid == agent_data.connector_user_id).first()
            if user_record and user_record.nickname:
                start_user_name = user_record.nickname
            else:
                return error(f"用户ID不存在: {agent_data.connector_user_id}", code="400")

            # 3. Insert into zhs_agent_examine table
            examine_query = text(
                """
                INSERT INTO zhs_agent_examine (
                    id, agent_id, agent_name, agent_avatar, prologue, status,
                    start_time, start_user, start_name, `desc`, follow
                )
                VALUES (
                    :id, :agent_id, :agent_name, :agent_avatar, :prologue, :status,
                    :start_time, :start_user, :start_name, :desc, :follow
                )
            """
            )
            db1.execute(
                examine_query,
                {
                    "id": str(uuid.uuid4()),
                    "agent_id": agent_id,
                    "agent_name": agent_data.agent_name,
                    "agent_avatar": avatar,
                    "prologue": agent_data.agent_description,
                    "status": 0,
                    "start_time": now,
                    "start_user": agent_data.connector_user_id,
                    "start_name": start_user_name,
                    "desc": "智能体新增,等待审核",
                    "follow": f"[{now}] 智能体通过n8n接口创建,等待审核",
                },
            )

            return success({"agent_id": agent_id}, msg="Agent added successfully")

    except Exception as e:
        logger.error("Failed to add agent to database: %s", e)
        return error(f"Failed to add agent to the database: {e}")


# ---------------------------------------------------------------------------
# Routes -- Run N8N Workflow
# ---------------------------------------------------------------------------


@router.post("/workflow/run", summary="运行N8N工作流")
async def run_workflow(request: WorkflowRunRequest, user_uuid: str = Depends(require_login)):
    """
    Trigger an N8N workflow execution via webhook or API.
    """
    if not settings.N8N_BASE_URL:
        return error("N8N Base URL 未配置", code="500")

    base_url = settings.N8N_BASE_URL.rstrip("/")
    webhook_path = request.webhook_path or settings.N8N_WEBHOOK_PATH

    # Build the target URL
    if request.workflow_id:
        url = f"{base_url}/api/v1/workflows/{request.workflow_id}/activate"
    else:
        url = f"{base_url}{webhook_path}"

    headers: dict[str, str] = {
        "Content-Type": "application/json",
    }
    if settings.N8N_API_KEY:
        headers["X-N8N-API-KEY"] = settings.N8N_API_KEY

    body = request.input_data or {}

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()

            try:
                data = resp.json()
            except Exception:
                data = {"raw_response": resp.text}

        return success(data, msg="工作流已执行")

    except httpx.HTTPStatusError as e:
        logger.error("N8N API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"N8N API 调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("N8N API error: %s", e)
        return error(f"N8N 工作流执行失败: {e}")
