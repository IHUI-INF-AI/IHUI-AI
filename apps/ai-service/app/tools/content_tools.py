# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""内容出稿工具（2026-11-27 立）。

为什么单独成模块：内容链路是“一人公司操作系统”的第一条真链路，但此前只有页面，
Agent 调不动。本工具把“一句话 → 标题 + 正文”收成一个可被 MCP 注册的原子能力，
由 llm_gateway 走 auto 路由，不绑定任何单一厂商。

纪律：
- 未配置模型（stub 模式）直接失败，绝不返回假稿；
- 模型空回复按 EMPTY_RESULT 失败，不拿模板补；
- 不编造具体数据/人物/案例，prompt 里写死；
- 字数是提示词约束，返回值如实带 charCount/withinRange，不静默截断。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_TOOL_NAME = "generate_content"
_MAX_BRIEF_CHARS = 2000
_DEFAULT_MAX_CHARS = 3000
_HARD_MAX_CHARS = 20000


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


def _strip_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _normalize_hashtags(value: Any) -> list[str]:
    """把模型给的话题词归一成 # 开头、去重、最多 30 个；不猜大流量/精准。"""
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"[\s,，、]+", value.strip())
    elif isinstance(value, list):
        parts = [str(item).strip() for item in value]
    else:
        return []
    tags: list[str] = []
    for part in parts:
        tag = part.strip()
        if not tag:
            continue
        if not tag.startswith("#"):
            tag = f"#{tag}"
        if len(tag) > 1 and tag not in tags:
            tags.append(tag)
    return tags[:30]


def _parse_payload(raw: str) -> tuple[str, str, list[str]]:
    """把模型输出归一成 (title, content, hashtags)。

    优先按 JSON 解析；模型不听话给了纯文本时，把首行“标题：xxx”摘出来，
    其余原样当正文。两条路都不伪造内容，也不伪造话题词。
    """
    text = _strip_fence(raw)
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        data = None
    if isinstance(data, dict):
        title = str(data.get("title") or "").strip()
        content = str(data.get("content") or "").strip()
        hashtags = _normalize_hashtags(data.get("hashtags"))
        if content:
            return title, content, hashtags
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = ""
    if lines and lines[0].startswith(("标题：", "标题:")):
        title = lines[0].split("：", 1)[-1].split(":", 1)[-1].strip()
        lines = lines[1:]
    body = "\n".join(lines) if lines else text
    return title, body, []


def _char_count(content: str) -> int:
    """正文字符数：去掉空白后计数，中文按字、英文按字母，不猜“词”。"""
    return len(re.sub(r"\s", "", content))


