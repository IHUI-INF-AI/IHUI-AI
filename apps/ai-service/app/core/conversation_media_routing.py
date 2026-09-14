# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Media routing constants and helpers — 全模态自动路由 + 媒体产物记忆。

从 conversation.py 提取(2026-09-13 模块拆分):
- MAX_PARALLEL_TOOL_CALLS:    单轮最大并行工具数
- _RETRYABLE_TOOLS:           幂等只读工具集合
- _MEDIA_INTENT_PATTERNS:     媒体模态强信号正则 → 工具映射
- _WEB_INTENT_PATTERNS:       Firecrawl web 网络能力正则 → 工具映射
- _MEDIA_RENDER_PROMPT:       媒体工具结果渲染规范(注入 system)
- _MEDIA_CHAIN_PROMPT:        跨模态链式编排 + 任务取件指引
- _WEB_RENDER_PROMPT:         网页工具结果呈现规范
- _MEDIA_RESULT_FIELDS:       媒体产物摘要字段定义
- _media_artifact_summary():  提取本轮成功媒体工具产物摘要
- _resolve_user_id():         从 session_id 保守解析 user_id
"""

from __future__ import annotations

import json
import re
from typing import Any

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
    # 声纹克隆(2026-09-09 深能力补齐):上传参考音频克隆音色/列声纹库/查声纹详情
    "token6688_voice_clone": (
        re.compile(r"(克隆|复刻|复制)(一)?(下|个)?(我的|自己的|他|她)?(声音|音色|嗓音|声线)"),
        re.compile(r"(我的|自己的|这个|这段|他的|她的)?(声音|音色|嗓音|声线)(克隆|复刻|复制|保存|上传|训练|学习)"),
        # "把我的声音做成音色 / 把这段录音变成我的声音" 结构
        re.compile(r"(把|将)?(我的|自己的|他|她|这段|这个)?(声音|嗓音|声线|录音)(做|变|转|克隆|复刻)(成|为)?(我的)?(音色|声音|声线|嗓音)"),
        # "上传这段录音做声纹 / 用这段音频克隆声音" 结构
        re.compile(r"(上传|用|拿)(一)?(这|那)?(段|个|条)?(录音|音频|声音|语音)?(来)?(做|当|作为|克隆|训练|合成)(一)?(个)?(声纹|音色|声音|克隆)"),
        # "我的声纹库有哪些 / 声音库列表" 结构
        re.compile(r"(我的|自己的)?(声纹|声音|音色)(库|列表)?(有哪些|都有什么|有什么|查一下|看看|列一下|显示|查看|列出来)"),
        re.compile(r"\b(voice ?clone|clone (my )?voice|upload (a )?voice|voice list)\b", re.IGNORECASE),
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
    "- image_generation / image_edit 成功且 image_url 是 http(s) 链接:必须在回复中用 "
    "![图片](image_url) 原样嵌入,让用户直接看到图片(改图结果同样处理)\n"
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
    "- 声纹克隆:用户要'克隆我的声音/上传声音做音色'时,调 token6688_voice_clone "
    "(action=upload,支持 path/url/data_uri),成功后把 voice_id 用于 voice_tts(engine=token6688)朗读\n"
    "- 价目问答:用户问'生成视频/图片要多少钱'时,调 token6688_model_info 查价目与参数,"
    "再按结果如实作答\n"
    "- 长任务取件:会话历史(含 media_context)里出现 task_id 时,用户问"
    "'视频/音乐好了吗'直接带该 task_id 调对应工具(只传 task_id 即查询模式),"
    "严禁编造 task_id,严禁谎称已完成;完成后按渲染规范嵌入链接"
)

# ---- 2026-09-09 Firecrawl web 网络能力对话自动路由(极致融合补齐)----
# 强信号正则:命中 URL 抓取/整站/结构化抽取意图 → 无条件注入对应只读 web 工具。
# 仅含 fetch_readable / map_site / extract_web(crawl_site 递归爬取重操作,刻意在
# _ADMIN_ONLY_TOOLS,普通对话 user_role=0 不可调,故不进自动路由)。
_WEB_INTENT_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "fetch_readable": (
        re.compile(r"https?://\S+", re.IGNORECASE),
        re.compile(r"(读取|抓取|看看|看下|阅读|总结|概括|讲讲|介绍一下)(这|该|那个|这个)?(网页|网站|页面|网页内容|文章|博客|新闻|网址|链接)"),
        re.compile(r"(这|那个|这个|该)(篇|个|张)?(网页|网站|页面|文章|博客|新闻|内容)讲(了|着|的|什么|的是)"),
        re.compile(r"\b(fetch|read|parse|scrape)( this| the)? (url|page|webpage|site|article|link)\b", re.IGNORECASE),
    ),
    "map_site": (
        re.compile(r"(这|该|这个)(网站|站点|域名|网址)的?的?(结构|链接|页面|导航|有哪些|都有什么|目录|子页面|收录)"),
        re.compile(r"(看看|探查|了解|摸清|查看)(一)?(下)?(这个)?(网站|站点|域名)的?(结构|链接|页面|地图|有哪些|全貌)"),
        re.compile(r"(网站|站点|网址)?(地图|结构|链接|页面)?(是|有哪些|列一下|给我看|找一找|扫描一下)"),
        re.compile(r"\b(map|sitemap|site ?map|list (all )?urls? of) (this|the) (site|website|domain)\b", re.IGNORECASE),
    ),
    "extract_web": (
        re.compile(r"(提取|抽取|爬取|抓取|结构化|整理)(一)?(下)?(这|该|那个|这个)?(网页|网站|页面|网站里|页面里)的?(字段|价格|产品|信息|数据|表格|列表|参数|规格)"),
        re.compile(r"(从|在|把)(这|该|那个)?(网页|网站|页面)里(提取|抽取|扒|拿到|整理)(出)?(字段|价格|产品|信息|数据|一句话|要点)"),
        re.compile(r"(把|将)(这|该|那个|这个)?(网页|网站|页面)的?(字段|价格|信息|数据|内容|产品|规格|参数)(抽|提取|抽取|扒|整理)(出来|一下)?"),
        re.compile(r"帮我(列|整理|提取)出?(这|该)?(网页|网站|页面上)?的?(标题|价格|联系方式|信息|内容)"),
        re.compile(r"\b(extract|scrape) (structured )?(data|fields|info|prices?) from (this|the) (page|site)\b", re.IGNORECASE),
    ),
}

# 网页工具结果呈现规范:注入 system,让 LLM 把抓取到的正文/链接/结构化结果以可读方式呈现。
_WEB_RENDER_PROMPT = (
    "网页抓取工具结果呈现规范(务必遵守):\n"
    "- fetch_readable 成功:把 content 正文提炼成要点向用户汇报,标明来源 URL;"
    "不要原文整段搬运超长内容,truncated=true 时如实说明已截断\n"
    "- map_site 成功:以列表形式汇报重点链接(带锚文本),link_count 说明收录规模\n"
    "- extract_web 成功:逐字段列出抽取结果(字段=值);confidence 低(<0.5)的字段提醒『抽取置信度不高』\n"
    "- ok=false 时如实告知失败原因(SSRF_BLOCKED/FETCH_FAILED 等),不要编造网页内容"
)

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
    """提取本轮成功媒体工具的产物摘要;无媒体产物返回空串(不写记忆)。

    Args:
        tool_calls: ToolCallRecord 列表(从 conversation 模块导入的类型)。

    Returns:
        JSON 字符串摘要(最长 1200 字符),无媒体产物时返回空串。
    """
    items: list[dict[str, Any]] = []
    for tc in tool_calls:
        if not tc.ok:
            continue
        r = tc.result or {}
        entry: dict[str, Any] = {}
        if tc.tool in ("image_generation", "image_edit", "video_generation", "music_generation"):
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
        elif tc.tool == "token6688_voice_clone":
            # 声纹克隆产物记忆(2026-09-09):voice_id 是下轮 voice_tts 复用克隆音色的钥匙,
            # 必须入记忆,否则"用刚才克隆的声音朗读"会断链
            vid = r.get("voice_id")
            if vid:
                entry = {"voice_id": vid}
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


# 延迟导入避免循环依赖(ToolCallRecord 定义在 conversation_models.py)
from .conversation_models import ToolCallRecord  # noqa: E402
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
