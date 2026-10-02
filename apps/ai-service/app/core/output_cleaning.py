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
from collections.abc import Callable

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
# - 顺序敏感:先盖「凭据头 + 值」(HTTP 头 / Bearer / Basic / PEM 块),再盖裸 key 形态
#   (sk-/AKIA/ghp_/AIza/JWT…),最后盖通用 k=v 赋值,避免二次处理。
# - 通用赋值保留键名、分隔符与引号,只盖值,模型仍能看懂"这里有个密码"。
#
# 2026-10-03 出域合规整改(漏网形态):
# 1) 头部形态独立成规则。通用 k=v 规则要求「敏感键名 + : / =」紧邻取值,而
#    `Authorization: Bearer <tok>` 的键名 Authorization 不是敏感词、Bearer 后也没有
#    分隔符,故原规则结构上覆盖不到;`Authorization: Basic <b64>` 更是完全裸奔。
# 2) 原「负向前瞻」按**前缀**放行(见 _REF_NAME_MAX_LEN 处的说明),有两类漏网:
#    真字面量恰好以前缀开头(`os.getsk-…` / `get_hunter2…`),以及被引用形态包住的
#    真字面量(`settings.FOO` 引用没问题,`get_token() or "sk-real…"` 是有问题的)。
#    改为对**整个取值**判定「是否看起来是变量引用」,见 _looks_like_reference。

_REDACTED_SECRET = "[REDACTED_SECRET]"

# 凭据头名(长的排前面,避免 x-api-key 被 api-key 分支先吃掉前缀)
_AUTH_HEADER_NAMES = (
    r"proxy-authorization|authorization|"
    r"x-api-key|x-api_key|x-auth-token|x-access-token|x-secret-key|"
    r"api-key|apikey|auth-token|access-token"
)
# RFC 7235 认证方案词:出现即说明后面跟的是凭据而非自由文本
_AUTH_SCHEMES = r"bearer|basic|digest|token|apikey|api-key|oauth|oauth2|jwt|negotiate"

# ---------------------------------------------------------------------------
# 「看起来是变量引用」判据(2026-10-03 整改核心)
# ---------------------------------------------------------------------------
# 原实现是一个**前缀**负向前瞻 `(?!os\.|get_|settings\.|process\.|env\[)`:
# 只要取值的前 3~9 个字符长得像代码引用就整条放行。它有两个方向的漏网:
#   a) 真字面量恰好以前缀开头 —— `os.getsk-FAKE…` / `get_hunter2…`;
#   b) 引用形态里裹着真字面量 —— `get_token() or "sk-real…"`(前半段像引用,
#      整条却被放过)。
# 二者的共同根因是「判据作用在前缀上,而不是作用在整个取值上」。新判据改为
# 对**整个取值**分类,分五支,每支都有对应单测(见 tests/test_output_cleaning.py):
#
#   E1 占位/插值形态:${VAR}、$VAR、<token>、%s、&anchor、***  → 放行
#   E2 取值调用形态:ident( 'IDENT' | "IDENT" | IDENT ) 且**至多一个**参数
#                   —— os.getenv('DB_PASSWORD') / process.env['X'].get(...)
#                      放行;os.environ.get('K', 'sk-real…') 因带逗号(=双参
#                      取值)归入 R1 拦下
#   E3 下标取值形态:ident[ 'IDENT' ]                —— env['MY_SECRET'] 放行
#   E4 短标识符路径:A.B.C 且总长 <= 32 且**不像随机串**
#                  —— settings.AUTH_TOKEN(18 位、无数字)放行;而
#                     settings.CREDENTIALS_ENCRYPTION_KEY(34 位)超长 → 拦下
#                     (这正是审计点名的形态)
#   E5 随机串启发式:含数字且含字母、或字符类别 >= 3(小写/大写/数字)
#                  —— E4 的二次否决,专治"短但随机"的字面量
#
# 一律拦下(判为真凭据):
#   R1 取值里出现顶层运算符/分隔符(or / and / || / && / + / , / =):说明"值"
#      不止是一个名字,里面混了字面量 —— 覆盖 (b) 类漏网;
#   R2 引号包裹:引号里的东西一律是字面量,哪怕长得像变量名('DB_PASSWORD' 作为
#      整个取值时是字符串常量,不是引用);
#   R3 形态不匹配上述任何一支(含点号+长标识符、数字混杂的随机串)。
#
# 长度阈值 32 的由来:环境变量 / 配置项名的实测长度上限在 30 上下
# (settings.authorization_header=30、AWS_SECRET_ACCESS_KEY=21、
# GOOGLE_APPLICATION_CREDENTIALS=28),而审计点名的形态是
# settings.CREDENTIALS_ENCRYPTION_KEY=34。取 32 落在两者之间。
# 它是**第二道闸**而不是唯一防线 —— 带数字的随机串由 E5 拦(与长度无关),
# 长度闸只负责「形态干净、无数字、但明显不是变量名」的长标识符。
# 调这个旋钮的取舍:调大 → 漏 `CREDENTIALS_ENCRYPTION_KEY` 类形态;
# 调小 → 误伤 `settings.some_long_attribute_name` 类正常代码。
_REF_NAME_MAX_LEN = 32

