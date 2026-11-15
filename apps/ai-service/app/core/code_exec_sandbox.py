# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""run_code 的 vm 级能力禁令判据(round 9 实现席 C,静态准入层)。

立因(对照 DSH / Qoder 的沙箱分级)
--------------------------------
本仓 ``run_code``(``agent_engine.py`` 的 code-mode 常驻会话)有 4 处调用,
却没有一层**独立的、可审计的**能力禁令判据:能不能碰进程/网络/文件写/
反射/环境/FFI,靠的是提示词约束与运行时兜底,而不是一段能被测试钉死、
能逐条给出证据的准入结论。对侧的沙箱分级是运行时把句柄收在 vm 边界上;
本模块补的是**进 vm 之前**那道静态准入:先问"这段代码到底想碰哪些宿主能力",
再决定放不放它进最低权限的计算档。

判据(本层唯一产品 = 一段结构化 verdict,不是一次执行)
----------------------------------------------------
``decide_code_execution(request, policy)`` 返回三态 ``verdict``:

* ``allowed``  —— 仅当 AST 静态扫描**零**宿主能力触碰(只读纯计算);
* ``denied``   —— 一旦实测触碰任一宿主能力即拒(vm 级能力**禁令**,不是能力授予层);
* ``unjudged`` —— 形状不认 / 解析失败 / 动态符号看不全 ⇒ 阻断并点名原因(§0.3:
                  "没判"绝不写成"判过",取不到输入不记绿也不冒红,绝不因解析不了就放行)。

四条硬判据,逐条可审计、逐条带证据:
1. **AST 静态准入**:只 ``ast.parse`` + ``ast.walk``,识别七类宿主能力触碰
   (进程/子进程、网络、文件系统写、动态 import/__import__、eval/exec/getattr
   反射、环境变量/凭据、ctypes/FFI);每条 ``finding`` 带 ``capability`` /
   ``evidence``(行号 + 命中形态)/ ``rule``(规则 id)。
2. **声明与实测一致性**:``requested_capabilities`` 必须覆盖实测 ``detected``;
   实测有而声明没有("声明少了也算不一致")⇒ 拒,且 reason 点名缺哪些(§0.10:
   失效方向是"多要一次定向说明",不是"多放一次跳门")。
3. **默认禁(白名单制,不是黑名单)**:能力是否"被策略覆盖"只按
   ``policy["capabilities"]`` 查表判断;未显式在册 ⇒ reason 标 ``default-deny``。
   策略缺规则集/形状坏 ⇒ 整层 ``unjudged``,**绝不回退**到一张硬编码黑名单继续判
   (取不到输入不猜,这是白名单制最硬的一格)。
4. **解析失败阻断 + 动态符号阻断**:语法错、大小写变体名、字符串拼接出来的
   调用目标/反射目标,一律按"形状不认"阻断,不静态求值、不猜、不放行。

刻意不做什么(边界必须说清)
---------------------------
* **不执行任何代码、不真的起 vm、不 import 被测代码**:本层只做静态准入判据,
  ``ast.parse`` 是唯一碰代码的地方,永不 ``eval``/``exec``/``compile`` 到执行。
  运行时沙箱(真 vm / 句柄隔离)是另一层,不在本模块射程。
* **白名单命中不等于放行**:``policy["capabilities"]`` 是"能力名域 + 策略覆盖
  声明",不是"开后门给宿主句柄"的开关。宿主能力在准入层恒拒;刻意不做
  "在册即 allowed"的口子,否则禁令层会退化成授权层。
* **不卡冗余声明**:只卡"漏声明"(实测 ⊄ 声明),不卡"多声明"(声明 ⊄ 实测)——
  多声明一个没被触碰的能力只会让请求被更严审视,不构成绕过;卡它只会误伤
  纯计算请求,故刻意不做。
* **不静态求值动态符号**:字符串拼接 / 大小写变体一律按形状不认处理,刻意不写
  常量折叠求解器——求解器永远追不完所有混淆形态,而"看不全就阻断"是更稳的
  失效方向。
