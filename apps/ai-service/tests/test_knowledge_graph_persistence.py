# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #76:知识图谱持久化的端到端回归。

看守的两件事,都不是"构造函数能跑"能证明的:

1. **重启真的能恢复** —— 每条恢复用例都构造两个先后独立的 store 实例(第二个实例
   与第一个不共享任何 Python 对象),再断言图数据逐字段等值。只测"new 出来不报错"
   等于什么都没测:那正是本票立项时 `InMemoryGraphStore` 一路绿灯的形态。
2. **落不了盘时必须喊** —— 目录不可用、快照损坏、写盘失败三型,各自断言
   (a) `persistence_status()` 里 `persistent is False` 或 `load_failed is True`,
   (b) ERROR 日志原文含 `MEMORY_DEGRADED_NOTICE`("当前为内存档、重启即失"),
   (c) 业务调用方**不**收到异常(那是运行时降级,不是 500)。
   缺任一条,就是"把没落盘伪装成已持久化"。

既有测试 `tests/test_knowledge_graph.py` 里的 `isinstance(graph_store, InMemoryGraphStore)`
**一条都没改**仍然通过 —— 因为持久档按定义就是它的子类(内存工作集 + 写穿快照)。
所以"是否真落盘"不能再用类型断言兼职,本文件用 `type(...) is FileGraphStore` 的严格
断言 + `persistent` 现读把这一格补上:子类哪天被悄悄降级成纯内存,这里立刻红。

临时件全部落 pytest `tmp_path`(由 pyproject 的 `--basetemp` 钉在仓库外的 NVMe 目录,
不走 `os.tmpdir()`,每用例独立目录,故第二次跑不依赖第一次留下的文件)。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import pytest

from app.services.knowledge_graph import (
    MEMORY_DEGRADED_NOTICE,
    FileGraphStore,
    GraphStore,
    InMemoryGraphStore,
    _create_graph_store,
)

_LOGGER_NAME = "app.services.knowledge_graph"


async def _seed_graph(store: GraphStore, owner: str) -> dict[str, Any]:
    """写入一份有代表性的小图:实体累加 + 关系累加 + doc_ids。

    故意包含"同一实体写两次(frequency 累加)"与"同一关系写两次(weight 累加)",
    因为这两个字段是纯累加态 —— 恢复时最容易丢的就是它们,只存 id/name 的用例
    测不出"写穿是否带上了运行时状态"。
    """
    e1 = await store.upsert_entity(owner, "OpenAI", "org", description="模型厂商", doc_id=7)
    await store.upsert_entity(owner, "OpenAI", "org", description="模型厂商", doc_id=8)
    e2 = await store.upsert_entity(owner, "GPT", "technology")
    await store.upsert_relation(owner, e1["id"], e2["id"], "created_by", description="自研")
    await store.upsert_relation(owner, e1["id"], e2["id"], "created_by", description="自研")
    other = await store.upsert_entity("someone-else", "无关实体", "concept")
    await store.upsert_relation(owner, e1["id"], other["id"], "related_to")
    return {"e1": e1, "e2": e2, "other": other}


def _normalize(graph: dict[str, Any]) -> dict[str, Any]:
    """把 get_graph 结果规范化成可比较的确定性结构(排序 + 统一 weight 类型)。

    两侧都过同一个函数再比,断言才只关心"内容是否一致",不关心 dict 遍历顺序。
    """
    return {
        "entities": sorted(
            (
                {
                    "id": int(e["id"]),
                    "owner_uuid": e["owner_uuid"],
                    "name": e["name"],
                    "type": e["type"],
                    "description": e["description"],
                    "frequency": int(e["frequency"]),
                    "doc_ids": [int(x) for x in e["doc_ids"]],
                }
                for e in graph["entities"]
            ),
            key=lambda x: x["id"],
        ),
        "relations": sorted(
            (
                {
                    "id": int(r["id"]),
                    "owner_uuid": r["owner_uuid"],
                    "source_entity_id": int(r["source_entity_id"]),
                    "target_entity_id": int(r["target_entity_id"]),
                    "relation_type": r["relation_type"],
                    "description": r["description"],
                    "weight": round(float(r["weight"]), 6),
                }
                for r in graph["relations"]
            ),
            key=lambda x: x["id"],
        ),
    }


