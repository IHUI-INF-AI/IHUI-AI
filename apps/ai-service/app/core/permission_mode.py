# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""权限模式唯一真源 —— Python 侧镜像(G-161,2026-09-22 立)。

TS 侧在 ``packages/types/src/permission-mode.ts``。两侧成员与别名映射必须逐字
一致,由 ``scripts/check-permission-mode-vocabulary.mjs``(guardian 第 68 项,
blocking)对账 —— 跨语言复刻判定路径历史上已经造过一次假"生效"(见
project memory: cross-language-replica-creates-phantom-bugs)。

为什么需要归一化而不是各自校验:同一语义曾有 5 套拼写在跑
(agent-runtime 5-camel / workspace 4-kebab / api-client 3-kebab /
本服务 agent_loop_v2 3 值 / 对外文档 5 值),非法值在 ``AgentLoopV2``
构造期直接 ``ValueError`` 打成 500,在 Pydantic 侧则被静默丢弃 ——
"客户端发了"和"服务端生效"之间没有任何一层负责对齐。

V3 #53(2026-09-27)在本文件追加 **ChatMode × PermissionMode 笛卡尔矩阵**唯一真源
(25 格 + 三条合成轴 + 收窄交集的唯一实现处),TS 镜像在
``packages/types/src/permission-mode.ts``,两侧逐格对账由
``scripts/check-mode-permission-matrix.mjs`` 负责(口径同本文件顶部那道门)。
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Final, Literal, TypedDict, cast

PermissionModeId = Literal["default", "acceptEdits", "bypassPermissions", "plan", "manual"]

PERMISSION_MODES: Final[tuple[str, ...]] = (
    "default",
    "acceptEdits",
    "bypassPermissions",
    "plan",
    "manual",
)

# 键为归一化键(permission_mode_key 的输出);三条非随手映射的依据见 TS 侧注释。
PERMISSION_MODE_ALIASES: Final[dict[str, PermissionModeId]] = {
    "default": "default",
    "acceptedits": "acceptEdits",
    "accept-edits": "acceptEdits",
    "bypasspermissions": "bypassPermissions",
    "bypass-permissions": "bypassPermissions",
    "plan": "plan",
    "manual": "manual",
    "auto": "acceptEdits",
    "accept-all": "bypassPermissions",
    "read-only": "plan",
    "plan-only": "plan",
}


def permission_mode_key(raw: str) -> str:
    """camelCase → kebab → 全小写,使 ``acceptEdits`` 与 ``accept-edits`` 同键。"""
    out: list[str] = []
    prev_lower = False
    for ch in raw.strip():
        if ch.isupper() and prev_lower:
            out.append("-")
        out.append(ch)
        prev_lower = ch.islower() or ch.isdigit()
    return "".join(out).lower()


def normalize_permission_mode(raw: object) -> PermissionModeId | None:
    """任意输入 → 规范标识;认不出返回 None(**不**回退 'default')。

    静默降级会让用户以为高危档已生效,与本次根治的静默失效同类,故由调用方
    显式处理 None(拒 400 / raise)。
    """
    if not isinstance(raw, str):
        return None
    key = permission_mode_key(raw)
    if not key:
        return None
    return PERMISSION_MODE_ALIASES.get(key)


def is_readonly_permission_mode(mode: str) -> bool:
    return mode == "plan"


def skips_approval_permission_mode(mode: str) -> bool:
    """acceptEdits / bypassPermissions 两档享有免审批(只读工具范围由调用方判定)。"""
    return mode in ("acceptEdits", "bypassPermissions")


def permission_mode_error(raw: object) -> str:
    """统一非法值文案 —— 别让三处 raise 各写一份取值清单。"""
    return (
        f"非法 permission_mode: {raw!r},取值必须为 "
        + " / ".join(f"'{m}'" for m in PERMISSION_MODES)
        + "(历史别名 auto/accept-edits/accept-all/read-only/plan-only 会自动归一)"
    )


