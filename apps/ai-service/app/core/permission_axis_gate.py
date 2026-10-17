# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""权限双轴消费面接线(79 号票第二刀,2026-10-18 立)。

上方 core/permission_axis.py 是**契约层**(成员/别名/预设/Legacy 映射/配置档案的
数据面,跨语言镜像);本模块是它的**唯一消费面**:把双轴取值接到"某次工具调用
要不要审批 / 能不能执行"的判定上。

安全方向(本模块最重要的一条,写在最前面)
----------------------------------------
**双轴只许收紧,不许放宽。** approval_policy=never 到达本模块时**不**产生
"免审批"效果,sandbox_mode=danger-full-access 也不产生"放行"效果。
理由不是保守偏好,而是可证的事实:双轴是**新增输入**,现有审批链(高危清单 →
bypass 档 → MCP 注解保守门 → 工具级策略覆盖)在双轴引入前就已成立并被回归钉住;
若双轴的放行能压过既有审批,那么"客户端多带两个字段"就等于"关掉审批门",
而客户端是外部输入 —— 那正是 G-161 要根治的那一型静默失效(界面一切正常、
安全语义已被改)。所以本模块的三态里 ALLOW 的语义是"**不介入**",不是"批准":

- FORBID          本轴拒绝执行(不弹审批,直接给拒绝结果)—— 收紧;
- REQUIRE_APPROVAL 抬升为需人工审批 —— 收紧;
- ALLOW           本轴不介入,交既有链路照旧判定 —— 零变化。

配套的第三条纪律:**未携带双轴时零行为变化**。本模块的入口允许返回 None
(没有任何双轴输入),调用方拿到 None 必须整段跳过 —— 现网所有不带双轴的调用方
因此逐字节保持原行为,这也是本票能安全落地的前置。

取值来源的优先级(先到先得,不做多重回退)
----------------------------------------
1. 显式双轴(sandbox_mode + approval_policy 两字段);
2. config profile(``[profiles.NAME]`` 的顶层键子集);
3. Legacy 单轴 permission_mode → PERMISSION_MODE_TO_AXIS;
4. 都没有 ⇒ None。

Legacy 映射为 null 的两档(acceptEdits / manual)按契约层规矩**不得回退到任一
预设**:本模块返回 None(不介入)并记 ``axis_unmapped_mode``,绝不猜一个档位。

与 core/exec_policy_decision.py 的关系
--------------------------------------
那个模块记录着"未接线 —— 执行点不持有策略上下文"。本票**不**去改命令执行路径
(改那里等于改命令安全语义,属另一张票的授权范围);本模块的落点是**工具审批
判定链末尾的一层叠加**,输入是工具注解而非命令字符串,因此不触碰命令安全。
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from .permission_axis import (
    APPROVAL_PRESETS,
    PERMISSION_MODE_TO_AXIS,
    normalize_approval_policy,
    normalize_sandbox_mode,
    resolve_config_profile_axis,
)
from .permission_mode import normalize_permission_mode

__all__ = [
    "AxisDecision",
    "AxisResolution",
    "AxisSource",
    "axis_dims_from_mcp_annotations",
    "axis_gate_decision",
    "axis_gate_hint",
    "resolve_axis_resolution",
]


def axis_dims_from_mcp_annotations(annotations: object) -> tuple[bool | None, bool | None]:
    """MCP 工具注解 → ``(writes, network)`` 两维;**该维度推不出时返回 None**。

    推导依据(本仓既有契约,不是本票新造的真理):MCP 工具只声明三个 hint
    —— read_only_hint / destructive_hint / open_world_hint,其中没有"是否写"与
    "是否联网"的布尔,故:
    - writes ⇐ read_only_hint 的反面(True→False / False→True / 缺失→None);
    - network ⇐ open_world_hint 直接取用(open world 即"可触达本工作区之外")。
    destructive_hint **刻意不参与**:它描述破坏性、与"是否联网"正交,
    且本仓既有保守门已把它单独用于"必批"判定,把它掺进本推导会重复计权。

    两维都缺失(内置工具、或 server 没声明注解)⇒ (None, None) ⇒ 下游按最坏
    情况抬升 —— 绝不因元数据缺失放行(与 mcp_tool_approval 的保守语义同一条)。
    """
    if annotations is None:
        return (None, None)
    read_only = _annotation_bool(annotations, "read_only_hint")
    open_world = _annotation_bool(annotations, "open_world_hint")
    writes: bool | None = None if read_only is None else not read_only
    return (writes, open_world)


