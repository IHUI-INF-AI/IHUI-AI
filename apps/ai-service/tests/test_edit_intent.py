# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨文件编辑意图一致性 + commandExecution 分级(round 9 实现席 B)行为锁。

立因
----
复现对照 Qoder「跨文件编辑意图」与 DSH「命令执行分级」的设计,并用测试把行为钉住
(§0.12)。测试只 import 生产 ``app.core.edit_intent`` 的公开出口 + 喂输入,**不在测试里
重写任何判据**(§0.6 单一真相源:判据只有生产那一份)。

判据
----
覆盖:正常多文件编辑 / 单文件缺读证据 / 路径穿越与注入 / 冲突写 / 空 intent / 类型错 /
命令各档 / 管道·引号·大小写绕过 / 策略缺键 / 高危命令未绑定确认 / 两判据联动 /
当轮指纹 diverged / 封闭值域 / 结构化 reason / 纯函数 / 解析授权合一(半态拒绝)。

刻意不做什么
------------
- 不连生产库/不发进程/不读配置文件:intent/policy 全部用例内构造,纯函数直测。
- 不 import pytest 特性:普通函数 + assert,零新增依赖。
- ``test_single_file_missing_read_evidence_unjudged`` 与
  ``test_two_judgements_binding_denies_high_risk`` 分别是**反向变异验证的转红锚点**:
  把生产对应判据分支放行/禁用后,本两例应从绿转红。
