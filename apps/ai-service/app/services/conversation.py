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
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..core.llm_gateway import llm_gateway
from .mcp_server import mcp_server
from .memory import memory_store

logger = logging.getLogger(__name__)

# P1-2 并行工具执行:单轮最大并行数(防工具过多打爆),超出分批 gather
MAX_PARALLEL_TOOL_CALLS = 5

# 幂等只读工具:失败可安全重试 1 次(无副作用);写操作工具不重试
_RETRYABLE_TOOLS: frozenset[str] = frozenset({
    "web_search", "search_web", "knowledge_lookup", "read_file", "list_files",
    "file_search", "search_codebase", "analyze_code", "parse_document",
    "generate_chart", "summarize_artifacts",
})

# ---------------------------------------------------------------------------
# 全模态自动路由(2026-09-08):媒体模态强信号正则 → 无条件注入对应工具
# 兜底 LLM 意图分类漏判/幻觉 suggested_tools,保证"画一张/做个视频/写首歌/
# 朗读这段"永远能在 tool loop 里调到正确的媒体工具(自动切换多模态调用)。
# 仅做"工具可见性"注入,是否真正调用仍由 LLM tool_choice=auto 决策。
# ---------------------------------------------------------------------------
_MEDIA_INTENT_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "image_generation": (
        re.compile(r"(帮我|给我|给我来)?画(一|几)?(张|幅|个|下|只)"),
        re.compile(r"(画|绘)(出|一个|一幅|一张)"),
        re.compile(r"(生成|制作|做|来|设计)(一)?(张|幅|个)?[\s的]{0,2}(图片|图像|配图|插画|海报|头像|封面|图标|logo|吉祥物|表情包)"),
        re.compile(r"(图片|图像|海报|头像|插画|封面|logo|图标)的?(生成|绘制|设计)"),
        re.compile(r"\b(draw|paint|sketch|generate (an? )?(image|picture|photo)|create (an? )?(image|picture|logo))\b", re.IGNORECASE),
    ),
    "video_generation": (
        re.compile(r"(做|生成|制作|来|拍|帮我做)(一)?(个|段|部|条)?[^。]{0,8}视频"),
        re.compile(r"(视频|短片|动画片?|火柴人|MV)的?(生成|制作)|出片|视频生成"),
        re.compile(r"\b(make|generate|create) (a )?video\b", re.IGNORECASE),
        # 任务取件查询(2026-09-09):长任务提交后"视频好了吗"带 task_id 查询模式取件
        re.compile(r"(视频|视频任务|片子)(好了吗|好了没|好了么|做完了吗|生成完了吗|出来了吗)"),
        re.compile(r"出片(了吗|了没|了么)"),
    ),
    "music_generation": (
        re.compile(r"(写|做|来|创作|生成|帮我写)(一)?首?(歌|曲|音乐)"),
        re.compile(r"(写|创作|生成|帮我写)(一)?首[^。]{0,10}歌"),
        re.compile(r"(生成|制作|做|来)(一)?(个|段|首)?(音乐|配乐|背景音乐|BGM|纯音乐)"),
        re.compile(r"配乐|背景音乐|BGM|作曲|编曲|主题曲"),
        re.compile(r"\b(make|write|generate|compose) (a )?(song|music)\b", re.IGNORECASE),
        # 任务取件查询(2026-09-09):音乐长任务"歌好了吗"
        re.compile(r"(歌|音乐|音乐任务|曲子)(好了吗|好了没|好了么|做完了吗|生成完了吗|出来了吗)"),
    ),
    "voice_tts": (
        re.compile(r"朗读|读出来|念出来|配(个|段|一)?音|语音合成|转语音|播报|文字转语音|文本转语音"),
        re.compile(r"\b(text to speech|read (it |this )?aloud|speak (it )?out)\b", re.IGNORECASE),
    ),
    # ---- 2026-09-09 全模态深度适配:理解/转写/账务 三类深能力入对话路由 ----
    "vision_analyze": (
        re.compile(r"(看|瞧|识别|分析|描述|解读)(一)?下?这(张|个|幅)?(图|图片|照片|截图|漫画|海报)"),
        re.compile(r"这(张|个|幅)?(图|图片|照片|截图)(里|中|上)?(有|是|画|写|说|讲|啥|什么)"),
        re.compile(r"(识别|提取|读取)(一)?下?(图|图里|图中|图片|截图)(里|中)?的?(文字|字|二维码|人脸|物体|内容)"),
        re.compile(r"(分析|描述|解释)(一)?下?(这|该)?(张|个|幅)?(图|图片|照片|截图)"),
        re.compile(r"\b(describe|analyze|what('?s| is) in) (this|the) (image|picture|photo|screenshot)\b", re.IGNORECASE),
    ),
    "audio_transcription": (
        re.compile(r"(录音|音频|语音|这段话|唱的?)(给)?(转|翻译|识别|听写|变成|写成)(成)?(文字|文本|字幕)"),
        re.compile(r"(转|识别|听写|提取)(成)?(文字|文本|字幕)"),
        re.compile(r"听写|转写"),  # ASR 专用词,独立强信号无误触
        re.compile(r"\b(transcribe|speech[- ]to[- ]text|audio[- ]to[- ]text)\b", re.IGNORECASE),
    ),
    "token6688_balance": (
        re.compile(r"(账户|账号|平台)?(余额|额度)(还剩|剩|多少|查询|查一下|还有|够不够|够吗)"),
        re.compile(r"(查询|查一下|看看|问一下)(一)?下?(账户|账号|平台)?(余额|额度)"),
        re.compile(r"还剩多少(钱|额度|余额|积分|金额)"),
        re.compile(r"\b(how much (balance|credit)|check balance)\b", re.IGNORECASE),
    ),
    # ---- 2026-09-09 全模态深度适配(二):改图 / 取消长任务 / 模型价目问答 ----
    "image_edit": (
        re.compile(r"(把|帮|给)?(我|这)?(张|个|幅)?(图|图片|照片|头像|封面)(给|帮我)?(改|编辑|修|换|去掉|去个|去除|加上|加个|改成|改成是|转成|变|P|修一下|处理)"),
        re.compile(r"(改|修|编辑|处理|调整|美化)(一)?下?(这|那)?(张|个|幅)?(图|图片|照片|头像|封面)"),
        re.compile(r"(去|去掉|移除|删掉|清除|抹去)(一)?(下)?(这)?(张)?(图|图片|照片)?(里|中|上)?的?(水印|背景|文字|logo|人物|物体)"),
        re.compile(r"(扩图|局部重绘|改图|修图|图片编辑|编辑图片|去水印|抠图|换背景|改背景|调色)"),
        re.compile(r"\b(edit|modify|retouch|photoshop|remove (watermark|background|text)) (this|the|my) (image|picture|photo)\b", re.IGNORECASE),
    ),
    "token6688_cancel_task": (
        re.compile(r"(取消|撤销|停止|别要了|不要了|终止)(一)?(下)?(这个|那个|视频|音乐|图片|任务|生成|出片|歌曲)"),
        re.compile(r"(视频|音乐|任务|出片|歌曲)(取消|撤销|停止|别做了|不要了|终止)"),
        re.compile(r"\b(cancel|stop|abort) (the )?(task|video|music|generation)\b", re.IGNORECASE),
    ),
    "token6688_model_info": (
        re.compile(r"(生成|做|做一段|做一首|画|出一)(这|那|一)?(个)?(视频|图片|音乐|歌)要?(多|大概)?(少钱|多少钱|贵不贵|什么价|价格|费用)"),
        re.compile(r"(模型|这个模型|这个工具)的?(价格|费用|参数|参数有哪些|多少钱|怎么收费)"),
        re.compile(r"(查|看看|问一下|帮我查)(一)?下?(模型|生成|这个)?(价格|价目|费用|参数|多少钱)"),
        re.compile(r"\b(how much (does it |)cost|price|pricing|params?)\b", re.IGNORECASE),
    ),
}