# E2:ident( 至多一个标识符/引号标识符 参数 ),参数可含 / : @ (vault 路径、URL)
_REF_CALL_RE = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.]*\(\s*(?:[A-Za-z_][A-Za-z0-9_.\-/:@]*|"
    r"'[A-Za-z0-9_.\-/:@]+'|\"[A-Za-z0-9_.\-/:@]+\")?\s*\)"
)
# E3:ident[ 'IDENT' ]
_REF_SUB_RE = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.]*\[\s*'?(?:[A-Za-z_][A-Za-z0-9_.\-]*)'?\s*\]"
)
# E4:A(.A)*
_REF_NAME_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*")
# R1:顶层运算符/分隔符
_REF_OPERATORS = (" or ", " and ", "||", "&&", "+", ",", "=")
# E1:占位/插值起始符
_PLACEHOLDER_HEADS = "$<>&%*"


def _looks_random(value: str) -> bool:
    """E5:粗判「像随机串」而非「像变量名」。

    判据:含数字且含字母(典型 base64/hex 尾巴),或字符类别 >= 3。
    在 E2 / E3 / E4 三支上作为否决项使用 —— 长取值另有长度闸,
    不依赖本函数,避免把启发式当成唯一防线。
    """
    has_digit = any(c.isdigit() for c in value)
    has_alpha = any(c.isalpha() for c in value)
    if has_digit and has_alpha:
        return True
    classes = (
        any(c.islower() for c in value)
        + any(c.isupper() for c in value)
        + has_digit
    )
    return classes >= 3


def _looks_like_reference(value: str) -> bool:
    """判断整个取值是否只是「变量引用」而非真实凭据(是则不脱敏)。"""
    if not value:
        return True
    stripped = value.strip()
    if not stripped:
        return True
    # R2:引号包裹 = 字面量
    if stripped[0] in "\"'":
        return False
    # R1:顶层运算符/分隔符 = 里面混了字面量
    if any(op in stripped for op in _REF_OPERATORS):
        return False
    # E1:占位/插值
    if stripped[0] in _PLACEHOLDER_HEADS:
        return True
    # E2:取值调用(多参调用已在 R1 被逗号拦下)—— 追加随机串否决,
    #     防 lookup('sk-FAKE…') 这类"参数其实是字面量"蒙混过关
    if _REF_CALL_RE.fullmatch(stripped):
        return not _looks_random(stripped)
    # E3:下标取值
    if _REF_SUB_RE.fullmatch(stripped):
        return not _looks_random(stripped)
    # E4 + E5:短标识符路径且不像随机串
    if _REF_NAME_RE.fullmatch(stripped):
        if len(stripped) > _REF_NAME_MAX_LEN:
            return False
        return not _looks_random(stripped)
    # R3:形态不匹配
    return False


def _redact_assignment(match: re.Match[str]) -> str:
    """通用 k=v 规则的可调用替换:值是变量引用就原样放过,否则只盖值。

    保留键名、分隔符与开引号(闭引号本就不在匹配范围内,自然留在原地),
    因此 `password: "xxx"` → `password: "[REDACTED_SECRET]"`。
    """
    value = match.group("val")
    if _looks_like_reference(value):
        return match.group(0)
    return f"{match.group(1)}{match.group(2)}{match.group('q')}{_REDACTED_SECRET}"


