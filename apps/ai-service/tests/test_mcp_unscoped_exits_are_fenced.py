# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP「不判属主」出口的围栏(G-371 的常驻尺子,2026-09-29 立)。

判的是三件事,每条都配成对的正例 + 反例:

1. **调用点白名单** —— `app/` 面上 `list_available_tools_unscoped(` 与
   `call_external_tool_unscoped(` 的**调用点**数量必须恰为 2,且都落在
   `app/routers/agents.py`(对话装配链 `_build_supertool_pool` / `_supertool_invoke`)。
   判的是调用点,不是"文件里有没有这个词":定义行(`def xxx_unscoped(`)与 docstring /
   注释里大量出现这两个名字(解释处、解阻前置处),按出现次数或整文件搜串要么恒红要么恒绿。
2. **HTTP 端点面必须走收窄出口** —— `app/routers/mcp.py` 里对外部 server 的工具/详情做读写
   的那三支(`GET /mcp/external/tools`、`POST /mcp/external/tools/call`、
   `GET /mcp/external/servers/{name}/capabilities`)必须调**带主体**的出口,且主体实参要在
   那次调用的括号内;那一支文件里出现 `_unscoped` 调用即判红。防的是"新加一支端点顺手复制旧写法"。
3. **反向对照(最重要)** —— 判据必须能咬住它要防的那个坏形态:同一行写成真代码必须报,
   只写进注释/docstring 必须不报。两个方向都由构造面证明,见 `_ROUTER_*` / `*_SNIPPET` 夹具。

判据 1 与判据 2 吃两个等长的遮噪面(见 `mask_non_code` / `mask_prose` 上方说明):调用点判据
要把字符串全抹掉(写在串里/注释里的字样不是"选用这一支"),而路由路径 `"/mcp/external/tools"`
本身住在字符串里 —— 用同一个面就会把"路径看不见"误报成"这条路由不存在"。

取材面 = **工作树磁盘**,因为本文件是回归锁不是守门:它判的是"这条禁令今天还在不在",
而守门要按被审面(HEAD blob / 索引 blob)取内容并配棘轮基线,那是另一张票的口径。
它也因此**刻意不接进** `scripts/guardian-runner.mjs` 或任何注册表。
为什么它不是一台恒红门:动手前现读 `grep -rn "_unscoped" app/ --include=*.py` 量到 5 处,
其中调用点恰 2 处且都在 `agents.py`(另 3 处是 2 个定义行 + 1 处 docstring 提及),
所以它在干净工作树上恒绿;一旦有人在别的文件或端点里新调 `_unscoped`,它当场红 ——
那正是它存在的理由(散文约束没有尺子,下一次有人在 HTTP 端点图省事调 `_unscoped`,
账面什么都不会红,而收窄等于没做)。

判据只扫 `app/**`,不扫 `tests/**`,所以本文件里出现的这两个名字(正则与夹具文本)
结构上不会自己触发判据,无需任何行内豁免。已知覆盖面边界:只判 `.py`;把函数名与其左
括号拆到两行的写法不在射程(本仓实测 0 处)。
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import Final, NamedTuple

SERVICE_ROOT: Final = Path(__file__).resolve().parent.parent
APP_DIR: Final = SERVICE_ROOT / "app"
MCP_ROUTER_PATH: Final = APP_DIR / "routers" / "mcp.py"

# 两个"不判属主"的兄弟出口(定义在 app/services/mcp_client.py::MCPClientManager)
UNSCOPED_EXITS: Final = ("list_available_tools_unscoped", "call_external_tool_unscoped")
# 调用点白名单:装配链那两处,别的文件一处都不许有
ALLOWED_CALL_SITE_FILES: Final = frozenset({"app/routers/agents.py"})
EXPECTED_CALL_SITE_TOTAL: Final = 2
# 每个出口各一次(总量对了但同一个出口被调两次、另一个被搬去别处,同样是破围栏)
EXPECTED_PER_EXIT: Final = 1

