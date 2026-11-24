# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""分层安全扫描档位 L1/L2/L3 + 事件绑定(round 8 实现席 C)行为锁。

立因
----
复现对照 Qoder CodeSec「事件 → 扫描档」的设计,并用测试把行为钉住(§0.12)。
测试只 import 生产 ``app.core.security_scan_tiers`` 的公开出口 + 喂输入,
**不在测试里重写任何分档判据**(§0.6 单一真相源:判据只有生产那一份)。

判据
----
覆盖:档位矩阵(Edit/Write→l1、Bash(git push *)→l3、未知工具→unjudged)、
配置缺键、规则集取不到、空 subject、类型错、l1 默认开不可静默关、
build_finding 三元组可追溯、decide 与 build_finding 单源投影一致、结果值域封闭。

刻意不做什么
------------
- 不连生产库/不发进程/不读配置文件:config 全部用例内构造,纯函数直测。
- 不 import pytest 特性:普通函数 + assert,零新增依赖。
- ``test_missing_config_key_fails_closed`` 是**反向变异验证的转红锚点**:
  把生产 ``_config_gate`` 的「缺键 ⇒ return 原因」分支放行后,本用例必须从绿转红。
"""

from app.core.security_scan_tiers import (
    ALL_OUTCOMES,
    EVENT_BASE_TIER,
    REQUIRED_CONFIG_KEYS,
    TIER_L1,
    TIER_L2,
    TIER_L3,
    UNJUDGED,
    Finding,
    build_finding,
    decide_scan_tier,
)


def _cfg():
    """一份完整的合法配置(每例新建, 不共享可变状态)。"""
    return {
        "tiers": {"l1": True, "l2": True, "l3": True},
        "rulesets": {
            "l2": ["no-hardcoded-key", "no-raw-sql"],
            "l3": ["push-audit"],
        },
    }


# ---------------------------------------------------------------------------
# 档位矩阵
# ---------------------------------------------------------------------------
def test_tier_matrix_l1_edit_and_read_family():
    """编辑类(对照 matcher)与只读类 → l1:只读实时扫描、默认开、不需规则集。"""
    for event in ("Edit", "Write", "MultiEdit", "NotebookEdit", "Read", "Grep", "Glob"):
        assert decide_scan_tier(event, "app/core/x.py", _cfg()) == TIER_L1, event
    # 即便规则集为空, l1 也照常判定(不依赖规则集)。
    empty_rules = {"tiers": {}, "rulesets": {}}
    assert decide_scan_tier("Write", "notes.md", empty_rules) == TIER_L1


def test_tier_matrix_l3_high_risk_subject():
    """Bash(git push *)→l3;删除/凭据类同样 l3;高危强制覆盖无视事件绑定。"""
    for subject in (
        "git push origin main",
        "git push *",
        "rm -rf build",
        "cat .env",
        "cat .env.production",
        "echo password=hunter2",
    ):
        assert decide_scan_tier("Bash", subject, _cfg()) == TIER_L3, subject
    # 高危覆盖跨工具:Edit 基础档是 l1, 但 subject 是 push ⇒ 强制升 l3。
    assert decide_scan_tier("Edit", "git push --force", _cfg()) == TIER_L3
    # 命中规则名可追溯。
    assert build_finding("Bash", "git push origin main", _cfg()).rule == "high_risk.push"


def test_tier_matrix_l2_execution_with_ruleset():
    """执行类非高危 + 规则集齐备 → l2(需规则集深审)。"""
    for subject in ("ls -la", "git status", "pytest -q"):
        assert decide_scan_tier("Bash", subject, _cfg()) == TIER_L2, subject
    f = build_finding("Bash", "ls -la", _cfg())
    assert f.tier == TIER_L2
    assert f.rule == "event.l2_ruleset"
    assert "2" in f.evidence  # 命中 l2 规则集条数


def test_unknown_tool_unjudged():
    """未知工具无事件绑定 ⇒ unjudged 并点名原因, 绝不猜档/放行。"""
    for event in ("Frobnicate", "UnknownTool", "bash"):
        assert decide_scan_tier(event, "anything", _cfg()) == UNJUDGED, event
    f = build_finding("Frobnicate", "anything", _cfg())
    assert f.tier == UNJUDGED
    assert f.rule == "event.unknown"
    assert "未知工具" in f.evidence


# ---------------------------------------------------------------------------
# 未判定面(§0.3 / §0.10)
# ---------------------------------------------------------------------------
def test_missing_config_key_fails_closed():
    """配置缺任一必需键 / 空配置 ⇒ unjudged 不放行。

    【反向变异验证转红锚点】把生产 ``_config_gate`` 的「缺键 ⇒ return 原因」分支
    注释/放行后, 缺键 config 会干净地落到 l1, 本用例应从绿转红。
    """
    for key in REQUIRED_CONFIG_KEYS:
        partial = {k: v for k, v in _cfg().items() if k != key}
        assert decide_scan_tier("Edit", "app.py", partial) == UNJUDGED, key
    assert decide_scan_tier("Edit", "app.py", {}) == UNJUDGED
    f = build_finding("Edit", "app.py", {"tiers": {}})
    assert f.tier == UNJUDGED
    assert f.rule == "config.gate"
    assert "缺必需键" in f.evidence  # 点名原因


def test_config_shape_bad_unjudged():
    """键在但形状坏(非映射) ⇒ unjudged, 不折成「该档没规则」。"""
    for bad in ({"tiers": [], "rulesets": {}}, {"tiers": {}, "rulesets": "oops"}):
        assert decide_scan_tier("Edit", "app.py", bad) == UNJUDGED, bad


def test_ruleset_unavailable_unjudged():
    """l2 规则集取不到(缺/空/形状坏) ⇒ unjudged 而非放行(超越轴 2)。"""
    for rulesets in ({}, {"l2": []}, {"l2": None}, {"l2": "not-a-list"}):
        cfg = {"tiers": {}, "rulesets": rulesets}
        assert decide_scan_tier("Bash", "ls -la", cfg) == UNJUDGED, rulesets
    f = build_finding("Bash", "ls -la", {"tiers": {}, "rulesets": {}})
    assert f.tier == UNJUDGED
    assert f.rule == "ruleset.l2_unavailable"
    assert "规则集取不到" in f.evidence


def test_empty_subject():
    """空 subject:l1 只读扫描不依赖 subject 仍判 l1;执行类因高危没量到判 unjudged。"""
    assert decide_scan_tier("Edit", "", _cfg()) == TIER_L1
    assert decide_scan_tier("Write", "   ", _cfg()) == TIER_L1
    f = build_finding("Bash", "", _cfg())
    assert f.tier == UNJUDGED
    assert f.rule == "subject.empty_for_highrisk"
    assert "没量到" in f.evidence  # 点名原因


def test_type_errors_unjudged():
    """event/subject/config 类型错 ⇒ unjudged 并点名, 绝不静默放行。"""
    for event, subject, config in (
        (123, "x", _cfg()),
        (None, "x", _cfg()),
        ("Edit", None, _cfg()),
        ("Edit", 5, _cfg()),
        ("Edit", "x", []),
        ("Edit", "x", "not-a-mapping"),
        ("Edit", "x", None),
    ):
        f = build_finding(event, subject, config)
        assert f.tier == UNJUDGED, (event, subject, config)
        assert f.rule in ("input.type", "config.type")
        assert f.evidence  # 类型错也点名原因


def test_event_empty_unjudged():
    """event 空串/纯空白 ⇒ 取不到事件名 ⇒ unjudged。"""
    for event in ("", "   "):
        assert decide_scan_tier(event, "x", _cfg()) == UNJUDGED, repr(event)


# ---------------------------------------------------------------------------
# 一轴超越 + 结构化 verdict + 单源
# ---------------------------------------------------------------------------
def test_l1_default_on_cannot_be_silenced():
    """超越轴 1:对照三档默认全 false;我方 l1 默认开且不读开关值(不可静默关)。"""
    cfg = _cfg()
    cfg["tiers"]["l1"] = False
    cfg["tiers"]["l2"] = False
    cfg["tiers"]["l3"] = False
    assert decide_scan_tier("Edit", "app.py", cfg) == TIER_L1
    # l3 强制同样不看开关:全 false 下 push 仍 l3。
    assert decide_scan_tier("Bash", "git push origin main", cfg) == TIER_L3


def test_build_finding_triple_is_structured_verdict():
    """build_finding 是 (tier, rule, evidence) 三元组;decide 是它的 .tier 投影(单源)。"""
    cases = [
        ("Edit", "app.py", _cfg()),
        ("Bash", "git push origin main", _cfg()),
        ("Bash", "ls -la", _cfg()),
        ("Bash", "ls -la", {"tiers": {}, "rulesets": {}}),
        ("Nope", "x", _cfg()),
        ("Edit", "x", {"tiers": {}}),
        (123, "x", _cfg()),
    ]
    for event, subject, config in cases:
        f = build_finding(event, subject, config)
        assert isinstance(f, Finding)
        assert isinstance(f, tuple)
        assert len(f) == 3
        assert all(isinstance(part, str) and part for part in f)
        assert f.tier in ALL_OUTCOMES
        # 判据单源:decide 恒等于 build_finding 的 tier, 不另算一遍。
        assert decide_scan_tier(event, subject, config) == f.tier, (event, subject)


def test_event_binding_table_and_closed_outcomes():
    """事件绑定表与结果值域是封闭集合;所有判定落在其内。"""
    assert set(EVENT_BASE_TIER.values()) <= {TIER_L1, TIER_L2, TIER_L3}
    assert {TIER_L1, TIER_L2, TIER_L3, UNJUDGED} == ALL_OUTCOMES
    assert {"tiers", "rulesets"} == REQUIRED_CONFIG_KEYS
    for event in EVENT_BASE_TIER:
        assert decide_scan_tier(event, "plain subject", _cfg()) in ALL_OUTCOMES
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
