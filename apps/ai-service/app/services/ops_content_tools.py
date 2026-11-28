# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""运营内容工具(G-17,2026-11-28 立):公告 / 轮播(运营位)CRUD 接入对话 tool loop。

六枚工具(2 只读 + 4 写):
- 只读:announce_list / carousel_list(免审批,但 api 侧 requireAdmin 兜底);
- 写:announce_create / announce_update / carousel_create / carousel_update
  (审批走 tool loop 的 tool-approval 门,在 llm.py::_TOOL_DANGER_LEVELS 判 high)。

设计边界(与 connector_read_tools / api_endpoint_call 同一先例,改动前必读):
- **执行形态是浏览器委托,不是本地执行**。admin 面(requireAdmin)只认 JWT 身份
  且 `includeInternalChannel: false`(服务凭据不得继承管理员权限),所以本模块的
  本地 handler 只做「未在委托面时给可判定错误」,真实执行链 =
  llm.py `_ADMIN_DELEGATE_TOOLS` 分支发 tool-delegate 帧 → web 执行器用
  **用户本人会话**调既有 admin 端点(requireAdmin 按用户真实角色判)→ tool-result 回传。
- HTTP 形态不复用 api_tools_bridge.make_api_handler:该桥的内部票身份在 admin 面
  `resolveAdminRoleId(includeInternalChannel:false)` 下拿不到管理员角色,真走 HTTP
  只会得到可预期的 403。本地 handler 仅在 agent 引擎等非聊天流路径被直调时兜底报
  `DELEGATE_REQUIRED`,真实执行链完全由 web 执行器以用户本人会话完成,零重复安全逻辑。
- 注册走 register_external_tool(main.py 启动时装载,幂等),不进 mcp_server 的
  _TOOLS 字面量 —— 与 connector 家族同一先例;工具名全局静态,不按用户动态注册。
- 显示名三处登记(tool-display.ts / 五语言 taskStatus)与意图携带表
  (@ihui/shared/chat/ops-content-intent)由守门与测试对账。
