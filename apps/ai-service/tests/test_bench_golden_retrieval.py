# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Apache-2.0 须保留本声明与 NOTICE。
"""bench KB 检索金标集归档校验测试(2026-10-26 立)。

`bench/fixtures_golden/golden_retrieval_kb.jsonl` 是从 kb-rag 评测骨架归档的
KB 检索金标集:264 条问答,来自 4 篇真实仓库文档(faq / architecture /
enterprise-deploy / blog-rag-pgvector),expected_chunk_ids 用父块 ID。
本文件是这套 fixture 的常驻尺子,守三件事:

1. 存续 + schema:文件存在,且 `validate_golden_set` 对该路径零 issue;
2. 规模与形态:条目数 == 264,每条 `expected_chunk_ids` 非空且全为
   父块 ID 形态(16 位小写十六进制);
3. 抽样一致性:第 1/100/264 条的 `question_id` 与归档时一致
   (防内容被换、被截断或顺序被打乱)。

零网络、零 LLM、零数据库,纯本地文件断言(符合测试隔离铁律)。
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.retrieval_eval import validate_golden_set

# =============================================================================
# 归档常量(写死于 2026-10-26 归档时点)
# =============================================================================

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
GOLDEN_FILE = AI_SERVICE_ROOT / "bench" / "fixtures_golden" / "golden_retrieval_kb.jsonl"

EXPECTED_TOTAL = 264
# 父块 ID 契约(kb-rag 骨架):16 位小写十六进制
PARENT_CHUNK_ID_RE = re.compile(r"^[0-9a-f]{16}$")

# 抽样锚点:第 1/100/264 条的 question_id(归档时从文件读定后写死)
SAMPLE_QUESTION_IDS = {
    1: "q-f67dfb4b4448",
    100: "q-d947b12aac56",
    264: "q-1194d4444087",
}


@pytest.fixture(scope="module")
def validation():
    """整轮只校验一次(264 行逐行 parse,复用同一结果)。"""
    return validate_golden_set(GOLDEN_FILE)


# =============================================================================
# 存续 + schema 校验
# =============================================================================


class TestFixturePresence:
    def test_fixture_file_exists(self):
        assert GOLDEN_FILE.is_file(), f"金标集 fixture 缺失: {GOLDEN_FILE}"

    def test_validate_golden_set_zero_issues(self, validation):
        assert validation.ok, validation.report_text()
        assert validation.issues == []


# =============================================================================
# 规模与形态
# =============================================================================


class TestFixtureShape:
    def test_item_count_matches_archive(self, validation):
        assert validation.total_lines == EXPECTED_TOTAL
        assert len(validation.items) == EXPECTED_TOTAL

    def test_expected_chunk_ids_nonempty_parent_form(self, validation):
        for idx, item in enumerate(validation.items, start=1):
            assert item.expected_chunk_ids, (
                f"第 {idx} 条 {item.question_id}: expected_chunk_ids 为空"
            )
            for cid in item.expected_chunk_ids:
                assert PARENT_CHUNK_ID_RE.match(cid), (
                    f"第 {idx} 条 {item.question_id}: {cid!r} 不是父块 ID"
                    "(应为 16 位小写十六进制)"
                )


# =============================================================================
# 抽样一致性
# =============================================================================


class TestSampleConsistency:
    def test_sample_question_ids_stable(self, validation):
        for line_no, qid in SAMPLE_QUESTION_IDS.items():
            assert validation.items[line_no - 1].question_id == qid, (
                f"第 {line_no} 条 question_id 与归档锚点不符"
            )
