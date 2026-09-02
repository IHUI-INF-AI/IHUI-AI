# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""context_recall 回捞层测试(独立文件,不触碰并行会话脏文件)。

覆盖:
- snapshot 写入后 recall 命中(同文本语义匹配)
- 无结果时 ok=True + 空 results
- session 过滤
- embed / 写盘异常降级不抛(返回安全值)
- plan_mode.READONLY_TOOLS 含 context_recall

使用隔离的 VectorMemoryStore 实例(自定义 persist_path 落临时目录),不污染全局单例。
"""

from __future__ import annotations

import sys
from pathlib import Path

# 允许从仓库根以 `pytest tests/...` 或包内 `pytest` 两种方式运行(对齐现有测试布局)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.context_recall import ContextRecallService  # noqa: E402
from app.services.plan_mode import READONLY_TOOLS  # noqa: E402
from app.services.vector_memory import VectorMemoryStore, _hash_embedding  # noqa: E402


def _make_isolated_service(tmp_path: Path) -> ContextRecallService:
    """构造隔离 VectorMemoryStore + 确定性 hash embed(避免网络调用,测试可复现)。"""
    persist = str(tmp_path / "vector_memory.json")
    store = VectorMemoryStore(persist_path=persist)

    async def _deterministic_embed(text: str, model: str | None = None) -> list[float]:
        return _hash_embedding(text)

    # 替换实例方法为确定性 hash embed(不触发 llm_gateway 远程调用)
    store.embed = _deterministic_embed  # type: ignore[method-assign]
    return ContextRecallService(store=store)


async def test_snapshot_then_recall_hit(tmp_path: Path) -> None:
    """snapshot 写入后,用原文回捞命中且字段完整。

    说明:隔离测试用确定性 hash embed(无远程调用),hash 伪向量对相同文本 sim=1.0、
    不同文本近似正交,故以原文作 query 验证回捞链路(语义相关性由生产环境真实 embedding 保证)。
    """
    svc = _make_isolated_service(tmp_path)
    msg_user = "如何配置 IHUI 的上下文压缩阈值?"
    msg_asst = "在 LLMCompleteRequest 中设置 context_limit 即可。"
    removed = [
        {"role": "user", "content": msg_user},
        {"role": "assistant", "content": msg_asst},
    ]
    written = await svc.snapshot_compacted(
        session_id="sess-1", user_id="u-1", removed_messages=removed, summary="摘要文本"
    )
    assert written == 2

    result = await svc.recall(session_id="sess-1", query=msg_user, top_k=8)
    assert result.get("ok") is True
    results = result["results"]
    assert len(results) >= 1
    first = results[0]
    assert first["session_id"] == "sess-1"
    assert first["original_role"] == "user"
    assert first["similarity"] >= 0.7
    assert first["text"] == msg_user


async def test_recall_empty_when_no_match(tmp_path: Path) -> None:
    """无相关结果时返回 ok=True 且 results 为空(不报错)。"""
    svc = _make_isolated_service(tmp_path)
    await svc.snapshot_compacted(
        session_id="sess-2",
        user_id="u-2",
        removed_messages=[{"role": "user", "content": "今天天气真好"}],
    )
    result = await svc.recall(session_id="sess-2", query="量子计算拓扑纠错码综述", top_k=8)
    assert result.get("ok") is True
    assert result["results"] == []


async def test_recall_session_filter(tmp_path: Path) -> None:
    """session_id 过滤:只回捞目标会话的快照。"""
    svc = _make_isolated_service(tmp_path)
    msg_a = "会话 A 的私密内容"
    msg_b = "会话 B 的私密内容"
    await svc.snapshot_compacted(
        session_id="sess-a", user_id="u", removed_messages=[{"role": "user", "content": msg_a}],
    )
    await svc.snapshot_compacted(
        session_id="sess-b", user_id="u", removed_messages=[{"role": "user", "content": msg_b}],
    )
    # 用 sess-a 原文查询:全库命中且包含 sess-a;限定 sess-a 命中 1 条,sess-b 为 0
    all_res = await svc.recall(session_id=None, query=msg_a, top_k=8)
    assert len(all_res["results"]) >= 1
    assert any(r["session_id"] == "sess-a" for r in all_res["results"])
    a_res = await svc.recall(session_id="sess-a", query=msg_a, top_k=8)
    assert len(a_res["results"]) == 1
    assert a_res["results"][0]["session_id"] == "sess-a"
    b_res = await svc.recall(session_id="sess-b", query=msg_a, top_k=8)
    assert b_res["results"] == []


async def test_snapshot_empty_noop(tmp_path: Path) -> None:
    """removed 为空时 snapshot 返回 0,不写入、不抛。"""
    svc = _make_isolated_service(tmp_path)
    assert await svc.snapshot_compacted(session_id="x", user_id=None, removed_messages=[]) == 0
    assert len(svc._store) == 0


async def test_recall_empty_query_ok(tmp_path: Path) -> None:
    """空 query 直接返回 ok + 空 results,不触发 embed。"""
    svc = _make_isolated_service(tmp_path)
    result = await svc.recall(session_id=None, query="   ", top_k=8)
    assert result.get("ok") is True
    assert result["results"] == []


async def test_snapshot_embed_failure_degrade(tmp_path: Path) -> None:
    """embed 抛异常时 snapshot 降级不抛,返回已写入条数(此处 0)。"""
    svc = _make_isolated_service(tmp_path)

    async def _boom(text: str, model: str | None = None) -> list[float]:
        raise RuntimeError("embed down")

    svc._store.embed = _boom  # type: ignore[method-assign]
    # 不应抛出
    written = await svc.snapshot_compacted(
        session_id="sess-err", user_id="u", removed_messages=[{"role": "user", "content": "x"}]
    )
    assert isinstance(written, int)
    assert written == 0


async def test_snapshot_add_entry_failure_degrade(tmp_path: Path) -> None:
    """写盘(add_entry)抛异常时 snapshot 降级不抛,返回已写入条数。"""
    svc = _make_isolated_service(tmp_path)

    async def _add_entry_boom(entry_id: str, entry: dict, embedding: list[float]) -> None:
        raise RuntimeError("disk down")

    svc._store.add_entry = _add_entry_boom  # type: ignore[method-assign]
    # 第一条会因 add_entry 失败而降级,整体不抛
    written = await svc.snapshot_compacted(
        session_id="sess-err2",
        user_id="u",
        removed_messages=[
            {"role": "user", "content": "a"},
            {"role": "assistant", "content": "b"},
        ],
    )
    assert isinstance(written, int)


async def test_recall_embed_failure_degrade(tmp_path: Path) -> None:
    """recall 时 embed 抛异常返回 ok=False + error,不向上抛。"""
    svc = _make_isolated_service(tmp_path)

    async def _boom(text: str, model: str | None = None) -> list[float]:
        raise RuntimeError("embed down")

    svc._store.embed = _boom  # type: ignore[method-assign]
    result = await svc.recall(session_id=None, query="任意", top_k=8)
    assert result.get("ok") is False
    assert "error" in result


def test_readonly_tools_include_context_recall() -> None:
    """plan_mode 只读白名单应包含 context_recall(只读检索工具)。"""
    assert "context_recall" in READONLY_TOOLS
