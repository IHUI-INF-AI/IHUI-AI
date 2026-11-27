# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-07 总管人格：唯一真源、工具面点名、关键纪律在场。"""

from __future__ import annotations

from app.agents.master_profile import (
    MASTER_AGENT_NAME,
    MASTER_SYSTEM_PROMPT,
    MASTER_TOOL_NAMES,
)


def test_prompt_is_loaded_and_sized() -> None:
    assert MASTER_AGENT_NAME == "master"
    assert 1200 <= len(MASTER_SYSTEM_PROMPT) <= 12000


def test_prompt_names_three_tools_and_key_disciplines() -> None:
    for tool in MASTER_TOOL_NAMES:
        assert tool in MASTER_SYSTEM_PROMPT
    for phrase in ("APPROVAL_REQUIRED", "purge", "single", "memory_write"):
        assert phrase in MASTER_SYSTEM_PROMPT


def test_prompt_does_not_claim_fake_success() -> None:
    assert "不要假装" not in MASTER_SYSTEM_PROMPT
    assert "不要把失败包装成" in MASTER_SYSTEM_PROMPT