# 媒体工具结果渲染规范:注入 system,让 LLM 把工具返回的媒体 URL 以 Markdown
# 形式直接嵌入回复(对话即所得,前端无需二次处理;data URI 超长禁止回贴)。
_MEDIA_RENDER_PROMPT = (
    "媒体生成工具结果渲染规范(务必遵守):\n"
    "- image_generation 成功且 image_url 是 http(s) 链接:必须在回复中用 ![图片](image_url) "
    "原样嵌入,让用户直接看到图片\n"
    "- video_generation 成功且 video_url 是 http(s) 链接:用 [▶️ 观看视频](video_url) 嵌入\n"
    "- music_generation 成功且 audio_url 是 http(s) 链接:用 [🎧 播放音乐](audio_url) 嵌入\n"
    "- voice_tts 的 audio_url 是 data URI(base64,超长):绝不要把 base64 内容贴进回复,"
    "只告知语音已生成可播放;有 saved_path 时一并告知\n"
    "- 返回 submitted=true 且带 task_id(视频/音乐长任务):明确告知任务已提交与预计耗时,"
    "提醒用户稍后让你用该 task_id 查询取件,严禁谎称已完成\n"
    "- ok=false 时如实告知失败原因与已尝试的 provider,不要编造链接"
)

# 跨模态链式编排 + 任务取件指引(2026-09-09 全模态深度适配):
# 让 LLM 会把媒体工具串起来用(图生视频/先理解后生成),并会用记忆里的
# task_id 完成长任务取件("视频好了吗"→ 带上轮 task_id 调查询模式)。
_MEDIA_CHAIN_PROMPT = (
    "跨模态链式编排(把媒体工具串起来完成复杂任务,务必善用):\n"
    "- 图生视频:用户要'让这张图动起来/把图做成视频'时,先调 image_generation 拿到 "
    "image_url,再把该 URL 作为 video_generation 的 image 参数提交(mode=first-frame);"
    "用户已给图片 URL 或上轮产物里有 image_url 时直接复用,不要重复生成\n"
    "- 先理解后生成:涉及用户提供的图片内容时,先 vision_analyze 理解,再按理解结果调用生成类工具\n"
    "- 转写后加工:先 audio_transcription 拿到文本,再做朗读/翻译/总结等后续工具调用\n"
    "- 改图:用户要'改/修/去水印/换背景'时用 image_edit(需待编辑图 URL/data URI,"
    "可复用上轮 image_generation 的 image_url;改前可先 vision_analyze 确认原图内容)\n"
    "- 取消长任务:用户说'取消/别做了'且记忆里有 task_id 时,调 token6688_cancel_task "
    "取消在途任务,严禁编造 task_id\n"
    "- 价目问答:用户问'生成视频/图片要多少钱'时,调 token6688_model_info 查价目与参数,"
    "再按结果如实作答\n"
    "- 长任务取件:会话历史(含 media_context)里出现 task_id 时,用户问"
    "'视频/音乐好了吗'直接带该 task_id 调对应工具(只传 task_id 即查询模式),"
    "严禁编造 task_id,严禁谎称已完成;完成后按渲染规范嵌入链接"
)


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
# 媒体产物记忆延续(2026-09-09 全模态深度适配):
# 把本轮媒体工具的关键产物(task_id/媒体 URL/转写与理解文本摘录)压成一条
# 短 JSON 摘要写入会话记忆 → 下一轮"视频好了吗/再画一张类似的"LLM 能从
# history 里看到 task_id/image_url 接上上下文。data URI 超长绝不入库。
# ---------------------------------------------------------------------------
_MEDIA_RESULT_FIELDS: tuple[tuple[str, str], ...] = (
    ("task_id", "task_id"),
    ("image_url", "image_url"),
    ("video_url", "video_url"),
    ("audio_url", "audio_url"),
    ("saved_path", "saved_path"),
    ("status", "status"),
    ("provider", "provider"),
)


