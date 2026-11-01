# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具面能力门:按产品形态/能力台账收口 MCP 工具面(缺口表 #7)。

背景(2026-11-01 立,逆向-复现-超越铁律 §0.12):
    取证册 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T12-mtree-and-hook-host.md`
    §3 B1 观察到对侧钩子宿主内置**产品能力表 + `CAPABILITY_DISABLED`** 一型:按
    `QODER_SEARCH_PRODUCT_FORM` 一类 env 决定 `products.<形态>{searchWorkspace, turnRelay,
    remoteCodeIndexing, …}` 哪些为真,不具备的能力在**入口就地具名拒绝**,而不是伪装成
    "未知方法"。本仓此前没有这一格:工具清单对任何调用方一律全铺,而"该形态到底能不能
    用这族工具"既没有声明面、也没有执行面的具名回执。

    复现的是**行为与设计**(声明表 + 双投影 + 具名拒绝),不复刻对方字节;超越点见下方
    「本实现与对照的三处不同」。

设计(挂在既有能力台账旁边,不另立第二份能力清单,§0.6):
    - 能力键的**定义与取数**单源 = `app/core/capability_matrix.py`
      (`CAPABILITY_MATRIX` 静态登记 + `current_for_entry()` 每次现读,绝不缓存);
    - 本模块只加两样东西:①「工具 → 所需能力键」声明表;②产品形态对能力键的覆盖表;
    - **列表面(`filter_visible_tools`)与执行面(`capability_denial`/`guarded_dispatch`)
      必须走同一个 `capability_state()`** —— 一处读台账、一处读 env 的分裂正是本票要消灭的
      失效型(测试 ⑤ 钉这一条)。

默认档零扰动(可断言,不是口头保证):
    声明表里所有能力键的台账 default 都是"开"(`true`/`on`)或取值默认 `server`,
    且 `PRODUCT_FORM_CAPABILITY_OVERRIDES[DEFAULT_PRODUCT_FORM]` 为空 ⇒ 未设任何 env 时
    `filter_visible_tools(_TOOLS)` 与 `_TOOLS` 逐字同序同集(测试 ①)。

失效方向(§0.3/§0.10):
    - 能力键不在台账 / current 取回非布尔形态(如 `(未判定…)`、`(未设置=legacy)`)⇒ 判
      `unjudged`,**不隐藏、不拒绝**,只在日志点名;列表面绝不把"没判"写成"判过";
    - 产品形态取值不在 `PRODUCT_FORM_CAPABILITY_OVERRIDES` 键集 ⇒ 该轴整体不生效
      (宁多给一次可见,不静默少给能力);
    - 被隐藏的工具被直接调用 ⇒ **具名拒绝** `CAPABILITY_DISABLED`(给原因 + 缺哪个键 +
      下一步),绝不回落成"未知工具"(姿势对齐 `mcp_server` 的 `write_file`
      `CONCURRENT_MODIFICATION` 拒答:给原因、给出路)。

本实现与对照的三处不同(超越轴):
    1. 能力键不是烘死在宿主里的第二张表,而是复用本仓能力台账 ⇒ 与
       `GET /api/admin/capabilities` / 启动日志 / 对账门 `check-capability-matrix` 同源;
    2. 双投影(列表面 + 执行面)由同一把尺导出,且"判不出 ⇒ 不隐藏"可被测试钉住
       (对照字节里只观察到 `CAPABILITY_DISABLED` 与 `allow`,余档未找到,见取证册 B2);
    3. 纯函数、零 IO ⇒ 无需起进程即可逐档断言(测试文件即证据)。
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Iterable, Sequence
from typing import Final, Literal, Protocol

from app.core.capability_matrix import CAPABILITY_MATRIX, current_for_entry

logger = logging.getLogger(__name__)

__all__ = [
    "CAPABILITY_DISABLED",
    "TOOL_CAPABILITY_REQUIREMENTS",
    "TOOL_FAMILY_CAPABILITY_REQUIREMENTS",
    "PRODUCT_FORM_CAPABILITY_OVERRIDES",
    "capability_state",
    "resolve_product_form",
    "required_capabilities_of",
    "is_tool_hidden",
    "filter_visible_tools",
    "capability_denial",
    "guarded_dispatch",
]

# 具名拒绝码:与对照观察到的字面量同名(契约名,不是对方实现字节)。
CAPABILITY_DISABLED: Final[str] = "CAPABILITY_DISABLED"

CapabilityState = Literal["enabled", "disabled", "unjudged"]

# ---------------------------------------------------------------------------
# 声明面:能力键名 + 其 env 名
# ---------------------------------------------------------------------------
# env 字面量必须在本模块出现:对账门 check-capability-matrix 的 J1「幽灵条目」以
# "app/ 源码里有该大写键字符串字面量"为存续证据(读取动作本身发生在台账
# current_for_entry,本模块不重复读 os.environ —— 那是第二把尺)。
COMPUTER_AUTOMATION_ENV = "MCP_COMPUTER_TOOLS_ENABLED"
PRODUCT_FORM_ENV = "MCP_TOOL_SURFACE_PRODUCT_FORM"

COMPUTER_AUTOMATION_CAPABILITY_KEY = "computer_automation"
PAGE_CONTROL_CAPABILITY_KEY = "page_control_tools"
WEB_UI_CAPABILITY_KEY = "ui_action_tools"
APP_UI_CAPABILITY_KEY = "app_ui_tools"
PRODUCT_FORM_CAPABILITY_KEY = "mcp_tool_surface_product_form"

#: 默认产品形态。与台账里 `mcp_tool_surface_product_form` 行的 default 逐字相同;
#: 该形态在覆盖表中**不摘任何能力** ⇒ 未设 env 即零扰动。
DEFAULT_PRODUCT_FORM = "server"

# 逐工具声明(精确名;与下面的族前缀表**并集**生效)。本票按取证观察只登记了能逐字
# 对上桥接件自述前缀的族,精确名一栏留给"某枚工具的能力要求和它所在族不同"那一型
# (例:某工具单独需要 `computer_automation` 之外的第二枚能力)。空表是**现状**不是缺省:
# 往里加键必须先让该键在能力台账在册,否则测试 ④ 当场红。
TOOL_CAPABILITY_REQUIREMENTS: dict[str, tuple[str, ...]] = {}

# 族前缀声明:动态注册族(page_control_bridge / ui_action_bridge 经
# register_external_tool 注入的工具)不写死枚数,按族前缀收 —— 前缀即两族桥接件
# 自述的撤销前缀(_FAMILY_PREFIX / _FAMILIES 的 prefix),漂移会被测试①④当场点名。
TOOL_FAMILY_CAPABILITY_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "computer_": (COMPUTER_AUTOMATION_CAPABILITY_KEY,),
    "browser_page_": (PAGE_CONTROL_CAPABILITY_KEY,),
    "web_ui_": (WEB_UI_CAPABILITY_KEY,),
    "mobile_ui_": (APP_UI_CAPABILITY_KEY,),
    "taro_ui_": (APP_UI_CAPABILITY_KEY,),
}

# 产品形态能力覆盖表(对照那侧的 `products.<form>{…}` 在本仓的形态):
# 值 False = 该形态结构性不具备该能力 ⇒ 列表面隐藏 + 执行面具名拒绝;
# 值 True  = 显式具备(用于覆盖台账默认关的键,本票未使用);
# 未列出的形态 ⇒ 该轴不生效(见模块头注「失效方向」)。
PRODUCT_FORM_CAPABILITY_OVERRIDES: dict[str, dict[str, bool]] = {
    # 服务端/全功能宿主(web、api 侧对话链):什么都不摘。
    DEFAULT_PRODUCT_FORM: {},
    # 桌面宿主:保留桌面自动化与页面句柄族,不给 web/RN/小程序 UI 桥接(无对应前端桥)。
    "desktop": {WEB_UI_CAPABILITY_KEY: False, APP_UI_CAPABILITY_KEY: False},
    # Web 宿主:没有桌面 OS 自动化通道(computer_* 在浏览器里结构上无法执行)。
    "web": {COMPUTER_AUTOMATION_CAPABILITY_KEY: False},
    # 小程序宿主:没有桌面自动化,也没有 web_ui_ 桥。
    "miniapp": {
        COMPUTER_AUTOMATION_CAPABILITY_KEY: False,
        WEB_UI_CAPABILITY_KEY: False,
    },
    # CLI/无头宿主:三族桥接件都没有落点。
    "cli": {
        COMPUTER_AUTOMATION_CAPABILITY_KEY: False,
        WEB_UI_CAPABILITY_KEY: False,
        APP_UI_CAPABILITY_KEY: False,
        PAGE_CONTROL_CAPABILITY_KEY: False,
    },
}

_TRUTHY = frozenset({"1", "true", "t", "on", "yes", "y"})
_FALSY = frozenset({"0", "false", "f", "off", "no", "n"})


class NamedTool(Protocol):
    """列表面过滤只读 `.name` —— 不依赖 MCPTool 的其余字段,便于夹具与反向对照。"""

    name: str


def matrix_entry_of(key: str) -> dict[str, str] | None:
    """按能力键取台账条目(单源;查不到返回 None,由调用方落 `unjudged`)。"""
    for entry in CAPABILITY_MATRIX:
        if entry.get("key") == key:
            return entry
    return None


def _state_from_value(value: str) -> CapabilityState:
    """把台账 current 字符串折成三态;非布尔形态一律 `unjudged`(不猜、不隐藏)。"""
    text = str(value).strip().lower()
    if text in _TRUTHY:
        return "enabled"
    if text in _FALSY:
        return "disabled"
    return "unjudged"


def resolve_product_form() -> tuple[str, bool]:
    """现读产品形态。返回 (形态值, 该形态是否在本模块覆盖表里被声明)。

    取数走台账 ⇒ 与列表面/执行面同一条通道;取不到(台账行缺失/未判定串)时回落
    `DEFAULT_PRODUCT_FORM` 并报 `judged=False`(§0.3:没判绝不写成判过)。
    """
    entry = matrix_entry_of(PRODUCT_FORM_CAPABILITY_KEY)
    if entry is None:
        return DEFAULT_PRODUCT_FORM, False
    raw = current_for_entry(entry)
    form = str(raw).strip().lower()
    if not form or form.startswith("(未"):
        return DEFAULT_PRODUCT_FORM, False
    return form, form in PRODUCT_FORM_CAPABILITY_OVERRIDES


def capability_state(
    key: str, *, product_form: tuple[str, bool] | None = None
) -> CapabilityState:
    """能力键当前状态 —— 列表面与执行面共用的**唯一**一把尺。

    判序(固定,便于逐档断言):
      1. 产品形态覆盖表显式声明了该键 ⇒ 以覆盖为准(这是"该形态结构性不具备"那一型);
      2. 否则读能力台账 `current_for_entry()`(每次现读,monkeypatch/热调 env 跟得住);
      3. 键不在台账 / 取值非布尔形态 ⇒ `unjudged`。
    """
    form, form_declared = product_form if product_form is not None else resolve_product_form()
    if form_declared:
        overrides = PRODUCT_FORM_CAPABILITY_OVERRIDES.get(form, {})
        if key in overrides:
            return "enabled" if overrides[key] else "disabled"
    entry = matrix_entry_of(key)
    if entry is None:
        return "unjudged"
    return _state_from_value(current_for_entry(entry))


def required_capabilities_of(tool_name: str) -> tuple[str, ...]:
    """该工具声明的能力键:精确名 ∪ 所有命中的族前缀(去重、保序)。"""
    keys: list[str] = []
    exact = TOOL_CAPABILITY_REQUIREMENTS.get(tool_name)
    if exact:
        keys.extend(exact)
    for prefix, prefix_keys in TOOL_FAMILY_CAPABILITY_REQUIREMENTS.items():
        if tool_name.startswith(prefix):
            keys.extend(prefix_keys)
    return tuple(dict.fromkeys(keys))


def disabled_capability_of(tool_name: str) -> str | None:
    """该工具当前被摘掉的第一枚能力键;无则 None(含 unjudged ⇒ 不算摘掉)。"""
    ctx = resolve_product_form()
    for key in required_capabilities_of(tool_name):
        if capability_state(key, product_form=ctx) == "disabled":
            return key
    return None


def is_tool_hidden(tool_name: str) -> bool:
    """列表面判据:只有**显式**关才算隐藏。"""
    return disabled_capability_of(tool_name) is not None


def filter_visible_tools[T: NamedTool](tools: Sequence[T]) -> list[T]:
    """列表面出口:保留声明齐备/未声明的工具,摘掉显式关的那族;原序、不原地改。"""
    hidden: list[str] = []
    visible: list[T] = []
    for tool in tools:
        if is_tool_hidden(tool.name):
            hidden.append(tool.name)
            continue
        visible.append(tool)
    if hidden:
        logger.info(
            "[tool_surface] 列表面按能力门隐藏 %d 枚工具: %s",
            len(hidden),
            ", ".join(sorted(hidden)),
        )
    return visible


def visible_tool_names(tools: Iterable[NamedTool]) -> list[str]:
    """可见工具名清单(测试①的对照出口;入参由调用方给,本模块不 import mcp_server)。"""
    return [tool.name for tool in filter_visible_tools(list(tools))]


def capability_denial(tool_name: str) -> dict[str, object] | None:
    """执行面具名回执:该工具被能力门摘掉时返回拒绝体,否则 None(交回原执行链)。

    拒绝体必须说清三件事:为什么(哪个形态/哪枚键)、不是什么(不是未知工具)、
    下一步(显式开启的 env 名)。与 `write_file` 的 `CONCURRENT_MODIFICATION` 同姿势。
    """
    key = disabled_capability_of(tool_name)
    if key is None:
        return None
    entry = matrix_entry_of(key)
    env = (entry or {}).get("env", "(台账缺该行)")
    form, form_declared = resolve_product_form()
    by_form = form_declared and key in PRODUCT_FORM_CAPABILITY_OVERRIDES.get(form, {})
    reason = (
        f"产品形态 {form} 不具备能力 '{key}'"
        if by_form
        else f"能力 '{key}' 当前为关(台账 env {env})"
    )
    return {
        "tool": tool_name,
        "ok": False,
        "errorCode": CAPABILITY_DISABLED,
        "error": (
            f"工具 '{tool_name}' 被能力门具名拒绝:{reason},该工具已从列表面隐藏。"
            "这不是未知工具 —— 处理函数仍在注册表里,只是本次调用方形态无权使用。"
            f"下一步:确认调用方所在产品形态是否正确;确需该能力时,部署侧把 {env} "
            "显式设为 1/true/on 并重启服务(或由对应形态的宿主发起调用)。"
        ),
        "missingCapability": key,
        "capabilityState": "disabled",
        "productForm": form,
        "productFormDeclared": form_declared,
    }


async def guarded_dispatch(
    tool_name: str,
    arguments: dict[str, object],
    handler: Callable[[dict[str, object]], Awaitable[dict[str, object]]],
) -> dict[str, object]:
    """执行面包装器:能力门关 ⇒ 直接返回拒绝体,**绝不调用 handler**(零副作用)。

    `mcp_server.call_tool` 既可内联 `capability_denial()`(见接线清单),也可用本出口;
    两条路读的同一把尺 ⇒ 测试③/⑤ 在此钉住。
    """
    denial = capability_denial(tool_name)
    if denial is not None:
        return denial
    return await handler(arguments)


# 供测试直接取用(§22c:判据只有一份,测试 import 源模块而不是复制)。
__test__ = {
    "capability_state": capability_state,
    "matrix_entry_of": matrix_entry_of,
    "required_capabilities_of": required_capabilities_of,
    "disabled_capability_of": disabled_capability_of,
    "filter_visible_tools": filter_visible_tools,
    "capability_denial": capability_denial,
    "resolve_product_form": resolve_product_form,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
