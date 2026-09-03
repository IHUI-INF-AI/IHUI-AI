# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""

Prompt 注入防护服务 — 外部不可信文本 → agent 上下文的统一守卫(2026-09-03 立)。

背景: 当 agent 消费外部不可信内容( web 抓取文本、邮件/消息正文、MCP 工具返回结果、
上传文件)时, 其中可能夹带恶意指令, 诱导 agent 执行危险操作/窃取敏感信息。
本服务提供"检测 → 分层防护(flag / sanitize / refuse)"三层策略, 作为所有
"外部 → agent 上下文"边界的统一守卫。默认只读探测, 不修改任何既有流程。

设计原则:
- 确定性: 全部用关键词 + 正则 + 引号/标签/编码启发式, 不用 LLM, 结果可复测。
- 低误报: 关键词一律要求带"指令性宾语"(ignore 必须接到 instructions/rules 等,
  系统提示必须成标签/提示语), 尾部附 EXEMPTIONS 规避常见合法文本
  (技术文档里的 "ignore the above line"、纯闲聊 "forget it" 等)。
- 可配置: languages={english|chinese|both} 切换中/英关键词, source 限定边界。

检测类型(6 类, 含 severity 分层 high / med / low):
    instruction_overwrite  指令越权  (ignore/override 既有指令)      → high
    constraint_bypass      诱导忽略约束(绕过安全/忘记规则)          → med
    fake_system_prompt     伪系统提示(<system> / <|im_start|> / 系统提示) → high
    secret_exfiltration    敏感信息窃取(reveal your system prompt)  → high
    tool_hijack            工具调劫持(调用 shell / mcp / 函数)       → med
    marker_obfuscation     注入标记混淆(base64 / 混淆指令段)         → high/med

策略层 act(input, source, policy):
    flag      — 仅打标, 返回原文 + hits
    sanitize  — 弱命中剥离包裹注入标签(系统提示标签 / URL 包裹 / base64 指令段),
                保留正文; 强命中(不可剥离的高危文本指令)整体降级
    refuse    — risk>=high 直接拒绝, 返回结构化"疑似注入已拦截"; 低危仅打标

接入函数:
    guard_text(text, source, policy, languages)        便捷封装 = act
    PromptGuard.verify(text, source, policy, languages) 静态封装, 供注入式调用
    act(...) / detect_injections(...)                  核心 API