UNSCOPED_CALL_RE: Final = re.compile(rf"\b(?:{'|'.join(UNSCOPED_EXITS)})\s*\(")
DEF_LINE_RE: Final = re.compile(r"^\s*(?:async\s+)?def\s")

# (HTTP 动词, 路由路径, 必须调的收窄出口, 必须出现在该次调用括号内的主体实参)
# 三支与 tests/test_mcp_external_owner_authz.py 第二层的"详情/工具/调用"逐一对应。
ExternalEndpoint = tuple[str, str, str, str]
EXTERNAL_ENDPOINTS: Final[tuple[ExternalEndpoint, ...]] = (
    ("get", "/mcp/external/tools", r"\blist_available_tools_async\s*\(", r"\buser_id\b"),
    (
        "post",
        "/mcp/external/tools/call",
        r"\bmanager\.call_external_tool\s*\(",
        r"\bcaller_user_id\s*=",
    ),
    (
        "get",
        "/mcp/external/servers/{name}/capabilities",
        r"\bclient_status_visible\s*\(",
        r"\buser_id\b",
    ),
)


class Site(NamedTuple):
    """一处调用点:物理行号 + 该行遮噪后的代码面。"""

    lineno: int
    code: str


# ---------------------------------------------------------------------------
# 遮噪:等长抹成空格,行号与列位不变。两把尺子吃两个面,分工如下
#
#   mask_non_code(代码面)—— 注释 + 全部字符串(含 docstring)都抹掉。调用点判据与
#     函数体判据吃这一面:`"call_external_tool_unscoped()"` 这种写在字符串/注释里的
#     字样不是"选用这一支"。
#   mask_prose(散文面)—— 只抹注释与三引号串,保留单行串。它**只**用来定位路由装饰器:
#     路由路径 `"/mcp/external/tools"` 本身住在字符串里,在代码面上是不可见的,拿代码面
#     找装饰器会得到"找不到该路由"这种假失明。
#
#   两面对齐(等长)是硬要求:装饰器在散文面上定偏移、括号配平在代码面上走(串里的括号
#   已被抹掉,配平才不会被字符串内容打乱)、函数体按行从代码面取。
# ---------------------------------------------------------------------------


def _mask(text: str, *, keep_single_line_strings: bool) -> str:
    """把注释与字符串抹成等长空格;`keep_single_line_strings=True` 时单行串原样保留。"""
    out: list[str] = []
    i, n = 0, len(text)
    state = "code"
    delim = ""
    while i < n:
        ch = text[i]
        if state == "line_comment":
            if ch == "\n":
                state = "code"
                out.append("\n")
            else:
                out.append(" ")
            i += 1
            continue
        if state in ("string", "triple"):
            if text.startswith(delim, i):
                # 单行串在"保留"档下逐字抄走(只当遮噪器认得它,不当它是散文)
                keep = keep_single_line_strings and state == "string"
                seg = text[i : i + len(delim)]
                out.append(seg if keep else " " * len(delim))
                i += len(delim)
                state = "code"
                continue
            if ch == "\\" and i + 1 < n:
                nxt = text[i + 1]
                if state == "triple":
                    out.append(" \n" if nxt == "\n" else "  ")
                else:
                    keep = keep_single_line_strings
                    out.append(text[i : i + 2] if keep else (" \n" if nxt == "\n" else "  "))
                i += 2
                continue
            if ch == "\n":
                if state == "string":
                    # 单行串不允许真的跨行(除了上面处理过的 \\ 续行);遇到裸换行就退出该状态,
                    # 免得一个坏形态把后面整篇都当成字符串抹掉
                    state = "code"
                    out.append("\n")
                    i += 1
                    continue
                out.append("\n")
                i += 1
                continue
            if state == "string" and keep_single_line_strings:
                out.append(ch)
            else:
                out.append(" ")
            i += 1
            continue
        # code
        if ch == "#":
            state = "line_comment"
            out.append(" ")
            i += 1
            continue
        for candidate in ('"""', "'''", '"', "'"):
            if text.startswith(candidate, i):
                if candidate in ('"""', "'''"):
                    state = "triple"
                else:
                    state = "string"
                delim = candidate
                keep = keep_single_line_strings and state == "string"
                out.append(candidate if keep else " " * len(candidate))
                i += len(candidate)
                break
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def mask_non_code(text: str) -> str:
    """代码面:注释 + 全部字符串抹成等长空格(行号/列位不变)。

    转义对(`\\` + 下一个字符)一起吃掉,否则 raw 串里的 `\\"` 会把结束引号误判成被转义;
    唯一例外是被转义的那个字符若是换行,必须把换行放回原位(否则行号漂移)。
    """
    return _mask(text, keep_single_line_strings=False)


