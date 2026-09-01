# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""内置 MCP Server 目录(MCP 应用商店种子数据)。

提供官方/社区常用 MCP Server 的预置配置,供前端"MCP 商店"展示与一键注册:
- 纯数据(零依赖、零网络、零副作用),只读
- 格式对齐 `MCPClientConfig`(name/transport/command/args/url/env)
- 注册复用现有 `POST /api/mcp/external/servers`(本模块只提供 `to_client_config` 转换)

内置清单(8 个,官方 servers 为主 + 常用社区):
- filesystem / git / fetch / memory / sequential-thinking / time(官方,stdio)
- postgres(官方,stdio,env 需 DATABASE_URL)
- github(社区热门,stdio,env 需 GITHUB_PERSONAL_ACCESS_TOKEN)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# 官方 MCP servers 的 npx 入口
_NPX = "npx"


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
) -> dict[str, Any] | None:
    """把目录条目转换为 MCPClientConfig 兼容 dict(供一键注册)。

    Args:
        key: 目录条目 key
        env_overrides: 用户提供的环境变量覆盖(如 DATABASE_URL / PAT)
        workspace_path: filesystem 类 server 的工作目录参数

    Returns:
        MCPClientConfig 兼容 dict;key 不存在返回 None
    """
    entry = get_entry(key)
    if not entry:
        return None
    args = list(entry.args)
    if key == "filesystem" and workspace_path:
        # args 形如 ["-y", "@modelcontextprotocol/server-filesystem", "<默认路径>"],
        # 替换尾部路径参数,保留 -y 前缀
        args = [args[0], args[1], workspace_path] if len(args) >= 2 else args
    env = dict(entry.env_default)
    if env_overrides:
        env.update({k: v for k, v in env_overrides.items() if v})
    missing = [v for v in entry.env_required if not env.get(v)]
    return {
        "name": f"mcp:{key}",
        "transport": entry.transport,
        "command": entry.command,
        "args": args,
        "url": entry.url,
        "env": env,
        "_missing_env": missing,  # 提示缺哪些必需环境变量(注册方可选拦截)
    }