"""

from __future__ import annotations

import logging
from typing import Any

from .mcp_server import MCPTool, register_external_tool

logger = logging.getLogger(__name__)

ANNOUNCE_LIST_TOOL = "announce_list"
ANNOUNCE_CREATE_TOOL = "announce_create"
ANNOUNCE_UPDATE_TOOL = "announce_update"
CAROUSEL_LIST_TOOL = "carousel_list"
CAROUSEL_CREATE_TOOL = "carousel_create"
CAROUSEL_UPDATE_TOOL = "carousel_update"

OPS_CONTENT_TOOLS: tuple[str, ...] = (
    ANNOUNCE_LIST_TOOL,
    ANNOUNCE_CREATE_TOOL,
    ANNOUNCE_UPDATE_TOOL,
    CAROUSEL_LIST_TOOL,
    CAROUSEL_CREATE_TOOL,
    CAROUSEL_UPDATE_TOOL,
)

OPS_CONTENT_WRITE_TOOLS: tuple[str, ...] = (
    ANNOUNCE_CREATE_TOOL,
    ANNOUNCE_UPDATE_TOOL,
    CAROUSEL_CREATE_TOOL,
    CAROUSEL_UPDATE_TOOL,
)

_DELEGATE_REQUIRED_MESSAGE = (
    "该工具由浏览器端执行(用户本人会话调 admin 端点),当前调用路径没有委托面。"
    "请在 web 端聊天流中使用;本地直调一律拒绝,不降级为服务端调用。"
)


def _delegate_only_handler(tool_name: str):
    async def _handler(_args: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": False,
            "errorCode": "DELEGATE_REQUIRED",
            "message": f"{tool_name}: {_DELEGATE_REQUIRED_MESSAGE}",
        }

    return _handler


def _announce_list_tool() -> MCPTool:
    return MCPTool(
        name=ANNOUNCE_LIST_TOOL,
        description=(
            "查询站内公告列表(需要管理员权限)。"
            "返回 id/标题/类型/置顶/发布状态/发布时间等字段,供 announce_update 前定位公告 id;"
            "响应过长会被截断。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "页码,默认 1"},
                "pageSize": {"type": "integer", "description": "每页条数,默认 20,最大 100"},
                "title": {"type": "string", "description": "按标题模糊筛选"},
                "isPublished": {
                    "type": "boolean",
                    "description": "发布状态筛选:默认只回已发布;找草稿传 false",
                },
            },
        },
    )


def _announce_create_tool() -> MCPTool:
    return MCPTool(
        name=ANNOUNCE_CREATE_TOOL,
        description=(
            "创建站内公告(需管理员;执行前会弹审批卡,用户批准才真正落库)。"
            "isPublished=false 时创建为草稿,发布可用 announce_update 或后台完成。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "公告标题(1-255 字)"},
                "content": {"type": "string", "description": "公告正文(必填)"},
                "type": {
                    "type": "string",
                    "enum": ["info", "warning", "maintenance", "update"],
                    "description": "公告类型:info 普通 / warning 警告 / maintenance 维护 / update 更新,默认 info",
                },
                "isPinned": {"type": "boolean", "description": "是否置顶,默认 false"},
                "isPublished": {"type": "boolean", "description": "是否直接发布,默认 false(草稿)"},
            },
            "required": ["title", "content"],
        },
    )


def _announce_update_tool() -> MCPTool:
    return MCPTool(
        name=ANNOUNCE_UPDATE_TOOL,
        description=(
            "更新站内公告(需管理员;执行前会弹审批卡)。"
            "id 可用 announce_list 查询;字段全部可选,只传要改的。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "公告 id(uuid,来自 announce_list)"},
                "title": {"type": "string", "description": "新标题"},
                "content": {"type": "string", "description": "新正文"},
                "type": {
                    "type": "string",
                    "enum": ["info", "warning", "maintenance", "update"],
                    "description": "公告类型",
                },
                "isPinned": {"type": "boolean", "description": "是否置顶"},
                "isPublished": {"type": "boolean", "description": "是否发布(发布/下架都走这里)"},
            },
            "required": ["id"],
        },
    )


def _carousel_list_tool() -> MCPTool:
    return MCPTool(
        name=CAROUSEL_LIST_TOOL,
        description=(
            "查询轮播图(运营位)列表(需管理员权限),返回 id/位置/标题/图片/链接/排序/上下架状态,"
            "供 carousel_update 前定位 id。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "页码,默认 1"},
                "pageSize": {"type": "integer", "description": "每页条数,默认由后台决定"},
                "search": {"type": "string", "description": "按标题模糊搜索"},
            },
        },
    )


def _carousel_create_tool() -> MCPTool:
    return MCPTool(
        name=CAROUSEL_CREATE_TOOL,
        description=(
            "创建轮播图/运营位(需管理员;执行前会弹审批卡)。"
            "position 决定展示位(home 首页 / activities 活动 / learn 学习 / live 直播等)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "标题"},
                "position": {"type": "string", "description": "展示位置,默认 home"},
                "imageUrl": {"type": "string", "description": "图片 URL(必填语义,可传空串后补)"},
                "linkUrl": {"type": "string", "description": "点击跳转链接"},
                "description": {"type": "string", "description": "描述文案"},
                "sort": {"type": "integer", "description": "排序值,越小越靠前,默认 0"},
                "status": {
                    "type": "integer",
                    "enum": [0, 1],
                    "description": "1=上架显示,0=隐藏,默认 1",
                },
            },
            "required": [],
        },
    )


def _carousel_update_tool() -> MCPTool:
    return MCPTool(
        name=CAROUSEL_UPDATE_TOOL,
        description=(
            "更新轮播图/运营位(需管理员;执行前会弹审批卡)。"
            "id 用 carousel_list 查询;**部分更新语义**,只传要改的字段(典型用途:status 上下架)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "轮播 id(uuid,来自 carousel_list)"},
                "title": {"type": "string", "description": "新标题"},
                "position": {"type": "string", "description": "展示位置"},
                "imageUrl": {"type": "string", "description": "图片 URL"},
                "linkUrl": {"type": "string", "description": "点击跳转链接"},
                "description": {"type": "string", "description": "描述文案"},
                "sort": {"type": "integer", "description": "排序值"},
                "status": {"type": "integer", "enum": [0, 1], "description": "1=上架,0=下架"},
            },
            "required": ["id"],
        },
    )


def setup_ops_content_tools() -> int:
    """注册六枚运营内容工具(2 只读 + 4 写),返回本次成功注册数(幂等,失败降级)。

    handler 为委托兜底态(直调返回 DELEGATE_REQUIRED 可判定错误):admin 面只认
    用户本人 JWT,本地无会话凭据可代理;真实执行链是 llm.py 委托分支 → web 执行器
    (见模块 docstring)。
    """
    count = 0
    registrations: tuple[tuple[MCPTool, Any], ...] = (
        (_announce_list_tool(), _delegate_only_handler(ANNOUNCE_LIST_TOOL)),
        (_announce_create_tool(), _delegate_only_handler(ANNOUNCE_CREATE_TOOL)),
        (_announce_update_tool(), _delegate_only_handler(ANNOUNCE_UPDATE_TOOL)),
        (_carousel_list_tool(), _delegate_only_handler(CAROUSEL_LIST_TOOL)),
        (_carousel_create_tool(), _delegate_only_handler(CAROUSEL_CREATE_TOOL)),
        (_carousel_update_tool(), _delegate_only_handler(CAROUSEL_UPDATE_TOOL)),
    )
    for tool, handler in registrations:
        try:
            if register_external_tool(tool, handler):
                count += 1
        except Exception as e:  # noqa: BLE001 - 单个工具注册失败不影响其余
            logger.warning("[ops-content] 注册工具失败 %s(忽略): %s", tool.name, e)
    logger.info("[ops-content] 工具注册完成: %d 个 (%s)", count, ", ".join(OPS_CONTENT_TOOLS))
    return count


__all__ = [
    "ANNOUNCE_LIST_TOOL",
    "ANNOUNCE_CREATE_TOOL",
    "ANNOUNCE_UPDATE_TOOL",
    "CAROUSEL_LIST_TOOL",
    "CAROUSEL_CREATE_TOOL",
    "CAROUSEL_UPDATE_TOOL",
    "OPS_CONTENT_TOOLS",
    "OPS_CONTENT_WRITE_TOOLS",
    "setup_ops_content_tools",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
