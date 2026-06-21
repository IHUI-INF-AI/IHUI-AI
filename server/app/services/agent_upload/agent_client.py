"""Agent 客户端(HTTP 调用 + 任务轮询).

迁移自 ZHS_Server_java/small/service/agent/AgentClient.java.
"""

import asyncio
from typing import Any

import httpx
from loguru import logger


class AgentClient:
    """封装与外部 agent 端点的 HTTP 通信."""

    DEFAULT_TIMEOUT = 60.0
    POLL_INTERVAL = 10
    MAX_ATTEMPTS = 30

    async def invoke_agent(self, agent: Any, input_payload: dict[str, Any]) -> dict[str, Any]:
        """调用 agent 接口并处理任务轮询."""
        if agent is None:
            raise ValueError("Agent must not be null")
        agent_url = (getattr(agent, "agent_url", None) or "").strip()
        if not agent_url:
            raise ValueError("Agent URL cannot be null or empty")

        async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
            resp = await client.post(agent_url, json=input_payload)
            resp.raise_for_status()
            answer_array = resp.json()
            if not isinstance(answer_array, list) or not answer_array:
                raise ValueError("Agent 返回数据格式错误")
            return await self._wait_for_task_if_needed(answer_array[0], agent_url)

    async def _wait_for_task_if_needed(self, answer_object: dict[str, Any], agent_url: str) -> dict[str, Any]:
        if not answer_object or "task_status" not in answer_object:
            return answer_object
        status = (answer_object.get("task_status") or "").lower()
        if status in ("succeeded", "success") or "task_id" not in answer_object:
            return answer_object
        task_id = answer_object["task_id"]
        token_from_response = int(answer_object.get("token", 0) or 0)
        ratio_from_response = answer_object.get("ratio")
        attempts = 0
        while status not in ("succeeded", "success"):
            if attempts > self.MAX_ATTEMPTS:
                logger.warning(f"任务查询超过最大重试次数, 结束轮询 taskId={task_id}")
                break
            attempts += 1
            await asyncio.sleep(self.POLL_INTERVAL)
            try:
                async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                    r = await client.post(agent_url, json={"task_id": task_id})
            except Exception as e:
                logger.warning(f"任务查询请求异常, 继续重试: {e}")
                continue
            if r.status_code >= 500:
                logger.warning(f"任务查询返回状态码 {r.status_code}, 继续重试")
                continue
            try:
                body = r.json()
            except Exception as e:
                logger.warning(f"任务查询结果解析失败, 继续重试: {e}")
                continue
            if not isinstance(body, list) or not body:
                continue
            latest = body[0] or {}
            if "url" in latest:
                answer_object["url"] = latest["url"]
            if latest.get("token") is not None:
                token_from_response = int(latest.get("token") or 0)
                answer_object["token"] = token_from_response
            if latest.get("ratio") is not None:
                ratio_from_response = latest["ratio"]
                answer_object["ratio"] = ratio_from_response
            status = (latest.get("task_status") or "").lower()
        answer_object["token"] = token_from_response
        if ratio_from_response is not None:
            answer_object["ratio"] = ratio_from_response
        return answer_object


_client: AgentClient | None = None


def get_agent_client() -> AgentClient:
    global _client
    if _client is None:
        _client = AgentClient()
    return _client
