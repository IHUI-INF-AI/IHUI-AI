"""LLM 路由(2 端点)。

提供 LLM 直接调用接口,以及 SSE 流式调用接口(原生 token 级流式)。

集成设计(2026-07-09 Phase 3):
- 请求可选携带 metadata(dict)和 callback_url(str)
- metadata 透传到 done 事件,用于调用方关联会话/消息
- 若提供 callback_url,推理完成后异步 POST 完整结果到该 URL
- callback_url 默认值由 config.api_service_url 构造(如 http://api:8802/api/ai/callback)
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.llm_gateway import llm_gateway, moa_router
from ..core.context_compaction import compress_messages_if_needed
from ..core.provider_caps import (
    cap_to_dict,
    cap_with_max_context,
    get_provider_cap,
)
from ..core.question_parser import QuestionStreamParser
from ..services.mcp_server import _tool_dispatch_subagent, _tool_vision_analyze
from ..services.project_memory import build_system_prompt

router = APIRouter()
logger = logging.getLogger(__name__)

# 持有待完成的回调 task 引用,防止 CPython GC 回收未持有的 task
_pending_callbacks: set[asyncio.Task[None]] = set()


def _wrap_ok(data: Any, message: str = "ok") -> dict[str, Any]:
    """统一 {code, message, data} 响应信封(AGENTS.md §5 项目约定)。

    ai-service Dashboard 端点(GET /llm/providers/health、GET/POST/DELETE /llm/combos、
    POST /llm/compaction/demo、GET /llm/free-providers)使用此 helper 包装成功响应,
    以兼容前端 packages/api-client 的 fetchApi(其 fetchOnce 强制检查 json.code === 0)。

    注:/llm/complete 与 /llm/complete/stream 不使用此信封,因为它们的响应结构是
    LLM 结果对象(含 content/model/usage/tool_calls 等),已被多个内部服务(api 代理、
    crew-llm-adapter、ai-feed-service 等)依赖为契约,改信封会破坏兼容。
    """
    return {"code": 0, "message": message, "data": data}


def _error_json(message: str, status_code: int, **extra: Any) -> JSONResponse:
    """统一错误响应(带 message 字段供 fetchApi 的 fetchOnce 提取)。

    fetchApi 在 !response.ok 时会尝试 JSON.parse 并提取 parsed.message 作为错误信息,
    所以错误响应必须含 message 字段(而非 error 字段),否则前端只能拿到"请求失败(400)"。
    """
    payload: dict[str, Any] = {"code": 1, "message": message}
    payload.update(extra)
    return JSONResponse(status_code=status_code, content=payload)

# 默认模型清单 JSON 文件路径(运行时按需加载,修改无需重启)
_DEFAULT_MODELS_FILE = Path(__file__).resolve().parent.parent / "data" / "default_models.json"


def _inject_workspace_memory(
    messages: list[dict[str, Any]], workspace_path: str | None
) -> list[dict[str, Any]]:
    """将工作区项目记忆(CLAUDE.md/AGENTS.md/.ihui/memory.md)注入为 system message。

    行为(参考 Claude Code CLAUDE.md 机制):
    - workspace_path 为 None 或路径无项目记忆文件 → 原样返回 messages
    - messages[0].role == 'system' → 把项目记忆追加到现有 system content 后面
    - messages 无 system → 在开头插入新 system message

    Args:
        messages: 原始消息列表
        workspace_path: 工作区路径(None 时跳过注入)

    Returns:
        注入项目记忆后的新消息列表(不修改原列表)
    """
    if not workspace_path:
        return messages
    memory_content = build_system_prompt(workspace_path=workspace_path)
    # 项目记忆服务返回的内容已包含默认 system prompt 前缀,直接拼接即可
    if not memory_content:
        return messages
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        # 避免重复注入(同一 workspace_path 已注入过则跳过)
        marker = f"<!-- workspace:{workspace_path} -->"
        if marker in str(existing):
            return messages
        # 用 XML 隔离标签包裹工作区记忆,防 prompt injection:
        # 明确告知 LLM 这部分是"项目上下文"而非用户指令,降低被注入指令劫持的风险
        isolated_memory = (
            f"<workspace_memory path=\"{workspace_path}\">\n"
            f"{memory_content}\n"
            f"</workspace_memory>"
        )
        merged = f"{existing}\n\n{marker}\n{isolated_memory}" if existing else isolated_memory
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        isolated_memory = (
            f"<workspace_memory path=\"{workspace_path}\">\n"
            f"{memory_content}\n"
            f"</workspace_memory>"
        )
        new_messages.insert(0, {"role": "system", "content": isolated_memory})
    return new_messages


# Plan/Act 模式引导 prompt(2026-07-24 立,对标 Trae Work plan/act toggle + Codex)
# plan 模式:LLM 只制定计划不调用工具;act 模式:正常 tool loop 执行
_PLAN_MODE_PROMPT = (
    "## Plan Mode Active\n"
    "You are in PLAN mode. DO NOT call any tools. Only output a detailed plan with steps.\n"
    "The user will review and switch to ACT mode to execute."
)


def _inject_plan_mode_prompt(
    messages: list[dict[str, Any]], plan_mode: str | None
) -> list[dict[str, Any]]:
    """plan_mode='plan' 时在 system prompt 前置注入 Plan Mode 引导。

    - plan_mode 为 None 或非 'plan' → 原样返回(act 模式正常 tool loop)
    - plan_mode='plan' → 在 system message 内容前前置注入 _PLAN_MODE_PROMPT;
      无 system message 时在开头插入新 system message
    注入在 _inject_workspace_memory 之前调用,确保 Plan Mode 引导位于 system prompt 最顶部。
    """
    if not plan_mode or str(plan_mode).lower() != "plan":
        return messages
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        merged = f"{_PLAN_MODE_PROMPT}\n\n{existing}" if existing else _PLAN_MODE_PROMPT
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": _PLAN_MODE_PROMPT})
    return new_messages


# ===== 多 agent 编排引导 prompt(2026-07-24 立,2026-07-24 升级 5→10 agent + invoke_parallel)=====
# 仅当请求 agent_tools 含 dispatch_subagent 时,在 tool loop 入口注入此 system message,
# 引导 LLM 在复杂任务时主动派发子智能体而非单打独斗。
# agent 清单对齐 AgentOrchestrator._register_defaults 的 10 个默认 agent(5 通用 + 5 专业,2026-07-24 新增)
_SUBAGENT_ORCHESTRATION_PROMPT = (
    "你当前可以使用 dispatch_subagent 工具派发子智能体执行独立子任务,"
    "子智能体独立执行后返回结果,不污染主对话上下文。\n\n"
    "通用 agent(5 个):\n"
    "- researcher:研究助手,调研任务、收集信息、生成摘要\n"
    "- coder:代码助手,实现功能、修复 bug、写代码\n"
    "- reviewer:代码审查助手,审查 diff、给出修改建议\n"
    "- architect:架构师,设计方案、规划模块、API 契约\n"
    "- debugger:调试助手,定位 bug、给出修复方案\n\n"
    "专业 agent(5 个,2026-07-24 新增,对标 Trae 自定义智能体):\n"
    "- frontend-dev:前端开发专家,React 19/Next.js 15/Tailwind 4/shadcn/ui,遵循项目 UI 约束\n"
    "- backend-dev:后端开发专家,Fastify 5/Drizzle ORM/PostgreSQL/Redis,遵循项目 API 约束\n"
    "- devops:DevOps 工程师,Docker/Turborepo/pnpm workspace/CI/CD,monorepo 构建\n"
    "- security-auditor:安全审计专家,OWASP Top 10/CWE 检测,RCE/SSRF/SQL注入/XSS 漏洞模式\n"
    "- test-engineer:测试工程师,Vitest/pytest/Playwright,单元/集成/E2E 测试设计\n\n"
    "并行派发(2026-07-24 新增,对标 Codex 并行 Agent):\n"
    "- 当任务涉及多个独立子任务时,可在单次 dispatch_subagent 调用中传入 tasks 数组批量派发\n"
    "- invoke_parallel 自动用 asyncio.Semaphore 限流(默认并发 5),单个失败不影响其他\n"
    "- 返回结构化聚合结果:total/succeeded/failed/results[]\n\n"
    "使用时机:\n"
    "- 任务涉及多个独立子步骤(如\"审查代码 + 写测试\")→ 拆分为多个 dispatch_subagent 调用,每个子任务一个 agent\n"
    "- 任务需要多视角审查(如\"评估方案是否合理\")→ 用 reviewer\n"
    "- 任务需要专业能力而你自身不擅长(如\"调研某新技术进展\")→ 用 researcher\n"
    "- 前端 UI 改动 → 用 frontend-dev(熟悉项目 UI 约束,产出更合规)\n"
    "- 后端 API 改动 → 用 backend-dev(熟悉项目 API 约束,产出更规范)\n"
    "- 安全审查 → 用 security-auditor(产出按 severity 分级 + 修复建议)\n"
    "- 测试设计 → 用 test-engineer(覆盖 4 状态:默认/hover/active/dark mode)\n"
    "- 简单任务(单一问题、直接回答)→ 不需要 dispatch_subagent,自己回答即可\n\n"
    "禁止滥用:\n"
    "- 不要为单一简单问题派发多个 subagent(浪费 token)\n"
    "- 不要重复派发相同任务(去重机制会跳过)"
)


def _build_subagent_orchestration_prompt() -> str:
    """构造多 agent 编排引导 system prompt。

    仅当 agent_tools 含 dispatch_subagent 时由主流程注入一次(tool loop 入口),
    不在每轮 iteration 重复注入。返回模块级常量,避免每次请求重新构造。
    """
    return _SUBAGENT_ORCHESTRATION_PROMPT


def _load_default_models() -> list[dict[str, Any]]:
    """从 data/default_models.json 加载默认模型清单,按 id 去重。

    文件不存在或解析失败时返回内置最小兜底列表(避免启动失败)。
    """
    fallback_minimal = [
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "context_length": 128000, "input_price": 2.5},
        {"id": "gpt-4o-mini", "name": "GPT-4o mini", "provider": "openai", "context_length": 128000, "input_price": 0.15},
    ]
    try:
        if not _DEFAULT_MODELS_FILE.exists():
            logger.warning("Default models file not found: %s, using minimal fallback", _DEFAULT_MODELS_FILE)
            return fallback_minimal
        raw = _DEFAULT_MODELS_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        models = data.get("models", [])
        if not isinstance(models, list) or not models:
            return fallback_minimal
        # 按 id 去重(保留首次出现)
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for m in models:
            if not isinstance(m, dict):
                continue
            mid = m.get("id")
            if not mid or mid in seen:
                continue
            seen.add(mid)
            unique.append(m)
        return unique
    except Exception as e:
        logger.exception("Failed to load default models from %s: %s", _DEFAULT_MODELS_FILE, e)
        return fallback_minimal


class LLMCompleteRequest(BaseModel):
    """LLM 调用请求。"""

    messages: list[dict[str, Any]] = Field(..., description="OpenAI 格式消息列表")
    model: str | None = Field(None, description="模型名称,为空使用默认")
    # function calling(OpenAI tools 格式,透传给 LiteLLM 或厂商原生 API)
    tools: list[dict[str, Any]] | None = Field(None, description="OpenAI 格式 tools 定义")
    tool_choice: str | dict[str, Any] | None = Field(
        None, description="工具选择策略: auto/none/required 或 {type:'function',function:{name:'xxx'}}"
    )
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    # Phase 3 集成字段(可选)
    metadata: dict[str, Any] | None = Field(
        None, description="调用方元数据(conversation_id/message_id/user_id 等),原样透传到 done 事件"
    )
    callback_url: str | None = Field(
        None, description="推理完成后回调该 URL(POST 完整结果),默认由 api_service_url 构造"
    )
    # 当前绑定的本地工作区路径,用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt
    workspace_path: str | None = Field(
        None, description="工作区路径,自动加载并注入项目记忆文件(CLAUDE.md/AGENTS.md/.ihui/memory.md)"
    )
    # 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一,Python 端兜底)
    context_limit: int | None = Field(
        None, description="模型上下文窗口大小(tokens),达 88% 阈值自动压缩。0 或 None = 不压缩"
    )
    # Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
    # 传入工具名列表后,后端从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
    agent_tools: list[str] | None = Field(
        None, description="Agent 工具名列表(如 browser_screenshot/computer_mouse_click),传入后走 tool loop"
    )
    # Plan/Act 模式(2026-07-24 立,对标 Trae Work plan/act toggle + Codex)
    # plan_mode='plan' 时前置注入 Plan Mode system prompt,LLM 只制定计划不调用工具;
    # 'act' 或 None = 正常 tool loop 执行(默认)
    plan_mode: str | None = Field(None, description="Plan/Act 模式:'plan'=只制定计划,'act'=正常执行(默认)")


@router.post("/llm/complete", response_model=None)
async def llm_complete(req: LLMCompleteRequest) -> dict[str, Any] | JSONResponse:
    """直接调用 LLM 完成对话(支持 function calling)。"""
    owner_uuid = (req.metadata or {}).get("userId")
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(req.messages, req.workspace_path)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    if req.context_limit and req.context_limit > 0:
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)
        if compaction_info["compressed"]:
            logger.info(
                "Context auto-compressed (Python fallback): %d → %d tokens, removed %d msgs",
                compaction_info["original_tokens"],
                compaction_info["compressed_tokens"],
                compaction_info["removed_count"],
            )
    # 构造透传 kwargs(只透传非 None 的字段)
    kwargs: dict[str, Any] = {}
    if req.tools is not None:
        kwargs["tools"] = req.tools
    if req.tool_choice is not None:
        kwargs["tool_choice"] = req.tool_choice
    if req.temperature is not None:
        kwargs["temperature"] = req.temperature
    if req.max_tokens is not None:
        kwargs["max_tokens"] = req.max_tokens
    result = await llm_gateway.complete(messages, model=req.model, owner_uuid=owner_uuid, **kwargs)
    # 错误前置返回(P1 错误标准化,2026-07-22 立):
    # 之前 LLM 错误一律 HTTP 200 + result.error:True,网关/监控层无法通过状态码识别失败,
    # 必须在调用方解析 result 字段才能区分成功/失败,影响 ELK/Prometheus 错误率统计。
    # 现在:错误统一返回 HTTP 4xx + 结构化 {errorCode, message, model} JSON,
    # 前端 api-client streamChat 在 resp.ok=false 时自动 throw SSEError,
    # attachErrorMeta 从 parsedBody.errorCode 透传到 Error.errorCode,
    # formatSSEError 按状态码 422/501/502 选 severity → toast。
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        # 优先用 llm_gateway 已分类的 errorCode,兜底重新分类(双保险)
        err_code = result.get("errorCode")
        if not err_code:
            if "API key 未配置" in err_msg or "未配置" in err_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            elif "NotImplemented" in err_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            else:
                err_code = "LLM_ERROR"
        status_map = {
            "MODEL_NOT_CONFIGURED": 422,
            "PROVIDER_NOT_IMPLEMENTED": 501,
            "LLM_ERROR": 502,
        }
        status_code = status_map.get(err_code, 502)
        logger.warning(
            "llm_complete failed: model=%s code=%s status=%d msg=%s",
            req.model, err_code, status_code, err_msg,
        )
        return JSONResponse(
            status_code=status_code,
            content={
                "errorCode": err_code,
                "message": err_msg,
                "model": req.model,
            },
        )
    # 透传 metadata
    if req.metadata:
        result["metadata"] = req.metadata
    # 异步回调(仅当 metadata 含关联键时才触发,避免无谓网络开销)
    # 错误响应(error: True)不回调,避免把错误文本当作 AI 回复持久化
    has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
    if has_association and not result.get("error"):
        url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
        task = asyncio.create_task(_fire_callback(url, result, req.metadata))
        _pending_callbacks.add(task)
        task.add_done_callback(_pending_callbacks.discard)
    return result


@router.get("/llm/models")
async def list_models() -> dict[str, Any]:
    """返回可用模型列表(已按 provider 健康状态自动过滤)。

    过滤规则(2026-07-31 立,用户规则:只显示可完美接通调用的模型):
    - 加载 data/default_models.json + ai_model_config_models 表合并清单
    - 调 model_availability.get_available_models() 过滤:
      * 未配置 key 的 provider 模型 → 过滤
      * 健康检查 DOWN(401/403/超时/网络错误)的 provider 模型 → 过滤
      * zero_cost provider(pollinations/llm7/aihorde/opencode_zen)→ 保留
      * LOCAL provider(ollama/lmstudio/llamacpp/vllm)→ 保留
      * PENDING(尚未检测)/ DEGRADED(延迟高但仍可用)→ 保留
    - stub 模式下绕过过滤(本地开发无 key,返回默认列表)
    - 健康状态由 ModelAvailabilityService 后台每 5 分钟刷新一次(不阻塞请求)

    前端 /models 页面通过 API 代理调用此端点获取动态模型清单。
    Dashboard 可调 GET /llm/providers/availability 查看 provider 健康状态详情。
    """
    default_models = _load_default_models()
    # 从数据库加载额外模型(ai_model_config_models 表,is_relay_public=true)
    try:
        from ..core.db_pool import get_shared_pool
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT m.model_id, m.display_name, m.context_length, c.provider_code
                   FROM ai_model_config_models m
                   JOIN ai_model_config c ON m.config_id = c.id
                   WHERE m.enabled = true AND c.enabled = true AND m.is_relay_public = true
                   ORDER BY c.sort_order NULLS LAST, m.relay_sort_order"""
            )
        seen = {m["id"] for m in default_models}
        for r in rows:
            mid = r["model_id"]
            # OpenRouter 模型需要 "openrouter/" 前缀(调用时 _model_to_provider_code 匹配)
            if r["provider_code"] == "openrouter" and not mid.startswith("openrouter/"):
                mid = f"openrouter/{mid}"
            # StepFun 模型加 "stepfun/" 前缀(与 default_models.json 对齐,避免重复)
            elif r["provider_code"] == "stepfun" and not mid.startswith("stepfun/"):
                mid = f"stepfun/{mid}"
            if mid not in seen:
                default_models.append({
                    "id": mid,
                    "name": r["display_name"] or mid,
                    "provider": r["provider_code"],
                    "context_length": r["context_length"] or 4096,
                })
                seen.add(mid)
    except Exception as e:
        logger.warning("从数据库加载模型失败: %s", e)

    # 模型可用性过滤(2026-07-31 立,用户规则:只显示可完美接通调用的模型)
    # stub 模式下绕过过滤(本地开发无 key,所有模型都不可用会被过滤光)
    stub_mode = llm_gateway._is_stub_mode()
    total_before = len(default_models)
    if not stub_mode:
        from ..services.model_availability import model_availability
        default_models = model_availability.get_available_models(default_models)
        filtered_out = total_before - len(default_models)
        logger.info(
            "[llm/models] availability filter: %d → %d (filtered out %d unavailable)",
            total_before, len(default_models), filtered_out,
        )
    # P0 Phase A(2026-07-31):为每个模型附加 caps 字段(provider capability 声明),
    # 从 provider_caps.get_provider_cap(model.provider) 取,模型级 context_length 可覆盖 max_context。
    # 不改 default_models.json 文件本身,只在端点返回时动态注入。
    for m in default_models:
        provider_code = str(m.get("provider") or "")
        cap = get_provider_cap(provider_code)
        # 模型级 context_length 覆盖 provider 默认 max_context
        ctx_len = m.get("context_length")
        if isinstance(ctx_len, int) and ctx_len > 0:
            cap = cap_with_max_context(cap, ctx_len)
        m["caps"] = cap_to_dict(cap)
    return {
        "models": default_models,
        "default": settings.litellm_model,
        "stub_mode": stub_mode,
    }


