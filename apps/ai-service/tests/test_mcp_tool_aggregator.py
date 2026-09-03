# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""mcp_tool_aggregator.py 单元测试: MCPSuperToolAggregator 超级工具池。

覆盖:去重/冲突仲裁三策略(first/prefix/merge_manifest)、同名冲突、schema
归一化、manifest、total/unique/collisions 统计、call_forward 路由与异常
冒泡、空/单 server 边界、by_server 元数据。全部为离线条(注入 tool_sources),
不触碰真实 MCP Server。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.mcp_client import MCPClientTool
from app.services.mcp_tool_aggregator import (
    POLICY_FIRST,
    POLICY_MERGE_MANIFEST,
    POLICY_PREFIX,
    MCPSuperToolAggregator,
    ToolSource,
)

# =============================================================================
# 辅助
# =============================================================================

def _tool(name: str, desc: str = "", schema: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "description": desc,
        "inputSchema": schema if schema is not None else {"type": "object"},
    }


def _src(server: str, tools: list[Any], priority: int = 0) -> ToolSource:
    return ToolSource(server_name=server, tools=tools, priority=priority)


def _schema(type_: str | None = "object", props: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"type": type_, "properties": props}


# =============================================================================
# 空 / 单 server / 跨不同名 边界
# =============================================================================

def test_build_empty_sources():
    """空输入: total=0, unique=0, by_server/collisions/meta 空。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([])
    assert pool.total_tools == 0
    assert pool.unique_tools == 0
    assert pool.tools == []
    assert pool.by_server == {}
    assert pool.collisions == {}
    assert pool.meta["policy"] == POLICY_FIRST


def test_build_single_server():
    """单 server: total==unique, 无冲突, by_server 正确。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [_src("svrA", [_tool("t1", "desc1"), _tool("t2", "desc2")])]
    )
    assert pool.total_tools == 2
    assert pool.unique_tools == 2
    assert pool.collisions == {}
    assert sorted(pt.key for pt in pool.tools) == ["t1", "t2"]
    assert pool.by_server["svrA"][0].name == "t1"
    assert pool.by_server["svrA"][1].name == "t2"


def test_build_different_names_no_conflict():
    """跨 server 不同名工具绝不冲突,全部保留,unique==total。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("alpha"), _tool("beta")]),
            _src("svrB", [_tool("gamma")]),
        ]
    )
    assert pool.total_tools == 3
    assert pool.unique_tools == 3
    assert pool.collisions == {}
    keys = {pt.key for pt in pool.tools}
    assert keys == {"alpha", "beta", "gamma"}


# =============================================================================
# 冲突仲裁: first / prefix / merge_manifest
# =============================================================================

def test_first_policy_longer_description_wins():
    """first: 同 name 多 server,描述更长者胜出为 primary(裸 name),其余冲突标记。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("chat", "short")]),
            _src("svrB", [_tool("chat", "a much longer and more specific description")]),
        ]
    )
    by_key = {pt.key: pt for pt in pool.tools}
    # 胜者保留裸 name,来源为描述更长的 svrB
    assert "chat" in by_key
    assert by_key["chat"].server_name == "svrB"
    assert by_key["chat"].collision is False
    # 失败者 namespaced 区分并标记 collision
    loser = by_key.get("chat__svrA")
    assert loser is not None
    assert loser.collision is True
    assert loser.collision_group == "chat"
    # 统计: total=2, unique=2(全保留), 冲突 1
    assert pool.total_tools == 2
    assert pool.unique_tools == 2
    assert pool.meta["collision_entry_count"] == 1
    assert pool.meta["collision_group_count"] == 1


def test_first_policy_explicit_priority_wins():
    """first: 显式 priority 高于描述长度,高优先级者胜出。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            # svrA 描述更长但 priority 低
            _src("svrA", [_tool("chat", "very long description but low priority")], priority=0),
            # svrB 描述短但 priority 高
            _src("svrB", [_tool("chat", "short")], priority=10),
        ]
    )
    by_key = {pt.key: pt for pt in pool.tools}
    assert by_key["chat"].server_name == "svrB"
    assert by_key["chat__svrA"].collision is True


def test_prefix_policy_all_namespaced():
    """prefix: 冲突组各工具 key 为 `{name}__{server}` 无 winner,唯一工具保留裸名,
    全池无 collision 标记。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("chat", "a")]),
            _src("svrB", [_tool("chat", "b")]),
            _src("svrB", [_tool("unique")]),
        ],
        collision_policy=POLICY_PREFIX,
    )
    assert pool.total_tools == 3
    assert pool.unique_tools == 3  # 全保留
    assert pool.collisions == {}  # 无冲突标记
    keys = sorted(pt.key for pt in pool.tools)
    assert keys == ["chat__svrA", "chat__svrB", "unique"]
    assert all(pt.collision is False for pt in pool.tools)


