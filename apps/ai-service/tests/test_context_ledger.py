"""批次 3:七类上下文账本(contextLedger)纯函数测试。

覆盖:
- 七类齐全、顺序固定、tokens 整数、percent 一位小数;
- 恒等式:前五类 + free_space + auto_compact == contextLimit(含超窗/零窗口边界);
- provider 上报 prompt_tokens 时 tokenizer=provider_usage 且 usedTokens 对齐;
- compacted / model / capturedAt 字段透传。
"""

from __future__ import annotations

from app.core.context_compaction import DEFAULT_TRIGGER_RATIO
from app.services.context_ledger import (
    CONTEXT_LEDGER_CATEGORIES,
    build_context_ledger,
)


def _ledger(**overrides):
    base = {
        "system_prompt_text": "你是智汇AI助手,回答要简洁。",
        "tool_schemas": [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "查询天气",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        ],
        "skill_texts": ["技能说明:遇到类名冲突先询问用户。"],
        "messages": [
            {"role": "user", "content": "北京天气怎么样?"},
            {"role": "assistant", "content": "我查一下。"},
        ],
        "attachments_or_other_text": "附件:fileA.txt(仅摘要)",
        "context_limit": 10_000,
        "model": "gpt-4o",
        "provider_prompt_tokens": None,
        "compacted": False,
    }
    base.update(overrides)
    return build_context_ledger(**base)


def _assert_ledger_shape(ledger: dict) -> None:
    assert [c["category"] for c in ledger["categories"]] == list(
        CONTEXT_LEDGER_CATEGORIES
    )
    for category in ledger["categories"]:
        assert isinstance(category["tokens"], int), category
        assert category["tokens"] >= 0, category
        assert isinstance(category["percent"], float), category
        # 一位小数(round(x,1) 的结果,最多一位)
        assert round(category["percent"], 1) == category["percent"], category
    total = sum(c["tokens"] for c in ledger["categories"])
    assert total == ledger["contextLimit"], "恒等式不成立"
    used = sum(
        c["tokens"]
        for c in ledger["categories"]
        if c["category"] not in ("free_space", "auto_compact")
    )
    assert ledger["usedTokens"] == used
    if ledger["contextLimit"] > 0:
        assert ledger["percentage"] == round(used / ledger["contextLimit"] * 100.0, 1)
        assert 0 <= ledger["percentage"] <= 100.0
    else:
        assert ledger["percentage"] == 0.0


def test_ledger_seven_categories_and_identity():
    """正常窗口:七类齐全、顺序固定、恒等式成立、压缩预留=12% 窗口。"""
    ledger = _ledger()

    assert ledger["model"] == "gpt-4o"
    assert ledger["contextLimit"] == 10_000
    assert ledger["tokenizer"] == "heuristic"
    assert ledger["compacted"] is False
    assert isinstance(ledger["capturedAt"], str) and ledger["capturedAt"]
    _assert_ledger_shape(ledger)

    by_name = {c["category"]: c for c in ledger["categories"]}
    # 七类都参与,不是只报"其它"
    assert by_name["system_prompt"]["tokens"] > 0
    assert by_name["system_tools"]["tokens"] > 0
    assert by_name["skills"]["tokens"] > 0
    assert by_name["messages"]["tokens"] > 0
    assert by_name["other"]["tokens"] > 0
    # 预留量:trigger 0.88 ⇒ 12% 窗口;空闲 = 窗口 - 已用 - 预留
    expected_reserve = int(10_000 * (1.0 - DEFAULT_TRIGGER_RATIO))
    assert by_name["auto_compact"]["tokens"] == expected_reserve
    assert (
        by_name["free_space"]["tokens"]
        == 10_000 - ledger["usedTokens"] - expected_reserve
    )


def test_ledger_provider_usage_aligns_used_tokens():
    """有 provider prompt_tokens:tokenizer=provider_usage,usedTokens 对齐 provider。"""
    ledger = _ledger(provider_prompt_tokens=3_000, compacted=True)
    assert ledger["tokenizer"] == "provider_usage"
    assert ledger["usedTokens"] == 3_000
    assert ledger["compacted"] is True
    _assert_ledger_shape(ledger)
    by_name = {c["category"]: c for c in ledger["categories"]}
    # messages 用 provider 口径倒推(而不是本地 BPE 估算的原值)
    assert by_name["messages"]["tokens"] > 0
    assert by_name["free_space"]["tokens"] == 10_000 - 3_000 - int(
        10_000 * (1.0 - DEFAULT_TRIGGER_RATIO)
    )


def test_ledger_overflow_keeps_identity():
    """估算总量超过窗口:free_space 钳 0,残差并入 other/前五类,恒等式仍成立。"""
    huge = "很长的一段上下文。" * 2000
    ledger = _ledger(
        system_prompt_text=huge,
        skill_texts=[huge],
        messages=[{"role": "user", "content": huge}],
        attachments_or_other_text=huge,
        context_limit=1_000,
    )
    _assert_ledger_shape(ledger)
    by_name = {c["category"]: c for c in ledger["categories"]}
    assert by_name["free_space"]["tokens"] == 0
    assert ledger["usedTokens"] <= 1_000


def test_ledger_zero_window_reports_all_zero():
    """窗口未知(limit<=0):七类全 0,恒等式 0==0,不拿 0 冒充 100%。"""
    ledger = _ledger(context_limit=0)
    assert ledger["contextLimit"] == 0
    assert ledger["usedTokens"] == 0
    assert ledger["percentage"] == 0.0
    _assert_ledger_shape(ledger)


def test_ledger_accepts_missing_categories_as_zero():
    """该链路不注入的类别传空/None ⇒ 计 0,不伪造。"""
    ledger = _ledger(
        tool_schemas=None,
        skill_texts=None,
        attachments_or_other_text="",
    )
    _assert_ledger_shape(ledger)
    by_name = {c["category"]: c for c in ledger["categories"]}
    assert by_name["system_tools"]["tokens"] == 0
    assert by_name["skills"]["tokens"] == 0
    assert by_name["other"]["tokens"] == 0