@router.get("/llm/providers/availability", response_model=None)
async def list_providers_availability() -> dict[str, Any]:
    """模型可用性服务健康状态摘要(供 Dashboard 调试 + 用户透明可见)。

    返回 ModelAvailabilityService 缓存的 provider 健康状态:
    - providers[]:每个 provider 的 status/latency_ms/last_check/error
    - summary:healthy/degraded/down/local/zero_cost 计数

    用于让用户理解"为什么某些模型不显示"——因为对应 provider 健康检查失败。
    """
    from ..services.model_availability import model_availability
    return _wrap_ok(model_availability.get_health_summary())


@router.post("/llm/models/sync", response_model=None)
async def sync_models() -> dict[str, Any]:
    """手动触发模型自动同步(从所有已配置 key 的 provider 拉取最新模型清单)。

    并发拉取 /v1/models → 注册新增模型(自动上架)→ 下架移除模型(自动下架)
    → 触发 ModelAvailabilityService 健康检查刷新。
    返回同步状态(含每个 provider 的结果:新增数 / 移除数 / 耗时)。
    """
    from ..services.model_sync import model_sync_service
    return _wrap_ok(await model_sync_service.sync_all_providers())


@router.get("/llm/models/sync/status", response_model=None)
async def get_models_sync_status() -> dict[str, Any]:
    """查询模型同步状态(最近一次同步时间 + 每个 provider 的结果)。

    返回字段:
    - last_sync_at: ISO 8601 时间戳
    - last_sync_duration_ms: 同步耗时
    - total_providers / total_new_models / total_removed_models: 汇总计数
    - is_syncing: 当前是否正在同步(防止并发触发)
    - results[]: 每个 provider 的同步结果
    """
    from ..services.model_sync import model_sync_service
    return _wrap_ok(model_sync_service.get_status())