def _media_artifact_summary(tool_calls: list[ToolCallRecord]) -> str:
    """提取本轮成功媒体工具的产物摘要;无媒体产物返回空串(不写记忆)。"""
    items: list[dict[str, Any]] = []
    for tc in tool_calls:
        if not tc.ok:
            continue
        r = tc.result or {}
        entry: dict[str, Any] = {}
        if tc.tool in ("image_generation", "video_generation", "music_generation"):
            for src, dst in _MEDIA_RESULT_FIELDS:
                v = r.get(src)
                if isinstance(v, (str, int, float)) and v != "":
                    if src == "audio_url" and str(v).startswith("data:"):
                        v = "[data-uri-omitted]"  # voice/music data URI 超长不入库
                    entry[dst] = v
        elif tc.tool == "voice_tts":
            entry = {"voice": r.get("voice", ""), "engine": r.get("engine", "")}
            if r.get("saved_path"):
                entry["saved_path"] = r["saved_path"]
        elif tc.tool == "vision_analyze":
            desc = str(r.get("analysis") or "")[:200]
            if desc:
                entry = {"analysis_excerpt": desc}
        elif tc.tool == "audio_transcription":
            t = str(r.get("text") or "")[:200]
            if t:
                entry = {"transcript_excerpt": t}
        if entry:
            entry["tool"] = tc.tool
            items.append(entry)
    if not items:
        return ""
    return json.dumps(
        {
            "media_context": items,
            "_hint": "上一轮媒体工具产物;带 task_id 的未完成任务用该 id 调对应工具查询取件",
        },
        ensure_ascii=False,
    )[:1200]


