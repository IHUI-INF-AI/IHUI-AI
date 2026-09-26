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

V3 #47 第二格(2026-09-26 收口)加了三件事,都是「映射」从注释变成可执行路径:
1. 每条第三个字段是**处置结论** `mode`(封闭集 `BRIDGE_MODES`):
   - `"port"` —— 引擎侧执行体**就是**注册表那一份(只剩协议适配:事件对、参数改名、结果裁剪);
   - `"map"`  —— 名字与授权归口到注册表能力,执行体因线程/会话耦合仍留在引擎侧
                  (持久 shell、code-mode 常驻会话、v4a patch 解析、引擎线程树派生 —— 移植会
                  掉能力,受 §7 删除安全约束,故如实登记而不是"顺手统一");
   - `"local"` —— 注册表确实没有该能力(纯引擎/协议专有,必须带理由)。
2. `resolve_engine_tool(name)` 是**唯一解析出口**:先看注册表本身,再经本表回查。
   三条内核的执行都经 `mcp_server.call_tool`,那里只认这一个解析入口 —— 于是
   「C 自带的名字在 A/B 里一个都调不到」这一格被填上:内置名到达主链路时落到
   注册表的同一能力上(且随后按解析出的正式名过角色矩阵),不再是「未知工具」。
3. 本表**不自带注册表名字清单**:"某个名字是否已注册"一律现读 `mcp_server._TOOL_HANDLERS`。
   抄一份清单就是第二份真相,而第二份真相在本仓的失效形态永远是"安静"。

V3 #47 末格(2026-09-27 收口「JSON-RPC 只留协议适配层」)加了**定义出口**:
1. `port_tool_definition(engine_name, *, parameters, executor)` 是 `port` 档内置工具的
   **唯一构造出口** —— name/description 现读唯一注册表(`mcp_server._TOOLS` 里那条
   MCPTool),引擎面不再手抄一份定义(此前 `_web_search_tool` 自带 description 与
   schema,而同名 `web_search` 在注册表里还有一份 —— 承载层合并时引擎面遮蔽注册表面,
   注册表那条成了死元数据,即"第二份真相")。
2. `parameters` 仍由引擎侧给出,这是**协议 wire 形状**(Codex JSON-RPC 面要求 camelCase
   与协议专有参数,如 maxResults/allowedDomains),属正当适配层,不是第二份能力真相;
   能力归口与授权判定仍只认本表的等价物。
3. 出口对非 port / 未登记 / 等价物已从注册表消失的名字一律 **RuntimeError**
   —— 定义出口不许被拿去给 map/local 洗白;守门 J15 静态判同一件事。

