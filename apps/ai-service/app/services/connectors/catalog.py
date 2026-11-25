# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""预置平台连接器模板(2026-11-23 立)。

与旧 connectors(只读文档)的分工:
- 旧模块继续服务「文档同步」按钮(doc_list / fetch_doc),不动其契约
- 本模板给出**可执行操作清单**,覆盖消息、通讯录、日历、审批、多维表格、
  考勤等数据面;用户在连接器页勾选/编辑后走 custom_http 执行

模板只声明「怎么调」,不含任何企业凭据;凭据仍由用户填 app_id/app_secret,
由 connector_store 加密落盘。
"""

from __future__ import annotations

from typing import Any

from . import coverage

# 模板版本(前端展示与缓存指纹)
CATALOG_VERSION = "2026-11-23"

# 每个平台的操作清单:字段与 connectors.base.ConnectorOperation 对齐
PRESET_TEMPLATES: dict[str, dict[str, Any]] = {
    "feishu": {
        "label": "飞书",
        "base_url": "https://open.feishu.cn/open-apis",
        "auth_kind": "feishu_tenant",
        "description": "飞书开放平台(企业自建应用):云文档、群消息、通讯录、日历、多维表格、审批。",
        "operations": [
            {
                "id": "feishu_list_docs",
                "name": "列出云文档",
                "capability": "list",
                "method": "GET",
                "path": "/drive/v1/files",
                "query": {"page_size": 50},
                "response_path": "data.files",
                "description": "GET /drive/v1/files;可选 folder_token。",
            },
            {
                "id": "feishu_get_doc",
                "name": "读取文档正文",
                "capability": "fetch",
                "method": "GET",
                "path": "/docx/v1/documents/{document_id}/raw_content",
                "response_path": "data.content",
                "description": "按 document_id 取纯文本正文。",
            },
            {
                "id": "feishu_list_chats",
                "name": "列出群聊",
                "capability": "list",
                "method": "GET",
                "path": "/im/v1/chats",
                "query": {"page_size": 20},
                "response_path": "data.items",
            },
            {
                "id": "feishu_list_messages",
                "name": "拉群消息",
                "capability": "list",
                "method": "GET",
                "path": "/im/v1/messages",
                "query": {
                    "container_id_type": "chat",
                    "container_id": "{chat_id}",
                    "page_size": 20,
                },
                "response_path": "data.items",
            },
            {
                "id": "feishu_send_message",
                "name": "发送群消息",
                "capability": "action",
                "method": "POST",
                "path": "/im/v1/messages",
                "query": {"receive_id_type": "chat_id"},
                "body": {
                    "receive_id": "{chat_id}",
                    "msg_type": "text",
                    "content": '{"text":"{text}"}',
                },
                "description": "向群 chat_id 发文本消息;content 是 JSON 字符串。",
            },
            {
                "id": "feishu_list_users",
                "name": "查询通讯录",
                "capability": "list",
                "method": "GET",
                "path": "/contact/v3/users",
                "query": {"page_size": 50},
                "response_path": "data.items",
            },
            {
                "id": "feishu_calendar_events",
                "name": "列出日历日程",
                "capability": "list",
                "method": "GET",
                "path": "/calendar/v4/calendars/{calendar_id}/events",
                "response_path": "data.items",
            },
            {
                "id": "feishu_bitable_records",
                "name": "读取多维表格记录",
                "capability": "list",
                "method": "GET",
                "path": "/bitable/v1/apps/{app_token}/tables/{table_id}/records",
                "query": {"page_size": 50},
                "response_path": "data.items",
            },
            {
                "id": "feishu_create_doc",
                "name": "新建文档",
                "capability": "action",
                "method": "POST",
                "path": "/docx/v1/documents",
                "body": {"title": "{title}"},
                "response_path": "data.document",
            },
        ],
    },
    "dingtalk": {
        "label": "钉钉",
        "base_url": "https://oapi.dingtalk.com",
        "auth_kind": "dingtalk",
        "description": "钉钉开放平台(企业内部应用):钉盘、工作消息、通讯录、考勤、审批。",
        "operations": [
            {
                "id": "dingtalk_list_drive",
                "name": "列出钉盘文件",
                "capability": "list",
                "method": "POST",
                "path": "/topapi/drive/space/file/list",
                "body": {"space_id": "{space_id}", "folder_id": "0"},
                "response_path": "result.files",
            },
            {
                "id": "dingtalk_send_msg",
                "name": "发送工作消息",
                "capability": "action",
                "method": "POST",
                "path": "/topapi/message/corpconversation/asyncsend_v2",
                "body": {
                    "agent_id": "{agent_id}",
                    "userid_list": "{userid_list}",
                    # topapi/asyncsend_v2 的 msg 必须是 JSON 对象,不能是 JSON 字符串
                    # (传字符串会返回 errcode=41 Invalid arguments:msg)。
                    "msg": {"msgtype": "text", "text": {"content": "{text}"}},
                },
            },
            {
                "id": "dingtalk_robot_send",
                "name": "机器人发送单聊消息",
                "capability": "action",
                "method": "POST",
                "base_url": "https://api.dingtalk.com",
                "path": "/v1.0/robot/oToMessages/batchSend",
                "body": {
                    "robotCode": "{robot_code}",
                    "userIds": ["{user_id}"],
                    "msgKey": "sampleText",
                    # msgParam 必须是 JSON 字符串;text 里含未转义双引号会破坏 JSON,
                    # 需要引用时请传入已转义文本。
                    "msgParam": '{"content":"{text}"}',
                },
                "description": "以企业自建应用机器人身份给单个组织成员发单聊消息;"
                "robot_code 取连接器 extra.robot_code,user_id 为钉钉 userid。",
            },
            {
                "id": "dingtalk_list_dept",
                "name": "列出子部门",
                "capability": "list",
                "method": "POST",
                "path": "/topapi/v2/department/listsub",
                "body": {"dept_id": "{dept_id}"},
                "response_path": "result",
            },
            {
                "id": "dingtalk_list_users",
                "name": "查询部门成员",
                "capability": "list",
                "method": "POST",
                "path": "/topapi/v2/user/list",
                "body": {"dept_id": "{dept_id}", "cursor": "0", "size": 20},
                "response_path": "result.list",
            },
            {
                "id": "dingtalk_attendance",
                "name": "查询考勤",
                "capability": "list",
                "method": "POST",
                "path": "/topapi/attendance/list",
                "body": {
                    "workDateFrom": "{from}",
                    "workDateTo": "{to}",
                    "userIdList": "{userid_list}",
                },
                "response_path": "recordresult",
            },
            {
                "id": "dingtalk_approval_create",
                "name": "发起审批",
                "capability": "action",
                "method": "POST",
                "path": "/topapi/processinstance/create",
                "body": {"process_code": "{process_code}", "originator_user_id": "{userid}", "form_component_values": "{form_values}"},
            },
        ],
    },
    "wecom": {
        "label": "企业微信",
        "base_url": "https://qyapi.weixin.qq.com/cgi-bin",
        "auth_kind": "wecom_corp",
        "description": "企业微信(自建应用):微盘、应用消息、通讯录、审批、打卡。",
        "operations": [
            {
                "id": "wecom_list_wedrive",
                "name": "列出微盘文件",
                "capability": "list",
                "method": "POST",
                "path": "/wedrive/file_list",
                "body": {"spaceid": "{space_id}", "fatherid": "0"},
                "response_path": "file_list",
            },
            {
                "id": "wecom_send_message",
                "name": "发送应用消息",
                "capability": "action",
                "method": "POST",
                "path": "/message/send",
                "body": {
                    "touser": "{touser}",
                    "msgtype": "text",
                    "agentid": "{agent_id}",
                    "text": {"content": "{text}"},
                },
            },
            {
                "id": "wecom_list_users",
                "name": "查询部门成员",
                "capability": "list",
                "method": "GET",
                "path": "/user/list",
                "query": {"department_id": "{dept_id}"},
                "response_path": "userlist",
            },
            {
                "id": "wecom_list_dept",
                "name": "列出部门",
                "capability": "list",
                "method": "GET",
                "path": "/department/list",
                "response_path": "department",
            },
            {
                "id": "wecom_approval_apply",
                "name": "提交审批",
                "capability": "action",
                "method": "POST",
                "path": "/oa/applyevent",
                "body": {
                    "creator_userid": "{creator_userid}",
                    "template_id": "{template_id}",
                    "use_template_approver": 1,
                    "apply_data": {"contents": "{contents}"},
                },
            },
            {
                "id": "wecom_checkin",
                "name": "查询打卡数据",
                "capability": "list",
                "method": "POST",
                "path": "/checkin/getcheckindata",
                "body": {
                    "opencheckindatatype": 3,
                    "starttime": "{start}",
                    "endtime": "{end}",
                    "useridlist": "{userid_list}",
                },
                "response_path": "checkindata",
            },
        ],
    },
    "wechat_mp": {
        "label": "微信公众号",
        "base_url": "https://api.weixin.qq.com/cgi-bin",
        "auth_kind": "wechat_mp",
        "description": "微信公众号(服务号/订阅号):素材、草稿、发布、用户。个人微信无官方数据接口,不支持接入。",
        "operations": [
            {
                "id": "wechat_mp_materials",
                "name": "拉素材列表",
                "capability": "list",
                "method": "POST",
                "path": "/material/batchget_material",
                "body": {"type": "{material_type}", "offset": 0, "count": 20},
                "response_path": "item",
            },
            {
                "id": "wechat_mp_drafts",
                "name": "拉草稿列表",
                "capability": "list",
                "method": "POST",
                "path": "/draft/batchget",
                "body": {"offset": 0, "count": 20, "no_content": 1},
                "response_path": "item",
            },
            {
                "id": "wechat_mp_draft_add",
                "name": "新建草稿",
                "capability": "action",
                "method": "POST",
                "path": "/draft/add",
                "body": {"articles": "{articles}"},
            },
            {
                "id": "wechat_mp_publish",
                "name": "发布草稿",
                "capability": "action",
                "method": "POST",
                "path": "/freepublish/submit",
                "body": {"media_id": "{media_id}"},
            },
            {
                "id": "wechat_mp_users",
                "name": "拉用户列表",
                "capability": "list",
                "method": "GET",
                "path": "/user/get",
                "response_path": "data.openid",
            },
        ],
    },
    "yuque": {
        "label": "语雀",
        "base_url": "https://www.yuque.com",
        "auth_kind": "header",
        "auth_name": "X-Auth-Token",
        "description": "语雀知识库(公开仓库 app_secret 留空;私有仓库把 token 填在 app_secret)。",
        "operations": [
            {
                "id": "yuque_list_docs",
                "name": "列出知识库文档",
                "capability": "list",
                "method": "GET",
                "path": "/api/v2/repos/{user}/{repo}/docs",
                "response_path": "data",
            },
            {
                "id": "yuque_get_doc",
                "name": "读取文档正文",
                "capability": "fetch",
                "method": "GET",
                "path": "/api/v2/repos/{user}/{repo}/docs/{slug}",
                "response_path": "data.body",
            },
            {
                "id": "yuque_search",
                "name": "搜索文档",
                "capability": "search",
                "method": "GET",
                "path": "/api/v2/search",
                "query": {"q": "{q}", "type": "doc"},
                "response_path": "data",
            },
        ],
    },
}

# 明确不支持的类型(给前端展示原因,而不是静默不给入口)
UNSUPPORTED_TEMPLATES: dict[str, dict[str, str]] = {
    "wechat_personal": {
        "label": "个人微信",
        "reason": "个人微信没有官方数据接口,无法做实时消息/通讯录互通;"
        "微信群聊记录请走「对话导入」上传导出包。",
    },
}


def list_catalog() -> dict[str, Any]:
    """返回给前端的模板目录(不含任何凭据,可安全直传)。"""
    return {
        "version": CATALOG_VERSION,
        "templates": [
            {
                "type": key,
                "label": value["label"],
                "base_url": value["base_url"],
                "auth_kind": value["auth_kind"],
                "auth_name": value.get("auth_name", "Authorization"),
                "description": value["description"],
                "operations": [dict(op) for op in value["operations"]],
            }
            for key, value in PRESET_TEMPLATES.items()
        ],
        "unsupported": [
            {"type": key, "label": value["label"], "reason": value["reason"]}
            for key, value in UNSUPPORTED_TEMPLATES.items()
        ],
    }


def template_for(conn_type: str) -> dict[str, Any] | None:
    """按类型取模板(不存在返回 None)。"""
    return PRESET_TEMPLATES.get(conn_type)


def default_operations(conn_type: str) -> list[dict[str, Any]]:
    """模板的默认操作清单(深拷贝,避免调用方改动污染模板)。"""
    tpl = PRESET_TEMPLATES.get(conn_type)
    if not tpl:
        return []
    return [
        {**op, "query": dict(op.get("query") or {}), "body": op.get("body")}
        for op in tpl["operations"]
    ]


def operations_from_catalog(conn_type: str) -> list[dict[str, Any]]:
    """从平台台账生成预设操作;台账未判定/缺失时回退内置兜底模板。

    内置 ``PRESET_TEMPLATES``(飞书 9 / 钉钉 6 / 企微 6 / 公众号 5 / 语雀 3)
    是台账落盘前的兜底口径;台账就绪后以台账为准,内置清单不再扩写。
    """
    if conn_type in coverage.PLATFORMS:
        bundle = coverage.load_catalog(conn_type)
        if bundle.state == "ok":
            return [
                coverage.api_to_operation(api, bundle.base_url) for api in bundle.apis
            ]
    return default_operations(conn_type)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