@router.post("/llm/complete/stream", response_model=None)
async def complete_stream(req: LLMCompleteRequest, request: Request) -> StreamingResponse | JSONResponse:
    """流式 LLM 调用(原生 token 级流式 + SSE event 字段 + 心跳保活)。

    事件类型:
    - event: chunk  — 逐 token 内容 {"content": "..."}
    - event: done   — 完成 {"model": ..., "usage": ..., "stub": bool, "metadata": {...}}
    - event: error  — 错误 {"message": "...", "errorCode": "..."}

    错误标准化(P1 流式配套,2026-07-22 立):
    - MODEL_NOT_CONFIGURED(api_key 缺失):在返回 StreamingResponse 前做 pre-flight check,
      直接返回 HTTP 422 + JSON,不进入流(因为 StreamingResponse 一旦开始 yield,
      HTTP 状态码已锁定 200,无法中途变更)。
    - PROVIDER_NOT_IMPLEMENTED / LLM_ERROR(运行时错误):无法 pre-flight,仍走流内
      event: error(含 errorCode 字段),前端 api-client parseStreamLine → attachErrorMeta
      透传 errorCode 到 Error 对象 → onError 回调。
    """

    accumulated: dict[str, Any] = {"content": "", "reasoning": "", "model": req.model, "usage": None, "stub": False}
    owner_uuid = (req.metadata or {}).get("userId")
    # Plan/Act 模式注入:plan 模式前置注入 Plan Mode system prompt(在 workspace memory 之前,
    # 确保 Plan Mode 引导位于 system prompt 最顶部);act 模式原样返回
    messages = _inject_plan_mode_prompt(req.messages, req.plan_mode)
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(messages, req.workspace_path)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    compaction_info: dict[str, Any] | None = None
    if req.context_limit and req.context_limit > 0:
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)

    # P1 流式配套 pre-flight check:检测 api_key 缺失(MODEL_NOT_CONFIGURED),
    # 在返回 StreamingResponse 前直接返回 422 JSON,避免流式开始后只能推 event: error。
    # stub 模式下无需 api_key(返回模拟响应),跳过 pre-flight。
    if not llm_gateway._is_stub_mode():
        try:
            _api_key, _, _ = await llm_gateway._resolve(req.model or settings.litellm_model, owner_uuid)
        except Exception as e:
            logger.warning("stream pre-flight _resolve failed: %s", e)
            _api_key = None
        if not _api_key:
            err_msg = (
                f"模型 {req.model or settings.litellm_model} 对应的 provider API key 未配置,"
                f"请在 .env 或 ai_model_config 表中设置"
            )
            logger.warning(
                "stream pre-flight blocked: model=%s code=MODEL_NOT_CONFIGURED",
                req.model,
            )
            return JSONResponse(
                status_code=422,
                content={
                    "errorCode": "MODEL_NOT_CONFIGURED",
                    "message": err_msg,
                    "model": req.model,
                },
            )

    async def gen() -> AsyncIterator[str]:
        # 提问标记解析器:检测 LLM 输出中的 [[ASK_USER:JSON]] 标记,转换为结构化 question 事件
        # 标记本身从内容中剥离,不污染对话文本;跨 chunk 分片自动累积
        question_parser = QuestionStreamParser()
        try:
            # 若发生压缩,通过 SSE 首事件通知调用方(对标 API 层的 compaction 事件)
            if compaction_info and compaction_info.get("compressed"):
                yield f"data: {json.dumps({'compaction': {'triggered': True, 'tokensBefore': compaction_info['original_tokens'], 'tokensAfter': compaction_info['compressed_tokens'], 'removedCount': compaction_info['removed_count'], 'usageRatio': compaction_info['usage_ratio']}}, ensure_ascii=False)}\n\n"

            # ===== Agent tool loop(2026-07-22 立,AI 浏览器/电脑控制)=====
            # 当请求携带 agent_tools(工具名列表)时:
            # 1. 从 mcp_server 加载完整 schema,转换为 OpenAI tools 格式
            # 2. 调 llm_gateway.complete() 带 tools,获取 LLM 决策(tool_calls)
            # 3. 如有 tool_calls:推送 SSE 事件 → 执行工具 → 回灌结果 → 继续 astream 生成最终回复
            # 4. 如无 tool_calls:推送 content + done,跳过 astream
            if req.agent_tools:
                from ..services.mcp_server import mcp_server as _mcp
                all_tools = _mcp.list_tools()
                tool_map = {t.name: t for t in all_tools}
                openai_tools: list[dict[str, Any]] = []
                for _name in req.agent_tools:
                    _t = tool_map.get(_name)
                    if _t:
                        openai_tools.append({
                            "type": "function",
                            "function": {
                                "name": _t.name,
                                "description": _t.description,
                                "parameters": _t.input_schema,
                            },
                        })

                if openai_tools:
                    # ===== 多 agent 编排引导注入(2026-07-24 立)=====
                    # 当 dispatch_subagent 在 agent_tools 中时,在 tool loop 开始前注入引导 system message,
                    # 引导 LLM 在复杂任务时主动派发子智能体。注入只发生一次,不随 iteration 重复。
                    # 注入策略与 _inject_workspace_memory 一致:messages[0] 为 system 则追加,否则在开头插入。
                    if "dispatch_subagent" in req.agent_tools:
                        _subagent_prompt = _build_subagent_orchestration_prompt()
                        if messages and messages[0].get("role") == "system":
                            _existing = messages[0].get("content", "")
                            _merged = f"{_existing}\n\n{_subagent_prompt}" if _existing else _subagent_prompt
                            messages[0] = {**messages[0], "content": _merged}
                        else:
                            messages.insert(0, {"role": "system", "content": _subagent_prompt})

                    # ===== 多轮 tool loop(2026-07-22 升级,支持 AI 连续操作:截图→分析→点击→再截图)=====
                    # 每轮:complete(tools) → 执行 tool_calls → 回灌结果
                    # 直到 LLM 不再决策 tool_calls 或达到 max_iterations → 归一化 → astream 生成最终回复
                    # 2026-07-24 修复:从 settings.max_agent_iterations 读取(原硬编码 3,无法覆盖多步操作)
                    max_iterations = settings.max_agent_iterations
                    # 重复调用检测集合(2026-07-24 立,修复 stepfun/step-router-v1 在 tool loop 中重复调用
                    # search_codebase(query="config") 8 次耗尽 max_iterations 的问题):
                    # - executed_tool_keys:本轮 tool loop 内已执行过的 (tool_name, args_hash) 集合,命中则跳过执行
                    # - injected_warning_keys:已注入过 system 提示的 key 集合(每个 key 只注入一次,避免每轮重复注入)
                    # 每次 /llm/complete/stream 请求独立(集合在 tool loop 进入时初始化为空)
                    executed_tool_keys: set[str] = set()
                    injected_warning_keys: set[str] = set()
                    for _tool_iter in range(max_iterations):
                        complete_result = await llm_gateway.complete(
                            messages, model=req.model, owner_uuid=owner_uuid,
                            tools=openai_tools, tool_choice="auto",
                        )
                        # complete() 错误检查
                        if complete_result.get("error"):
                            err_evt = {
                                "type": "error",
                                "message": complete_result.get("error_message", "LLM 调用失败"),
                                "errorCode": complete_result.get("errorCode", "LLM_ERROR"),
                            }
                            yield f"event: error\ndata: {json.dumps(err_evt, ensure_ascii=False)}\n\n"
                            return

                        tool_calls_raw = complete_result.get("tool_calls") or []

                        # 无 tool_calls:LLM 不再需要工具
                        if not tool_calls_raw:
                            # 第 0 轮就无 tool_calls:LLM 直接回复了 content,推送后 return(不走 astream)
                            if _tool_iter == 0:
                                content = complete_result.get("content", "") or ""
                                clean_text, questions = question_parser.feed(content)
                                for q in questions:
                                    q_event = {"type": "question", "question": q.to_dict()}
                                    yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                                if clean_text:
                                    chunk_event = {"type": "chunk", "content": clean_text}
                                    accumulated["content"] += clean_text
                                    yield f"event: chunk\ndata: {json.dumps(chunk_event, ensure_ascii=False)}\n\n"
                                leftover, leftover_qs = question_parser.flush()
                                if leftover:
                                    chunk_event = {"type": "chunk", "content": leftover}
                                    accumulated["content"] += leftover
                                    yield f"event: chunk\ndata: {json.dumps(chunk_event, ensure_ascii=False)}\n\n"
                                for q in leftover_qs:
                                    q_event = {"type": "question", "question": q.to_dict()}
                                    yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                                accumulated["model"] = complete_result.get("model", req.model)
                                accumulated["usage"] = complete_result.get("usage", {})
                                accumulated["stub"] = complete_result.get("stub", False)
                                done_event = {
                                    "type": "done",
                                    "model": accumulated["model"],
                                    "usage": accumulated["usage"],
                                    "stub": accumulated["stub"],
                                }
                                if req.metadata:
                                    done_event["metadata"] = req.metadata
                                yield f"event: done\ndata: {json.dumps(done_event, ensure_ascii=False)}\n\n"
                                has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
                                if has_association and not accumulated.get("error") and not await request.is_disconnected():
                                    url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
                                    task = asyncio.create_task(_fire_callback(url, accumulated, req.metadata))
                                    _pending_callbacks.add(task)
                                    task.add_done_callback(_pending_callbacks.discard)
                                return
                            # _tool_iter > 0:已有 tool 结果在 messages 中,跳出循环走 astream
                            break

                        # 有 tool_calls:执行工具 + 回灌结果(下方的代码会继续处理)
                        messages.append({
                            "role": "assistant",
                            "content": complete_result.get("content", "") or "",
                            "tool_calls": tool_calls_raw,
                        })
                        tool_exec_tracker: list[bool] = []
                        for tc in tool_calls_raw:
                            fn = tc.get("function", {})
                            tool_name = fn.get("name", "")
                            raw_args = fn.get("arguments", "")
                            try:
                                args = json.loads(raw_args) if raw_args.strip() else {}
                            except (json.JSONDecodeError, ValueError):
                                args = {"_raw": raw_args}

                            # 推送 tool-call-start 事件(前端 onToolCall 回调)
                            tc_start = {
                                "type": "tool-call-start",
                                "toolCallId": tc.get("id", ""),
                                "toolName": tool_name,
                                "args": args,
                                "iteration": _tool_iter + 1,
                            }
                            yield f"event: tool-call-start\ndata: {json.dumps(tc_start, ensure_ascii=False)}\n\n"

                            # Subagent 派发生成事件(2026-07-28 立,对标 Trae Work 自动派发):
                            # dispatch_subagent 工具执行前,解析 args.tasks 数组或 args.name+args.task 单任务,
                            # 为每个子任务发 subagent_spawn SSE 事件,前端进度面板自动展示 subagent 生命周期。
                            # _spawned_sub_ids 在本次 tool call 作用域内收集,执行后用于发 subagent_end 事件。
                            _spawned_sub_ids: list[str] = []
                            if tool_name == "dispatch_subagent":
                                _sa_tasks: list[dict[str, str]] = []
                                _tasks_field = args.get("tasks")
                                if isinstance(_tasks_field, list):
                                    for _tk in _tasks_field:
                                        if isinstance(_tk, dict) and _tk.get("name") and _tk.get("task"):
                                            _sa_tasks.append({"name": str(_tk["name"]), "task": str(_tk["task"])})
                                elif args.get("name") and args.get("task"):
                                    _sa_tasks.append({"name": str(args["name"]), "task": str(args["task"])})
                                _spawn_now = datetime.now(timezone.utc).isoformat()
                                for _sa_task in _sa_tasks:
                                    _sa_id = f"sub-{uuid.uuid4().hex[:8]}"
                                    _spawned_sub_ids.append(_sa_id)
                                    _spawn_evt = {
                                        "type": "subagent_spawn",
                                        "id": _sa_id,
                                        "role": _sa_task["name"],
                                        "task": _sa_task["task"],
                                        "timestamp": _spawn_now,
                                    }
                                    yield f"event: subagent_spawn\ndata: {json.dumps(_spawn_evt, ensure_ascii=False)}\n\n"

                            # 重复调用检测(2026-07-24 立,修复 stepfun/step-router-v1 在 tool loop 中重复调用
                            # search_codebase(query="config") 8 次耗尽 max_iterations 的问题):
                            # 命中已执行集合则跳过 _mcp.call_tool,构造简短 result,推送带 repeated: True 标记的
                            # tool-result 事件,并注入一次 system 提示消息引导 LLM 基于已有结果回答或换参数
                            args_hash = json.dumps(args, sort_keys=True, ensure_ascii=False)
                            dedup_key = f"{tool_name}::{args_hash}"

                            if dedup_key in executed_tool_keys:
                                # 重复调用:跳过执行,构造简短 result(标注 previous_result_available)
                                exec_result = {
                                    "tool": tool_name,
                                    "ok": True,
                                    "skipped": True,
                                    "message": "已跳过重复调用,结果见之前 tool-result",
                                    "previous_result_available": True,
                                }
                                ok = True
                                tool_exec_tracker.append(ok)
                                # 推送 tool-result 事件(带 repeated: True 标记,让前端可见 LLM 决策了但被去重)
                                tc_result_evt = {
                                    "type": "tool-result",
                                    "toolCallId": tc.get("id", ""),
                                    "toolName": tool_name,
                                    "args": args,
                                    "result": exec_result,
                                    "isError": False,
                                    "iteration": _tool_iter + 1,
                                    "repeated": True,
                                }
                                yield f"event: tool-result\ndata: {json.dumps(tc_result_evt, ensure_ascii=False)}\n\n"
                                # 回灌工具结果(简短提示,让 LLM 知道工具被跳过,完整结果见之前 tool 消息)
                                result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.get("id", ""),
                                    "name": tool_name,
                                    "content": result_json,
                                })
                                # system 提示消息只注入一次(同一 (tool_name, args_hash) 第二次重复时才注入,
                                # 避免每轮都重复注入同一提示)
                                if dedup_key not in injected_warning_keys:
                                    injected_warning_keys.add(dedup_key)
                                    messages.append({
                                        "role": "system",
                                        "content": (
                                            f"工具 '{tool_name}' (args={args_hash}) 已在之前轮次成功执行,"
                                            f"结果已记录在上方 tool 角色消息中。请基于已有结果直接回答用户问题,"
                                            f"或调用不同参数的工具,不要重复调用相同参数的同一工具。"
                                        ),
                                    })
                                continue

                            # 首次调用:记录到集合(不管成功失败都记录,防止 LLM 重复调用同一参数的同一工具)
                            executed_tool_keys.add(dedup_key)

                            # 执行工具(异常保护:网络/超时/JSON 错误不应崩溃 SSE 流)
                            # G6(2026-07-26):透传 owner_uuid(user_id)给 knowledge_lookup 查 LTM 源
                            # dispatch_subagent 特殊处理(2026-07-28 立):
                            # 直接调用 _tool_dispatch_subagent(绕过 _mcp.call_tool 通用接口),
                            # 注入 progress_callback → asyncio.Queue → 实时 yield subagent_progress SSE 事件,
                            # 让前端进度面板在 subagent 执行期间看到 thinking/tool_call/tool_result/output_ready。
                            if tool_name == "dispatch_subagent" and _spawned_sub_ids:
                                # task_index → subagent_id 映射(并行模式多 task,单模式只有 1 个)
                                _sub_id_by_index: dict[int, str] = {
                                    i: sid for i, sid in enumerate(_spawned_sub_ids)
                                }
                                _single_sub_id = _spawned_sub_ids[0]
                                _progress_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

                                def _progress_cb(evt: dict[str, Any]) -> None:
                                    """进度回调:_run_agent 事件 → SSE progress 事件格式。"""
                                    _task_idx = evt.pop("task_index", None)
                                    _agent_name = evt.pop("agent_name", "")
                                    if _task_idx is not None and _task_idx in _sub_id_by_index:
                                        _sa_id = _sub_id_by_index[_task_idx]
                                    else:
                                        _sa_id = _single_sub_id
                                    _sse_evt: dict[str, Any] = {
                                        "type": "subagent_progress",
                                        "id": _sa_id,
                                        "phase": evt.get("phase", ""),
                                        "timestamp": datetime.now(timezone.utc).isoformat(),
                                    }
                                    for _fk in ("iteration", "tool", "ok", "output_preview"):
                                        if _fk in evt:
                                            _sse_evt[_fk] = evt[_fk]
                                    if _agent_name:
                                        _sse_evt["agentName"] = _agent_name
                                    _progress_queue.put_nowait(_sse_evt)

                                try:
                                    _dispatch_task = asyncio.create_task(
                                        _tool_dispatch_subagent(args, progress_callback=_progress_cb)
                                    )
                                    # 排水进度事件,直到 dispatch 任务完成
                                    while not _dispatch_task.done():
                                        try:
                                            _pevt = await asyncio.wait_for(_progress_queue.get(), timeout=0.05)
                                            if _pevt:
                                                yield f"event: subagent_progress\ndata: {json.dumps(_pevt, ensure_ascii=False)}\n\n"
                                        except asyncio.TimeoutError:
                                            continue
                                    # 排水剩余事件
                                    while not _progress_queue.empty():
                                        _pevt = _progress_queue.get_nowait()
                                        if _pevt:
                                            yield f"event: subagent_progress\ndata: {json.dumps(_pevt, ensure_ascii=False)}\n\n"
                                    exec_result = await _dispatch_task
                                except Exception as e:
                                    logger.exception("dispatch_subagent execution exception")
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": str(e)[:500],
                                        "errorCode": "EXECUTION_EXCEPTION",
                                        "message": f"dispatch_subagent 执行异常: {type(e).__name__}",
                                    }
                            else:
                                try:
                                    exec_result = await _mcp.call_tool(tool_name, args, user_id=owner_uuid)
                                except Exception as e:
                                    logger.exception("Tool execution exception: %s", tool_name)
                                    exec_result = {
                                        "tool": tool_name,
                                        "ok": False,
                                        "error": str(e)[:500],
                                        "errorCode": "EXECUTION_EXCEPTION",
                                        "message": f"工具执行异常: {type(e).__name__}",
                                    }
                            # 默认成功:工具 handler 不返回 ok 字段时视为成功
                            # (异常分支已显式设置 ok: False,此处只兜底无 ok 字段的正常结果)
                            ok = bool(exec_result.get("ok", True))
                            tool_exec_tracker.append(ok)

                            # 推送 tool-result 事件
                            tc_result_evt = {
                                "type": "tool-result",
                                "toolCallId": tc.get("id", ""),
                                "toolName": tool_name,
                                "args": args,
                                "result": exec_result,
                                "isError": not ok,
                                "iteration": _tool_iter + 1,
                            }
                            yield f"event: tool-result\ndata: {json.dumps(tc_result_evt, ensure_ascii=False)}\n\n"

                            # Subagent 派发结束事件(2026-07-28 立,对标 Trae Work 自动派发):
                            # dispatch_subagent 工具执行后,为每个已 spawn 的 sub_id 发 subagent_end 事件,
                            # status=done(成功)或 failed(失败),失败时附 failureReason(截断 500 字符)。
                            # 重复调用分支(dedup)不发 end 事件:subagent 在首次调用时已发过 spawn+end,
                            # 重复调用只是 LLM 决策被去重跳过,不应重复触发前端生命周期展示。
                            if tool_name == "dispatch_subagent" and _spawned_sub_ids:
                                _sa_status = "done" if ok else "failed"
                                _sa_error_msg = None
                                if not ok:
                                    _sa_error_msg = exec_result.get("error") or exec_result.get("message")
                                _end_now = datetime.now(timezone.utc).isoformat()
                                for _sa_id in _spawned_sub_ids:
                                    _end_evt = {
                                        "type": "subagent_end",
                                        "id": _sa_id,
                                        "status": _sa_status,
                                        "timestamp": _end_now,
                                    }
                                    if _sa_error_msg:
                                        _end_evt["failureReason"] = str(_sa_error_msg)[:500]
                                    yield f"event: subagent_end\ndata: {json.dumps(_end_evt, ensure_ascii=False)}\n\n"

                            # 回灌工具结果(失败时显式标注,防止 LLM 幻觉"已完成")
                            result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                            if not ok:
                                err_detail = exec_result.get("error") or exec_result.get("message") or "unknown error"
                                err_code = exec_result.get("errorCode", "UNKNOWN")
                                inner = exec_result.get("result", {})
                                if isinstance(inner, dict) and inner.get("errorCode"):
                                    err_code = inner.get("errorCode", err_code)
                                    err_detail = inner.get("error", err_detail)
                                result_json = (
                                    f"TOOL EXECUTION FAILED. errorCode={err_code}. error={err_detail}. "
                                    f"You MUST tell the user the tool failed. Do NOT claim success. "
                                    f"Raw result: {result_json}"
                                )
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id", ""),
                                "name": tool_name,
                                "content": result_json,
                            })
                        # 全部 tool 失败时,直接构造失败响应,不走 astream(与 conversation.py 一致,防止 LLM 幻觉)
                        if tool_exec_tracker and all(not ok_flag for ok_flag in tool_exec_tracker):
                            failed_lines = []
                            for tc in tool_calls_raw:
                                fn = tc.get("function", {})
                                t_name = fn.get("name", "")
                                for m in messages:
                                    if m.get("role") == "tool" and m.get("name") == t_name:
                                        raw_content = m.get("content", "")
                                        err_code = "UNKNOWN"
                                        err_msg = "unknown error"
                                        if "errorCode=" in raw_content:
                                            try:
                                                err_code = raw_content.split("errorCode=")[1].split(".")[0].strip()
                                                if "error=" in raw_content:
                                                    err_msg = raw_content.split("error=")[1].split(".")[0].strip()
                                            except (IndexError, ValueError):
                                                pass
                                        failed_lines.append(f"- {t_name}: {err_code} — {err_msg}")
                                        break
                            fail_text = (
                                "工具执行失败,未能完成您的请求:\n"
                                + "\n".join(failed_lines) + "\n\n"
                                "可能的原因:\n"
                                "- TARGET_NOT_CONNECTED:浏览器扩展或桌面端未启动,请确保对应端已打开并登录\n"
                                "- TIMEOUT:操作超时,请稍后重试\n"
                                "- SELECTOR_NOT_FOUND:页面元素未找到,请检查选择器是否正确\n"
                            )
                            clean_text, questions = question_parser.feed(fail_text)
                            for q in questions:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                            if clean_text:
                                chunk_event = {"type": "chunk", "content": clean_text}
                                accumulated["content"] += clean_text
                                yield f"event: chunk\ndata: {json.dumps(chunk_event, ensure_ascii=False)}\n\n"
                            leftover, leftover_qs = question_parser.flush()
                            if leftover:
                                chunk_event = {"type": "chunk", "content": leftover}
                                accumulated["content"] += leftover
                                yield f"event: chunk\ndata: {json.dumps(chunk_event, ensure_ascii=False)}\n\n"
                            for q in leftover_qs:
                                q_event = {"type": "question", "question": q.to_dict()}
                                yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                            accumulated["model"] = complete_result.get("model", req.model)
                            accumulated["usage"] = complete_result.get("usage", {})
                            done_event = {
                                "type": "done",
                                "model": accumulated["model"],
                                "usage": accumulated["usage"],
                                "stub": accumulated.get("stub", False),
                            }
                            if req.metadata:
                                done_event["metadata"] = req.metadata
                            yield f"event: done\ndata: {json.dumps(done_event, ensure_ascii=False)}\n\n"
                            has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
                            if has_association and not accumulated.get("error") and not await request.is_disconnected():
                                url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
                                task = asyncio.create_task(_fire_callback(url, accumulated, req.metadata))
                                _pending_callbacks.add(task)
                                task.add_done_callback(_pending_callbacks.discard)
                            return

                        # 有成功的 tool:继续下一轮循环(下一轮 complete 会带 tools,让 LLM 决定是否需要更多操作)
                        # 注意:不在这里归一化 messages,因为下一轮 complete() 需要原生 tool 角色

                    # 循环结束(无 tool_calls 或达到 max_iterations)
                    # 归一化 messages:把 tool 角色消息转为 user 消息(避免被 astream 内部 repair_messages 过滤)
                    normalized_msgs: list[dict[str, Any]] = []
                    for m in messages:
                        if m.get("role") == "tool":
                            normalized_msgs.append({
                                "role": "user",
                                "content": f"[Tool Result: {m.get('name', 'unknown')}]\n{m.get('content', '')}",
                            })
                        elif m.get("role") == "assistant" and m.get("tool_calls"):
                            content = m.get("content", "") or ""
                            if not content:
                                tool_names = [tc.get("function", {}).get("name", "") for tc in m.get("tool_calls", [])]
                                content = f"[I called tools: {', '.join(tool_names)}]"
                            normalized_msgs.append({
                                "role": "assistant",
                                "content": content,
                            })
                        else:
                            normalized_msgs.append(m)
                    messages[:] = normalized_msgs  # 切片赋值:修改原列表,避免创建本地变量
                    # 继续走 astream(用归一化后的 messages,不带 tools)

            async for event in llm_gateway.astream(messages, model=req.model, owner_uuid=owner_uuid):
                if await request.is_disconnected():
                    logger.info("SSE client disconnected, stopping stream")
                    break
                event_type = event.get("type", "message")
                # 累积内容用于回调
                if event_type in ("chunk", "message"):
                    raw_content = event.get("content", "")
                    # 喂入提问解析器,拿到剥离标记后的纯文本 + 提问列表
                    clean_text, questions = question_parser.feed(raw_content)
                    # 用纯文本替换原 content(标记不进对话文本)
                    event["content"] = clean_text
                    accumulated["content"] += clean_text
                    # 先推送可能存在的提问事件(在 chunk 之前,让 UI 提前弹窗)
                    for q in questions:
                        q_event = {"type": "question", "question": q.to_dict()}
                        yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                    # 仅当有纯文本时才推送 chunk(避免空 chunk)
                    if clean_text:
                        yield f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
                    continue
                elif event_type == "reasoning":
                    accumulated["reasoning"] += event.get("content", "")
                elif event_type == "done":
                    # 流结束前 flush 解析器残留(不完整标记作为普通文本输出,不吞内容)
                    leftover, leftover_qs = question_parser.flush()
                    if leftover:
                        # 残留文本作为最后一个 chunk 推送
                        chunk_event = {"type": "chunk", "content": leftover}
                        accumulated["content"] += leftover
                        yield f"event: chunk\ndata: {json.dumps(chunk_event, ensure_ascii=False)}\n\n"
                    for q in leftover_qs:
                        q_event = {"type": "question", "question": q.to_dict()}
                        yield f"event: question\ndata: {json.dumps(q_event, ensure_ascii=False)}\n\n"
                    accumulated["model"] = event.get("model", req.model)
                    accumulated["usage"] = event.get("usage")
                    accumulated["stub"] = event.get("stub", False)
                    # 在 done 事件中透传 metadata
                    if req.metadata:
                        event["metadata"] = req.metadata
                yield f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        except asyncio.CancelledError:
            logger.info("SSE generator cancelled by client disconnect")
            raise
        except Exception as e:
            # 流内运行时错误(PROVIDER_NOT_IMPLEMENTED / LLM_ERROR)无法 pre-flight,
            # 推送 event: error 含 errorCode,前端 attachErrorMeta 透传到 Error.errorCode
            err_msg = str(e)
            err_code = "LLM_ERROR"
            if "NotImplemented" in err_msg:
                err_code = "PROVIDER_NOT_IMPLEMENTED"
            elif "API key 未配置" in err_msg or "未配置" in err_msg:
                err_code = "MODEL_NOT_CONFIGURED"
            err = {"type": "error", "message": err_msg, "errorCode": err_code}
            logger.warning(
                "stream gen error: model=%s code=%s msg=%s",
                req.model, err_code, err_msg,
            )
            yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n"
            return

        # 流结束后异步回调(仅当 metadata 含关联键且无错误时)
        # 客户端已断开则不触发 callback(避免 POST 到已废弃 URL)
        has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
        if has_association and not accumulated.get("error") and not await request.is_disconnected():
            url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
            task = asyncio.create_task(_fire_callback(url, accumulated, req.metadata))
            _pending_callbacks.add(task)
            task.add_done_callback(_pending_callbacks.discard)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲,确保实时流式
        },
    )


