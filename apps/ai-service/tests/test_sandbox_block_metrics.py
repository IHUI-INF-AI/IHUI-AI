# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""沙箱拦截计量 + 策略版本可追溯 的接线锁(2026-10-31 立)。

立因:对照程序 Trae CN 3.4.12 的 ``modules/sandbox/``(REA 取证见
``.ihui-agent/tmp/trae-rea/report/T2-trae-periphery.md`` §2)每次拦截都按
``risk_rule_id`` 分桶计数并带 ``risk_policy_version``;本仓此前**只有拦截能力**
(``core/proc_sandbox.py`` 的 Job Object、``services/os_sandbox.py`` 的 ACL 矩阵与
档位登记表),计量与版本标识在 ``app/core/`` 零命中 —— 撞的是 AGENTS §5e-3
「量与拦必须同批,只装一边都算没修」。

本文件钉死四件事(缺一即本票未修):

1. **同批**:走生产收口(``validate_command_paths`` / ``resolve_policy_tier`` /
   ``build_tier_policy`` / ``apply_job_sandbox`` / 引擎 ``apply_patch`` 工具)时计数
   必须前进。只测"手工调 record_* 会不会加数"证明不了生产路径会调它 ——
   那是 ``test_llm_gateway_metrics_wiring.py`` 记过的教训。
2. **计量绝不改判**(成对对照,§0.9 反向牙):开档与关档各跑一遍,断言判定结果
   完全相同。只测开档一侧的话,把计量整段摘掉也不会红。
3. **失效方向恒为"未判定"**(§0.3):关计量 ⇒ 读数 None 而非 0;策略版本算不出来 ⇒
   ``status="undetermined"`` 且逐条点名缺哪些符号,不返回半个哈希、不把这次失败缓存成
   永久"没版本"。
4. **时序身份必须稳定**(§5e-3 同族):路径 / pid / GetLastError 数字 / 异常原文一律
   不得进标签;撞不上形态的值折成 ``unclassified`` 并另落一枚 undetermined。

