# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: thread_item_payload protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.thread_item_payload import (
    THREAD_ITEM_DOMAIN,
    THREAD_ITEM_ELEMENTS,
    ThreadItemPayload,
    ThreadItemPayloadError,
    ensure_thread_item_payload,
    expected_thread_item_element_count,
    is_thread_item,
    thread_item_domain,
    thread_item_domain_members,
    thread_item_names,
    validate_thread_item,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert THREAD_ITEM_ELEMENTS == {"AgentMessage": 7, "CollabAgentToolCall": 9, "CommandExecution": 12, "ContextCompaction": 1, "DynamicToolCall": 8, "EnteredReviewMode": 2, "ExitedReviewMode": 2, "FileChange": 3, "FunctionCallOutput": 4, "HookPrompt": 2, "ImageView": 2, "McpToolCall": 13, "Plan": 2, "Reasoning": 3, "SubAgentActivity": 6, "UserMessage": 3}

    def test_closed_set_cardinality(self) -> None:
        assert len(ThreadItemPayload) == len(THREAD_ITEM_ELEMENTS) == 16

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ThreadItemPayload} == set(THREAD_ITEM_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in THREAD_ITEM_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(THREAD_ITEM_DOMAIN) == set(THREAD_ITEM_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('SubAgentActivity', 'agent'), ('ContextCompaction', 'context'), ('HookPrompt', 'hook'), ('AgentMessage', 'message'), ('EnteredReviewMode', 'review'), ('CollabAgentToolCall', 'tool')])
    def test_domain(self, name, expected) -> None:
        assert thread_item_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadItemPayloadError):
            thread_item_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(THREAD_ITEM_DOMAIN.values()):
            seen.extend(thread_item_domain_members(domain))
        assert sorted(seen) == sorted(THREAD_ITEM_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ThreadItemPayloadError):
            thread_item_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_thread_item(nm) for nm in THREAD_ITEM_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AgentMessage"
        assert first in THREAD_ITEM_ELEMENTS
        assert not is_thread_item(first.lower())
        assert not is_thread_item("bogus")

    def test_names_returns_copy(self) -> None:
        a = thread_item_names()
        a.append("bogus")
        assert "bogus" not in THREAD_ITEM_ELEMENTS
        assert set(thread_item_names()) == set(THREAD_ITEM_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(THREAD_ITEM_DOMAIN.values())))
        a = thread_item_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", THREAD_ITEM_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_thread_item(name, count) == name

    @pytest.mark.parametrize("name,count", THREAD_ITEM_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ThreadItemPayloadError, match="元素数应为"):
            validate_thread_item(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadItemPayloadError):
            ensure_thread_item_payload("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadItemPayloadError):
            expected_thread_item_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AgentMessage", "CollabAgentToolCall"):
            assert nm in THREAD_ITEM_ELEMENTS
            assert nm.lower() not in THREAD_ITEM_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(THREAD_ITEM_ELEMENTS.values())
        assert counts == {1, 2, 3, 4, 6, 7, 8, 9, 12, 13}
