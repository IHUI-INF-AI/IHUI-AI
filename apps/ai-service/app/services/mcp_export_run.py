# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE-NEW]: 新文件,由 mcp_export 一键接入能力引入。

"""IHUI 作为 MCP Server 的本地拉起 CLI 入口(stdin/stdout)。

供 Claude Desktop / Cursor 等外部 LLM Host 以``command``方式拉起子进程:

    claude_desktop_config.json:
      {"mcpServers": {"ihui-ai-mcp": {"command": "<python>",
                                      "args": ["-m", "app.services.mcp_export_run"]}}}

运行(可用本仓库 venv):
    python -m app.services.mcp_export_run --transport stdio

独立运行,不依赖 ENABLE_MCP_EXPORT 开关(该开关只控制 main.py 的 HTTP 挂载)。
瞬态入口: 进程存活期间绑定 stdin/stdout,宿主关闭 stdin 即自动退出。
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from app.services import mcp_export


def main(argv: Sequence[str] | None = None) -> int:
    """解析参数并阻塞式运行指定 transport 的 MCP Server。"""
    parser = argparse.ArgumentParser(
        prog=mcp_export.MCP_EXPORT_RUN_MODULE,
        description="以 stdio transport 本地拉起 IHUI MCP Server(供外部 LLM Host 连接)",
    )
    parser.add_argument(
        "--transport",
        choices=[mcp_export.TRANSPORT_STDIO],
        default=mcp_export.TRANSPORT_STDIO,
        help="transport(目前仅支持 stdio: MCP over stdin/stdout)",
    )
    args = parser.parse_args(argv)

    if args.transport == mcp_export.TRANSPORT_STDIO:
        run = mcp_export.handler_stdio()
        # 阻塞直至宿主关闭 stdin(Claude Desktop / Cursor 的子进程生命周期)
        run()
        return 0

    # 理论不可达(choices 已约束),防御性保留
    print(f"不支持的 transport: {args.transport}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