async def _fire_callback(url: str, payload: dict[str, Any], metadata: dict[str, Any] | None) -> None:
    """异步 POST 推理结果到 callback_url。

    失败静默(只记日志),不阻塞主流程。
    由 API 侧的 /api/ai/callback 端点接收并入队 aiCallback 处理。

    健壮性:
    - 若配置 ai_callback_secret,携带 X-Internal-Secret 头(与后端共享密钥校验)
    - 对 5xx / 网络错误重试 2 次(指数退避 0.5s → 1s),4xx 不重试(请求本身有问题)
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)
    body = {
        "content": payload.get("content", ""),
        "model": payload.get("model"),
        "usage": payload.get("usage"),
        "stub": payload.get("stub", False),
        "metadata": metadata or {},
    }
    if payload.get("reasoning"):
        body["reasoning"] = payload["reasoning"]
    headers: dict[str, str] = {}
    if settings.ai_callback_secret:
        headers["X-Internal-Secret"] = settings.ai_callback_secret

    max_attempts = 3  # 首次 + 2 次重试
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code < 500:
                    # 2xx 成功 / 4xx 客户端错误(请求本身有问题,不重试)
                    if resp.status_code >= 400:
                        logger.warning(
                            "LLM callback to %s failed: %s %s",
                            url,
                            resp.status_code,
                            resp.text[:200],
                        )
                    return
                # 5xx 服务端错误,可重试
                if attempt < max_attempts - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                logger.warning(
                    "LLM callback to %s failed after %d attempts: %s %s",
                    url,
                    max_attempts,
                    resp.status_code,
                    resp.text[:200],
                )
        except Exception as e:
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            logger.warning("LLM callback to %s error after %d attempts: %s", url, max_attempts, e)


# ---------------------------------------------------------------------------
# MoA / Vision 路由(P2-2 + P2-3,对标 Hermes Agent provider 扩展 + 多模态输入)
# ---------------------------------------------------------------------------


@router.get("/llm/moa-presets")
async def list_moa_presets() -> dict[str, Any]:
    """列出所有 MoA 预设。"""
    return {"code": 0, "message": "ok", "data": moa_router.list_presets()}


@router.post("/llm/moa-presets")
async def register_moa_preset(request: Request) -> dict[str, Any]:
    """注册 MoA 预设。

    请求体(MoaPreset 契约):
    - name: 预设名(必填)
    - models: 模型列表,每项含 {model, role: proposer|aggregator|critic}
    """
    body = await request.json()
    name = body.get("name")
    if not name:
        return {"code": 1, "message": "name is required"}
    moa_router.register_preset(name, body)
    return {"code": 0, "message": "ok"}


@router.post("/llm/moa-complete")
async def moa_complete(request: Request) -> dict[str, Any]:
    """MoA 推理(多模型出方案 + 聚合)。

    请求体:
    - messages: OpenAI 格式消息列表
    - presetName: MoA 预设名
    """
    body = await request.json()
    messages = body.get("messages", [])
    preset_name = body.get("presetName", "")
    if not preset_name:
        return {"code": 1, "message": "presetName is required"}
    result = await moa_router.complete(messages, preset_name)
    return {"code": 0, "message": "ok", "data": result}


@router.post("/llm/vision")
async def vision_analyze(request: Request) -> dict[str, Any]:
    """视觉分析(图像 URL 或 base64 + 任务描述 → LLM 视觉模型分析)。

    请求体(VisionAnalyzeRequest 契约):
    - image: 图片 URL 或 base64 编码(必填)
    - task: 分析任务描述(必填)
    - model: 期望模型(可选)
    """
    body = await request.json()
    result = await _tool_vision_analyze(body)
    return {"code": 0, "message": "ok", "data": result}


# ---------------------------------------------------------------------------
# Embeddings 路由(2026-07-22 立,补建 v1/embeddings 503 修复的依赖端点)
# ---------------------------------------------------------------------------


class EmbeddingsRequest(BaseModel):
    """Embedding 向量生成请求(OpenAI 兼容)。"""

    model: str = Field(..., description="模型名称")
    input: str | list[str] = Field(..., description="文本或文本列表")
    dimensions: int | None = Field(None, description="输出维度(部分模型支持)")


@router.post("/llm/embeddings", response_model=None)
async def create_embeddings(req: EmbeddingsRequest) -> dict[str, Any] | JSONResponse:
    """生成文本嵌入向量(OpenAI 兼容格式)。

    返回格式:
    {
        "object": "list",
        "data": [{"object": "embedding", "index": 0, "embedding": [0.1, ...]}],
        "model": "text-embedding-ada-002",
        "usage": {"prompt_tokens": 10, "total_tokens": 10}
    }
    """
    texts = [req.input] if isinstance(req.input, str) else list(req.input)
    if not texts:
        return JSONResponse(
            status_code=400,
            content={"code": "INVALID_INPUT", "message": "input must not be empty", "model": req.model},
        )

    used_model = req.model or getattr(settings, "embedding_model", "text-embedding-ada-002")

    # stub 模式:逐条调 llm_gateway.embed(返回确定性哈希向量,无真实 usage)
    if llm_gateway._is_stub_mode():
        embeddings = [await llm_gateway.embed(t, used_model) for t in texts]
        total_chars = sum(len(t) for t in texts)
        est_tokens = max(1, total_chars // 4)
        return {
            "object": "list",
            "data": [
                {"object": "embedding", "index": i, "embedding": emb}
                for i, emb in enumerate(embeddings)
            ],
            "model": used_model,
            "usage": {"prompt_tokens": est_tokens, "total_tokens": est_tokens},
        }

    # 非 stub 模式:直接调 litellm.aembedding(批量,含真实 usage)
    import litellm

    kwargs: dict[str, Any] = {}
    if req.dimensions is not None:
        kwargs["dimensions"] = req.dimensions
    try:
        response = await litellm.aembedding(model=used_model, input=texts, **kwargs)
    except Exception as e:
        logger.exception("Embedding generation failed: model=%s", used_model)
        return JSONResponse(
            status_code=502,
            content={"code": "EMBEDDING_ERROR", "message": str(e), "model": used_model},
        )

    embeddings = [item["embedding"] for item in response.data]
    usage_obj = getattr(response, "usage", None)
    if isinstance(usage_obj, dict):
        prompt_tokens = usage_obj.get("prompt_tokens", 0) or 0
        total_tokens = usage_obj.get("total_tokens", 0) or 0
    else:
        prompt_tokens = getattr(usage_obj, "prompt_tokens", 0) or 0
        total_tokens = getattr(usage_obj, "total_tokens", 0) or 0

    return {
        "object": "list",
        "data": [
            {"object": "embedding", "index": i, "embedding": emb}
            for i, emb in enumerate(embeddings)
        ],
        "model": used_model,
        "usage": {"prompt_tokens": prompt_tokens, "total_tokens": total_tokens},
    }


# ============================================================================
# P0-2 协议互转端点(2026-07-30 立,对齐 OmniRoute 三协议互转)
#
# 暴露 Anthropic Messages 和 Gemini generateContent 协议端点,客户端可直接用
# 对应厂商官方 SDK 调用 IHUI 网关,无需改 SDK 代码。内部用 ProtocolAdapter
# 转成 OpenAI 格式走 llm_gateway 标准调用链,响应转回入站协议格式。
#
# 端点:
# - POST /llm/anthropic/v1/messages          (Anthropic Messages 协议,支持 stream)
# - POST /llm/gemini/v1beta/models/{model}:generateContent  (Gemini 协议,支持 stream)
# - POST /llm/gemini/v1beta/models/{model}:streamGenerateContent  (Gemini 强制流式)
# ============================================================================


def _anthropic_streaming_response(
    messages: list[dict[str, Any]], model: str, kwargs: dict[str, Any]
) -> StreamingResponse:
    """构造 Anthropic Messages SSE 流式响应(对齐 Anthropic Messages Streaming)。

    SSE 事件序列:
    1. event: message_start — 初始消息元数据
    2. event: content_block_start — 文本块开始
    3. event: content_block_delta (多次) — 逐 token 文本增量
    4. event: content_block_stop — 文本块结束
    5. event: message_delta — 消息级增量(stop_reason + usage)
    6. event: message_stop — 消息结束
    """
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"

    async def gen() -> AsyncIterator[str]:
        # 1. message_start
        msg_start = {
            "type": "message_start",
            "message": {
                "id": msg_id,
                "type": "message",
                "role": "assistant",
                "content": [],
                "model": model,
                "stop_reason": None,
                "usage": {"input_tokens": 0, "output_tokens": 0},
            },
        }
        yield f"event: message_start\ndata: {json.dumps(msg_start, ensure_ascii=False)}\n\n"

        # 2. content_block_start
        block_start = {
            "type": "content_block_start",
            "index": 0,
            "content_block": {"type": "text", "text": ""},
        }
        yield f"event: content_block_start\ndata: {json.dumps(block_start, ensure_ascii=False)}\n\n"

        # 3. content_block_delta(逐 token)
        final_usage: dict[str, Any] = {}
        try:
            async for event in llm_gateway.astream(messages, model=model, **kwargs):
                event_type = event.get("type", "")
                if event_type in ("chunk", "message"):
                    text = event.get("content", "")
                    if text:
                        delta = {
                            "type": "content_block_delta",
                            "index": 0,
                            "delta": {"type": "text_delta", "text": text},
                        }
                        yield f"event: content_block_delta\ndata: {json.dumps(delta, ensure_ascii=False)}\n\n"
                elif event_type == "done":
                    final_usage = event.get("usage", {})
                elif event_type == "error":
                    err_evt = {
                        "type": "error",
                        "error": {"type": "api_error", "message": event.get("message", "LLM 流式调用失败")},
                    }
                    yield f"event: error\ndata: {json.dumps(err_evt, ensure_ascii=False)}\n\n"
                    return
        except Exception as e:
            err_evt = {
                "type": "error",
                "error": {"type": "api_error", "message": str(e)[:500]},
            }
            yield f"event: error\ndata: {json.dumps(err_evt, ensure_ascii=False)}\n\n"
            return

        # 4. content_block_stop
        block_stop = {"type": "content_block_stop", "index": 0}
        yield f"event: content_block_stop\ndata: {json.dumps(block_stop, ensure_ascii=False)}\n\n"

        # 5. message_delta(stop_reason + usage)
        usage = final_usage or {}
        out_tokens = usage.get("completion_tokens", 0)
        msg_delta = {
            "type": "message_delta",
            "delta": {"stop_reason": "end_turn"},
            "usage": {"output_tokens": out_tokens},
        }
        yield f"event: message_delta\ndata: {json.dumps(msg_delta, ensure_ascii=False)}\n\n"

        # 6. message_stop
        msg_stop = {"type": "message_stop"}
        yield f"event: message_stop\ndata: {json.dumps(msg_stop, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _gemini_streaming_response(
    messages: list[dict[str, Any]], model: str, kwargs: dict[str, Any]
) -> StreamingResponse:
    """构造 Gemini generateContent SSE 流式响应(对齐 Gemini Streaming)。

    SSE 格式:
        data: {"candidates":[{"content":{"parts":[{"text":"..."}],"role":"model"},"index":0}]}

    最后一个 chunk 含 finishReason + usageMetadata。
    """
    async def gen() -> AsyncIterator[str]:
        final_usage: dict[str, Any] = {}
        try:
            async for event in llm_gateway.astream(messages, model=model, **kwargs):
                event_type = event.get("type", "")
                if event_type in ("chunk", "message"):
                    text = event.get("content", "")
                    if text:
                        chunk_data = {
                            "candidates": [{
                                "content": {"parts": [{"text": text}], "role": "model"},
                                "index": 0,
                            }],
                        }
                        yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
                elif event_type == "done":
                    final_usage = event.get("usage", {})
                elif event_type == "error":
                    err_data = {
                        "error": {"code": 502, "message": event.get("message", "LLM 流式调用失败"), "status": "INTERNAL"},
                    }
                    yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"
                    return
        except Exception as e:
            err_data = {
                "error": {"code": 502, "message": str(e)[:500], "status": "INTERNAL"},
            }
            yield f"data: {json.dumps(err_data, ensure_ascii=False)}\n\n"
            return

        # 最后一个 chunk:含 finishReason + usageMetadata
        usage = final_usage or {}
        final_chunk = {
            "candidates": [{
                "content": {"parts": [{"text": ""}], "role": "model"},
                "finishReason": "STOP",
                "index": 0,
            }],
            "usageMetadata": {
                "promptTokenCount": usage.get("prompt_tokens", 0),
                "candidatesTokenCount": usage.get("completion_tokens", 0),
                "totalTokenCount": usage.get("total_tokens", 0),
            },
        }
        yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/llm/anthropic/v1/messages", response_model=None)
async def anthropic_messages_endpoint(request: Request) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Anthropic Messages 协议端点(对齐 OmniRoute 协议互转)。

    客户端可直接用 Anthropic 官方 SDK:
        from anthropic import Anthropic
        client = Anthropic(api_key="ihui-relay-key", base_url="http://ai-service:8800/llm/anthropic")
        resp = client.messages.create(model="claude-3.5-sonnet", max_tokens=1024, messages=[...])

    内部流程:
    1. 接收 Anthropic Messages 格式 payload
    2. ProtocolAdapter 转成 OpenAI Chat Completions 格式
    3. 调 llm_gateway.complete()(享受 Combo fallback / provider 适配器 / stub 降级)
    4. 响应用 ProtocolAdapter 转回 Anthropic Messages 格式
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"type": "error", "error": {"type": "service_unavailable", "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"type": "error", "error": {"type": "invalid_request", "message": f"JSON 解析失败: {e}"}},
        )

    # Anthropic → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.ANTHROPIC, ProtocolType.OPENAI
    )
    model = openai_req.get("model") or payload.get("model") or settings.litellm_model
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "tool_choice", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]

    # streaming 模式:调 llm_gateway.astream() + Anthropic SSE 事件格式输出
    if bool(payload.get("stream", False)):
        return _anthropic_streaming_response(messages, model, kwargs)

    result = await llm_gateway.complete(messages, model=model, **kwargs)
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        return JSONResponse(
            status_code=502,
            content={
                "type": "error",
                "error": {"type": "api_error", "message": err_msg},
            },
        )

    # OpenAI 响应 → Anthropic 响应
    openai_resp = {
        "id": f"msg_{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "model": result.get("model", model),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls"),
            },
            "finish_reason": "stop",
        }],
        "usage": result.get("usage", {}),
    }
    anthropic_resp = protocol_converter.convert_response(
        openai_resp, ProtocolType.OPENAI, ProtocolType.ANTHROPIC
    )
    return anthropic_resp


@router.post("/llm/gemini/v1beta/models/{model_name}:generateContent", response_model=None)
async def gemini_generate_content_endpoint(
    model_name: str,
    request: Request,
) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Gemini generateContent 协议端点(对齐 OmniRoute 协议互转)。

    客户端可直接用 Google Gen AI SDK:
        from google import genai
        client = genai.Client(api_key="ihui-relay-key", http_options={"base_url": "http://ai-service:8800/llm/gemini"})
        resp = client.models.generate_content(model="gemini-1.5-pro", contents="Hello")

    内部流程:
    1. 接收 Gemini generateContent 格式 payload
    2. ProtocolAdapter 转成 OpenAI Chat Completions 格式
    3. 调 llm_gateway.complete()(stream=true 时调 astream)
    4. 响应用 ProtocolAdapter 转回 Gemini generateContent 格式
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"error": {"code": 503, "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": 400, "message": f"JSON 解析失败: {e}"}},
        )

    # Gemini → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.GEMINI, ProtocolType.OPENAI
    )
    # Gemini 的 model 在 URL path 中,需要补回
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]
    # topP → top_p(OpenAI 命名)
    if "topP" in payload.get("generationConfig", {}):
        kwargs["top_p"] = payload["generationConfig"]["topP"]

    # streaming 模式:调 llm_gateway.astream() + Gemini SSE 格式输出
    if bool(payload.get("stream", False)):
        return _gemini_streaming_response(messages, model_name, kwargs)

    result = await llm_gateway.complete(messages, model=model_name, **kwargs)
    if result.get("error"):
        err_msg = str(result.get("error_message") or "LLM 调用失败")
        return JSONResponse(
            status_code=502,
            content={"error": {"code": 502, "message": err_msg, "status": "INTERNAL"}},
        )

    # OpenAI 响应 → Gemini 响应
    openai_resp = {
        "object": "chat.completion",
        "model": result.get("model", model_name),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls"),
            },
            "finish_reason": "stop",
        }],
        "usage": result.get("usage", {}),
    }
    gemini_resp = protocol_converter.convert_response(
        openai_resp, ProtocolType.OPENAI, ProtocolType.GEMINI
    )
    return gemini_resp


@router.post("/llm/gemini/v1beta/models/{model_name}:streamGenerateContent", response_model=None)
async def gemini_stream_generate_content_endpoint(
    model_name: str,
    request: Request,
) -> dict[str, Any] | JSONResponse | StreamingResponse:
    """Gemini streamGenerateContent 协议端点(强制流式,对齐 Gemini SDK streaming)。

    客户端可直接用 Google Gen AI SDK 的 stream 参数:
        from google import genai
        client = genai.Client(api_key="ihui-relay-key", http_options={"base_url": "http://ai-service:8800/llm/gemini"})
        resp = client.models.generate_content(model="gemini-1.5-pro", contents="Hello", stream=True)

    内部流程与 :generateContent 一致,但始终走流式输出(Gemini SSE 格式)。
    """
    try:
        from ..services.protocol_adapter import (
            ProtocolType,
            protocol_converter,
        )
    except ImportError as e:
        logger.error("ProtocolAdapter 加载失败: %s", e)
        return JSONResponse(
            status_code=503,
            content={"error": {"code": 503, "message": "ProtocolAdapter unavailable"}},
        )

    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": 400, "message": f"JSON 解析失败: {e}"}},
        )

    # Gemini → OpenAI
    openai_req = protocol_converter.convert_request(
        payload, ProtocolType.GEMINI, ProtocolType.OPENAI
    )
    messages = openai_req.get("messages", [])
    kwargs: dict[str, Any] = {}
    for k in ("tools", "temperature", "max_tokens"):
        if k in openai_req:
            kwargs[k] = openai_req[k]
    if "topP" in payload.get("generationConfig", {}):
        kwargs["top_p"] = payload["generationConfig"]["topP"]

    return _gemini_streaming_response(messages, model_name, kwargs)


@router.get("/llm/free-providers", response_model=None)
async def list_free_providers() -> dict[str, Any]:
    """免费 provider 注册表(对齐 OmniRoute 免费 provider 矩阵 + 超越)。

    返回 30+ 免费 LLM provider 的申请入口、免费额度、限制、key 配置状态,
    供前端 Dashboard 可视化展示"已配置 / 未配置 / 本地"三态。

    超越 OmniRoute 的点:
    - 本地 LLM 兜底(Ollama / LMStudio / LlamaCpp / vLLM)
    - 国内 provider 全覆盖(中文场景优化)
    - key 状态感知(从 .env 检测)
    """
    try:
        from ..services.free_provider_registry import free_provider_registry
    except ImportError as e:
        logger.error("FreeProviderRegistry 加载失败: %s", e)
        return _wrap_ok({"providers": [], "total": 0, "configured": 0, "local": 0, "not_configured": 0})

    providers = free_provider_registry.to_dashboard_dict()
    configured = sum(1 for p in providers if p["status"] == "configured")
    local_count = sum(1 for p in providers if p["status"] == "local")
    return _wrap_ok({
        "providers": providers,
        "total": len(providers),
        "configured": configured,
        "local": local_count,
        "not_configured": len(providers) - configured - local_count,
    })


# ============================================================================
# P0-3 网关 Dashboard 后端 API(2026-07-30 立,对齐 OmniRoute Dashboard + 超越)
#
# 暴露 provider 健康状态 + combo 链 CRUD,供前端 Dashboard 可视化展示:
# - GET    /llm/providers/health  — 所有免费 provider 健康状态(含 429 冷却期)
# - GET    /llm/combos            — 列出所有 combo 链配置
# - POST   /llm/combos            — 创建/更新 combo 链配置
# - DELETE /llm/combos/{name}     — 删除 combo 链配置
# ============================================================================


def _aggregate_provider_health(default_models: list[str]) -> tuple[bool, int]:
    """聚合 provider 在 ComboRouter 中的健康状态。

    遍历 provider 的 default_models,检查是否有任一 model 在 combo_router._health 中,
    聚合 is_in_cooldown(任一 model 在冷却期则 True)和 consecutive_failures(取最大值)。

    Args:
        default_models: provider 的推荐免费模型列表。

    Returns:
        (is_in_cooldown, consecutive_failures) 二元组。
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError:
        return (False, 0)

    is_in_cooldown = False
    max_failures = 0
    for model in default_models:
        health = combo_router._health.get(model)
        if health is not None:
            if health.is_in_cooldown():
                is_in_cooldown = True
            max_failures = max(max_failures, health.consecutive_failures)
    return (is_in_cooldown, max_failures)