def mask_prose(text: str) -> str:
    """散文面:注释与三引号串抹掉,单行串保留(只为让路由路径仍然可读)。"""
    return _mask(text, keep_single_line_strings=True)


# ---------------------------------------------------------------------------
# 判据 1:调用点
# ---------------------------------------------------------------------------


def unscoped_call_sites(masked: str) -> list[Site]:
    """在遮噪后的代码面上找两个 `_unscoped` 出口的**调用点**。

    定义行(`(async) def xxx_unscoped(`)不算 —— 那是出口自己,不是选用它的人。
    """
    sites: list[Site] = []
    for lineno, line in enumerate(masked.splitlines(), start=1):
        if DEF_LINE_RE.match(line):
            continue
        if UNSCOPED_CALL_RE.search(line):
            sites.append(Site(lineno, line.strip()))
    return sites


def app_unscoped_sites() -> dict[str, list[Site]]:
    """扫 `app/**` 全部 .py,返回 {相对路径: 调用点列表}(只留有命中的文件)。"""
    found: dict[str, list[Site]] = {}
    for path in sorted(p for p in APP_DIR.rglob("*.py") if "__pycache__" not in p.parts):
        sites = unscoped_call_sites(mask_non_code(path.read_text(encoding="utf-8-sig")))
        if sites:
            found[path.relative_to(SERVICE_ROOT).as_posix()] = sites
    return found


def _names_of(sites: list[Site]) -> Counter[str]:
    return Counter(
        name
        for _lineno, code in sites
        for name in UNSCOPED_EXITS
        if re.search(rf"\b{name}\s*\(", code)
    )


def describe_sites(found: dict[str, list[Site]]) -> str:
    return "; ".join(
        f"{rel}:{site.lineno} {site.code}" for rel, sites in sorted(found.items()) for site in sites
    ) or "(无)"


# ---------------------------------------------------------------------------
# 判据 2:HTTP 端点面
# ---------------------------------------------------------------------------


def handler_body(prose: str, code: str, verb: str, path: str) -> str | None:
    """按**路由路径**(不是函数名)定位处理函数,返回其代码面函数体。

    键在路径上是为了让"把函数改名"不构成脱检;找不到路由、找不到紧随其后的 def、或签名
    括号配不平,都返回 None 由调用方判"判据失明",绝不静默当成通过。
    装饰器在散文面上定位(路径字符串在那一面才可见),函数体从代码面按行取(两面对齐)。
    """
    deco = re.search(
        r"@router\." + re.escape(verb) + r"\(\s*['\"]" + re.escape(path) + r"['\"]",
        prose,
    )
    if deco is None:
        return None
    sig = re.search(r"\n[ \t]*(?:async[ \t]+)?def[ \t]+\w+[ \t]*\(", prose[deco.end() :])
    if sig is None:
        return None
    open_paren = deco.end() + sig.end() - 1
    # 签名可能跨行,收尾的 ")" 常顶格 —— 直接按缩进找函数体会在签名最后一行就截断,
    # 所以先括号配平到签名结束(在代码面上走:串里的括号已被抹掉,配平才不会被内容打乱)
    depth = 0
    idx = open_paren
    while idx < len(code):
        ch = code[idx]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                break
        idx += 1
    else:
        return None
    sig_tail = prose.find("\n", idx)
    sig_last_line = prose[: sig_tail if sig_tail != -1 else len(prose)].count("\n")
    body: list[str] = []
    # 函数体 = 签名最后一行之后的"空行或有缩进"的行;遇到顶格行(下一个装饰器/def)即停
    for line in code.splitlines()[sig_last_line + 1 :]:
        if line.strip() == "" or line[:1].isspace():
            body.append(line)
            continue
        break
    return "\n".join(body)