def test_merge_manifest_merges_identical():
    """merge_manifest: 完全一致的重复(schema+描述)合并为单条目,记录多来源。"""
    schema = {"type": "object", "properties": {"q": {"type": "string"}}}
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("lookup", "find things", schema)]),
            _src("svrB", [_tool("lookup", "find things", schema)]),
        ],
        collision_policy=POLICY_MERGE_MANIFEST,
    )
    assert pool.unique_tools == 1  # 合并
    assert pool.total_tools == 2
    entry = pool.tools[0]
    assert entry.key == "lookup"
    assert entry.collision is False
    assert sorted(entry.sources) == ["svrA", "svrB"]
    assert pool.collisions == {}


def test_merge_manifest_keeps_conflicting():
    """merge_manifest: schema 真正冲突者全部保留并标记 collision,无裸 name primary。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("run", "x", {"type": "object", "properties": {"a": {}}})]),
            _src("svrB", [_tool("run", "y", {"type": "object", "properties": {"b": {}}})]),
        ],
        collision_policy=POLICY_MERGE_MANIFEST,
    )
    assert pool.unique_tools == 2
    keys = sorted(pt.key for pt in pool.tools)
    assert keys == ["run__svrA", "run__svrB"]
    assert all(pt.collision is True for pt in pool.tools)
    assert pool.meta["collision_group_count"] == 1


def test_resolve_rearbitrates_policy():
    """resolve(): 基于同批原始输入,从 first 切换为 prefix 后 key 全变 namespaced。"""
    agg = MCPSuperToolAggregator()
    sources = [
        _src("svrA", [_tool("chat", "a"), _tool("t1")]),
        _src("svrB", [_tool("chat", "bbbb")]),
    ]
    pool_first = agg.build(sources)
    pool_prefix = agg.resolve(pool_first, POLICY_PREFIX)
    assert pool_prefix.meta["policy"] == POLICY_PREFIX
    assert pool_prefix.unique_tools == 3
    keys = sorted(pt.key for pt in pool_prefix.tools)
    assert keys == ["chat__svrA", "chat__svrB", "t1"]


def test_build_unknown_policy_raises():
    """未知 collision_policy 抛 ValueError。"""
    agg = MCPSuperToolAggregator()
    with pytest.raises(ValueError):
        agg.build([_src("svrA", [_tool("t")])], collision_policy="bogus")


def test_build_empty_server_name_raises():
    """server_name 为空抛 ValueError。"""
    agg = MCPSuperToolAggregator()
    with pytest.raises(ValueError):
        agg.build([_src("", [_tool("t")])])


# =============================================================================
# schema 归一化
# =============================================================================

def test_normalize_schema_fills_defaults():
    """归一化: 缺失 type/properties/required/description 时给默认并计数。"""
    agg = MCPSuperToolAggregator()
    stats = {
        "missing_description": 0,
        "missing_type": 0,
        "missing_properties": 0,
        "missing_required": 0,
    }
    norm = agg.normalize_schema({}, description="fallback", stats=stats)
    assert norm["type"] == "object"
    assert norm["properties"] == {}
    assert norm["required"] == []
    assert norm["description"] == "fallback"
    assert stats["missing_type"] == 1
    assert stats["missing_properties"] == 1
    assert stats["missing_required"] == 1
    assert stats["missing_description"] == 1


def test_normalize_schema_preserves_existing():
    """归一化: 已有合法字段原样保留,不覆盖计数。"""
    agg = MCPSuperToolAggregator()
    schema = {
        "type": "object",
        "properties": {"x": {"type": "string"}},
        "required": ["x"],
        "description": "keeper",
    }
    norm = agg.normalize_schema(schema)
    assert norm == schema
    stats = {
        "missing_description": 0,
        "missing_type": 0,
        "missing_properties": 0,
        "missing_required": 0,
    }
    agg.normalize_schema(schema, stats=stats)
    assert stats == {
        "missing_description": 0,
        "missing_type": 0,
        "missing_properties": 0,
        "missing_required": 0,
    }


def test_build_schema_normalization_stats_in_meta():
    """build 产物的 meta.schema_normalization 反映缺失字段计数。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("bare", "", {"type": "object"})])])
    stats = pool.meta["schema_normalization"]
    # {"type":"object"} 缺 properties/required; description 回退为空串
    assert stats["missing_properties"] == 1
    assert stats["missing_required"] == 1
    assert pool.tools[0].schema["properties"] == {}
    assert pool.tools[0].schema["required"] == []


