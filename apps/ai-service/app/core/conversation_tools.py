# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Tool selection helpers — 工具选择辅助方法。

从 conversation.py 提取(2026-09-13 模块拆分):
- filter_tools():         根据 name 列表返回 OpenAI tools 格式定义
- keyword_tool_select():  基于关键词的快速工具选择
- media_intent_tools():   媒体模态预路由(强信号正则命中 → 对应工具名)
- web_intent_tools():     Firecrawl web 网络意图预路由
- DEFAULT_TOOL_KEYWORDS:  默认工具 → 关键词映射(用于无 LLM 时的快速工具选择)
"""

from __future__ import annotations

from typing import Any

from ..services.mcp_server import mcp_server
from .conversation_media_routing import _MEDIA_INTENT_PATTERNS, _WEB_INTENT_PATTERNS

# 默认工具 → 关键词映射(用于无 LLM 时的快速工具选择)
DEFAULT_TOOL_KEYWORDS: dict[str, list[str]] = {
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
    # 声纹克隆(2026-09-09 深能力补齐):说"克隆我的声音/上传声音"时管理声纹库
    "token6688_voice_clone": ["克隆声音", "克隆音色", "复刻声音", "我的声音", "声纹", "声音库", "上传声音", "voice clone", "clone voice"],
    # 任务取消(2026-09-09 深度适配二):说"取消这个任务"时撤销长任务
    "token6688_cancel_task": ["取消任务", "取消生成", "停止生成", "撤销任务", "别做了", "cancel", "stop task"],
    # 模型价目(2026-09-09 深度适配二):说"生成视频多少钱"时查价目/参数
    "token6688_model_info": ["多少钱", "什么价", "价格", "费用", "怎么收费", "参数有哪些", "模型参数", "pricing", "how much"],
}


def filter_tools(names: list[str]) -> list[dict[str, Any]]:
    """根据 name 列表返回 OpenAI tools 格式定义。

    Args:
        names: 工具名称列表。

    Returns:
        OpenAI tools 格式定义列表。
    """
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


def keyword_tool_select(
    text: str,
    tool_keywords: dict[str, list[str]] | None = None,
) -> list[str]:
    """基于关键词的快速工具选择。

    Args:
        text: 用户输入文本。
        tool_keywords: 工具 → 关键词映射(默认使用 DEFAULT_TOOL_KEYWORDS)。

    Returns:
        匹配度最高的前 3 个工具名称列表。
    """
    kws = tool_keywords or DEFAULT_TOOL_KEYWORDS
    text_l = text.lower()
    matches: list[tuple[int, str]] = []
    for tool, kw_list in kws.items():
        score = sum(1 for kw in kw_list if kw in text_l)
        if score > 0:
            matches.append((score, tool))
    matches.sort(reverse=True)
    return [t for _, t in matches[:3]]


def media_intent_tools(text: str) -> list[str]:
    """媒体模态预路由(2026-09-08 全模态自动切换):强信号正则命中 → 对应工具名。

    与 keyword_tool_select 的区别:那里是"猜 top3"的兜底,这里是按模态精确判定,
    命中即无条件并入 tool loop 工具集(不受 LLM 意图分类质量影响)。
    负样本控制:模式要求"动词+媒体宾语"结构,"看看图片/上传图片/这张照片"不会命中。

    Args:
        text: 用户输入文本。

    Returns:
        命中媒体模态强信号的工具名称列表。
    """
    out: list[str] = []
    for tool, patterns in _MEDIA_INTENT_PATTERNS.items():
        if any(p.search(text) for p in patterns):
            out.append(tool)
    return out


def web_intent_tools(text: str) -> list[str]:
    """Firecrawl web 网络意图预路由(2026-09-09 极致融合补齐):命中 URL 抓取/整站/
    结构化抽取强信号 → 注入对应只读 web 工具(fetch_readable/map_site/extract_web)。

    刻意不含 crawl_site(递归爬取重操作, 在 _ADMIN_ONLY_TOOLS, 普通对话 user_role=0
    不可调)。与 media_intent_tools 同语义: 命中即并入 tool loop 工具集, 不受 LLM
    意图分类质量影响。

    Args:
        text: 用户输入文本。

    Returns:
        命中 web 强信号的工具名称列表。
    """
    out: list[str] = []
    for tool, patterns in _WEB_INTENT_PATTERNS.items():
        if any(p.search(text) for p in patterns):
            out.append(tool)
    return out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