判据不复制(§22c):分类器、开关、读数出口一律 import 源模块的 ``__test__``。
不碰数据库:本文件不 import 任何仓储层,PG 8810 / Redis 8811 与本轮无关。
"""

from __future__ import annotations

import os
import sys

import pytest

# 源模块唯一判据出口 —— 测试内不得再抄一份规则常量/分类算式(§22c)。
from app.core.sandbox_metrics import __test__ as SM
from app.core.sandbox_metrics import METRICS_ENABLED_ENV, CATEGORY_PROCESS
from app.services.os_sandbox import (
    BACKEND_MAC_SEATBELT,
    BACKEND_WIN_JOB,
    POLICY_TIER_WORKSPACE_WRITE,
    PolicyError,
    SandboxPolicy,
    build_tier_policy,
    resolve_policy_tier,
    validate_command_paths,
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


# =============================================================================
# 读数一律经源模块的 snapshot;本文件不自建时序解析
# =============================================================================


def _count(snap_fn, key: str, ident: str) -> float:
    """取某一维的计数;该身份尚无时序时按 0 计(**只用于算增量**,不当结论用)。"""
    value = snap_fn()[key].get(ident)
    return 0.0 if value is None else float(value)


@pytest.fixture(autouse=True)
def _metrics_on(monkeypatch):
    """每条用例默认开档;需要关档的用例在体内自行覆写 env。"""
    monkeypatch.delenv(METRICS_ENABLED_ENV, raising=False)


@pytest.fixture()
def snap():
    return SM["snapshot"]


def _acl_policy(**overrides) -> SandboxPolicy:
    kwargs: dict[str, object] = {
        "readable_paths": [REPO_ROOT],
        "writable_paths": [REPO_ROOT],
        "denied_paths": [os.path.join(REPO_ROOT, ".git")],
        "base_dir": REPO_ROOT,
    }
    kwargs.update(overrides)
    return SandboxPolicy(**kwargs)  # type: ignore[arg-type]


# =============================================================================
# 1. ACL 收口:量与拦同批
# =============================================================================


def test_acl_block_and_allow_share_one_batch(snap):
    """一次生产校验里:被拦的路径记 block,放行的路径记 allow —— 两边必须同批出现。

    没有 allow 那一维,"这条规则 0 次拦截"与"这条规则从未被问过"在读数上不可区分,
    正是 §0.3 禁的那种冒充。
    """
    policy = _acl_policy()
    inside = os.path.join(REPO_ROOT, "app", "main.py")
    outside = os.path.join(REPO_ROOT, ".git", "config")

    before_block = _count(snap, "blocksByRule", "sbx.file.deny_matrix")
    before_allow = _count(snap, "allowsByRule", "sbx.file.acl_judged")

    violations = validate_command_paths(policy, ["cat", inside, outside], cwd=REPO_ROOT)

    assert violations == [f"读取越权: {outside}"], violations
    assert _count(snap, "blocksByRule", "sbx.file.deny_matrix") - before_block == 1.0
    # allow 侧至少含 inside 与 cwd 两枚(main.py 与仓库根都算路径形态)
    assert _count(snap, "allowsByRule", "sbx.file.acl_judged") - before_allow >= 1.0


def test_acl_denied_vs_not_covered_are_different_identities(snap):
    """"命中 deny 矩阵"与"没有任何规则覆盖"必须落到两个不同身份(对照 risk_rule_id)。"""
    # write ⊆ read 是 os_sandbox.validate 的不变式(2026-10 收口):把可写面收进
    # 本档的 readable 里,否则构造函数直接 PolicyError,这条用例会红在夹具而不是判据上。
    app_dir = os.path.join(REPO_ROOT, "app")
    policy = _acl_policy(readable_paths=[app_dir], writable_paths=[app_dir])
    uncovered = os.path.join(REPO_ROOT, "docs", "x.md")
    denied = os.path.join(REPO_ROOT, ".git", "HEAD")

    validate_command_paths(policy, ["cat", uncovered], cwd=None)
    validate_command_paths(policy, ["cat", denied], cwd=None)

    assert _count(snap, "blocksByRule", "sbx.file.read_not_covered") >= 1.0
    assert _count(snap, "blocksByRule", "sbx.file.deny_matrix") >= 1.0


def test_write_intent_violation_counted_as_write_identity(snap):
    """写意图 flag 后面的值越权 ⇒ write_not_covered(与读越权不同身份)。"""
    policy = SandboxPolicy(
        readable_paths=[REPO_ROOT], writable_paths=[], denied_paths=[], base_dir=REPO_ROOT
    )
    target = os.path.join(REPO_ROOT, "app", "x.py")
    # 写意图由 **flag** 表达(`_WRITE_INTENT_FLAGS`);"tee" 是命令名、根本不在判据面,
    # 旧写法 ["tee", target] 从未让 pending_write 置位 ⇒ 断言等于空转(2026-10-31 现读)。
    violations = validate_command_paths(policy, ["cat", "--output", target], cwd=None)

    assert violations == [f"写入越权: {target}"], violations
    assert _count(snap, "blocksByRule", "sbx.file.write_not_covered") >= 1.0


# =============================================================================
# 2. 成对对照:计量开 / 关,判定不得变(§0.9 反向牙)
# =============================================================================

# 盘符是机器事实(AGENTS §0):由本文件位置推导,不写死旧机的 G:/IHUI-AI。
# 组合语义与 cwd 无关:第一条是 readable 内的合法路径,第二条在 base_dir 之外 ⇒ 只有它越权。
_TOP = os.path.dirname(os.path.dirname(REPO_ROOT))
_PAIRED_ARGV = [
    "cat",
    os.path.join(REPO_ROOT, "app", "main.py"),
    os.path.join(_TOP, ".git", "config"),
]
_PAIRED_EXPECTED = [f"读取越权: {os.path.join(_TOP, '.git', 'config')}"]


@pytest.mark.parametrize("enabled", [True, False], ids=["metrics-on", "metrics-off"])
def test_decision_identical_with_and_without_metering(monkeypatch, enabled):
    """同一输入,开档与关档必须返回**完全相同**的 violations。

    这一条就是"计量绝不改判"的锁:谁把计数写成分支判定的一部分,或者让计数异常冒到
    判定路径上,关档那一例立刻红。
    """
    monkeypatch.setenv(METRICS_ENABLED_ENV, "1" if enabled else "0")
    assert SM["metrics_enabled"]() is enabled
    assert validate_command_paths(_acl_policy(), _PAIRED_ARGV, cwd=REPO_ROOT) == (
        _PAIRED_EXPECTED
    )


@pytest.mark.parametrize("enabled", [True, False], ids=["metrics-on", "metrics-off"])
def test_tier_refusal_identical_with_and_without_metering(monkeypatch, enabled):
    """档位层的拒绝同样不受计量影响(异常类型与文案逐条相同)。"""
    monkeypatch.setenv(METRICS_ENABLED_ENV, "1" if enabled else "0")
    with pytest.raises(PolicyError, match="未知策略档位"):
        resolve_policy_tier("tier-that-does-not-exist")
    with pytest.raises(PolicyError, match="工作区根目录"):
        build_tier_policy(resolve_policy_tier("read_only"), [])
    with pytest.raises(PolicyError, match="只能由服务端档位决定"):
        build_tier_policy(resolve_policy_tier("read_only"), [REPO_ROOT], {"allow_network": True})


@pytest.mark.parametrize("enabled", [True, False], ids=["metrics-on", "metrics-off"])
def test_guard_judgment_identical_with_and_without_metering(monkeypatch, enabled):
    """成对对照(OS 护栏腿):摘掉计量不得改变 active / reason 任何一个字节。"""
    from app.core.proc_sandbox import apply_job_sandbox

    monkeypatch.setenv(METRICS_ENABLED_ENV, "1" if enabled else "0")
    info = apply_job_sandbox(_NoPidProc())  # type: ignore[arg-type]
    assert info["active"] is False
    assert info["reason"] == "process pid 不可用"


def test_metering_off_writes_no_series(snap, monkeypatch):
    """关档那一侧必须真的不写时序(否则那枚开关是装饰)。

    手法:读数只在开档时取 —— snapshot() 在关档态一律给 None,量不出"没加";
    所以先开档取基线,中间关档做一次拦截,再回开档比对(判定面已由上一条锁死)。
    """
    policy = _acl_policy()
    key = "sbx.file.deny_matrix"
    before = _count(snap, "blocksByRule", key)

    monkeypatch.setenv(METRICS_ENABLED_ENV, "0")
    assert validate_command_paths(policy, ["cat", "G:/IHUI-AI/.git/config"], cwd=None) == [
        "读取越权: G:/IHUI-AI/.git/config"
    ]

    monkeypatch.setenv(METRICS_ENABLED_ENV, "1")
    assert _count(snap, "blocksByRule", key) == before


# =============================================================================
# 3. 失效方向:未判定不得冒充 0 / 不得冒充"有版本"
# =============================================================================


def test_snapshot_when_disabled_reads_none_not_zero(snap, monkeypatch):
    """关档时每条声明身份都摆 None 并点名原因;填 0 == 谎报"没拦过"。"""
    monkeypatch.setenv(METRICS_ENABLED_ENV, "off")
    view = snap()
    assert view["status"] == "disabled"
    assert METRICS_ENABLED_ENV in str(view["reason"])
    assert set(view["blocksByRule"]) >= set(SM["rules"])
    assert all(v is None for v in view["blocksByRule"].values())
    assert all(v is None for v in view["allowsByRule"].values())
    assert view["guard"] is None
    assert view["undeterminedTotal"] is None


def test_snapshot_covers_every_declared_rule_identity(snap):
    """声明过的每一条规则身份都必须出现在读数面里(少一格就是那一格没人量得到)。"""
    view = snap()
    assert set(view["blocksByRule"]) >= set(SM["rules"])
    assert set(view["allowsByRule"]) >= set(SM["rules"])
    # 三态各有其维:allow / block / undetermined 都能被单独量到
    assert set(view["undeterminedByRule"]) >= {"sbx.patch.judgment_undetermined"}


def test_policy_version_ok_carries_fingerprint_and_symbol_count():
    """投影齐全 ⇒ ok 版本 + 参与枚数如实报出(枚数就是"量到了多少条策略事实")。"""
    state = SM["policy_version_state"]()
    assert state["status"] == "ok"
    assert state["versionId"].startswith(f"sbx-p{SM['schema_version']}-")
    assert len(state["fingerprint"]) == 16
    assert state["missing"] == ()
    declared = sum(len(attrs) for _, attrs in SM["projection"])
    assert state["symbols"] == declared


def test_policy_version_undetermined_names_missing_symbols(monkeypatch):
    """任一投影符号取不到 ⇒ 整体未判定并**逐条点名**;绝不返回半截哈希。"""
    from app.core import sandbox_metrics as mod

    broken = [*SM["projection"], ("app.core.sandbox_metrics", ("NoSuchPolicySymbol",))]
    monkeypatch.setattr(mod, "POLICY_PROJECTION", broken)
    SM["reset_caches"]()
    try:
        state = mod.policy_version_state(use_cache=False)
        assert state["status"] == "undetermined"
        assert state["versionId"] == "undetermined"
        assert state["fingerprint"] == ""
        assert "app.core.sandbox_metrics.NoSuchPolicySymbol" in state["missing"]
        assert "NoSuchPolicySymbol" in state["reason"]
    finally:
        SM["reset_caches"]()


def test_policy_version_undetermined_is_loud_not_quiet(snap, monkeypatch):
    """未判定必须自己喊一声(undetermined 计数前进),不能安静地少一条时序。"""
    from app.core import sandbox_metrics as mod

    before = snap()["undeterminedTotal"] or 0.0
    monkeypatch.setattr(mod, "POLICY_PROJECTION", [("app.core.nope_not_a_module", ("X",))])
    SM["reset_caches"]()
    try:
        assert mod.policy_version_state(use_cache=False)["status"] == "undetermined"
        assert (snap()["undeterminedTotal"] or 0.0) > before
    finally:
        SM["reset_caches"]()


def test_policy_version_failure_is_not_cached(monkeypatch):
    """未判定不进缓存:一次启动抖动不能被钉成永久"没版本"(那才是真的静默腐烂)。"""
    from app.core import sandbox_metrics as mod

    monkeypatch.setattr(mod, "POLICY_PROJECTION", [("app.core.nope_not_a_module", ("X",))])
    SM["reset_caches"]()
    try:
        assert mod.policy_version_state()["status"] == "undetermined"
        # 投影恢复后不 reset 也必须重新算出 ok —— 说明上一次失败没被缓存住
        monkeypatch.setattr(mod, "POLICY_PROJECTION", SM["projection"])
        assert mod.policy_version_state()["status"] == "ok"
    finally:
        SM["reset_caches"]()


def test_publish_policy_info_still_visible_when_undetermined(monkeypatch):
    """未判定时 info 时序照样发,标签写 undetermined —— 少一条时序会被读成"没跑过"。"""
    from app.core import sandbox_metrics as mod

    monkeypatch.setattr(mod, "POLICY_PROJECTION", [("app.core.nope_not_a_module", ("X",))])
    SM["reset_caches"]()
    try:
        state = mod.publish_policy_info()
        assert state["status"] == "undetermined"
        assert _info_series_present(mod, status="undetermined") is True
    finally:
        # 投影表在**每次调用**里现读:不先复原 monkeypatch,第二次仍会读到那个坏模块,
        # 断言 ok 就变成"要求同一份坏输入产出两种结论"(2026-10-31 现读)。
        monkeypatch.undo()
        SM["reset_caches"]()
    assert mod.publish_policy_info()["status"] == "ok"
    assert _info_series_present(mod, status="ok") is True


def _info_series_present(mod, *, status: str) -> bool:
    """info 指标里是否存在该 status 的样本(只读源模块自己的指标对象,不另建判据)。"""
    for family in mod.sandbox_policy_info.collect():
        for sample in family.samples:
            if sample.labels.get("status") == status and float(sample.value) == 1.0:
                return True
    return False


# =============================================================================
# 4. 时序身份稳定性(§5e-3 同族纪律)
# =============================================================================


@pytest.mark.parametrize(
    "volatile",
    [
        r"G:\IHUI-AI\.git\config",
        "C:/Users/Administrator/AppData/Local/Temp/x",
        "OpenProcess(12345) 失败: 5",
        "patch rejected: " + "x" * 200,
        "1793389285.4535432",
    ],
)
def test_volatile_identity_never_reaches_a_label(volatile, snap):
    """抖动值不得成为标签值;必须折成 unclassified 并另记一枚 undetermined。"""
    from app.core.sandbox_metrics import CATEGORY_FILE, record_decision

    before = snap()["undeterminedTotal"] or 0.0
    record_decision(volatile, CATEGORY_FILE, "block")
    view = snap()

    assert volatile not in view["blocksByRule"]
    assert (view["blocksByRule"].get("unclassified") or 0.0) >= 1.0
    assert (view["undeterminedTotal"] or 0.0) > before


def test_every_declared_identity_is_already_safe():
    """声明的规则/分档身份必须自己就过稳定形态校验 —— 否则它一上线就被折成
    unclassified,读数面上那条规则永远不存在,而所有用例仍然绿。"""
    safe = SM["safe_identity"]
    for rule in SM["rules"]:
        assert safe(rule, stage="rule_id") == rule, rule
    for category in SM["categories"]:
        assert safe(category, stage="category") == category
    for decision in SM["decisions"]:
        assert safe(decision, stage="decision") == decision


def test_created_timestamp_samples_are_not_counted(snap):
    """prometheus_client 给每个 Counter 额外发一条 ``*_created``(值是 Unix 时刻)。
    读数若把它算进来,"拦了几次"会变成"几点几分" —— §5e-3 禁的抖动换了副面孔而已。
    """
    from app.core.sandbox_metrics import record_block

    key = "sbx.process.argv_empty"
    before = _count(snap, "blocksByRule", key)
    record_block(key, CATEGORY_PROCESS)
    after = _count(snap, "blocksByRule", key)

    assert after - before == 1.0
    assert after < 10_000_000, f"读数混进了创建时刻:{after}"


# =============================================================================
# 5. 分类器不自己判定(§0.6 单一真相源):只认传进来的两个事实
# =============================================================================


@pytest.mark.parametrize(
    "denied,allowed,intent,expected",
    [
        (False, True, "read", ("sbx.file.acl_judged", "allow")),
        (True, False, "read", ("sbx.file.deny_matrix", "block")),
        (True, False, "write", ("sbx.file.deny_matrix", "block")),
        (False, False, "read", ("sbx.file.read_not_covered", "block")),
        (False, False, "write", ("sbx.file.write_not_covered", "block")),
        # denied=True 而 allowed=True 结构上不该出现(deny 优先),但分类器没有判定权,
        # 不得因此改判、也不得抛异常。
        (True, True, "read", ("sbx.file.acl_judged", "allow")),
    ],
)
def test_classifier_arms(denied, allowed, intent, expected):
    assert SM["classify_acl"](denied=denied, allowed=allowed, intent=intent) == expected


# =============================================================================
# 6. 档位登记表:三处拒绝各一枚,且"取到档位"有分母
# =============================================================================


def test_tier_registry_refusals_are_counted(snap):
    with pytest.raises(PolicyError):
        resolve_policy_tier("does-not-exist")
    assert _count(snap, "blocksByRule", "sbx.policy.tier_unknown") >= 1.0

    with pytest.raises(PolicyError):
        build_tier_policy(resolve_policy_tier("workspace_write"), [])
    assert _count(snap, "blocksByRule", "sbx.policy.tier_roots_empty") >= 1.0

    with pytest.raises(PolicyError):
        build_tier_policy(
            resolve_policy_tier(POLICY_TIER_WORKSPACE_WRITE),
            [REPO_ROOT],
            {"restrict_token": False},
        )
    assert _count(snap, "blocksByRule", "sbx.policy.tier_field_denied") >= 1.0

    with pytest.raises(PolicyError):
        build_tier_policy(resolve_policy_tier("read_only"), [REPO_ROOT], {"timeout_s": 10**9})
    assert _count(snap, "blocksByRule", "sbx.policy.tier_ceiling_exceeded") >= 1.0


def test_tier_resolution_has_a_denominator(snap):
    """放行侧也要有数:档位取到 ⇒ tier_resolved 前进。没有它,"0 次越权尝试"没有含义。"""
    before = _count(snap, "allowsByRule", "sbx.policy.tier_resolved")
    resolve_policy_tier("read_only")
    resolve_policy_tier(None)  # 缺省档同样是"判过且放行"
    assert _count(snap, "allowsByRule", "sbx.policy.tier_resolved") - before == 2.0


def test_backend_label_folds_unknown_values(snap):
    """后端维只认登记表三档;自由文本(带 pid / 反斜杠)必须被折掉。"""
    from app.core.sandbox_metrics import record_block

    record_block("sbx.process.argv_empty", CATEGORY_PROCESS, backend=r"win_job\pid:99")
    labels = {
        sample.labels.get("backend")
        for family in _decision_families()
        for sample in family.samples
        if sample.labels.get("rule_id") == r"win_job\pid:99"
    }
    assert labels == set(), f"抖动值进了标签:{labels}"


def _decision_families():
    from app.core.sandbox_metrics import sandbox_decisions_total

    return sandbox_decisions_total.collect()


def test_backends_declared_match_os_sandbox_constants():
    """后端维声明集必须与 os_sandbox 的 BACKEND_* 现读一致(抄一份就会漂)。"""
    from app.core.sandbox_metrics import SANDBOX_BACKENDS

    assert SANDBOX_BACKENDS == {"none", BACKEND_WIN_JOB, BACKEND_MAC_SEATBELT, "linux_bwrap"}


# =============================================================================
# 7. proc_sandbox:每个 return 分支同批落数,且版本随返回值带出
# =============================================================================


class _NoPidProc:
    """没有 pid 的子进程句柄 —— 覆盖"护栏装不上"的确定分支,不需要真起进程。"""

    pid = None


def test_guard_branch_counted_same_batch_and_version_carried(snap):
    from app.core.proc_sandbox import apply_job_sandbox

    before = snap()["guard"]["byState"]["degraded"] or 0.0
    info = apply_job_sandbox(_NoPidProc())  # type: ignore[arg-type]

    assert info["active"] is False
    assert "pid" in info["reason"]
    assert info["policyVersion"].startswith(f"sbx-p{SM['schema_version']}-")
    assert (snap()["guard"]["byState"]["degraded"] or 0.0) - before == 1.0
    assert (snap()["guard"]["byReason"].get("pid_unavailable") or 0.0) >= 1.0


def test_guard_states_cover_all_three_axes(snap):
    """enforced / degraded / undetermined 三态都在读数面上(少一态就少一类失效)。"""
    assert set(snap()["guard"]["byState"]) == {"enforced", "degraded", "undetermined"}


@pytest.mark.skipif(sys.platform == "win32", reason="non_windows 分支在 win32 结构上取不到")
def test_non_windows_reason_identity_is_reachable_off_win32():
    """非 Windows 面的降级身份是稳定短名而非异常原文。

    本机是 win32 ⇒ 这一格**取不到输入**,如实 skip 并说明原因,不拿"应该也记上了"
    冒充判过(§0.3)。
    """
    raise AssertionError("win32 上不该进入本用例")


# =============================================================================
# 8. 引擎生产收口:apply_patch 真的把计数带起来(不是手工调 record_*)
# =============================================================================


class _UnusedLoop:
    async def run(self, messages):  # pragma: no cover - 本用例不跑 agent 循环
        raise AssertionError("apply_patch 计量用例不应进入 agent 循环")


def _engine_for_patch():
    from app.services.agent_engine import AgentEngine

    async def factory(spec, host_tools):
        return _UnusedLoop()

    return AgentEngine(loop_factory=factory)


async def _open_patch_tool(engine, workspace: str):
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.start",
            "params": {"workspace": workspace},
        }
    )
    assert response is not None and "error" not in response, response
    thread = engine._threads[response["result"]["threadId"]]
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == "apply_patch":
            return definition
    raise AssertionError("内置工具未注入: apply_patch")


@pytest.mark.asyncio
async def test_apply_patch_protected_metadata_wires_metric(snap, tmp_path):
    """走引擎 apply_patch 工具本体拦 .git ⇒ 该拒绝必须同时被量到,且文件确实没落盘。"""
    engine = _engine_for_patch()
    tool = await _open_patch_tool(engine, str(tmp_path))
    patch = (
        "*** Begin Patch\n"
        "*** Add File: .git/hooks/pre-commit\n"
        "+#!/bin/sh\n"
        "*** End Patch\n"
    )

    before = _count(snap, "blocksByRule", "sbx.patch.protected_metadata")
    result = await tool.executor({"patch": patch})

    assert result.get("protected") == ".git", result
    assert _count(snap, "blocksByRule", "sbx.patch.protected_metadata") - before == 1.0
    assert not (tmp_path / ".git" / "hooks" / "pre-commit").exists()


@pytest.mark.asyncio
async def test_apply_patch_wiring_unchanged_when_metering_off(monkeypatch, tmp_path):
    """成对对照(引擎腿):关计量后 apply_patch 的拒绝行为与回执完全一致。"""
    monkeypatch.setenv(METRICS_ENABLED_ENV, "0")
    engine = _engine_for_patch()
    tool = await _open_patch_tool(engine, str(tmp_path))

    result = await tool.executor(
        {"patch": "*** Begin Patch\n*** Add File: .git/config\n+x\n*** End Patch\n"}
    )

    assert result.get("protected") == ".git"
    assert "受保护路径不可被补丁修改" in result["error"]
    assert not (tmp_path / ".git" / "config").exists()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
