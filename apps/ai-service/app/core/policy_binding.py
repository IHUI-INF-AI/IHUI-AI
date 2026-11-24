# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""把可编程策略（`policy_dsl`）接到既有安全判定链 —— 真接线层。

## 为什么需要单独一层

`policy_dsl.py` 只是「表达式求值器」：给它字符串和环境，它给出三态。
但它**不认识**本仓的安全枚举（`Decision` / `SandboxKind` / `AskForApproval`），
也不知道该怎么影响实际判定。

本模块做三件事：
1. **双向映射**：既有枚举 ↔ 策略环境变量（策略作者只写 `sandbox == "restricted"`，
   不需要知道 Python 枚举名）。
2. **判定合成**：把「既有判定」与「策略判定」按**只许收紧**的规则合成。
3. **fail-closed 兜底**：策略未判定 / 未提供 ⇒ 保持既有判定，零行为变化。

## 安全规则（本模块最重要的部分）

### 规则一：策略只许收紧，不许放宽

既有链路（`exec_policy_decision.render_decision_for_unmatched_command`）在
`policy_dsl` 出现之前就已成立并被回归钉住。策略是**新增输入**，若它能放宽既有
判定，那么「多写一条策略」就等于「关掉审批门」。

因此合成规则固定为：

```
既有 FORBIDDEN  + 任意策略结果 ⇒ FORBIDDEN   （既有最严，不可放宽）
既有 PROMPT     + 策略命中      ⇒ FORBIDDEN   （收紧）
既有 PROMPT     + 策略不命中/未判定 ⇒ PROMPT   （保持）
既有 ALLOW      + 策略命中      ⇒ PROMPT      （收紧）
既有 ALLOW      + 策略不命中    ⇒ ALLOW       （保持）
既有 ALLOW      + 策略未判定    ⇒ PROMPT      （未判定按收紧处理，见规则二）
```

### 规则二：未判定按「收紧」而非「保持」处理 —— 这是有意的偏离

初看会想「策略未判定 ⇒ 保持既有」，但这会让**装配错误静默通过**：
策略作者把 `host` 拼成 `hots`，表达式恒 `UNDETERMINED`，若按「保持」处理，
这条 deny 规则就永远不生效，而运维看不到任何异常。

所以本模块对 `UNDETERMINED` 的处置是：
- **有既有判定可依时**：`ALLOW` → 抬到 `PROMPT`（宁可多问一次），
  `PROMPT` / `FORBIDDEN` 保持（已经足够严）。
- **无既有判定**（`policy_only` 模式）：直接 `FORBIDDEN`。

方向恒为「多要一次定向说明」，符合本仓 §0.10「失效方向必须是多要一次定向说明，
绝不能是多放一次跳门」。

### 规则三：未提供策略 ⇒ 逐字节等价

`binding is None` 时直接返回既有判定，不构造任何策略对象。这是接线不改变
现网行为的硬保证，由 `test_no_policy_means_zero_change` 钉住。

### 规则四：命中即留痕

返回 `BindingVerdict`，含最终判定、既有判定、策略状态、以及「哪一侧导致的收紧」。
调用方可以把 `to_explanation()` 写进决策日志 —— 出问题时能直接回答
「这条命令为什么被拦」，而不是只有一个 `FORBIDDEN`。

## 接线状态

本模块是**纯函数 + 无副作用**，可被任何调用点使用。已提供 `bind_policy()` 工厂
把表达式编译一次后复用（避免每条命令重复解析）。

**尚未接入生产调用链**：`agent_loop_v2.py::_execute_single` 与 `agent_engine.py`
当前为他席在飞文件（`M` 状态），按 §2 并发纪律不改。接入所需的全部前置已在
本模块备齐（工厂 + 合成规则 + 留痕），接线方只需在拿到既有 `Decision` 之后
调一次 `Binding.apply()`。
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from .exec_policy_decision import (
    Decision,
    UnmatchedCommandContext,
    render_decision_for_unmatched_command,
)
from .policy_dsl import (
    CompiledPolicy,
    CompileError,
    EvalState,
    PolicyEnv,
    compile_policy,
    evaluate_policy,
)

# 既有判定的严格度序（越大越严）。合成规则靠它做单调比较。
DECISION_STRICTNESS: Mapping[Decision, int] = {
    Decision.ALLOW: 0,
    Decision.PROMPT: 1,
    Decision.FORBIDDEN: 2,
}


class TightenCause(StrEnum):
    """这一次收紧/保持是**哪一侧**导致的（留痕用）。"""

    NO_POLICY = "no_policy"
    EXISTING_ONLY = "existing_only"
    POLICY_HIT = "policy_hit"
    POLICY_UNDETERMINED = "policy_undetermined"
    EXISTING_CEILING = "existing_ceiling"


@dataclass(frozen=True)
class BindingVerdict:
    """合成结论。`final` 才是调用方该用的值。"""

    final: Decision
    existing: Decision
    policy_state: EvalState | None
    cause: TightenCause
    notes: tuple[str, ...] = field(default=())

    @property
    def tightened(self) -> bool:
        """是否比既有判定更严（供审计统计「策略实际起了作用」）。"""
        return DECISION_STRICTNESS[self.final] > DECISION_STRICTNESS[self.existing]

    def to_explanation(self) -> str:
        parts = [
            f"final={self.final}",
            f"existing={self.existing}",
            f"policy={self.policy_state}",
            f"cause={self.cause}",
        ]
        if self.tightened:
            parts.append("收紧=是")
        if self.notes:
            parts.append(" | ".join(self.notes))
        return "；".join(parts)


def build_policy_env(
    *,
    context: UnmatchedCommandContext | None = None,
    dangerous: bool | None = None,
    extra: Mapping[str, object] | None = None,
) -> PolicyEnv:
    """把既有安全上下文映射成策略可用的变量（策略作者不必知道 Python 枚举名）。

    可用变量（全部是**值**而不是枚举对象，策略里做字符串比较即可）：

    | 变量 | 取值 |
    |---|---|
    | `approval` | `never` / `on_request` / `unless_trusted` / `granular` |
    | `sandbox` | `unrestricted` / `external_sandbox` / `restricted` |
    | `requests_override` | bool |
    | `windows_managed_without_backend` | bool |
    | `rules_approval` | bool（granular 位） |
    | `sandbox_approval` | bool（granular 位） |
    | `dangerous` | bool（可选） |

    `extra` 可追加调用方自有变量（如 `host` / `user`），同名以 `extra` 为准。
    """
    values: dict[str, object] = {}
    if context is not None:
        values["approval"] = context.approval_policy.value
        values["sandbox"] = context.sandbox_kind.value
        values["requests_override"] = bool(context.requests_sandbox_override)
        values["windows_managed_without_backend"] = bool(
            context.windows_managed_fs_restrictions_without_sandbox_backend
        )
        values["rules_approval"] = bool(context.granular.rules_approval)
        values["sandbox_approval"] = bool(context.granular.sandbox_approval)
    if dangerous is not None:
        values["dangerous"] = bool(dangerous)
    if extra:
        values.update(extra)
    return PolicyEnv(values=values)


def _tighten(existing: Decision, policy_state: EvalState | None) -> tuple[Decision, TightenCause]:
    """按模块 docstring 的四条规则合成最终判定。"""
    if policy_state is None:
        return existing, TightenCause.NO_POLICY
    if existing is Decision.FORBIDDEN:
        # 既有最严，任何策略都不放宽
        return Decision.FORBIDDEN, TightenCause.EXISTING_CEILING
    if policy_state is EvalState.TRUE:
        # 策略命中 ⇒ 收紧到 FORBIDDEN（无论既有是 ALLOW 还是 PROMPT）
        return Decision.FORBIDDEN, TightenCause.POLICY_HIT
    if policy_state is EvalState.FALSE:
        return existing, TightenCause.EXISTING_ONLY
    # UNDETERMINED：按收紧处理（规则二）
    if existing is Decision.ALLOW:
        return Decision.PROMPT, TightenCause.POLICY_UNDETERMINED
    return existing, TightenCause.POLICY_UNDETERMINED


@dataclass(frozen=True)
class PolicyBinding:
    """已编译的策略 + 合成能力。用 `bind_policy()` 构造。"""

    policy: CompiledPolicy
    name: str = ""

    def apply(
        self,
        existing: Decision,
        *,
        context: UnmatchedCommandContext | None = None,
        dangerous: bool | None = None,
        extra: Mapping[str, object] | None = None,
    ) -> BindingVerdict:
        env = build_policy_env(context=context, dangerous=dangerous, extra=extra)
        res = evaluate_policy(self.policy, env)
        final, cause = _tighten(existing, res.state)
        return BindingVerdict(
            final=final,
            existing=existing,
            policy_state=res.state,
            cause=cause,
            notes=res.trail,
        )


def bind_policy(source: str, *, name: str = "") -> tuple[PolicyBinding | None, CompileError | None]:
    """编译并包装成可复用绑定。失败返回 `(None, CompileError)`，不抛异常。"""
    policy, err = compile_policy(source)
    if err is not None:
        return None, err
    if policy is None:
        return None, CompileError(
            code=err.code if err else None,  # type: ignore[arg-type]
            detail="编译未产出策略",
        )  # pragma: no cover - compile_policy 已保证二者互斥
    return PolicyBinding(policy=policy, name=name), None


def decide_with_policy(
    dangerous: bool,
    context: UnmatchedCommandContext,
    *,
    policy: PolicyBinding | None = None,
    extra: Mapping[str, object] | None = None,
) -> BindingVerdict:
    """一站式入口：先走既有判定矩阵，再叠加策略。

    `policy is None` ⇒ 只返回既有判定（零行为变化）。
    """
    existing = render_decision_for_unmatched_command(dangerous, context)
    if policy is None:
        return BindingVerdict(
            final=existing,
            existing=existing,
            policy_state=None,
            cause=TightenCause.NO_POLICY,
            notes=("未提供策略，既有判定原样返回（零行为变化）",),
        )
    return policy.apply(existing, context=context, dangerous=dangerous, extra=extra)


__all__ = [
    "DECISION_STRICTNESS",
    "BindingVerdict",
    "PolicyBinding",
    "TightenCause",
    "bind_policy",
    "build_policy_env",
    "decide_with_policy",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