def call_arg_span(body: str, exit_re: str) -> str | None:
    """取 `exit_re` 命中的那次调用的**实参括号内文本**(括号配平,跨行有效)。

    主体实参必须在这段里被判,否则签名上的 `user_id: str = Depends(...)` 会给
    "调了收窄出口却没传主体"发合格证。
    """
    match = re.search(exit_re, body)
    if match is None:
        return None
    depth = 0
    for idx in range(match.end() - 1, len(body)):
        ch = body[idx]
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return body[match.end() : idx]
    return None


def endpoint_exit_violations(source: str) -> list[str]:
    """返回三支外部端点的违规点名;空列表 = 三支都走带主体的收窄出口。

    吃**原文**(内部自己出两个面),这样调用方不需要知道"装饰器要用散文面、函数体要用代码面"
    这件容易搞混的事 —— 用错面的表现是"找不到该路由"或"路径里的字符串看不见",都不是真结论。
    """
    prose = mask_prose(source)
    code = mask_non_code(source)
    violations: list[str] = []
    for verb, path, exit_re, principal_re in EXTERNAL_ENDPOINTS:
        body = handler_body(prose, code, verb, path)
        if body is None:
            violations.append(f"{verb.upper()} {path}: 找不到该路由的处理函数(判据失明,不记通过)")
            continue
        bad = UNSCOPED_CALL_RE.search(body)
        if bad is not None:
            violations.append(
                f"{verb.upper()} {path}: 函数体选用了不判属主的出口 `{bad.group(0).strip()}` "
                "(收窄等于没做)"
            )
            continue
        span = call_arg_span(body, exit_re)
        if span is None:
            violations.append(f"{verb.upper()} {path}: 函数体没有调用带主体的收窄出口 {exit_re}")
            continue
        if not re.search(principal_re, span):
            violations.append(
                f"{verb.upper()} {path}: 调了收窄出口却没传主体实参 {principal_re}"
            )
    if violations:
        return violations
    # 三支之外新加的端点也在射程内:整个 router 文件的代码面不得有任何 _unscoped 调用
    stray = unscoped_call_sites(code)
    return [
        f"{MCP_ROUTER_PATH.relative_to(SERVICE_ROOT).as_posix()}:{site.lineno} "
        f"router 文件里出现了 _unscoped 调用:{site.code}"
        for site in stray
    ]


# ---------------------------------------------------------------------------
# 判据 3 的构造面(证明上面两把尺子都有牙,两个方向各一次)
# ---------------------------------------------------------------------------

# 真代码调用 + 同名出现在注释里:只应报出真代码那一行
_CODE_CALL_SNIPPET: Final = '''
async def list_external_tools(user_id: str):
    manager = get_mcp_client_manager()
    # 旧写法照抄:这里调 list_available_tools_unscoped() 省事
    tools = await manager.list_available_tools_unscoped()
    return tools
'''

# 同一支名字只活在 docstring 与注释里:一个调用点都不许报
_DOC_ONLY_SNIPPET: Final = '''
async def list_external_tools(user_id: str):
    """列出该主体看得见的外部工具。

    解阻前置写在这里:以前是 list_available_tools_unscoped(),现在必须走收窄出口。
    """
    manager = get_mcp_client_manager()
    # list_available_tools_unscoped() 只是解释,不是调用
    return await manager.list_available_tools_async(user_id)
'''

# 定义处本身(含跨行签名):不算调用点,否则 mcp_client.py 恒红
_DEF_ONLY_SNIPPET: Final = '''
class MCPClientManager:
    async def list_available_tools_unscoped(self) -> list[str]:
        """不判属主的内部路径。"""
        return []

    async def call_external_tool_unscoped(
        self, server_name: str, tool_name: str, args: dict
    ) -> dict:
        return {}
'''

