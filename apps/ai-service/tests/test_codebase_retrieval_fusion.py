# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""内部票 #10 验收:search_codebase 双腿并跑 + RRF 融合 + 降级具名出声。

对照的是 `scripts/check-retrieval-quality.mjs` 量出的两型缺陷:
  - shape=serial-fallback(一腿有结果即 return,另一腿是回落位,零融合)
  - verdict=silent-degrade(异常分支连载体都不赋值,只剩一句 debug 日志)

本文件钉的是**行为与副作用**,不是文案:
  ① 两条腿各被调用一次(数调用次数,并证明两条腿真的重叠而非串行 await 两次);
  ② 融合真的发生(rrf_fuse 被调用一次、k 走 resolve_rrf_k 单源、名次既不等于
     向量腿原序也不等于关键词腿原序);
  ③ 一腿抛/超时 ⇒ mode 具名,且返回体里点名是哪条腿坏了(异常内容进返回体);
  ④ 两腿皆空 ⇒ empty;一腿取不到 + 另一腿空 ⇒ unjudged,**不得**冒 rrf-fusion;
  ⑤ 身份/出域轴一字未松:__user_id 只认服务端注入,关掉语义腿就真的不发查询。

隔离口径(AGENTS §5):PG 8810 / Redis 8811 一律不碰 —— 语义腿与懒索引全部走
替身(AsyncMock / monkeypatch),用例体内没有任何真实建索引或 embedding 调用。
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import mcp_server
from app.services import reranker as reranker_module
from app.services.mcp_server import _tool_search_codebase

_QUERY = "alpha_symbol_zz"


def _semantic_item(file_path: str, line: int, *, score: float = 0.5) -> dict[str, Any]:
    """构造一枚 codebase_indexer.search 的返回条目(形状取自生产消费方)。"""
    return {
        "filePath": file_path,
        "lineStart": line,
        "symbolType": "function",
        "symbolName": f"sym_at_{line}",
        "content": f"def sym_at_{line}():\n    return {line}",
        "score": score,
    }


def _install_fake_indexer(
    monkeypatch: pytest.MonkeyPatch,
    results: list[dict[str, Any]] | Exception,
) -> SimpleNamespace:
    """把语义腿的两个外呼点(检索 / 建索引)换成替身,并计数。

    `results` 是异常对象时,`search` 直接抛 —— 用来量"一腿取不到"那一档。
    """
    if isinstance(results, Exception):
        search = AsyncMock(side_effect=results)
    else:
        search = AsyncMock(return_value=results)
    fake = SimpleNamespace(
        search=search,
        index_repository=AsyncMock(return_value={"indexed": 0, "skipped": 0}),
        _collect_code_files=lambda _root: [],
    )
    monkeypatch.setattr("app.services.codebase_indexer.codebase_indexer", fake)
    # 懒索引会读真实同意台账与冷却表;本文件只验装配层,一律短路成"没建,空结果"。
    monkeypatch.setattr(
        mcp_server,
        "_lazy_index_and_research",
        AsyncMock(return_value=_lazy_outcome()),
    )
    return fake


def _lazy_outcome() -> Any:
    """一枚"这轮没建索引、也没搜到"的懒索引结论(用生产数据结构,不造第二份形状)。"""
    return mcp_server.LazyIndexOutcome(
        results=[],
        status="skipped-test",
        reason="测试替身:不建索引、不出域",
    )


def _one_file_repo(tmp_path: Path) -> Path:
    """关键词腿的确定性夹具:一个文件、一行命中 ⇒ 该腿恰好返回 1 枚匹配。"""
    (tmp_path / "alpha.py").write_text(
        f"def {_QUERY}():\n    return 1\n",
        encoding="utf-8",
    )
    return tmp_path


# ---------------------------------------------------------------------------
# ① 双腿各跑一次,而且真的并发
# ---------------------------------------------------------------------------