async def generate_content(arguments: dict[str, Any]) -> dict[str, Any]:
    """生成中文内容初稿（工具调用入口）。

    输入: brief 必填；platform/tone 可选；min_chars/max_chars 可选；
          title_chars/hashtag_count 可选（0 表示不约束）。
    返回: 成功 {tool, ok, title, content, hashtags, charCount, withinRange,
                titleLength, titleWithinRange, hashtagCount, model, usage}
          失败 {tool, ok: False, errorCode, message}
    """
    if not isinstance(arguments, dict):
        return _fail("INVALID_ARGS", "arguments 必须为 dict")

    brief = arguments.get("brief")
    if not isinstance(brief, str) or not brief.strip():
        return _fail("MISSING_BRIEF", "brief 必填且不能为空")
    brief = brief.strip()
    if len(brief) > _MAX_BRIEF_CHARS:
        return _fail("BRIEF_TOO_LONG", f"brief 最多 {_MAX_BRIEF_CHARS} 字")

    platform = arguments.get("platform")
    if platform is not None and not isinstance(platform, str):
        return _fail("INVALID_PLATFORM", "platform 必须为字符串")
    tone = arguments.get("tone")
    if tone is not None and not isinstance(tone, str):
        return _fail("INVALID_TONE", "tone 必须为字符串")

    raw_min = arguments.get("min_chars", 0)
    raw_max = arguments.get("max_chars", _DEFAULT_MAX_CHARS)
    if isinstance(raw_min, bool) or not isinstance(raw_min, int):
        return _fail("INVALID_MIN_CHARS", "min_chars 必须为整数")
    if isinstance(raw_max, bool) or not isinstance(raw_max, int):
        return _fail("INVALID_MAX_CHARS", "max_chars 必须为整数")
    min_chars = max(0, min(raw_min, _HARD_MAX_CHARS))
    max_chars = max(1, min(raw_max, _HARD_MAX_CHARS))
    if min_chars > max_chars:
        return _fail("INVALID_RANGE", "min_chars 不能大于 max_chars")

    raw_title_chars = arguments.get("title_chars", 0)
    raw_hashtag_count = arguments.get("hashtag_count", 0)
    if isinstance(raw_title_chars, bool) or not isinstance(raw_title_chars, int):
        return _fail("INVALID_TITLE_CHARS", "title_chars 必须为整数")
    if isinstance(raw_hashtag_count, bool) or not isinstance(raw_hashtag_count, int):
        return _fail("INVALID_HASHTAG_COUNT", "hashtag_count 必须为整数")
    if not 0 <= raw_title_chars <= 60:
        return _fail("INVALID_TITLE_CHARS", "title_chars 必须在 0-60")
    if not 0 <= raw_hashtag_count <= 30:
        return _fail("INVALID_HASHTAG_COUNT", "hashtag_count 必须在 0-30")
    title_chars = raw_title_chars
    hashtag_count = raw_hashtag_count

    title_rule = (
        f"标题必须恰好 {title_chars} 个字符"
        if title_chars
        else "标题 30 字以内"
    )
    hashtag_rule = (
        f"hashtags（数组，恰好 {hashtag_count} 个，每个以 # 开头，"
        f"含 1 个大流量词和 {max(0, hashtag_count - 1)} 个精准词）"
        if hashtag_count
        else "hashtags（数组，可空，每个以 # 开头）"
    )

    system_prompt = (
        "你是中文内容创作助手，服务个体创作者和一人公司。"
        "根据用户给的主题写可直接发布的初稿。"
        "只输出一个 JSON 对象，不要 markdown 代码围栏，不要任何解释。"
        f"JSON 字段：title（{title_rule}）、content（正文，纯文本）、{hashtag_rule}。"
        "正文必须满足用户给的字符数区间；语气按用户指定。"
        "不得编造具体数据、人物、案例或资质；不确定的信息不写。"
    )
    platform_label = (platform or "").strip() or "通用"
    tone_label = (tone or "").strip() or "自然口语"
    rules = [
        f"主题：{brief}",
        f"平台：{platform_label}",
        f"语气：{tone_label}",
        f"正文字符数：{min_chars}-{max_chars}",
    ]
    if title_chars:
        rules.append(f"标题字数：{title_chars}")
    if hashtag_count:
        rules.append(f"话题词个数：{hashtag_count}")
    user_prompt = "\n".join(rules)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        from ..core.llm_gateway import llm_gateway
    except Exception:  # noqa: BLE001
        logger.warning("[content] llm_gateway 导入失败", exc_info=True)
        return _fail("LLM_UNAVAILABLE", "模型网关不可用，暂不能生成内容")

    try:
        if llm_gateway._is_stub_mode():
            return _fail("LLM_UNAVAILABLE", "未配置可用模型，暂不能生成内容")
    except Exception:  # noqa: BLE001
        # 探测失败不挡住真正的调用；下面 complete 会给出权威结果。
        pass

    user_id = arguments.get("__user_id")
    session_id = arguments.get("__session_id")
    try:
        result = await llm_gateway.complete(
            messages,
            model="auto",
            owner_uuid=user_id or None,
            billing_user_id=user_id or None,
            conversation_id=session_id or None,
        )
    except Exception:  # noqa: BLE001
        logger.warning("[content] 生成调用失败", exc_info=True)
        return _fail("GENERATION_FAILED", "内容生成失败，请稍后重试")

    if result.get("stub"):
        return _fail("LLM_UNAVAILABLE", "未配置可用模型，暂不能生成内容")
    content = str(result.get("content") or "").strip()
    if not content:
        return _fail("EMPTY_RESULT", "模型没有产出正文，请重试或换个说法")

    title, content, hashtags = _parse_payload(content)
    if not content:
        return _fail("EMPTY_RESULT", "模型没有产出正文，请重试或换个说法")

    count = _char_count(content)
    title_length = len(title)
    within_range = (min_chars == 0 or count >= min_chars) and count <= max_chars
    return {
        "tool": _TOOL_NAME,
        "ok": True,
        "title": title,
        "content": content,
        "hashtags": hashtags,
        "charCount": count,
        "withinRange": within_range,
        "titleLength": title_length,
        "titleWithinRange": (title_chars == 0 or title_length == title_chars),
        "hashtagCount": len(hashtags),
        "range": {"min": min_chars, "max": max_chars},
        "model": str(result.get("model") or ""),
        "usage": result.get("usage") or {},
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
