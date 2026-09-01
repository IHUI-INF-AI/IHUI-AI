# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""TS/Python 跨端 parity 快照测试(Python 消费端)。

消费共享 fixture packages/context-compaction/tests/fixtures/parity.json,
对 app.core.context_compaction.compress_messages_if_needed 断言全部 expectations,
与 apps/cli/tests/parity-fixture.test.ts 锁死两端语义一致。

fixture 的 expectations 由 TS 端 compressContextIfNeeded 真实输出人工核算
(见 fixture._comment),input 远离阈值边界:走 kr=6 规则摘要路径,
不触发 truncated/incompressible 降级。
"""

import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

from app.core.context_compaction import SUMMARY_MARKER, compress_messages_if_needed

# 相对定位 fixture:tests → ai-service → apps → 仓库根 → packages/context-compaction/tests/fixtures
FIXTURE_PATH = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "context-compaction"
    / "tests"
    / "fixtures"
    / "parity.json"
)


def _load_fixture() -> Dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _run_compaction(fixture: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """跑 Python 端压缩(参数名映射:contextLimit→context_limit, keepRecent→keep_recent)。"""
    messages: List[Dict[str, Any]] = fixture["input"]["messages"]
    options: Dict[str, Any] = fixture["input"]["options"]
    return compress_messages_if_needed(
        messages,
        context_limit=options["contextLimit"],
        keep_recent=options["keepRecent"],
    )


def _find_summary_msg(compressed: List[Dict[str, Any]]) -> Dict[str, Any]:
    """定位摘要消息(role='user' 且 content 以 SUMMARY_MARKER 开头)。"""
    for msg in compressed:
        content = msg.get("content")
        if msg.get("role") == "user" and isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            return msg
    raise AssertionError("压缩结果中未找到摘要消息")


class TestContextParity:
    """共享 fixture 双端一致性(与 TS 端 parity-fixture.test.ts 同一套断言)。"""

    def test_fixture_structure(self) -> None:
        """fixture 文件存在且结构完整。"""
        fixture = _load_fixture()
        assert len(fixture["input"]["messages"]) > 0
        assert fixture["input"]["options"]["contextLimit"] == 32000
        assert fixture["input"]["options"]["keepRecent"] == 6
        assert len(fixture["expectations"]) == 7

    def test_triggered_ratio_path(self) -> None:
        """触发压缩且走 ratio 规则摘要路径(非降级)。"""
        _, info = _run_compaction(_load_fixture())
        assert info["compressed"] is True
        assert info["trigger"] == "ratio"

    def test_output_role_sequence(self) -> None:
        """outputRoleSequence: system + 摘要(user) + 近端 6 条。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        roles = [msg["role"] for msg in compressed]
        assert roles == fixture["expectations"]["outputRoleSequence"]

    def test_summary_marker_line(self) -> None:
        """summaryMarkerLine: 标记行与 expectations 逐字节一致。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        content = str(_find_summary_msg(compressed)["content"])
        marker_line = content.split("\n", 1)[0]
        assert marker_line == fixture["expectations"]["summaryMarkerLine"]

    def test_summary_body_line_count(self) -> None:
        """summaryBodyLineCount: 摘要正文行数一致。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        content = str(_find_summary_msg(compressed)["content"])
        body = content.split("\n", 1)[1]
        assert len(body.split("\n")) == fixture["expectations"]["summaryBodyLineCount"]

    def test_no_orphan_tool_messages(self) -> None:
        """noOrphanToolMessages: 输出无孤 tool 消息(每个 tool 都有前置匹配的 tool_calls)。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        declared_ids: set = set()
        no_orphan = True
        for msg in compressed:
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    if isinstance(tc, dict) and isinstance(tc.get("id"), str):
                        declared_ids.add(tc["id"])
            elif msg.get("role") == "tool":
                tool_call_id = msg.get("tool_call_id")
                if not isinstance(tool_call_id, str) or tool_call_id not in declared_ids:
                    no_orphan = False
        assert no_orphan == fixture["expectations"]["noOrphanToolMessages"]

    def test_recent_tier_count(self) -> None:
        """recentTierCount: 近层直截行数(以 … 结尾)一致。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        content = str(_find_summary_msg(compressed)["content"])
        body = content.split("\n", 1)[1]
        recent_lines = [line for line in body.split("\n") if line.endswith("…")]
        assert len(recent_lines) == fixture["expectations"]["recentTierCount"]

    def test_recent_tier_first_200_chars_present(self) -> None:
        """recentTierFirst200CharsPresent: 近层各消息前 200 chars 在摘要正文中。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        content = str(_find_summary_msg(compressed)["content"])
        body = content.split("\n", 1)[1]
        expectations = fixture["expectations"]
        messages: List[Dict[str, Any]] = fixture["input"]["messages"]
        options: Dict[str, Any] = fixture["input"]["options"]
        # 被压缩区 = non-system 前 coveredCountTotal 条(尾部 keepRecent 条保留)
        non_system = [m for m in messages if m.get("role") != "system"]
        to_compress = non_system[: len(non_system) - options["keepRecent"]]
        recent_tier_size = max(1, math.ceil(expectations["coveredCountTotal"] * 0.3))
        recent_tier = to_compress[-recent_tier_size:]
        all_present = all(
            not isinstance(msg.get("content"), str)
            or len(msg["content"]) == 0
            or msg["content"][:200] in body
            for msg in recent_tier
        )
        assert all_present == expectations["recentTierFirst200CharsPresent"]

    def test_covered_count_total(self) -> None:
        """coveredCountTotal: 标记行覆盖条数一致。"""
        fixture = _load_fixture()
        compressed, _ = _run_compaction(fixture)
        content = str(_find_summary_msg(compressed)["content"])
        matched = re.search(r"之前 (\d+) 条消息已压缩", content)
        assert matched is not None
        assert int(matched.group(1)) == fixture["expectations"]["coveredCountTotal"]