async def test_both_legs_run_exactly_once_and_overlap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """语义腿与关键词腿各一次,且两条腿的执行区间**重叠**(串行 await 两次会翻红)。

    并发不是靠"返回体里有两类结果"看出来的:语义腿被卡在一只事件上,
    只有当关键词腿真的已经在跑时,那只事件才会被 `_git_check_ignore` 的探针置位。
    """
    root = _one_file_repo(tmp_path)
    vec_hits = 0
    kw_probes = 0
    release = asyncio.Event()

    async def _blocked_search(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        nonlocal vec_hits
        vec_hits += 1
        # 等关键词腿把它放行;若装配层是"先 await 语义腿",这里必然超时。
        try:
            await asyncio.wait_for(release.wait(), timeout=2.0)
        except TimeoutError as exc:  # pragma: no cover - 失败路径留给断言
            raise RuntimeError(f"关键词腿从未启动,两腿实为串行: {exc}") from exc
        return [_semantic_item("beta.py", 1)]

    monkeypatch.setattr("app.services.codebase_indexer.codebase_indexer", SimpleNamespace(
        search=_blocked_search,
        index_repository=AsyncMock(),
    ))
    monkeypatch.setattr(
        mcp_server,
        "_lazy_index_and_research",
        AsyncMock(return_value=_lazy_outcome()),
    )

    def _spy_check_ignore(_root: Any, _paths: Any) -> set[str]:
        nonlocal kw_probes
        kw_probes += 1
        release.set()
        return set()

    monkeypatch.setattr(mcp_server, "_git_check_ignore", _spy_check_ignore)

    out = await asyncio.wait_for(
        _tool_search_codebase({"query": _QUERY, "path": str(root)}), timeout=10
    )

    assert vec_hits == 1, f"语义腿调用次数应为 1,实得 {vec_hits}"
    assert kw_probes >= 1, "关键词腿没跑(旧形态里它是被前一条腿 return 掉的)"
    assert out["mode"] == "rrf-fusion", f"两腿都给了结果却报 {out['mode']}: {out['reasons']}"
    assert out["stats"]["legs_answered"] == ["vector", "keyword"]
    assert out["degraded"] is False


# ---------------------------------------------------------------------------
# ② 融合真的发生
# ---------------------------------------------------------------------------


async def test_fusion_reorders_and_is_not_either_single_leg(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """rrf_fuse 真被调用一次,k 走 resolve_rrf_k 单源,名次不等于任何一条单腿原序。"""
    from app.services.rag import resolve_rrf_k

    root = _one_file_repo(tmp_path)  # 关键词腿唯一命中:alpha.py:1
    # 向量腿原序:beta.py > alpha.py > gamma.py(alpha 在第 2 名)
    fake = _install_fake_indexer(
        monkeypatch,
        [_semantic_item("beta.py", 1), _semantic_item("alpha.py", 1), _semantic_item("gamma.py", 7)],
    )

    calls: list[dict[str, Any]] = []
    real_fuse = reranker_module.rrf_fuse

    def _spy_fuse(
        rankings: list[list[Any]],
        k: int = 60,
        labels: list[str] | None = None,
        key_fn: Any = None,
    ) -> list[Any]:
        calls.append({"rankings": rankings, "k": k, "labels": labels})
        return real_fuse(rankings, k=k, labels=labels, key_fn=key_fn)

    monkeypatch.setattr(reranker_module, "rrf_fuse", _spy_fuse)

    out = await _tool_search_codebase({"query": _QUERY, "path": str(root), "max_results": 10})

    assert fake.search.await_count == 1
    assert len(calls) == 1, f"融合应被调用一次,实得 {len(calls)}"
    assert calls[0]["k"] == resolve_rrf_k(), "k 必须取 rag.resolve_rrf_k() 单源"
    assert calls[0]["labels"] == ["vector", "keyword"]
    assert [len(r) for r in calls[0]["rankings"]] == [3, 1], "每条腿各计一次(无权 RRF,没有重复计入)"

    order = [(m["path"], m["line"]) for m in out["matches"]]
    vector_order = [("beta.py", 1), ("alpha.py", 1), ("gamma.py", 7)]
    keyword_order = [("alpha.py", 1)]
    assert order != vector_order, "融合后名次与向量腿原序相同 ⇒ 融合没改变任何东西"
    assert order != keyword_order, "融合后名次与关键词腿原序相同 ⇒ 这一支只是回落"
    # alpha.py:1 被两条腿同时点名,按 RRF 必然升到首位
    assert order[0] == ("alpha.py", 1), order
    assert out["mode"] == "rrf-fusion" and out["total"] == 3
    assert out["matches"][0]["fused_from"] == "vector+keyword"
    assert out["matches"][0]["rrf_score"] > out["matches"][1]["rrf_score"]


async def test_same_file_different_lines_are_not_collapsed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """融合去重键是"路径+行号":同文件的多处命中不许折成一枚。"""
    (tmp_path / "multi.py").write_text(
        f"def {_QUERY}():\n    pass\n{_QUERY}()\n{_QUERY}()\n",
        encoding="utf-8",
    )
    _install_fake_indexer(monkeypatch, [])

    out = await _tool_search_codebase({"query": _QUERY, "path": str(tmp_path), "max_results": 10})

    lines = sorted(m["line"] for m in out["matches"] if m["path"] == "multi.py")
    assert lines == [1, 3, 4], f"行级命中被折叠掉了:{lines}"


# ---------------------------------------------------------------------------
# ③ 一腿坏了必须出声(旧形态:恒 null 载体 + debug 日志)
# ---------------------------------------------------------------------------


async def test_semantic_leg_exception_is_named_in_the_response(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    fake = _install_fake_indexer(monkeypatch, RuntimeError("pgvector down: connection refused"))

    out = await _tool_search_codebase({"query": _QUERY, "path": str(root)})

    assert fake.search.await_count == 1
    assert out["ok"] is True, "关键词腿照常给答案,一腿失败不许带走整次检索"
    assert out["mode"] == "single-source:keyword", out["mode"]
    assert out["degraded"] is True
    vector_reason = next(r for r in out["reasons"] if r["leg"] == "vector")
    assert vector_reason["status"] == "failed"
    assert "pgvector down" in str(vector_reason["detail"]), "异常原文必须进返回体,不许只写日志"
    # 验收尺点名的那一型:载体在异常分支同样赋值,不再恒 null
    assert out["semantic_index"] is not None, "异常分支仍给 null ⇒ silent-degrade 回潮"
    assert out["semantic_index"]["status"] == "failed"
    assert "pgvector down" in out["semantic_index"]["reason"]
    assert out["stats"]["legs_unavailable"] == ["vector"]


async def test_semantic_leg_timeout_is_a_named_leg_status(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    _install_fake_indexer(monkeypatch, TimeoutError())

    out = await _tool_search_codebase({"query": _QUERY, "path": str(root)})

    vector_reason = next(r for r in out["reasons"] if r["leg"] == "vector")
    assert vector_reason["status"] == "timeout", vector_reason
    assert out["mode"] == "single-source:keyword"
    assert out["stats"]["legs_unavailable"] == ["vector"]


async def test_keyword_leg_failure_does_not_look_like_no_match(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """关键词腿自己炸了(路径读不动)时,结论必须是"没判出来",不是"没有"。"""
    _install_fake_indexer(monkeypatch, [_semantic_item("beta.py", 1)])
    (tmp_path / "alpha.py").write_text(f"def {_QUERY}():\n    pass\n", encoding="utf-8")
    def _boom(*_args: Any) -> set[str]:
        raise RuntimeError("walk exploded")

    monkeypatch.setattr(mcp_server, "_git_check_ignore", _boom)

    out = await _tool_search_codebase({"query": _QUERY, "path": str(tmp_path)})

    assert out["mode"] == "single-source:vector", out["mode"]
    kw_reason = next(r for r in out["reasons"] if r["leg"] == "keyword")
    assert kw_reason["status"] == "failed"
    assert "walk exploded" in str(kw_reason["detail"])


# ---------------------------------------------------------------------------
# ④ empty / unjudged / single-source 三态不许互相冒充
# ---------------------------------------------------------------------------


async def test_both_legs_answered_empty_is_empty(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    _install_fake_indexer(monkeypatch, [])

    out = await _tool_search_codebase({"query": "nothing_matches_this_zz", "path": str(root)})

    assert out["mode"] == "empty", out["mode"]
    assert out["degraded"] is False, "两腿都答了且都判空 = 这是一次判定过的「没有」"
    assert out["stats"]["legs_answered"] == ["vector", "keyword"]
    assert out["stats"]["legs_unavailable"] == []
    assert out["total"] == 0 and out["ok"] is True


async def test_unreachable_leg_plus_empty_leg_is_unjudged_never_fused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """一腿取不到、另一腿判空 ⇒ 只能是 unjudged。

    反向牙:把装配层改成冒 rrf-fusion 或冒 empty,本用例必须翻红。
    """
    root = _one_file_repo(tmp_path)
    _install_fake_indexer(monkeypatch, RuntimeError("embed service 503"))

    out = await _tool_search_codebase({"query": "nothing_matches_this_zz", "path": str(root)})

    assert out["mode"] == "unjudged", out["mode"]
    assert out["mode"] not in ("rrf-fusion", "empty"), "取不到的那条腿不许被并入「已判定」"
    assert out["degraded"] is True
    assert out["stats"]["legs_unavailable"] == ["vector"]
    assert out["semantic_index"] is not None and out["semantic_index"]["status"] == "failed"


async def test_use_semantic_off_does_not_issue_a_vector_query(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """显式关腿 = 一条查询都不发(副作用为 0),且如实写 single-source:keyword。"""
    root = _one_file_repo(tmp_path)
    fake = _install_fake_indexer(monkeypatch, [_semantic_item("beta.py", 1)])

    off = await _tool_search_codebase({"query": _QUERY, "path": str(root), "use_semantic": False})
    assert fake.search.await_count == 0, "关掉语义腿却仍发查询 = 入参被无视"
    assert fake.index_repository.await_count == 0, "关掉语义腿却建索引 = 多出域副作用"
    assert off["mode"] == "single-source:keyword" and off["use_semantic"] is False
    assert next(r for r in off["reasons"] if r["leg"] == "vector")["status"] == "skipped"

    # 正向对照:同样的入参只把开关打开,查询必须恰好发出去一次,并真的双腿融合
    on = await _tool_search_codebase({"query": _QUERY, "path": str(root)})
    assert fake.search.await_count == 1, "开关打开后仍没发查询 = 腿是假的"
    assert on["mode"] == "rrf-fusion" and on["total"] == 2, on["mode"]


# ---------------------------------------------------------------------------
# ⑤ 身份轴(§5 认证不等于授权):只认服务端注入,不接受客户端自称
# ---------------------------------------------------------------------------


async def test_identity_is_passed_through_and_never_taken_from_client_args(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)

    # 替身:app.services.codebase_indexer 内部再 import 一次,直接换成假模块最省事
    fake = _install_fake_indexer(monkeypatch, [])

    await _tool_search_codebase({"query": _QUERY, "path": str(root), "__user_id": "u-42"})
    assert fake.search.await_args is not None
    assert fake.search.await_args.kwargs["internal_user_id"] == "u-42"

    # 客户端自报的身份必须被忽略(LLM 可整写 arguments)
    fake.search.reset_mock()
    await _tool_search_codebase(
        {"query": _QUERY, "path": str(root), "internal_user_id": "attacker-self-claim"}
    )
    assert fake.search.await_args is not None
    assert fake.search.await_args.kwargs["internal_user_id"] is None


async def test_egress_gate_still_blocks_indexing_without_consent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """未同意出域时,语义腿不建索引(副作用为 0),关键词腿照常交付。"""
    root = _one_file_repo(tmp_path)
    fake = _install_fake_indexer(monkeypatch, [])
    monkeypatch.undo()  # 撤销"懒索引短路"那枚替身,让真同意闸上判
    monkeypatch.setattr("app.services.codebase_indexer.codebase_indexer", fake)
    monkeypatch.setattr(mcp_server, "_code_index_egress_allowed", lambda _uid: False)
    monkeypatch.setattr(mcp_server, "_LAZY_INDEX_LAST_RUN", {})

    out = await _tool_search_codebase({"query": _QUERY, "path": str(root)})

    assert fake.index_repository.await_count == 0, "未同意却建索引 = 源码出域"
    assert fake.search.await_count == 1
    assert out["mode"] == "single-source:keyword", "同意闸拦下语义腿时,降级必须具名"
    assert out["degraded"] is True


async def test_path_error_contract_keeps_ok_false_and_names_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """入参层面的路径错误:沿用 ok=False,但降级信息不再只留在日志里。"""
    _install_fake_indexer(monkeypatch, RuntimeError("db down"))

    out = await _tool_search_codebase({"query": _QUERY, "path": str(tmp_path / "nope")})

    assert out["ok"] is False
    assert "路径不存在" in out["message"]
    assert out["mode"] == "unjudged", out["mode"]
    assert out["degraded"] is True
    assert out["stats"]["legs_unavailable"] == ["vector", "keyword"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
