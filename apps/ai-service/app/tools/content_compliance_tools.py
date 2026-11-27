# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""内容发布前合规自检工具（2026-11-27 立）。

为什么单独成模块：内容链路的第三步是“合规自检”，但此前只有页面和人工习惯，
Agent 调不动。本工具把标题、字数、话题词、绝对化用语、医疗/金融承诺、硬引导
收成一个确定性检查，不调模型、不扣点数、不依赖外部服务。

纪律：
- 只做规则判定，不改稿、不替用户删词；
- 每条阻断/风险都带 evidence，能直接定位；
- 不含涉政涉黄涉暴词库，那类判定必须接平台侧审核，不能假装覆盖；
- 平台字数上限不写死（规则常变），只回传 platform，由调用方补平台规则。
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

_TOOL_NAME = "precheck_content"
_RULES_VERSION = "2026-11-27"
_HARD_MAX_CHARS = 20000
_MAX_TITLE_CHARS = 120
_MAX_HASHTAGS = 30

# 明确违反广告法/平台规则的承诺性表述：命中即阻断。
_BLOCK_CLAIMS: tuple[tuple[str, str], ...] = (
    ("全网第一", "绝对化排名"),
    ("全国第一", "绝对化排名"),
    ("全球第一", "绝对化排名"),
    ("排名第一", "绝对化排名"),
    ("销量第一", "绝对化排名"),
    ("第一品牌", "绝对化排名"),
    ("国家级", "绝对化资质"),
    ("世界级", "绝对化资质"),
    ("顶级", "绝对化用语"),
    ("100%", "绝对化承诺"),
    ("百分之百", "绝对化承诺"),
    ("零风险", "风险承诺"),
    ("稳赚", "收益承诺"),
    ("保本", "收益承诺"),
    ("保收益", "收益承诺"),
    ("包过", "结果承诺"),
    ("根治", "医疗功效承诺"),
    ("治愈", "医疗功效承诺"),
    ("药到病除", "医疗功效承诺"),
    ("无副作用", "医疗安全承诺"),
)

# 可能是正常表达、但在商业内容里容易被判绝对化的词：只提示，不阻断。
_WARN_CLAIMS: tuple[str, ...] = (
    "最好",
    "最佳",
    "唯一",
    "绝对",
    "保证",
    "永久",
    "万能",
)

# 用户明确不要的硬引导；提示而非阻断，避免误伤引用/反例。
_HARD_CTA: tuple[str, ...] = (
    "关注我",
    "点赞关注",
    "一键三连",
    "点赞收藏",
    "转发本条",
    "评论区扣",
    "私信我",
    "加我微信",
    "加V",
)

_PLACEHOLDER_RE = re.compile(r"(TODO|TBD|XXX|xxxx|待补充|待填写|示例文本|{{|}})", re.IGNORECASE)
_AI_DISCLOSURE_MARKERS = ("AI生成", "AI 生成", "人工智能生成", "内容由AI", "内容由 AI", "AI辅助", "AI 辅助")

# 预设档：把用户/矩阵号的固定标准收在一处，避免每次调用重复传五个参数。
_PROFILES: dict[str, dict[str, Any]] = {
    "generic": {
        "min_chars": 0,
        "max_chars": 0,
        "title_length": 0,
        "hashtag_count": 0,
        "require_title": True,
        "require_ai_disclosure": False,
    },
    "ihui_koubo": {
        "min_chars": 470,
        "max_chars": 490,
        "title_length": 16,
        "hashtag_count": 5,
        "require_title": True,
        "require_ai_disclosure": False,
    },
}


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


def _char_count(content: str) -> int:
    """正文字符数：去掉空白后计数，中文按字、英文按字母。"""
    return len(re.sub(r"\s", "", content))


def _parse_hashtags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [part for part in re.split(r"[\s,，、]+", value.strip()) if part]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise TypeError("hashtags 必须是字符串或字符串数组")


def _int_arg(arguments: dict[str, Any], key: str, default: int) -> int:
    value = arguments.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{key} 必须为整数")
    return value


def _bool_arg(arguments: dict[str, Any], key: str, default: bool) -> bool:
    value = arguments.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() not in ("false", "0", "no", "off", "")
    return bool(value)