@router.get("/llm/providers/health", response_model=None)
async def list_providers_health() -> dict[str, Any]:
    """所有已配置 provider 的实时健康状态(主动预检,供 Dashboard 可视化)。

    2026-07-31 P0 Phase B 升级:从静态注册表读取改为主动预检 —
    对每个已配置 api_key 的 provider 并发发 GET {api_base}/models 验证 key 有效性。

    返回结构(_wrap_ok 信封):
    {
      "code": 0,
      "data": {
        "providers": [
          {
            "provider": "openai",
            "status": "ok"|"invalid_key"|"unreachable",
            "latency_ms": 123,
            "model_count": 42,
            "last_check": "2026-07-31T12:00:00Z",
            "display_name": "OpenAI",        // 从 free_provider_registry 注入
            "category": "international",      // domestic/international/local/credits
            "free_quota": "$5 credits",
            "default_models": ["gpt-4o"],
            "default_base_url": "https://api.openai.com/v1",
            "is_in_cooldown": false,
            "consecutive_failures": 0
          }
        ],
        "summary": {
          "total": 5, "ok": 3, "invalid_key": 1, "unreachable": 1,
          "configured": 4, "local": 0, "not_configured": 0  // 兼容旧 Dashboard
        }
      }
    }

    status 判定:
    - HTTP 200 → ok(从响应 data 数组长度取 model_count)
    - HTTP 401/403 → invalid_key(key 无效或过期)
    - 连接失败/超时/其他 HTTP 错误 → unreachable

    display_name/category/free_quota/default_models/default_base_url 从
    free_provider_registry 推断;provider 不在 registry 中时设为空字符串/空数组。
    is_in_cooldown/consecutive_failures 默认 False/0(新 schema 未实现 cooldown)。

    并发用 asyncio.gather,单 provider timeout=8s,总耗时 < 10s。
    仅检查 api_key + api_base 均非空的 provider(无 api_base 的标记 skipped_no_base)。
    """
    # 解析 LLM_PROVIDERS JSON,收集所有 api_key 非空的 provider
    try:
        providers_json = json.loads(settings.llm_providers) if settings.llm_providers else {}
    except (json.JSONDecodeError, TypeError):
        providers_json = {}
    if not isinstance(providers_json, dict):
        providers_json = {}

    # 收集待检查 provider(name → (api_key, api_base))
    to_check: list[tuple[str, str, str]] = []
    skipped_no_base: list[str] = []
    for name, cfg_raw in providers_json.items():
        if not isinstance(cfg_raw, dict):
            continue
        api_key = str(cfg_raw.get("api_key") or "").strip()
        if not api_key:
            continue  # 未配置 key 的 provider 不检查
        api_base = cfg_raw.get("api_base")
        api_base = str(api_base).strip() if api_base else ""
        if not api_base:
            skipped_no_base.append(name)
            continue
        to_check.append((name, api_key, api_base))

    # 并发预检所有 provider
    tasks = [_check_single_provider(name, api_key, api_base) for name, api_key, api_base in to_check]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    # 合并 skipped_no_base(无 api_base,无法预检)
    now_iso = datetime.now(timezone.utc).isoformat()
    for name in skipped_no_base:
        results.append({
            "provider": name,
            "status": "unreachable",
            "latency_ms": 0,
            "model_count": 0,
            "last_check": now_iso,
            "note": "no api_base configured, cannot pre-check",
        })

    # 汇总统计
    ok_count = sum(1 for r in results if r["status"] == "ok")
    invalid_count = sum(1 for r in results if r["status"] == "invalid_key")
    unreachable_count = sum(1 for r in results if r["status"] == "unreachable")

    # 补注入 free_provider_registry 展示字段(P0 Phase B,兼容旧 Dashboard 消费)。
    # 新 schema 主动预检只返回 status/latency_ms/model_count,旧 Dashboard 还需
    # display_name/category/free_quota/default_models/default_base_url 等字段渲染,
    # 不补回会导致前端网关 Dashboard 渲染 undefined。
    try:
        from ..services.free_provider_registry import free_provider_registry as _registry
    except ImportError:
        _registry = None  # type: ignore[assignment]
    for r in results:
        provider_code = str(r.get("provider") or "")
        info = _registry.get_by_code(provider_code) if _registry else None
        r["display_name"] = info.display_name if info else provider_code
        r["category"] = info.category.value if info else ""
        r["free_quota"] = info.free_quota if info else ""
        r["default_models"] = list(info.default_models) if info else []
        r["default_base_url"] = info.default_base_url if info else ""
        r["is_in_cooldown"] = False  # 新 schema 未实现 cooldown,默认 False
        r["consecutive_failures"] = 0  # 新 schema 未实现,默认 0

    return _wrap_ok({
        "providers": results,
        "summary": {
            "total": len(results),
            "ok": ok_count,
            "invalid_key": invalid_count,
            "unreachable": unreachable_count,
            # 兼容旧 Dashboard 统计字段(P0 Phase B)
            "configured": ok_count + invalid_count,  # 已配置 api_key 的(ok + invalid_key)
            "local": 0,  # 新 schema 无 local 概念
            "not_configured": 0,
        },
    })


