# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""压缩策略灰度决策(1-3,2026-09-12 立,PROJECT_PLAN H7)。

灰度开关(env,运行时逐次读取,便于测试 monkeypatch 与热更新):
- ``AGENT_COMPACTION_MODE``:压缩策略模式
  * ``off``  :压缩彻底关闭(优先级最高,一键回滚)
  * ``ratio``:确定性比例压缩(core/context_compaction,现状默认压缩路径)
  * ``full`` :LLM 语义压缩(compact_with_llm,失败自动降级确定性)
  * 未设置  :legacy 行为(AGENT_COMPACTION_ENABLED + AGENT_COMPACTION_LLM_ENABLED),
    保证默认行为与现状逐零差异
- ``AGENT_COMPACTION_CANARY_PERCENT``:灰度比例(0~100,默认 100)。
  按 session/task id 的稳定哈希(sha256 前 8 字节,万分位粒度)决定该会话是否
  启用 MODE 指定的新策略;未命中灰度的会话回退 legacy 行为。

决策纯函数化(resolve_compaction_decision),无副作用、可单测;
AgentLoopV2 构造/压缩挂载点消费 CompactionDecision 生效。
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# 合法压缩模式
VALID_COMPACTION_MODES: tuple[str, ...] = ("off", "ratio", "full")

# 灰度哈希粒度:万分位(支持 0.01% 级灰度)
_CANARY_GRANULARITY = 10000

# 灰度 env 名(集中定义,避免散点字符串)
ENV_COMPACTION_MODE = "AGENT_COMPACTION_MODE"
ENV_COMPACTION_CANARY_PERCENT = "AGENT_COMPACTION_CANARY_PERCENT"


@dataclass(frozen=True)
class CompactionDecision:
    """单会话生效的压缩决策(灰度解析结果)。

    Attributes:
        mode: 生效模式("legacy"=沿用旧 env 行为 / "off" / "ratio" / "full")。
        enabled: 是否启用压缩。
        llm_enabled: 是否走 LLM 语义压缩路径。
        canary_selected: 是否命中灰度(MODE 设置时才有意义;legacy 恒为 True)。
    """

    mode: str
    enabled: bool
    llm_enabled: bool
    canary_selected: bool


def canary_bucket(key: str) -> int:
    """把任意标识(session/task id)稳定映射到 [0, 10000) 桶。

    sha256 前 8 字节大端整数取模:同一 key 跨进程/跨次调用结果恒定,
    分布近似均匀(万分位粒度)。
    """
    digest = hashlib.sha256(f"ihui-compaction-canary:{key}".encode()).digest()
    return int.from_bytes(digest[:8], "big") % _CANARY_GRANULARITY


def parse_canary_percent(raw: str | None) -> float:
    """解析灰度比例 env。

    - 未设置(None/空)→ 100.0(MODE 显式给出时默认全量生效);
    - 非法值(非数字)→ 0.0 并告警(fail-closed:配置错误时不放量新策略);
    - 越界值 clamp 到 [0, 100]。
    """
    if raw is None or not str(raw).strip():
        return 100.0
    try:
        value = float(str(raw).strip())
    except ValueError:
        logger.warning(
            "灰度比例配置非法(%s=%r),按 0%% 处理(fail-closed)",
            ENV_COMPACTION_CANARY_PERCENT,
            raw,
        )
        return 0.0
    return max(0.0, min(100.0, value))


def is_canary_selected(key: str, percent: float) -> bool:
    """该 key 是否命中灰度:bucket(key) < percent * 100(万分位)。

    边界:percent ≤ 0 → 恒 False;percent ≥ 100 → 恒 True;
    同一 key + 同一 percent 结果稳定(纯哈希决定,无随机源)。
    """
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    return canary_bucket(key) < percent * (_CANARY_GRANULARITY / 100.0)


def _legacy_enabled() -> bool:
    """legacy:env AGENT_COMPACTION_ENABLED(默认 off,与 agent_loop_v2 现状一致)。"""
    return os.environ.get("AGENT_COMPACTION_ENABLED", "false").strip().lower() in (
        "on",
        "1",
        "true",
        "yes",
    )


def _legacy_llm_enabled() -> bool:
    """legacy:env AGENT_COMPACTION_LLM_ENABLED(默认 off)。"""
    return os.environ.get("AGENT_COMPACTION_LLM_ENABLED", "false").strip().lower() in (
        "on",
        "1",
        "true",
        "yes",
    )


def _legacy_decision() -> CompactionDecision:
    return CompactionDecision(
        mode="legacy",
        enabled=_legacy_enabled(),
        llm_enabled=_legacy_llm_enabled(),
        canary_selected=True,
    )


def resolve_compaction_decision(session_id: str | None) -> CompactionDecision:
    """解析指定会话生效的压缩决策(纯函数,运行时读 env)。

    决策顺序:
    1. AGENT_COMPACTION_MODE 未设置 → legacy(旧 env 行为,默认行为不变);
    2. MODE 非法值 → 告警并回退 legacy(fail-safe);
    3. MODE 合法 → 按灰度比例哈希决定:命中 → MODE 生效;未命中 → legacy。
       (percent 默认 100,即只设 MODE 不设比例 = 全量生效)
    """
    raw_mode = os.environ.get(ENV_COMPACTION_MODE, "").strip().lower()
    if not raw_mode:
        return _legacy_decision()
    if raw_mode not in VALID_COMPACTION_MODES:
        logger.warning(
            "AGENT_COMPACTION_MODE=%r 非法(合法值 %s),回退 legacy 行为",
            raw_mode,
            "/".join(VALID_COMPACTION_MODES),
        )
        return _legacy_decision()

    percent = parse_canary_percent(os.environ.get(ENV_COMPACTION_CANARY_PERCENT))
    key = session_id or ""
    if not is_canary_selected(key, percent):
        # 未命中灰度:回退 legacy 行为(典型 = 压缩关闭,与放量前一致)
        decision = _legacy_decision()
        return CompactionDecision(
            mode=decision.mode,
            enabled=decision.enabled,
            llm_enabled=decision.llm_enabled,
            canary_selected=False,
        )

    if raw_mode == "off":
        return CompactionDecision(mode="off", enabled=False, llm_enabled=False, canary_selected=True)
    if raw_mode == "ratio":
        return CompactionDecision(mode="ratio", enabled=True, llm_enabled=False, canary_selected=True)
    # full:LLM 语义压缩(compact_with_llm),失败自动降级确定性
    return CompactionDecision(mode="full", enabled=True, llm_enabled=True, canary_selected=True)


__all__ = [
    "ENV_COMPACTION_CANARY_PERCENT",
    "ENV_COMPACTION_MODE",
    "VALID_COMPACTION_MODES",
    "CompactionDecision",
    "canary_bucket",
    "is_canary_selected",
    "parse_canary_percent",
    "resolve_compaction_decision",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
