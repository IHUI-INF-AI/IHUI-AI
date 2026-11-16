# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""能力版本 payload 门(对标 Codex Desktop 26.1111 capability gate,2026-11-15 逆向复现)。

为什么要有这一份:IHUI `capability_matrix.py` 是**能力开关台账**(默认关 + 开机自检,
按 entry 显式 opt-in)。但 Codex 桌面端有一套**完全不同轴**的机制——**版本演进 payload 门**:
    一张 capability→最低版本 表(83 门),判定「对端版本是否支持某能力」;
    不支持就把该能力的字段从请求 payload 里**剥离**,再发出去。
    这样同一个 payload 结构可以随版本演进加字段,旧客户端/旧后端不会因为收到
    未知字段而崩——协议向后兼容不靠「永远不加字段」,而靠「按对端能力剥离字段」。
(取证:`app.asar` 主进程 chunk `early-bootstrap-331-*.js` —— capability→版本表 83 门
 (thread*/computer*/guardian*/compaction/tokenBudget/steering/approval…),
 sanitize 形如 `if(payload[k]!==null && !JF(peerVersion,"CapName")){let {[k]:_,...rest}=payload; payload=rest}`,
 即「对端不支持就剥字段」,链式逐门过滤。JF 定义未直接命中(跨 chunk/内联),按行为取证。)

超越轴(相对「永远不加字段」或「一刀切版本号」):
    - **可判定**:每字段一个 gate 结论(kept/stripped),调用方能断言「这条为什么被剥」;
    - **可枚举**:暴露 capability 清单 + 门槛,审计「这次降级掉了哪些能力」;
    - **白名单门控**(取证真相):只门控登记在册的演进字段,未登记的稳定键原样透传
      —— 协议兼容只发生在「已知演进点」,稳定字段永不被误剥。

显式不做:不做真实 semver 库(本仓已有 `packaging`/可换);不做 wire 序列化;
不做 capability 协商握手(只做「给定对端版本 → sanitize payload」这一步)。

纯逻辑层:吃「payload dict + capability 表 + 对端版本」,吐 sanitize 后 payload + 剥离台账。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# 版本比较:语义化版本段比较(主.次.修订[-alpha.N]),不足位补 0。
# Codex 用 semver 语义(alpha 预发布 < 正式发布);这里内联轻量比较,不引第三方依赖。


def parse_version(v: str) -> tuple[int, ...]:
    """把 '1.2.3-alpha.4' 解析成可比较元组。

    预发布(alpha/beta/rc)低于同号正式版;预发布内部按序号递增
    (alpha.1 < alpha.2),故 pre 段记 (0, 序号),正式版记 (1, 0)。
    """
    core = v
    pre_rank = (1, 0)  # 默认正式版
    if "-" in v:
        core, tag = v.split("-", 1)
        # 取预发布序号(alpha.4 → 4);无序号记 0
        num = 0
        m = re.search(r"(\d+)$", tag)
        if m:
            num = int(m.group(1))
        pre_rank = (0, num)
    parts = [int(x) for x in core.split(".") if x != ""]
    while len(parts) < 3:
        parts.append(0)
    return (*parts[:3], *pre_rank)


def version_at_least(actual: str, minimum: str) -> bool:
    """actual >= minimum?(语义化版本;预发布低于同号正式)"""
    a = parse_version(actual)
    m = parse_version(minimum)
    return a >= m


# ---- 能力表 ----

@dataclass(frozen=True)
class CapabilityGate:
    """一个能力门:capability 名 → 引入该能力的最低版本。"""

    name: str
    minimum_version: str


@dataclass
class GateDecision:
    """一个字段门的裁决。"""

    capability: str
    payload_key: str
    kept: bool
    reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "capability": self.capability,
            "payloadKey": self.payload_key,
            "kept": self.kept,
            "reason": self.reason,
        }