async def _check_single_provider(
    provider_name: str, api_key: str, api_base: str
) -> dict[str, Any]:
    """对单个 provider 发 GET {api_base}/models 主动预检 key 有效性。

    Args:
        provider_name: provider 唯一标识(如 "openai" / "anthropic")。
        api_key: API 凭证。
        api_base: API endpoint URL(已去尾部 /)。

    Returns:
        {provider, status, latency_ms, model_count, last_check} 健康状态条目。
    """
    url = f"{api_base}/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    start = asyncio.get_event_loop().time()
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers=headers)
        latency_ms = int((asyncio.get_event_loop().time() - start) * 1000)
        now_iso = datetime.now(timezone.utc).isoformat()
        if resp.status_code == 200:
            # 从响应提取 model_count(OpenAI 兼容格式:{"data": [...]})
            model_count = 0
            try:
                body = resp.json()
                if isinstance(body, dict):
                    data = body.get("data")
                    if isinstance(data, list):
                        model_count = len(data)
                    elif isinstance(body.get("models"), list):
                        model_count = len(body["models"])
            except (json.JSONDecodeError, ValueError):
                pass
            return {
                "provider": provider_name,
                "status": "ok",
                "latency_ms": latency_ms,
                "model_count": model_count,
                "last_check": now_iso,
            }
        if resp.status_code in (401, 403):
            return {
                "provider": provider_name,
                "status": "invalid_key",
                "latency_ms": latency_ms,
                "model_count": 0,
                "last_check": now_iso,
            }
        # 其他 HTTP 错误(429/5xx 等)视为不可达
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "last_check": now_iso,
            "note": f"HTTP {resp.status_code}",
        }
    except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as e:
        latency_ms = int((asyncio.get_event_loop().time() - start) * 1000)
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "note": f"{type(e).__name__}: {str(e)[:100]}",
        }
    except Exception as e:
        latency_ms = int((asyncio.get_event_loop().time() - start) * 1000)
        return {
            "provider": provider_name,
            "status": "unreachable",
            "latency_ms": latency_ms,
            "model_count": 0,
            "last_check": datetime.now(timezone.utc).isoformat(),
            "note": f"{type(e).__name__}: {str(e)[:100]}",
        }


