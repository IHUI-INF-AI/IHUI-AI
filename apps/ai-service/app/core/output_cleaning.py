# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具输出净化与模糊匹配(2026-09-18 第十一批,对标 Codex ansi-escape 与
file-search/nucleo 模糊排序;第十五批补 secrets/sanitizer 密钥脱敏)。

- strip_ansi:剥离终端 ANSI 转义序列(CSI/OSC/单字符),防止 cmd/PowerShell
  输出里的颜色码污染模型上下文。
- fuzzy_score:fzf 风格子序列模糊匹配评分(连续命中/词首/路径段首加分),
  用于 file_search 模糊文件名排序(codex 用 nucleo 引擎,此处纯 Python 等价)。
- redact_secrets:出库边界的密钥脱敏(对标 codex secrets::redact_secrets),
  防模型读 .env / 跑 env / 抓日志时把真实密钥带进上下文、SSE 与 transcript。
"""

import re

__all__ = ["strip_ansi", "fuzzy_score", "redact_secrets"]

# CSI(参数+中间字节+终字节)/ OSC(BEL 或 ST 终止)/ 其余单字符转义
_ANSI_ESCAPE_RE = re.compile(
    r"\x1b(?:"
    r"\[[0-9;?<=>!]*[ -/]*[@-~]"  # CSI … final byte
    r"|\][^\x07\x1b]*(?:\x07|\x1b\\)?"  # OSC … BEL/ST
    r"|[@-Z\\-_]"  # 单字符转义(如 \x1bM)
    r")"
)

# 词首判定用的分隔字符(路径段/词边界)
_WORD_BOUNDARY_CHARS = set("-_./ \\(@[{'")


def strip_ansi(text: str) -> str:
    """剥离字符串中的 ANSI 转义序列;无转义时原样返回(零拷贝路径)。"""
    if "\x1b" not in text:
        return text
    return _ANSI_ESCAPE_RE.sub("", text)


def fuzzy_score(pattern: str, text: str) -> int | None:
    """fzf 风格模糊子序列评分;pattern 不是 text 的子序列时返回 None。

    评分要素(简化 nucleo/fzf):
    - 每个命中字符基础分
    - 连续命中链加分(越连越高)
    - 词首/路径段首命中加分(pattern 首字符在文本开头额外加分)
    - 大小写不敏感;空 pattern 返回 0(全匹配)
    """
    if not pattern:
        return 0
    p = pattern.lower()
    t = text.lower()
    score = 0
    ti = 0
    prev_hit = -2
    for pc in p:
        # 从当前位置向后找该字符
        idx = t.find(pc, ti)
        if idx < 0:
            return None
        score += 10
        if idx == prev_hit + 1:
            score += 8  # 连续命中链
        if idx == 0:
            score += 14  # 文本开头
        elif t[idx - 1] in _WORD_BOUNDARY_CHARS:
            score += 12  # 词首/路径段首
        else:
            score -= min(4, (idx - ti) // 4)  # 远距离跳跃轻罚
        prev_hit = idx
        ti = idx + 1
    # 紧凑度奖励:首末命中跨度越接近 pattern 长度越好
    first = t.find(p[0])
    score += max(0, 10 - (ti - first - len(p)))
    return score
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ---------------------------------------------------------------------------
# 密钥脱敏(2026-09-18 第十五批,对标 Codex secrets/sanitizer)
# ---------------------------------------------------------------------------
# 设计取舍:
# - 「尽力而为」而非穷举:只盖已知凭据形态,宁可漏(漏了还有其他层兜底)不可
#   把正常文本改坏(改坏会让模型拿到错误上下文,比泄漏更难排查)。
# - 顺序敏感:先盖「凭据头 + 值」(Bearer / Basic / PEM 块),再盖裸 key 形态
#   (sk-/AKIA/ghp_/AIza/JWT…),最后盖通用 k=v 赋值,避免二次处理。
# - 通用赋值保留键名、分隔符与引号,只盖值,模型仍能看懂"这里有个密码"。
# - 误伤防护:值为占位/引用形态(${VAR}、os.getenv、get_xxx()、settings.x)
#   一律不盖 —— 这类不是真实凭据。

_REDACTED_SECRET = "[REDACTED_SECRET]"

_SECRET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # PEM 私钥块(整块盖掉,含中间内容)
    (
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?"
            r"-----END [A-Z ]*PRIVATE KEY-----"
        ),
        _REDACTED_SECRET,
    ),
    # Authorization: Bearer xxx(>=16 位,避免误伤 "bearer 短词")
    (
        re.compile(r"(?i)(\bbearer\b[ \t]+)[A-Za-z0-9._~+/-]{16,}=*"),
        r"\1" + _REDACTED_SECRET,
    ),
    # URL 内联凭据 scheme://user:pass@host
    (
        re.compile(r"(?i)(\b[a-z][a-z0-9+.-]*://[^\s:/@]+:)[^\s/@]+@"),
        r"\1" + _REDACTED_SECRET + "@",
    ),
    # OpenAI / Anthropic 风格 sk-(proj-|ant-)xxxx
    (re.compile(r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}"), _REDACTED_SECRET),
    # 上游号池密钥(下划线形态)
    (re.compile(r"\bsk_[A-Za-z0-9]{16,}\b"), _REDACTED_SECRET),
    # IHUI 对客 key
    (re.compile(r"\bihui_[A-Za-z0-9]{16,}\b"), _REDACTED_SECRET),
    # AWS Access Key ID
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), _REDACTED_SECRET),
    # GitHub token(ghp_/gho_/ghu_/ghs_/ghr_/github_pat_)
    (
        re.compile(
            r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"
        ),
        _REDACTED_SECRET,
    ),
    # Google API key
    # Google API key(AIza + 至少 30 位;真实 key 为 35 位,这里放宽以兼容
    # 前后拼接了其它字符的输出行,不再要求尾边界)
    (re.compile(r"\bAIza[0-9A-Za-z_-]{30,}"), _REDACTED_SECRET),
    # Slack token
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"), _REDACTED_SECRET),
    # JWT(三段 base64url)
    (
        re.compile(
            r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"
        ),
        _REDACTED_SECRET,
    ),
    # 通用 k=v / k: v 赋值(保留键名、分隔符、引号;值为引用形态时不盖)
    (
        re.compile(
            r"(?i)\b(api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|"
            r"password|passwd|pwd|client[_-]?secret|private[_-]?key|"
            r"encryption[_-]?key)\b(\s*[:=]\s*)([\"']?)"
            r"(?![${)&])"
            r"(?!os\.|get_|settings\.|process\.|env\[)"
            r"([^\s\"',;]{8,})"
        ),
        r"\1\2\3" + _REDACTED_SECRET,
    ),
]


def redact_secrets(text: str) -> str:
    """脱敏文本中的已知凭据形态(对标 codex secrets::redact_secrets)。

    用于工具输出、引擎事件、日志等"出库"边界:模型读 .env / 跑 env / 抓日志
    时不会把真实密钥带进上下文、SSE 流与落库 transcript。空串原样返回。
    """
    if not text:
        return text
    redacted = text
    for pattern, replacement in _SECRET_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted
