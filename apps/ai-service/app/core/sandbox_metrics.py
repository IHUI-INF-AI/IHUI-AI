# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱拦截计量与策略版本可追溯层。

为什么立这一层(2026-10-31,逆向-复现-超越铁律 §0.11 的复现腿):
对照程序 Trae CN 3.4.12 的 ``modules/sandbox/`` 经 REA 取证(报告
``.ihui-agent/tmp/trae-rea/report/T2-trae-periphery.md`` §2)显示,它的拦截不是静默拒绝,
而是**每一次拦截都被量到**:规则自带 ``risk_rule_id`` / ``risk_policy_version``,并有
21+ 枚分桶计数器(report / process_drop / sandbox_drop / priority_* / risk_reserved /
duplicate / **risk_unknown**)。本仓此前只有拦截能力(``core/proc_sandbox.py`` 的 Job
Object、``services/os_sandbox.py`` 的 ACL 矩阵与档位登记表),而
``block_count`` / ``policy_version`` 在 ``app/core/`` 零命中 —— 即"拦了,但没人知道
拦了多少、按哪一版策略拦的"。

这撞的是本仓自己写的 §5e-3:「量与拦必须同批,只装一边都算没修」。因此本模块的
**消费面接线点与计数器同批落地**(见 ``proc_sandbox`` / ``os_sandbox`` / ``agent_engine``
三处的 ``record_*`` 调用),不是先埋计数器等着以后接。

三条设计纪律(不得回退):

1. **计量绝不改判据。** 本模块只提供"标注与计数",不提供任何 allow/deny 判定;
   判定仍由各消费方自己的谓词(``SandboxPolicy.can_read`` / ``can_write`` / ``is_denied``)
   给出。``record_*`` 一律吞掉自身异常 —— 计数器坏了不能把一个该拦的放行、也不能
   把一个该放的拦掉。成对对照用例见 ``tests/test_sandbox_block_metrics.py``。
2. **失效方向恒为"未判定"，绝不拿 0 冒充"没拦过"**(§0.3)。三处都得诚实:
   - 关掉计量(``IHUI_SANDBOX_METRICS_ENABLED=0``)时 ``snapshot()`` 落
     ``status="disabled"``,读数全为 ``None`` 而非 0;
   - 策略版本算不出来(投影缺符号 / import 失败 / 枚举到 0 个符号)时
     ``policy_version_state()`` 落 ``status="undetermined"`` 并点名缺哪几个符号,
     **不返回半个哈希**;
   - 判定器自己抛异常而调用方降级放行的那一格,记成 ``undetermined`` 而不是
     ``allow``(对标对照程序的 ``block_risk_unknown_count`` 位,但比它进一步:
     它按丢弃计数,本仓按"没判"计数,因为放行与丢弃是两回事)。
3. **身份必须稳定**(§5e-3 同族纪律 / 守门 224 的精神):标签值只允许
   ``_SAFE_IDENTITY_RE`` 形态的小写稳定标识。路径、pid、GetLastError 数字、异常原文
   一律**不得**进标签;撞不上形态的值折成 ``unclassified`` 并另记一枚
   ``undetermined{stage=identity_volatility}`` —— 宁可丢一个维度,不可造一串会抖的时序。

指标注册形态照 ``app/middleware/agent_metrics.py``:全局 ``prometheus_client`` 注册表
自动经 ``main.py`` 的 Instrumentator 暴露在 ``/metrics``,不新造第二套指标框架。
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import os
import re
from collections.abc import Mapping
from typing import Any

from prometheus_client import Counter, Gauge

logger = logging.getLogger(__name__)

__all__ = [
    "CATEGORY_FILE",
    "CATEGORY_GUARD",
    "CATEGORY_NET",
    "CATEGORY_POLICY",
    "CATEGORY_PROCESS",
    "CATEGORY_UI",
    "DECISION_ALLOW",
    "DECISION_BLOCK",
    "DECISION_UNDETERMINED",
    "METRICS_ENABLED_ENV",
    "POLICY_SCHEMA_VERSION",
    "UNDETERMINED_IDENTITY",
    "metrics_enabled",
    "policy_version_state",
    "publish_policy_info",
    "record_allow",
    "record_block",
    "record_decision",
    "record_guard_state",
    "record_undetermined",
    "snapshot",
]

# ── 档位开关 ─────────────────────────────────────────────────────────────
#: 关掉计量不影响任何拦截判定(见头注纪律 1);关掉后读数一律落 None 而非 0。
METRICS_ENABLED_ENV = "IHUI_SANDBOX_METRICS_ENABLED"
_FALSY = frozenset({"0", "false", "no", "off"})

# ── 稳定语义身份:分桶维(对照 Trae 的 file/net/process 三族 + 本仓自有两族)──
CATEGORY_FILE = "file"
CATEGORY_NET = "net"
CATEGORY_PROCESS = "process"
CATEGORY_UI = "ui"
CATEGORY_POLICY = "policy"
CATEGORY_GUARD = "guard"
SANDBOX_CATEGORIES: frozenset[str] = frozenset(
    {CATEGORY_FILE, CATEGORY_NET, CATEGORY_PROCESS, CATEGORY_UI, CATEGORY_POLICY, CATEGORY_GUARD}
)

DECISION_ALLOW = "allow"
DECISION_BLOCK = "block"
DECISION_UNDETERMINED = "undetermined"
SANDBOX_DECISIONS: frozenset[str] = frozenset(
    {DECISION_ALLOW, DECISION_BLOCK, DECISION_UNDETERMINED}
)

GUARD_STATE_ENFORCED = "enforced"
GUARD_STATE_DEGRADED = "degraded"
GUARD_STATE_UNDETERMINED = "undetermined"
SANDBOX_GUARD_STATES: frozenset[str] = frozenset(
    {GUARD_STATE_ENFORCED, GUARD_STATE_DEGRADED, GUARD_STATE_UNDETERMINED}
)

#: 后端维取值 = os_sandbox.BACKEND_* 三档现读 + 不属于任何后端的判定点用 none。
BACKEND_NONE = "none"
SANDBOX_BACKENDS: frozenset[str] = frozenset(
    {BACKEND_NONE, "win_job", "linux_bwrap", "mac_seatbelt"}
)

# ── 规则身份(risk_rule_id 的本仓等价物;一名一条,新增必须登记在此)──
RULE_FILE_DENY_MATRIX = "sbx.file.deny_matrix"
RULE_FILE_READ_NOT_COVERED = "sbx.file.read_not_covered"
RULE_FILE_WRITE_NOT_COVERED = "sbx.file.write_not_covered"
RULE_FILE_ACL_JUDGED = "sbx.file.acl_judged"
RULE_PROCESS_ARGV_EMPTY = "sbx.process.argv_empty"
RULE_PROCESS_PATH_VIOLATION_BLOCK = "sbx.process.path_violation_block"
RULE_POLICY_TIER_RESOLVED = "sbx.policy.tier_resolved"
RULE_POLICY_TIER_UNKNOWN = "sbx.policy.tier_unknown"
RULE_POLICY_TIER_ROOTS_EMPTY = "sbx.policy.tier_roots_empty"
RULE_POLICY_TIER_FIELD_DENIED = "sbx.policy.tier_field_denied"
RULE_POLICY_TIER_CEILING_EXCEEDED = "sbx.policy.tier_ceiling_exceeded"
RULE_PATCH_PROTECTED_METADATA = "sbx.patch.protected_metadata"
RULE_PATCH_REJECTED = "sbx.patch.rejected"
RULE_PATCH_ASK_USER = "sbx.patch.ask_user"
#: 判定器自己坏了而调用方降级放行的一格 —— 记 undetermined,不记 allow。
RULE_PATCH_JUDGMENT_UNDETERMINED = "sbx.patch.judgment_undetermined"
#: OS 级护栏的安装结果不住这张表(它是"护栏装没装上"另一个轴),
#: 见 ``ihui_sandbox_guard_state_total`` —— 把两个轴并成一维会把
#: "护栏缺失"读成"拦截了一次"。

SANDBOX_RULE_IDS: frozenset[str] = frozenset(
    {
        RULE_FILE_DENY_MATRIX,
        RULE_FILE_READ_NOT_COVERED,
        RULE_FILE_WRITE_NOT_COVERED,
        RULE_FILE_ACL_JUDGED,
        RULE_PROCESS_ARGV_EMPTY,
        RULE_PROCESS_PATH_VIOLATION_BLOCK,
        RULE_POLICY_TIER_RESOLVED,
        RULE_POLICY_TIER_UNKNOWN,
        RULE_POLICY_TIER_ROOTS_EMPTY,
        RULE_POLICY_TIER_FIELD_DENIED,
        RULE_POLICY_TIER_CEILING_EXCEEDED,
        RULE_PATCH_PROTECTED_METADATA,
        RULE_PATCH_REJECTED,
        RULE_PATCH_ASK_USER,
        RULE_PATCH_JUDGMENT_UNDETERMINED,
    }
)

#: 撞不上稳定形态的标识折到这里(宁丢维度不造抖动时序)。
UNDETERMINED_IDENTITY = "unclassified"
_SAFE_IDENTITY_RE = re.compile(r"^[a-z0-9][a-z0-9_.:;-]{0,63}$")
#: 纯数字(含小数)不算稳定身份:pid、时间戳、GetLastError 编号都会抖,只是它们恰好
#: 落在上面的形态集里。2026-10-31 现读:'1793389285.4535432'(秒级时间戳)能过形态闸,
#: 于是每个样本一个新标签 —— 正是本模块头注要杜绝的"会抖的时序"。
_NUMERIC_IDENTITY_RE = re.compile(r"^[0-9][0-9_.]*$")

# ── 指标(照 middleware/agent_metrics.py 的注册形态;名称一经上线即为契约)──
sandbox_decisions_total = Counter(
    "ihui_sandbox_decisions_total",
    "Sandbox policy decisions counted by stable rule identity",
    ["rule_id", "category", "decision", "backend"],
)

sandbox_guard_state_total = Counter(
    "ihui_sandbox_guard_state_total",
    "OS-level sandbox guard installation outcomes",
    ["state", "reason_id"],
)

#: 策略版本可追溯:Prometheus info-metric 形态(值恒 1,版本住在标签里)。
#: status=undetermined 时 policy_version 恒为字面 undetermined —— 不发布半截哈希。
sandbox_policy_info = Gauge(
    "ihui_sandbox_policy_info",
    "Effective sandbox policy identity (info metric, value is always 1)",
    ["policy_version", "policy_schema", "fingerprint", "status"],
)

#: 计量层自身失效的一格:取不到输入时必须"喊出来"而不是安静地少一条时序。
sandbox_metrics_undetermined_total = Counter(
    "ihui_sandbox_metrics_undetermined_total",
    "Sandbox metering stages that could not be judged (explicit unjudged signal)",
    ["stage"],
)


def metrics_enabled() -> bool:
    """计量开关(默认开)。只认显式 falsy 值,读 env 失败按开档处理。

    注意这一档**只关计数,不关判定**:判定由各消费方自己的谓词给出,本模块
    不在判定路径上。成对对照用例据此断言"摘掉计量也不会改变拦截结果"。
    """
    try:
        raw = os.environ.get(METRICS_ENABLED_ENV, "").strip().lower()
    except Exception:  # noqa: BLE001 - env 读不动时保持默认(开档),不把计量判成关
        return True
    return raw not in _FALSY


def _safe_identity(raw: object, *, stage: str) -> str:
    """把标签值收成稳定形态;不合形态 ⇒ unclassified + 落一枚 undetermined。"""
    text = str(raw)
    if _SAFE_IDENTITY_RE.match(text) and not _NUMERIC_IDENTITY_RE.match(text):
        return text
    _inc_undetermined(f"{stage}_volatility")
    return UNDETERMINED_IDENTITY


def _inc_undetermined(stage: str) -> None:
    """undetermined 计数本体(不含 try,内部调用点自行保证不抛)。"""
    try:
        sandbox_metrics_undetermined_total.labels(stage=_safe_identity(stage, stage="stage")).inc()
    except Exception:  # noqa: BLE001 - 计量坏了绝不能冒到业务路径
        logger.debug("[sandbox-metrics] undetermined 计数失败(忽略)", exc_info=True)


def record_decision(
    rule_id: str,
    category: str,
    decision: str,
    *,
    backend: str = BACKEND_NONE,
) -> None:
    """记一枚策略判定(allow / block / undetermined)。吞异常,永不改判。"""
    if not metrics_enabled():
        return
    try:
        safe_category = category if category in SANDBOX_CATEGORIES else UNDETERMINED_IDENTITY
        safe_decision = decision if decision in SANDBOX_DECISIONS else UNDETERMINED_IDENTITY
        safe_backend = backend if backend in SANDBOX_BACKENDS else UNDETERMINED_IDENTITY
        sandbox_decisions_total.labels(
            rule_id=_safe_identity(rule_id, stage="rule_id"),
            category=safe_category,
            decision=safe_decision,
            backend=safe_backend,
        ).inc()
    except Exception:  # noqa: BLE001
        logger.debug("[sandbox-metrics] decision 计数失败(忽略)", exc_info=True)


def record_block(
    rule_id: str,
    category: str,
    *,
    backend: str = BACKEND_NONE,
) -> None:
    """记一枚真实拦截(等价于 record_decision(..., decision="block"))。"""
    record_decision(rule_id, category, DECISION_BLOCK, backend=backend)


def record_allow(
    rule_id: str,
    category: str,
    *,
    backend: str = BACKEND_NONE,
) -> None:
    """记一枚"判过且放行"—— 分母。没有它,"0 次拦截"与"没量过"不可区分(§0.3)。"""
    record_decision(rule_id, category, DECISION_ALLOW, backend=backend)


def record_guard_state(state: str, reason_id: str) -> None:
    """记 OS 级沙箱护栏的安装结果(enforced / degraded / undetermined)。

    reason_id 必须是**调用方自己分支的稳定枚举**,不得塞 GetLastError 数字或
    异常原文(那些留在返回 dict 的 reason 里给人看,不进时序身份)。
    """
    if not metrics_enabled():
        return
    try:
        safe_state = state if state in SANDBOX_GUARD_STATES else UNDETERMINED_IDENTITY
        sandbox_guard_state_total.labels(
            state=safe_state,
            reason_id=_safe_identity(reason_id, stage="reason_id"),
        ).inc()
    except Exception:  # noqa: BLE001
        logger.debug("[sandbox-metrics] guard 计数失败(忽略)", exc_info=True)


def record_undetermined(stage: str) -> None:
    """显式登记一格"没判成":计量自身或上游输入取不到时用,绝不静默少一条。"""
    _inc_undetermined(stage)


# ── 分类器(只贴标签,不做判定)────────────────────────────────────────
def classify_acl(*, denied: bool, allowed: bool, intent: str) -> tuple[str, str]:
    """把一次 ACL 查询折成 (rule_id, decision)。

    判据各元素**由调用方用自己的谓词算好后传入**(denied=policy.is_denied(p)、
    allowed=policy.can_read/can_write(p)),本函数不重新实现任何沙箱判定(§0.6
    单一真相源);它只做"这次命中了哪条规则"的命名。
    """
    if allowed:
        return (RULE_FILE_ACL_JUDGED, DECISION_ALLOW)
    if denied:
        return (RULE_FILE_DENY_MATRIX, DECISION_BLOCK)
    if intent == "write":
        return (RULE_FILE_WRITE_NOT_COVERED, DECISION_BLOCK)
    return (RULE_FILE_READ_NOT_COVERED, DECISION_BLOCK)


# ── 策略版本 ────────────────────────────────────────────────────────────
#: 语义版本:策略字段**含义**变了才 +1(新增/删除一档限额、ACL 语义改写)。
#: 具体数值变化由 fingerprint 自动体现,不靠人记得来手动 +1 —— 那正是版本腐烂的成因。
POLICY_SCHEMA_VERSION = 1

#: 策略投影清单(唯一真相源在各自模块,这里只声明"读哪些符号")。
#: 任何一枚取不到 ⇒ 整体判 undetermined:半份投影算出来的哈希会**冒充**一个可信版本,
#: 而它既不代表真实策略、又无法被对账器发现 —— 比报未判定危险得多。
POLICY_PROJECTION: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "app.core.proc_sandbox",
        (
            "_JobObjectExtendedLimitInformation",
            "_JobObjectBasicUIRestrictions",
            "_JOB_OBJECT_LIMIT_ACTIVE_PROCESS",
            "_JOB_OBJECT_LIMIT_PROCESS_MEMORY",
            "_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE",
            "_UI_RESTRICTIONS",
            "_DEFAULT_MEMORY_LIMIT",
            "_DEFAULT_ACTIVE_PROCESS_LIMIT",
        ),
    ),
    (
        "app.core.sandbox_policy",
        (
            "PROTECTED_METADATA_PATH_NAMES",
            "POLICY_DANGER_FULL_ACCESS",
            "POLICY_READ_ONLY",
            "POLICY_EXTERNAL_SANDBOX",
            "POLICY_WORKSPACE_WRITE",
        ),
    ),
    (
        "app.core.patch_safety",
        (
            "APPROVAL_POLICY_NEVER",
            "APPROVAL_POLICY_ON_REQUEST",
            "APPROVAL_POLICY_UNLESS_TRUSTED",
            "APPROVAL_POLICY_GRANULAR_SANDBOX_APPROVAL",
        ),
    ),
    (
        # 档位登记表在 os_sandbox(与 SandboxPolicy 同层,见该模块 G-258 收口头注)。
        "app.services.os_sandbox",
        (
            "SANDBOX_POLICY_TIERS",
            "DEFAULT_POLICY_TIER",
            "TIER_TUNABLE_FIELDS",
        ),
    ),
)

STATUS_OK = "ok"
STATUS_UNDETERMINED = "undetermined"
VERSION_UNDETERMINED = "undetermined"
_FINGERPRINT_CHARS = 16

_policy_state_cache: dict[str, Any] | None = None


def _canonical(value: object) -> Any:
    """把策略值折成确定性可序列化形态(同输入同字节,不依赖 dict/集合插入序)。"""
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: _canonical(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, Mapping):
        return {str(k): _canonical(v) for k, v in value.items()}
    if isinstance(value, (set, frozenset)):
        items = [_canonical(v) for v in value]
        return sorted(items, key=lambda x: json.dumps(x, sort_keys=True, default=repr))
    if isinstance(value, (list, tuple)):
        return [_canonical(v) for v in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return repr(value)


def policy_version_state(*, use_cache: bool = True) -> dict[str, Any]:
    """算出**生效策略**的版本标识;算不出来就如实报未判定。

    Returns:
        ok:           {"status": "ok", "versionId": "sbx-p1-<16hex>", "fingerprint": ...,
                       "symbols": <参与投影的符号枚数>, "missing": ()}
        undetermined: {"status": "undetermined", "versionId": "undetermined",
                       "fingerprint": "", "symbols": <已取到的枚数>,
                       "missing": ("module.attr", ...), "reason": "..."}

    失败方向(§0.3):import 失败 / 符号不存在 / 投影枚举为 0 枚 ⇒ undetermined
    并逐条点名 missing。**不返回半个哈希,也不返回空串冒充 v0。**
    """
    global _policy_state_cache
    if use_cache and _policy_state_cache is not None:
        return dict(_policy_state_cache)

    collected: dict[str, Any] = {}
    missing: list[str] = []
    import_errors: list[str] = []

    for module_name, attributes in POLICY_PROJECTION:
        try:
            module = __import__(module_name, fromlist=["__dict__"])
        except Exception as e:  # noqa: BLE001 - 整模块取不到 ⇒ 该模块全部符号记缺失
            import_errors.append(f"{module_name}: {type(e).__name__}")
            missing.extend(f"{module_name}.{attr}" for attr in attributes)
            continue
        for attr in attributes:
            if not hasattr(module, attr):
                missing.append(f"{module_name}.{attr}")
                continue
            collected[f"{module_name}.{attr}"] = _canonical(getattr(module, attr))

    reason_parts: list[str] = []
    if import_errors:
        reason_parts.append("模块导入失败: " + "; ".join(import_errors))
    if missing:
        reason_parts.append("投影符号缺失: " + ", ".join(sorted(missing)))
    if not collected:
        reason_parts.append("投影枚举到 0 枚(判死不记绿)")

    if reason_parts:
        state: dict[str, Any] = {
            "status": STATUS_UNDETERMINED,
            "versionId": VERSION_UNDETERMINED,
            "policySchema": POLICY_SCHEMA_VERSION,
            "fingerprint": "",
            "symbols": len(collected),
            "missing": tuple(sorted(missing)),
            "reason": " | ".join(reason_parts),
        }
        # 未判定不缓存:策略层可能稍后才可用,缓存会把一次启动抖动钉成永久。
        record_undetermined("policy_version")
        logger.warning("[sandbox-metrics] 策略版本未判定: %s", state["reason"])
        return dict(state)

    payload = json.dumps(collected, sort_keys=True, default=repr, ensure_ascii=False)
    fingerprint = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:_FINGERPRINT_CHARS]
    ok_state: dict[str, Any] = {
        "status": STATUS_OK,
        "versionId": f"sbx-p{POLICY_SCHEMA_VERSION}-{fingerprint}",
        "policySchema": POLICY_SCHEMA_VERSION,
        "fingerprint": fingerprint,
        "symbols": len(collected),
        "missing": (),
    }
    _policy_state_cache = dict(ok_state)
    return ok_state


def publish_policy_info() -> dict[str, Any]:
    """把策略版本发布成一条 info 时序(值恒 1,版本住在标签)。

    未判定时**照样发**,但标签是 status="undetermined" + policy_version="undetermined":
    少一条时序和一条说"我没判出来"的时序,对大屏是两件事 —— 前者会被读成"没跑过"。
    """
    state = policy_version_state()
    if not metrics_enabled():
        return state
    try:
        sandbox_policy_info.labels(
            policy_version=str(state["versionId"]),
            policy_schema=str(state["policySchema"]),
            fingerprint=str(state["fingerprint"]) or VERSION_UNDETERMINED,
            status=str(state["status"]),
        ).set(1)
    except Exception:  # noqa: BLE001
        record_undetermined("policy_info_publish")
        logger.debug("[sandbox-metrics] policy info 发布失败(忽略)", exc_info=True)
    return state


# ── 被人量到的出口(不依赖调用方会查 Prometheus)───────────────────────
def _sum_samples(metric: Any, **labels: str) -> float | None:
    """按标签求和;该桶一条样本都没有 ⇒ None(== "这个身份从未被量到"),不是 0。

    0 与"没量过"必须能区分开 —— 这是 §0.3 在本模块里的落点,也是"只装量不装拦"
    这种半修会被发现的唯一凭据。外层 ``snapshot()["status"]`` 才负责区分
    "计量关着(整片 None)"与"计量开着、这一格尚无时序"。

    ⚠ prometheus_client 会给每个 Counter 额外发一条 ``*_created`` 样本,值是
    Unix 时刻(实测 1.79e9)。不把它剔掉,"拦截了几次"会被读成"几点几分创建的"
    —— 本仓 §5e-3 禁的"把时刻当身份"换到读数侧就是这一型。形状锁见
    ``tests/test_sandbox_block_metrics.py``。
    """
    total: float | None = None
    try:
        for family in metric.collect():
            for sample in family.samples:
                if sample.name.endswith("_created"):
                    continue
                if all(sample.labels.get(k) == v for k, v in labels.items()):
                    total = (0.0 if total is None else total) + float(sample.value)
    except Exception:  # noqa: BLE001
        return None
    return total


def _guard_breakdown() -> dict[str, Any]:
    """护栏安装读数:状态维按声明集逐档给数(没量过 vs 量为 0 由外层 status 区分),
    reason 维直接从时序自身枚举 —— 本仓不再抄一份 reason 清单(§0.6 单一真相源:
    reason 身份住在 proc_sandbox,这里只读它发出来的样本)。
    """
    by_state: dict[str, float | None] = {
        state: _sum_samples(sandbox_guard_state_total, state=state)
        for state in sorted(SANDBOX_GUARD_STATES)
    }
    by_reason: dict[str, float] = {}
    try:
        for family in sandbox_guard_state_total.collect():
            for sample in family.samples:
                if sample.name.endswith("_created"):
                    continue  # 同 _sum_samples:创建时刻不是计数(见那里的 ⚠ 注)
                reason = sample.labels.get("reason_id")
                if reason is not None:
                    by_reason[reason] = by_reason.get(reason, 0.0) + float(sample.value)
    except Exception:  # noqa: BLE001 - 读数坏了落空并由外层 undetermined 维如实呈现
        logger.debug("[sandbox-metrics] guard reason 枚举失败", exc_info=True)
    return {"byState": by_state, "byReason": by_reason}


def _rule_series(metric: Any, decision: str) -> dict[str, float | None]:
    """按 rule_id 汇总某一 decision 的时序,并把**声明过但从未出现**的身份补成 None。

    两个方向都要如实:
    - 声明过而没时序 ⇒ None(这条规则从没被问过,不是"问了 0 次");
    - 出现过的身份一律列出,包括 ``unclassified``(折叠本身是一种失效,藏起来就没人修)。
    """
    observed: dict[str, float] = {}
    try:
        for family in metric.collect():
            for sample in family.samples:
                if sample.name.endswith("_created"):
                    continue
                if sample.labels.get("decision") != decision:
                    continue
                identity = str(sample.labels.get("rule_id") or UNDETERMINED_IDENTITY)
                observed[identity] = observed.get(identity, 0.0) + float(sample.value)
    except Exception:  # noqa: BLE001
        logger.debug("[sandbox-metrics] rule 时序枚举失败", exc_info=True)
    merged: dict[str, float | None] = dict.fromkeys(sorted(SANDBOX_RULE_IDS))
    merged.update({rule: value for rule, value in observed.items() if value is not None})
    return merged


def _blind_rule_view() -> dict[str, float | None]:
    """关档时的读数面:每条声明身份都摆明"没量"(None),不填 0、也不留空表。

    空表会被读成"这个计量面不存在";None 逐条列出才会读成"计量关了,所以这些格没数"。
    """
    view: dict[str, float | None] = dict.fromkeys(sorted(SANDBOX_RULE_IDS))
    view[UNDETERMINED_IDENTITY] = None
    return view


def snapshot() -> dict[str, Any]:
    """当前计量面读数快照。关档 / 取不到 ⇒ 相应格子为 None 并给出原因,不填 0。"""
    enabled = metrics_enabled()
    state = policy_version_state()
    return {
        "status": "measured" if enabled else "disabled",
        "reason": None if enabled else f"{METRICS_ENABLED_ENV} 显式关闭",
        "enabled": enabled,
        "policy": state,
        "blocksByRule": _rule_series(sandbox_decisions_total, DECISION_BLOCK)
        if enabled
        else _blind_rule_view(),
        "allowsByRule": _rule_series(sandbox_decisions_total, DECISION_ALLOW)
        if enabled
        else _blind_rule_view(),
        "undeterminedByRule": _rule_series(sandbox_decisions_total, DECISION_UNDETERMINED)
        if enabled
        else _blind_rule_view(),
        "guard": _guard_breakdown() if enabled else None,
        "undeterminedTotal": _sum_samples(sandbox_metrics_undetermined_total)
        if enabled
        else None,
    }


def _reset_caches_for_tests() -> None:
    """清策略版本缓存(缓存只存 ok 结果;测试翻转投影面时需要重算)。"""
    global _policy_state_cache
    _policy_state_cache = None


# 镜像测试唯一入口(§22c:禁止在测试里复制判据常量,一律 import 源模块 __test__)。
__test__ = {
    "classify_acl": classify_acl,
    "metrics_enabled": metrics_enabled,
    "policy_version_state": policy_version_state,
    "publish_policy_info": publish_policy_info,
    "record_block": record_block,
    "record_decision": record_decision,
    "record_guard_state": record_guard_state,
    "reset_caches": _reset_caches_for_tests,
    "snapshot": snapshot,
    "safe_identity": _safe_identity,
    "rules": SANDBOX_RULE_IDS,
    "categories": SANDBOX_CATEGORIES,
    "decisions": SANDBOX_DECISIONS,
    "projection": POLICY_PROJECTION,
    "schema_version": POLICY_SCHEMA_VERSION,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
