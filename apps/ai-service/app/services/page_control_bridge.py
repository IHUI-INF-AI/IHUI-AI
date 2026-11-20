# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""页面语义快照句柄族工具面(2026-09-25 立,用户授权"开放为对外产品能力")。

这一族动词(`page_snapshot` / `page_click` / …)的本体在 `@ihui/dom-actions`:页内采集、
句柄 `el:<scope8>:<serial36>`、两本账预算、12 个结构化错误码、`sideEffect: none|uncertain`。
此前它只有两个执行体 —— CLI 自有 CDP 会话(`apps/cli/src/tools/browser-page.ts`)与扩展
content script(`apps/extension/entrypoints/content.ts` 的 `agent.action.dom` 通道);
模型侧**没有任何入口**能声明它,扩展虽然申报了能力(`browserPageActions`),ai-service 也不
读取那个计数 —— 于是"能申报"始终不等于"已开放"。本模块把这句话补上。

三条前置实测结论(为什么只能做成"模型声明 + 端侧执行",而不是 ai-service 自己执行):
① 本服务没有 DOM。`agent_engine` 的 ToolDefinition 与 `mcp_server._TOOLS` 都只描述
   "服务端能自己跑完的函数";页面动作的执行体在用户浏览器里。把 page_* 写成本地实现的
   工具 = 对模型谎报能力(它只会拿到一份永远为真的假回执),比不登记更糟。
② 既有通道够用且是唯一不谎报的形态:`POST /api/agent-control/execute`(category='browser'
   → 择端表指向 endpoint='extension')→ 端执行 → `POST /result` → api 用 pending Map 同步
   回给本工具。这条链 `ui_action_bridge._ui_call` 已经实现完整(身份剥离、内部密钥
   fail-closed、超时、按 (user, category) 钉定实例)—— 本模块**复用它**,不另造第二份。
   钉定对这一族尤其关键:句柄的 scope 是"这一份文档安装"的私事,不钉回同一页面,
   紧随 page_snapshot 之后的 page_click 必然 `HANDLE_SCOPE_MISMATCH`。
③ 权限门控不挂在 `control_autonomy._FAMILY_ACTIONS`(那里只有四族**应用内** UI,判据是
   "端在线即整族注入")。页面动词读的是用户正在浏览的**任意站点**,与本族的姊妹族
   `browser_*`(选择器形态)一样必须走"客户端显式携带工具名"这一侧的显式授权;服务端这里
   只做**反向**收紧 —— 端没申报这一族时把名字摘掉(见
   `control_autonomy.filter_unauthorized_page_tools`,fail-closed)。

只开放功能、不开放数据(项目既有口径):
- 本族的工具名刻意**不进** `/v1` 机器凭据面:v1 网关构造上游请求体时不带 `agent_tools`
  (见 `apps/api/src/routes/v1-messages.ts` 的 openaiBody 白名单),而
  `/api/agent-control/execute` 不在 `open-capability-registry` 的路径清单里 ⇒ 机器凭据既
  请求不到这一族,也直接打不开执行通道。回归断言见
  `apps/ai-service/tests/test_page_control_bridge.py`。
- 能力查询 `GET /api/agent-control/status` 只回**动作计数**(不含任何页面内容),本模块的
  授权判定因此不可能顺手把页面正文带出对外面。
- 快照预算参数(句柄配额 / 正文字符上限)**刻意不在 schema 里 advertise**:扩展那条
  `executeDomAction(action, params, timeout)` 通道不把 params 当预算喂给
  `runPageAction`,端上恒走 `DEFAULT_PAGE_SNAPSHOT_BUDGET`(80 行 / 正文 4000 字)。
  把一个被静默忽略的参数交给模型,和谎报能力是同一种错。要开放调预算,得先让
  dom-actions 那条支路真的接收 params 里的预算字段,那是另一张票。