def _resolve_user_id(sid: str) -> str:
    """从 session_id 保守解析 user_id,拿不到返回空串。

    conversation.chat 签名不含 user_id(v1 兼容铁律),上层调用链也未透传;
    仅当 session_id 为冒号分隔的复合格式(如 {user_id}:{session})时提取首段,
    否则返回空串跳过注入(调用方 debug 日志后降级,绝不阻塞对话)。
    """
    if sid and ":" in sid:
        head = sid.split(":", 1)[0].strip()
        # 排除系统前缀,避免把 conv-xxx/session-xxx 等误判为用户标识
        if head and head.lower() not in {"session", "conv", "sess", "u", "user", "chat"}:
            return head
    return ""


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
            "computer_screenshot_screen": [
                "电脑截图", "屏幕截图", "screen screenshot", "desktop screenshot"
            ],
            "computer_mouse_move": ["鼠标移动", "mouse move", "move mouse"],
            "computer_mouse_click": ["鼠标点击", "mouse click", "click mouse"],
            "computer_keyboard_type": ["键盘输入", "keyboard type", "type keyboard"],
            "computer_mouse_scroll": ["鼠标滚动", "mouse scroll", "scroll mouse"],
            "computer_keyboard_press": ["按键", "keyboard press", "press key"],
            "computer_keyboard_hotkey": ["快捷键", "hotkey", "keyboard hotkey", "组合键"],
            "computer_active_window": ["活动窗口", "active window", "current window"],
            "computer_clipboard_get": ["读取剪贴板", "clipboard get", "paste clipboard"],
            "computer_clipboard_set": ["设置剪贴板", "clipboard set", "copy clipboard"],
            # 视频生成(2026-09-08):说"做视频"时引导触发统一编排出片
            "video_generation": ["视频", "video", "出片", "短片", "动画片", "火柴人"],
            # 音乐生成(2026-09-08):说"做首歌/配乐"时触发 token6688 Suno 风格生成
            "music_generation": ["音乐", "歌曲", "写歌", "做首歌", "唱", "配乐", "作曲", "编曲", "music", "song"],
            # 语音合成(2026-09-08):说"朗读/读出来/配音"时触发文本转语音(edge 零成本默认)
            "voice_tts": ["朗读", "读出来", "读一下", "念出来", "配音", "语音合成", "转语音", "播报", "tts", "text to speech"],
            # 图片生成(2026-09-08 全模态自动路由):说"画一张/生成图片"时触发图片生成
            "image_generation": [
                "画", "绘图", "插画", "海报", "头像", "生成图片", "生成一张", "画一张",
                "画个", "来一张图", "封面图", "图标", "logo", "image", "draw", "poster",
            ],
            # 图片理解(2026-09-09 全模态深度适配):说"看看/识别这张图"时触发视觉分析
            "vision_analyze": ["看看图", "识别图", "图片里", "图中", "这张图", "截图分析", "识图"],
            # 语音转文字(2026-09-09):说"录音转文字/听写"时触发本地 whisper 转写
            "audio_transcription": ["转文字", "转成文字", "听写", "转写", "语音识别", "录音转", "transcribe"],
            # 余额查询(2026-09-09):说"还剩多少额度"时查 token6688 账户
            "token6688_balance": ["余额", "额度", "还剩多少", "balance", "credit"],
            # 图片编辑(2026-09-09 深度适配二):说"改这张图/去水印"时编辑已有图
            "image_edit": ["改图", "修图", "去水印", "抠图", "换背景", "编辑图片", "图片编辑", "扩图", "局部重绘", "edit image", "retouch"],
            # 任务取消(2026-09-09 深度适配二):说"取消这个任务"时撤销长任务
            "token6688_cancel_task": ["取消任务", "取消生成", "停止生成", "撤销任务", "别做了", "cancel", "stop task"],
            # 模型价目(2026-09-09 深度适配二):说"生成视频多少钱"时查价目/参数
            "token6688_model_info": ["多少钱", "什么价", "价格", "费用", "怎么收费", "参数有哪些", "模型参数", "pricing", "how much"],
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
            except Exception as e:
                logger.warning("memory_store.add user 消息失败: %s", e)

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
            media_tools: list[str] = []
            if allowed_tools is not None:
                tools = self._filter_tools(allowed_tools)
            elif intent.needs_tool and intent.suggested_tools:
                tools = self._filter_tools(intent.suggested_tools)
            elif intent.needs_tool:
                # 关键词 fallback
                guessed = self._keyword_tool_select(user_input)
                tools = self._filter_tools(guessed)
            else:
                # 全模态自动路由(2026-09-08):intent 未判 needs_tool 但媒体强信号命中
                # → 直接注入对应媒体工具(自动切换多模态调用)
                media_tools = self._media_intent_tools(user_input)
                if media_tools:
                    tools = self._filter_tools(media_tools)
            # intent 已选工具时补并媒体预路由命中项(去重),防 LLM 分类漏判媒体模态
            if allowed_tools is None and not media_tools:
                media_tools = self._media_intent_tools(user_input)
                existing = {t.get("function", {}).get("name") for t in tools}
                extra = [m for m in media_tools if m not in existing]
                if extra:
                    tools.extend(self._filter_tools(extra))
            trace.append({
                "node": "tool_select",
                "duration_ms": round((time.monotonic() - t0) * 1000, 2),
                "tool_count": len(tools),
                "tool_names": [t.get("function", {}).get("name") for t in tools],
                **({"media_routed": media_tools} if media_tools else {}),
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
        except Exception as e:
            logger.warning("意图分类 JSON 解析失败,使用 fallback: %s", e)
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

    @staticmethod
    def _media_intent_tools(text: str) -> list[str]:
        """媒体模态预路由(2026-09-08 全模态自动切换):强信号正则命中 → 对应工具名。

        与 _keyword_tool_select 的区别:那里是"猜 top3"的兜底,这里是按模态精确判定,
        命中即无条件并入 tool loop 工具集(不受 LLM 意图分类质量影响)。
        负样本控制:模式要求"动词+媒体宾语"结构,"看看图片/上传图片/这张照片"不会命中。
        """
        out: list[str] = []
        for tool, patterns in _MEDIA_INTENT_PATTERNS.items():
            if any(p.search(text) for p in patterns):
                out.append(tool)
        return out

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