# =============================================================================
# 1. 端到端恢复:写入 → 关闭 → 重新打开 → 读回一致
# =============================================================================


async def test_reopen_recovers_graph_field_by_field(tmp_path: Path) -> None:
    """真正的重启测试:换一个全新实例读同一份快照,逐字段等值。"""
    path = str(tmp_path / "kg.json")

    first = FileGraphStore(path)
    await _seed_graph(first, "owner-A")
    before = _normalize(await first.get_graph("owner-A"))
    assert before["entities"], "夹具本身得有数据,否则后面的相等是空对空"
    assert next(e for e in before["entities"] if e["name"] == "OpenAI")["frequency"] == 2
    status = first.persistence_status()
    assert status["persistent"] is True
    assert status["pending_unflushed"] is False
    await first.close()

    # —— "重启":新实例不共享任何对象,只共享磁盘上那份快照 ——
    second = FileGraphStore(path)
    after = _normalize(await second.get_graph("owner-A"))
    assert after == before, "重启后图数据必须逐字段等值(含 frequency/doc_ids/weight)"

    # 别人的数据不得串到本 owner 视图里(恢复路径也要带属主过滤)
    assert all(e["owner_uuid"] == "owner-A" for e in after["entities"])


async def test_reopen_recovers_other_owners_too(tmp_path: Path) -> None:
    """多属主必须一起恢复 —— 只回一个 owner 的快照等于半个库丢了。"""
    path = str(tmp_path / "multi.json")
    first = FileGraphStore(path)
    await first.upsert_entity("owner-A", "A实体", "person")
    await first.upsert_entity("owner-B", "B实体", "person")
    await first.close()

    second = FileGraphStore(path)
    assert [e["name"] for e in (await second.get_graph("owner-A"))["entities"]] == ["A实体"]
    assert [e["name"] for e in (await second.get_graph("owner-B"))["entities"]] == ["B实体"]


async def test_reopen_never_reuses_existing_entity_ids(tmp_path: Path) -> None:
    """重启后新增的 id 不得撞上已恢复数据的 id(撞了就张冠李戴接错边)。"""
    path = str(tmp_path / "ids.json")
    first = FileGraphStore(path)
    e1 = await first.upsert_entity("owner-A", "旧实体", "concept")
    await first.close()

    second = FileGraphStore(path)
    fresh = await second.upsert_entity("owner-A", "新实体", "concept")
    assert fresh["id"] != e1["id"]
    ids = [e["id"] for e in (await second.get_graph("owner-A"))["entities"]]
    assert len(ids) == len(set(ids)), f"id 出现重复: {ids}"


async def test_clear_is_persisted_across_reopen(tmp_path: Path) -> None:
    """删除也是状态:clear 后重启不得"复活"旧数据(否则删了个寂寞)。"""
    path = str(tmp_path / "clear.json")
    first = FileGraphStore(path)
    await first.upsert_entity("owner-A", "将删", "concept")
    await first.clear("owner-A")
    await first.close()

    second = FileGraphStore(path)
    assert (await second.get_graph("owner-A"))["entities"] == []


# =============================================================================
# 2. 默认后端切换:工厂行为
# =============================================================================


def test_default_backend_is_persistent_file_store(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """不设 KNOWLEDGE_GRAPH_STORE → 默认必须是落盘档,且严格类型(不是靠子类蒙)。"""
    monkeypatch.delenv("KNOWLEDGE_GRAPH_STORE", raising=False)
    monkeypatch.setenv("KNOWLEDGE_GRAPH_PATH", str(tmp_path / "default.json"))
    store = _create_graph_store()
    assert type(store) is FileGraphStore
    status = store.persistence_status()
    assert status["backend"] == "file"
    assert status["persistent"] is True
    assert status["notice"] is None


def test_explicit_memory_backend_announces_data_loss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """显式 memory 档:仍可工作,但必须自己承认重启即失(默认值已不是它)。"""
    monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "memory")
    store = _create_graph_store()
    assert type(store) is InMemoryGraphStore
    status = store.persistence_status()
    assert status["persistent"] is False
    assert status["notice"] == MEMORY_DEGRADED_NOTICE