_ROUTER_HEAD: Final = '''
router = APIRouter()


@router.get("/mcp/external/servers/{name}/capabilities")
async def get_external_server_capabilities(name: str, user_id: str = Depends(require_request_user_id)):
    manager = get_mcp_client_manager()
    return manager.client_status_visible(name, user_id)


@router.post("/mcp/external/tools/call")
async def call_external_tool(req, user_id: str = Depends(require_request_user_id)):
    manager = get_mcp_client_manager()
    result = await manager.call_external_tool(
        req.server, req.tool, req.arguments, caller_user_id=user_id
    )
    return result
'''

_ROUTER_GOOD: Final = (
    _ROUTER_HEAD
    + '''

@router.get("/mcp/external/tools")
async def list_external_tools(user_id: str = Depends(require_request_user_id)):
    manager = get_mcp_client_manager()
    tools = await manager.list_available_tools_async(user_id)
    return {"tools": tools}
'''
)

# 坏形态 A:端点函数体里选了 _unscoped 出口
_ROUTER_BAD_UNSCOPED: Final = _ROUTER_GOOD.replace(
    "list_available_tools_async(user_id)",
    "list_available_tools_unscoped()",
)

# 坏形态 B:调了收窄出口却没把主体传进去(签名里那个 user_id 不许顶它)
_ROUTER_BAD_NO_PRINCIPAL: Final = _ROUTER_GOOD.replace(
    "list_available_tools_async(user_id)",
    "list_available_tools_async()",
)

# 坏形态 C:同样的字样只写在注释里 —— 必须不报(否则本判据就是恒红门)
_ROUTER_COMMENT_ONLY: Final = _ROUTER_GOOD.replace(
    "    tools = await manager.list_available_tools_async(user_id)",
    "    # 以前这里写 list_available_tools_async(user_id) / list_available_tools_unscoped()\n"
    "    tools = await manager.list_available_tools_async(user_id)",
)


# ---------------------------------------------------------------------------
# 用例
# ---------------------------------------------------------------------------


def test_unscoped_call_sites_are_exactly_the_assembly_chain():
    """判据 1(正例面向真仓):app/ 面上的 _unscoped 调用点恰为 2 且都在 agents.py。"""
    found = app_unscoped_sites()
    detail = describe_sites(found)
    total = sum(len(sites) for sites in found.values())
    assert total == EXPECTED_CALL_SITE_TOTAL, (
        f"_unscoped 调用点现读 {total} 处(期望 {EXPECTED_CALL_SITE_TOTAL}):{detail}"
    )
    assert set(found) == set(ALLOWED_CALL_SITE_FILES), (
        f"_unscoped 调用点只许落在对话装配链 {sorted(ALLOWED_CALL_SITE_FILES)},"
        f"实际出现在:{sorted(found)}({detail})"
    )
    counts = _names_of([site for sites in found.values() for site in sites])
    for name in UNSCOPED_EXITS:
        assert counts[name] == EXPECTED_PER_EXIT, (
            f"`{name}` 的调用点现读 {counts[name]} 处(期望 {EXPECTED_PER_EXIT}):{detail}"
        )


def test_external_endpoints_call_the_principal_bearing_exit():
    """判据 2(正例面向真仓):mcp.py 那三支必须调带主体的收窄出口,且全文件零 _unscoped 调用。"""
    assert MCP_ROUTER_PATH.is_file(), f"取不到被审文件:{MCP_ROUTER_PATH}"
    violations = endpoint_exit_violations(MCP_ROUTER_PATH.read_text(encoding="utf-8-sig"))
    assert violations == [], (
        "外部 server 数据面端点没有都走带主体的出口:\n  - " + "\n  - ".join(violations)
    )


def test_ruler_reports_a_real_unscoped_call_in_constructed_code():
    """判据 3 反向对照 A(红臂):真代码里的 _unscoped 调用必须被点名。"""
    sites = unscoped_call_sites(mask_non_code(_CODE_CALL_SNIPPET))
    assert len(sites) == 1, f"构造面里的真调用应报 1 处,实报 {len(sites)}:{sites}"
    assert "list_available_tools_unscoped" in sites[0].code
    # 注释里那一句没被算成第二个调用点(否则本判据在真仓上会恒红)
    assert sites[0].code.startswith("tools ="), f"报错了行:{sites}"


