# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""引擎内置工具 → 统一注册表能力的声明式桥(V3 #47,2026-09-26 立)。

病理:ai-service 有三条并列执行内核(A 内联 tool loop `routers/llm.py` /
B `AgentLoopV2` / C `AgentEngine` Codex JSON-RPC 移植)。C 自带的 14 个
`BUILTIN_ENGINE_TOOLS` 由 `agent_engine` 构造成 ToolDefinition,经承载层
`routers/engine.py` 的 `_make_loop_factory` 并入同一个 AgentLoopV2 —— 所以 C 其实吃得到
注册表的 86 个工具,但它自带的 14 个内置名**不在注册表里**,于是同一个「能力」在两条链上
顶着不同名字,也就各自套上不同判定:

- 注册表侧 `run_command` / `file_edit` ∈ `_ADMIN_ONLY_TOOLS`(角色矩阵)
  且 ∈ `_DEFAULT_HIGH_RISK_TOOLS`(审批门);
- 引擎侧同能力的 `unified_exec`(起持久 shell)/ `run_code`(起 python 子进程)/
  `apply_patch`(写工作区文件)两个名单都不在。改前实测(可复现):
  `AgentLoopV2._is_high_risk_tool("unified_exec") is False` ⇒ **永不进审批门**。

即 #47 说的「同一句『我们有 XX 能力』在不同子系统里答案不同」,落在**授权轴**上。

本模块只回答一个问题:这个引擎内置名,在注册表里由哪个工具拥有同一能力?
高危与角色的判定本身仍归 `_DEFAULT_HIGH_RISK_TOOLS` / `_ADMIN_ONLY_TOOLS` 那一份真相 ——
这里不放第二份名单(放了两份就会漂移,与本仓「两处算同一件事必须共用一份实现」同一条禁令)。

形态约束:表必须是**纯字面量 dict**。守门
`scripts/check-tool-registry-integrity.mjs` 的 J8/J9/J10 与 Python 侧测试读同一张表;
改成 dataclass / 构造调用会让门的正则读空,而「读空」在门上表现为 0 处违规 = 假绿。
覆盖关系由门咬住:新增内置名而无桥条目即红;条目声明的等价物必须真在注册表里。
"""

from __future__ import annotations

# 引擎内置名 -> (注册表里拥有同一能力的工具名 | None, 无等价物时的理由 | None)
#
# 等价物一栏按 2026-09-26 实测填写:逐个在 `mcp_server._TOOL_HANDLERS` 的 86 个键里核对,
# 不是按名字相似度猜的。V3 文档初稿写的几处指向(apply_patch→patch_diff)里,
# `patch_diff` 是 HTTP 路由而非注册表工具,已按实测改回 file_edit。
ENGINE_TOOL_BRIDGE: dict[str, tuple[str | None, str | None]] = {
    "unified_exec": ("run_command", None),
    "run_code": ("run_command", None),
    # 引擎侧的 apply_patch 自带 v4a/unified 解析并真实落盘;主聊天链(A 内核)那边
    # apply_patch 是「委托专有」(仅带 workspace_context 时由前端执行)。同一个名字
    # 两种可达面,本行记的是「能力归口」,委托语义见 llm.py 的 _DELEGATE_ONLY_TOOLS。
    "apply_patch": ("file_edit", None),
    "view_image": ("vision_analyze", None),
    "spawn_subagent": ("dispatch_subagent", None),
    # 同名且注册表确有:今天由内置定义把注册表那条静默遮蔽(routers/engine.py 用
    # host_names 剔除同名注册表工具),声明出来是为了让「遮蔽」成为被审过的形态。
    "web_search": ("web_search", None),
    "update_plan": (
        None,
        "Codex plan tool 的协议对位件:写 thread.plan 并发 plan.update 事件;"
        "注册表无 plan 类工具(2026-09-26 关键字扫描零命中)",
    ),
    "request_permissions": (
        None,
        "JSON-RPC 审批往返(approval/request kind=permissions);注册表无同名能力。"
        "已知缺陷:它授予的 scope(sandbox_full_access / network / elevated_exec)在 app/ 内"
        "没有任何消费方,即「有仪式、无效力」—— 归 #47 后续票,本表不代裁",
    ),
    "request_user_input": (
        None,
        "elicitation 语义,等客户端应答且超时 fail-closed;注册表无 user_input / question 类工具",
    ),
    "request_user_input_async": (
        None,
        "同 request_user_input 但只发不等(立即回 accepted);注册表无对应能力",
    ),
    "send_message_to_user_async": (
        None,
        "单向 user_message_async 通知,回复靠 thread.enqueue;注册表无消息推送类工具",
    ),
    "new_context": (
        None,
        "仅置 loop._new_context_window_requested 标志位,由 AgentLoopV2 压缩分支消费;"
        "注册表无 context 重置类工具",
    ),
    "clock_sleep": (
        None,
        "纯 asyncio.sleep 并回 slept_ms;无外部副作用,注册表无对位件。"
        "已知缺陷:提前唤醒读的 loop.steer_wake_event 全仓无赋值方,故恒走普通 sleep",
    ),
    "clock_curr_time": (None, "datetime.now(utc) 格式化输出;无外部副作用,注册表无对位件"),
}


def capability_equivalent(engine_name: str) -> str | None:
    """该引擎内置名在注册表里的同一能力拥有者;未登记或登记为「仅引擎本地」时返回 None。"""
    entry = ENGINE_TOOL_BRIDGE.get(engine_name)
    return entry[0] if entry is not None else None


def uncovered(names: list[str] | tuple[str, ...] | frozenset[str]) -> list[str]:
    """给定一批引擎内置名,返回桥表没登记的(守门与测试用,顺序稳定)。"""
    return sorted(n for n in names if n not in ENGINE_TOOL_BRIDGE)


def dangling(names: list[str] | tuple[str, ...] | frozenset[str]) -> list[str]:
    """桥表登记了、但已不在给定名单里的条目 —— 即「清单腐烂」(登记比现实旧)。"""
    return sorted(n for n in ENGINE_TOOL_BRIDGE if n not in set(names))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
