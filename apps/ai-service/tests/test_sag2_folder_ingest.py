# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 本地文件夹登记 / 增量扫描回归（本仓自有实现）。

钉住四件事：
1. 登记面：相对路径、不存在的目录一律拒绝并给具名原因；
2. 扫描面：md/txt/html 真入索引，未知后缀进 ``unsupported`` 桶，二进制进 ``failed``；
3. 增量面：第二轮 ``mtime/size`` 未变时**一次 extract 都不发生**（不读盘），
   改一个文件只重建那一个；索引被删后重扫必须重建（防「假跳过」）；
4. 消费面：``knowledge_lookup`` 的 sag2 源在空索引时零成本返回空且不记错误，
   建库后能取到带字节区间的引用。
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

import pytest

from app.services import knowledge_lookup as lookup_module
from app.services.knowledge_lookup import knowledge_lookup
from app.services.sag2_lexical import LexicalIndex, Sag2LexicalService
from app.services.sag2_lexical import folder_ingest as fi


def _service() -> Sag2LexicalService:
    """独立实例，绝不碰全局单例（否则测试间互相污染索引）。"""
    return Sag2LexicalService(index=LexicalIndex())


def _write(root: Path, name: str, text: str) -> Path:
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# 登记面
# ---------------------------------------------------------------------------


def test_register_rejects_relative_and_missing(tmp_path: Path) -> None:
    folders = fi.FolderIngest(_service())

    relative = folders.register("some/relative/dir")
    assert relative["registered"] is False
    assert "绝对路径" in str(relative["reason"])

    missing = folders.register(str(tmp_path / "not-there"))
    assert missing["registered"] is False
    assert "目录不存在" in str(missing["reason"])


def test_register_then_unregister_clears_index(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "a.md", "# 董事会决议\n年度研发额度 800 万，责任人王工。")

    assert folders.register(str(tmp_path))["registered"] is True
    first = folders.scan()
    assert first["scanned"] == 1
    assert first["changed"] == 1
    assert service.index.document_count() == 1

    removed = folders.unregister(str(tmp_path))
    assert removed["unregistered"] is True
    assert removed["removed"] == 1
    assert service.index.document_count() == 0


# ---------------------------------------------------------------------------
# 扫描面
# ---------------------------------------------------------------------------


def test_scan_buckets_are_exhaustive(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "note.md", "# 标题\n这是一段中文正文。")
    _write(tmp_path, "plain.txt", "纯文本一行。")
    _write(tmp_path, "page.html", "<html><title>网页标题</title><body><p>网页正文</p></body></html>")
    _write(tmp_path, "weird.zzz", "未知后缀内容")
    _write(tmp_path, "ignored/node_modules/dep.js", "should never be scanned")

    assert folders.register(str(tmp_path), include=[".md", ".txt", ".html", ".zzz"])["registered"]
    stats = folders.scan()

    # node_modules 被忽略目录剪掉，不进入 scanned。
    assert stats["scanned"] == 4
    assert stats["changed"] == 3
    assert stats["unsupported"] == 1
    assert stats["buckets_sum"] == stats["scanned"]
    reasons = [item["reason"] for item in stats["errors"]]
    assert "unsupported:.zzz" in reasons
    assert service.index.document_count() == 3


def test_binary_and_oversize_are_named(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    binary = tmp_path / "blob.md"
    binary.write_bytes(b"\x00\x01\x02binary")
    _write(tmp_path, "big.md", "x" * 64)
    monkeypatch.setattr(fi, "MAX_FILE_BYTES", 32)

    folders.register(str(tmp_path))
    stats = folders.scan()
    reasons = sorted(item["reason"] for item in stats["errors"])
    assert "binary" in reasons
    assert any(reason.startswith("too-large:") for reason in reasons)
    assert stats["failed"] == 1
    assert stats["too_large"] == 1


# ---------------------------------------------------------------------------
# 增量面
# ---------------------------------------------------------------------------


def test_second_scan_reads_no_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """核心断言：预筛命中时**不读盘**（extract 调用次数为 0），不是「读了再比 hash」。"""
    service = _service()
    folders = fi.FolderIngest(service)
    for index in range(3):
        _write(tmp_path, f"doc{index}.md", f"# 文档 {index}\n正文 {index}。")
    folders.register(str(tmp_path))
    folders.scan()

    calls: list[str] = []
    original = fi.extract_text

    def counting(path: str) -> tuple[str | None, str, str]:
        calls.append(path)
        return original(path)

    monkeypatch.setattr(fi, "extract_text", counting)
    second = folders.scan()

    assert calls == []
    assert second["scanned"] == 3
    assert second["unchanged"] == 3
    assert second["changed"] == 0


def test_changed_file_reindexes_only_itself(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "a.md", "# 甲\n苹果香蕉。")
    _write(tmp_path, "b.md", "# 乙\n樱桃李子。")
    folders.register(str(tmp_path))
    folders.scan()

    _write(tmp_path, "a.md", "# 甲\n苹果香蕉橘子。")
    stats = folders.scan()
    assert stats["changed"] == 1
    assert stats["unchanged"] == 1
    assert service.index.document_count() == 2


def test_deleted_from_index_is_rebuilt_not_skipped(tmp_path: Path) -> None:
    """mtime/size 没变但索引被删 ⇒ 必须重建，不许「假跳过」。"""
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "a.md", "# 甲\n正文。")
    folders.register(str(tmp_path))
    folders.scan()
    assert service.index.document_count() == 1

    service.remove_document(str(tmp_path / "a.md"))
    assert service.index.document_count() == 0

    stats = folders.scan()
    assert stats["changed"] == 1
    assert service.index.document_count() == 1


