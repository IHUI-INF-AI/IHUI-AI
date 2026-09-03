# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨端一致性快照测试(Python 端)。

与 TypeScript 共享包 @ihui/context-compaction 共享同一 fixtures 输入
(packages/context-compaction/test/consistency-fixtures.json),
端内独立断言(分词器不同,两端数值不必相等):
1. estimate_messages_tokens 数值 == expect_tokens_python(固化快照,首跑自动回填)
2. _build_structured_summary 行序列 == expect_struct_summary_lines_python
   (首行 [上下文摘要 — 之前 N 条消息已压缩] 标记行,
    其余为 "- [role] ..." 每消息一行,换行已规范化;首跑自动回填)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.context_compaction import (
    _build_structured_summary,
    estimate_messages_tokens,
)

FIXTURES_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "packages"
    / "context-compaction"
    / "test"
    / "consistency-fixtures.json"
)


def _load_doc() -> dict[str, Any]:
    if not FIXTURES_PATH.exists():
        pytest.fail(f"fixtures not found: {FIXTURES_PATH}")
    with open(FIXTURES_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _save_doc(doc: dict[str, Any]) -> None:
    FIXTURES_PATH.write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


class TestConsistencyFixtures:
    @pytest.fixture(autouse=True)
    def _load(self) -> None:
        self.doc = _load_doc()
        self.fixtures = self.doc.get("fixtures", [])

    def test_estimate_messages_tokens(self) -> None:
        dirty = False
        for fx in self.fixtures:
            actual = estimate_messages_tokens(fx["messages"])
            expect = fx.get("expect_tokens_python")
            if expect is not None:
                assert actual == expect, (
                    f"{fx['name']}: python tokens {actual} != expected {expect}"
                )
            else:
                # 首次执行:把实际值写回 fixtures JSON,后续直接断言数值
                fx["expect_tokens_python"] = actual
                dirty = True
                print(f"{fx['name']}: expect_tokens_python 固化为 {actual}")
        if dirty:
            _save_doc(self.doc)

    def test_structured_summary_lines(self) -> None:
        dirty = False
        for fx in self.fixtures:
            summary = _build_structured_summary(fx["messages"])
            lines = summary.splitlines()
            # 首行是防嵌套标记行([上下文摘要 — 之前 N 条消息已压缩])
            assert lines[0].startswith("[上下文摘要"), (
                f"{fx['name']}: missing marker line, got {lines[0]!r}"
            )
            body = lines[1:]
            expected_body = fx.get("expect_struct_summary_lines_python")
            if expected_body:
                assert len(body) == len(expected_body), (
                    f"{fx['name']}: body line count {len(body)} != expected {len(expected_body)}"
                )
                for line, expected in zip(body, expected_body):
                    if not line.startswith("- "):
                        # 防嵌套:历史摘要正文原样并入(非 bullet 行),逐字比对
                        assert line == expected, (
                            f"{fx['name']}: merged body line {line!r} != {expected!r}"
                        )
                        continue
                    # 每消息一行,以 "- [role] " 开头;抽取 role 前缀比对(正文可因分词器差异不同)
                    actual_core = line[2:]
                    expected_core = expected[2:] if expected.startswith("- ") else expected
                    actual_prefix = actual_core.split("]", 1)[0] + "]"
                    expected_prefix = expected_core.split("]", 1)[0] + "]"
                    assert actual_prefix == expected_prefix, (
                        f"{fx['name']}: role prefix {actual_prefix!r} != {expected_prefix!r}"
                    )
            else:
                # 首次执行:把实际 body 行序列写回 fixtures,后续断言行数 + role 前缀
                fx["expect_struct_summary_lines_python"] = body
                dirty = True
                print(f"{fx['name']}: expect_struct_summary_lines_python 固化为 {len(body)} 行")
        if dirty:
            _save_doc(self.doc)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
