"""Bug-143: Prompt 注入过滤.
设计:
  - 检测常见注入模式 (ignore previous, system override 等)
  - 角色扮演检测 (DAN, jailbreak, 越狱提示)
  - 敏感指令 (reveal system prompt, ignore rules)
  - 分级: SAFE / SUSPICIOUS / MALICIOUS
  - 沙箱模式: 自动转义/截断
  - 输出侧: 检测是否包含敏感信息泄漏
"""

from __future__ import annotations

import re
import threading
import unicodedata
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ThreatLevel(StrEnum):
    SAFE = "SAFE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class Threat:
    level: ThreatLevel
    category: str
    pattern: str
    matched_text: str = ""
    position: int = -1


@dataclass
class ScanResult:
    text: str
    is_safe: bool
    level: ThreatLevel
    threats: list[Threat] = field(default_factory=list)
    sanitized: str = ""
    blocked: bool = False


_INJECTION_PATTERNS = [
    # 忽略之前指令
    (
        r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)",
        ThreatLevel.CRITICAL,
        "ignore_previous",
    ),
    (r"forget\s+(all\s+)?(previous|prior|above)", ThreatLevel.HIGH, "forget_previous"),
    (r"disregard\s+(all\s+)?(previous|prior)", ThreatLevel.HIGH, "disregard_previous"),
    (r"override\s+(system|all|any)", ThreatLevel.CRITICAL, "override_system"),
    # 角色扮演 / 越狱
    (r"\bDAN\b", ThreatLevel.HIGH, "dan_jailbreak"),
    (r"jailbreak", ThreatLevel.HIGH, "jailbreak_keyword"),
    (r"developer\s*mode", ThreatLevel.HIGH, "developer_mode"),
    (r"(act|pretend|behave)\s+as\s+(a\s+)?(an?\s+)?(evil|unfiltered|unrestricted)", ThreatLevel.HIGH, "evil_roleplay"),
    (r"do\s+anything\s+now", ThreatLevel.HIGH, "do_anything_now"),
    # 系统提示泄漏
    (r"(reveal|show|print|leak)\s+(the\s+)?(system|initial)\s+prompt", ThreatLevel.CRITICAL, "reveal_system_prompt"),
    (r"what\s+(is|are)\s+your\s+(system\s+)?prompt", ThreatLevel.MEDIUM, "ask_system_prompt"),
    (r"print\s+your\s+instructions", ThreatLevel.HIGH, "print_instructions"),
    # 越权指令
    (r"bypass\s+(safety|filter|content)", ThreatLevel.CRITICAL, "bypass_safety"),
    (r"no\s+(rules?|restrictions?|filters?)", ThreatLevel.MEDIUM, "no_restrictions"),
    # Prompt 注入标记
    (r"<\|im_start\|>", ThreatLevel.HIGH, "im_start_token"),
    (r"<\|im_end\|>", ThreatLevel.HIGH, "im_end_token"),
    (r"<\|system\|>", ThreatLevel.CRITICAL, "system_token"),
    (r"###\s*instruction", ThreatLevel.MEDIUM, "instruction_header"),
    # 危险请求
    (r"(how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive))", ThreatLevel.CRITICAL, "dangerous_howto"),
    (r"(hack|exploit|attack)\s+(a\s+)?(system|server|account)", ThreatLevel.HIGH, "hack_request"),
    # 数据外泄
    (r"(exfiltrate|steal|leak)\s+(user\s+)?data", ThreatLevel.CRITICAL, "data_exfil"),
    # 伪装成系统
    (r"\[system\]", ThreatLevel.HIGH, "fake_system_tag"),
    (r"<<\s*SYS\s*>>", ThreatLevel.HIGH, "fake_sys_tag"),
]

# Unicode 隐藏字符 (零宽字符等)
_HIDDEN_CHARS = {
    "\u200b",  # zero-width space
    "\u200c",  # zero-width non-joiner
    "\u200d",  # zero-width joiner
    "\u2060",  # word joiner
    "\ufeff",  # BOM
}


@dataclass
class InjectionConfig:
    block_critical: bool = True
    block_high: bool = True
    block_medium: bool = False
    strip_hidden_chars: bool = True
    normalize_unicode: bool = True
    max_length: int = 32000
    custom_patterns: list[tuple[str, ThreatLevel, str]] = field(default_factory=list)


class PromptInjectionGuard:
    """Prompt 注入防护器."""

    def __init__(self, config: InjectionConfig | None = None) -> None:
        self.config = config or InjectionConfig()
        self._lock = threading.RLock()
        self._patterns: list[tuple[re.Pattern, ThreatLevel, str]] = []
        self._compile_patterns()
        self._stats = {"scanned": 0, "blocked": 0, "sanitized": 0, "passed": 0}

    def _compile_patterns(self) -> None:
        all_pats = list(_INJECTION_PATTERNS) + list(self.config.custom_patterns)
        self._patterns = [(re.compile(p, re.IGNORECASE | re.MULTILINE), lvl, cat) for p, lvl, cat in all_pats]

    def add_pattern(self, pattern: str, level: ThreatLevel, category: str) -> None:
        with self._lock:
            self._patterns.append((re.compile(pattern, re.IGNORECASE | re.MULTILINE), level, category))

    def _strip_hidden(self, text: str) -> str:
        if self.config.normalize_unicode:
            text = unicodedata.normalize("NFKC", text)
        if self.config.strip_hidden_chars:
            text = "".join(c for c in text if c not in _HIDDEN_CHARS)
        return text

    def scan(self, text: str) -> ScanResult:
        if not isinstance(text, str):
            return ScanResult(text="", is_safe=True, level=ThreatLevel.SAFE, sanitized=str(text))
        with self._lock:
            self._stats["scanned"] += 1
        original = text
        cleaned = self._strip_hidden(text)
        if len(cleaned) > self.config.max_length:
            cleaned = cleaned[: self.config.max_length]
        threats: list[Threat] = []
        for pat, lvl, cat in self._patterns:
            m = pat.search(cleaned)
            if m:
                threats.append(
                    Threat(
                        level=lvl, category=cat, pattern=pat.pattern, matched_text=m.group(0)[:100], position=m.start()
                    )
                )
        max_level = ThreatLevel.SAFE
        _order = [ThreatLevel.SAFE, ThreatLevel.LOW, ThreatLevel.MEDIUM, ThreatLevel.HIGH, ThreatLevel.CRITICAL]
        for t in threats:
            if _order.index(t.level) > _order.index(max_level):
                max_level = t.level
        blocked = False
        if (max_level == ThreatLevel.CRITICAL and self.config.block_critical) or (max_level == ThreatLevel.HIGH and self.config.block_high) or (max_level == ThreatLevel.MEDIUM and self.config.block_medium):
            blocked = True
        sanitized = cleaned
        if _order.index(max_level) >= _order.index(ThreatLevel.MEDIUM):
            for t in threats:
                if _order.index(t.level) >= _order.index(ThreatLevel.MEDIUM):
                    sanitized = sanitized.replace(t.matched_text, "[FILTERED]")
            with self._lock:
                self._stats["sanitized"] += 1
        with self._lock:
            if blocked:
                self._stats["blocked"] += 1
            else:
                self._stats["passed"] += 1
        return ScanResult(
            text=original,
            is_safe=not blocked,
            level=max_level,
            threats=threats,
            sanitized=sanitized,
            blocked=blocked,
        )

    def assert_safe(self, text: str) -> None:
        r = self.scan(text)
        if r.blocked:
            raise ValueError(f"Prompt 注入拦截: {r.level.value}, {len(r.threats)} 个威胁")

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._stats)