# =============================================================================
# manifest
# =============================================================================

def test_manifest_fields_complete_and_keys_unique():
    """manifest: 字段完整,key 全池唯一,含 schema 摘要与冲突标记。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("t", "a longer tool description",
                               _schema("object", {"p": {}}))]),
            _src("svrB", [_tool("t", "x")]),
        ]
    )
    manifest = agg.manifest(pool)
    assert len(manifest) == 2
    keys = [m["key"] for m in manifest]
    assert len(keys) == len(set(keys))  # 唯一
    # first 策略:描述更长的 svrA 胜出为裸 name(manifest[0] 按 build 顺序)
    m0 = manifest[0]
    for field in ("key", "name", "description", "server_name", "sources",
                  "collision", "collision_group", "schema"):
        assert field in m0
    assert m0["key"] == "t"
    assert m0["server_name"] == "svrA"
    assert m0["collision"] is False
    assert m0["schema"]["required"] == []
    assert m0["schema"]["property_count"] == 1
    assert m0["schema"]["type"] == "object"
    # 冲突条目在 manifest 中带标记
    collided = next(m for m in manifest if m["collision"])
    assert collided["collision_group"] == "t"


def test_manifest_merged_entry_sources():
    """manifest: merge_manifest 合并条目的 sources 含全部来源 server。"""
    schema = _schema("object", {"q": {}})
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [_src("svrA", [_tool("dup", "same", schema)]),
         _src("svrB", [_tool("dup", "same", schema)])],
        collision_policy=POLICY_MERGE_MANIFEST,
    )
    manifest = agg.manifest(pool)
    assert len(manifest) == 1
    assert sorted(manifest[0]["sources"]) == ["svrA", "svrB"]


# =============================================================================
# total / unique / collisions 统计
# =============================================================================

def test_pool_stats_counts():
    """去重统计: 混合同名冲突与唯一工具下 total/unique/collisions 正确。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("dup"), _tool("solo")]),
            _src("svrB", [_tool("dup")]),
        ]
    )
    # raw: dup x2, solo x1 -> total 3
    assert pool.total_tools == 3
    # 全保留: unique == 3(first 不丢弃,只重命名冲突)
    assert pool.unique_tools == 3
    assert "dup" in pool.collisions
    assert len(pool.collisions["dup"]) == 1
    assert pool.meta["collision_group_count"] == 1


def test_pool_lookup():
    """lookup 按 key 返回条目,未知 key 返回 None。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("alpha"), _tool("beta")])])
    assert pool.lookup("alpha").server_name == "svrA"
    assert pool.lookup("nope") is None


# =============================================================================
# by_server 元数据
# =============================================================================

def test_by_server_groups_entries():
    """by_server: 每个 server 下的工具条目聚合正确。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("a1"), _tool("a2")]),
            _src("svrB", [_tool("b1")]),
        ]
    )
    assert len(pool.by_server["svrA"]) == 2
    assert len(pool.by_server["svrB"]) == 1
    assert {pt.name for pt in pool.by_server["svrA"]} == {"a1", "a2"}
    assert pool.by_server["svrB"][0].name == "b1"


def test_by_server_reflected_in_manifest_and_collisions():
    """by_server: 冲突条目也计入对应 server,且 peer 同归于其来源 server 分组。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("chat", "loooooong")]),
            _src("svrB", [_tool("chat", "x")]),
        ]
    )
    server_b_names = {pt.name for pt in pool.by_server["svrB"]}
    assert "chat" in server_b_names
    # collisions 字典按原始 name 分组
    assert "chat" in pool.collisions
    assert len(pool.collisions["chat"]) == 1


# =============================================================================
# call_forward 路由与异常
# =============================================================================

@pytest.mark.asyncio
async def test_call_forward_routes_to_correct_server():
    """call_forward: 按 key 路由到正确 server,invoke_fn 收到 (server, name, args)。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])
    calls: list[tuple[str, str, dict]] = []

    async def invoke(server: str, name: str, args: dict) -> Any:
        calls.append((server, name, args))
        return {"content": [{"type": "text", "text": "ok"}]}

    result = await agg.call_forward(pool, "t1", {"x": 1}, invoke_fn=invoke)
    assert result == {"content": [{"type": "text", "text": "ok"}]}
    assert calls == [("svrA", "t1", {"x": 1})]