@dataclass
class SanitizeResult:
    """一次 payload sanitize 的结论:净化后 payload + 逐门台账。"""

    payload: dict[str, Any]
    decisions: list[GateDecision] = field(default_factory=list)
    peer_version: str = ""

    @property
    def stripped(self) -> list[GateDecision]:
        return [d for d in self.decisions if not d.kept]

    def stripped_keys(self) -> list[str]:
        """被剥离的 payload 键(只含受门控且对端不支持的;稳定字段永不在此)。"""
        return [d.payload_key for d in self.stripped]

    def as_dict(self) -> dict[str, Any]:
        return {
            "payload": self.payload,
            "peerVersion": self.peer_version,
            "decisions": [d.as_dict() for d in self.decisions],
            "strippedKeys": [d.payload_key for d in self.stripped],
        }


class CapabilityRegistry:
    """能力门注册表:capability 名 → 门槛版本 + 该能力在 payload 里的字段键。"""

    def __init__(self) -> None:
        # (capability, payload_key) 多对一:一个能力可能控制多个 payload 键。
        self._gates: dict[str, CapabilityGate] = {}
        # payload_key -> (capability_name, minimum_version)
        self._key_index: dict[str, tuple[str, str]] = {}

    def register(self, capability: str, minimum_version: str, payload_keys: list[str]) -> None:
        """登记一个能力门:对端 < minimum_version 时剥离 payload_keys。"""
        self._gates[capability] = CapabilityGate(capability, minimum_version)
        for k in payload_keys:
            self._key_index[k] = (capability, minimum_version)

    def capabilities(self) -> list[CapabilityGate]:
        return list(self._gates.values())

    def gate_for_key(self, payload_key: str) -> tuple[str, str] | None:
        return self._key_index.get(payload_key)

    def sanitize(self, payload: dict[str, Any], peer_version: str) -> SanitizeResult:
        """按对端版本净化 payload:对端不支持某能力就剥离其字段(白名单门控)。

        取证真相(chunk 331 sanitize 链):只有**登记在册**的演进字段才被 JF 门控;
        **未登记的键原样透传**(它们是稳定字段,不随版本剥离)。这不是"未知就剥离"的
        fail-safe,而是"只在已知演进点做兼容"的白名单——稳定字段永不被误剥。
        """
        if not isinstance(payload, dict):
            raise TypeError("payload 必须是 dict")
        decisions: list[GateDecision] = []
        out = dict(payload)
        for key in list(payload.keys()):
            gate = self._key_index.get(key)
            if gate is None:
                decisions.append(GateDecision("", key, True, "非门控稳定字段,原样透传"))
                continue
            cap, minimum = gate
            supported = version_at_least(peer_version, minimum)
            if supported:
                decisions.append(
                    GateDecision(cap, key, True, f"对端 {peer_version} >= {minimum},保留")
                )
            else:
                decisions.append(
                    GateDecision(cap, key, False, f"对端 {peer_version} < {minimum},剥离")
                )
                out.pop(key, None)
        return SanitizeResult(payload=out, decisions=decisions, peer_version=peer_version)


def build_default_registry() -> CapabilityRegistry:
    """按 Codex 26.1111 取证的代表性能力门构造一张注册表(部分,非全部 83 门)。

    取证来源:chunk 331 版本表 + sanitize 链(见模块 docstring)。
    """
    reg = CapabilityRegistry()
    # (capability, minimum_version, payload_keys)
    for cap, ver, keys in [
        ("commandSessionsWorldState", "0.160.0-alpha.1", ["command_sessions_world_state"]),
        ("guardianNativeMultiAgentHistory", "0.161.0-alpha.2", ["guardian_native_multi_agent_history"]),
        ("preserveForkPrefix", "0.163.0-alpha.4", ["multi_agent_v2.preserve_fork_prefix"]),
        ("asyncCompaction", "0.163.0-alpha.11", ["async_compaction"]),
        ("compactionImageBudget", "0.162.0-alpha.1", ["compaction_image_budget"]),
        ("tokenBudgetHistoryNotes", "0.150.0-alpha.2", ["token_budget_history_notes"]),
        ("threadMemorySummary", "0.165.0-alpha.1", ["memory_phase_two_prompt"]),
        ("instantInterrupt", "0.164.0-alpha.3", ["instant_interrupt"]),
        ("threadSampleInterruptOnCancel", "0.167.0-alpha.1", ["sample_interrupt_on_cancel"]),
    ]:
        reg.register(cap, ver, keys)
    return reg
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