@router.get("/llm/combos", response_model=None)
async def list_combos() -> dict[str, Any]:
    """列出所有 combo 链配置。

    返回结构:
    {
      "combos": [
        {"name": "maximize-free", "strategy": "priority", "chain": [...], "judge": null, "description": "..."}
      ]
    }
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _wrap_ok({"combos": []})

    combos_data: list[dict[str, Any]] = []
    for c in combo_router.list_combos():
        combos_data.append({
            "name": c.name,
            "strategy": c.strategy.value,
            "chain": list(c.chain),
            "judge": c.judge,
            "description": c.description,
        })
    return _wrap_ok({"combos": combos_data})


class ComboConfigRequest(BaseModel):
    """Combo 链配置请求(创建/更新)。"""

    name: str = Field(..., description="链名(如 'maximize-free')")
    strategy: str = Field("priority", description="路由策略: priority/cheapest/fusion")
    chain: list[str] = Field(..., description="provider/model 列表")
    judge: str | None = Field(None, description="fusion 策略下的 judge model")
    description: str = Field("", description="人类可读描述")


@router.post("/llm/combos", response_model=None)
async def create_or_update_combo(req: ComboConfigRequest) -> dict[str, Any] | JSONResponse:
    """创建/更新 combo 链配置(管理端)。

    请求体:
    {"name": "maximize-quality", "strategy": "priority", "chain": ["claude-opus-4", "gpt-5"], "description": "..."}

    响应:
    {"ok": true, "combo": {...}}
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _error_json("ComboRouter unavailable", 503)

    if not req.chain:
        return _error_json("chain must not be empty", 400)

    config: dict[str, Any] = {
        "strategy": req.strategy,
        "chain": req.chain,
        "description": req.description,
    }
    if req.judge:
        config["judge"] = req.judge

    combo_router.configure_combo(req.name, config)
    combo = combo_router.get_combo(req.name)
    if combo is None:
        return _error_json("configure_combo failed silently", 500)
    return _wrap_ok({
        "ok": True,
        "combo": {
            "name": combo.name,
            "strategy": combo.strategy.value,
            "chain": list(combo.chain),
            "judge": combo.judge,
            "description": combo.description,
        },
    })