def test_force_rescan_bypasses_prefilter(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "a.md", "# 甲\n正文。")
    folders.register(str(tmp_path))
    folders.scan()

    forced = folders.scan(force=True)
    assert forced["scanned"] == 1
    assert forced["changed"] + forced["unchanged"] == 1


# ---------------------------------------------------------------------------
# 解析面
# ---------------------------------------------------------------------------


def test_html_title_becomes_heading(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        "page.html",
        "<html><head><title>季度报告</title></head>"
        "<body><script>var x=1</script><p>正文第一段</p></body></html>",
    )
    text, parser, reason = fi.extract_text(str(path))
    assert parser == "html"
    assert reason == ""
    assert text is not None
    assert text.startswith("季度报告")
    assert "正文第一段" in text
    assert "var x=1" not in text


def test_docx_extracts_paragraphs(tmp_path: Path) -> None:
    """docx 走标准库 zipfile，不依赖 python-docx。"""
    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<w:document xmlns:w="{ns}"><w:body>'
        f"<w:p><w:r><w:t>第一段</w:t></w:r></w:p>"
        f"<w:p><w:r><w:t>第二段</w:t></w:r></w:p>"
        f"</w:body></w:document>"
    )
    path = tmp_path / "report.docx"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("word/document.xml", body)

    text, parser, reason = fi.extract_text(str(path))
    assert parser == "docx-zipfile"
    assert reason == ""
    assert text is not None
    assert "第一段" in text and "第二段" in text


def test_unknown_suffix_is_named() -> None:
    text, parser, reason = fi.extract_text("no-such-file.zzz")
    assert text is None
    assert parser == "none"
    assert reason == "unsupported:.zzz"


# ---------------------------------------------------------------------------
# 消费面：knowledge_lookup 的 sag2 源
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_lookup_sag2_source_empty_index_is_silent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """空索引不是故障：返回空 hits，errors 里不许出现 sag2。"""
    service = _service()
    monkeypatch.setattr(
        "app.services.sag2_lexical.sag2_lexical_service", service, raising=True
    )
    result = await knowledge_lookup(
        "董事会额度", source_priority=["sag2"], top_k_per_source=3
    )
    assert [hit for hit in result.hits if hit.source == "sag2"] == []
    assert [err for err in result.errors if err["source"] == "sag2"] == []


@pytest.mark.asyncio
async def test_lookup_sag2_source_returns_cited_hits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = _service()
    service.add_document(
        "board.md",
        "2025 年董事会决议：年度研发额度 800 万，责任人王工。",
        title="董事会决议",
    )
    service.add_document(
        "spend.md",
        "王工牵头的向量检索项目第三季花掉 940 万，超上限 140 万。",
        title="第三季支出",
    )
    monkeypatch.setattr(
        "app.services.sag2_lexical.sag2_lexical_service", service, raising=True
    )

    result = await knowledge_lookup(
        "董事会定的那个额度，后来是谁用超了？",
        source_priority=["sag2"],
        top_k_per_source=5,
    )
    hits = [hit for hit in result.hits if hit.source == "sag2"]
    assert hits, "多跳检索应命中答案文档"
    assert all(hit.citations for hit in hits)
    joined = "\n".join(hit.content for hit in hits)
    assert "940 万" in joined


@pytest.mark.asyncio
async def test_lookup_default_priority_includes_sag2() -> None:
    """默认优先级里必须有 sag2，否则「接进主链路」只是口头承诺。"""
    assert "sag2" in lookup_module.DEFAULT_PRIORITY
    assert "sag2" in lookup_module._SUPPORTED_SOURCES


# ---------------------------------------------------------------------------
# watcher 面
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_watch_start_stop_is_idempotent(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    _write(tmp_path, "a.md", "# 甲\n正文。")
    folders.register(str(tmp_path))

    first = folders.start_watch(str(tmp_path), interval_s=60)
    assert first["watching"] is True
    second = folders.start_watch(str(tmp_path), interval_s=60)
    assert second["watching"] is True
    assert len(folders.list_folders()["watching"]) == 1

    stopped = folders.stop_watch(str(tmp_path))
    assert stopped["stopped"] is True
    assert folders.list_folders()["watching"] == []


# ---------------------------------------------------------------------------
# 持久化面
# ---------------------------------------------------------------------------


def test_state_roundtrip(tmp_path: Path) -> None:
    state = tmp_path / "state.json"
    docs = tmp_path / "docs"
    docs.mkdir()
    _write(docs, "a.md", "# 甲\n正文。")

    first = fi.FolderIngest(_service(), state_path=str(state))
    first.register(str(docs))
    first.scan()
    assert state.is_file()

    second = fi.FolderIngest(_service(), state_path=str(state))
    listed: list[dict[str, Any]] = second.list_folders()["folders"]
    assert [item["root"] for item in listed] == [str(docs)]
    assert second.fingerprint_count() == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
