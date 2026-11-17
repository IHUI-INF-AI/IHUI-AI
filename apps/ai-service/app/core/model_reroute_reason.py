# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型重路由事件契约 —— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物协议层 `struct ModelRerouteEvent with 3 elements`，字段逐字
``from_model`` / ``to_model`` / ``reason``。事件名映射 `ModelReroute` →
``model_reroute``。

管：给定一次模型重路由（请求模型 → 实际用模型 + 为什么改道），产出可机检的
三元素事件载荷；``reason`` 让消费方（审计 / 客户端 / 元学习）能区分"改道是同步
路径切换、异步路径切换、服务端错误、供应商故障、agent 侧降级还是用户侧 shell"。

不管：不执行改道（那是 llm_gateway 的 FallbackRouter / _resolve_auto_model 职责）；
不发 hook 事件（本仓 `_emit_model_reroute` 已生产发射，本模块只补 reason 维度）；
不替换 `classify_fallback_reason`（那是"异常→fallback 标签"轴，本模块是"重路由
触发源"轴，二者互补）。

超越轴（一轴）：对照把 reason 散在协议序列化各处、值域靠字段是否出现隐式区分、
无统一判定器；本仓让 reason 由**触发源显式驱动**（一个 `classify_reroute_reason`
纯函数覆盖全部触发源 + `unknown` 兜底），可 diff 可单测可挂审计。三元素载荷
`build_reroute_event()` 一次成型，字段名逐字对照。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class RerouteReason(StrEnum):
    """模型重路由触发源封闭集。

    逐字值来自对照协议层 ``ModelRerouteEvent.reason`` 的 strings 观察形态
    （``servererror`` / ``provider`` / ``agent`` / ``user_shell`` / ``sync`` /
    ``async``）。注意：strings 会拼接相邻 struct 字段，**这些值是观察到的候选
    值域，非逐字段确证**（诚实边界见报告 §6）。``UNKNOWN`` 是本仓兜底档（对照
    无对应显式档，本仓补齐防误判）。

    - ``SERVERERROR``：服务端错误触发改道（5xx / server error）。
    - ``PROVIDER``：供应商侧故障触发改道（厂商适配器初始化失败等）。
    - ``AGENT``：agent 侧主动降级（预算治理 degrade_to_model 等）。
    - ``USER_SHELL``：用户侧 shell 触发（对照形态）。
    - ``SYNC``：同步调用路径切换。
    - ``ASYNC``：异步调用路径切换。
    - ``UNKNOWN``：无法归类的兜底档（本仓补齐）。
    """

    SERVERERROR = "servererror"
    PROVIDER = "provider"
    AGENT = "agent"
    USER_SHELL = "user_shell"
    SYNC = "sync"
    ASYNC = "async"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class ModelRerouteEvent:
    """模型重路由事件（对照 `struct ModelRerouteEvent with 3 elements`）。

    不变量：``from_model`` 可为 None（无请求模型 / 默认模型时）；``to_model`` 非空
    （改道必有目标）；``reason`` ∈ RerouteReason 封闭集。
    """

    from_model: str | None
    to_model: str
    reason: RerouteReason


def classify_reroute_reason(
    *,
    is_server_error: bool = False,
    is_provider_failure: bool = False,
    is_agent_degrade: bool = False,
    is_user_shell: bool = False,
    call_path: str | None = None,
) -> RerouteReason:
    """由触发源判定重路由原因（唯一出口，表驱动优先级链）。

    优先级（人意志 > 环境 > 主动 > 故障）：
    1. ``user_shell`` —— 用户侧显式触发，最优先。
    2. ``agent`` —— agent 侧主动降级（预算治理等），主动优先于故障。
    3. ``servererror`` —— 服务端错误。
    4. ``provider`` —— 供应商故障。
    5. ``sync`` / ``async`` —— 由 ``call_path`` 判定（仅当无其他触发源）。
    6. ``unknown`` —— 兜底。

    ``call_path`` 只在 ``"sync"`` / ``"async"`` 时生效，其余值忽略（防误用）。
    """
    if is_user_shell:
        return RerouteReason.USER_SHELL
    if is_agent_degrade:
        return RerouteReason.AGENT
    if is_server_error:
        return RerouteReason.SERVERERROR
    if is_provider_failure:
        return RerouteReason.PROVIDER
    if call_path == "sync":
        return RerouteReason.SYNC
    if call_path == "async":
        return RerouteReason.ASYNC
    return RerouteReason.UNKNOWN


def build_reroute_event(
    from_model: str | None,
    to_model: str,
    reason: RerouteReason,
) -> ModelRerouteEvent:
    """构造重路由事件（唯一出口，校验不变量）。

    ``to_model`` 为空串时归一化为 ``from_model``（防无目标改道）；其余原样。
    """
    target = to_model if to_model else (from_model or "")
    return ModelRerouteEvent(
        from_model=from_model, to_model=target, reason=reason
    )


def event_to_dict(event: ModelRerouteEvent) -> dict[str, object]:
    """序列化为对照逐字字段名的 dict（可机检，字段名 from_model/to_model/reason）。"""
    return {
        "from_model": event.from_model,
        "to_model": event.to_model,
        "reason": event.reason.value,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
