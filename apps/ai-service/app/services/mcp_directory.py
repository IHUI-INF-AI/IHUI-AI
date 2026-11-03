# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""内置 MCP Server 目录(MCP 应用商店种子数据)。

提供官方/社区常用 MCP Server 的预置配置,供前端"MCP 商店"展示与一键注册:
- 目录本体纯数据(零网络、零副作用),只读
- 格式对齐 `MCPClientConfig`(name/transport/command/args/url/env)
- 注册复用现有 `POST /api/mcp/external/servers`(本模块只提供 `to_client_config` 转换)
- G-998139:`to_client_config` 转换时对裸名命令(npx)做显式候选序解析
  (候选序 = PATH 各目录 + POSIX bootstrap 集;找到 ⇒ 绝对路径,全找不到 ⇒
  大声报错并列出试过候选,不回落裸名 spawn),仅依赖 stdlib 的 exec_env

内置清单(8 个,官方 servers 为主 + 常用社区):
- filesystem / git / fetch / memory / sequential-thinking / time(官方,stdio)
- postgres(官方,stdio,env 需 DATABASE_URL)
- github(社区热门,stdio,env 需 GITHUB_PERSONAL_ACCESS_TOKEN)
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from app.core.exec_env import resolve_stdio_command

# 官方 MCP servers 的 npx 入口(目录数据保持裸名形态;
# 注册转换时由 to_client_config 经显式候选序解析成绝对路径 —— G-998139)
_NPX = "npx"


class McpDirectoryCommandError(RuntimeError):
    """目录条目命令解析不到(G-998139 拍板:大声喊 —— 文案必须带完整"试过候选"列表)。"""


def resolve_directory_command(command: str, env: Mapping[str, str] | None = None) -> str:
    """显式候选序解析目录条目命令(候选序 = PATH 各目录 + POSIX bootstrap 集)。

    找到 ⇒ 返回绝对路径(结果+出处成对出口的"结果"侧);全找不到 ⇒ 抛
    :class:`McpDirectoryCommandError` 列出全部试过候选 —— **绝不**返回空字符串/
    裸名冒充已解析(§5d/守门 103:候选序解析器必须同时提供出处出口)。
    """
    resolution = resolve_stdio_command(command, env)
    if resolution.resolved is None:
        raise McpDirectoryCommandError(
            f"目录条目命令解析不到: {command}(不回落裸名 spawn),"
            f"试过候选: {', '.join(resolution.tried) or '(无候选)'}"
        )
    return resolution.resolved


@dataclass
class DirectoryEntry:
    """MCP 商店目录条目(纯数据)。"""

    key: str  # 唯一标识(URL path 安全,小写连字符)
    name: str  # 展示名
    description: str  # 用途说明
    source: str  # official / community
    transport: str  # stdio / sse
    command: str = ""
    args: list[str] = field(default_factory=list)
    url: str = ""
    env_required: list[str] = field(default_factory=list)  # 需用户配置的环境变量名
    env_default: dict[str, str] = field(default_factory=dict)


_DIRECTORY: list[DirectoryEntry] = [
    DirectoryEntry(
        key="filesystem",
        name="Filesystem",
        description="本地文件系统读写(安全的文件操作,路径受限)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
        env_required=[],
    ),
    DirectoryEntry(
        key="git",
        name="Git",
        description="Git 仓库操作(读提交/分支/diff,受限写)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-git"],
        env_required=[],
    ),
    DirectoryEntry(
        key="fetch",
        name="Fetch",
        description="网页抓取与内容提取(URL → 可读文本)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-fetch"],
        env_required=[],
    ),
    DirectoryEntry(
        key="memory",
        name="Memory",
        description="持久化知识图谱记忆(实体/关系存取)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-memory"],
        env_required=[],
    ),
    DirectoryEntry(
        key="sequential-thinking",
        name="Sequential Thinking",
        description="逐步推理工具(复杂问题分步思考)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-sequential-thinking"],
        env_required=[],
    ),
    DirectoryEntry(
        key="time",
        name="Time",
        description="时间查询与时区转换",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-time"],
        env_required=[],
    ),
    DirectoryEntry(
        key="postgres",
        name="PostgreSQL",
        description="PostgreSQL 数据库查询(只读 schema/数据访问)",
        source="official",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-postgres"],
        env_required=["DATABASE_URL"],
        env_default={},
    ),
    DirectoryEntry(
        key="github",
        name="GitHub",
        description="GitHub 仓库/Issue/PR 查询与操作(需 PAT)",
        source="community",
        transport="stdio",
        command=_NPX,
        args=["-y", "@modelcontextprotocol/server-github"],
        env_required=["GITHUB_PERSONAL_ACCESS_TOKEN"],
        env_default={},
    ),
]


def get_directory() -> list[dict[str, Any]]:
    """返回目录条目列表(可 JSON 序列化,供前端展示)。"""
    return [
        {
            "key": e.key,
            "name": e.name,
            "description": e.description,
            "source": e.source,
            "transport": e.transport,
            "env_required": e.env_required,
        }
        for e in _DIRECTORY
    ]


def get_entry(key: str) -> DirectoryEntry | None:
    """按 key 查目录条目,不存在返回 None。"""
    for e in _DIRECTORY:
        if e.key == key:
            return e
    return None


def to_client_config(
    key: str,
    *,
    env_overrides: dict[str, str] | None = None,
    workspace_path: str = "/path/to/workspace",
    env: Mapping[str, str] | None = None,
) -> dict[str, Any] | None:
    """把目录条目转换为 MCPClientConfig 兼容 dict(供一键注册)。

    Args:
        key: 目录条目 key
        env_overrides: 用户提供的环境变量覆盖(如 DATABASE_URL / PAT)
        workspace_path: filesystem 类 server 的工作目录参数
        env: 命令解析所用的进程环境(默认取 os.environ);测试注入受控 PATH 用

    Returns:
        MCPClientConfig 兼容 dict;key 不存在返回 None。
        command 为显式候选序解析出的绝对路径(G-998139);必需环境变量缺失时
        原样早退(`_missing_env` 非空,不做解析 —— 缺 env 是更可操作的错误,
        且保持调用方 400 契约与真机是否装有 npx 解耦)。

    Raises:
        McpDirectoryCommandError: 裸名命令解析不到(文案带完整"试过候选"列表)。
    """
    entry = get_entry(key)
    if not entry:
        return None
    args = list(entry.args)
    if key == "filesystem" and workspace_path:
        # args 形如 ["-y", "@modelcontextprotocol/server-filesystem", "<默认路径>"],
        # 替换尾部路径参数,保留 -y 前缀
        args = [args[0], args[1], workspace_path] if len(args) >= 2 else args
    server_env = dict(entry.env_default)
    if env_overrides:
        server_env.update({k: v for k, v in env_overrides.items() if v})
    missing = [v for v in entry.env_required if not server_env.get(v)]
    if missing or not entry.command:
        # 缺必需 env(或无命令的 sse 条目):不解析,原样交还由调用方裁决
        command = entry.command
    else:
        # G-998139:裸名命令(npx)走显式候选序解析,找到 ⇒ 绝对路径;
        # 全找不到 ⇒ 大声报错并列出试过候选,绝不回落裸名 spawn
        command = resolve_directory_command(entry.command, env)
    return {
        "name": f"mcp:{key}",
        "transport": entry.transport,
        "command": command,
        "args": args,
        "url": entry.url,
        "env": server_env,
        "_missing_env": missing,  # 提示缺哪些必需环境变量(注册方可选拦截)
    }