def _add_check(
    checks: list[dict[str, Any]],
    check_id: str,
    level: str,
    message: str,
    evidence: str = "",
) -> None:
    item: dict[str, Any] = {"id": check_id, "level": level, "message": message}
    if evidence:
        item["evidence"] = evidence[:160]
    checks.append(item)


async def precheck_content(arguments: dict[str, Any]) -> dict[str, Any]:
    """发布前合规自检（工具调用入口）。

    输入: content 必填；title/hashtags/platform 可选；
          profile 可选（generic / ihui_koubo，后者=470-490字/标题16字/5话题词）；
          min_chars/max_chars/title_length/hashtag_count 可选（0 表示不查，显式传参覆盖 profile）。
    返回: {tool, ok, score, blocking, warnings, profile, stats, checks, contentHash}
    """
    if not isinstance(arguments, dict):
        return _fail("INVALID_ARGS", "arguments 必须为 dict")

    content = arguments.get("content")
    if not isinstance(content, str) or not content.strip():
        return _fail("MISSING_CONTENT", "content 必填且不能为空")
    content = content.strip()
    if len(content) > _HARD_MAX_CHARS:
        return _fail("CONTENT_TOO_LONG", f"content 最多 {_HARD_MAX_CHARS} 字")

    title_raw = arguments.get("title")
    if title_raw is not None and not isinstance(title_raw, str):
        return _fail("INVALID_TITLE", "title 必须为字符串")
    title = (title_raw or "").strip()
    if len(title) > _MAX_TITLE_CHARS:
        return _fail("TITLE_TOO_LONG", f"title 最多 {_MAX_TITLE_CHARS} 字")

    try:
        hashtags = _parse_hashtags(arguments.get("hashtags"))
    except TypeError as exc:
        return _fail("INVALID_HASHTAGS", str(exc))
    if len(hashtags) > _MAX_HASHTAGS:
        return _fail("TOO_MANY_HASHTAGS", f"hashtags 最多 {_MAX_HASHTAGS} 个")

    platform = arguments.get("platform")
    if platform is not None and not isinstance(platform, str):
        return _fail("INVALID_PLATFORM", "platform 必须为字符串")
    platform = (platform or "").strip().lower()

    profile_name = arguments.get("profile") or "generic"
    if not isinstance(profile_name, str) or profile_name not in _PROFILES:
        return _fail("INVALID_PROFILE", "profile 仅支持 generic / ihui_koubo")
    defaults = _PROFILES[profile_name]

    try:
        min_chars = _int_arg(arguments, "min_chars", defaults["min_chars"])
        max_chars = _int_arg(arguments, "max_chars", defaults["max_chars"])
        title_length = _int_arg(arguments, "title_length", defaults["title_length"])
        hashtag_count = _int_arg(arguments, "hashtag_count", defaults["hashtag_count"])
    except TypeError as exc:
        return _fail("INVALID_NUMERIC_ARG", str(exc))

    require_title = _bool_arg(arguments, "require_title", defaults["require_title"])
    require_ai_disclosure = _bool_arg(
        arguments, "require_ai_disclosure", defaults["require_ai_disclosure"]
    )

    if not 0 <= min_chars <= _HARD_MAX_CHARS:
        return _fail("INVALID_MIN_CHARS", "min_chars 必须在 0-20000")
    if not 0 <= max_chars <= _HARD_MAX_CHARS:
        return _fail("INVALID_MAX_CHARS", "max_chars 必须在 0-20000")
    if min_chars and max_chars and min_chars > max_chars:
        return _fail("INVALID_RANGE", "min_chars 不能大于 max_chars")
    if not 0 <= title_length <= _MAX_TITLE_CHARS:
        return _fail("INVALID_TITLE_LENGTH", f"title_length 必须在 0-{_MAX_TITLE_CHARS}")
    if not 0 <= hashtag_count <= _MAX_HASHTAGS:
        return _fail("INVALID_HASHTAG_COUNT", f"hashtag_count 必须在 0-{_MAX_HASHTAGS}")

    checks: list[dict[str, Any]] = []
    count = _char_count(content)
    # 标题和话题词同样是公开文本，承诺词/硬引导必须一起扫。
    scan_text = "\n".join([title, " ".join(hashtags), content])

    # 标题
    if require_title and not title:
        _add_check(checks, "title.missing", "block", "缺少标题；发布前必须补标题")
    if title:
        if "#" in title:
            _add_check(checks, "title.hash", "block", "标题不能带 # 号，话题词应单独放", "#")
        if "\n" in title or "\r" in title:
            _add_check(checks, "title.newline", "warn", "标题含换行，发布前应收成一行")
        if title.startswith(("标题：", "标题:")):
            _add_check(checks, "title.prefix", "warn", "标题不要带“标题：”前缀", title[:12])
        if title_length and len(title) != title_length:
            _add_check(
                checks,
                "title.length",
                "block",
                f"标题应为 {title_length} 字，当前 {len(title)} 字",
                f"{len(title)} 字",
            )

    # 正文
    if min_chars and count < min_chars:
        _add_check(
            checks,
            "body.range",
            "block",
            f"正文少于下限 {min_chars} 字，当前 {count} 字",
            f"{count} 字",
        )
    elif max_chars and count > max_chars:
        _add_check(
            checks,
            "body.range",
            "block",
            f"正文超过上限 {max_chars} 字，当前 {count} 字",
            f"{count} 字",
        )
    placeholder = _PLACEHOLDER_RE.search(content)
    if placeholder:
        _add_check(checks, "body.placeholder", "warn", "正文含占位符，发布前必须替换", placeholder.group(0))

    # 绝对化/承诺性表述
    block_hits = [phrase for phrase, _ in _BLOCK_CLAIMS if phrase in scan_text]
    if block_hits:
        _add_check(
            checks,
            "claim.block",
            "block",
            "命中绝对化或承诺性表述，发布前必须改",
            "、".join(block_hits[:8]),
        )
    warn_hits = [phrase for phrase in _WARN_CLAIMS if phrase in scan_text]
    if warn_hits:
        _add_check(
            checks,
            "claim.warn",
            "warn",
            "命中易被判绝对化的词，建议改成可验证表述",
            "、".join(warn_hits[:8]),
        )

    # 硬引导
    cta_hits = [phrase for phrase in _HARD_CTA if phrase in scan_text]
    if cta_hits:
        _add_check(
            checks,
            "cta.hard",
            "warn",
            "出现硬引导，建议改成自然收束",
            "、".join(cta_hits[:8]),
        )

    # 话题词
    if hashtag_count and len(hashtags) != hashtag_count:
        _add_check(
            checks,
            "hashtag.count",
            "block",
            f"话题词应为 {hashtag_count} 个，当前 {len(hashtags)} 个",
            f"{len(hashtags)} 个",
        )
    bad_format = [tag for tag in hashtags if not tag.startswith("#") or tag == "#"]
    if bad_format:
        _add_check(
            checks,
            "hashtag.format",
            "warn",
            "话题词必须以 # 开头且 # 后不能为空",
            "、".join(bad_format[:8]),
        )
    spaced = [tag for tag in hashtags if re.search(r"\s", tag)]
    if spaced:
        _add_check(checks, "hashtag.space", "warn", "话题词内不能有空格", "、".join(spaced[:8]))
    duplicated = sorted({tag for tag in hashtags if hashtags.count(tag) > 1})
    if duplicated:
        _add_check(checks, "hashtag.duplicate", "warn", "话题词重复", "、".join(duplicated[:8]))

    # AI 标识
    if require_ai_disclosure and not any(marker in scan_text for marker in _AI_DISCLOSURE_MARKERS):
        _add_check(
            checks,
            "ai.disclosure",
            "warn",
            "未发现 AI 生成标识；平台要求标注时需补",
            "AI生成",
        )

    blocking = sum(1 for item in checks if item["level"] == "block")
    warnings = sum(1 for item in checks if item["level"] == "warn")
    return {
        "tool": _TOOL_NAME,
        "ok": blocking == 0,
        "rulesVersion": _RULES_VERSION,
        "score": max(0, 100 - blocking * 25 - warnings * 5),
        "blocking": blocking,
        "warnings": warnings,
        "stats": {
            "charCount": count,
            "titleLength": len(title),
            "hashtagCount": len(hashtags),
        },
        "platform": platform,
        "profile": profile_name,
        "contentHash": hashlib.sha256(
            "\n".join([title, "|".join(hashtags), content]).encode("utf-8")
        ).hexdigest()[:16],
        "checks": checks,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
