# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-11 CodebaseInvestigator 等价只读调查工具的接线锁测试。

判据全部 import 被测模块与既有出口本体(§22c),本文件不复制任何生产判据。
测试隔离(§5):全程不连生产库(PG 8810/Redis 8811)、不触网、不起子进程;
conftest 的 autouse DB 隔离夹具照常生效,本文件额外把 httpx/子进程出口钉成哨兵。
"""

import builtins
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

from app.services import codebase_investigator as ci
from app.services import repo_wiki_engine
from app.services import rg_fallback_parity as rgp
from app.services.codebase_indexer import CodebaseIndexer


def _fake_deps(
    *,
    files: list[str] | None = None,
    hits: list[rgp.ContentHit] | None = None,
    semantic_result: list[dict[str, Any]] | None = None,
    semantic_error: Exception | None = None,
    wiki_cache: dict[str, Any] | None = None,
    recorder: dict[str, Any] | None = None,
) -> ci.InvestigatorDeps:
    """按注入面组装假出口:只造数据,不复算任何检索判据。"""

    prov = rgp.EnumerationProvenance(engine="python-walk", duration_s=0.0, counted=len(files or []))

    def _enumerate(root: Path) -> tuple[list[str], rgp.EnumerationProvenance]:
        if recorder is not None:
            recorder.setdefault("enumerate", []).append(str(root))
        return list(files or []), prov

    def _content_search(root: Path, **kwargs: Any) -> rgp.ContentScanResult:
        if recorder is not None:
            recorder.setdefault("content", []).append(kwargs)
        return rgp.ContentScanResult(
            hits=list(hits or []),
            provenance=prov,
            scanned_files=len(kwargs.get("files", [])),
        )

    async def _semantic(query: str, **kwargs: Any) -> list[dict[str, Any]]:
        if recorder is not None:
            recorder.setdefault("semantic", []).append({"query": query, **kwargs})
        if semantic_error is not None:
            raise semantic_error
        return list(semantic_result or [])

    def _wiki(workspace_path: str) -> dict[str, Any] | None:
        if recorder is not None:
            recorder.setdefault("wiki", []).append(workspace_path)
        return wiki_cache

    return ci.InvestigatorDeps(
        enumerate_files=_enumerate,
        content_search=_content_search,
        semantic_search=_semantic,
        wiki_cache_read=_wiki,
    )


def _source_tree(tmp_path: Path) -> Path:
    """两棵顶层模块各埋一个相同 token,供真实词法腿命中与跨模块推断断言。"""
    (tmp_path / "alpha").mkdir()
    (tmp_path / "beta").mkdir()
    (tmp_path / "alpha" / "svc.py").write_text(
        "def handle_zylph():\n    return 'ZYLPH_TOKEN'\n", encoding="utf-8"
    )
    (tmp_path / "beta" / "svc.py").write_text(
        "class ZylphGate:\n    marker = 'ZYLPH_TOKEN'\n", encoding="utf-8"
    )
    return tmp_path


@pytest.fixture
def mutation_sentinels(monkeypatch):
    """把写盘/派生进程/网络三类可变出口钉成哨兵,记录一切命中。"""
    calls: list[str] = []

    real_open = builtins.open

    def _spy_open(file: Any, mode: str = "r", *args: Any, **kwargs: Any) -> Any:
        if any(ch in str(mode) for ch in "wax+"):
            calls.append(f"open:{mode}:{file}")
        return real_open(file, mode, *args, **kwargs)

    monkeypatch.setattr(builtins, "open", _spy_open)
    monkeypatch.setattr(
        os, "makedirs", lambda *a, **k: calls.append("makedirs") or None
    )
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *a, **k: calls.append("subprocess.run"),
    )
    monkeypatch.setattr(
        subprocess, "Popen", lambda *a, **k: calls.append("subprocess.Popen")
    )
    # socket 不能直接顶掉(pytest-asyncio 的事件循环自管道要用真 socket),
    # 改钉 httpx.AsyncClient —— 本模块零直连网络,httpx 只会从被复用的出口进来。
    monkeypatch.setattr(
        "httpx.AsyncClient",
        lambda *a, **k: calls.append("httpx.AsyncClient"),
    )
    return calls


async def test_readonly_zero_mutation_with_real_lexical_leg(
    tmp_path, mutation_sentinels, monkeypatch
):
    """结构上只读(真出口档):词法腿走真实 rg_fallback_parity(Python 通道),
    调查全程对写盘/子进程/socket 三类哨兵零命中;索引与 wiki 生成出口被 patch 成
    抛错仍不被调用 —— 证明"只给结论、绝不动东西"。"""
    tree = _source_tree(tmp_path)

    async def _never_index(self, *a: Any, **k: Any) -> Any:
        raise AssertionError("只读调查绝不允许触发 index_repository")

    def _never_save_disk(*a: Any, **k: Any) -> None:
        raise AssertionError("只读调查绝不允许写 wiki 磁盘缓存")

    monkeypatch.setattr(CodebaseIndexer, "index_repository", _never_index)
    monkeypatch.setattr(CodebaseIndexer, "index_file", _never_index)
    monkeypatch.setattr(repo_wiki_engine, "_save_disk", _never_save_disk)
    monkeypatch.setattr(
        repo_wiki_engine,
        "ensure_wiki",
        lambda *a, **k: (_ for _ in ()).throw(
            AssertionError("只读调查绝不允许触发 wiki 生成")
        ),
    )

    deps = ci.build_default_deps()

    async def _fake_semantic(query: str, **kw: Any) -> list[dict[str, Any]]:
        return [
            {
                "filePath": "alpha/svc.py",
                "symbolName": "handle_zylph",
                "content": "def handle_zylph():",
                "score": 0.9,
            }
        ]

    deps = ci.InvestigatorDeps(
        enumerate_files=deps.enumerate_files,
        content_search=deps.content_search,
        semantic_search=_fake_semantic,
        wiki_cache_read=deps.wiki_cache_read,
    )
    result = await ci.investigate_codebase(
        {"intent": "ZYLPH_TOKEN 定义在哪", "query": "ZYLPH_TOKEN",
         "path": str(tree), "__user_id": "u-1"},
        deps=deps,
    )
    assert mutation_sentinels == [], f"只读契约被破坏,出现可变出口调用: {mutation_sentinels}"
    assert result["read_only"] is True
    assert result["status"] == "ok"
    assert any(f["leg"] == "lexical" for f in result["findings"])


async def test_lexical_leg_never_spawns_rg_by_default(tmp_path):
    """默认词法腿必须把 prefer_rg=False 传给既有出口(零子进程是只读契约的一部分)。"""
    recorder: dict[str, Any] = {}
    tree = _source_tree(tmp_path)
    deps = _fake_deps(
        files=["alpha/svc.py", "beta/svc.py"],
        hits=[rgp.ContentHit(path="alpha/svc.py", line_numbers=[2])],
        recorder=recorder,
    )
    await ci.investigate_codebase(
        {"intent": "ZYLPH_TOKEN", "path": str(tree), "use_semantic": False,
         "include_wiki": False},
        deps=deps,
    )
    assert recorder["content"], "内容检索出口未被调用"
    assert all(kw.get("prefer_rg") is False for kw in recorder["content"])


async def test_identity_only_from_host_injection(tmp_path):
    """§5 鉴权:客户端自报 user_id/userId 一律不读;未注入 __user_id 时语义腿零调用
    (副作用没发生),并点名缺失输入;正向对照 —— 注入后按注入身份调用。"""
    recorder: dict[str, Any] = {}
    deps = _fake_deps(semantic_result=[], recorder=recorder)
    forged = await ci.investigate_codebase(
        {
            "intent": "查认证逻辑",
            "path": str(tmp_path),
            "user_id": "attacker",
            "userId": "attacker",
            "include_wiki": False,
        },
        deps=deps,
    )
    assert "semantic" not in recorder, "未注入身份时语义腿不得发起(匿名查询必 401,不发)"
    assert forged["legs"]["semantic"]["status"] == "skipped_missing_identity"
    assert any("__user_id" in m for m in forged["missing_inputs"])

    ok_rec: dict[str, Any] = {}
    await ci.investigate_codebase(
        {
            "intent": "查认证逻辑",
            "path": str(tmp_path),
            "__user_id": "u-real",
            "__user_role": "user",
            "include_wiki": False,
        },
        deps=_fake_deps(semantic_result=[], recorder=ok_rec),
    )
    assert ok_rec["semantic"][0]["user_id"] == "u-real", "语义腿必须按宿主注入身份调用"


async def test_empty_semantic_is_unjudged_not_green(tmp_path):
    """§0.3 三态诚实:语义出口空列表=未索引/失败/无命中三态混合 ⇒ 判未判定并点名,
    不得据此断言"代码库里没有"。"""
    deps = _fake_deps(files=["a/x.py"], semantic_result=[], wiki_cache=None)
    result = await ci.investigate_codebase(
        {"intent": "不存在的东西", "path": str(tmp_path), "__user_id": "u-1"},
        deps=deps,
    )
    assert result["legs"]["semantic"]["status"] == "empty_ambiguous"
    assert result["status"] == "unjudged"
    assert not result["ok"]
    statements = " ".join(f["statement"] for f in result["findings"])
    assert "不存在" not in statements
    assert any("语义" in m for m in result["missing_inputs"])


async def test_zero_enumeration_is_unjudged(tmp_path):
    """§0.3:枚举到 0 个候选判死不记绿 —— 空目录不得被洗成"查过了,没有"。"""
    deps = _fake_deps(files=[], semantic_result=[], wiki_cache=None)
    result = await ci.investigate_codebase(
        {"intent": "任意", "path": str(tmp_path), "__user_id": "u-1"},
        deps=deps,
    )
    assert result["legs"]["lexical"]["status"] == "undetermined"
    assert result["status"] == "unjudged"


async def test_semantic_exception_is_unjudged(tmp_path):
    """检索超时/异常 ⇒ 显式未判定并点名通道缺口,不冒红也不记绿。"""
    deps = _fake_deps(
        files=["a/x.py"],
        hits=[rgp.ContentHit(path="a/x.py", line_numbers=[1])],
        semantic_error=TimeoutError("30s 超时"),
        wiki_cache=None,
    )
    result = await ci.investigate_codebase(
        {"intent": "x", "path": str(tmp_path), "__user_id": "u-1"},
        deps=deps,
    )
    assert result["legs"]["semantic"]["status"] == "failed"
    assert any("超时" in m or "未返回结论" in m for m in result["missing_inputs"])
    assert result["status"] == "ok"  # 词法腿有观察级结论,整体仍可判,但缺口必须点名


async def test_empty_confirmed_requires_all_legs_trustworthy(tmp_path):
    """唯一合法的"查过了没有":词法腿完整跑过且零命中,其余腿显式关闭(非跳过)。"""
    deps = _fake_deps(files=["a/x.py"], hits=[], wiki_cache=None)
    result = await ci.investigate_codebase(
        {
            "intent": "needle_absent",
            "query": "needle_absent",
            "path": str(tmp_path),
            "use_semantic": False,
            "include_wiki": False,
        },
        deps=deps,
    )
    assert result["legs"]["lexical"]["status"] == "empty_verified"
    assert result["status"] == "empty_confirmed"
    assert result["ok"] is True


async def test_invalid_intent_rejects_without_search(tmp_path):
    """入参非法 ⇒ invalid_intent,不发起任何检索(零副作用)。"""
    recorder: dict[str, Any] = {}
    result = await ci.investigate_codebase(
        {"intent": "   ", "path": str(tmp_path)}, deps=_fake_deps(recorder=recorder)
    )
    assert result["status"] == "invalid_intent"
    assert recorder == {}


async def test_unreachable_path_unjudged_with_named_input(tmp_path):
    """调查根不可达 ⇒ 未判定且点名缺哪个输入,不冒充"空仓"。"""
    missing = tmp_path / "nope"
    result = await ci.investigate_codebase(
        {"intent": "x", "path": str(missing)}, deps=_fake_deps()
    )
    assert result["status"] == "unjudged"
    assert result["missing_inputs"]
    assert all(f["confidence"] == "unknown" for f in result["findings"])


async def test_anchors_carry_content_not_bare_line_numbers(tmp_path):
    """§1 证据纪律:每条观察级结论的锚点必须带逐字内容锚点(path+内容),
    行号只作辅助 —— content_anchor 为空的锚点一律视为违约。"""
    tree = _source_tree(tmp_path)
    deps = ci.build_default_deps()
    result = await ci.investigate_codebase(
        {"intent": "ZYLPH_TOKEN", "path": str(tree), "use_semantic": False,
         "include_wiki": False},
        deps=deps,
    )
    observed = [f for f in result["findings"] if f["confidence"] == "observed"]
    assert observed, "真实词法腿应至少产出一条观察级结论"
    for f in observed:
        for a in f["anchors"]:
            assert a["path"], "锚点必须含文件路径"
            assert a["content_anchor"], "锚点必须含可复验的逐字内容锚点,禁止裸行号"
    assert "ZYLPH_TOKEN" in observed[0]["anchors"][0]["content_anchor"]


async def test_cross_module_cooccurrence_is_inferred_not_observed(tmp_path):
    """跨模块共现结论只允许"推断"档:由两个顶层模块的命中分布得出,且明示未经调用图证实。"""
    tree = _source_tree(tmp_path)
    deps = ci.build_default_deps()
    result = await ci.investigate_codebase(
        {"intent": "ZYLPH_TOKEN", "path": str(tree), "use_semantic": False,
         "include_wiki": False},
        deps=deps,
    )
    inferred = [f for f in result["findings"] if f["confidence"] == "inferred"]
    assert inferred and inferred[0]["leg"] == "aggregate"
    assert "推断" in inferred[0]["statement"]


async def test_wiki_leg_reads_cache_only_and_degrades_honestly(tmp_path):
    """wiki 腿只读既有缓存:命中给观察级摘要锚,无缓存给未知档并明示不触发生成。"""
    cache = {"files": {"README.md": {"hash": "h", "summary": "项目百科摘要文本"}}}
    hit = await ci.investigate_codebase(
        {"intent": "项目结构", "path": str(tmp_path), "use_semantic": False,
         "query": "项目结构"},
        deps=_fake_deps(files=[], wiki_cache=cache),
    )
    wiki_obs = [f for f in hit["findings"] if f["leg"] == "wiki"]
    assert wiki_obs and wiki_obs[0]["confidence"] == "observed"

    miss = await ci.investigate_codebase(
        {"intent": "项目结构", "path": str(tmp_path), "use_semantic": False,
         "query": "项目结构"},
        deps=_fake_deps(files=[], wiki_cache=None),
    )
    assert miss["legs"]["wiki"]["status"] == "no_cache"
    assert any(
        f["leg"] == "wiki" and f["confidence"] == "unknown" for f in miss["findings"]
    )


async def test_determinism_two_runs_identical(tmp_path):
    """§5 测试隔离/幂等:同一注入出口连跑两次结果逐字节相等(无隐藏时钟/随机量)。"""

    def deps() -> ci.InvestigatorDeps:
        return _fake_deps(
            files=["alpha/svc.py", "beta/svc.py"],
            hits=[
                rgp.ContentHit(path="alpha/svc.py", line_numbers=[2]),
                rgp.ContentHit(path="beta/svc.py", line_numbers=[2]),
            ],
            semantic_result=[
                {"filePath": "alpha/svc.py", "symbolName": "handle_zylph",
                 "content": "def handle_zylph():", "score": 0.9}
            ],
            wiki_cache=None,
        )

    args = {"intent": "ZYLPH_TOKEN", "path": str(tmp_path), "__user_id": "u-1"}
    r1 = await ci.investigate_codebase(args, deps=deps())
    r2 = await ci.investigate_codebase(args, deps=deps())
    assert r1 == r2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