@router.delete("/llm/combos/{name}", response_model=None)
async def delete_combo(name: str) -> dict[str, Any] | JSONResponse:
    """删除 combo 链配置。

    响应:
    {"ok": true, "name": "maximize-free"}
    """
    try:
        from ..services.combo_router import combo_router
    except ImportError as e:
        logger.error("ComboRouter 加载失败: %s", e)
        return _error_json("ComboRouter unavailable", 503)

    if name not in combo_router._combos:
        return _error_json(f"combo '{name}' not found", 404)
    del combo_router._combos[name]
    return _wrap_ok({"ok": True, "name": name})


# =============================================================================
# Token 压缩演示端点(P3-1,token_compaction.py 集成配套)
# 提供 POST /llm/compaction/demo 供前端 Dashboard 手动触发压缩并查看效果,
# 与 llm_gateway._apply_token_compaction 内部自动压缩使用同一个 token_compactor 单例。
# =============================================================================


class CompactionDemoRequest(BaseModel):
    """Token 压缩演示请求体。"""

    messages: list[dict[str, Any]] = Field(
        ..., description="OpenAI 格式消息列表([{role, content, ...}])"
    )
    strategy: str = Field(
        "rtk_caveman",
        description="压缩策略:rtk / caveman / rtk_caveman(默认 rtk_caveman)",
    )
    keep_recent: int = Field(
        6,
        ge=0,
        le=100,
        description="Caveman 策略保留最近 N 条不压缩(0-100,默认 6)",
    )


# 策略字符串 → CompactionStrategy 枚举映射(无效值返回 400)
_STRATEGY_MAP: dict[str, str] = {
    "rtk": "rtk",
    "caveman": "caveman",
    "rtk_caveman": "rtk_caveman",
}


@router.post("/llm/compaction/demo", response_model=None)
async def compaction_demo(
    req: CompactionDemoRequest,
    request: Request,
) -> dict[str, Any] | JSONResponse:
    """Token 压缩演示端点(供前端 Dashboard 手动触发并查看压缩效果)。

    请求体:
    ```json
    {
      "messages": [{"role": "user", "content": "..."}],
      "strategy": "rtk_caveman",
      "keep_recent": 6
    }
    ```

    响应:
    ```json
    {
      "original_tokens": 1234,
      "compressed_tokens": 123,
      "compression_ratio": 0.9,
      "strategy": "rtk_caveman",
      "rtk_map_size": 5,
      "compressed_messages": [{"role": "user", "content": "..."}],
      "decompressed_messages": [{"role": "user", "content": "..."}]
    }
    ```

    错误:
    - 400: messages 为空 / strategy 无效
    - 500: 内部异常

    注:跳过 ResponseSanitizer 中间件 — 响应仅含 token 计数和压缩后消息,
    无敏感数据;字段名 original_tokens / compressed_tokens 含 "token" 子串,
    否则会被脱敏为 "***"(SAFE_KEYS 白名单只覆盖 prompt_tokens / completion_tokens / total_tokens)。
    """
    # 跳过响应脱敏(本端点响应无敏感字段,token 计数需保留为 int 供前端展示)
    request.state.skip_response_sanitization = True

    # 空消息检查
    if not req.messages:
        return _error_json("messages must not be empty", 400)

    # 策略校验:字符串 → CompactionStrategy 枚举
    strategy_str = req.strategy.lower().strip()
    if strategy_str not in _STRATEGY_MAP:
        return _error_json(
            f"invalid strategy '{req.strategy}', must be one of: rtk / caveman / rtk_caveman",
            400,
        )

    try:
        from ..services.token_compaction import (
            CompactionStrategy,
            TokenCompactor,
            token_compactor,
        )
    except ImportError as e:
        logger.error("token_compaction 模块加载失败: %s", e)
        return _error_json(f"token_compaction module unavailable: {e}", 500)

    # 策略字符串 → 枚举值(已在 _STRATEGY_MAP 校验过,直接对应)
    strategy_enum = CompactionStrategy(strategy_str)

    try:
        result = token_compactor.compact_messages(
            req.messages, strategy=strategy_enum, keep_recent=req.keep_recent
        )
        # 解压:还原 RTK 占位符($N → 原文),Caveman 不可逆
        decompressed = TokenCompactor.decompress(result)
        return _wrap_ok({
            "original_tokens": result.original_tokens,
            "compressed_tokens": result.compressed_tokens,
            "compression_ratio": result.compression_ratio,
            "strategy": strategy_str,
            "rtk_map_size": len(result.rtk_map),
            "compressed_messages": result.compressed_messages,
            "decompressed_messages": decompressed,
        })
    except Exception as e:
        logger.exception("compaction_demo 内部异常: %s", e)
        return _error_json(f"compaction failed: {type(e).__name__}: {e}", 500)