def _annotation_bool(annotations: object, key: str) -> bool | None:
    """从 dict 或对象里取布尔 hint;非布尔(含 None/缺失)一律视作"未知"。"""
    if isinstance(annotations, Mapping):
        raw = annotations.get(key)
    else:
        raw = getattr(annotations, key, None)
    return raw if isinstance(raw, bool) else None


class AxisSource(StrEnum):
    """双轴取值的来源(审计可见:决策不能只留结果不留来历)。"""

    EXPLICIT = "explicit"
    PRESET = "preset"
    CONFIG_PROFILE = "config_profile"
    LEGACY_MODE = "legacy_mode"


@dataclass(frozen=True)
class AxisResolution:
    """一次会话/请求解析出的双轴取值 + 来历。

    两轴都允许为 **None = 该轴未指定**(不是"默认档"):{
    "只声明了 approval_policy"的请求不得被自动补成 read-only
    —— 那会把"我不要弹审批"读成"禁止一切写操作",是方向相反的失真。
    裁决器据此只让**已指定的轴**发言,未指定的轴不介入。
    """

    sandbox_mode: str | None = None
    approval_policy: str | None = None
    source: AxisSource = AxisSource.EXPLICIT
    profile_name: str | None = None
    legacy_mode: str | None = None


def resolve_axis_resolution(
    *,
    sandbox_mode: object = None,
    approval_policy: object = None,
    preset: object = None,
    profile: object = None,
    profile_name: str | None = None,
    permission_mode: object = None,
) -> AxisResolution | None:
    """从 wire 四个输入里解析双轴;**无任何双轴输入返回 None**(调用方须整段跳过)。

    显式双轴两字段可以只给一个:缺的那个取该轴默认(与 config profile 的
    "缺失可补默认、给了认不出是失败"同一条口径)。
    两轴都给了但任一认不出 ⇒ 整段返回 None:半个双轴不算双轴,拿它去判定
    等于拿默认值冒充用户选择(方向相反的失真),宁可不介入。
    """
    has_explicit = sandbox_mode is not None or approval_policy is not None
    if has_explicit:
        # 只给一轴时另一轴保持 None(未指定),**不补默认档**:补 read-only 会把
        # "只声明审批轴"的请求读成"禁止写操作"(方向相反的失真,见 AxisResolution 注释)。
        sm = None
        if sandbox_mode is not None:
            sm = normalize_sandbox_mode(sandbox_mode)
            if sm is None:
                return None
        ap = None
        if approval_policy is not None:
            ap = normalize_approval_policy(approval_policy)
            if ap is None:
                return None
        return AxisResolution(sandbox_mode=sm, approval_policy=ap, source=AxisSource.EXPLICIT)

    if preset is not None:
        if not isinstance(preset, str):
            return None
        pair = APPROVAL_PRESETS.get(preset.strip())
        if pair is None:
            return None
        return AxisResolution(
            sandbox_mode=pair[0],
            approval_policy=pair[1],
            source=AxisSource.PRESET,
            profile_name=preset.strip(),
        )

    if profile is not None:
        pair = resolve_config_profile_axis(profile)
        if pair is None:
            return None
        return AxisResolution(
            sandbox_mode=pair[0],
            approval_policy=pair[1],
            source=AxisSource.CONFIG_PROFILE,
            profile_name=profile_name,
        )

    if permission_mode is not None:
        mode = normalize_permission_mode(permission_mode)
        if mode is None:
            return None
        pair = PERMISSION_MODE_TO_AXIS.get(mode)
        # 契约层里 acceptEdits / manual 显式为 None:fail-closed 不伪造 ⇒ 不介入。
        if pair is None:
            return None
        return AxisResolution(
            sandbox_mode=pair[0],
            approval_policy=pair[1],
            source=AxisSource.LEGACY_MODE,
            legacy_mode=mode,
        )

    return None