def test_unknown_backend_falls_back_to_persistent_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """未知值 → 回落**默认(持久)档**,而不是回落内存:宁修错值不降安全性。"""
    monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "neo4j")
    monkeypatch.setenv("KNOWLEDGE_GRAPH_PATH", str(tmp_path / "unknown.json"))
    with caplog.at_level(logging.WARNING, logger=_LOGGER_NAME):
        store = _create_graph_store()
    assert type(store) is FileGraphStore
    assert store.persistence_status()["persistent"] is True
    assert "neo4j" in caplog.text


# =============================================================================
# 3. 失败态可诊断性(三型:目录不可用 / 快照损坏 / 写盘失败)
# =============================================================================


def test_unwritable_location_degrades_to_memory_and_shouts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """快照路径的父目录名被一个文件占住 → makedirs 必失败 → 回落内存并 ERROR 喊话。"""
    blocker = tmp_path / "not-a-dir"
    blocker.write_text("我占住了这个位置", encoding="utf-8")
    monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", "file")
    monkeypatch.setenv("KNOWLEDGE_GRAPH_PATH", str(blocker / "sub" / "kg.json"))

    with caplog.at_level(logging.ERROR, logger=_LOGGER_NAME):
        store = _create_graph_store()

    assert type(store) is InMemoryGraphStore, "落盘根本不可用时必须回落到内存档"
    assert store.persistence_status()["persistent"] is False
    assert MEMORY_DEGRADED_NOTICE in caplog.text, "回落必须喊出来,不能静默"
    # 回落后读写仍可用(可用性优先),只是不再持久
    assert store.persistence_status()["backend"] == "memory"


