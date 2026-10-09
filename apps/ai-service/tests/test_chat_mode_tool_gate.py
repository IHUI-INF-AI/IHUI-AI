# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #53:计划模式硬收窄的跨语言快照对账 + 行为级证明。

这个文件本身是一次**否证**:llm.py 与 packages/types/src/chat-mode-policy.ts 的头注
在 2026-09-26 都写着"由 tests/test_chat_mode_tool_gate.py 的跨语言快照测试对账",
而该文件**在 HEAD 与磁盘上都不存在**(2026-09-27 现读:git cat-file -e 与 [ -f ] 双双落空)。
也就是说两侧矩阵此前零尺子,任何一格漂移都不会响 —— 本票把它补成真的。

分工(刻意不重复,否则又是一把尺子抄两遍):
  · 本 pytest = **镜像等值**:Python 常量 ≡ TS 文件里的表/清单(只做解析与等值比较);
    以及**行为级**:走 AgentLoopV2 生产入口,断言"被拒 + 未执行"。
  · scripts/check-mode-permission-matrix.mjs = **独立推导**三轴 → 25 格(它自己按规矩重算,
    不复用 Python 的 check_matrix_consistency),外加"交集唯一/出口有消费者"两条结构判据。
    推导规矩只在"声明侧"和"门侧"各存一份是有意的:两边同错才会静默,而门是 JS 侧独立实现。

矩阵真源在 app/core/permission_mode.py;只读白名单真源在 app/services/plan_mode.py。
本文件不写死任何一格取值(全部从两侧现读),所以"改真源忘改 TS"必然在这里红。