class AxisDecision(StrEnum):
    """双轴对一次工具调用的处置。ALLOW 的语义是"不介入",见模块 docstring。"""

    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    FORBID = "forbid"


def axis_gate_decision(
    res: AxisResolution | None,
    *,
    writes: bool | None,
    network: bool | None,
) -> AxisDecision:
    """双轴对一次工具调用的处置(纯函数)。

    ``writes`` / ``network`` 为 None 表示**该维度未知**(工具没给 MCP 注解)。
    未知的处理方向只有一条:按最坏情况抬升。**唯一的例外**是"明确的读类工具"
    (writes=False 且 network=False)—— 那时双轴没有任何可收紧的对象。

    三档语义(收紧方向与既有链路不冲突):
    - read-only 轴:写类与外联**永不放行**,明确是则 FORBID(不是弹审批了事 ——
      沙箱轴说的是"这个操作不该发生",弹审批等于把结构性禁止降级成人工兜底);
      维度未知时降为 REQUIRE_APPROVAL(信息不足以定性,交人判)。
    - workspace-write 轴:工作区内可写,但外联越出工作区 ⇒ REQUIRE_APPROVAL。
    - untrusted 审批轴:该档语义是"非可信即问" ⇒ 有副作用/外联/未知都抬升为需批。
    - 其余档位(on-request / on-failure / never)一律不介入:
      on-request 由模型请求驱动,现有门已承担;on-failure 需要"已失败"这一输入,
      本层没有;never 若放宽就会压过既有审批(见模块 docstring)。
    """
    if res is None:
        return AxisDecision.ALLOW

    writes_known = writes is not None
    network_known = network is not None
    is_read_only = res.sandbox_mode == "read-only"

    if is_read_only:
        if writes is True or network is True:
            return AxisDecision.FORBID
        if not (writes_known and network_known):
            return AxisDecision.REQUIRE_APPROVAL

    if res.sandbox_mode == "workspace-write" and network is True:
        return AxisDecision.REQUIRE_APPROVAL

    if res.approval_policy == "untrusted":
        if writes is True or network is True:
            return AxisDecision.REQUIRE_APPROVAL
        if not (writes_known and network_known):
            return AxisDecision.REQUIRE_APPROVAL

    return AxisDecision.ALLOW


def axis_gate_hint(res: AxisResolution, decision: AxisDecision) -> tuple[str, str] | None:
    """给 ``_decision_hints`` 的决策留痕;ALLOW(不介入)不产生痕迹。

    留痕的必要性:双轴是外部输入,若它抬升了审批却无迹可寻,事后就只能看到
    "某次调用被拦了"而看不出是被谁抬的 —— 与票面要求的"决策来历可见"同规。
    """
    if res is None:
        return None
    # 未指定的轴显示成 "-",不是 "None" —— 审计读的是这句文本,
    # 打印 None 会被读成"轴值为空字符串/空值"而与"真给了个空值"混为一谈。
    pair_text = f"{res.sandbox_mode or '-'}/{res.approval_policy or '-'}"
    if decision == AxisDecision.FORBID:
        return (
            "axis_sandbox_forbid",
            f"双轴 {pair_text}(来源 {res.source}):沙箱轴禁止该操作,不弹审批直接拒绝",
        )
    if decision == AxisDecision.REQUIRE_APPROVAL:
        return (
            "axis_require_approval",
            f"双轴 {pair_text}(来源 {res.source}):按该轴要求抬升为人工审批",
        )
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