async def test_corrupt_snapshot_is_reported_not_swallowed(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """半截/损坏 JSON:必须 load_failed + 留 error + 喊话,不得读成"没有数据"。"""
    path = tmp_path / "broken.json"
    path.write_text('{"version": 1, "entities": [', encoding="utf-8")

    with caplog.at_level(logging.ERROR, logger=_LOGGER_NAME):
        store = FileGraphStore(str(path))

    status = store.persistence_status()
    assert status["load_failed"] is True
    assert isinstance(status["error"], str) and status["error"]
    assert MEMORY_DEGRADED_NOTICE in caplog.text
    assert (await store.get_graph("owner-A"))["entities"] == []

    # 损坏快照必须能被新数据顶掉(否则这个文件永久毒化整个库)
    await store.upsert_entity("owner-A", "重建", "concept")
    assert path.exists()
    reopened = FileGraphStore(str(path))
    assert reopened.persistence_status()["load_failed"] is False
    assert [e["name"] for e in (await reopened.get_graph("owner-A"))["entities"]] == ["重建"]


async def test_wrong_snapshot_version_is_treated_as_corrupt(tmp_path: Path) -> None:
    """版本不认识的快照按损坏处置 —— 结构变了就猜字段,是数据损坏的第二种写法。"""
    path = tmp_path / "future.json"
    path.write_text(
        json.dumps({"version": 999, "entities": [], "relations": []}), encoding="utf-8"
    )
    store = FileGraphStore(str(path))
    assert store.persistence_status()["load_failed"] is True


async def test_write_failure_keeps_service_alive_and_reports(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """写盘失败:业务调用方拿到正常结果,但状态必须立刻变成"没落盘"并喊话。

    打的是**类**上的方法而不是实例属性:实例属性不会走描述符协议,`self` 会被当成
    第一个实参吃掉,测出来的"失败"其实是 TypeError —— 判据自己得先是真的。
    """
    original = FileGraphStore._write_snapshot_sync
    failing = {"on": True}

    def _maybe_boom(self: FileGraphStore, snapshot: dict[str, Any]) -> None:
        if failing["on"]:
            raise OSError(28, "No space left on device")
        original(self, snapshot)

    monkeypatch.setattr(FileGraphStore, "_write_snapshot_sync", _maybe_boom)
    store = FileGraphStore(str(tmp_path / "wfail.json"))

    with caplog.at_level(logging.ERROR, logger=_LOGGER_NAME):
        entity = await store.upsert_entity("owner-A", "还在内存里", "concept")

    assert entity["name"] == "还在内存里", "持久化降级不得把请求打成异常"
    status = store.persistence_status()
    assert status["persistent"] is False
    assert status["pending_unflushed"] is True, "脏数据没落盘必须如实标出来"
    assert "No space left" in str(status["error"])
    assert MEMORY_DEGRADED_NOTICE in caplog.text

    # 磁盘恢复后下一次写入要翻回 persistent=True(不能一次失败永久喊哑)
    failing["on"] = False
    await store.upsert_entity("owner-A", "第二次写入", "concept")
    after = store.persistence_status()
    assert after["persistent"] is True
    assert after["error"] is None
    assert after["pending_unflushed"] is False
    reopened = FileGraphStore(store.path)
    assert {e["name"] for e in (await reopened.get_graph("owner-A"))["entities"]} == {
        "还在内存里",
        "第二次写入",
    }


async def test_failed_write_really_is_not_on_disk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """反向确认:写盘失败时磁盘上确实没有该数据(证明"没落盘"那句不是说谎)。

    用 monkeypatch 而不是手工 setattr/del —— 打的是类属性,手工 del 会把**原本**
    那份实现一起删掉,同文件的后续用例就拿不到写盘方法了(本仓最高频的用例间污染
    形态:上一个用例改坏类状态,下一个用例红得莫名其妙)。
    """
    path = tmp_path / "absent.json"

    def _boom(self: FileGraphStore, snapshot: dict[str, Any]) -> None:
        raise OSError(13, "Permission denied")

    monkeypatch.setattr(FileGraphStore, "_write_snapshot_sync", _boom)
    store = FileGraphStore(str(path))
    await store.upsert_entity("owner-A", "只在内存", "concept")

    assert not path.exists()
    assert store.persistence_status()["persistent"] is False
    # 反证:撤掉故障注入后同一份数据立刻能落盘(说明"没落盘"确实是写失败造成的)
    monkeypatch.undo()
    await store.upsert_entity("owner-A", "注入撤销后", "concept")
    assert path.exists()
    assert store.persistence_status()["persistent"] is True


# =============================================================================
# 4. 全局单例的契约:任何一档都必须能回答持久化状态
# =============================================================================


def test_global_singleton_reports_persistence_honestly() -> None:
    """`from ...knowledge_graph import graph_store` 的所有调用方都不该 hasattr 猜。"""
    from app.services.knowledge_graph import graph_store

    status = graph_store.persistence_status()
    assert status["backend"] in {"file", "memory", "drizzle"}
    assert isinstance(status["persistent"], bool)
    # 口径一致性:非持久档必须带告警原话,持久档不得带(反过来也是说谎)
    if status["persistent"]:
        assert status["notice"] is None
    else:
        assert status["notice"] == MEMORY_DEGRADED_NOTICE


async def test_protocol_surface_is_met_by_file_store(tmp_path: Path) -> None:
    """持久档必须实现 Protocol 的每个方法(签名漂了上层 await 才炸,太晚)。"""
    store: GraphStore = FileGraphStore(str(tmp_path / "proto.json"))
    entity = await store.upsert_entity("owner-A", "实体", "concept", "描述", 3)
    relation = await store.upsert_relation("owner-A", entity["id"], entity["id"], "related_to")
    graph = await store.get_graph("owner-A")
    assert len(graph["entities"]) == 1 and relation["id"]
    await store.clear("owner-A")
    assert (await store.get_graph("owner-A"))["entities"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
