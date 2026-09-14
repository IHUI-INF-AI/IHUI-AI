# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Conversation service — 对话编排服务。

完整的对话业务流程:
1. intent_classify: 意图分类(LLM 分析用户输入,识别 intent + entities + 需要 tool)
2. tool_select:     工具选择(基于意图 + 可用 tools 列表,选最相关的 N 个)
3. llm_call:       LLM 调用(OpenAI tools 格式,带 function calling)
4. tool_execute:   工具执行(解析 LLM 返回的 tool_calls,调用 MCP tools)
5. response:       汇总回复(把 tool 结果回灌 LLM,生成最终回复)

支持:
- 单轮对话(无 tool 走默认路径)
- 多轮 tool loop(LLM 决定调用工具 → 工具执行 → 结果回灌 → 再次 LLM)
- 滑动窗口 + intent 增强的 system prompt
- 完整 trace(每个阶段的耗时/输入/输出)
- stub 降级(无 API key 时返回固定响应)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any

from ..core.conversation_intent import (
    classify_intent,
)
from ..core.conversation_media_routing import (
    MAX_PARALLEL_TOOL_CALLS,
    _MEDIA_INTENT_PATTERNS,
    _MEDIA_CHAIN_PROMPT,
    _MEDIA_RENDER_PROMPT,
    _RETRYABLE_TOOLS,
    _WEB_INTENT_PATTERNS,
    _WEB_RENDER_PROMPT,
    _media_artifact_summary,
    _resolve_user_id,
)
from ..core.conversation_models import (
    INTENT_LABELS,
    ConversationResult,
    IntentResult,
    ToolCallRecord,
)
from ..core.conversation_tools import (
    DEFAULT_TOOL_KEYWORDS,
    filter_tools,
    keyword_tool_select,
    media_intent_tools,
    web_intent_tools,
)
from ..core.llm_gateway import llm_gateway
from .mcp_server import mcp_server
from .memory import memory_store

logger = logging.getLogger(__name__)