def test_ruler_stays_silent_when_the_same_line_lives_in_a_docstring():
    """判据 3 反向对照 B(绿臂):同一字样只在 docstring/注释里时必须零命中。"""
    assert unscoped_call_sites(mask_non_code(_DOC_ONLY_SNIPPET)) == []
    # 定义处(含跨行签名)也不许被当成调用点 —— 否则 mcp_client.py 自己就红了
    assert unscoped_call_sites(mask_non_code(_DEF_ONLY_SNIPPET)) == []


def test_endpoint_ruler_fires_on_bad_shapes_and_stays_quiet_on_prose():
    """判据 3 反向对照 C(两支红 + 一支绿):端点侧的坏写法必须红,注释里的字样必须绿。"""
    bad_unscoped = endpoint_exit_violations(_ROUTER_BAD_UNSCOPED)
    assert len(bad_unscoped) == 1, f"选了 _unscoped 的端点应报 1 条,实报:{bad_unscoped}"
    assert "/mcp/external/tools" in bad_unscoped[0]
    assert "不判属主" in bad_unscoped[0]

    no_principal = endpoint_exit_violations(_ROUTER_BAD_NO_PRINCIPAL)
    assert len(no_principal) == 1, f"没传主体的收窄出口应报 1 条,实报:{no_principal}"
    assert "主体" in no_principal[0]

    assert endpoint_exit_violations(_ROUTER_GOOD) == []
    # 同样的字样只写在注释里:不得报(防恒红)
    assert endpoint_exit_violations(_ROUTER_COMMENT_ONLY) == []


def test_endpoint_ruler_blindly_fails_when_a_route_disappears():
    """判据 3 反向对照 D:路由找不到时判"判据失明",绝不静默记通过。"""
    truncated = _ROUTER_GOOD.replace('@router.get("/mcp/external/tools")', "")
    violations = endpoint_exit_violations(truncated)
    assert any("判据失明" in v for v in violations), f"路由被摘掉却什么都没报:{violations}"


def test_endpoint_ruler_handles_multiline_signature():
    """判据 3 反向对照 E:多行签名(收尾括号顶格)不得把函数体截断成假失明。

    真仓 `app/routers/mcp.py` 的三支里两支就是这个形态 —— 只按缩进找函数体会停在签名的
    `) -> ...:` 那一行,于是收窄出口"看不见",报的是"没调带主体的出口"这种错话。
    """
    multiline = _ROUTER_GOOD.replace(
        "async def list_external_tools(user_id: str = Depends(require_request_user_id)):",
        "async def list_external_tools(\n"
        "    user_id: str = Depends(require_request_user_id),\n"
        ") -> dict:",
    )
    assert endpoint_exit_violations(multiline) == []
    # 同一形态换成坏写法(选了 _unscoped)仍然必须红 —— 允许跨行不等于放过
    broken = multiline.replace(
        "list_available_tools_async(user_id)", "list_available_tools_unscoped()"
    )
    assert len(endpoint_exit_violations(broken)) == 1, "多行签名把判据瞎掉了"


def test_two_faces_are_length_aligned():
    """两个遮噪面必须逐字符等长 —— 装饰器在散文面定位、函数体在代码面取,靠的就是这个对齐。

    漂移的表现不是报错,而是把某个函数的体读成隔壁函数的体(判据照绿,而它判的是错对象)。
    """
    for snippet in (_ROUTER_GOOD, _CODE_CALL_SNIPPET, _DOC_ONLY_SNIPPET, _DEF_ONLY_SNIPPET):
        prose, code = mask_prose(snippet), mask_non_code(snippet)
        assert len(prose) == len(code) == len(snippet), "遮罩改动了长度 ⇒ 行号与偏移全部错位"
        assert prose.count("\n") == code.count("\n") == snippet.count("\n")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