# ===========================================================================
# ChatMode × PermissionMode 笛卡尔矩阵(V3 #53,2026-09-27 立)
# ===========================================================================
#
# 病根(票面):「计划模式只读」此前只写在提示词里(llm.py `_PLAN_MODE_PROMPT`),
# 模型不听就没有任何机制拦它。HEAD 里已经补出第一版硬收窄(llm.py 的
# `_CHAT_MODE_TOOL_POLICY` + 执行前第二道闸),但那一版**只有一条轴**:
#   · ChatMode → 工具档 有一张表(llm.py)
#   · PermissionMode → 审批档 有另一张表(llm.py `_resolve_tool_approval` +
#     TS 侧 `POLICY_BY_MODE`)
#   · 两轴**相交处**没有任何真源:既不是"plan 会话里 permission=bypassPermissions
#     该不该照样只读",也不是"chat 未知而 perm=plan 时算什么"。缺口的表现不是报错,
#     而是各处 if 各猜一个方向 —— 与 G-161 那批"5 套拼写各说各话"同型。
#
# 本段把相交处升格为**一张显式表**(不散在各处的 if):
#   CHAT_PERMISSION_TOOL_MATRIX[chat][perm]      → 'all' | 'readonly' | 'none'
#   CHAT_PERMISSION_APPROVAL_MATRIX[chat][perm]  → 'all' | 'safe' | 'none'
# 三轴定义(CHAT_MODE_TOOL_AXIS / PERMISSION_MODE_TOOL_AXIS /
# PERMISSION_MODE_APPROVAL_AXIS)是**输入**,25 格是**落库的产物**;
# 两者一致性由 scripts/check-mode-permission-matrix.mjs 机器对账
# (`check_matrix_consistency()` 在 Python 侧同判,pytest 亦钉)。
# 合成规矩(唯一一条,写在表里而不是散在 if 里):
#   tools   = 两轴取**更严**(none < readonly < all)—— 模式承诺不可被权限档放宽,
#             否则"选了 plan 却仍能写文件"正是本票要根治的那一格;
#   approval = 权限轴档位;只有 tools == 'none'(ask,根本没有工具可执行)才折成 'none'
#             —— 没东西可批。readonly 格**不**折(理由见轴三注释:那是可用性闸给的
#             结论,不是审批门的事实;把这一格折成 none 等于给未来的绕过路径留 fail-open)。

ChatModeId = Literal["ask", "build", "plan", "review", "spec"]
ToolClass = Literal["all", "readonly", "none"]
ApprovalClass = Literal["all", "safe", "none"]

CHAT_MODES: Final[tuple[str, ...]] = ("ask", "build", "plan", "review", "spec")
TOOL_CLASSES: Final[tuple[str, ...]] = ("none", "readonly", "all")
APPROVAL_CLASSES: Final[tuple[str, ...]] = ("none", "safe", "all")

# 轴一:ChatMode → 工具档(与 TS 侧 packages/types/src/chat-mode-policy.ts 的
# CHAT_MODE_TOOL_POLICY 逐字同;ask=纯问答、plan/review=只读、build/spec=全开)。
CHAT_MODE_TOOL_AXIS: Final[dict[str, ToolClass]] = {
    "ask": "none",
    "build": "all",
    "plan": "readonly",
    "review": "readonly",
    "spec": "all",
}

# 轴二:PermissionMode → 工具档。只有 plan 收窄,其余四档不额外收窄工具
# (bypassPermissions 也不放宽模式轴 —— 见上面的"取更严")。
PERMISSION_MODE_TOOL_AXIS: Final[dict[str, ToolClass]] = {
    "default": "all",
    "acceptEdits": "all",
    "bypassPermissions": "all",
    "plan": "readonly",
    "manual": "all",
}

# 轴三:PermissionMode → 审批档。
# 'all'=高危逐个审批(default / manual / **plan**),
# 'safe'=只放行安全/只读、其余仍审批(acceptEdits),
# 'none'=免审批(bypassPermissions)。
# 为什么 plan 记 'all' 而不是 'none':plan 档的工具面已被轴二收到 'readonly',
# 审批门理论上碰不到危险工具 —— 但"碰不到"是**上一道闸**给的结论,不是这一格的事实。
# 把这一格写成 none 等于"没人到达审批门时顺手关掉了审批门",一旦某条路径绕过可用性闸
# (今天是 2 道闸、明天可能是 3 条生产者),fail-open 就落在这格上。既有回归
# tests/test_llm_tool_approval_gate.py::test_plan_falls_back_to_default 钉的正是同一结论。
PERMISSION_MODE_APPROVAL_AXIS: Final[dict[str, ApprovalClass]] = {
    "default": "all",
    "acceptEdits": "safe",
    "bypassPermissions": "none",
    "plan": "all",
    "manual": "all",
}

