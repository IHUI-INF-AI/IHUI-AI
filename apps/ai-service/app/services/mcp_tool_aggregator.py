# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""MCP Super Tool Aggregator -- 聚合多个 MCP Server 的 tools 为统一超级工具池。

对标产品只做 "逐 server 打平工具";本模块把已连接的多个 MCP Server 的
所有 tools 聚合成一个去重、冲突仲裁、统一 schema 的超级工具池,作为超大
工具集暴露给模型。这是没有对照的独有能力。

设计要点(保持纯服务层,不接 agent_loop_v2、不开新路由):
- 聚合器"不自己连接":build() 接受调用方注入的 tool_sources 与可选
  invoke_fn,便于确定性单测与真网两用。
- 输入形态对齐 MCPClientManager.list_available_tools_async() 及各 MCPClient
  的 list_tools():tools/list 返回的 Tool 含 name/description/inputSchema,
  tools/call 用于调用。本模块不 import mcp SDK,依赖纯 dict 形态即可。

去重与冲突仲裁(collision_policy,经 resolve() 可复裁决):
- "first"(默认): 同 name 冲突组内按优先级(priority 高者优先)--> 描述更长
  --> 源顺序,选出唯一 primary 保留裸 name,其余以 `{name}__{server}` 区分
  并标记 collision=True。
- "prefix": 不做仲裁,每个工具 key 一律 `{name}__{server}`(namespaced),
  全部独立保留,collision 恒 False(unique == total)。
- "merge_manifest": 完全一致(同 schema + 同描述)的重复定义合并为单条目
  (key=裸 name,sources 记录所有服务器);真正冲突者(`{name}__{server}`)
  全部保留并标记 collision=True。

统一 schema 归一化:保证 name/description/required/properties 存在,缺失给
默认(type->object, description->工具描述, properties->{}, required->[]),
并产出每个工具的资源来源(server)与冲突标记。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

# 支持的冲突仲裁策略
POLICY_FIRST = "first"
POLICY_PREFIX = "prefix"
POLICY_MERGE_MANIFEST = "merge_manifest"
SUPPORTED_POLICIES = frozenset(
    {POLICY_FIRST, POLICY_PREFIX, POLICY_MERGE_MANIFEST}
)

# invoke_fn 形态: async (server_name, tool_name, args) -> result
InvokeFn = Callable[[str, str, dict[str, Any]], Awaitable[Any]]


@dataclass
class ToolSource:
    """单个 MCP Server 的工具来源(由调用方注入)。"""

    server_name: str
    tools: list[Any]  # 每项为 dict{name,description,inputSchema} 或 MCPClientTool 形
    priority: int = 0  # 冲突仲裁显式优先级,越高越优先;默认 0


@dataclass
class PoolTool:
    """超级工具池中的单个(已归一化)工具条目。"""

    key: str  # 全池唯一 key(裸 name 或 `{name}__{server}`)对模型寻址
    name: str  # 原始工具名
    description: str
    schema: dict[str, Any]  # 归一化后的统一 JSON Schema
    server_name: str  # 来源 server(经 server_name 唯一的场景)
    collision: bool = False
    collision_group: str | None = None  # 冲突所在 name 组(冲突时非空)
    sources: list[str] = field(default_factory=list)  # merge_manifest 合并时含多 server


@dataclass
class SuperToolPool:
    """扁平超级工具池。"""

    tools: list[PoolTool]
    total_tools: int  # 各 server 原始工具总数
    by_server: dict[str, list[PoolTool]]
    by_name: dict[str, list[PoolTool]]  # 原始 name -> 该组全部条目
    collisions: dict[str, list[PoolTool]]  # name -> 标记为 collision 的条目
    meta: dict[str, Any]
    _by_key: dict[str, PoolTool] = field(default_factory=dict, repr=False)

    @property
    def unique_tools(self) -> int:
        return len(self.tools)

    def lookup(self, key: str) -> PoolTool | None:
        return self._by_key.get(key)


@dataclass
class _RawTool:
    name: str
    description: str
    schema: dict[str, Any]
    server_name: str
    priority: int


