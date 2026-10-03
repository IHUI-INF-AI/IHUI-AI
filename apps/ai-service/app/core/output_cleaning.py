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
# E3:ident[ 'IDENT' ] / ident[ "IDENT" ](单双引号都要收,否则 os.environ["X"]
#    这类双引号下标会被 R3 误判成字面量 —— 旧前缀前瞻是放行它的,不能回归)
_REF_SUB_RE = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.]*\[\s*['\"]?[A-Za-z_][A-Za-z0-9_.\-]*['\"]?\s*\]"
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
    # 组号(2026-10-03 第二次整改后):group(1)=键名前缀(可为空,故是
    # `([A-Za-z0-9]+_)?` 而非 `(?:...)`)、group(2)=敏感词本体、group(3)=分隔符。
    # 键名 = 前缀 + 敏感词本体 —— 两者都要保留,否则模型看到的就是
    # `API_KEY=` 而不是 `OPENAI_API_KEY=`,排障时少了环境来源这条关键信息。
    return (
        f"{match.group(1) or ''}{match.group(2)}{match.group(3)}"
        f"{match.group('q')}{_REDACTED_SECRET}"
    )


def _redact_auth_header(match: re.Match[str]) -> str:
    """凭据头(无 scheme 形态)的替换:值是变量引用就放过。

    与 _redact_assignment 共用同一判据,保证两条规则对「什么是引用」的看法一致,
    不会出现「通用规则放行、头部规则盖掉」的自相矛盾。
    """
    value = match.group(3)
    if _looks_like_reference(value):
        return match.group(0)
    return f"{match.group(1)}{match.group(2)}{_REDACTED_SECRET}"


def _redact_compound_key(match: re.Match[str]) -> str:
    """复合键名规则(.env 风格)的替换:两道闸任一命中就整段放过。

    两道闸都是"整段放过",即返回 match.group(0) **原文**,不做任何拼接:

    闸 1 · 键名末段属 _COMPOUND_KEY_NON_SECRET_SUFFIX —— 整串是个**普通名词短语**
    而不是凭据名(token_count / password_policy / key_type / PASSWORD_MIN_LENGTH)。
    盖掉它们纯属误伤,且实测会产出 `token_count=1234[REDACTED_SECRET]` 这种
    既没脱敏又损坏原文的坏结果(上一版就是在这里翻的车:排除分支里做了
    "取前半 + 分隔符 + 占位符"的拼接,等于在已消费的匹配之外又追加一次替换)。

    闸 2 · 取值整体是「变量引用」—— 与另外两条规则共用 _looks_like_reference,
    保证三条规则对"什么是引用"看法一致。2026-10-03 第三次整改新增:尾段量词
    从 `+` 放宽到 `*` 之后,`password = os.getenv('DB_PASSWORD')` 这类**引用式
    赋值**也会落进本规则(尾段零段),若不判引用就会被误伤 —— 而它在放宽前是由
    通用规则判引用放行的,两条规则对同一行的结论必须一致。
    """
    key_part = match.group(0)[: match.start(1) - match.start(0)]
    if _COMPOUND_KEY_NON_SECRET_SUFFIX.search(key_part):
        return match.group(0)
    if _COMPOUND_KEY_NON_SECRET_PREFIX.match(key_part):
        return match.group(0)
    if _looks_like_reference(match.group("val")):
        return match.group(0)
    return (
        f"{key_part}{match.group(1)}{match.group('q')}{_REDACTED_SECRET}"
    )


# 闸 1:复合键名的"非凭据末段"词表(见 _redact_compound_key 说明)。
# 末尾锚定 $:只排除"末段正好是这些词"的情况,`AWS_SECRET_ACCESS_KEY` 这种
# 末段为 KEY 的仍会脱敏。
_COMPOUND_KEY_NON_SECRET_SUFFIX = re.compile(
    r"(?i)_(policy|type|count|name|mode|len|length|limit|rule|min|max|"
    r"enabled|disabled|prefix|suffix|format|field|id|algorithm|version|"
    r"material|path|url|dir|file|dir|src|source)$"
)

# 闸 1 的对称面:"非凭据首段"词表。`sort_key` / `primary_key` / `cache_key` /
# `row_key` 这类是数据结构的**描述字段**而不是凭据名(ORM 输出、SQL explain、
# 缓存日志里成片出现),与闸 1 的 `token_count` 是同一类误伤,方向相反而已:
# 闸 1 排除"敏感词+后缀",本表排除"前缀+敏感词"。
# 开头锚定 ^,只排除首段正好是这些词的情况,`secret_key` / `private_key` /
# `api_key` 这类真凭据不受影响(首段 secret/private/api 不在本表内)。
_COMPOUND_KEY_NON_SECRET_PREFIX = re.compile(
    r"(?i)^(?:sort|partition|primary|foreign|cache|object|row|column|table|"
    r"index|group|shard|cursor)_"
)


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
    # 排序理由(实测校准,勿凭直觉改):
    # 头部名 authorization / proxy-authorization 里**不含**任何通用规则的敏感词,
    # 且取值与头名之间隔着 scheme 词,故通用规则对 `Authorization: Basic <b64>`
    # 结构上永远匹配不到 —— 头规则是通用规则的**超集**而非补充。
    # 至于"谁先跑":以 12 例头部语料对调顺序实测,两种顺序结果完全一致
    # (顺序敏感 0/12),所以这里取"具体在前"是**防御性不变式**而不是在修某个
    #现存 bug:头规则一旦以「整块凭据」替换,通用规则只会看到 [REDACTED_SECRET],
    # 从而永远不可能拆开 <scheme> <credential> 或把凭据的一部分当成键名/取值。
    # 顺序一旦调换,这个不变式就依赖"通用规则恰好不误伤头部行",是脆弱的耦合。
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
    # ---- 复合键名的 .env 凭据(2026-10-03 第二次整改,独立成条;
    #      2026-10-03 第三次整改放宽尾段)----
    # 形态:敏感词出现在复合词的**任意一段**,后面可以还有下划线词,也可以没有
    #   AWS_SECRET_ACCESS_KEY=…  /  KEY_VALUE=…  /  A_B_SECRET_C=…
    #   X_KEY=…  /  MY_CREDENTIAL=…          ← 第三次整改新增(尾段零段)
    # 这类为什么单开一条而不放宽通用规则:通用规则一旦允许「敏感词 + 后一段」,
    # 就会把 `password_policy=` / `token_type=` / `key_type=` 一并吃掉(实测误伤
    # 2/12),那是"把正常文本改坏"的方向 —— 本模块的既定取舍是宁可漏网不可改坏。
    # 单开一条后可**用分隔符位置收窄**:整串以分隔符收尾时才匹配;而
    # `password_policy` 这种"敏感词+后缀构成一个普通名词"的情况,靠排除词表剔除。
    #
    # ⚠ 键名段是 `[A-Za-z0-9_]*`(整段吃下),匹配起点由左断言 `(?<![\w])` 决定,
    #   所以无论尾段有几段,替换时都能把**完整键名**原样回填,不会截断成
    #   `API_KEY=`。裸 `key` / `credential` 之所以只能由本规则覆盖、绝不能进通用
    #   规则的 alternation,根因就在这里(见通用规则处的注释)。
    (
        re.compile(
            r"(?i)(?<![\w])"
            # ⚠ 这里**不能**有 \b:`_` 本身是词字符,`[A-Za-z0-9_]*` 贪婪吃掉
            # `AWS_SECRET_` 之后,后接 `ACCESS` 时不存在词边界 ⇒ 回溯失败 ⇒
            # 整条规则对 `AWS_SECRET_ACCESS_KEY=` 静默失配(实测 4/4 形态全漏)。
            # 前缀段已由上面的 (?<![\w]) 兜住左边界,这里只需去掉右边界。
            #
            # 2026-10-03 第三次整改:键名段由 `[A-Za-z0-9_]*` 改为**段感知**的
            # `(?:[A-Za-z0-9]+_)*` + 敏感词段 + `(?:_[A-Za-z0-9]+)*`。
            # 根因实测(见交付说明):漏 `X_KEY=` / `MY_CREDENTIAL=` 的原因是
            # **尾段量词写的是 `+`(一段以上)而不是 `*`** —— `key` 后面没有下划线
            # 段时整条规则直接失配。单纯把 `+` 改成 `*` 能盖住,但会把 `MONKEY=` /
            # `hotkey=` / `sort_key=` 一并吃掉(实测 3/3 误伤),因为 `[A-Za-z0-9_]*`
            # 能把 `MON` / `hot` / `sort_` 当成前缀而把 key 当成段内子串。
            # 改成段感知后,敏感词必须**独占一整段**才算命中,上述形态自然失配。
            r"(?:[A-Za-z0-9]+_)*"
            r"(?:secret|token|password|passwd|credential|key|private)"
            r"(?:_[A-Za-z0-9]+)*"       # 尾段:一段或多段,或零段(第三次整改)
            r"(\s*[:=]\s*)"
            # 取值形态与通用规则对齐(call/sub/bare 三选),使 _looks_like_reference
            # 拿到完整值 —— 否则 `password = os.getenv('DB_PASSWORD')` 这类引用式
            # 赋值会被截成 `os.getenv(` 判成随机串而误伤。
            r"(?P<q>[\"']?)"
            r"(?P<val>"
            r"(?:[A-Za-z_][A-Za-z0-9_.]*\([^)\n]*\)|[A-Za-z_][A-Za-z0-9_.]*\[[^\]\n]*\]"
            r"|[^\s\"',;]{8,})"
            r"(?:[ \t]*(?:\+|\|\||\bor\b)[ \t]*(?:\"[^\"\n]*\"|'[^'\n]*'|[^\s\"',;]{1,}))?"
            r")"
        ),
        # ⚠ 排除时必须返回 **match.group(0) 整段原文**,不能"取前半 + 分隔符 + 占位符"
        # 那样拼 —— 那等于在已消费的匹配之外又追加一次替换,实测产出
        # `token_count=1234[REDACTED_SECRET]` 这种既没脱敏又损坏原文的结果。
        _redact_compound_key,
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
            # 2026-10-03 第二次整改:键名**允许带前缀**(DB_PASSWORD /
            # AWS_SECRET_ACCESS_KEY / MY_TOKEN / STRIPE_API_KEY …)。
            # 原模式用 `\b(token|secret|password…)\b`,而 `_` 本身就是词字符
            # ⇒ `PASSWORD` 前的 `_` 不构成词边界 ⇒ 这类最常见的环境变量命名
            # **整体漏网**。实测它比前两次修的形态更危险:模型 `printenv` 或
            # `cat .env` 的输出里几乎全是这种名字,而那正是凭据外泄主通道。
            #
            # 放行条件是**收紧**的,不是简单去掉 \b:
            #   · 前缀只允许单个标识符段([A-Za-z0-9]+_),不跨空格/引号/换行;
            #   · 敏感词**后面仍必须紧跟**分隔符(下面的 `(\s*[:=]\s*)` 保证),
            #     所以 `token_count=` / `password_policy=` / `secret_name=`
            #     这类「敏感词只是某个更长的非凭据词的一段」不会被误伤;
            #   · `(?<![\w])` 保留左断言,键名前不能紧邻另一个词字符
            #     (等价于原 \b 的左半效果),避免把 `xTOKEN` 切错位置。
            # 代价:`MY_PASSWORD_POLICY=x` 这类「前缀+敏感词+后缀词」仍会误伤,
            # 属本模块既定取舍(宁可漏网,不要把正常文本改坏 —— 改坏会让模型拿到
            # 错误上下文,比泄漏更难排查)。
            # ⚠ 前缀段必须是**捕获组**:_redact_assignment 用 group(1) 取键名来
            # 重新拼接,写成非捕获组 (?:...) 时前缀被匹配掉却不在 group(1) 里,
            # 拼接结果就是 `API_KEY=[REDACTED_SECRET]` —— 键名头被吃掉。
            # 端到端测试 test_run_command_output_is_redacted_end_to_end 正是在
            # 断言"键名完整保留"(OPENAI_API_KEY= 必须还在),这条不能碰。
            r"(?i)(?<![\w])([A-Za-z0-9]+_)?"
            r"(api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|"
            r"password|passwd|pwd|client[_-]?secret|private[_-]?key|"
            r"encryption[_-]?key)"
            # ⚠ 这里**刻意不加**裸 `key`,也**不加**裸 `credential`,不加裸 `secret`:
            # 加任何一个都会让 `OPENAI_API_KEY=` / `MY_CREDENTIAL=` 的匹配起点被
            # 推到更靠后的位置(可变长前缀 + 引擎的起点选择),键名被截成
            # `API_KEY=` / `Y_CREDENTIAL=`,端到端测试
            # test_run_command_output_is_redacted_end_to_end(断言键名保留)与
            # test_known_credential_forms_still_redacted 会直接判红。
            # 这些裸形态一律由上面那条「复合键名」规则单独覆盖 —— 那条规则的
            # 键名段是 `(?:[A-Za-z0-9]+_)*` + 敏感词段(整段吃下),不会截断键名。
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
