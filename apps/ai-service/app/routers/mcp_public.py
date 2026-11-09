# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy autopilot **公网远程 MCP 端点**(对外曝光,2026-11-09 立)。

定位:让任何支持 MCP 的 AI 客户端经公网 URL 直接接入,提升项目曝光;同时严守安全边界:

- **只读白名单**:tools/list 与 tools/call 仅放行 ``PUBLIC_READ_ONLY_TOOLS``
  (``wb_server_info`` / ``wb_action_routes``,零凭据、零写侧、纯仓库数据);
  写侧工具(wb_autopilot_run / wb_tasks_list)在远程面不可达(-32602),
  只能经本地 stdio 部署使用(凭据由部署方本机 checkin_store 管理);
- **限流**:内存滑动窗口(默认 60 秒窗口 30 次/IP,env WB_MCP_PUBLIC_RATE 可调,
  0 = 关闭限流);超限 429;
- **零认证读端点**:暴露的数据只有动作表选路图与引擎介绍(仓库本就公开),
  不含任何账号/凭据/真实任务状态。

接入(任何 MCP 客户端):
```
POST https://ai.aizhs.top/api/mcp-public/wb-autopilot
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"wb_action_routes","arguments":{}}}
```
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import deque

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter()

from mcp_server import wb_autopilot_mcp as mcp_engine  # noqa: E402

PUBLIC_TOOLS = mcp_engine.PUBLIC_READ_ONLY_TOOLS

# 限流:滑动窗口(进程内;与生产 NSSM 单进程拓扑一致)
_RATE_WINDOW_SECONDS = 60.0
_RATE_LIMIT = int(os.environ.get("WB_MCP_PUBLIC_RATE") or "30")
_rate_buckets: dict[str, deque[float]] = {}


def _rate_allow(key: str) -> bool:
    """滑动窗口限流;_RATE_LIMIT<=0 时关闭(测试用)。纯内存,单实例拓扑。"""
    if _RATE_LIMIT <= 0:
        return True
    now = time.monotonic()
    bucket = _rate_buckets.setdefault(key, deque())
    while bucket and now - bucket[0] > _RATE_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT:
        return False
    bucket.append(now)
    return True


@router.post("/mcp-public/wb-autopilot")
async def wb_autopilot_remote_mcp(request: Request) -> JSONResponse:
    """公网 MCP JSON-RPC 入口(只读白名单 + 限流;零认证,零凭据面)。

    ``_dispatch`` 内部用 ``asyncio.run``(为本地 stdio 设计),不能在运行中的
    事件循环里直调 —— 经 ``asyncio.to_thread`` 丢线程池,线程内新开 loop 合法。
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _rate_allow(client_ip):
        return JSONResponse(
            status_code=429,
            content={"jsonrpc": "2.0", "id": None,
                     "error": {"code": -32000, "message": "rate limited"}},
        )
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        return JSONResponse(
            status_code=200,
            content={"jsonrpc": "2.0", "id": None,
                     "error": {"code": -32700, "message": "parse error"}},
        )
    # 单请求单条处理(批量 JSON-RPC 不支持:MCP stdio 语义本就是逐条)
    resp = await asyncio.to_thread(mcp_engine._dispatch, body, allowed_tools=PUBLIC_TOOLS)
    if resp is None:  # 通知:无响应体
        return JSONResponse(status_code=204, content=None)
    return JSONResponse(status_code=200, content=resp)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
