"""
IHUI-AI 统一能力 CLI 入口

让全世界的 AI 都可以通过命令行调用我们的程序。
支持: 智能体 / Skills / 脚本插件 / 浏览器自动化 / 计算机控制 / MCP 工具

用法:
  # 列出所有能力
  python -m app.cli.capabilities list
  python -m app.cli.capabilities list --category agents
  python -m app.cli.capabilities list --keyword 文档

  # 列出分类
  python -m app.cli.capabilities categories

  # 调用能力
  python -m app.cli.capabilities invoke skill_docx "创建一个Word文档"
  python -m app.cli.capabilities invoke browser_navigate "https://example.com" --options '{"url":"https://example.com"}'

  # 自动匹配
  python -m app.cli.capabilities auto-match "帮我创建一个PPT"

  # 通过 HTTP 调用远程服务器
  python -m app.cli.capabilities --server http://localhost:8888 list
  python -m app.cli.capabilities --server http://localhost:8888 invoke skill_docx "创建文档"

输出格式:
  默认: 人类可读文本
  --json: JSON 格式 (方便 AI 解析)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

# 支持两种模式: 本地直调 (import 后端模块) 和 远程 HTTP 调用


def _print_json(data: Any) -> None:
    """JSON 格式输出"""
    print(json.dumps(data, ensure_ascii=False, indent=2))


def _print_table(items: list[dict], columns: list[str]) -> None:
    """表格格式输出"""
    if not items:
        print("(无数据)")
        return
    # 计算列宽
    widths = {col: max(len(col), max(len(str(item.get(col, ""))) for item in items)) for col in columns}
    # 表头
    header = "  ".join(col.ljust(widths[col]) for col in columns)
    print(header)
    print("-" * len(header))
    # 行
    for item in items:
        print("  ".join(str(item.get(col, "")).ljust(widths[col]) for col in columns))


async def _local_list(args: argparse.Namespace) -> None:
    """本地: 列出能力"""
    from app.api.v1.ai.capabilities import _aggregate_capabilities, _build_categories

    items = _aggregate_capabilities()
    if args.category:
        items = [i for i in items if i.category == args.category]
    if args.keyword:
        kw = args.keyword.lower()
        items = [i for i in items if kw in i.name.lower() or kw in i.description.lower() or any(kw in t.lower() for t in i.tags)]

    if args.json:
        _print_json([i.model_dump() for i in items])
    else:
        _print_table(
            [i.model_dump() for i in items],
            ["id", "name", "type", "category", "platform"],
        )
        print(f"\n共 {len(items)} 个能力")


async def _local_categories(args: argparse.Namespace) -> None:
    """本地: 列出分类"""
    from app.api.v1.ai.capabilities import _CATEGORIES

    if args.json:
        _print_json(_CATEGORIES)
    else:
        _print_table(_CATEGORIES, ["id", "name", "icon", "description"])


async def _local_invoke(args: argparse.Namespace) -> None:
    """本地: 调用能力"""
    from app.api.v1.ai.capabilities import _invoke_capability, InvokeRequest

    options = {}
    if args.options:
        try:
            options = json.loads(args.options)
        except json.JSONDecodeError:
            print(f"错误: --options 不是有效的 JSON", file=sys.stderr)
            sys.exit(1)

    req = InvokeRequest(
        capability_id=args.capability_id,
        input=args.input,
        options=options,
    )
    result = await _invoke_capability(req)

    if args.json:
        _print_json(result)
    else:
        if result.get("success"):
            print(f"✓ 调用成功")
            print(f"结果: {result.get('result', '(无输出)')}")
        else:
            print(f"✗ 调用失败: {result.get('error', '未知错误')}", file=sys.stderr)
            sys.exit(1)


async def _local_auto_match(args: argparse.Namespace) -> None:
    """本地: 自动匹配"""
    from app.api.v1.ai.capabilities import _auto_match

    result = _auto_match(args.input)
    if args.json:
        _print_json(result)
    else:
        print(f"匹配结果: {result['capability_name']} ({result['capability_id']})")
        print(f"类型: {result['capability_type']}")
        print(f"原因: {result['reason']}")
        print(f"置信度: {result['confidence']}")


async def _remote_request(server: str, path: str, method: str = "GET", body: dict | None = None) -> dict:
    """远程 HTTP 调用"""
    import httpx
    url = f"{server.rstrip('/')}/api/v1/ai/capabilities{path}"
    async with httpx.AsyncClient() as client:
        if method == "GET":
            resp = await client.get(url, timeout=30)
        else:
            resp = await client.post(url, json=body, timeout=60)
        resp.raise_for_status()
        return resp.json()


async def _remote_list(args: argparse.Namespace) -> None:
    """远程: 列出能力"""
    params = {}
    if args.category:
        params["category"] = args.category
    if args.keyword:
        params["keyword"] = args.keyword

    import httpx
    url = f"{args.server.rstrip('/')}/api/v1/ai/capabilities/list"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("data", {}).get("categories", [])
    if args.json:
        _print_json(data)
    else:
        for cat in items:
            print(f"\n=== {cat['name']} ({cat['id']}) ===")
            for item in cat.get("items", []):
                print(f"  [{item['id']}] {item['name']} - {item['description'][:60]}")
        print(f"\n共 {data.get('data', {}).get('total', 0)} 个能力")


async def _remote_invoke(args: argparse.Namespace) -> None:
    """远程: 调用能力"""
    options = {}
    if args.options:
        options = json.loads(args.options)

    body = {
        "capability_id": args.capability_id,
        "input": args.input,
        "options": options,
    }
    data = await _remote_request(args.server, "/invoke", "POST", body)
    if args.json:
        _print_json(data)
    else:
        result = data.get("data", {})
        if result.get("success"):
            print(f"✓ 调用成功")
            print(f"结果: {result.get('result', '(无输出)')}")
        else:
            print(f"✗ 调用失败: {result.get('error', '未知错误')}", file=sys.stderr)
            sys.exit(1)


async def _remote_auto_match(args: argparse.Namespace) -> None:
    """远程: 自动匹配"""
    data = await _remote_request(args.server, "/auto-match", "POST", {"input": args.input})
    if args.json:
        _print_json(data)
    else:
        result = data.get("data", {})
        print(f"匹配结果: {result.get('capability_name', '?')} ({result.get('capability_id', '?')})")
        print(f"原因: {result.get('reason', '?')}")
        print(f"置信度: {result.get('confidence', '?')}")


async def _remote_categories(args: argparse.Namespace) -> None:
    """远程: 列出分类"""
    data = await _remote_request(args.server, "/categories")
    if args.json:
        _print_json(data)
    else:
        for cat in data.get("data", []):
            print(f"[{cat['id']}] {cat['name']} - {cat['description']}")


def main():
    parser = argparse.ArgumentParser(
        prog="ihui-capabilities",
        description="IHUI-AI 统一能力 CLI — 让全世界的 AI 都可以调用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  ihui-capabilities list
  ihui-capabilities list --category agents
  ihui-capabilities invoke skill_docx "创建Word文档"
  ihui-capabilities auto-match "帮我做PPT"
  ihui-capabilities --server http://localhost:8888 list
  ihui-capabilities --json list
        """,
    )
    parser.add_argument(
        "--server",
        type=str,
        default="",
        help="远程服务器地址 (如 http://localhost:8888), 不指定则本地直调",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json",
        help="以 JSON 格式输出 (方便 AI 解析)",
    )

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # list
    p_list = subparsers.add_parser("list", help="列出所有能力")
    p_list.add_argument("--category", type=str, default="", help="按分类过滤")
    p_list.add_argument("--keyword", type=str, default="", help="关键词搜索")

    # categories
    p_cats = subparsers.add_parser("categories", help="列出能力分类")

    # invoke
    p_invoke = subparsers.add_parser("invoke", help="调用指定能力")
    p_invoke.add_argument("capability_id", type=str, help="能力 ID")
    p_invoke.add_argument("input", type=str, help="输入内容")
    p_invoke.add_argument("--options", type=str, default="", help="额外选项 (JSON 格式)")

    # auto-match
    p_match = subparsers.add_parser("auto-match", help="AI 自动匹配能力")
    p_match.add_argument("input", type=str, help="用户输入")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    is_remote = bool(args.server)

    if args.command == "list":
        func = _remote_list if is_remote else _local_list
    elif args.command == "categories":
        func = _remote_categories if is_remote else _local_categories
    elif args.command == "invoke":
        func = _remote_invoke if is_remote else _local_invoke
    elif args.command == "auto-match":
        func = _remote_auto_match if is_remote else _local_auto_match
    else:
        parser.print_help()
        sys.exit(1)

    asyncio.run(func(args))


if __name__ == "__main__":
    main()