env:
- PAGE_CONTROL_TOOLS:是否注册本族(默认 true;'false'/'0'/'no'/'off' 关闭并撤销已注册的)
"""

from __future__ import annotations

import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

from .mcp_server import MCPTool, register_external_tool, unregister_external_tool_by_prefix
from .ui_action_bridge import _ui_call

logger = logging.getLogger(__name__)

# category='browser' 在 apps/api 的 CATEGORY_ENDPOINT 表里映射到 endpoint='extension'。
# 与选择器族 `browser_*` 同 category(同一执行端)、不同动词族:两族错误码与定位方式不同形
# (见 packages/types/src/agent-control.ts 的 BrowserPageControlActionType 注释)。
_CATEGORY = "browser"

# 工具名 = `_TOOL_NAME_PREFIX` + 契约动词。动词本身已带 `page_` 前缀(`page_snapshot`…),
# 所以名字前缀只补 `browser_` —— 得到的 `browser_page_snapshot` 与 CLI 侧
# (`apps/cli/src/tools/browser-page.ts`)逐字同形,跨端一个名字,不产生第二套叫法。
# `_ui_call` 的 tool 标签也用这个前缀(f"{prefix}{action}"),两侧算出的名字同源。
_TOOL_NAME_PREFIX = "browser_"

# 撤销/统计这一族时用的**族名前缀**。不能拿 _TOOL_NAME_PREFIX('browser_')去 unregister ——
# 那会把同 category 的 12 个选择器族工具一起摘掉。
_FAMILY_PREFIX = "browser_page_"

# 唯一真相源是 @ihui/dom-actions 的 PAGE_ACTIONS;这份 Python 字面量是跨语言的必要复制
# (与本仓 _FAMILY_ACTIONS / _APP_ACTIONS 同一范式),由
# tests/test_page_control_bridge.py 逐字比对 contract.ts 防漂移 —— 改名即红,不留静默。
PAGE_CONTROL_VERBS: tuple[str, ...] = (
    "page_snapshot",
    "page_click",
    "page_type",
    "page_select",
    "page_hover",
    "page_press_key",
    "page_pick_at_point",
    # 2026-11-12 契约加了这三枚动词(CLI 侧 browser_page_scroll/wait_for/drag 同日实现),
    # Python 侧漏跟 ⇒ 新动词进不了模型工具面(静默少能),由 test_page_control_bridge 钉住。
    "page_scroll",
    "page_wait_for",
    "page_drag",
)

_HANDLE_DESC = (
    "目标句柄,取 browser_page_snapshot 返回的 rows[].handle(形如 el:<scope8>:<serial36>)。"
    "它是**页内活引用**,不是 CSS 选择器:页面一导航 scope 就变,整批旧句柄即刻作废,端上如实回 "
    "HANDLE_SCOPE_MISMATCH —— 那时唯一正确的动作是重拍快照,不是换个写法重试。"
)

_RETRY_RULE = (
    "每次回执都带 dispatched 与 sideEffect:none=没派发任何输入事件,可安全重试;"
    "uncertain=事件已派发、之后页面发了什么不受观测保证(可能已提交表单),**严禁盲目重试**。"
)

# 只读族的副作用说明:scroll/wait 结构上不触碰 DOM,与 PAGE_READONLY_ACTIONS 同一判定。
_side_effect_none = "本动词属只读族:sideEffect 恒为 none(未派发任何输入事件),可安全重试。"


def _page_tools() -> list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]]:
    """句柄族工具定义 + handler(描述里必须把"执行体在端侧"说清,否则模型以为本地能跑)。"""
    str_prop = {"type": "string"}
    specs: list[tuple[str, str, dict[str, Any]]] = [
        (
            "page_snapshot",
            "[页面快照|用户浏览器执行] 采集用户当前所在页面的可交互元素(带活句柄)与正文语义块。"
            "返回 rows[](handle/role/name/text/value/attrs/rect/inViewport/frame)+ body[](text/heading)"
            "+ counts(interactiveFound 与 rowsEmitted 的差=还有多少没交出来)+ notices。"
            "预算走端侧默认档(80 行 / 正文 4000 字)。任何 page_* 动作之前都要先拍一次,"
            "动作之后要重新拍才认新出现的元素。执行体是用户浏览器里的扩展,本服务没有 DOM。",
            {"type": "object", "properties": {}},
        ),
        (
            "page_click",
            "[页面快照|用户浏览器执行] 按活句柄点击页面上的元素。" + _HANDLE_DESC + _RETRY_RULE,
            {
                "type": "object",
                "properties": {"handle": {**str_prop, "description": _HANDLE_DESC}},
                "required": ["handle"],
            },
        ),
        (
            "page_type",
            "[页面快照|用户浏览器执行] 往活句柄指向的输入控件填文本(派发真实输入事件)。"
            + _HANDLE_DESC
            + "clear=true 先全选删除;submit=true 填完按回车。非可输入控件回 TARGET_NOT_EDITABLE。"
            + _RETRY_RULE,
            {
                "type": "object",
                "properties": {
                    "handle": {**str_prop, "description": _HANDLE_DESC},
                    "text": {"type": "string", "description": "要填入的文本"},
                    "clear": {"type": "boolean", "description": "填写前是否清空原值"},
                    "submit": {"type": "boolean", "description": "填完是否按回车提交"},
                },
                "required": ["handle", "text"],
            },
        ),
        (
            "page_select",
            "[页面快照|用户浏览器执行] 选择 <select> 下拉项。"
            + _HANDLE_DESC
            + "value 传选项文本或 value;目标不是 <select> 回 TARGET_NOT_SELECTABLE。" + _RETRY_RULE,
            {
                "type": "object",
                "properties": {
                    "handle": {**str_prop, "description": _HANDLE_DESC},
                    "value": {
                        "type": "string",
                        "description": "选项可见文本或 option 的 value",
                    },
                },
                "required": ["handle", "value"],
            },
        ),
        (
            "page_hover",
            "[页面快照|用户浏览器执行] 悬停到活句柄元素上(触发 tooltip/下拉)。"
            + _HANDLE_DESC
            + "元素在文档内但拿不到有效矩形(折叠容器里/零尺寸)回 HANDLE_NOT_RENDERED。" + _RETRY_RULE,
            {
                "type": "object",
                "properties": {"handle": {**str_prop, "description": _HANDLE_DESC}},
                "required": ["handle"],
            },
        ),
        (
            "page_press_key",
            "[页面快照|用户浏览器执行] 对活句柄按一个键(Enter/Escape/Tab/方向键等)。"
            + _HANDLE_DESC
            + _RETRY_RULE,
            {
                "type": "object",
                "properties": {
                    "handle": {**str_prop, "description": _HANDLE_DESC},
                    "key": {"type": "string", "description": "键名,如 Enter / Escape / Tab"},
                },
                "required": ["handle", "key"],
            },
        ),
        (
            "page_pick_at_point",
            "[页面快照|只读] 按视口坐标返回那一点上的元素行(拿它的 handle 再动作)。"
            "用于快照没交出某行、但用户在屏幕上看得见它的情形。坐标在视口外回 COORD_OUT_OF_BOUNDS,"
            "该点没有可交互元素回 NO_ELEMENT_AT_POINT;两者 sideEffect 恒为 none。",
            {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "视口 x 坐标"},
                    "y": {"type": "number", "description": "视口 y 坐标"},
                },
                "required": ["x", "y"],
            },
        ),
        (
            "page_scroll",
            "[页面快照|只读] 滚动整页或某个可滚动元素,把视口外的内容带进来。"
            "比为了看见某块内容就去点它更便宜,也不派发任何输入事件。"
            "direction 取 up/down/left/right(默认 down),amount 为像素(默认 600),"
            "给 handle 就滚该元素、不给就滚整页;direction 非法回 PARAM_INVALID,"
            f"句柄失效回 HANDLE_STALE。{_side_effect_none}",
            {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "description": "up | down | left | right(默认 down)",
                    },
                    "amount": {"type": "number", "description": "滚动像素(默认 600)"},
                    "handle": {
                        **str_prop,
                        "description": "可选:滚这个元素而不是整页。" + _HANDLE_DESC,
                    },
                },
            },
        ),
        (
            "page_wait_for",
            "[页面快照|只读] 等到条件成立或超时,用来替代盲目 sleep。"
            "SPA 渲染意味着刚拿到的句柄可能指向尚未挂载的元素。"
            "text=等到这段文字出现,textGone=等到它消失,handle=等到它解析成活元素;"
            "三者至少给一个,都不给回 PARAM_INVALID;超时回 TIMEOUT。"
            f"timeoutMs 默认 5000、上限 30000。{_side_effect_none}",
            {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "等到这段文字出现"},
                    "textGone": {"type": "string", "description": "等到这段文字消失"},
                    "handle": {
                        **str_prop,
                        "description": "等到该句柄解析成活元素。" + _HANDLE_DESC,
                    },
                    "timeoutMs": {
                        "type": "number",
                        "description": "最长等待毫秒(默认 5000,上限 30000)",
                    },
                },
            },
        ),
        (
            "page_drag",
            "[页面快照|用户浏览器执行] 从一个句柄拖到另一个句柄,走真实的按下-移动-释放序列。"
            "两次点击替代不了它:拖拽库(dnd-kit / react-beautiful-dnd)依赖中间的 dragover 事件。"
            + _HANDLE_DESC
            + " from/to 任一缺失回 PARAM_INVALID,任一失效回 HANDLE_STALE。"
            + _RETRY_RULE,
            {
                "type": "object",
                "properties": {
                    "from": {**str_prop, "description": "源句柄"},
                    "to": {**str_prop, "description": "目标句柄"},
                },
                "required": ["from", "to"],
            },
        ),
    ]

    out: list[tuple[MCPTool, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]]] = []
    for verb, description, input_schema in specs:
        out.append(
            (
                MCPTool(
                    name=f"{_TOOL_NAME_PREFIX}{verb}",
                    description=description,
                    input_schema=input_schema,
                ),
                _make_page_handler(verb),
            )
        )
    return out


def _make_page_handler(
    action: str,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """绑定动词的 handler:整条执行都在用户浏览器里,本进程只转发与归一化回执。"""

    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        return await _ui_call(action, args, _CATEGORY, _TOOL_NAME_PREFIX)

    return handler


def register_page_control_tools() -> int:
    """注册页面句柄族工具(PAGE_CONTROL_TOOLS=false 时整族撤销,与 UI_ACTION_TOOLS 同语义)。"""
    if os.environ.get("PAGE_CONTROL_TOOLS", "true").strip().lower() in {
        "false",
        "0",
        "no",
        "off",
    }:
        logger.info("[page_control] PAGE_CONTROL_TOOLS 关闭,跳过页面句柄族注册")
        # 按**族名**撤销,不是按 'browser_' —— 后者会连 12 个选择器族工具一起摘掉
        unregister_external_tool_by_prefix(_FAMILY_PREFIX)
        return 0
    count = 0
    for tool, handler in _page_tools():
        if register_external_tool(tool, handler):
            count += 1
    if count:
        logger.info("[page_control] 页面语义快照句柄族注册完成: %d 个工具", count)
    return count
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
