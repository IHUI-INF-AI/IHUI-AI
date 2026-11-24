# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""第 50 轮:citations 事件的 url 纪律(有真实目标才发,取不到就不给"点不动的假链接")。

纯函数用例,不碰 DB / 网络(测试隔离铁律)。
"""

from app.routers.llm import _citation_url, _collect_citations


def _hist(hits: list[dict], *, error: bool = False) -> list[dict]:
    return [{"toolName": "knowledge_lookup", "isError": error, "result": {"hits": hits}}]


def test_codebase_hit_exposes_repo_relative_path_as_url() -> None:
    out = _collect_citations(
        _hist(
            [
                {
                    "source": "codebase",
                    "citations": ["AGENTS.md §3"],
                    "raw": {"file_path": "docs/AGENTS.md"},
                }
            ]
        )
    )
    assert out == [{"source": "codebase", "label": "AGENTS.md §3", "url": "docs/AGENTS.md"}]


def test_hit_without_any_link_target_omits_url_key() -> None:
    out = _collect_citations(
        _hist([{"source": "rag", "citations": ["某段记忆"], "raw": {"score": 0.41}}])
    )
    assert out == [{"source": "rag", "label": "某段记忆"}]
    assert "url" not in out[0]


def test_explicit_url_wins_for_any_source() -> None:
    out = _collect_citations(
        _hist(
            [
                {
                    "source": "knowledge_cards",
                    "citations": ["卡片 A"],
                    "raw": {"url": "https://aizhs.top/k/a", "file_path": "ignored.md"},
                }
            ]
        )
    )
    assert out[0]["url"] == "https://aizhs.top/k/a"


def test_absolute_paths_are_normalized_to_relative() -> None:
    # 绝对路径直接进 href 会指向用户本机文件系统,必须削成仓库相对路径
    assert _citation_url("codebase", {"file_path": "/etc/passwd"}) == "etc/passwd"
    assert _citation_url("codebase", {"file_path": "C:\\repo\\a.md"}) == "C:\\repo\\a.md"


def test_non_codebase_source_ignores_bare_file_path() -> None:
    # graph/rag 的 raw.path 是实体路径数组之类,不是文件 —— 只有 codebase 才认 file_path
    assert _citation_url("graph", {"path": ["A", "B"]}) is None


def test_dedupe_key_stays_source_and_label() -> None:
    hits = [
        {"source": "codebase", "citations": ["同名段落"], "raw": {"file_path": "a.md"}},
        {"source": "codebase", "citations": ["同名段落"], "raw": {"file_path": "b.md"}},
    ]
    out = _collect_citations(_hist(hits))
    assert len(out) == 1
    assert out[0]["url"] == "a.md"


def test_errored_tool_and_missing_raw_still_produce_citation_without_url() -> None:
    assert _collect_citations(_hist([{"source": "codebase", "citations": ["x"]}], error=True)) == []
    out = _collect_citations(_hist([{"source": "codebase", "citations": ["x"], "raw": None}]))
    assert out == [{"source": "codebase", "label": "x"}]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
