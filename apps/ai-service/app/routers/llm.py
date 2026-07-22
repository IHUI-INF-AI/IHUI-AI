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
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.llm_gateway import llm_gateway, moa_router
from ..core.context_compaction import compress_messages_if_needed
from ..core.question_parser import QuestionStreamParser
from ..services.mcp_server import _tool_vision_analyze
from ..services.project_memory import build_system_prompt

router = APIRouter()
logger = logging.getLogger(__name__)

# 持有待完成的回调 task 引用,防止 CPython GC 回收未持有的 task
_pending_callbacks: set[asyncio.Task] = set()

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


@router.post("/llm/complete")
async def llm_complete(req: LLMCompleteRequest) -> dict[str, Any]:
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
    """返回可用模型列表。

    从 data/default_models.json 加载(支持热更新,无需重启),按 id 去重。
    stub 模式下返回默认列表。
    前端 /models 页面通过 API 代理调用此端点获取动态模型清单。
    """
    default_models = _load_default_models()
    return {
        "models": default_models,
        "default": settings.litellm_model,
        "stub_mode": llm_gateway._is_stub_mode(),
    }


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
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(req.messages, req.workspace_path)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    compaction_info: dict[str, Any] | None = None
    if req.context_limit and req.context_limit > 0:
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)

    # P1 流式配套 pre-flight check:检测 api_key 缺失(MODEL_NOT_CONFIGURED),
    # 在返回 StreamingResponse 前直接返回 422 JSON,避免流式开始后只能推 event: error。
    # stub 模式下无需 api_key(返回模拟响应),跳过 pre-flight。
    if not llm_gateway._is_stub_mode():
        try:
            _api_key, _, _ = await llm_gateway._resolve(req.model, owner_uuid)
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

    async def gen():
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
                    # ===== 多轮 tool loop(2026-07-22 升级,支持 AI 连续操作:截图→分析→点击→再截图)=====
                    # 每轮:complete(tools) → 执行 tool_calls → 回灌结果
                    # 直到 LLM 不再决策 tool_calls 或达到 max_iterations → 归一化 → astream 生成最终回复
                    max_iterations = 3
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

                            # 执行工具(异常保护:网络/超时/JSON 错误不应崩溃 SSE 流)
                            try:
                                exec_result = await _mcp.call_tool(tool_name, args)
                            except Exception as e:
                                logger.exception("Tool execution exception: %s", tool_name)
                                exec_result = {
                                    "tool": tool_name,
                                    "ok": False,
                                    "error": str(e)[:500],
                                    "errorCode": "EXECUTION_EXCEPTION",
                                    "message": f"工具执行异常: {type(e).__name__}",
                                }
                            ok = bool(exec_result.get("ok"))
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


@router.post("/llm/embeddings")
async def create_embeddings(req: EmbeddingsRequest) -> dict[str, Any]:
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