async def _execute_tool_call(
    tool_name: str, args: dict[str, Any]
) -> tuple[dict[str, Any], float]:
    """执行单个工具调用,返回 (result, duration_ms)。

    - 幂等只读工具首次失败时重试 1 次(写操作工具不重试)。
    - 异常归一化为 {"ok": False} 不向外抛 —— 保证并行批次中单工具失败
      不中断整体(asyncio.gather(return_exceptions=True) 兜底)。
    """

    async def _once() -> tuple[dict[str, Any], float]:
        t1 = time.monotonic()
        try:
            result = await mcp_server.call_tool(tool_name, args)
        except Exception as e:
            result = {"ok": False, "error": f"工具 {tool_name} 执行失败: {e}"}
        return result, round((time.monotonic() - t1) * 1000, 2)

    result, duration_ms = await _once()
    if not result.get("ok") and tool_name in _RETRYABLE_TOOLS:
        logger.debug("工具 %s 首次执行失败,重试 1 次: %s", tool_name, result.get("error"))
        retry_result, retry_ms = await _once()
        result = retry_result
        duration_ms += retry_ms
    return result, duration_ms


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ConversationService:
    """对话编排服务。"""

    def __init__(self) -> None:
        # 工具 → 关键词映射(用于无 LLM 时的快速工具选择)
        self._tool_keywords: dict[str, list[str]] = DEFAULT_TOOL_KEYWORDS

    # =========================================================================
    # 公共 API
    # =========================================================================

    async def chat(
        self,
        user_input: str,
        session_id: str | None = None,
        model: str | None = None,
        allowed_tools: list[str] | None = None,
        max_iterations: int = 3,
    ) -> ConversationResult:
        """完整对话流程:intent → tool select → LLM → tool exec → response。

        Args:
            user_input: 用户输入。
            session_id: 会话 ID(为空则新建)。
            model: 模型名称(空用默认)。
            allowed_tools: 允许的工具列表(空则尝试自动选择)。
            max_iterations: tool loop 最大迭代次数。

        Returns:
            ConversationResult 包含完整 trace + 最终回复。
        """
        start = time.monotonic()
        sid = session_id or f"conv-{int(datetime.utcnow().timestamp())}"
        trace: list[dict[str, Any]] = []
        iterations = 0
        tool_calls: list[ToolCallRecord] = []
        stub = False
        intent = IntentResult(intent="other", confidence=0.0)
        used_model = model or "default"
        final_response = ""

        try:
            # 1. 写入用户消息到记忆
            try:
                await memory_store.add(sid, "user", user_input)
            except Exception as e:
                logger.warning("memory_store.add user 消息失败: %s", e)

            # 2. 意图分类
            t0 = time.monotonic()
            intent = await classify_intent(
                user_input, model=model, tool_keywords=self._tool_keywords
            )
            trace.append({
                "node": "intent_classify",
                "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                "intent": intent.intent,
                "needs_tool": intent.needs_tool,
            })

            # 3. 工具选择
            t0 = time.monotonic()
            tools: list[dict[str, Any]] = []
            media_tools: list[str] = []
            web_tools: list[str] = []
            if allowed_tools is not None:
                tools = filter_tools(allowed_tools)
            elif intent.needs_tool and intent.suggested_tools:
                tools = filter_tools(intent.suggested_tools)
            elif intent.needs_tool:
                # 关键词 fallback
                guessed = keyword_tool_select(user_input, self._tool_keywords)
                tools = filter_tools(guessed)
            else:
                # 全模态自动路由(2026-09-08):intent 未判 needs_tool 但媒体强信号命中
                # → 直接注入对应媒体工具(自动切换多模态调用)
                media_tools = media_intent_tools(user_input)
                # Firecrawl web 自动路由(2026-09-09 极致融合补齐):URL 抓取/整站/结构化意图
                web_tools = web_intent_tools(user_input)
                if media_tools or web_tools:
                    tools = filter_tools(media_tools + web_tools)
            # intent 已选工具时补并媒体/web 预路由命中项(去重),防 LLM 分类漏判
            if allowed_tools is None and not (media_tools or web_tools):
                media_tools = media_intent_tools(user_input)
                web_tools = web_intent_tools(user_input)
                existing = {t.get("function", {}).get("name") for t in tools}
                extra = [m for m in media_tools + web_tools if m not in existing]
                if extra:
                    tools.extend(filter_tools(extra))
            trace.append({
                "node": "tool_select",
                "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                "tool_count": len(tools),
                "tool_names": [t.get("function", {}).get("name") for t in tools],
                **({"media_routed": media_tools} if media_tools else {}),
                **({"web_routed": web_tools} if web_tools else {}),
            })

            # 4. 加载历史上下文
            history = await memory_store.get(sid, limit=20)
            messages: list[dict[str, Any]] = []
            # 工具结果诚实报告指令:防止 LLM 在 tool 失败时幻觉"已完成"
            if tools:
                guidance = (
                    "你是一个能调用工具的 AI 助手。调用工具后,务必检查返回结果中的 ok 字段:\n"
                    "- ok=true:工具执行成功,可以告诉用户已完成\n"
                    "- ok=false:工具执行失败,必须如实告知用户失败原因"
                    "(包括 errorCode/error 字段),"
                    "禁止声称已完成或成功\n"
                    "常见失败场景:TARGET_NOT_CONNECTED(浏览器扩展/桌面端未连接)、TIMEOUT(执行超时)、"
                    "SELECTOR_NOT_FOUND(元素未找到)。遇到这些错误时,引导用户检查对应端是否已启动。"
                )
                # 媒体工具在场 → 追加 Markdown 渲染规范(图/音/视频对话即所得)
                _media_set = set(_MEDIA_INTENT_PATTERNS)
                if any(t.get("function", {}).get("name") in _media_set for t in tools):
                    guidance += "\n\n" + _MEDIA_RENDER_PROMPT + "\n\n" + _MEDIA_CHAIN_PROMPT
                # 网页工具在场 → 追加网页内容呈现规范(2026-09-09 极致融合补齐)
                _web_set = set(_WEB_INTENT_PATTERNS)
                if any(t.get("function", {}).get("name") in _web_set for t in tools):
                    guidance += "\n\n" + _WEB_RENDER_PROMPT
                messages.append({"role": "system", "content": guidance})
            # P0:用户画像 + 跨会话记忆注入(孤岛能力打通,与 v2 的 L1-1 记忆闭环一致;
            # 失败/拿不到 user_id 均降级不阻塞对话)
            try:
                user_id = _resolve_user_id(sid)
                if not user_id:
                    logger.debug(
                        "conversation 未解析到 user_id,跳过画像/长期记忆注入(sid=%s)", sid
                    )
                else:
                    parts: list[str] = []
                    try:
                        from .user_profile import user_profile_builder

                        profile_snippet = user_profile_builder.build_system_prompt_snippet(user_id)
                        if profile_snippet:
                            parts.append(profile_snippet)
                    except Exception as e:
                        logger.warning(
                            "user_profile.build_system_prompt_snippet 失败(降级,不阻塞): %s", e
                        )
                    try:
                        from .memory_service import memory_service as _memory_svc

                        memory_ctx = await _memory_svc.load_context_for_conversation(
                            user_id=user_id,
                            session_id=sid,
                        )
                        if memory_ctx:
                            parts.append(memory_ctx)
                    except Exception as e:
                        logger.warning(
                            "memory_service.load_context_for_conversation 失败(降级,不阻塞): %s", e
                        )
                    if parts:
                        snippet = "\n\n".join(parts)
                        if messages and messages[0].get("role") == "system":
                            existing = messages[0].get("content", "")
                            messages[0]["content"] = (
                                f"{existing}\n\n{snippet}" if existing else snippet
                            )
                        else:
                            messages.insert(0, {"role": "system", "content": snippet})
            except Exception as e:
                logger.warning("conversation 画像/记忆注入失败(降级,不阻塞): %s", e)
            for m in history[:-1]:  # 排除最后一条刚加入的 user
                role = m.get("role")
                content = m.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": user_input})

            # 5. Tool loop
            for it in range(max_iterations):
                iterations = it + 1
                t0 = time.monotonic()
                call_kwargs: dict[str, Any] = {}
                if tools:
                    call_kwargs["tools"] = tools
                    call_kwargs["tool_choice"] = "auto"
                result = await llm_gateway.complete(
                    messages, model=model, **call_kwargs
                )
                used_model = result.get("model", used_model)
                stub = result.get("stub", False) or stub

                # P0-7: LLM error 字段检查 — 不把 error 响应当正常回复
                if result.get("error"):
                    err_msg = result.get("error_message", "未知错误")
                    logger.warning(
                        "LLM 调用失败: %s, model=%s, iter=%d",
                        err_msg, used_model, iterations,
                    )
                    trace.append({
                        "node": "llm_call",
                        "iteration": iterations,
                        "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                        "model": used_model,
                        "stub": stub,
                        "error": True,
                        "error_message": err_msg,
                    })
                    final_response = f"[LLM 调用失败] {err_msg}"
                    break

                content = str(result.get("content", "") or "")
                tool_calls_raw = result.get("tool_calls") or []

                trace.append({
                    "node": "llm_call",
                    "iteration": iterations,
                    "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                    "model": used_model,
                    "stub": stub,
                    "tool_call_count": len(tool_calls_raw),
                })

                # 5.1 无 tool_call:最终回复
                if not tool_calls_raw:
                    final_response = content
                    break

                # 5.2 把 assistant 消息(含 tool_calls)加入上下文
                messages.append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls_raw,
                })

                # 5.3 解析并执行 tool_calls —— P1-2:同轮独立工具并行执行(无依赖假设)
                # 结果回灌顺序必须与 tool_calls_raw 顺序一致(LLM 依赖顺序结构),仅执行并发;
                # 单工具失败不整体中断,失败项独立标注(见下方回灌错误处理)。
                parsed_calls: list[tuple[dict[str, Any], str, dict[str, Any]]] = []
                for tc in tool_calls_raw:
                    if not isinstance(tc, dict):
                        continue
                    fn = tc.get("function") or {}
                    tool_name = fn.get("name", "")
                    raw_args = fn.get("arguments", "")
                    if isinstance(raw_args, str):
                        try:
                            args = json.loads(raw_args) if raw_args.strip() else {}
                        except (json.JSONDecodeError, ValueError):
                            args = {"_raw": raw_args}
                    else:
                        args = raw_args or {}
                    parsed_calls.append((tc, tool_name, args))

                # 并行执行,单轮最大 MAX_PARALLEL_TOOL_CALLS,超出分批 gather
                round_exec: list[
                    tuple[dict[str, Any], str, dict[str, Any], dict[str, Any], float]
                ] = []
                for i in range(0, len(parsed_calls), MAX_PARALLEL_TOOL_CALLS):
                    batch = parsed_calls[i:i + MAX_PARALLEL_TOOL_CALLS]
                    outcomes = await asyncio.gather(
                        *(_execute_tool_call(name, args) for _, name, args in batch),
                        return_exceptions=True,
                    )
                    for (tc, tool_name, args), outcome in zip(batch, outcomes, strict=True):
                        if isinstance(outcome, BaseException):
                            # 防御:helper 已归一化,理论上到不了这里
                            exec_result = {
                                "ok": False,
                                "error": f"工具 {tool_name} 执行失败: {outcome}",
                            }
                            duration_ms = 0.0
                        else:
                            exec_result, duration_ms = outcome
                        round_exec.append((tc, tool_name, args, exec_result, duration_ms))

                for tc, tool_name, args, exec_result, duration_ms in round_exec:
                    ok = bool(exec_result.get("ok"))
                    record = ToolCallRecord(
                        tool=tool_name,
                        arguments=args,
                        result=exec_result,
                        ok=ok,
                        duration_ms=duration_ms,
                    )
                    tool_calls.append(record)
                    # P0-7: 工具失败时在 trace 显式记录 _tool_error
                    tool_trace: dict[str, Any] = {
                        "node": "tool_execute",
                        "tool": tool_name,
                        "ok": ok,
                        "duration_ms": record.duration_ms,
                    }
                    if len(round_exec) > 1:
                        tool_trace["parallel"] = True
                    if not ok:
                        tool_trace["_tool_error"] = (
                            exec_result.get("error")
                            or exec_result.get("message")
                            or "tool execution failed"
                        )
                    trace.append(tool_trace)

                    # 把工具结果回灌 — 失败时显式标注,防止 LLM 幻觉"已完成"
                    result_json = json.dumps(exec_result, ensure_ascii=False)[:4000]
                    if not ok:
                        err_detail = (
                            exec_result.get("error")
                            or exec_result.get("message")
                            or "unknown error"
                        )
                        err_code = exec_result.get("errorCode", "UNKNOWN")
                        # 嵌入 result.result 兼容 agent_control 返回格式
                        inner = exec_result.get("result", {})
                        if isinstance(inner, dict) and inner.get("errorCode"):
                            err_code = inner.get("errorCode", err_code)
                            err_detail = inner.get("error", err_detail)
                        result_json = (
                            f"TOOL EXECUTION FAILED. errorCode={err_code}. error={err_detail}. "
                            f"You MUST tell the user the tool failed and suggest checking if the "
                            f"browser extension / desktop app is running. "
                            f"Do NOT claim success. Raw result: {result_json}"
                        )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "name": tool_name,
                        "content": result_json,
                    })

                # 5.3.1 全部 tool 失败时直接构造失败响应,不让 LLM 总结(防止幻觉"已完成")
                round_calls = tool_calls[-len(round_exec):] if round_exec else []
                if round_calls and all(not tc.ok for tc in round_calls):
                    failed_details = []
                    for tc in round_calls:
                        inner = tc.result.get("result", {})
                        err_code = (
                            inner.get("errorCode", tc.result.get("errorCode", "UNKNOWN"))
                            if isinstance(inner, dict)
                            else "UNKNOWN"
                        )
                        err_msg = (
                            inner.get("error", tc.result.get("error", "unknown"))
                            if isinstance(inner, dict)
                            else "unknown"
                        )
                        failed_details.append(f"- {tc.tool}: {err_code} — {err_msg}")
                    final_response = (
                        "工具执行失败,未能完成您的请求:\n" + "\n".join(failed_details) + "\n\n"
                        "可能的原因:\n"
                        "- TARGET_NOT_CONNECTED:浏览器扩展或桌面端未启动,请确保对应端已打开并登录\n"
                        "- TIMEOUT:操作超时,请稍后重试\n"
                        "- SELECTOR_NOT_FOUND:页面元素未找到,请检查选择器是否正确\n"
                    )
                    trace.append({
                        "node": "all_tools_failed",
                        "failed_count": len(round_calls),
                        "skipped_llm_summarize": True,
                    })
                    break

                # 5.4 最后一轮不再继续
                if it == max_iterations - 1:
                    # 让 LLM 总结工具结果
                    summary = await llm_gateway.complete(messages, model=model)
                    # P0-7: summarize 调用检查 error
                    if summary.get("error"):
                        err_msg = summary.get("error_message", "未知错误")
                        logger.warning(
                            "LLM summarize 失败: %s, model=%s",
                            err_msg, used_model,
                        )
                        trace.append({
                            "node": "llm_summarize",
                            "duration_ms": 0.0,
                            "stub": summary.get("stub", False),
                            "error": True,
                            "error_message": err_msg,
                        })
                        # final_response 保留之前的 content 或设置错误提示
                        if not final_response:
                            final_response = f"[LLM 摘要失败] {err_msg}"
                    else:
                        final_response = str(summary.get("content", "") or "")
                        stub = stub or summary.get("stub", False)
                        trace.append({
                            "node": "llm_summarize",
                            "duration_ms": 0.0,
                            "stub": summary.get("stub", False),
                        })
                    break

            # 6. 写入 assistant 响应
            try:
                await memory_store.add(sid, "assistant", final_response)
            except Exception as e:
                logger.warning("memory_store.add assistant 响应失败: %s", e)
            # 6.1 媒体产物记忆延续(2026-09-09 全模态深度适配):
            # 把本轮成功媒体工具的 task_id/媒体 URL/文本摘录压成一条摘要写入
            # 记忆(assistant role,history 读取可见)→ 下一轮取件/续作能接上下文。
            try:
                media_note = _media_artifact_summary(tool_calls)
                if media_note:
                    await memory_store.add(sid, "assistant", media_note)
            except Exception as e:
                logger.warning("媒体产物摘要写入记忆失败(降级,不阻塞): %s", e)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("对话编排失败: %s", e)
            final_response = f"[对话编排失败] {e}"

        return ConversationResult(
            session_id=sid,
            user_input=user_input,
            intent=intent,
            tool_calls=tool_calls,
            final_response=final_response,
            model=used_model,
            iterations=iterations,
            duration_ms=round((time.monotonic() - start) * 1000, 2),
            stub=stub,
            trace=trace,
        )

    # =========================================================================
    # 私有:序列化
    # =========================================================================

    @staticmethod
    def result_to_dict(result: ConversationResult) -> dict[str, Any]:
        """将 ConversationResult 序列化为可 JSON 化的 dict。"""
        return {
            "session_id": result.session_id,
            "user_input": result.user_input,
            "intent": {
                "intent": result.intent.intent,
                "confidence": result.intent.confidence,
                "entities": result.intent.entities,
                "reasoning": result.intent.reasoning,
                "needs_tool": result.intent.needs_tool,
                "suggested_tools": result.intent.suggested_tools,
            },
            "tool_calls": [
                {
                    "tool": tc.tool,
                    "arguments": tc.arguments,
                    "ok": tc.ok,
                    "duration_ms": tc.duration_ms,
                    "result_preview": str(tc.result)[:300],
                }
                for tc in result.tool_calls
            ],
            "final_response": result.final_response,
            "model": result.model,
            "iterations": result.iterations,
            "duration_ms": result.duration_ms,
            "stub": result.stub,
            "trace": result.trace,
        }


conversation_service = ConversationService()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
