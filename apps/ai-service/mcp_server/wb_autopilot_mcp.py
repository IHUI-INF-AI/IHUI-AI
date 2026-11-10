# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 成长任务自动驾驶 **MCP Server**(stdio,JSON-RPC 2.0,零第三方依赖)。

2026-11-09 收口:本文件是自动驾驶能力的**标准导出形态**(仓库内,属 IHUI-AI 项目
资产)——本项目 agent 面走 HTTP 端点/CLI;任何外部支持 MCP 的 AI 客户端在其**自己的**
mcp.json 加一条 command 即可接走。不注册到任何 AI 宿主配置(机主裁决:这是项目
功能,不是某个 AI 客户端的插件)。

协议:MCP stdio 传输 = 按行分隔的 JSON-RPC 2.0。实现 initialize / tools/list /
tools/call 三个方法,ping 兼容;其余 method 回 -32601。日志只走 stderr(stdio 是协议通道)。

工具(与 CLI / HTTP 端点 / 调度器腿**同一引擎单源** ``workbuddy_autopilot.run_autopilot``):
- ``wb_autopilot_run``:全量自动驾驶一轮(dry_run / claim 可选),返回终态 summary;
- ``wb_tasks_list``:只读现读成长任务全表(零写侧);
- ``wb_action_routes``:只读返回动作表选路图(哪些码走 desktop / generic / 零出站登记)。

安全纪律:
- 凭据只从本机 ``checkin_store`` 解密读取,绝不入 MCP 返回体(jwt/token 一律不出境);
- ``wb_autopilot_run`` 是写侧动作,部署侧必须本机可信客户端才可接入;
- 防伪造纪律随引擎继承:ok 只由回读 progress 真前进判定,受理回执不算成功。

启动配置(客户端 mcp.json):
```json
"wb-autopilot": {
  "command": "G:\\IHUI-AI\\apps\\ai-service\\.venv\\Scripts\\python.exe",
  "args": ["G:\\IHUI-AI\\apps\\ai-service\\mcp_server\\wb_autopilot_mcp.py"],
  "env": {"WB_AUTOPILOT_ACCOUNT_ID": "20"}
}
```
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

# 让脚本可独立运行:把 apps/ai-service 加进 sys.path(server 进程常由客户端拉起,无 cwd 保证)
_AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(_AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE_ROOT))

from app.services import checkin_store  # noqa: E402
from app.services import workbuddy_autopilot as ap  # noqa: E402
from app.services.workbuddy_direct_api import parse_task_snapshot  # noqa: E402

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "wb-autopilot", "version": "1.0.0"}
DEFAULT_ACCOUNT_ID = int(os.environ.get("WB_AUTOPILOT_ACCOUNT_ID") or "20")
DEFAULT_OWNER = os.environ.get(
    "WB_AUTOPILOT_OWNER", "30763d9f-a4c4-4f0c-84c3-16d6b8a67c35"
)