* **单表判据、单一真相源(§0.6)**:模块名/函数名/属性名共用一张 ``_TOKEN_RULES``,
  不在多处各抄一份危险清单;测试只 import 本模块,不复制判据。刻意不收
  ``list.remove`` / ``str.replace`` / ``__class__`` 这类通用名(会误伤纯计算),
  其宿主语义由 ``import os`` / ``shutil`` / ``pathlib`` 等入口覆盖。

一轴超越(对照只靠提示词/运行时)
--------------------------------
对照把能力边界收在提示词与运行时 vm,结论不可 diff、不带证据、解析失败时
行为不可知。本仓把上述四条钉成**纯函数 + 结构化 verdict + 逐条带行号证据的
findings**,测试可直接断言每个能力、每个 reason、每条 rule;且整层零第三方
依赖(仅 Python 标准库 ``ast``)、零执行、零副作用。
"""

from __future__ import annotations

import ast
from typing import Any, cast

# ---- 三态 verdict / 沙箱分级 tier ----
VERDICT_ALLOWED = "allowed"
VERDICT_DENIED = "denied"
VERDICT_UNJUDGED = "unjudged"

# tier = 本次请求落入的 vm 准入档(对照沙箱分级):纯计算档 / 宿主句柄档 / 无法归档。
TIER_COMPUTE_ONLY = "compute-only"
TIER_HOST_TOUCH = "host-touch"
TIER_UNCLASSIFIED = "unclassified"

# ---- 能力标签(白名单里的合法词,也是 findings 的 capability 取值)----
CAP_PROCESS = "process"
CAP_NETWORK = "network"
CAP_FS_WRITE = "fs_write"
CAP_DYNAMIC_IMPORT = "dynamic_import"
CAP_REFLECTION = "reflection"
CAP_ENV = "env_credential"
CAP_FFI = "ffi"
CAP_DYNAMIC_SYMBOL = "dynamic_symbol"  # 不透明动态符号:形状不认,非宿主能力本身

# ---- 规则 id(每条 finding 的 rule)----
RULE_PROCESS = "R-HOST-PROCESS"
RULE_NETWORK = "R-HOST-NETWORK"
RULE_FS_WRITE = "R-HOST-FS-WRITE"
RULE_DYNAMIC_IMPORT = "R-HOST-DYNIMPORT"
RULE_REFLECTION = "R-HOST-REFLECTION"
RULE_ENV = "R-HOST-ENV-CREDENTIAL"
RULE_FFI = "R-HOST-FFI"
RULE_OPAQUE_CALL = "R-UNJUDGED-OPAQUE-CALL"
RULE_OPAQUE_ARG = "R-UNJUDGED-OPAQUE-ARG"
RULE_CASE_EVASION = "R-UNJUDGED-CASE-EVASION"
RULE_SHAPE = "R-UNJUDGED-SHAPE"
RULE_PARSE_FAIL = "R-UNJUDGED-PARSE-FAIL"
RULE_DEFAULT_DENY = "R-DECISION-DEFAULT-DENY"
RULE_HOST_BAN = "R-DECISION-HOST-CAPABILITY-BAN"
RULE_UNDECLARED = "R-DECISION-UNDECLARED"

# language 未登记一律不认:绝不凭猜测按 python 解析(§0.3)。
SUPPORTED_LANGUAGES = frozenset({"python", "python3"})

# 大小写变体检测集(全小写)。立因:Eval / GetAttr / __IMPORT__ 这类变体名说明
# 作者在刻意绕开字面判据;只认"非标准大小写"的变体(name != name.lower()),
# 避免把 list.remove / str.replace 这类同名纯计算方法误判成绕过。
_EVASION_LOWER = frozenset({
    "eval", "exec", "compile", "__import__", "getattr", "setattr", "delattr",
    "globals", "locals", "vars", "breakpoint", "open", "system", "popen",
    "getenv", "putenv", "fork", "execv", "spawnl", "import_module",
    "ctypes", "subprocess", "socket", "environ",
})

# 反射/动态 import 类调用:其参数若为拼接字符串,静态判据看不全 ⇒ 形状不认。
_REFLECT_NAMES = frozenset({
    "eval", "exec", "compile", "__import__", "getattr", "setattr", "delattr",
    "import_module",
})

# ---------------------------------------------------------------------------
# 单一真相源:模块名 / 函数名 / 属性名 → (capability, rule)。
# 判据只认"这张表里登记过的宿主能力触碰",不是维护一张"其余都行"的黑名单。
# 刻意不收 remove/rename/replace/copy/move/__class__ 等通用名(误伤纯计算)。
# ---------------------------------------------------------------------------
_TOKEN_RULES: dict[str, tuple[str, str]] = {
    # 进程 / 子进程(立因:起 shell / 派生进程是 vm 最不该下放的宿主句柄)
    "os": (CAP_PROCESS, RULE_PROCESS),
    "subprocess": (CAP_PROCESS, RULE_PROCESS),
    "multiprocessing": (CAP_PROCESS, RULE_PROCESS),
    "pty": (CAP_PROCESS, RULE_PROCESS),
    "system": (CAP_PROCESS, RULE_PROCESS),
    "popen": (CAP_PROCESS, RULE_PROCESS),
    "spawnl": (CAP_PROCESS, RULE_PROCESS),
    "spawnle": (CAP_PROCESS, RULE_PROCESS),
    "spawnv": (CAP_PROCESS, RULE_PROCESS),
    "spawnve": (CAP_PROCESS, RULE_PROCESS),
    "execv": (CAP_PROCESS, RULE_PROCESS),
    "execve": (CAP_PROCESS, RULE_PROCESS),
    "fork": (CAP_PROCESS, RULE_PROCESS),
    "forkpty": (CAP_PROCESS, RULE_PROCESS),
    "Popen": (CAP_PROCESS, RULE_PROCESS),
    "check_output": (CAP_PROCESS, RULE_PROCESS),
    "check_call": (CAP_PROCESS, RULE_PROCESS),
    "getoutput": (CAP_PROCESS, RULE_PROCESS),
    "getstatusoutput": (CAP_PROCESS, RULE_PROCESS),
    # 网络(立因:外联 / 监听同样需要宿主 socket 句柄)
    "socket": (CAP_NETWORK, RULE_NETWORK),
    "ssl": (CAP_NETWORK, RULE_NETWORK),
    "urllib": (CAP_NETWORK, RULE_NETWORK),
    "http": (CAP_NETWORK, RULE_NETWORK),
    "httplib": (CAP_NETWORK, RULE_NETWORK),
    "ftplib": (CAP_NETWORK, RULE_NETWORK),
    "smtplib": (CAP_NETWORK, RULE_NETWORK),
    "telnetlib": (CAP_NETWORK, RULE_NETWORK),
    "imaplib": (CAP_NETWORK, RULE_NETWORK),
    "poplib": (CAP_NETWORK, RULE_NETWORK),
    "nntplib": (CAP_NETWORK, RULE_NETWORK),
    "xmlrpc": (CAP_NETWORK, RULE_NETWORK),
    "requests": (CAP_NETWORK, RULE_NETWORK),
    "httpx": (CAP_NETWORK, RULE_NETWORK),
    "aiohttp": (CAP_NETWORK, RULE_NETWORK),
    "websockets": (CAP_NETWORK, RULE_NETWORK),
    "websocket": (CAP_NETWORK, RULE_NETWORK),
    "socketserver": (CAP_NETWORK, RULE_NETWORK),
    "create_connection": (CAP_NETWORK, RULE_NETWORK),
    "urlopen": (CAP_NETWORK, RULE_NETWORK),
    "urlretrieve": (CAP_NETWORK, RULE_NETWORK),
    # 文件系统写(立因:任何可写文件句柄都不属于最小计算档)
    "shutil": (CAP_FS_WRITE, RULE_FS_WRITE),
    "pathlib": (CAP_FS_WRITE, RULE_FS_WRITE),
    "tempfile": (CAP_FS_WRITE, RULE_FS_WRITE),
    "open": (CAP_FS_WRITE, RULE_FS_WRITE),
    "unlink": (CAP_FS_WRITE, RULE_FS_WRITE),
    "rmdir": (CAP_FS_WRITE, RULE_FS_WRITE),
    "mkdir": (CAP_FS_WRITE, RULE_FS_WRITE),
    "makedirs": (CAP_FS_WRITE, RULE_FS_WRITE),
    "removedirs": (CAP_FS_WRITE, RULE_FS_WRITE),
    "truncate": (CAP_FS_WRITE, RULE_FS_WRITE),
    "write": (CAP_FS_WRITE, RULE_FS_WRITE),
    "writelines": (CAP_FS_WRITE, RULE_FS_WRITE),
    "write_text": (CAP_FS_WRITE, RULE_FS_WRITE),
    "write_bytes": (CAP_FS_WRITE, RULE_FS_WRITE),
    "chmod": (CAP_FS_WRITE, RULE_FS_WRITE),
    "chown": (CAP_FS_WRITE, RULE_FS_WRITE),
    "rmtree": (CAP_FS_WRITE, RULE_FS_WRITE),
    "copyfile": (CAP_FS_WRITE, RULE_FS_WRITE),
    # 动态 import / __import__(立因:绕过静态 import 面)
    "importlib": (CAP_DYNAMIC_IMPORT, RULE_DYNAMIC_IMPORT),
    "__import__": (CAP_DYNAMIC_IMPORT, RULE_DYNAMIC_IMPORT),
    "import_module": (CAP_DYNAMIC_IMPORT, RULE_DYNAMIC_IMPORT),
    "reload": (CAP_DYNAMIC_IMPORT, RULE_DYNAMIC_IMPORT),
    "find_loader": (CAP_DYNAMIC_IMPORT, RULE_DYNAMIC_IMPORT),
    # eval / exec / getattr 反射(立因:把字符串变成可执行动作,静态判据永远看不全)
    "eval": (CAP_REFLECTION, RULE_REFLECTION),
    "exec": (CAP_REFLECTION, RULE_REFLECTION),
    "compile": (CAP_REFLECTION, RULE_REFLECTION),
    "getattr": (CAP_REFLECTION, RULE_REFLECTION),
    "setattr": (CAP_REFLECTION, RULE_REFLECTION),
    "delattr": (CAP_REFLECTION, RULE_REFLECTION),
    "globals": (CAP_REFLECTION, RULE_REFLECTION),
    "locals": (CAP_REFLECTION, RULE_REFLECTION),
    "vars": (CAP_REFLECTION, RULE_REFLECTION),
    "breakpoint": (CAP_REFLECTION, RULE_REFLECTION),
    "__builtins__": (CAP_REFLECTION, RULE_REFLECTION),
    "__globals__": (CAP_REFLECTION, RULE_REFLECTION),
    "__subclasses__": (CAP_REFLECTION, RULE_REFLECTION),
    "__code__": (CAP_REFLECTION, RULE_REFLECTION),
    "func_globals": (CAP_REFLECTION, RULE_REFLECTION),
    "f_back": (CAP_REFLECTION, RULE_REFLECTION),
    "gi_frame": (CAP_REFLECTION, RULE_REFLECTION),
    "cr_frame": (CAP_REFLECTION, RULE_REFLECTION),
    "tb_frame": (CAP_REFLECTION, RULE_REFLECTION),
    # 环境变量 / 凭据(立因:读宿主配置 / 密钥)
    "getpass": (CAP_ENV, RULE_ENV),
    "keyring": (CAP_ENV, RULE_ENV),
    "netrc": (CAP_ENV, RULE_ENV),
    "dotenv": (CAP_ENV, RULE_ENV),
    "environ": (CAP_ENV, RULE_ENV),
    "environb": (CAP_ENV, RULE_ENV),
    "getenv": (CAP_ENV, RULE_ENV),
    "putenv": (CAP_ENV, RULE_ENV),
    "unsetenv": (CAP_ENV, RULE_ENV),
    # ctypes / FFI(立因:直接调宿主原生代码,绕过一切 Python 层沙箱)
    "ctypes": (CAP_FFI, RULE_FFI),
    "cffi": (CAP_FFI, RULE_FFI),
    "_ctypes": (CAP_FFI, RULE_FFI),
    "mmap": (CAP_FFI, RULE_FFI),
    "dlopen": (CAP_FFI, RULE_FFI),
    "CDLL": (CAP_FFI, RULE_FFI),
    "WinDLL": (CAP_FFI, RULE_FFI),
    "PyDLL": (CAP_FFI, RULE_FFI),
}


def _lineno(node: ast.AST) -> int:
    """取 AST 节点行号;根节点(Module 等)无 lineno 时如实记 0,不猜不抛(§0.3)。"""
    return int(getattr(node, "lineno", 0))


def _finding(capability: str, rule: str, node: ast.AST, detail: str) -> dict[str, str]:
    """AST 触碰的审计 finding:evidence 带 L<行号> + 命中形态,供逐条复核。"""
    return {
        "capability": capability,
        "evidence": f"L{_lineno(node)}: {detail}",
        "rule": rule,
    }


def _decision_finding(capability: str, rule: str, detail: str) -> dict[str, str]:
    """判定级 finding(无 AST 行号):证据是策略/声明面的文字,同样三键齐备。"""
    return {"capability": capability, "evidence": f"decision: {detail}", "rule": rule}


def _call_name(func: ast.AST) -> tuple[str, str] | None:
    """把被调对象解成 (basename, dotted)。刻意只认 Name/Attribute 静态链。"""
    if isinstance(func, ast.Name):
        return func.id, func.id
    if isinstance(func, ast.Attribute):
        parts = [func.attr]
        cur: ast.AST = func.value
        while isinstance(cur, ast.Attribute):
            parts.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name):
            parts.append(cur.id)
            return func.attr, ".".join(reversed(parts))
        return func.attr, func.attr
    return None


def _has_str_constant(node: ast.AST) -> bool:
    return any(isinstance(n, ast.Constant) and isinstance(n.value, str) for n in ast.walk(node))


def _has_string_concat_arg(call: ast.Call) -> bool:
    """反射调用的参数里是否出现'字符串 + 字符串'拼接(动态目标,看不全)。"""
    args = list(call.args) + [kw.value for kw in call.keywords]
    return any(
        isinstance(a, ast.BinOp) and isinstance(a.op, ast.Add) and _has_str_constant(a)
        for a in args
    )


def _shape_reason(request: object, policy: object) -> str | None:
    """形状校验:任一输入不认就返回原因,调用方据此落 unjudged(绝不静默放行)。

    判据:request/policy 必须 dict、capabilities 规则集存在且为字符串集合、
    code 为 str、language 已登记、requested_capabilities 为字符串列表。
    """
    if not isinstance(request, dict):
        return "request 形状不认:非 dict,无法读取 code/language/requested_capabilities"
    if not isinstance(policy, dict):
        return "policy 形状不认:非 dict,无法读取 capabilities 规则集"
    # 白名单制最硬的一格:策略缺规则集 ⇒ 整层拒绝判定,绝不回退到硬编码黑名单(§0.3/§0.10)。
    if "capabilities" not in policy:
        return "policy 缺 capabilities 规则集:白名单制下无从判断能力放行,一律阻断"
    caps = policy["capabilities"]
    if not isinstance(caps, (list, tuple, set, frozenset)) or not all(
        isinstance(c, str) for c in caps
    ):
        return "policy.capabilities 形状不认:需为字符串集合(list/tuple/set/frozenset)"
    code = request.get("code")
    if not isinstance(code, str):
        return "code 形状不认:非字符串,静态判据无从解析"
    language = request.get("language")
    if not isinstance(language, str):
        return "language 形状不认:非字符串"
    if language not in SUPPORTED_LANGUAGES:
        return (
            f"language 未登记:{language!r} 不在 {sorted(SUPPORTED_LANGUAGES)},"
            "不得凭猜测按 python 解析 ⇒ 阻断"
        )
    requested = request.get("requested_capabilities")
    if not isinstance(requested, (list, tuple)) or not all(
        isinstance(c, str) for c in requested
    ):
        return "requested_capabilities 形状不认:需为字符串列表"
    return None


def _scan_tree(tree: ast.AST) -> tuple[list[dict[str, str]], set[str], bool]:
    """静态扫描:返回 (findings, detected 能力集, 是否出现不透明动态符号)。

    纯函数,只读 AST、不执行。每条命中按 (行号, capability, rule) 去重,
    避免同一节点被 Call 与 Name 两处各记一次却语义重复。
    """
    findings: list[dict[str, str]] = []
    detected: set[str] = set()
    opaque = False
    seen: set[tuple[int, str, str]] = set()

    def add(capability: str, rule: str, node: ast.AST, detail: str) -> None:
        nonlocal opaque
        key = (_lineno(node), capability, rule)
        if key in seen:
            return
        seen.add(key)
        findings.append(_finding(capability, rule, node, detail))
        if capability == CAP_DYNAMIC_SYMBOL:
            opaque = True
        else:
            detected.add(capability)

    def classify(name: str, node: ast.AST, detail: str) -> None:
        hit = _TOKEN_RULES.get(name)
        if hit is not None:
            add(hit[0], hit[1], node, detail)
            return
        low = name.lower()
        # 只认"非标准大小写变体"(Eval / GetAttr / __IMPORT__);name == low 的
        # 普通名(如 list.remove 的 remove)一律不判,刻意不误伤纯计算。
        if name != low and low in _EVASION_LOWER:
            add(CAP_DYNAMIC_SYMBOL, RULE_CASE_EVASION, node, f"大小写变体 {name!r}(疑似 {low!r})")

    for node in ast.walk(tree):
        tokens: list[tuple[str, str]] = []
        if isinstance(node, ast.Import):
            for alias in node.names:
                tokens.append((alias.name.split(".")[0], f"import {alias.name}"))
        elif isinstance(node, ast.ImportFrom):
            mod = (node.module or "").split(".")[0]
            if mod:
                tokens.append((mod, f"from {node.module} import ..."))
            for alias in node.names:
                tokens.append((alias.name, f"from {node.module} import {alias.name}"))
        elif isinstance(node, ast.Call):
            # 调用目标不是静态标识符(拼接 / 下标 / 嵌套调用)⇒ 看不全,形状不认。
            if not isinstance(node.func, (ast.Name, ast.Attribute)):
                add(CAP_DYNAMIC_SYMBOL, RULE_OPAQUE_CALL, node, "调用目标非静态标识符(动态构造)")
            name_pair = _call_name(node.func)
            if name_pair is not None:
                base, dotted = name_pair
                tokens.append((base, f"call {dotted}"))
                if base in _REFLECT_NAMES and _has_string_concat_arg(node):
                    add(CAP_DYNAMIC_SYMBOL, RULE_OPAQUE_ARG, node, f"{dotted} 目标为拼接字符串")
        elif isinstance(node, ast.Attribute):
            tokens.append((node.attr, f"attribute .{node.attr}"))
        elif isinstance(node, ast.Name):
            tokens.append((node.id, f"name {node.id}"))

        for name, detail in tokens:
            classify(name, node, detail)

    return findings, detected, opaque


def _result(
    verdict: str,
    tier: str,
    reason: str,
    findings: list[dict[str, str]],
    detected: set[str],
) -> dict[str, Any]:
    """结构化 verdict 唯一出口:三态 + 分级 + 原因 + 逐条 finding + 实测能力集。"""
    return {
        "verdict": verdict,
        "tier": tier,
        "reason": reason,
        "findings": findings,
        "detected_capabilities": sorted(detected),
    }


def decide_code_execution(request: object, policy: object) -> dict[str, Any]:
    """vm 级能力禁令主入口(纯函数,只静态准入,绝不执行代码/起 vm)。

    裁决序(任一步先满足即返回,绝不因解析不了就放行):
    1. 形状不认 ⇒ unjudged + reason;
    2. ast.parse 失败 ⇒ unjudged + reason;
    3. 出现不透明动态符号 ⇒ unjudged(形状不认,需定向说明);
    4. 零宿主能力触碰 ⇒ allowed(唯一放行出口,只读纯计算);
    5. 实测有而声明没有 ⇒ denied(声明与实测一致性);
    6. 其余宿主能力触碰 ⇒ denied(默认禁/白名单未放行 或 在册仍恒禁)。

    返回 dict 键:verdict / tier / reason / findings / detected_capabilities。
    """
    shape = _shape_reason(request, policy)
    if shape is not None:
        return _result(
            VERDICT_UNJUDGED,
            TIER_UNCLASSIFIED,
            shape,
            [_decision_finding("shape", RULE_SHAPE, shape)],
            set(),
        )

    # 形状已判过 ⇒ 收窄为 dict 取值(cast 只标注,不做运行时二次校验,无副作用)。
    req = cast("dict[str, Any]", request)
    pol = cast("dict[str, Any]", policy)
    code: str = req["code"]
    policy_caps = set(pol["capabilities"])
    requested = set(req["requested_capabilities"])

    try:
        tree = ast.parse(code)
    except (SyntaxError, ValueError) as exc:
        why = f"语法解析失败:{type(exc).__name__}: {exc} ⇒ 无法静态判定,绝不因解析不了就放行"
        return _result(
            VERDICT_UNJUDGED,
            TIER_UNCLASSIFIED,
            why,
            [_decision_finding("syntax", RULE_PARSE_FAIL, why)],
            set(),
        )

    findings, detected, opaque = _scan_tree(tree)

    # 动态符号(大小写变体 / 拼接调用 / 拼接反射目标):看不全就按形状不认阻断。
    if opaque:
        why = "检测到动态构造符号(大小写变体/字符串拼接),静态判据看不全 ⇒ 形状不认阻断,需定向说明"
        return _result(VERDICT_UNJUDGED, TIER_UNCLASSIFIED, why, findings, detected)

    # 零宿主能力触碰:只读纯计算,唯一 allowed 出口。
    if not detected:
        return _result(
            VERDICT_ALLOWED,
            TIER_COMPUTE_ONLY,
            "零宿主能力触碰(只读纯计算):AST 未命中进程/网络/文件写/动态 import/反射/环境/FFI",
            findings,
            detected,
        )

    # detected 非空 ⇒ vm 级能力禁令恒 denied;下面只决定拒绝的理由与证据。
    undeclared = sorted(detected - requested)
    if undeclared:
        why = (
            f"声明与实测不一致:实测触碰 {undeclared} 未出现在 requested_capabilities"
            "(声明少了也算不一致)⇒ 拒,需补齐定向说明"
        )
        for cap in undeclared:
            findings.append(_decision_finding(cap, RULE_UNDECLARED, f"实测有 {cap} 而声明缺失"))
        return _result(VERDICT_DENIED, TIER_HOST_TOUCH, why, findings, detected)

    not_allowlisted = sorted(detected - policy_caps)
    if not_allowlisted:
        why = f"默认禁(白名单制):实测触碰 {not_allowlisted} 未在 policy.capabilities 显式放行"
        for cap in not_allowlisted:
            findings.append(_decision_finding(cap, RULE_DEFAULT_DENY, f"{cap} 未显式放行"))
    else:
        why = "宿主能力禁令:实测触碰能力虽在 policy.capabilities 在册,vm 准入层一律不放下宿主句柄"
        for cap in sorted(detected):
            findings.append(_decision_finding(cap, RULE_HOST_BAN, f"{cap} 在册但准入层恒禁"))
    return _result(VERDICT_DENIED, TIER_HOST_TOUCH, why, findings, detected)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