_TOOLS_SEVERITY: dict[str, int] = {"none": 0, "readonly": 1, "all": 2}


def _derive_tool_matrix() -> dict[str, dict[str, ToolClass]]:
    out: dict[str, dict[str, ToolClass]] = {}
    for chat in CHAT_MODES:
        row: dict[str, ToolClass] = {}
        for perm in PERMISSION_MODES:
            a = CHAT_MODE_TOOL_AXIS[chat]
            b = PERMISSION_MODE_TOOL_AXIS[perm]
            row[perm] = a if _TOOLS_SEVERITY[a] <= _TOOLS_SEVERITY[b] else b
        out[chat] = row
    return out


def _derive_approval_matrix() -> dict[str, dict[str, ApprovalClass]]:
    tools_matrix = _derive_tool_matrix()
    out: dict[str, dict[str, ApprovalClass]] = {}
    for chat in CHAT_MODES:
        row: dict[str, ApprovalClass] = {}
        for perm in PERMISSION_MODES:
            # 只有"根本没有工具可执行"(ask)才把审批折成 none —— 没东西可批。
            row[perm] = "none" if tools_matrix[chat][perm] == "none" else (
                PERMISSION_MODE_APPROVAL_AXIS[perm]
            )
        out[chat] = row
    return out


# 落库的 25 格(由上面的规矩推导后**显式写出**,便于跨语言逐格对账与人读)。
CHAT_PERMISSION_TOOL_MATRIX: Final[dict[str, dict[str, ToolClass]]] = {
    "ask": {
        "default": "none",
        "acceptEdits": "none",
        "bypassPermissions": "none",
        "plan": "none",
        "manual": "none",
    },
    "build": {
        "default": "all",
        "acceptEdits": "all",
        "bypassPermissions": "all",
        "plan": "readonly",
        "manual": "all",
    },
    "plan": {
        "default": "readonly",
        "acceptEdits": "readonly",
        "bypassPermissions": "readonly",
        "plan": "readonly",
        "manual": "readonly",
    },
    "review": {
        "default": "readonly",
        "acceptEdits": "readonly",
        "bypassPermissions": "readonly",
        "plan": "readonly",
        "manual": "readonly",
    },
    "spec": {
        "default": "all",
        "acceptEdits": "all",
        "bypassPermissions": "all",
        "plan": "readonly",
        "manual": "all",
    },
}

CHAT_PERMISSION_APPROVAL_MATRIX: Final[dict[str, dict[str, ApprovalClass]]] = {
    "ask": {
        "default": "none",
        "acceptEdits": "none",
        "bypassPermissions": "none",
        "plan": "none",
        "manual": "none",
    },
    "build": {
        "default": "all",
        "acceptEdits": "safe",
        "bypassPermissions": "none",
        "plan": "all",
        "manual": "all",
    },
    "plan": {
        "default": "all",
        "acceptEdits": "safe",
        "bypassPermissions": "none",
        "plan": "all",
        "manual": "all",
    },
    "review": {
        "default": "all",
        "acceptEdits": "safe",
        "bypassPermissions": "none",
        "plan": "all",
        "manual": "all",
    },
    "spec": {
        "default": "all",
        "acceptEdits": "safe",
        "bypassPermissions": "none",
        "plan": "all",
        "manual": "all",
    },
}