零外部依赖:不连 PG/Redis(§5 测试隔离铁律),LLM 与审批门全部 mock。
"""

from __future__ import annotations

import ast
import re
from collections.abc import Mapping
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.core.permission_mode import (
    CHAT_MODE_TOOL_AXIS,
    CHAT_PERMISSION_APPROVAL_MATRIX,
    CHAT_PERMISSION_TOOL_MATRIX,
    PERMISSION_MODE_APPROVAL_AXIS,
    PERMISSION_MODE_TOOL_AXIS,
    allowed_tool_names,
    blocked_tool_message,
    check_matrix_consistency,
    resolve_mode_policy,
    tool_allowed_by_policy,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.plan_mode import READONLY_TOOLS

# tests -> ai-service -> apps -> 仓库根(四段;写成 parents[2] 会指到 apps/ 下面)
REPO = Path(__file__).resolve().parents[3]
TS_REGISTRY = REPO / "packages/types/src" / "permission-mode.ts"
TS_CHAT_POLICY = REPO / "packages/types/src" / "chat-mode-policy.ts"
PY_LLM = REPO / "apps/ai-service/app/routers/llm.py"


# ---------------------------------------------------------------------------
# TS 侧读取(只解析,不重写推导规矩)
# ---------------------------------------------------------------------------


def _balanced(src: str, open_idx: int, label: str) -> str:
    depth = 0
    for i in range(open_idx, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return src[open_idx + 1 : i]
    raise AssertionError(f"{label} 花括号不配平")


def _ts_nested_table(src: str, name: str) -> dict[str, dict[str, str]]:
    at = src.index(f"export const {name}")
    body = _balanced(src, src.index("{", at), name)
    rows = re.findall(r"(?m)^\s*(\w+):\s*\{", body)
    out: dict[str, dict[str, str]] = {}
    for key in rows:
        seg = re.search(rf"{key}:\s*\{{([^}}]*)\}}", body)
        assert seg is not None, f"{name}[{key}] 解析不到行体"
        out[key] = dict(re.findall(r"(\w+):\s*'([^']+)'", seg.group(1)))
    assert out, f"{name} 解析为空"
    return out


def _ts_flat_table(src: str, name: str) -> dict[str, str]:
    at = src.index(f"export const {name}")
    body = _balanced(src, src.index("{", at), name)
    out = dict(re.findall(r"(?m)^\s*(\w+):\s*'([^']+)'", body))
    assert out, f"{name} 解析为空"
    return out


def _ts_string_array(src: str, name: str) -> set[str]:
    at = src.index(f"export const {name}")
    open_idx = src.index("[", src.index("=", at))  # 先 = 再 [:类型里的 [] 不是数组本体
    close_idx = src.index("]", open_idx)
    return set(re.findall(r"'([^']+)'", src[open_idx:close_idx]))


@pytest.fixture(scope="module")
def ts_registry_src() -> str:
    assert TS_REGISTRY.is_file(), f"TS 镜像文件不存在:{TS_REGISTRY}"
    return TS_REGISTRY.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def ts_chat_policy_src() -> str:
    assert TS_CHAT_POLICY.is_file(), f"TS 契约文件不存在:{TS_CHAT_POLICY}"
    return TS_CHAT_POLICY.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# ① 矩阵自洽 + 跨语言逐格等值
# ---------------------------------------------------------------------------


def test_python_matrix_equals_its_own_axes() -> None:
    """Python 侧 25 格 ≡ 三轴推导(实现只有 check_matrix_consistency 一处)。"""
    assert check_matrix_consistency() == []


def test_tool_matrix_is_cross_language_identical(ts_registry_src: str) -> None:
    ts = _ts_nested_table(ts_registry_src, "CHAT_PERMISSION_TOOL_MATRIX")
    assert set(ts) == set(CHAT_PERMISSION_TOOL_MATRIX), "ChatMode 行集两侧不等"
    for chat, row in CHAT_PERMISSION_TOOL_MATRIX.items():
        assert ts[chat] == row, f"工具矩阵 {chat} 行两侧不等:TS={ts[chat]} PY={row}"


def test_approval_matrix_is_cross_language_identical(ts_registry_src: str) -> None:
    ts = _ts_nested_table(ts_registry_src, "CHAT_PERMISSION_APPROVAL_MATRIX")
    assert set(ts) == set(CHAT_PERMISSION_APPROVAL_MATRIX)
    for chat, row in CHAT_PERMISSION_APPROVAL_MATRIX.items():
        assert ts[chat] == row, f"审批矩阵 {chat} 行两侧不等:TS={ts[chat]} PY={row}"


def test_three_axes_are_cross_language_identical(ts_registry_src: str) -> None:
    assert _ts_flat_table(ts_registry_src, "CHAT_MODE_TOOL_AXIS") == CHAT_MODE_TOOL_AXIS
    assert (
        _ts_flat_table(ts_registry_src, "PERMISSION_MODE_TOOL_AXIS") == PERMISSION_MODE_TOOL_AXIS
    )
    assert (
        _ts_flat_table(ts_registry_src, "PERMISSION_MODE_APPROVAL_AXIS")
        == PERMISSION_MODE_APPROVAL_AXIS
    )


def test_chat_mode_contract_table_matches_axis(ts_chat_policy_src: str) -> None:
    """chat-mode-policy.ts 那份带 description 的对外契约表必须与轴同值。

    两侧同义不同形是漂移的温床:契约表被前端读、轴被后端读,分叉即"UI 说只读、
    后端放行"。
    """
    table = _ts_nested_table(ts_chat_policy_src, "CHAT_MODE_TOOL_POLICY")
    allows = {chat: cell["allow"] for chat, cell in table.items()}
    assert allows == CHAT_MODE_TOOL_AXIS, f"契约表 allow 与轴分叉:TS={allows} PY={CHAT_MODE_TOOL_AXIS}"


def test_readonly_whitelist_snapshot_matches_python(ts_chat_policy_src: str) -> None:
    """只读白名单只有 plan_mode 一份真相;TS 那份是快照,漂移即红。"""
    snap = _ts_string_array(ts_chat_policy_src, "CHAT_MODE_READONLY_TOOLS")
    only_py = sorted(READONLY_TOOLS - snap)
    only_ts = sorted(snap - READONLY_TOOLS)
    assert not only_py and not only_ts, (
        f"只读白名单跨语言漂移 仅Python={only_py} 仅TS={only_ts}"
    )


# ---------------------------------------------------------------------------
# ② 关键格:模式承诺不可被权限档放宽(票面那一格)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("perm", ["default", "acceptEdits", "bypassPermissions", "plan", "manual"])
def test_plan_and_review_stay_readonly_under_every_permission_mode(perm: str) -> None:
    """plan/review × 任意权限档 ⇒ 工具档恒为 readonly。

    bypassPermissions 不能把"选了计划模式"顶成"可以写文件" —— 那是权限承诺与实际不符
    的原点,也是这张矩阵唯一真正的新语义。
    """
    for chat in ("plan", "review"):
        assert resolve_mode_policy(chat, perm)["tools"] == "readonly", f"{chat}×{perm}"
        assert not tool_allowed_by_policy(resolve_mode_policy(chat, perm), "write_file")
        assert tool_allowed_by_policy(resolve_mode_policy(chat, perm), "read_file")


def test_ask_mode_blocks_everything_including_whitelisted_reads() -> None:
    p = resolve_mode_policy("ask", "default")
    assert p["tools"] == "none"
    assert not tool_allowed_by_policy(p, "read_file")
    assert allowed_tool_names(p, ["read_file", "write_file"]) == frozenset()


def test_unknown_inputs_fall_back_conservatively() -> None:
    """**认不出**的拼写不得被读成"放宽":chat 未知 → ask(能力最窄档),permission 未知 → default。

    旧断言写的是 chat 未知 → build,而 build 在现读的能力序里与 spec 并列最宽 ——
    那条测试把"打错一个字母就拿到最宽工具档"当契约钉住了(守门「枚举兜底不得取宽档」判红的就是它)。
    改判据不削守卫、也不留半红:缺席与认不出现在分两档,两档各有一条断言。
    """
    p = resolve_mode_policy("bogus-mode", "bogus-perm")
    assert (p["chat_mode"], p["permission_mode"]) == ("ask", "default")
    assert tool_allowed_by_policy(p, "write_file") is False


def test_absent_chat_mode_keeps_the_product_default_contrast() -> None:
    """反向对照(防我把"收窄"做成 blanket):**没传** chat_mode 仍取既有默认档 build。

    只有"传了但没人认识"才降级;否则这条改动等于悄悄改掉全站默认聊天能力档。
    """
    for absent in (None, "", "   "):
        assert resolve_mode_policy(absent, "default")["chat_mode"] == "build"
    # 认得出的拼写照旧逐字生效,不被兜底逻辑碰。
    assert resolve_mode_policy("plan", "default")["chat_mode"] == "plan"


def test_build_mode_write_tool_is_allowed_contrast() -> None:
    """对照:同为 write_file,build×default 必须允许 —— 否则上一条的"拦"是 blanket。"""
    assert tool_allowed_by_policy(resolve_mode_policy("build", "default"), "write_file")


# ---------------------------------------------------------------------------
# ③ 行为级:计划模式下写工具"被拒 + 未执行"(断言没发出副作用)
# ---------------------------------------------------------------------------


def _tool(name: str, sink: list[str]) -> ToolDefinition:
    async def executor(_args: object) -> dict[str, bool]:
        sink.append(name)  # 只有真执行才会进这一格
        return {"ok": True}

    return ToolDefinition(
        name=name,
        description=f"{name} 工具",
        parameters={
            "type": "object",
            "properties": {"x": {"type": "string"}},
            "required": ["x"],
        },
        executor=executor,
    )


async def _run_with_single_call(
    names: list[str], permission_mode: str, want_tool: str, user_role: int = 0
):
    sink: list[str] = []
    state = {"n": 0}

    async def mock_llm(_messages: object, _tools: object) -> dict[str, object]:
        state["n"] += 1
        if state["n"] == 1:
            return {
                "content": "尝试调用",
                "tool_calls": [{"id": "c1", "name": want_tool, "args": {"x": "v"}}],
            }
        return {"content": "结束", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_tool(n, sink) for n in names],
        max_iterations=3,
        permission_mode=permission_mode,
        # 角色矩阵(V3 #47)与模式矩阵是两道闸:对照测试要给角色,否则拦它的是角色不是模式,
        # 断言就测错了对象。plan 那一组刻意留 role=0 —— 它要在"最严"的组合下也被拦。
        user_role=user_role,
    )
    loop._request_approval = AsyncMock(return_value=None)
    result = await loop.run([{"role": "user", "content": "go"}])
    return loop, sink, result


async def test_plan_mode_write_tool_is_rejected_and_never_executed() -> None:
    """计划模式(permission=plan)调 write_file:被拒、**执行器一次都没被调用**、不进审批门。

    断言的是副作用没发生(sink 为空),不是只看返回码 —— 只看 error 非空会把
    "执行完再报错"也算通过,那正是这类判据最没用的形态。
    """
    loop, sink, result = await _run_with_single_call(
        ["write_file", "read_file"], "plan", "write_file"
    )
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "write_file"
    assert tr.error is not None and tr.error_type == "permission_denied"
    assert sink == [], f"写工具被执行了(副作用已发生):{sink}"
    loop._request_approval.assert_not_awaited()  # 只读承诺下不进审批流,直接拒
    # 文案带原因 + 替代建议(V3 #49 口径:不得模糊到让模型原地重试)
    assert "不在只读白名单" in tr.error
    assert "permission_mode=plan" in tr.error
    assert "read_file" in tr.error and "Build" in tr.error


@pytest.mark.asyncio
async def test_plan_mode_blocks_write_tool_for_admin_role_by_mode_gate() -> None:
    """只读档真拦住了写工具,**且拦它的是模式闸** —— 角色闸给足(role=1)仍然拦。

    与 `test_plan_mode_write_tool_is_rejected_and_never_executed` 的分工:那一格跑在
    role=0 的"最严组合"下,两道闸都足以拒它,所以它证明的是"会被拒";本格把角色闸
    解掉后仍被拒,才把红/绿**唯一归因到模式矩阵**这一格。少了本格,把角色闸误当成
    模式闸生效的证据是成立的(而角色闸与 plan 档毫无关系)。

    断言形态刻意区分"返回码像被拒"与"副作用真的没发生":
      · `sink == []`      —— 执行器一次都没被调用(唯一写入点在执行器体内);
      · `tr.result is None` —— 没有执行产物回填。"跑完再报错"那一型会带着执行器返回的
        `{"ok": True}`,只看 `tr.error` 非空会把它一并放过(本仓教训:授权逻辑挪到
        查库后状态码仍然 403,只有 `whereSeen == 0` 这类"没发出查询"断言才抓得到);
      · `_request_approval.assert_not_awaited()` —— 连审批门都没进,不是"弹窗被用户拒"。
    文案必须自带原因 + 替代建议(V3 #49:模糊的"未知工具"会让模型原地重试到迭代打满),
    并且**不得**是角色闸的文案 —— 否则本格的归因就不成立。
    """
    loop, sink, result = await _run_with_single_call(
        ["write_file", "read_file"], "plan", "write_file", user_role=1
    )
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "write_file"
    assert tr.error is not None and tr.error_type == "permission_denied"
    assert sink == [], f"写工具被执行了(副作用已发生):{sink}"
    assert tr.result is None, f"回填了执行产物 ⇒ 不是'未执行'而是'执行后报错':{tr.result}"
    loop._request_approval.assert_not_awaited()
    assert "需要 admin 权限" not in tr.error, "本格必须由模式闸拦截,角色闸文案即归因失败"
    assert "不在只读白名单" in tr.error, "被拒文案须点名规则出处(原因),不得只说'不允许'"
    assert "permission_mode=plan" in tr.error
    assert "read_file" in tr.error and "Build" in tr.error, "缺替代建议/解锁出口即 V3 #49 违例"


@pytest.mark.asyncio
async def test_plan_mode_readonly_tool_still_executes() -> None:
    """同一引擎、同一入口,只读工具必须正常执行 —— 证明上一格拦的是"非只读",不是全拦。"""
    _loop, sink, result = await _run_with_single_call(
        ["write_file", "read_file"], "plan", "read_file"
    )
    tr = result.iterations[0].tool_results[0]
    assert tr.error is None
    assert sink == ["read_file"]


@pytest.mark.asyncio
async def test_build_permission_mode_executes_write_tool_contrast() -> None:
    """permission=default(无模式收窄)下同一 write_file 正常执行:矩阵不是 blanket 拦截。

    `user_role=1` 是本条对照**成立的前提**,不是绕开判据:执行链上有两道独立的闸
    (`_execute_single` 内顺序为 模式矩阵 → 角色矩阵 → 审批门),`write_file` 在
    `mcp_server._ADMIN_ONLY_TOOLS` 里,role=0 时被拦的是**角色闸**(V3 #47),
    与模式矩阵无关。本文件 helper 的头注早已写明"对照测试要给角色,否则拦它的是
    角色不是模式,断言就测错了对象" —— 缺了这个参数,本条测的就不是它声称测的东西。
    最后一行断言把这一区分钉在**文案**上:万一将来角色闸挪到模式闸之前,本条会以
    "被拦了"的形式翻红并点名原因,而不是静默地测错对象。
    """
    _loop, sink, result = await _run_with_single_call(
        ["write_file", "read_file"], "default", "write_file", user_role=1
    )
    tr = result.iterations[0].tool_results[0]
    assert tr.error is None, f"对照面被拦了:{tr.error}"
    assert "不在只读白名单" not in (tr.error or ""), "default 档不该出现模式矩阵文案"
    assert "需要 admin 权限" not in (tr.error or ""), "对照面须越过角色闸才测得到模式闸"
    assert sink == ["write_file"]


@pytest.mark.asyncio
async def test_plan_mode_narrows_visible_toolset_at_construction() -> None:
    """构造期收窄(第一道闸)由 allowed_tool_names 一处实现,LLM 根本看不到写工具。"""
    sink: list[str] = []
    loop = AgentLoopV2(
        AsyncMock(return_value={"content": "x", "tool_calls": None}),
        [_tool("write_file", sink), _tool("read_file", sink)],
        permission_mode="plan",
    )
    assert set(loop._tools) == {"read_file"}, sorted(loop._tools)


# ---------------------------------------------------------------------------
# ④ llm.py 侧判定层(纯函数,按 ast 抽源码片段执行,不拉起 FastAPI 依赖树)
# ---------------------------------------------------------------------------

_LLM_TARGETS = {
    "_resolve_chat_mode",
    "_chat_mode_allows_tool",
    "_filter_agent_tools_for_chat_mode",
    "_chat_mode_blocked_message",
    "_CHAT_MODE_TOOL_POLICY",
}


def _load_llm_judges() -> dict[str, object]:
    """从 llm.py 抽判定区单独 exec,并把矩阵出口注入命名空间(与被测代码同源,不复制实现)。"""
    tree = ast.parse(PY_LLM.read_text(encoding="utf-8"))
    picked = []
    for node in tree.body:
        names: set[str] = set()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names = {node.name}
        elif isinstance(node, ast.Assign):
            names = {t.id for t in node.targets if isinstance(t, ast.Name)}
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names = {node.target.id}
        if names & _LLM_TARGETS:
            picked.append(node)
    assert picked, "未在 llm.py 找到 ChatMode 判定区(函数名可能被重命名,需同步本测试)"
    ns: dict[str, object] = {
        "__builtins__": __builtins__,
        "Mapping": Mapping,
        "CHAT_MODE_TOOL_AXIS": CHAT_MODE_TOOL_AXIS,
        "resolve_mode_policy": resolve_mode_policy,
        "tool_allowed_by_policy": tool_allowed_by_policy,
        "allowed_tool_names": allowed_tool_names,
        "blocked_tool_message": blocked_tool_message,
    }
    exec(
        compile(ast.Module(body=picked, type_ignores=[]), str(PY_LLM), "exec"),
        ns,
    )
    return ns


@pytest.fixture(scope="module")
def llm_judges() -> dict[str, object]:
    return _load_llm_judges()


def test_llm_policy_is_a_projection_not_a_second_table(llm_judges: dict[str, object]) -> None:
    """llm.py 的 _CHAT_MODE_TOOL_POLICY 必须**等于**轴对象本身(别名),不是又抄一份。"""
    assert llm_judges["_CHAT_MODE_TOOL_POLICY"] is CHAT_MODE_TOOL_AXIS


def test_llm_hard_narrowing_per_mode(llm_judges: dict[str, object]) -> None:
    allows = llm_judges["_chat_mode_allows_tool"]
    assert callable(allows)
    assert allows("plan", "read_file") is True
    assert allows("plan", "write_file") is False
    # 关键格:permission=bypassPermissions 也顶不开 plan 的只读承诺
    assert allows("plan", "write_file", "bypassPermissions") is False
    assert allows("review", "git_operations") is False
    assert allows("ask", "read_file") is False
    assert allows("build", "write_file") is True
    assert allows(None, "write_file") is True  # 未声明模式 = 既有默认行为


def test_llm_tools_filter_is_order_preserving_intersection(
    llm_judges: dict[str, object],
) -> None:
    keep = llm_judges["_filter_agent_tools_for_chat_mode"]
    assert callable(keep)
    src = ["write_file", "read_file", "run_command", "list_files"]
    assert keep("plan", src) == ["read_file", "list_files"]
    assert keep("ask", src) == []
    assert keep("build", src) == src
    assert keep("plan", None) is None  # 上游未给工具清单 ⇒ 保持 None 语义


def test_llm_blocked_message_carries_reason_and_alternative(
    llm_judges: dict[str, object],
) -> None:
    msg = llm_judges["_chat_mode_blocked_message"]
    assert callable(msg)
    text = str(msg("plan", "write_file"))
    assert "不在只读白名单" in text
    assert "read_file" in text and "Build" in text  # 替代建议 + 解锁出口
    assert "TOOL EXECUTION FAILED" not in text  # 不是那种只回一句"失败"的模糊文案


def test_legacy_plan_mode_still_maps_to_plan(llm_judges: dict[str, object]) -> None:
    """legacy `plan_mode='plan'` 与 api 透传的 `mode='plan'` 必须落到同一判定链。

    这是判据四("ask 态真落到后端")的同一枚硬币:前端 ModeSwitcher 写 useModeStore,
    apps/api ai-chat-stream.ts 以 `mode` 透传,老客户端只发 plan_mode —— 两条都要归一。
    """
    resolve = llm_judges["_resolve_chat_mode"]
    assert callable(resolve)
    assert resolve("plan", None) == "plan"
    assert resolve("ask", None) == "ask"
    assert resolve(None, "plan") == "plan"
    assert resolve("act", "plan") == "plan"  # mode 非法时 legacy 仍生效
    assert resolve(None, "act") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# ---------------------------------------------------------------------------
# ⑤ 判据四:ask 态是否真的落到后端(不是只加一个 UI 选项)
# ---------------------------------------------------------------------------

API_ROUTE = REPO / "apps" / "api" / "src" / "routes" / "ai-chat-stream.ts"
MODE_UI = REPO / "apps" / "web" / "src" / "components" / "chat" / "mode-switcher.tsx"
LOCALES = ("zh-CN", "zh-TW", "en", "ja", "ko")


def test_ask_mode_reaches_backend_judgment_chain() -> None:
    """UI 有 ask 选项 → api 网关 schema 收 ask → ai-service 判定层把 ask 算成 'none'。

    三段缺任一段,ask 都只是"界面上一个能点的东西"。这里逐段现读,不引用文档结论。
    """
    ui = MODE_UI.read_text(encoding="utf-8")
    assert "mode: 'ask'" in ui, "ModeSwitcher 未列出 ask 档"
    api = API_ROUTE.read_text(encoding="utf-8")
    assert re.search(r"mode:\s*z\.enum\(\[[^\]]*'ask'[^\]]*\]\)", api), "api 网关不收 ask"
    allows = _load_llm_judges()["_chat_mode_allows_tool"]
    assert callable(allows) and allows("ask", "read_file") is False


def test_ask_mode_labels_exist_in_all_five_locales() -> None:
    """ask 档的两个文案键必须五语齐备 —— 缺语会让选项在界面上回显成键名。"""
    for lang in LOCALES:
        src = (REPO / "packages/i18n/messages/web" / f"{lang}.json").read_text(encoding="utf-8")
        assert '"modeAsk"' in src, f"{lang} 缺 chat.modeAsk"
        assert '"modeAskDesc"' in src, f"{lang} 缺 chat.modeAskDesc"
