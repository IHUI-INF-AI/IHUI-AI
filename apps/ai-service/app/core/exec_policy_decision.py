# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/exec_policy_decision.py
"""未匹配命令的审批决策矩阵(2026-09-19 第三十一批,对标 Codex exec_policy.rs)。

当命令未被任何 exec-policy 规则显式命中时,Codex 用一个四输入决策矩阵
推导最终处置(render_decision_for_unmatched_command 忠实移植):

- **危险命令 / Windows 无沙箱后端但声明受管文件限制** → 永不静默放行:
  approval=never → Forbidden(宁禁不放),其余 → Prompt(宁提不静默);
- **never**:危险外命令依赖沙箱兜底 → Allow;
- **unless_trusted**:非信任项目下每条未显式允许的命令都要问 → Prompt;
- **on_request / granular**:沙箱 unrestricted/external → Allow;
  restricted 时仅当命令请求沙箱越权(escalation)才 Prompt,否则
  交给沙箱执行,不打扰用户。

另移植 ``prompt_is_rejected_by_policy``:granular 模式下"规则审批"与
"沙箱越权审批"两个开关独立判定,规则提示优先;never 与任何提示互斥
(PROMPT_CONFLICT_REASON 原文)。拒绝原因常量保留 Codex 英文原文,
便于跨系统对账。

调用方传入 ``dangerous`` 判定(我们侧用 command_safety.dangerous_command_match,
PowerShell 来源命令用其 PS 专用检测,对应 Codex CommandOrigin 分派)。

接线状态(批 57 审计)
---------------------
**未接线。** 本模块的纯函数 ``render_decision_for_unmatched_command(dangerous,
context)`` 与 ``prompt_is_rejected_by_policy(approval_policy, prompt_is_rule,
granular)`` 决策矩阵的输入被收敛为 ``UnmatchedCommandContext``(含
``approval_policy`` / ``sandbox_kind`` / ``requests_sandbox_override`` /
``windows_managed_fs_restrictions_without_sandbox_backend`` 等策略/沙箱对象),
而命令实际执行点 ``app/services/agent_loop_v2.py::_execute_single``(run_command
/ unified_exec 入口)在调用时**不持有**上述策略/沙箱上下文,也无"未匹配命令"
的判定前置(现有命令安全由 ``command_safety`` 硬门 + ``_pre_guard_check`` +
``_resolve_exec_policy_approval`` 承担)。因此:

- 若强行在此处构造 ``UnmatchedCommandContext`` 会引入对策略/沙箱对象的假设,
  可能改变既有命令安全语义;
- 本模块亦无"命令字符串 → 决策文案"的纯渲染函数(``render_*`` 返回 ``Decision``
  枚举而非文本),故无法以"仅增加提示面、拒绝路径不变"的最小方式接线。

按批 57 铁律"现有安全行为绝不能放松 / 不允许为了接而接破坏安全语义",
本模块保持纯函数形态、不接线;接线点留待引入 exec-policy 上下文后由 lead
统一接入(候选:``_execute_single`` 中 ``command_safety`` 硬门判定之后,先以
``dangerous`` + 真实 ``UnmatchedCommandContext`` 调
``render_decision_for_unmatched_command``,仅当返回 ``FORBIDDEN`` 时新增一个
"拒绝原因"提示位,不改变既有 allow/执行路径)。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Decision(StrEnum):
    ALLOW = "allow"
    PROMPT = "prompt"
    FORBIDDEN = "forbidden"


class AskForApproval(StrEnum):
    """审批策略(对标 AskForApproval;granular 用独立实例承载)。"""

    NEVER = "never"
    ON_REQUEST = "on_request"
    UNLESS_TRUSTED = "unless_trusted"
    GRANULAR = "granular"


@dataclass(frozen=True)
class GranularApproval:
    """granular 模式的细粒度开关(Codex GranularConfig 两能力位)。"""

    rules_approval: bool = True
    sandbox_approval: bool = True


class SandboxKind(StrEnum):
    UNRESTRICTED = "unrestricted"
    EXTERNAL_SANDBOX = "external_sandbox"
    RESTRICTED = "restricted"


class CommandOrigin(StrEnum):
    """命令来源(决定危险命令检测走通用还是 PowerShell 专用启发式)。"""

    GENERIC = "generic"
    POWERSHELL = "powershell"


PROMPT_CONFLICT_REASON = "approval required by policy, but AskForApproval is set to Never"
REJECT_SANDBOX_APPROVAL_REASON = (
    "approval required by policy, but AskForApproval::Granular.sandbox_approval is false"
)
REJECT_RULES_APPROVAL_REASON = (
    "approval required by policy rule, but AskForApproval::Granular.rules is false"
)


@dataclass(frozen=True)
class UnmatchedCommandContext:
    """未匹配命令的决策上下文(对标 UnmatchedCommandContext,输入收敛为纯量)。"""

    approval_policy: AskForApproval
    granular: GranularApproval = GranularApproval()
    sandbox_kind: SandboxKind = SandboxKind.RESTRICTED
    requests_sandbox_override: bool = False
    windows_managed_fs_restrictions_without_sandbox_backend: bool = False


def render_decision_for_unmatched_command(
    dangerous: bool,
    context: UnmatchedCommandContext,
) -> Decision:
    """决策矩阵主入口(对标 render_decision_for_unmatched_command_for_platform)。

    ``dangerous``:命令是否命中危险命令检测(含 PowerShell 来源专用检测);
    ``windows_managed_fs_restrictions_without_sandbox_backend``:Windows 下
    声明了受管文件系统限制但沙箱后端被禁用(无强制力 → 保守升级为需审批)。
    """
    # 危险命令或"纸面限制无沙箱后端"时绝不静默放行:
    # 宁可提示;用户显式禁提示(never)则必须禁止。
    if dangerous or context.windows_managed_fs_restrictions_without_sandbox_backend:
        if context.approval_policy is AskForApproval.NEVER:
            return Decision.FORBIDDEN
        return Decision.PROMPT

    if context.approval_policy is AskForApproval.NEVER:
        # 非危险命令:放行,依赖沙箱保护(Codex 注释同款)
        return Decision.ALLOW
    if context.approval_policy is AskForApproval.UNLESS_TRUSTED:
        # 非信任项目:未显式允许的命令一律询问
        return Decision.PROMPT

    # on_request 与 granular 对未匹配命令同构:看沙箱类型
    if context.sandbox_kind in (SandboxKind.UNRESTRICTED, SandboxKind.EXTERNAL_SANDBOX):
        return Decision.ALLOW
    # restricted:仅越权请求才打扰用户,其余交给沙箱
    if context.requests_sandbox_override:
        return Decision.PROMPT
    return Decision.ALLOW


def prompt_is_rejected_by_policy(
    approval_policy: AskForApproval,
    prompt_is_rule: bool,
    granular: GranularApproval = GranularApproval(),
) -> str | None:
    """审批策略是否禁止把当前提示呈现给用户;返回拒绝原因或 None。

    ``prompt_is_rule`` 区分"策略规则触发的提示"与"沙箱/越权提示",
    granular 的 rules 与 sandbox_approval 两个开关独立生效;两者同时
    适用时规则提示优先(Codex 文档注释同款)。
    """
    if approval_policy is AskForApproval.NEVER:
        return PROMPT_CONFLICT_REASON
    if approval_policy in (AskForApproval.ON_REQUEST, AskForApproval.UNLESS_TRUSTED):
        return None
    # GRANULAR
    if prompt_is_rule:
        if not granular.rules_approval:
            return REJECT_RULES_APPROVAL_REASON
        return None
    if not granular.sandbox_approval:
        return REJECT_SANDBOX_APPROVAL_REASON
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