def check_matrix_consistency() -> list[str]:
    """矩阵 ↔ 三轴的一致性自检(纯函数,返回问题清单;空列表 = 一致)。

    为什么需要它:25 格是**手写的产物**,三轴是**手写的输入**。任何一方被顺手改
    一格,另一边不会跟着响 —— 而矩阵正是"谁被拦"的唯一判据。
    scripts/check-mode-permission-matrix.mjs 与本模块的 pytest 都调这把尺子
    (只有一份实现,不在别处再抄一份推导规矩)。
    """
    problems: list[str] = []
    if set(CHAT_PERMISSION_TOOL_MATRIX) != set(CHAT_MODES):
        problems.append(
            f"工具矩阵的 ChatMode 行集与 CHAT_MODES 不等: {sorted(CHAT_PERMISSION_TOOL_MATRIX)}"
        )
    if set(CHAT_PERMISSION_APPROVAL_MATRIX) != set(CHAT_MODES):
        problems.append(
            f"审批矩阵的 ChatMode 行集与 CHAT_MODES 不等: {sorted(CHAT_PERMISSION_APPROVAL_MATRIX)}"
        )
    for chat in CHAT_MODES:
        for perm in PERMISSION_MODES:
            want_tools = _derive_tool_matrix().get(chat, {}).get(perm)
            got_tools = CHAT_PERMISSION_TOOL_MATRIX.get(chat, {}).get(perm)
            if got_tools != want_tools:
                problems.append(
                    f"CHAT_PERMISSION_TOOL_MATRIX[{chat}][{perm}]={got_tools!r} "
                    f"与三轴推导值 {want_tools!r} 不符"
                )
            want_appr = _derive_approval_matrix().get(chat, {}).get(perm)
            got_appr = CHAT_PERMISSION_APPROVAL_MATRIX.get(chat, {}).get(perm)
            if got_appr != want_appr:
                problems.append(
                    f"CHAT_PERMISSION_APPROVAL_MATRIX[{chat}][{perm}]={got_appr!r} "
                    f"与三轴推导值 {want_appr!r} 不符"
                )
    for chat, chat_tools in CHAT_MODE_TOOL_AXIS.items():
        if chat not in CHAT_MODES:
            problems.append(f"CHAT_MODE_TOOL_AXIS 含未登记 ChatMode: {chat}")
        if chat_tools not in TOOL_CLASSES:
            problems.append(f"CHAT_MODE_TOOL_AXIS[{chat}] 取值非法: {chat_tools}")
    for perm, perm_tools in PERMISSION_MODE_TOOL_AXIS.items():
        if perm not in PERMISSION_MODES:
            problems.append(f"PERMISSION_MODE_TOOL_AXIS 含未登记权限档: {perm}")
        if perm_tools not in TOOL_CLASSES:
            problems.append(f"PERMISSION_MODE_TOOL_AXIS[{perm}] 取值非法: {perm_tools}")
    for perm, perm_approval in PERMISSION_MODE_APPROVAL_AXIS.items():
        if perm not in PERMISSION_MODES:
            problems.append(f"PERMISSION_MODE_APPROVAL_AXIS 含未登记权限档: {perm}")
        if perm_approval not in APPROVAL_CLASSES:
            problems.append(f"PERMISSION_MODE_APPROVAL_AXIS[{perm}] 取值非法: {perm_approval}")
    return problems


class ModePolicy(TypedDict):
    """一次判定得到的结果(供执行前拦截、清单收窄、审批门共用)。"""

    chat_mode: str
    permission_mode: str
    tools: ToolClass
    approval: ApprovalClass


def normalize_chat_mode(raw: object) -> ChatModeId | None:
    """任意 ChatMode 输入 → 规范标识;认不出返回 None(**不**回退 build)。

    与 normalize_permission_mode 同规矩:调用方自己决定 None 的语义。
    llm.py 的 `_resolve_chat_mode` 负责 legacy plan_mode 兼容(它先归一再喂本函数)。
    """
    if not isinstance(raw, str):
        return None
    m = raw.strip().lower()
    if m in CHAT_MODES:
        return cast("ChatModeId", m)
    return None


def _is_absent(value: object) -> bool:
    """「没传」的判据(None 与空白串同档)—— 与「传了但认不出」必须分开,见 resolve_mode_policy。"""
    return value is None or (isinstance(value, str) and not value.strip())