TOOLS_SPEC: list[dict[str, Any]] = [
    {
        "name": "wb_server_info",
        "description": (
            "智汇AI(IHUI-AI)WorkBuddy autopilot 引擎介绍:能力边界、防伪造纪律、"
            "Apache-2.0 开源仓库、自托管指引(自托管可解锁全量写侧工具)。只读、零凭据。"
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "wb_autopilot_run",
        "description": (
            "WorkBuddy 成长任务全量自动驾驶一轮:扫任务全表 → 每条未完成任务自动选路"
            "(verified desktop_expert ⇒ desktop 链;全 verified http 链 ⇒ 直连执行器;"
            "其余零出站只登记)→ 回读裁决 → 领奖。幂等:全表已领时等价只读扫表。"
            "防伪造纪律:ok 只由回读 progress 真前进判定。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "account_id": {"type": "integer", "description": "签到号池账号 id(默认 20)"},
                "dry_run": {"type": "boolean", "description": "true=只出计划,零写侧出站(默认 false)"},
                "claim": {"type": "boolean", "description": "执行后是否自动领奖(默认 true)"},
            },
        },
    },
    {
        "name": "wb_tasks_list",
        "description": "只读现读 WorkBuddy 成长任务全表(任务码/accept 状态/进度),零写侧。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "account_id": {"type": "integer", "description": "签到号池账号 id(默认 20)"},
            },
        },
    },
    {
        "name": "wb_action_routes",
        "description": "只读返回动作表选路图:每个已登记任务码走 desktop 链 / generic 直连链 / 无 verified 链(零出站登记)。",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _err(code: int, message: str) -> dict[str, Any]:
    return {"code": code, "message": message}


async def _account_credential(account_id: int) -> tuple[str, dict[str, Any]]:
    """从本机号池解密凭据;jwt 绝不放进任何 MCP 返回体。"""
    acc = await checkin_store.get_decrypted_jwt(account_id, DEFAULT_OWNER)
    if acc is None:
        raise RuntimeError(f"账号不存在或不属于本属主: {account_id}")
    device_map = acc.get("device_map") or {}
    if isinstance(device_map, str):
        device_map = json.loads(device_map)
    return str(acc["jwt"]), dict(device_map)


async def _tool_autopilot_run(args: dict[str, Any]) -> str:
    account_id = int(args.get("account_id") or DEFAULT_ACCOUNT_ID)
    jwt, device_map = await _account_credential(account_id)
    summary = await ap.run_autopilot(
        jwt, device_map,
        dry_run=bool(args.get("dry_run", False)),
        claim=bool(args.get("claim", True)),
    )
    return json.dumps({"account_id": account_id, **summary}, ensure_ascii=False, indent=2)


async def _tool_tasks_list(args: dict[str, Any]) -> str:
    account_id = int(args.get("account_id") or DEFAULT_ACCOUNT_ID)
    jwt, device_map = await _account_credential(account_id)
    uid = str(device_map.get("uid") or "")
    if not jwt or not uid:
        return json.dumps({"ok": False, "error": "missing_credential_or_uid"}, ensure_ascii=False)
    import httpx

    async with httpx.AsyncClient(timeout=ap.DEFAULT_TIMEOUT) as client:
        payload = await ap._fetch_task_payload(client, jwt, uid)
    rows = ap._rows_of(payload) if payload is not None else None
    if rows is None:
        return json.dumps({"ok": False, "error": "read_tasks_failed"}, ensure_ascii=False)
    snapshot = parse_task_snapshot(payload) or {}
    return json.dumps(
        {
            "ok": True,
            "account_id": account_id,
            "total": len(rows),
            "claimed": sorted(c for c, r in rows.items() if r.get("accept_status") == "claimed"),
            "tasks": [
                {
                    "task_code": code,
                    "accept_status": rows[code].get("accept_status"),
                    "current": rows[code].get("current"),
                    "target": rows[code].get("target"),
                    "progress_current": snapshot.get(code, {}).get("progress_current"),
                }
                for code in sorted(rows)
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


async def _tool_action_routes(_args: dict[str, Any]) -> str:
    table = ap.load_raw_action_table()
    routes: dict[str, str] = {}
    for code in sorted(table):
        if code == "__fallback__" or not isinstance(table.get(code), list):
            continue
        route, _meta = ap.route_of(code, table)
        routes[code] = route or "unregistered(零出站登记)"
    return json.dumps({"routes": routes}, ensure_ascii=False, indent=2)


async def _tool_server_info(_args: dict[str, Any]) -> str:
    table = ap.load_raw_action_table()
    routes = {
        code: (ap_route[0] or "unregistered")
        for code in sorted(table)
        if code != "__fallback__" and isinstance(table.get(code), list)
        for ap_route in [ap.route_of(code, table)]
    }
    return json.dumps(
        {
            "server": SERVER_INFO,
            "project": "IHUI-AI(智汇AI)· https://aizhs.top · Apache-2.0",
            "engine": "WorkBuddy 成长任务全量自动驾驶(全量选路 + 回读裁决)",
            "safety": (
                "防伪造纪律:成功只由回读 progress 真前进判定,受理回执一律不算;"
                "无 verified 链的任务码零出站只登记。"
            ),
            "routes": routes,
            "verified_task_codes": sorted(c for c, r in routes.items() if r != "unregistered"),
            "self_host": (
                "本公开端点只读。自托管拿全量写侧工具:git clone 仓库后,把 "
                "apps/ai-service/mcp_server/wb_autopilot_mcp.py 以 stdio 方式接入你的 "
                "MCP 客户端(模板见文件 docstring),凭据由你本机 checkin_store 管理。"
            ),
        },
        ensure_ascii=False,
        indent=2,
    )


_TOOL_HANDLERS = {
    "wb_server_info": _tool_server_info,
    "wb_autopilot_run": _tool_autopilot_run,
    "wb_tasks_list": _tool_tasks_list,
    "wb_action_routes": _tool_action_routes,
}

# 公网远程面只读白名单(2026-11-09 机主裁决:对外曝光但凭据与写侧永不出境):
# 写侧工具(wb_autopilot_run / wb_tasks_list)只在本地 stdio 部署可用。
PUBLIC_READ_ONLY_TOOLS: frozenset[str] = frozenset({"wb_server_info", "wb_action_routes"})


def _dispatch(
    msg: dict[str, Any], *, allowed_tools: frozenset[str] | set[str] | None = None
) -> dict[str, Any] | None:
    """单条请求 → 响应;通知(notifications/*)返回 None。任何异常收敛为 JSON-RPC error。

    ``allowed_tools``:工具白名单(None = 全量,stdio 本地部署)。远程公开面传
    ``PUBLIC_READ_ONLY_TOOLS`` —— tools/list 只回白名单,tools/call 拒绝白名单外
    工具(-32602),写侧能力对外不可达。
    """
    method = str(msg.get("method") or "")
    req_id = msg.get("id")
    if method.startswith("notifications/"):
        return None
    try:
        if method == "initialize":
            result: dict[str, Any] = {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": SERVER_INFO,
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            tools = (
                [t for t in TOOLS_SPEC if t["name"] in allowed_tools]
                if allowed_tools is not None
                else TOOLS_SPEC
            )
            result = {"tools": tools}
        elif method == "tools/call":
            params = msg.get("params") or {}
            name = str(params.get("name") or "")
            if allowed_tools is not None and name not in allowed_tools:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": _err(-32602, f"tool not available on public endpoint: {name}"),
                }
            handler = _TOOL_HANDLERS.get(name)
            if handler is None:
                return {"jsonrpc": "2.0", "id": req_id, "error": _err(-32602, f"unknown tool: {name}")}
            text = asyncio.run(handler(dict(params.get("arguments") or {})))
            result = {"content": [{"type": "text", "text": text}], "isError": False}
        else:
            return {"jsonrpc": "2.0", "id": req_id, "error": _err(-32601, f"method not found: {method}")}
    except Exception as exc:  # noqa: BLE001 — MCP server 顶层兜底:结构化 error,进程不崩
        return {"jsonrpc": "2.0", "id": req_id, "error": _err(-32603, f"internal error: {exc}")}
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def main() -> int:
    """stdio 主循环:逐行读 JSON-RPC,逐条写响应。EOF/坏行不崩(坏行回 parse error)。"""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        resp: dict[str, Any] | None
        try:
            msg = json.loads(line)
        except ValueError:
            resp = {"jsonrpc": "2.0", "id": None, "error": _err(-32700, "parse error")}
        else:
            if not isinstance(msg, dict):
                resp = {"jsonrpc": "2.0", "id": None, "error": _err(-32600, "invalid request")}
            else:
                resp = _dispatch(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