def _redact_auth_header(match: re.Match[str]) -> str:
    """凭据头(无 scheme 形态)的替换:值是变量引用就放过。

    与 _redact_assignment 共用同一判据,保证两条规则对「什么是引用」的看法一致,
    不会出现「通用规则放行、头部规则盖掉」的自相矛盾。
    """
    value = match.group(3)
    if _looks_like_reference(value):
        return match.group(0)
    return f"{match.group(1)}{match.group(2)}{_REDACTED_SECRET}"


_SECRET_PATTERNS: list[tuple[re.Pattern[str], str | Callable[[re.Match[str]], str]]] = [
    # PEM 私钥块(整块盖掉,含中间内容)
    (
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?"
            r"-----END [A-Z ]*PRIVATE KEY-----"
        ),
        _REDACTED_SECRET,
    ),
    # ---- HTTP 凭据头(2026-10-03 新增)----
    # 排在通用 k=v 之前:头部形态的键名(Authorization / x-api-key)不是通用规则
    # 的敏感词,且取值与键名之间隔着 scheme 词,通用规则结构上抓不到;
    # 反过来若通用规则先跑,`Authorization: Token abc…` 里的 token 会被当成
    # 「敏感键」而把 scheme 词当值盖掉、留下真正的凭据尾巴。
    # (1) Authorization: <scheme> <credential> —— 保留 scheme 与头部名,便于排障
    #     (既有 test_redact_bearer_token 断言 "Bearer [REDACTED_SECRET]" 形态)
    (
        re.compile(
            r"(?i)\b(" + _AUTH_HEADER_NAMES + r")\b([ \t]*[:=][ \t]*)"
            r"(" + _AUTH_SCHEMES + r")[ \t]+"
            r"([A-Za-z0-9._~+/=-]{8,})"
        ),
        r"\1\2\3 " + _REDACTED_SECRET,
    ),
    # (2) x-api-key: <value> / Authorization: <credential>(无 scheme)
    #     阈值 12 位:低于此长度无法与「值本来就短」区分,宁漏勿伤。
    #     值若整体是变量引用(如 `authorization = settings.authorization_header`
    #     这种 .env / 配置文件里常见的引用式赋值)则原样放过 —— 头部规则不应
    #     比通用规则更激进,否则就成了新的误伤源。
    (
        re.compile(
            r"(?i)\b(" + _AUTH_HEADER_NAMES + r")\b([ \t]*[:=][ \t]*)"
            r"([A-Za-z0-9._~+/=-]{12,})"
        ),
        _redact_auth_header,
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
    # 通用 k=v / k: v 赋值(保留键名、分隔符、引号;值是变量引用时不盖)
    #
    # 取值的候选形态按「先具体后宽泛」排列,便于 _looks_like_reference 拿到完整值:
    #   call  —— f(...) / os.getenv('X'),可含引号参数
    #   sub   —— env['X'] / os.environ["X"]
    #   dq/sq —— 引号字面量(整体含引号,交给 R2 判)
    #   bare  —— >=8 位裸 token(旧行为,{8,} 下限保留:短值一律不盖)
    # 拼接尾巴(`ref + "字面量"` / `ref or "字面量"`)并入 call/bare 分支,
    # 让 R1 能看见运算符并拦下 —— 这类以前缀放行漏网,现在整体判定。
    (
        re.compile(
            r"(?i)\b(api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|"
            r"password|passwd|pwd|client[_-]?secret|private[_-]?key|"
            r"encryption[_-]?key)\b"
            r"(\s*[:=]\s*)"
            r"(?P<q>[\"']?)"
            r"(?P<val>"
            r"(?:[A-Za-z_][A-Za-z0-9_.]*\([^)\n]*\)|[A-Za-z_][A-Za-z0-9_.]*\[[^\]\n]*\]"
            r"|[^\s\"',;]{8,})"
            r"(?:[ \t]*(?:\+|\|\||\bor\b)[ \t]*(?:\"[^\"\n]*\"|'[^'\n]*'|[^\s\"',;]{1,}))?"
            r")"
        ),
        _redact_assignment,
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