"""

from __future__ import annotations

# 规则表几乎都是长正则, 显式豁免行宽限制(与仓库整体一致使用 noqa 风格)。
# ruff: noqa: E501
import base64
import binascii
import re
from dataclasses import dataclass, field
from typing import Any

# ==================== 常量与自省 ====================

SOURCE_ALLOWED = ("web", "mcp", "message", "file")
POLICY_ALLOWED = ("flag", "sanitize", "refuse")
LANGUAGE_ALLOWED = ("english", "chinese", "both")
SEVERITY_ORDER = {"high": 3, "med": 2, "low": 1}

# 命中类型 → (默认严重度, 中文说明)
HIT_TYPES: dict[str, tuple[str, str]] = {
    "instruction_overwrite": ("high", "指令越权"),
    "constraint_bypass": ("med", "诱导忽略约束"),
    "fake_system_prompt": ("high", "伪系统提示"),
    "secret_exfiltration": ("high", "敏感信息窃取"),
    "tool_hijack": ("med", "工具调劫持"),
    "marker_obfuscation": ("high", "注入标记混淆"),
}

# 规避误报: 出现在常见合法文本(技术文档/闲聊/教学)中、貌似注入但实际无害的词组。
EXEMPTIONS: tuple[re.Pattern[str], ...] = (
    re.compile(r"ignore the above line", re.IGNORECASE),
    re.compile(r"// *ignore (?:the )?(?:above|previous|next) (?:line|item)", re.IGNORECASE),
    re.compile(r"\\n *# *ignore", re.IGNORECASE),
    re.compile(r"\bforget it\b", re.IGNORECASE),
    re.compile(r"\bplease forget (?:the|that|this) (?:previous|last) (?:message|comment|sentence) in chat history", re.IGNORECASE),
    re.compile(r"\bforgot to\b", re.IGNORECASE),
    re.compile(r"\bignore (?:me|the audience|the noise|that)\b", re.IGNORECASE),
    re.compile(r"\bignore (?:errors?|warnings?|failures?|exceptions?)\b", re.IGNORECASE),
)

# 尾部小字免责声明: 命中此段的不算注入(用户生成的"内容含以上文字是模拟"之类的自我引用)。
_TAIL_DENY_STRINGS = (
    "以上为示例",
    "以上是模拟攻击示例",
    "仅供教育或测试",
    "xss-protection",
    "prompt-injection-guard",
)
_SNIPPET_PAD = 15


# ==================== 命中结果 ====================


@dataclass
class InjectionHit:
    """单条注入命中。start/end 为在原文中的字符区间。"""

    type: str
    severity: str        # high | med | low
    start: int
    end: int
    snippet: str         # 命中上下文(用于定位)
    source: str          # web | mcp | message | file
    rationale: str       # 一条命中一条理由(不造大规则库)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "severity": self.severity,
            "start": self.start,
            "end": self.end,
            "snippet": self.snippet,
            "source": self.source,
            "rationale": self.rationale,
        }


@dataclass
class DetectionResult:
    """一次探测结果。risk_level 由最高 severity 推导。"""

    hits: list[InjectionHit] = field(default_factory=list)
    source: str = "web"

    @property
    def risky(self) -> bool:
        return bool(self.hits)

    @property
    def risk_level(self) -> str:
        """无命中 low; 有 high→high; 有 med→med; 否则 low。"""
        if not self.hits:
            return "low"
        top = max((SEVERITY_ORDER[h.severity] for h in self.hits), default=1)
        for level in ("high", "med", "low"):
            if SEVERITY_ORDER[level] == top:
                return level
        return "low"

    def to_dict(self) -> dict[str, Any]:
        return {"risk_level": self.risk_level, "hits": [h.to_dict() for h in self.hits]}


# ==================== 规则表 ====================

# (lang, regex, type, severity, rationale)
# lang: "neutral"(中英同用) / "english" / "chinese"


def _r(
    lang: str, pattern: str, hit_type: str, severity: str, rationale: str
) -> tuple[str, re.Pattern[str], str, str, str]:
    return (lang, re.compile(pattern, re.IGNORECASE), hit_type, severity, rationale)


_RULES: tuple[tuple[str, re.Pattern[str], str, str, str], ...] = (
    # ---- 伪系统提示(标签, neutral) ----
    _r("neutral", r"<\s*/?\s*[|/]*\s*(?:system|assistant|tool|task|role)\s*[|>:]", "fake_system_prompt", "high", "出现 system/assistant 等伪标签包裹文本"),
    _r("neutral", r"<\|?\s*im_(?:start|end)\s*\|?>", "fake_system_prompt", "high", "检测到聊天协议标签 <|im_start|>/<|im_end|>"),
    # ---- 指令越权(english, high) ----
    _r("english", r"ignore\s+(?:all\s+)?(?:previous|prior|above|your|earlier|the\s+above)\s+(?:instructions?|prompts?|rules?|guidelines?|messages?)", "instruction_overwrite", "high", "指令要求忽略此前指令"),
    _r("english", r"override\s+(?:your\s+|the\s+|all\s+)?(?:instructions?|rules?|guidelines?)", "instruction_overwrite", "high", "指令要求覆盖本方设定"),
    _r("english", r"disregard\s+(?:all\s+)?(?:previous|prior|above|the\s+above)\s+(?:instructions?|rules?|guidelines?)", "instruction_overwrite", "high", "指令要求无视上文"),
    _r("english", r"(?:from\s+now\s+on|from\s+this\s+point\s+on),\s*(?:you\s+)?(?:ignore|disregard|forget|never\s+follow)", "instruction_overwrite", "high", "时间点引导的永久性越权指令"),
    _r("english", r"you\s+are\s+(?:now\s+|going\s+to\s+be\s+)?(?:a\s+)?(?:hacker|developer|assistant)", "instruction_overwrite", "high", "重写角色为受控角色(you are now a ...)"),
    _r("english", r"act\s+as\s+(?:if\s+you\s+are\s+)?(?:an?\s+)?(?:unfiltered|uncensored|hacker|admin)", "instruction_overwrite", "high", "诱导切换为不受限身份"),
    # ---- 诱导忽略约束(english, med) ----
    _r("english", r"bypass\s+(?:the\s+|your\s+|all\s+)?(?:safety|security|content|restriction|filter|moderation)", "constraint_bypass", "med", "绕过安全/内容过滤"),
    _r("english", r"ignore\s+(?:all\s+)?(?:safety|security|content|consent)\s+(?:guidelines?|policies?|filters?|rules?)", "constraint_bypass", "med", "要求忽略安全准则"),
    _r("english", r"forget\s+(?:everything|all)(?:\s+you)?(?:\s+were\s+(?:told|given|learned))?", "constraint_bypass", "med", "要求遗忘既有约束"),
    _r("english", r"without\s+(?:any\s+)?(?:restrictions?|constraints?|limits)|remove\s+(?:all\s+)?(?:restrictions?|constraints|limits)", "constraint_bypass", "med", "要求取消限制"),
    # ---- 敏感信息窃取(english, high) ----
    _r("english", r"reveal\s+(?:your|the)\s+(?:system\s+prompt|instructions?|prompts?|rules?|api\s*keys?)", "secret_exfiltration", "high", "要求泄露系统提示/密钥"),
    _r("english", r"(?:print|output|show|display|dont\s+skip\s+showing)\s+(?:your|the)\s+(?:system\s+prompt|instructions?)", "secret_exfiltration", "high", "要求输出内部指令"),
    _r("english", r"(?:give\s+me|hand\s+me)\s+(?:your\s+)?(?:api\s*key|system\s+prompt|instructions?)", "secret_exfiltration", "high", "直接索取密钥/指令"),
    _r("english", r"(?:expose|leak|dump)\s+(?:your\s+)?(?:api\s*key|credentials?|token|password)", "secret_exfiltration", "high", "要求泄露凭据"),
    # ---- 工具调劫持(english, med) ----
    _r("english", r"call\s+(?:the\s+|your\s+)?(?:shell|exec|bash|executor|runner)\s+(?:tool|function|command)", "tool_hijack", "med", "诱导调用 shell 执行类工具"),
    _r("english", r"(?:invoke|call)\s+(?:the\s+|your\s+)?(?:mcp\s+tool|function\s+named|[a-z_]+_tool)", "tool_hijack", "med", "诱导调用未知工具/函数"),
    _r("english", r"(?:execute|run)\s+(?:this|the\s+following|the|this\s+code)\s*(?:command|code|script)?", "tool_hijack", "med", "诱导执行命令/脚本"),
    _r("english", r"send\s+(?:an?\s+|a\s+test\s+)?email\s+to|post\s+(?:this\s+)?to\s+(?:the\s+)?(?:url|endpoint|webhook)", "tool_hijack", "med", "诱导发送邮件/外呼"),
    # ---- 中文: 伪系统提示 ----
    _r("chinese", r"(?:系统提示|系统人设|系统消息|新的指令|新指令)\s*[:：]", "fake_system_prompt", "high", "出现系统提示冒号引导"),
    # ---- 中文: 指令越权 ----
    _r("chinese", r"忽略(?:之前|以上|上方|前面|先前|以上所有)(?:的)?(?:所有|一切|全部)?(?:指令|指示|命令|提示|规则)", "instruction_overwrite", "high", "要求忽略既有指令"),
    _r("chinese", r"无视(?:之前|以上|前面的|之前的)(?:的)?(?:所有|一切|全部)?(?:指令|指示|规则|约束|命令)", "instruction_overwrite", "high", "要求无视既有指令"),
    _r("chinese", r"(?:覆盖|推翻|更改|改变)(?:你的|你之前的)(?:指令|规则|设定|人设)", "instruction_overwrite", "high", "要求覆盖设定"),
    _r("chinese", r"(?:从现在起|从今(?:以后|之后))(?:,|,)?\s*.*(?:忽略|无视|不要再听|不要再遵循)", "instruction_overwrite", "high", "时间点引导永久越权"),
    _r("chinese", r"(?:你现在是|从今天起你是|你将扮演|你是全新的)", "instruction_overwrite", "high", "重写角色"),
    # ---- 中文: 诱导忽略约束 ----
    _r("chinese", r"(?:绕过|无视|取消)(?:安全|护栏|内容|限制|约束|检测|审核)", "constraint_bypass", "med", "绕过安全/审核"),
    _r("chinese", r"忘记(?:了)?(?:之前|过去|以前)(?:的)?(?:一切|所有|全部|内容)", "constraint_bypass", "med", "要求遗忘既有约束"),
    _r("chinese", r"不受(?:任何)?限制|无(?:任何)?限制", "constraint_bypass", "med", "要求取消限制"),
    # ---- 中文: 敏感信息窃取 ----
    _r("chinese", r"(?:泄露|公布|交出|展示)(?:你(?:的)?|system\s+)?(?:系统提示|system\s+prompt|指令|api\s*密钥|api\s*key)", "secret_exfiltration", "high", "要求泄露系统提示/密钥"),
    _r("chinese", r"(?:告诉我|给我)(?:你(?:的)?)(?:系统提示|全部指令|api\s*key)", "secret_exfiltration", "high", "直接索取内部指令"),
    # ---- 中文: 工具调劫持 ----
    _r("chinese", r"(?:调用|触发)(?:工具|函数|接口)", "tool_hijack", "med", "诱导调用工具/接口"),
    _r("chinese", r"执行(?:以下|下面|这些|此)(?:命令|代码|指令|脚本)", "tool_hijack", "med", "诱导执行命令/脚本"),
)


def _select_rules(languages: str) -> list[tuple[re.Pattern[str], str, str, str]]:
    """按语言过滤规则, 返回 [(regex, type, severity, rationale)]。neutral 始终保留。"""
    out = []
    for lang, regex, hit_type, severity, rationale in _RULES:
        if lang == "neutral" or lang == languages or languages == "both":
            out.append((regex, hit_type, severity, rationale))
    return out


# ==================== 混淆(base64)启发式 ====================

_B64_TOKEN = re.compile(r"[A-Za-z0-9+/]{16,}={0,2}")
_OBFUSCATED_HINT = re.compile(r"(?:base64|decod_e?d?|encoded|obfuscated|url-safe)", re.IGNORECASE)


def _decode_candidate(token: str) -> str | None:
    candidate = token + "=" * ((4 - len(token) % 4) % 4)
    for encode in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            raw = encode(candidate)
            try:
                return raw.decode("utf-8", errors="ignore")
            except Exception:
                return None
        except (binascii.Error, ValueError):
            continue
    return None


def _find_obfuscated(text: str, source: str, languages: str) -> list[InjectionHit]:
    """探测 base64 混淆指令段。解码后命中指令关键词 → marker_obfuscation。"""
    hints = _select_obfuscation_regexes(languages)
    hits: list[InjectionHit] = []
    for m in _B64_TOKEN.finditer(text):
        decoded = _decode_candidate(m.group())
        if decoded and hints and _contains_injection(decoded, hints):
            hits.append(
                _make_hit(
                    hit_type="marker_obfuscation",
                    severity="high",
                    start=m.start(),
                    end=m.end(),
                    snippet=_build_snippet(text, m.start(), m.end()),
                    source=source,
                    rationale=f"base64 混淆段解码后含注入指令: {decoded[:40]!r}",
                )
            )
    return hits


def _select_obfuscation_regexes(languages: str) -> list[re.Pattern[str]]:
    base = []
    # 复用指令类关键词(拆分为可跨语言匹配的短词), 供解码后内容比对
    for regex, hit_type, _sev, _rat in _select_rules(languages):
        if hit_type in ("instruction_overwrite", "secret_exfiltration", "constraint_bypass", "tool_hijack", "fake_system_prompt"):
            base.append(regex)
    return base


def _contains_injection(decoded: str, regexes: list[re.Pattern[str]]) -> bool:
    return any(rx.search(decoded) for rx in regexes)


# ==================== 探测主入口 ====================


def _check_source(source: str) -> None:
    if source not in SOURCE_ALLOWED:
        raise ValueError(f"source 必须是 {SOURCE_ALLOWED} 之一, 收到 {source!r}")


def _build_snippet(text: str, start: int, end: int) -> str:
    lo = max(0, start - _SNIPPET_PAD)
    hi = min(len(text), end + _SNIPPET_PAD)
    head = "…" if lo > 0 else ""
    tail = "…" if hi < len(text) else ""
    return f"{head}{text[lo:hi]}{tail}"


def _make_hit(
    hit_type: str,
    severity: str,
    start: int,
    end: int,
    snippet: str,
    source: str,
    rationale: str,
) -> InjectionHit:
    default_sev, _label = HIT_TYPES.get(hit_type, ("med", ""))
    effective = severity if severity in SEVERITY_ORDER else default_sev
    return InjectionHit(
        type=hit_type,
        severity=effective,
        start=start,
        end=end,
        snippet=snippet,
        source=source,
        rationale=rationale,
    )


def detect_injections(
    text: str,
    source: str = "web",
    languages: str = "both",
) -> DetectionResult:
    """检测文本中的 prompt 注入, 返回命中列表与 risk_level。

    Args:
        text: 外部不可信文本内容
        source: 内容来源 web|mcp|message|file
        languages: english|chinese|both 关键词语言集合
    """
    _check_source(source)
    if not text or not isinstance(text, str):
        return DetectionResult(hits=[], source=source)

    rules = _select_rules(languages)
    hits: list[InjectionHit] = []
    seen: set[tuple[str, int, int, str]] = set()

    for regex, hit_type, severity, rationale in rules:
        for m in regex.finditer(text):
            span = m.span()
            if span[1] <= span[0]:
                continue
            snip_span = text[span[0] : min(len(text), span[0] + 90 + span[1] - span[0])]
            if _is_exempt(text, span, snip_span):
                continue
            key = (hit_type, span[0], span[1], severity)
            if key in seen:
                continue
            seen.add(key)
            hits.append(
                _make_hit(
                    hit_type=hit_type,
                    severity=severity,
                    start=span[0],
                    end=span[1],
                    snippet=_build_snippet(text, span[0], span[1]),
                    source=source,
                    rationale=f"{rationale}; 命中片段={snip_span[:40]!r}",
                )
            )

    hits.extend(_find_obfuscated(text, source, languages))
    # 去重 + 排序
    unique: list[InjectionHit] = []
    uniq_keys: set[tuple[str, int, int]] = set()
    for h in sorted(hits, key=lambda x: (x.start, x.end)):
        k = (h.type, h.start, h.end)
        if k in uniq_keys:
            continue
        uniq_keys.add(k)
        unique.append(h)
    return DetectionResult(hits=unique, source=source)


def _is_exempt(text: str, span: tuple[int, int], snip_span: str) -> bool:
    """命中是否命中规避表(合法技术文档/闲聊): 仅当规避短语与命中区间重叠。"""
    lo, hi = span
    window = text[max(0, lo - 20) : min(len(text), hi + 20)]
    for ex in EXEMPTIONS:
        for m in ex.finditer(window):
            win_start = max(0, lo - 20) + m.start()
            win_end = max(0, lo - 20) + m.end()
            if win_end > lo and win_start < hi:  # 与命中区间重叠
                return True
    window2 = text[max(0, lo - 200) : hi].strip().lower()
    return any(tok in window2 for tok in _TAIL_DENY_STRINGS)


# ==================== 策略层 ====================


def _downgraded_output(hits: list[InjectionHit]) -> str:
    types = ",".join(sorted({h.type for h in hits})) or "suspected-injection"
    return f"[prompt_guard:downgraded] 命中疑似 prompt 注入({types}), 内容已整体降级并阻止进入 agent 上下文。"


def _refused_output(hits: list[InjectionHit], risk: str) -> str:
    types = ",".join(sorted({h.type for h in hits})) or "suspected-injection"
    return f"[prompt_guard:refused] 疑似注入已拦截 (risk_level={risk}, types={types}); 原文不进入 agent 上下文。"


def _sanitize(text: str, hits: list[InjectionHit]) -> tuple[str, str]:
    """返回 (处理后文本, action)。可剥离的包裹标签/编码段→剥离; 强命中→整体降级。"""
    if not hits:
        return text, "pass"

    removals: list[tuple[int, int]] = []
    removed_keys: set[tuple[str, int, int]] = set()

    for h in hits:
        span = (h.start, h.end)
        # 可剥离: 伪系统提示标签(只剥 <...> 标签本身)、base64 标记混淆段(整段)。
        if h.type == "fake_system_prompt":
            # 只剥标签 token(<system> / </system> / <|im_start|>), 保留正文
            tag = text[h.start : h.end]
            if re.search(r"<[^> ]*>", tag) or "<" in tag:
                removals.append(span)
                removed_keys.add((h.type, h.start, h.end))
        elif h.type == "marker_obfuscation":
            removals.append(span)
            removed_keys.add((h.type, h.start, h.end))

    # URL 包裹: Markdown 链接 [指令文本](url) → 仅去掉 (url) 部分, 保留正文
    cleaned = re.sub(r"\]\s*\(\s*(?:https?://|data:|//)[^)\s]*\s*\)", "\u3011", text)

    for start, end in sorted(removals, reverse=True):
        if start < end <= len(cleaned):
            cleaned = cleaned[:start] + cleaned[end:]

    remaining_high = [h for h in hits if h.severity == "high" and (h.type, h.start, h.end) not in removed_keys]
    if remaining_high:
        return _downgraded_output(hits), "sanitize"

    return cleaned, ("sanitize" if cleaned != text or removals else "pass")


def act(
    input_text: str,
    source: str = "web",
    policy: str = "flag",
    languages: str = "both",
) -> dict[str, Any]:
    """统一防护入口。

    Returns:
        {action, risk_level, output, hits}
        - flag:     action="flag"(有命中) 或 "pass";  output=原文
        - sanitize: 剥离包裹标签 / 保留正文 / 强命中整体降级; output=处理后文本
        - refuse:   risk>=high 时 action="refuse", blocked=True, output=结构化拦截提示
    """
    _check_source(source)
    if policy not in POLICY_ALLOWED:
        raise ValueError(f"policy 必须是 {POLICY_ALLOWED} 之一, 收到 {policy!r}")

    res = detect_injections(input_text, source, languages)
    risk = res.risk_level
    hits = [h.to_dict() for h in res.hits]

    if policy == "flag":
        return {
            "action": "flag" if res.hits else "pass",
            "risk_level": risk,
            "output": input_text,
            "hits": hits,
        }

    if policy == "sanitize":
        out, action = _sanitize(input_text, res.hits)
        return {"action": action, "risk_level": risk, "output": out, "hits": hits}

    # refuse
    if risk in ("high",):
        return {
            "action": "refuse",
            "risk_level": risk,
            "output": _refused_output(res.hits, risk),
            "hits": hits,
            "blocked": True,
        }
    return {
        "action": "flag",
        "risk_level": risk,
        "output": input_text,
        "hits": hits,
        "blocked": False,
    }


# ==================== 接入函数(最小接口, 默认关闭, 不接入 agent_loop_v2) ====================


def guard_text(
    text: str,
    source: str = "web",
    policy: str = "flag",
    languages: str = "both",
) -> dict[str, Any]:
    """便捷封装: 等价 act()。供各边界(web 抓取 / MCP 返回 / 消息 / 文件)直接调用。

    设计为默认 policy="flag"(只打标不改内容), 调用方按风险自行决策;
    需要强拦截的边界可显式传 policy="refuse"。接入点位见 README / 模块 docstring。
    """
    return act(text, source=source, policy=policy, languages=languages)


class PromptGuard:
    """可注入式静态封装: 供其它防护层(.middleware / 路由守卫)以依赖注入方式调用。

    示例(别处代码注入调用, 本模块默认不强制接入):
        result = PromptGuard.verify(scraped_text, source="web", policy="refuse")
        if result["action"] == "refuse":  raise ToolError(result["output"])
    """

    @staticmethod
    def verify(
        text: str,
        source: str = "web",
        policy: str = "flag",
        languages: str = "both",
    ) -> dict[str, Any]:
        return act(text, source=source, policy=policy, languages=languages)


def verify_guard(
    text: str,
    source: str = "web",
    policy: str = "flag",
    languages: str = "both",
) -> dict[str, Any]:
    """模块级静态封装(等价 PromptGuard.verify)。"""
    return PromptGuard.verify(text, source=source, policy=policy, languages=languages)


__all__ = [
    "SOURCE_ALLOWED",
    "POLICY_ALLOWED",
    "LANGUAGE_ALLOWED",
    "SEVERITY_ORDER",
    "HIT_TYPES",
    "InjectionHit",
    "DetectionResult",
    "detect_injections",
    "act",
    "guard_text",
    "PromptGuard",
    "verify_guard",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