class MCPSuperToolAggregator:
    """把多 server 工具的输入聚合成统一超级工具池。"""

    def __init__(self) -> None:
        # 缓存原始输入,供 resolve() 复裁决
        self._raw_tools: list[_RawTool] = []

    # ------------------------------------------------------------------
    # 构建
    # ------------------------------------------------------------------

    def build(
        self,
        tool_sources: list[ToolSource],
        collision_policy: str = POLICY_FIRST,
    ) -> SuperToolPool:
        """构建扁平超级工具池。

        Args:
            tool_sources: 每个 MCP Server 的工具来源(server_name + tools)。
            collision_policy: 冲突仲裁策略,见模块 docstring。

        Returns:
            SuperToolPool(total_tools/unique_tools/by_server/by_name/
                          collisions/meta)。
        """
        if collision_policy not in SUPPORTED_POLICIES:
            raise ValueError(
                f"未知 collision_policy: {collision_policy!r};"
                f" 支持 {sorted(SUPPORTED_POLICIES)}"
            )
        raw = self._collect_raw(tool_sources)
        self._raw_tools = raw

        # schema 归一化计数(meta)
        norm_stats = {
            "missing_description": 0,
            "missing_type": 0,
            "missing_properties": 0,
            "missing_required": 0,
        }
        normalized: list[_RawTool] = []
        for rt in raw:
            schema = self.normalize_schema(
                rt.schema, description=rt.description, stats=norm_stats
            )
            normalized.append(
                _RawTool(rt.name, rt.description, schema, rt.server_name, rt.priority)
            )

        by_name: dict[str, list[_RawTool]] = {}
        for rt in normalized:
            by_name.setdefault(rt.name, []).append(rt)

        pool_tools: list[PoolTool] = []
        collisions: dict[str, list[PoolTool]] = {}
        for name, group in by_name.items():
            if len(group) == 1:
                pool_tools.append(self._entry(group[0], key=name, collision=False))
            else:
                entries, collided = self._arbitrate(name, group, collision_policy)
                pool_tools.extend(entries)
                if collided:
                    collisions[name] = collided

        by_server: dict[str, list[PoolTool]] = {}
        for pt in pool_tools:
            for srv in pt.sources:
                if srv not in by_server:
                    by_server[srv] = []
                if pt not in by_server[srv]:
                    by_server[srv].append(pt)

        meta: dict[str, Any] = {
            "policy": collision_policy,
            "collision_entry_count": sum(len(v) for v in collisions.values()),
            "collision_group_count": len(collisions),
            "schema_normalization": norm_stats,
        }

        pool = SuperToolPool(
            tools=pool_tools,
            total_tools=len(raw),
            by_server=by_server,
            by_name=dict(by_name),
            collisions=collisions,
            meta=meta,
        )
        pool._by_key = {pt.key: pt for pt in pool_tools}
        return pool

    def resolve(
        self,
        pool: SuperToolPool,
        collision_policy: str,
    ) -> SuperToolPool:
        """以新的仲裁策略基于最近一次 build 的原始输入复裁决。

        只重跑仲裁与统计,不改底层原始工具(schema 权重相同,直接复用)。

        Args:
            pool: 现有池(忽略其内容,仅作哨兵/接口对齐)。
            collision_policy: 目标仲裁策略。
        """
        return self.build(
            self._sources_from_raw(self._raw_tools), collision_policy=collision_policy
        )

    # ------------------------------------------------------------------
    # 调度
    # ------------------------------------------------------------------

    async def call_forward(
        self,
        pool: SuperToolPool,
        tool_key: str,
        args: dict[str, Any],
        *,
        invoke_fn: InvokeFn | None = None,
        clients: dict[str, Any] | None = None,
    ) -> Any:
        """按唯一 key 路由到来源 server 并执行 tools/call。

        - 优先使用调用方注入的 invoke_fn(server_name, tool_name, args)。
        - 否则使用 clients: {server_name: MCPClient} 的 call_tool(tool_name, args)。
        - 都不提供时抛 RuntimeError。

        Args:
            pool: 目标超级工具池。
            tool_key: 池内唯一 key(manifest 中的 key)。
            args: 工具参数。
            invoke_fn: 可选异步调用句柄(离线测试用)。
            clients: 可选真实 MCPClient 映射(真网用)。

        Returns:
            MCP tools/call result。
        """
        entry = pool.lookup(tool_key)
        if entry is None:
            raise KeyError(
                f"tool_key 不存在于池中: {tool_key!r}"
                f" (可用 key: {sorted(pool._by_key)[:20]})"
            )
        server, name = entry.server_name, entry.name
        if invoke_fn is not None:
            return await invoke_fn(server, name, args)
        if clients is not None:
            client = clients.get(server)
            if client is None:
                raise KeyError(f"clients 中缺少 server: {server!r}")
            return await client.call_tool(name, args)
        raise RuntimeError(
            "call_forward 需要 invoke_fn 或 clients 二者之一" " (聚合器不自行连接)"
        )

    # ------------------------------------------------------------------
    # manifest / schema 归一化
    # ------------------------------------------------------------------

    def manifest(self, pool: SuperToolPool) -> list[dict[str, Any]]:
        """供模型可见的聚合清单(每工具唯一 key、来源、schema 摘要、冲突标记)。"""
        out: list[dict[str, Any]] = []
        for pt in pool.tools:
            schema = pt.schema
            out.append(
                {
                    "key": pt.key,
                    "name": pt.name,
                    "description": pt.description,
                    "server_name": pt.server_name,
                    "sources": list(pt.sources),
                    "collision": pt.collision,
                    "collision_group": pt.collision_group,
                    "schema": {
                        "type": schema.get("type", "object"),
                        "required": list(schema.get("required") or []),
                        "property_count": len(schema.get("properties") or {}),
                        "additionalProperties": schema.get(
                            "additionalProperties", True
                        ),
                    },
                }
            )
        return out

    @staticmethod
    def normalize_schema(
        schema: dict[str, Any],
        *,
        description: str | None = None,
        stats: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        """把各 server 的 inputSchema 归一到统一 JSON Schema 结构。

        保证 type/description(缺失时回退工具描述)/properties/required 存在。
        缺失字段给默认:type->"object", properties->{}, required->[]。
        """
        if not isinstance(schema, dict):
            schema = {}
        norm = dict(schema)
        if not norm.get("type"):
            norm["type"] = "object"
            if stats is not None:
                stats["missing_type"] += 1
        if not norm.get("properties"):
            norm["properties"] = {}
            if stats is not None:
                stats["missing_properties"] += 1
        if "required" not in norm or not isinstance(norm.get("required"), list):
            norm["required"] = []
            if stats is not None:
                stats["missing_required"] += 1
        if not norm.get("description"):
            norm["description"] = description or ""
            if stats is not None:
                stats["missing_description"] += 1
        return norm

    # ------------------------------------------------------------------
    # 内部
    # ------------------------------------------------------------------

    def _collect_raw(self, tool_sources: list[ToolSource]) -> list[_RawTool]:
        raw: list[_RawTool] = []
        for src in tool_sources:
            server = src.server_name
            if not server:
                raise ValueError("ToolSource.server_name 不能为空")
            for tool in src.tools:
                raw.append(
                    _RawTool(
                        name=self._tool_name(tool),
                        description=self._tool_description(tool),
                        schema=self._tool_schema(tool),
                        server_name=server,
                        priority=src.priority,
                    )
                )
        return raw

    def _sources_from_raw(self, raw: list[_RawTool]) -> list[ToolSource]:
        """把原始工具按 server 重新聚合成 ToolSource(供 resolve 复用)。"""
        grouped: dict[str, list[Any]] = {}
        priorities: dict[str, int] = {}
        for rt in raw:
            grouped.setdefault(rt.server_name, []).append(
                {
                    "name": rt.name,
                    "description": rt.description,
                    "inputSchema": rt.schema,
                }
            )
            # 记录并复用该 server 的优先级(schema 已归一化,可安全回灌)
            priorities[rt.server_name] = rt.priority
        return [
            ToolSource(
                server_name=srv,
                tools=tools,
                priority=priorities.get(srv, 0),
            )
            for srv, tools in grouped.items()
        ]

    @staticmethod
    def _tool_name(tool: Any) -> str:
        if isinstance(tool, dict):
            return str(tool.get("name", ""))
        return str(getattr(tool, "name", ""))

    @staticmethod
    def _tool_description(tool: Any) -> str:
        if isinstance(tool, dict):
            return str(tool.get("description", "") or "")
        return str(getattr(tool, "description", "") or "")

    @staticmethod
    def _tool_schema(tool: Any) -> dict[str, Any]:
        if isinstance(tool, dict):
            return tool.get("inputSchema") or tool.get("input_schema") or {}
        return dict(getattr(tool, "input_schema", None) or {})

    @staticmethod
    def _order_group(group: list[_RawTool]) -> list[_RawTool]:
        """按(priority desc, 描述长度 desc, 源顺序 asc)排序选择 primary。"""
        decorated = list(enumerate(group))
        decorated.sort(
            key=lambda ir: (-ir[1].priority, -len(ir[1].description), ir[0])
        )
        return [r for _, r in decorated]

    def _arbitrate(
        self,
        name: str,
        group: list[_RawTool],
        policy: str,
    ) -> tuple[list[PoolTool], list[PoolTool]]:
        if policy == POLICY_PREFIX:
            # 全部 namespaced,无仲裁无冲突标记
            return (
                [
                    self._entry(
                        rt,
                        key=f"{name}__{rt.server_name}",
                        collision=False,
                    )
                    for rt in group
                ],
                [],
            )
        if policy == POLICY_MERGE_MANIFEST:
            return self._arbitrate_merge_manifest(name, group)
        # first: 唯一 primary 保留裸 name
        ordered = self._order_group(group)
        winner = ordered[0]
        entries = [self._entry(winner, key=name, collision=False)]
        collided = [
            self._entry(
                rt,
                key=f"{name}__{rt.server_name}",
                collision=True,
                collision_group=name,
            )
            for rt in ordered[1:]
        ]
        entries.extend(collided)
        return entries, collided

    def _arbitrate_merge_manifest(
        self,
        name: str,
        group: list[_RawTool],
    ) -> tuple[list[PoolTool], list[PoolTool]]:
        # 按 (归一化 schema, 描述) 合并完全一致的重复定义
        by_sig: dict[tuple[Any, str], list[_RawTool]] = {}
        for rt in group:
            sig = (self._freeze(rt.schema), rt.description)
            by_sig.setdefault(sig, []).append(rt)

        entries: list[PoolTool] = []
        collided: list[PoolTool] = []
        if len(by_sig) == 1:
            # 全部一致 -> 合并为单条目,记录全部来源
            all_raw: list[_RawTool] = group
            entries.append(
                self._entry(
                    all_raw[0],
                    key=name,
                    collision=False,
                    sources=[r.server_name for r in all_raw],
                )
            )
            return entries, collided

        # 真正冲突 -> 全部保留并标记 collision,无裸 name primary
        for rt in group:
            collided.append(
                self._entry(
                    rt,
                    key=f"{name}__{rt.server_name}",
                    collision=True,
                    collision_group=name,
                )
            )
        return collided, collided

    @staticmethod
    def _freeze(obj: Any) -> Any:
        """把 dict/list 转为可哈希结构(用于签名合并)。"""
        if isinstance(obj, dict):
            return tuple(sorted((k, MCPSuperToolAggregator._freeze(v)) for k, v in obj.items()))
        if isinstance(obj, list):
            return tuple(obj)
        return obj

    def _entry(
        self,
        rt: _RawTool,
        *,
        key: str,
        collision: bool,
        collision_group: str | None = None,
        sources: list[str] | None = None,
    ) -> PoolTool:
        return PoolTool(
            key=key,
            name=rt.name,
            description=rt.description,
            schema=rt.schema,
            server_name=rt.server_name,
            collision=collision,
            collision_group=collision_group,
            sources=sources if sources is not None else [rt.server_name],
        )