形态约束:表必须是**纯字面量 dict**。守门
`scripts/check-tool-registry-integrity.mjs` 的 J8/J9/J10/J12/J13/J14/J15 与 Python 侧测试读同一张表;
改成 dataclass / 构造调用会让门的正则读空,而「读空」在门上表现为 0 处违规 = 假绿。
覆盖关系由门咬住:新增内置名而无桥条目即红;条目声明的等价物必须真在注册表里;
`resolve_engine_tool` 被摘线(即"造好没装车")同样即红。
"""

from __future__ import annotations

from typing import Any, Callable, Final

# 处置结论的封闭集(不是工具名清单,所以不构成第二份真相)。
BRIDGE_MODES: Final[tuple[str, str, str]] = ("port", "map", "local")

# 引擎内置名 -> (注册表里拥有同一能力的工具名 | None, 无等价物时的理由 | None, 处置结论)
#
# 等价物一栏按 2026-09-26 实测填写:逐个在 `mcp_server._TOOL_HANDLERS` 的 86 个键里核对,
# 不是按名字相似度猜的。V3 文档初稿写的几处指向(apply_patch→patch_diff)里,
# `patch_diff` 是 HTTP 路由而非注册表工具,已按实测改回 file_edit。
# 第三格 mode 的取值依据同一次取证(读的是引擎侧执行体到底做了什么)。
ENGINE_TOOL_BRIDGE: dict[str, tuple[str | None, str | None, str]] = {
    # 引擎侧起**持久 shell**(同一 shell 跨调用保留 cwd/环境变量),注册表 run_command 是一次性
    # 执行;能力同源(任意命令执行)故归口授权,执行体保留 → map。
    "unified_exec": ("run_command", None, "map"),
    # 引擎侧是 code-mode 常驻 Python 会话(tools.call 桥回引擎工具、全局状态跨 cell 持久),
    # 移植到 run_command 会掉"会话持久"这一层 → map。
    "run_code": ("run_command", None, "map"),
    # 引擎侧自带 v4a/unified 解析并真实落盘;主聊天链(A 内核)那边 apply_patch 是「委托专有」
    # (仅带 workspace_context 时由前端执行)。同一个名字两种可达面,本行记的是「能力归口」,
    # 委托语义见 llm.py 的 _DELEGATE_ONLY_TOOLS。
    "apply_patch": ("file_edit", None, "map"),
    # 引擎侧读工作区内图片并做越界拦截;注册表 vision_analyze 同样支持本地路径 + 白名单,
    # 且多出"交给视觉模型分析"一层 → 能力同源,执行体保留 → map。
    "view_image": ("vision_analyze", None, "map"),
    # 引擎侧派生的是**引擎线程**(带 depth 上限、角色模板、Subagent 钩子、线程树回收),
    # 注册表 dispatch_subagent 派生的是 orchestrator 子代理;两者是同一能力的两个宿主 → map。
    "spawn_subagent": ("dispatch_subagent", None, "map"),
    # 唯一的 port:引擎侧执行体直接 `from .mcp_server import _tool_web_search` 调注册表那一份,
    # 自己只保留 WebSearchBegin/End 事件对与域名白名单过滤(协议适配)。
    "web_search": ("web_search", None, "port"),
    "update_plan": (
        None,
        "Codex plan tool 的协议对位件:写 thread.plan 并发 plan.update 事件;"
        "注册表无 plan 类工具(2026-09-26 关键字扫描零命中)",
        "local",
    ),
    "request_permissions": (
        None,
        "JSON-RPC 审批往返(approval/request kind=permissions);注册表无同名能力。"
        "已知缺陷:它授予的 scope(sandbox_full_access / network / elevated_exec)在 app/ 内"
        "没有任何消费方,即「有仪式、无效力」—— 归 #47 后续票,本表不代裁",
        "local",
    ),
    "request_user_input": (
        None,
        "elicitation 语义,等客户端应答且超时 fail-closed;注册表无 user_input / question 类工具",
        "local",
    ),
    "request_user_input_async": (
        None,
        "同 request_user_input 但只发不等(立即回 accepted);注册表无对应能力",
        "local",
    ),
    "send_message_to_user_async": (
        None,
        "单向 user_message_async 通知,回复靠 thread.enqueue;注册表无消息推送类工具",
        "local",
    ),
    "new_context": (
        None,
        "仅置 loop._new_context_window_requested 标志位,由 AgentLoopV2 压缩分支消费;"
        "注册表无 context 重置类工具",
        "local",
    ),
    "clock_sleep": (
        None,
        "纯 asyncio.sleep 并回 slept_ms;无外部副作用,注册表无对位件。"
        "已知缺陷:提前唤醒读的 loop.steer_wake_event 全仓无赋值方,故恒走普通 sleep",
        "local",
    ),
    "clock_curr_time": (
        None,
        "datetime.now(utc) 格式化输出;无外部副作用,注册表无对位件",
        "local",
    ),
}


def capability_equivalent(engine_name: str) -> str | None:
    """该引擎内置名在注册表里的同一能力拥有者;未登记或登记为「仅引擎本地」时返回 None。"""
    entry = ENGINE_TOOL_BRIDGE.get(engine_name)
    return entry[0] if entry is not None else None


def execution_mode(engine_name: str) -> str | None:
    """该内置名的处置结论(port/map/local);未登记返回 None(门会把它读成缺条目)。"""
    entry = ENGINE_TOOL_BRIDGE.get(engine_name)
    return entry[2] if entry is not None else None


def registry_definition(name: str) -> Any | None:
    """现读唯一注册表(`mcp_server._TOOLS`)里该名字的 MCPTool;没有则 None。

    返回类型标注 Any 是诚实写法:MCPTool 住在 mcp_server,模块级 import 会撞
    循环导入(mcp_server 导入期即触达服务层),与 `_registered_tool_names` 同一
    懒加载形态。**不**在本模块抄一份工具定义 —— 那正是本票要消除的第二份真相。
    """
    from .mcp_server import _TOOLS

    for tool in _TOOLS:
        if getattr(tool, "name", None) == name:
            return tool
    return None


def port_tool_definition(
    engine_name: str,
    *,
    parameters: dict[str, Any],
    executor: Callable[[dict[str, Any]], Any],
) -> Any:
    """`port` 档内置工具定义的**唯一构造出口**(V3 #47 末格)。

    name/description 一律现读唯一注册表 —— 引擎面只提供协议 wire 形状
    (`parameters`,camelCase 与协议专有参数属适配层)与执行适配器(`executor`,
    其本体必须是注册表实现,由守门 J14/J15 与 `test_port_disposition_is_not_a_lie`
    双向咬住)。任何"注册表没有对应条目"或"处置不是 port"的调用一律
    RuntimeError(fail-fast)—— 出口被拿去给 map/local 洗白,比没有出口更糟。
    """
    entry = ENGINE_TOOL_BRIDGE.get(engine_name)
    if entry is None:
        raise RuntimeError(
            f"'{engine_name}' 不在 ENGINE_TOOL_BRIDGE —— 定义出口只服务处置在案的内置名"
        )
    if entry[2] != "port":
        raise RuntimeError(
            f"'{engine_name}' 处置为 '{entry[2]}',不是 'port' —— "
            "只有'执行体就是注册表那一份'的名字才允许从注册表取定义"
        )
    equivalent = entry[0]
    registry_tool = registry_definition(str(equivalent)) if equivalent is not None else None
    if registry_tool is None:
        raise RuntimeError(
            f"port '{engine_name}' 的等价物 '{equivalent}' 在 mcp_server._TOOLS 里读不到 "
            "—— 定义无所从,宁可构造失败也不发一份悬空定义"
        )
    from .agent_loop_v2 import ToolDefinition

    return ToolDefinition(
        name=engine_name,
        description=str(registry_tool.description),
        parameters=parameters,
        executor=executor,
    )


def _registered_tool_names() -> set[str]:
    """现读注册表 —— 本模块**不得**自带一份已注册工具清单(那正是本票要消除的第二份真相)。

    懒加载 import 与 `agent_loop_v2._admin_only_name` 同形态(避免模块级循环导入:
    mcp_server 在导入期就用到若干 service,而本模块被 agent_loop_v2 模块级引用)。
    """
    from .mcp_server import _TOOL_HANDLERS

    return set(_TOOL_HANDLERS)


def resolve_engine_tool(
    name: str,
    *,
    registered: set[str] | frozenset[str] | None = None,
) -> str | None:
    """把任意内核送来的工具名解析成**注册表里的正式名**;解析不到返回 None。

    解析次序(先查主注册表,再落引擎本地能力归口)是 #47 方案定的,不是审美:
      1. `name` 本身已注册 → 原样返回(注册表永远优先,内置名不得遮蔽已注册工具);
      2. 否则经本表回查同一能力的拥有者,且该拥有者**确实注册在案**才返回 ——
         登记表写了一个注册表里没有的名字,宁可解析不到(交回引擎本地执行),
         也不要把它当成"已归一"而静默往下走;
      3. 否则返回 None(确属引擎专有,由内核自己那份实现执行)。

    `registered` 参数只是给单测/纯函数取证用的注入通道;生产面一律现读注册表。
    """
    known = _registered_tool_names() if registered is None else set(registered)
    if name in known:
        return name
    equivalent = capability_equivalent(name)
    if equivalent is not None and equivalent in known:
        return equivalent
    return None


def uncovered(names: list[str] | tuple[str, ...] | frozenset[str]) -> list[str]:
    """给定一批引擎内置名,返回桥表没登记的(守门与测试用,顺序稳定)。"""
    return sorted(n for n in names if n not in ENGINE_TOOL_BRIDGE)


def dangling(names: list[str] | tuple[str, ...] | frozenset[str]) -> list[str]:
    """桥表登记了、但已不在给定名单里的条目 —— 即「清单腐烂」(登记比现实旧)。"""
    return sorted(n for n in ENGINE_TOOL_BRIDGE if n not in set(names))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
