"""CrewAI 工具集.

将项目已有的能力封装为 CrewAI Tool:
  - rag_search      知识库检索
  - coze_workflow   Coze 工作流执行
  - llm_generate    LLM 直接生成
"""

import asyncio
import json
import threading
from typing import Any

from loguru import logger


def _run_async_safely(coro):
    """在新线程的事件循环中运行协程.

    CrewAI @tool 装饰的函数是同步的, 但内部需要调用 async 协程 (如 CozeClient).
    直接 asyncio.run() 在 FastAPI 请求中会抛
    'cannot be called from a running event loop'.
    新建线程运行避免事件循环冲突.
    """
    result: list[Any] = [None]
    exc: list[BaseException | None] = [None]

    def _runner() -> None:
        try:
            result[0] = asyncio.run(coro)
        except BaseException as e:  # noqa: BLE001
            exc[0] = e

    t = threading.Thread(target=_runner, daemon=True)
    t.start()
    t.join()
    if exc[0] is not None:
        raise exc[0]
    return result[0]


def create_rag_search_tool(collection_name: str = "", owner_uuid: str = ""):
    """创建知识库检索工具.

    Args:
        collection_name: 知识库集合名
        owner_uuid: 所有者 UUID

    Returns:
        CrewAI Tool 对象或普通函数
    """
    try:
        from crewai.tools import tool

        @tool("RAG知识库检索")
        def rag_search(query: str) -> str:
            """在知识库中搜索相关信息. 输入搜索查询语句, 返回匹配的知识片段."""
            try:
                from app.services.knowledge_service import knowledge_service

                context = knowledge_service.get_rag_context(
                    query=query,
                    collection_name=collection_name or "default",
                    top_k=5,
                    owner_uuid=owner_uuid,
                )
                return context or "[未检索到相关知识]"
            except ImportError:
                return "[知识库服务未安装, 跳过 RAG 检索]"
            except Exception as e:
                logger.error(f"RAG 检索失败: {e}")
                return f"[RAG 检索出错: {e}]"

        return rag_search
    except ImportError:
        def rag_search(query: str) -> str:
            """在知识库中搜索相关信息."""
            try:
                from app.services.knowledge_service import knowledge_service

                return knowledge_service.get_rag_context(
                    query=query,
                    collection_name=collection_name or "default",
                    top_k=5,
                    owner_uuid=owner_uuid,
                ) or "[未检索到相关知识]"
            except ImportError:
                return "[知识库服务未安装, 跳过 RAG 检索]"
            except Exception as e:
                return f"[RAG 检索出错: {e}]"

        return rag_search


def create_coze_workflow_tool():
    """创建 Coze 工作流执行工具."""

    async def _run_workflow(workflow_id: str, parameters: dict) -> dict:
        from app.utils.coze_compat import CozeClient

        async with CozeClient() as coze:
            body = {"workflow_id": workflow_id, "parameters": parameters or {}}
            return await coze._request("POST", "/v1/workflow/run", json=body)

    try:
        from crewai.tools import tool

        @tool("Coze工作流执行")
        def coze_workflow(workflow_id: str, parameters_json: str = "{}") -> str:
            """执行 Coze 工作流. 输入工作流ID和参数JSON, 返回执行结果."""
            try:
                params = json.loads(parameters_json) if isinstance(parameters_json, str) else parameters_json
                result = _run_async_safely(_run_workflow(workflow_id, params))
                return json.dumps(result, ensure_ascii=False, default=str)
            except Exception as e:
                logger.error(f"Coze 工作流执行失败: {e}")
                return f"[工作流执行失败: {e}]"

        return coze_workflow
    except ImportError:
        def coze_workflow(workflow_id: str, parameters_json: str = "{}") -> str:
            """执行 Coze 工作流."""
            try:
                params = json.loads(parameters_json) if isinstance(parameters_json, str) else parameters_json
                result = _run_async_safely(_run_workflow(workflow_id, params))
                return json.dumps(result, ensure_ascii=False, default=str)
            except Exception as e:
                return f"[工作流执行失败: {e}]"

        return coze_workflow


def create_llm_generate_tool(model_id: str = ""):
    """创建 LLM 直接生成工具."""

    try:
        from crewai.tools import tool

        @tool("LLM文本生成")
        def llm_generate(prompt: str) -> str:
            """使用 LLM 生成文本. 输入提示词, 返回生成结果."""
            try:
                from app.services.crew_llm_adapter import create_crew_llm

                llm = create_crew_llm(model_id)
                messages = [{"role": "user", "content": prompt}]
                if hasattr(llm, "call"):
                    return llm.call(messages)
                return str(llm)
            except Exception as e:
                logger.error(f"LLM 生成失败: {e}")
                return f"[LLM 生成失败: {e}]"

        return llm_generate
    except ImportError:
        def llm_generate(prompt: str) -> str:
            """使用 LLM 生成文本."""
            try:
                from app.services.crew_llm_adapter import create_crew_llm

                llm = create_crew_llm(model_id)
                messages = [{"role": "user", "content": prompt}]
                if hasattr(llm, "call"):
                    return llm.call(messages)
                return str(llm)
            except Exception as e:
                return f"[LLM 生成失败: {e}]"

        return llm_generate


def get_default_tools(collection_name: str = "", owner_uuid: str = "") -> list:
    """获取默认工具列表."""
    return [
        create_rag_search_tool(collection_name, owner_uuid),
        create_coze_workflow_tool(),
    ]