"""

from app.core.edit_intent import (
    ALL_COMMAND_TIERS,
    ALL_EDIT_OUTCOMES,
    CONSISTENT,
    DENIED,
    DIVERGED,
    REQUIRED_EDIT_POLICY_KEYS,
    REQUIRED_RULESET_TIERS,
    TIER_DESTRUCTIVE,
    TIER_READ,
    TIER_UNJUDGED,
    TIER_WRITE,
    classify_command_execution,
    default_rulesets,
    evaluate_edit_intent,
)

SHA_A = "a" * 64
SHA_B = "b" * 64


def _file(path="app/core/a.py", sha=SHA_A, action="edit"):
    """单个待写文件条目(每例新建, 不共享可变状态)。"""
    return {"path": path, "read_evidence_sha256": sha, "action": action}


def _consistent_pair(command="git status", files=None):
    """一份「全判据通过」的 (intent, policy):两文件指纹齐备、基准对齐、无冲突、命令只读。"""
    if files is None:
        files = [
            _file("app/core/a.py", SHA_A),
            _file("app/core/b.py", SHA_B),
        ]
    intent = {"id": "intent-1", "files": files, "command": command}
    policy = {
        "rulesets": default_rulesets(),
        "write_claims": {},
        "expected_read_evidence": {
            "app/core/a.py": SHA_A,
            "app/core/b.py": SHA_B,
        },
    }
    return intent, policy


def _cmd_policy(rulesets=None):
    """只测命令分级用的最小策略(仅需 rulesets)。"""
    return {"rulesets": default_rulesets() if rulesets is None else rulesets}


# ---------------------------------------------------------------------------
# 编辑意图:正常 / 缺读证据 / 路径 / 冲突 / 形状
# ---------------------------------------------------------------------------
def test_consistent_multi_file_edit():
    """正常多文件编辑:每文件有当轮读证据、路径合法、无冲突、命令非高危 ⇒ consistent。"""
    intent, policy = _consistent_pair()
    r = evaluate_edit_intent(intent, policy)
    assert r["verdict"] == CONSISTENT
    assert r["id"] == "intent-1"
    assert not r["reasons"]
    assert r["requires_confirmation"] is False
    assert r["command_classification"]["tier"] == TIER_READ
    # 两文件读证据维都真的判过(授权层完整执行, 不是半态)。
    current = [f for f in r["findings"] if f["check"] == "read_evidence.current"]
    assert len(current) == 2 and all(f["status"] == "ok" for f in current)


def test_single_file_missing_read_evidence_unjudged():
    """read_evidence_sha256 为空 ⇒ unjudged 而非放行(§0.3);空串/None 两形态都钉住。

    【反向变异验证转红锚点 A】把生产 ``evaluate_edit_intent`` 里
    ``read_evidence.present`` 分支的 if 放行后, 空证据会落到「与本轮基准比对」判成
    diverged, 本用例应从绿转红。
    """
    for empty in ("", None):
        intent, policy = _consistent_pair()
        intent["files"][0]["read_evidence_sha256"] = empty
        r = evaluate_edit_intent(intent, policy)
        assert r["verdict"] == TIER_UNJUDGED, empty
        assert any("读证据" in x or "指纹" in x for x in r["reasons"])
        present = [f for f in r["findings"] if f["check"] == "read_evidence.present"]
        assert present and present[0]["status"] == "unjudged"


def test_path_injection_denied():
    """../、绝对路径、Windows 盘符、UNC、NUL 等路径注入 ⇒ denied(表驱动)。"""
    for path in (
        "../etc/passwd",
        "app/../../etc/passwd",
        "/etc/passwd",
        "\\Windows\\System32",
        "C:\\Windows\\win.ini",
        "//server/share",
        "app/core/a\x00.py",
    ):
        intent, policy = _consistent_pair(files=[_file(path=path)])
        r = evaluate_edit_intent(intent, policy)
        assert r["verdict"] == DENIED, path
        assert any("注入" in x for x in r["reasons"])
        assert any(
            f["check"] == "path.injection" and f["status"] == "denied" for f in r["findings"]
        )


def test_conflicting_write_denied():
    """同一路径被两个不同 intent 写 ⇒ denied;同一个 intent 声明写不算冲突。"""
    intent, policy = _consistent_pair()
    policy["write_claims"] = {"app/core/a.py": "intent-OTHER"}
    r = evaluate_edit_intent(intent, policy)
    assert r["verdict"] == DENIED
    assert any("冲突" in x for x in r["reasons"])

    intent2, policy2 = _consistent_pair()
    policy2["write_claims"] = {"app/core/a.py": "intent-1"}  # 与自己同 id, 不是两个不同 intent
    assert evaluate_edit_intent(intent2, policy2)["verdict"] == CONSISTENT


def test_empty_intent_and_shape_errors_unjudged():
    """空 intent / 缺字段 / files 空 / id 空 / files 非列表 / command 非串 ⇒ unjudged 并点名。"""
    _, policy = _consistent_pair()
    cases = [
        {},
        {"id": "x", "files": []},
        {"id": "x", "command": "git status"},
        {"files": [], "command": "git status"},
        {"id": "x", "files": [], "command": "git status"},
        {"id": "", "files": [_file()], "command": "git status"},
        {"id": "x", "files": "not-a-list", "command": "git status"},
        {"id": "x", "files": [_file()], "command": 123},
    ]
    for intent in cases:
        r = evaluate_edit_intent(intent, policy)
        assert r["verdict"] == TIER_UNJUDGED, intent
        assert r["reasons"] and all(isinstance(x, str) and x for x in r["reasons"])
        assert any(f["check"] == "input.shape" for f in r["findings"])


def test_intent_field_type_errors_unjudged():
    """intent/file 项字段类型错 / 缺子字段 / policy 非映射 ⇒ unjudged。"""
    _, policy = _consistent_pair()
    bad_files = [
        [42],
        [{"path": 5, "read_evidence_sha256": SHA_A, "action": "edit"}],
        [{"path": "a.py", "read_evidence_sha256": 123, "action": "edit"}],
        [{"path": "a.py", "action": "edit"}],
        [{"path": "a.py", "read_evidence_sha256": SHA_A}],
    ]
    cases = [None, [], "not-a-mapping"] + [
        {"id": "x", "files": bf, "command": "git status"} for bf in bad_files
    ]
    for intent in cases:
        r = evaluate_edit_intent(intent, policy)
        assert r["verdict"] == TIER_UNJUDGED
        assert r["reasons"]
    intent, _ = _consistent_pair()
    assert evaluate_edit_intent(intent, "not-a-policy")["verdict"] == TIER_UNJUDGED


# ---------------------------------------------------------------------------
# 命令分级:各档 / 绕过 / 未判定 / 策略门 / 强制确认
# ---------------------------------------------------------------------------
def test_command_tier_matrix():
    """read/write/destructive 三档表驱动;destructive 必带 requires_confirmation=True。"""
    cases = [
        ("git status", TIER_READ),
        ("git log --oneline", TIER_READ),
        ("ls -la", TIER_READ),
        ("cat notes.txt", TIER_READ),
        ("pwd", TIER_READ),
        ("git add .", TIER_WRITE),
        ("git commit -m 'x'", TIER_WRITE),
        ("cp a b", TIER_WRITE),
        ("mv x y", TIER_WRITE),
        ("mkdir build", TIER_WRITE),
        ("git push origin main", TIER_DESTRUCTIVE),
        ("rm -rf build", TIER_DESTRUCTIVE),
        ("del /f a.txt", TIER_DESTRUCTIVE),
        ("git push --force", TIER_DESTRUCTIVE),
        ("cat .env", TIER_DESTRUCTIVE),
        ("echo password=hunter2", TIER_DESTRUCTIVE),
    ]
    for command, expected in cases:
        r = classify_command_execution(command, _cmd_policy())
        assert r["tier"] == expected, (command, r)
        assert r["tier"] in ALL_COMMAND_TIERS
        assert r["rule"] and r["evidence"]
        if expected == TIER_DESTRUCTIVE:
            assert r["requires_confirmation"] is True
        else:
            assert r["requires_confirmation"] is False


def test_command_pipeline_bypass_destructive():
    """管道/连接符/命令替换把高危词藏在后段:全段扫描仍判 destructive。"""
    for command in (
        "echo ok | rm -rf /",
        "true && git push --force",
        "git status; del /f a.txt",
        "echo ok || rm file",
        "echo $(rm -rf /tmp/x)",
    ):
        r = classify_command_execution(command, _cmd_policy())
        assert r["tier"] == TIER_DESTRUCTIVE, (command, r)
        assert r["requires_confirmation"] is True


def test_command_quote_and_case_bypass():
    """引号拆词 + 大小写变形:归一化后高危词仍命中 destructive。"""
    for command in (
        'g"it" push --force',
        "GIT PUSH --FORCE",
        "r'm' -rf build",
        'd"el" /f a.txt',
        "CAT .ENV",
    ):
        r = classify_command_execution(command, _cmd_policy())
        assert r["tier"] == TIER_DESTRUCTIVE, (command, r)
        assert r["evidence"]


def test_command_no_rule_and_empty_unjudged():
    """未命中任何规则 / 空命令 / 类型错 ⇒ unjudged 并点名(§0.3 形状不认不放行)。"""
    for command in ("frobnicate --xyz", "zzz_qqq", ""):
        r = classify_command_execution(command, _cmd_policy())
        assert r["tier"] == TIER_UNJUDGED, command
        assert r["evidence"]
    r = classify_command_execution(123, _cmd_policy())
    assert r["tier"] == TIER_UNJUDGED and r["rule"] == "input.type"


def test_missing_ruleset_policy_unjudged():
    """策略缺规则集 / 缺档 / 空档 / 坏正则 / 非映射 ⇒ unjudged(§0.3 不回落默认)。"""
    full = default_rulesets()
    no_destructive = {k: v for k, v in full.items() if k != TIER_DESTRUCTIVE}
    cases = [
        {},
        {"rulesets": None},
        {"rulesets": []},
        {"rulesets": {}},
        {"rulesets": no_destructive},
        {"rulesets": dict(full, write={})},
        {"rulesets": dict(full, read={"bad": "["})},
        [],
        "not-a-policy",
    ]
    for policy in cases:
        r = classify_command_execution("git status", policy)
        assert r["tier"] == TIER_UNJUDGED, policy
        assert r["requires_confirmation"] is False
        assert r["evidence"]


def test_missing_edit_policy_keys_unjudged():
    """evaluate 策略缺 rulesets/write_claims/expected_read_evidence ⇒ unjudged。"""
    intent, policy = _consistent_pair()
    for key in ("rulesets", "write_claims", "expected_read_evidence"):
        partial = {k: v for k, v in policy.items() if k != key}
        r = evaluate_edit_intent(intent, partial)
        assert r["verdict"] == TIER_UNJUDGED, key
        assert r["reasons"]


def test_high_risk_requires_confirmation_and_evidence():
    """高危命令未绑定确认即被拒:destructive 必带 requires_confirmation=True 与 evidence。"""
    for command in (
        "git push origin main",
        "rm -rf build",
        "del /f x",
        "git push --force",
        "cat .env",
    ):
        r = classify_command_execution(command, _cmd_policy())
        assert r["tier"] == TIER_DESTRUCTIVE
        assert r["requires_confirmation"] is True
        assert r["evidence"]
        assert r["rule"]


# ---------------------------------------------------------------------------
# 两判据联动 / diverged / 封闭值域 / 纯函数 / 半态拒绝
# ---------------------------------------------------------------------------
def test_two_judgements_binding_denies_high_risk():
    """编辑意图本应 consistent 但命令高危 ⇒ 绑定后整体 denied, 绝不静默放行。

    【反向变异验证转红锚点 B】把生产 ``command.binding`` 的 destructive 分支禁用后,
    本例会落回 consistent, 应从绿转红。
    """
    intent, policy = _consistent_pair(command="git push --force")
    r = evaluate_edit_intent(intent, policy)
    assert r["verdict"] == DENIED
    assert r["verdict"] != CONSISTENT
    assert r["requires_confirmation"] is True
    assert r["command_classification"]["tier"] == TIER_DESTRUCTIVE
    # classify 结果确实纳入 findings(两判据绑定, 不是各判各的)。
    binding = [f for f in r["findings"] if f["check"] == "command.binding"]
    assert binding and binding[0]["status"] == "denied"
    classification_findings = [f for f in r["findings"] if f["check"] == "command.classification"]
    assert classification_findings
    assert classification_findings[0]["classification"]["tier"] == TIER_DESTRUCTIVE


def test_read_evidence_diverged_and_missing_baseline():
    """指纹与本轮基准不符 ⇒ diverged;基准缺该 path ⇒ unjudged(§0.3)。"""
    intent, policy = _consistent_pair()
    intent["files"][0]["read_evidence_sha256"] = "f" * 64
    r = evaluate_edit_intent(intent, policy)
    assert r["verdict"] == DIVERGED
    assert any("漂移" in x or "不符" in x for x in r["reasons"])

    intent2, policy2 = _consistent_pair()
    del policy2["expected_read_evidence"]["app/core/b.py"]
    r2 = evaluate_edit_intent(intent2, policy2)
    assert r2["verdict"] == TIER_UNJUDGED
    assert any("基准" in x for x in r2["reasons"])


def test_closed_outcomes_and_structured_verdict():
    """结果值域封闭;两类 verdict 字段齐备、落在其内、reason 可断言。"""
    assert {TIER_READ, TIER_WRITE, TIER_DESTRUCTIVE, TIER_UNJUDGED} == ALL_COMMAND_TIERS
    assert {CONSISTENT, DIVERGED, TIER_UNJUDGED, DENIED} == ALL_EDIT_OUTCOMES
    assert {TIER_READ, TIER_WRITE, TIER_DESTRUCTIVE} == REQUIRED_RULESET_TIERS
    assert {"write_claims", "expected_read_evidence"} == REQUIRED_EDIT_POLICY_KEYS
    intent, policy = _consistent_pair()
    r = evaluate_edit_intent(intent, policy)
    assert {"verdict", "id", "findings", "reasons", "command_classification", "requires_confirmation"} <= set(r)
    assert r["verdict"] in ALL_EDIT_OUTCOMES
    assert all({"check", "status", "reason"} <= set(f) and f["reason"] for f in r["findings"])
    c = classify_command_execution("git status", _cmd_policy())
    assert c["tier"] in ALL_COMMAND_TIERS
    assert {"tier", "rule", "evidence", "requires_confirmation"} <= set(c)


def test_pure_function_no_input_mutation_and_deterministic():
    """纯函数:同输入重复调用结果相等, 且不 mutate intent/policy。"""
    intent, policy = _consistent_pair()
    snapshot = (
        intent["files"][0]["read_evidence_sha256"],
        policy["expected_read_evidence"]["app/core/a.py"],
        len(policy["rulesets"]["destructive"]),
    )
    r1 = evaluate_edit_intent(intent, policy)
    r2 = evaluate_edit_intent(intent, policy)
    assert r1 == r2
    assert (
        intent["files"][0]["read_evidence_sha256"],
        policy["expected_read_evidence"]["app/core/a.py"],
        len(policy["rulesets"]["destructive"]),
    ) == snapshot


def test_no_half_state_and_full_authorization_when_shaped():
    """形状坏 ⇒ 明确标授权判据未执行(拒绝半态);形状合法 ⇒ 授权各维都真跑过。"""
    _, policy = _consistent_pair()
    bad = evaluate_edit_intent({}, policy)
    assert bad["verdict"] == TIER_UNJUDGED
    assert bad["command_classification"] is None
    checks_bad = [f["check"] for f in bad["findings"]]
    assert "input.shape" in checks_bad
    assert any(f["check"] == "authorization" and f["status"] == "skipped" for f in bad["findings"])

    intent, policy = _consistent_pair()
    ok = evaluate_edit_intent(intent, policy)
    checks_ok = [f["check"] for f in ok["findings"]]
    for check in ("read_evidence.current", "command.classification", "command.binding"):
        assert check in checks_ok
    assert ok["verdict"] == CONSISTENT
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
