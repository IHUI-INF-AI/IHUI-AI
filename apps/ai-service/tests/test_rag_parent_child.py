# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""父子块(small-to-big)摄取与检索接入测试。

对应设计接线五组判据:
a. 开关关 → add_document 与旧行为一致(单次 embed+add_entry,entry 无 rag_* 键);
b. 开关开 → 多子块文档逐子块入库,每个 entry 携带父块键;同文档两次切分
   chunk_id 完全一致(确定性);
c. 展开 → 向量命中带 rag_parent_text 的条目时,context/来源 content 用父块
   全文,子块命中证据保留在 rag_child_text;
d. 降级 → 切分器抛异常回落整篇且不抛出,logger.warning 留痕(§5e 失败必须响);
e. strip_watermark → HTML 注释/零宽字符在摄取入口被剥离。

风格参照 tests/test_rag.py:unittest.mock AsyncMock/patch,直接调 RAGService 方法;
向量库/内存库全部打桩,不落任何真实后端。
"""

from __future__ import annotations

import contextlib
import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import parent_child_chunking as pcc
from app.services import rag as rag_module
from app.services.parent_child_chunking import (
    ChunkerConfig,
    ParentChildChunker,
    estimate_tokens,
    strip_watermark,
)
from app.services.rag import (
    PARENT_CHILD_ENABLED_ENV,
    RAGService,
    RAGSource,
    rag_service,
    resolve_parent_child_enabled,
)

#: 多段中文文档:小预算(parent 60 / child 20 token)下必然切出多个子块
DOC = (
    "# 部署指南\n\n"
    "本节介绍服务的整体部署流程,涵盖环境准备、依赖安装与配置校验三个步骤。"
    "每一步都有明确的验收标准,运维人员应当按照顺序执行,不得跳步。\n\n"
    "## 安装\n\n"
    "依赖安装需要按版本顺序进行,出现冲突必须先解决再启动,否则服务将无法正常运行"
    "并可能在启动阶段直接退出进程。\n\n"
    "## 配置\n\n"
    "配置文件修改后要仔细复核两遍,再运行校验脚本确认服务能够正常加载全部配置项,"
    "校验失败时应回滚本次修改。\n\n"
    "## 启动\n\n"
    "服务启动后需要执行健康检查,观察日志中的异常输出,发现问题立即回滚处理,"
    "避免故障范围进一步扩大。\n"
)


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """环境隔离:不继承机器上的同名 env(开关默认关,KB_CHUNK_* 走默认预算)。"""
    monkeypatch.delenv(PARENT_CHILD_ENABLED_ENV, raising=False)
    for name in (
        pcc.ENV_PARENT_TOKENS,
        pcc.ENV_CHILD_TOKENS,
        pcc.ENV_CHILD_OVERLAP,
        pcc.ENV_USE_TIKTOKEN,
    ):
        monkeypatch.delenv(name, raising=False)


def _small_chunk_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """小预算切分:parent 60 / child 20 token,保证 DOC 切出多个子块。"""
    monkeypatch.setenv(pcc.ENV_PARENT_TOKENS, "60")
    monkeypatch.setenv(pcc.ENV_CHILD_TOKENS, "20")


@contextlib.contextmanager
def _patched_backends():
    """把 vector_memory.embed/add_entry 与 memory_store.add 全部打桩。"""
    embed = AsyncMock(return_value=[0.1, 0.2, 0.3])
    add_entry = AsyncMock(return_value=None)
    mem_add = AsyncMock(return_value=None)
    with (
        patch.object(rag_module.vector_memory, "embed", embed),
        patch.object(rag_module.vector_memory, "add_entry", add_entry),
        patch.object(rag_module.memory_store, "add", mem_add),
    ):
        yield embed, add_entry, mem_add


# =============================================================================
# 开关语义(env RAG_PARENT_CHILD_ENABLED,默认关)
# =============================================================================


class TestSwitchSemantics:
    def test_default_off(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv(PARENT_CHILD_ENABLED_ENV, raising=False)
        assert resolve_parent_child_enabled() is False

    def test_enabled_values(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for value in ("1", "true", "TRUE", "True", " 1 "):
            monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, value)
            assert resolve_parent_child_enabled() is True, f"{value!r} 应判为开"

    def test_disabled_values(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for value in ("", "0", "2", "yes", "on", "false", "abc"):
            monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, value)
            assert resolve_parent_child_enabled() is False, f"{value!r} 应判为关"


# =============================================================================
# a. 开关关:与旧行为一致
# =============================================================================


class TestSwitchOffUnchanged:
    async def test_add_document_single_embed(self) -> None:
        with _patched_backends() as (embed, add_entry, mem_add):
            await rag_service.add_document(
                session_id="s1",
                content=DOC,
                role="system",
                metadata={"k": "v"},
                user_id="u1",
            )
        assert embed.await_count == 1
        assert embed.await_args.args[0] == DOC
        assert add_entry.await_count == 1
        entry = add_entry.await_args.args[1]
        assert entry["content"] == DOC
        assert entry["k"] == "v"
        assert not [key for key in entry if key.startswith("rag_")]
        assert add_entry.await_args.kwargs.get("user_id") == "u1"
        mem_add.assert_awaited_once_with("s1", "system", DOC, {"k": "v"})

    def test_rag_source_new_fields_defaulted(self) -> None:
        """旧位置参数构造点必须继续可用,新字段带默认值。"""
        s = RAGSource("s", "user", "c", 0.5)
        assert s.rag_child_text == ""
        assert s.rag_parent_id == ""


# =============================================================================
# b. 开关开:逐子块入库 + 确定性
# =============================================================================


class TestSwitchOnIngestion:
    async def test_multi_child_entries_carry_parent_keys(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, "1")
        _small_chunk_env(monkeypatch)

        with _patched_backends() as (embed, add_entry, mem_add):
            await rag_service.add_document(
                session_id="s1", content=DOC, metadata={"k": "v"}, user_id="u1"
            )

        entries = [c.args[1] for c in add_entry.await_args_list]
        assert len(entries) > 1, "开关开却未走多子块路径,本判据空转"
        # 同一文档的所有子块共享一个 rag_doc_id;用它复切即可逐字段精确对照
        # (chunk_id 含 doc_id 散列,预取"probe" id 对不上生产随机 id)
        doc_ids = {e["rag_doc_id"] for e in entries}
        assert len(doc_ids) == 1 and "" not in doc_ids
        expected = ParentChildChunker(ChunkerConfig.from_env()).chunk_document(
            DOC, doc_id=doc_ids.pop()
        )
        assert len(expected.children) == len(entries)
        assert embed.await_count == len(expected.children)
        for entry, child in zip(entries, expected.children, strict=True):
            assert entry["content"] == child.text.strip()
            assert entry["rag_child_text"] == child.text.strip()
            assert entry["rag_parent_id"] == child.parent_id
            assert (
                entry["rag_parent_text"]
                == expected.parents_by_id[child.parent_id].text.strip()
            )
            assert entry["k"] == "v"
        # 每个子块是独立向量条目:entry_id 互不相同
        ids = [c.args[0] for c in add_entry.await_args_list]
        assert len(set(ids)) == len(ids)
        # 属主透传与旧路径一致
        assert all(c.kwargs.get("user_id") == "u1" for c in add_entry.await_args_list)
        # memory_store 仍收整篇一份(关键词路行为不因切分改变)
        mem_add.assert_awaited_once_with("s1", "system", DOC, {"k": "v"})

    def test_chunking_deterministic(self) -> None:
        """同一 (doc_id, 文本, 配置) 两次切分,chunk_id 序列完全一致。"""
        cfg = ChunkerConfig(parent_max_tokens=60, child_max_tokens=20)
        r1 = ParentChildChunker(cfg).chunk_document(DOC, doc_id="d1")
        r2 = ParentChildChunker(cfg).chunk_document(DOC, doc_id="d1")
        assert [c.chunk_id for c in r1.children] == [c.chunk_id for c in r2.children]
        assert [p.chunk_id for p in r1.parents] == [p.chunk_id for p in r2.parents]

    def test_estimate_tokens_smoke(self) -> None:
        assert estimate_tokens("中文汉字") == 4
        assert estimate_tokens("abcd") == 1
        assert estimate_tokens("") == 0


# =============================================================================
# d. 降级:切分异常 / 子块 ≤1 → 回落整篇且不抛出
# =============================================================================


class TestDegradeFallback:
    async def test_chunker_exception_falls_back_with_warning(
        self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
    ) -> None:
        monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, "1")
        _small_chunk_env(monkeypatch)
        broken_cls = MagicMock()
        broken_cls.return_value.chunk_document.side_effect = RuntimeError("模拟切分炸")
        with (
            caplog.at_level(logging.WARNING, logger="app.services.rag"),
            patch.object(rag_module, "ParentChildChunker", broken_cls),
            _patched_backends() as (embed, add_entry, mem_add),
        ):
            await rag_service.add_document(session_id="s1", content=DOC)  # 不得抛

        assert embed.await_count == 1
        assert embed.await_args.args[0] == DOC
        assert add_entry.await_count == 1
        entry = add_entry.await_args.args[1]
        assert entry["content"] == DOC
        assert not [key for key in entry if key.startswith("rag_")]
        mem_add.assert_awaited_once()
        warnings = [
            rec
            for rec in caplog.records
            if rec.levelno == logging.WARNING and "父子切分失败" in rec.getMessage()
        ]
        assert warnings, "切分降级必须响(§5e),不得静默回落"

    async def test_single_child_falls_back(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """短文档只切出 1 个子块 → 回落整篇,不产生 rag_* 键。"""
        monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, "1")
        short = "一句话文档。"
        with _patched_backends() as (embed, add_entry, mem_add):
            await rag_service.add_document(session_id="s1", content=short)
        assert add_entry.await_count == 1
        entry = add_entry.await_args.args[1]
        assert entry["content"] == short
        assert not [key for key in entry if key.startswith("rag_")]
        mem_add.assert_awaited_once()


# =============================================================================
# c. 检索展开:命中换父块全文,子块证据保留
# =============================================================================


class TestRetrievalExpansion:
    async def test_vector_hit_expands_to_parent_full_text(self) -> None:
        parent_text = "父块全文内容。" * 300  # 1500 字符 > 1000,证明 context 不被 snippet 上限截
        child_text = "子块命中的片段。"
        entry: dict[str, Any] = {
            "session_id": "s1",
            "role": "system",
            "content": child_text,
            "timestamp": "2026-10-01T00:00:00Z",
            "rag_parent_id": "p1",
            "rag_parent_text": parent_text,
            "rag_child_text": child_text,
            "rag_doc_id": "d1",
        }
        embed = AsyncMock(return_value=[0.1])
        search = AsyncMock(return_value=[("e1", entry, 0.88)])
        with (
            patch.object(rag_module.vector_memory, "embed", embed),
            patch.object(rag_module.vector_memory, "search", search),
        ):
            stats: dict[str, Any] = {}
            sources = await rag_service._vector_retrieve("q", top_k=5, stats=stats)

        assert len(sources) == 1
        s = sources[0]
        assert s.content == parent_text
        assert s.rag_child_text == child_text
        assert s.rag_parent_id == "p1"
        assert s.score == 0.88  # score 语义不变
        assert stats["paths"]["vector"]["parent_expanded"] == 1

        context, _ = RAGService._build_context(sources)
        assert parent_text in context, "父块展开来源必须送全文(不受 1000 字符截断)"

    async def test_legacy_entry_unchanged(self) -> None:
        """旧条目(无 rag_parent_text)行为逐字节不变。"""
        entry: dict[str, Any] = {
            "session_id": "s2",
            "role": "user",
            "content": "旧条目内容",
            "timestamp": "t",
        }
        embed = AsyncMock(return_value=[0.1])
        search = AsyncMock(return_value=[("e2", entry, 0.5)])
        with (
            patch.object(rag_module.vector_memory, "embed", embed),
            patch.object(rag_module.vector_memory, "search", search),
        ):
            stats: dict[str, Any] = {}
            sources = await rag_service._vector_retrieve("q", top_k=5, stats=stats)

        assert len(sources) == 1
        s = sources[0]
        assert s.content == "旧条目内容"
        assert s.rag_child_text == ""
        assert s.rag_parent_id == ""
        assert "parent_expanded" not in stats["paths"]["vector"]
        context, _ = RAGService._build_context(sources)
        assert "旧条目内容" in context


# =============================================================================
# e. strip_watermark:HTML 注释 / 零宽字符
# =============================================================================


class TestStripWatermark:
    def test_html_comment_and_zero_width(self) -> None:
        raw = "<!-- provenance watermark -->正文​与‌内容﻿结束"
        assert strip_watermark(raw) == "正文与内容结束"
        assert strip_watermark("<!--多\n行注释-->干净") == "干净"
        assert strip_watermark("无水印文本") == "无水印文本"

    async def test_ingestion_children_watermark_free(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """带水印文档入库后,子块/父块文本均不含注释与零宽字符。"""
        monkeypatch.setenv(PARENT_CHILD_ENABLED_ENV, "1")
        _small_chunk_env(monkeypatch)
        watered = "<!-- 工具生成水印 -->\n​" + DOC.replace("部署", "​部署")
        assert "​" in watered  # 夹具自检:确实掺了零宽字符
        with _patched_backends() as (_, add_entry, _2):
            await rag_service.add_document(session_id="s1", content=watered)
        assert add_entry.await_count > 1, "水印文档未走子块路径,本判据空转"
        for call in add_entry.await_args_list:
            entry = call.args[1]
            for key in ("content", "rag_parent_text", "rag_child_text"):
                assert "​" not in entry[key]
                assert "工具生成水印" not in entry[key]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