def resolve_mode_policy(chat_mode: object, permission_mode: object) -> ModePolicy:
    """(ChatMode, PermissionMode) → 该组合下的工具档与审批档(唯一出口)。

    两个入参都接受任意拼写,但**「没传」与「传了却谁也不认识」是两件事**:
      · chat 缺席(None / 空串)→ 用产品默认档 'build',与 `_resolve_chat_mode`
        返回 None 的既有默认一致(这一档不改,改了等于改默认产品行为);
      · chat 是**非空但不认识的拼写** → 取能力最窄档 'ask'。
        原来这里写的是 `normalize_chat_mode(...) or "build"`,把两件事折成一件事:
        客户端把 chat_mode 打错一个字母,拿到的就是 `build` —— 现读序里 build 与 spec
        并列最宽(名次 2),即"没人认识这个值"被读成了"放宽"。守门「枚举兜底不得取宽档」
        量到的那条判红就是这个形状(它判 `X or 宽档` 这个**形态**,所以修法必须换形态,
        而不是在旧形态后面补一句注释)。
      · permission 缺席/认不出都取 'default'(审批轴最严:逐个高危审批,**不是**免批)。
    """
    normalized_chat = normalize_chat_mode(chat_mode)
    if normalized_chat is not None:
        chat: ChatModeId = normalized_chat
    elif _is_absent(chat_mode):
        chat = "build"
    else:
        chat = "ask"
    perm = normalize_permission_mode(permission_mode) or "default"
    return {
        "chat_mode": chat,
        "permission_mode": perm,
        "tools": CHAT_PERMISSION_TOOL_MATRIX[chat][perm],
        "approval": CHAT_PERMISSION_APPROVAL_MATRIX[chat][perm],
    }


def _readonly_tools() -> frozenset[str]:
    """只读白名单唯一真源(延迟导入,避免 core ↔ services 的导入环)。

    为什么在函数体内 import:`services/plan_mode.py` 顶部 import 了
    `core.llm_gateway`;若在模块顶层反向 import,某些导入顺序下会成环。
    运行时开销可忽略(Python 有模块缓存),换来的是"白名单只有 plan_mode 一份"。
    """
    from ..services.plan_mode import READONLY_TOOLS

    return READONLY_TOOLS


def tool_allowed_by_policy(policy: ModePolicy, tool_name: str) -> bool:
    """执行前判定:该工具在当前(模式 × 权限档)下是否允许执行。"""
    cls = policy["tools"]
    if cls == "all":
        return True
    if cls == "none":
        return False
    return tool_name in _readonly_tools()


def allowed_tool_names(policy: ModePolicy, names: Iterable[str]) -> frozenset[str]:
    """收窄交集的**唯一实现处**(V3 #53 判据二:交集只算一次)。

    返回集合而非保序列表 —— 需要保序的调用方(发给 LLM 的 tools 数组)自己按原序过滤,
    别再抄一遍 `in READONLY_TOOLS`。
    """
    all_names = frozenset(names)
    cls = policy["tools"]
    if cls == "all":
        return all_names
    if cls == "none":
        return frozenset()
    return all_names & _readonly_tools()


def blocked_tool_message(policy: ModePolicy, tool_name: str) -> str:
    """被拦文案(V3 #53 判据一 + V3 #49 口径:带原因 **和** 替代建议)。

    为什么必须有替代建议:一条模糊的"未知工具/不允许"会让模型原地重试到迭代打满
    (V3 #49 已为此定过口径),而"缺哪一格 + 改用什么 + 怎么解锁"才是一次可诊断的拒绝。

    短语「不在只读白名单」与开头的「permission_mode=<档>」是**契约的一部分**:
    AgentLoopV2 的模块 docstring(第 30-31 行)与 tests/test_permission_modes.py
    都按它断言,改措辞等于同时改两处 —— 所以文案也只允许这一处实现。
    """
    chat = policy["chat_mode"]
    perm = policy["permission_mode"]
    cls = policy["tools"]
    if cls == "none":
        reason = (
            f"permission_mode={perm}:当前 chat_mode={chat} 禁用全部工具,"
            f"工具 {tool_name} 被拦截,本次未执行。"
        )
        advice = "请直接以文本回答用户,不要重试该工具;确需动手执行时,请让用户切到 Build 模式。"
    else:
        reason = (
            f"permission_mode={perm}:工具 {tool_name} 不在只读白名单"
            f"(chat_mode={chat} 的工具档为 '{cls}',仅允许只读白名单内的工具),本次未执行。"
        )
        advice = (
            "可替代的只读工具:read_file / list_files / file_search / search_codebase / "
            "analyze_code —— 先用它们取证并把步骤写进计划;确需写文件或执行命令,"
            "请让用户切到 Build 模式后再调用。"
        )
    return f"{reason}{advice}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
