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
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..core.llm_gateway import llm_gateway
from .memory import memory_store
from .mcp_server import mcp_server

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 意图枚举(对内,LLM 输出 + 后处理)
# ---------------------------------------------------------------------------

INTENT_LABELS = (
    "chat",        # 闲聊 / 一般对话
    "qa",          # 知识问答(基于上下文回答)
    "tool_use",    # 需要调用工具
    "code",        # 写代码 / 代码相关
    "analysis",    # 分析 / 调研
    "creative",    # 创意 / 写作
    "other",       # 其他
)


@dataclass
class IntentResult:
    """意图分类结果。"""

    intent: str
    confidence: float
    entities: dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""
    needs_tool: bool = False
    suggested_tools: list[str] = field(default_factory=list)


@dataclass
class ToolCallRecord:
    """单次工具调用记录。"""

    tool: str
    arguments: dict[str, Any]
    result: dict[str, Any]
    ok: bool
    duration_ms: float = 0.0


@dataclass
class ConversationResult:
    """对话完整结果。"""

    session_id: str
    user_input: str
    intent: IntentResult
    tool_calls: list[ToolCallRecord]
    final_response: str
    model: str
    iterations: int
    duration_ms: float
    stub: bool
    trace: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class ConversationService:
    """对话编排服务。"""

    def __init__(self) -> None:
        # 工具 → 关键词映射(用于无 LLM 时的快速工具选择)
        self._tool_keywords: dict[str, list[str]] = {
            "search_codebase": ["代码", "函数", "类", "符号", "code", "function", "class"],
            "search_web": ["搜索", "网页", "网上", "web", "search", "google"],
            "web_search": ["搜索", "网页", "web", "search"],
            "file_search": ["文件", "查找", "file", "search"],
            "read_file": ["读取", "打开", "read", "view"],
            "write_file": ["写入", "保存", "write", "save"],
            "analyze_code": ["分析", "静态", "analyze", "review"],
            "generate_test": ["测试", "test", "pytest", "unittest"],
            "git_operations": ["git", "提交", "commit", "diff", "log", "branch"],
            "run_command": ["运行", "命令", "run", "exec", "command"],
            "db_query": ["数据库", "查询", "sql", "select", "database", "query"],
            # AI 浏览器控制(12 browser tools)
            "browser_screenshot": ["浏览器截图", "网页截图", "browser screenshot", "截屏"],
            "browser_click_element": ["点击元素", "点击按钮", "browser click", "click element"],
            "browser_type_text": ["浏览器输入", "网页输入", "browser type", "type text"],
            "browser_scroll": ["浏览器滚动", "网页滚动", "browser scroll", "scroll page"],
            "browser_navigate": ["打开网页", "导航到", "browser navigate", "goto url"],
            "browser_extract_dom": ["提取网页", "提取dom", "browser extract", "extract dom"],
            "browser_wait_for_element": ["等待元素", "browser wait", "wait element"],
            "browser_get_attribute": ["获取属性", "browser get attribute", "get attribute"],
            "browser_hover": ["悬停", "browser hover", "hover element"],
            "browser_select_option": ["选择选项", "browser select", "select option"],
            "browser_switch_tab": ["切换标签", "browser switch tab", "switch tab"],
            "browser_close_tab": ["关闭标签", "browser close tab", "close tab"],
            # AI 电脑控制(10 computer tools)
            "computer_screenshot_screen": ["电脑截图", "屏幕截图", "screen screenshot", "desktop screenshot"],
            "computer_mouse_move": ["鼠标移动", "mouse move", "move mouse"],
            "computer_mouse_click": ["鼠标点击", "mouse click", "click mouse"],
            "computer_keyboard_type": ["键盘输入", "keyboard type", "type keyboard"],
            "computer_mouse_scroll": ["鼠标滚动", "mouse scroll", "scroll mouse"],
            "computer_keyboard_press": ["按键", "keyboard press", "press key"],
            "computer_keyboard_hotkey": ["快捷键", "hotkey", "keyboard hotkey", "组合键"],
            "computer_active_window": ["活动窗口", "active window", "current window"],
            "computer_clipboard_get": ["读取剪贴板", "clipboard get", "paste clipboard"],
            "computer_clipboard_set": ["设置剪贴板", "clipboard set", "copy clipboard"],
        }

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
            except Exception:
                pass

            # 2. 意图分类
            t0 = time.monotonic()
            intent = await self._classify_intent(user_input, model=model)
            trace.append({
                "node": "intent_classify",
                "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                "intent": intent.intent,
                "needs_tool": intent.needs_tool,
            })

            # 3. 工具选择
            t0 = time.monotonic()
            tools: list[dict[str, Any]] = []
            if allowed_tools is not None:
                tools = self._filter_tools(allowed_tools)
            elif intent.needs_tool and intent.suggested_tools:
                tools = self._filter_tools(intent.suggested_tools)
            elif intent.needs_tool:
                # 关键词 fallback
                guessed = self._keyword_tool_select(user_input)
                tools = self._filter_tools(guessed)
            trace.append({
                "node": "tool_select",
                "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                "tool_count": len(tools),
                "tool_names": [t.get("function", {}).get("name") for t in tools],
            })

            # 4. 加载历史上下文
            history = await memory_store.get(sid, limit=20)
            messages: list[dict[str, Any]] = []
            # 工具结果诚实报告指令:防止 LLM 在 tool 失败时幻觉"已完成"
            if tools:
                messages.append({
                    "role": "system",
                    "content": (
                        "你是一个能调用工具的 AI 助手。调用工具后,务必检查返回结果中的 ok 字段:\n"
                        "- ok=true:工具执行成功,可以告诉用户已完成\n"
                        "- ok=false:工具执行失败,必须如实告知用户失败原因(包括 errorCode/error 字段),"
                        "禁止声称已完成或成功\n"
                        "常见失败场景:TARGET_NOT_CONNECTED(浏览器扩展/桌面端未连接)、TIMEOUT(执行超时)、"
                        "SELECTOR_NOT_FOUND(元素未找到)。遇到这些错误时,引导用户检查对应端是否已启动。"
                    ),
                })
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

                # 5.3 解析并执行 tool_calls
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

                    t1 = time.monotonic()
                    exec_result = await mcp_server.call_tool(tool_name, args)
                    ok = bool(exec_result.get("ok"))
                    record = ToolCallRecord(
                        tool=tool_name,
                        arguments=args,
                        result=exec_result,
                        ok=ok,
                        duration_ms=round((time.monotonic() - t1) * 1000, 2),
                    )
                    tool_calls.append(record)
                    # P0-7: 工具失败时在 trace 显式记录 _tool_error
                    tool_trace: dict[str, Any] = {
                        "node": "tool_execute",
                        "tool": tool_name,
                        "ok": ok,
                        "duration_ms": record.duration_ms,
                    }
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
                        err_detail = exec_result.get("error") or exec_result.get("message") or "unknown error"
                        err_code = exec_result.get("errorCode", "UNKNOWN")
                        # 嵌入 result.result 兼容 agent_control 返回格式
                        inner = exec_result.get("result", {})
                        if isinstance(inner, dict) and inner.get("errorCode"):
                            err_code = inner.get("errorCode", err_code)
                            err_detail = inner.get("error", err_detail)
                        result_json = (
                            f"TOOL EXECUTION FAILED. errorCode={err_code}. error={err_detail}. "
                            f"You MUST tell the user the tool failed and suggest checking if the browser extension / desktop app is running. "
                            f"Do NOT claim success. Raw result: {result_json}"
                        )
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "name": tool_name,
                        "content": result_json,
                    })

                # 5.3.1 全部 tool 失败时直接构造失败响应,不让 LLM 总结(防止幻觉"已完成")
                round_calls = tool_calls[-len(tool_calls_raw):] if tool_calls_raw else []
                if round_calls and all(not tc.ok for tc in round_calls):
                    failed_details = []
                    for tc in round_calls:
                        inner = tc.result.get("result", {})
                        err_code = inner.get("errorCode", tc.result.get("errorCode", "UNKNOWN")) if isinstance(inner, dict) else "UNKNOWN"
                        err_msg = inner.get("error", tc.result.get("error", "unknown")) if isinstance(inner, dict) else "unknown"
                        failed_details.append(f"- {tc.tool}: {err_code} — {err_msg}")
                    final_response = (
                        f"工具执行失败,未能完成您的请求:\n" + "\n".join(failed_details) + "\n\n"
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
            except Exception:
                pass
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
    # 私有:意图分类
    # =========================================================================

    async def _classify_intent(
        self, user_input: str, model: str | None = None
    ) -> IntentResult:
        """LLM 分类意图 + 抽取 entities + 决定是否需要 tool。

        失败/降级时返回基于关键词的 fallback 意图。
        """
        fallback = self._fallback_intent(user_input)

        classification_prompt = [
            {
                "role": "system",
                "content": (
                    "你是意图分类助手。分析用户输入并以 JSON 形式返回:\n"
                    "{\n"
                    '  "intent": "chat|qa|tool_use|code|analysis|creative|other",\n'
                    '  "confidence": 0.0-1.0,\n'
                    '  "entities": {"key": "value"},\n'
                    '  "needs_tool": true/false,\n'
                    '  "suggested_tools": ["tool_name1", "tool_name2"],\n'
                    '  "reasoning": "为什么这么分类"\n'
                    "}\n"
                    f"可用工具: {', '.join(t.name for t in mcp_server.list_tools())}"
                ),
            },
            {"role": "user", "content": user_input},
        ]

        try:
            result = await llm_gateway.complete(classification_prompt, model=model)
            content = str(result.get("content", "") or "")
            parsed = self._parse_json_object(content)
            if parsed:
                intent_label = str(parsed.get("intent", "other")).lower()
                if intent_label not in INTENT_LABELS:
                    intent_label = "other"
                try:
                    confidence = float(parsed.get("confidence", 0.5))
                except (TypeError, ValueError):
                    confidence = 0.5
                return IntentResult(
                    intent=intent_label,
                    confidence=max(0.0, min(1.0, confidence)),
                    entities=parsed.get("entities") or {},
                    reasoning=str(parsed.get("reasoning", "")),
                    needs_tool=bool(parsed.get("needs_tool", False)),
                    suggested_tools=list(parsed.get("suggested_tools") or []),
                )
        except Exception:
            pass
        return fallback

    def _fallback_intent(self, user_input: str) -> IntentResult:
        """基于关键词的 fallback 意图(LLM 不可用时)。"""
        text = user_input.lower()
        needs_tool = False
        suggested: list[str] = []

        # 工具关键词检测
        for tool, kws in self._tool_keywords.items():
            if any(kw in text for kw in kws):
                needs_tool = True
                suggested.append(tool)

        # 意图粗分类
        if any(k in text for k in ["代码", "函数", "class", "def ", "code", "function"]):
            intent = "code"
        elif any(k in text for k in ["分析", "调研", "研究", "analyze", "research"]):
            intent = "analysis"
        elif any(k in text for k in ["写", "创作", "写一", "creative", "write"]):
            intent = "creative"
        elif any(k in text for k in ["?", "？", "是什么", "怎么", "how", "what", "why"]):
            intent = "qa"
        elif needs_tool:
            intent = "tool_use"
        else:
            intent = "chat"

        return IntentResult(
            intent=intent,
            confidence=0.5,
            needs_tool=needs_tool,
            suggested_tools=suggested,
            reasoning="基于关键词的 fallback 分类",
        )

    @staticmethod
    def _parse_json_object(text: str) -> dict[str, Any] | None:
        """从文本中提取首个 JSON object。"""
        if not text:
            return None
        # 尝试整段解析
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
        # 尝试正则提取 {...}
        match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
        if match:
            try:
                obj = json.loads(match.group())
                if isinstance(obj, dict):
                    return obj
            except (json.JSONDecodeError, ValueError):
                pass
        return None

    # =========================================================================
    # 私有:工具选择
    # =========================================================================

    def _filter_tools(self, names: list[str]) -> list[dict[str, Any]]:
        """根据 name 列表返回 OpenAI tools 格式定义。"""
        all_tools = mcp_server.list_tools()
        available = {t.name: t for t in all_tools}
        out: list[dict[str, Any]] = []
        for n in names:
            if n in available:
                t = available[n]
                out.append({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.input_schema,
                    },
                })
        return out

    def _keyword_tool_select(self, text: str) -> list[str]:
        """基于关键词的快速工具选择。"""
        text_l = text.lower()
        matches: list[tuple[int, str]] = []
        for tool, kws in self._tool_keywords.items():
            score = sum(1 for kw in kws if kw in text_l)
            if score > 0:
                matches.append((score, tool))
        matches.sort(reverse=True)
        return [t for _, t in matches[:3]]

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