@pytest.mark.asyncio
async def test_call_forward_to_collision_namespaced_key():
    """call_forward: 冲突条目用 namespaced key 路由到其来源 server 的原始工具名。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("svrA", [_tool("chat", "loooooong")]),
            _src("svrB", [_tool("chat", "x")]),
        ]
    )
    seen: list[tuple[str, str]] = []

    async def invoke(server: str, name: str, args: dict) -> Any:
        seen.append((server, name))
        return {"ok": True}

    await agg.call_forward(pool, "chat__svrB", {}, invoke_fn=invoke)
    assert seen == [("svrB", "chat")]


@pytest.mark.asyncio
async def test_call_forward_via_clients():
    """call_forward: 使用 clients 映射(真网形态)转发到对应 MCPClient。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])
    captured = {}

    class FakeClient:
        async def call_tool(self, name, args):
            captured["name"] = name
            captured["args"] = args
            return {"ok": True}

    result = await agg.call_forward(pool, "t1", {"y": 2}, clients={"svrA": FakeClient()})
    assert result == {"ok": True}
    assert captured == {"name": "t1", "args": {"y": 2}}


@pytest.mark.asyncio
async def test_call_forward_unknown_key_raises():
    """call_forward: 未知 key 抛 KeyError。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])
    with pytest.raises(KeyError):
        await agg.call_forward(pool, "missing", {})


@pytest.mark.asyncio
async def test_call_forward_invoke_fn_exception_propagates():
    """call_forward: invoke_fn 的异常原样冒泡。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])

    async def boom(*_args, **_kwargs):
        raise ConnectionError("server gone")

    with pytest.raises(ConnectionError, match="server gone"):
        await agg.call_forward(pool, "t1", {}, invoke_fn=boom)


@pytest.mark.asyncio
async def test_call_forward_no_invoker_raises():
    """call_forward: 既无 invoke_fn 也无 clients 时抛 RuntimeError。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])
    with pytest.raises(RuntimeError):
        await agg.call_forward(pool, "t1", {})


@pytest.mark.asyncio
async def test_call_forward_missing_server_in_clients_raises():
    """call_forward: clients 缺对应 server 时抛 KeyError。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build([_src("svrA", [_tool("t1")])])
    with pytest.raises(KeyError):
        await agg.call_forward(pool, "t1", {}, clients={})


# =============================================================================
# 输入形态兼容(MCPClientTool)
# =============================================================================

def test_accepts_mcpclienttool_objects():
    """build: 支持 MCPClientTool 形对象(与 mcp_client.list_tools 输出互操作)。"""
    agg = MCPSuperToolAggregator()
    tools = [
        MCPClientTool(
            name="native_tool",
            description="native",
            input_schema={"type": "object", "properties": {"z": {}}},
            server_name="svrA",
        )
    ]
    pool = agg.build([_src("svrA", tools)])
    assert pool.total_tools == 1
    assert pool.unique_tools == 1
    assert pool.tools[0].name == "native_tool"
    assert pool.tools[0].schema["type"] == "object"


def test_supports_dict_with_input_schema_alias():
    """build: 兼容 input_schema(下划线)别名键。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [_src("svrA", [{"name": "x", "description": "d", "input_schema": {"type": "object"}}])]
    )
    assert pool.unique_tools == 1
    assert pool.tools[0].schema["type"] == "object"


@pytest.mark.asyncio
async def test_async_manifest_gathering_roundtrip():
    """端到端: 构建多 server 池,manifest 全量 key 可被 call_forward 命中路由。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            _src("s1", [_tool("alpha"), _tool("chat", "long desc here")]),
            _src("s2", [_tool("beta"), _tool("chat", "x")]),
        ]
    )
    manifest = agg.manifest(pool)
    keys = [m["key"] for m in manifest]
    assert len(keys) == len(set(keys))
    routed = []

    async def invoke(server, name, args):
        routed.append((server, name))
        return {"ok": True}

    for k in keys:
        await agg.call_forward(pool, k, {}, invoke_fn=invoke)
    assert len(routed) == len(keys)
    # 冲突胜者 chat 来源 s1(描述更长),败者 chat__s2 来源 s2
    chat_winner = next(m for m in manifest if m["key"] == "chat")
    assert chat_winner["server_name"] == "s1"
    assert next(m for m in manifest if m["key"] == "chat__s2")["server_name"] == "s2"
