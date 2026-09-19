# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D9(2026-09-19 立):repo_wiki_engine 单元测试。

覆盖 4 个用例:
1. test_generate        —— 首次生成:扫描 markdown,调 LLM 摘要,产出带 wiki-hash 的文本。
2. test_incremental     —— 增量同步:只改一个文件时,仅对该文件重新摘要(其余复用旧摘要)。
3. test_ttl_debounce    —— 60s 内存 TTL 防抖:60s 内重复调用直接返回缓存,不重复调 LLM。
4. test_llm_failure_fallback —— LLM 调用失败时降级取文件首 N 字符,整体不返回 None。

全程用 fake LLM(不触网),tmp 工作区,全链路不依赖真实 API key。
"""

import asyncio
import os

import pytest

from app.core import llm_gateway
from app.services import repo_wiki_engine


def _fixture_workspace(tmp_path) -> str:
    (tmp_path / "README.md").write_text(
        "# My Project\nThis is the readme body content.\n", encoding="utf-8"
    )
    (tmp_path / "AGENTS.md").write_text(
        "# Agents\nContribution rules here.\n", encoding="utf-8"
    )
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "arch.md").write_text("# Architecture\nservice layer description.\n", encoding="utf-8")
    return str(tmp_path)


@pytest.fixture
def workspace(tmp_path):
    return _fixture_workspace(tmp_path)


@pytest.fixture
def fake_llm(monkeypatch):
    """注入 fake LLM:complete 返回按文件路径定制的摘要,并统计调用次数。"""
    calls = {"n": 0}

    def _rel_from(messages):
        for m in messages:
            c = m.get("content", "")
            if "文件路径:" in c:
                return c.split("文件路径:", 1)[1].split("\n", 1)[0].strip()
        return "unknown"

    async def _fake_complete(messages, model="auto", **kwargs):
        calls["n"] += 1
        return {"content": f"SUMMARY[{_rel_from(messages)}]"}

    monkeypatch.setattr(llm_gateway.llm_gateway, "_is_stub_mode", lambda: False)
    monkeypatch.setattr(llm_gateway.llm_gateway, "complete", _fake_complete)
    return calls


def test_generate(fake_llm, workspace):
    repo_wiki_engine.clear_wiki_cache()
    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert text, "ensure_wiki 应返回非空文本"
    assert "wiki-hash" in text, "文本应带 <!-- wiki-hash --> 标记"
    assert "SUMMARY[README.md]" in text
    assert "SUMMARY[AGENTS.md]" in text
    assert "SUMMARY[docs/arch.md]" in text
    # 3 个源文件各调一次 LLM
    assert fake_llm["n"] == 3


def test_incremental(fake_llm, workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()
    t = {"v": 0.0}
    monkeypatch.setattr(repo_wiki_engine, "_now", lambda: t["v"])

    # 首次生成
    asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 3

    # 越过 60s TTL,仅修改 README.md
    t["v"] = 61.0
    with open(os.path.join(workspace, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("# My Project\nCHANGED readme body content.\n")
    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))

    # 仅变更文件重新摘要 -> 仅 +1 次 LLM 调用
    assert fake_llm["n"] == 4, f"增量应只重摘 1 个文件,实际调用 {fake_llm['n']}"
    assert "SUMMARY[README.md]" in text
    assert "SUMMARY[docs/arch.md]" in text  # 未变更文件仍被复用


def test_ttl_debounce(fake_llm, workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()
    t = {"v": 0.0}
    monkeypatch.setattr(repo_wiki_engine, "_now", lambda: t["v"])

    text1 = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 3

    # 60s 内 -> 直接返回内存缓存,不重复调 LLM
    t["v"] = 10.0
    text2 = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 3, "TTL 内不应再次调用 LLM"
    assert text2 == text1, "TTL 内应返回相同缓存文本"


def test_llm_failure_fallback(workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()

    async def _boom(messages, model="auto", **kwargs):
        raise RuntimeError("llm down")

    monkeypatch.setattr(llm_gateway.llm_gateway, "_is_stub_mode", lambda: False)
    monkeypatch.setattr(llm_gateway.llm_gateway, "complete", _boom)

    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert text, "LLM 失败时应降级而非返回 None"
    assert "wiki-hash" in text
    # 降级取文件首 N 字符(README 正文)
    assert "This is the readme body content." in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
