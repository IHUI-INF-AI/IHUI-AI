# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""multi-agent 配置校验 + spawn 准入门 —— 对标 Codex 26.1111 multi_agent_v2。

取证来源（2026-11-16，下潜 codex.exe 364.8MB 主引擎，strings 定向抽取）。
对照物 `MultiAgentV2ConfigToml`（min/max/default_wait_timeout_ms /
max_concurrent_threads_per_session）+ `tools::handlers::multi_agents*` 的 spawn/resume
准入门（逐字文案见下方常量）。

管：① 配置加载期的三段约束校验（default 必须落在 [min, max] 内、并发上限 ≥1）；
② spawn/resume 的准入门（深度超限 / agent id 非法 / 复用已关闭 agent）。纯函数判据层。

不管：真实子代理的派发执行、并发 Semaphore（mcp_server.py 已做运行时限制：depth ≤2 /
并发 ≤5）、级联中断（subagent_cascade.py 已做）、wait 阻塞等待本身。

本仓分工（互补不重叠）：mcp_server 的 depth/并发是**运行时**限制（Semaphore + contextvar）；
本模块是**配置校验 + 准入判据**——填空白。Codex 把「配置自相矛盾」（default 落在区间外）
与「运行时准入」（深度超限）分成两层，本仓此前只有运行时层。

一轴超越：对照把三条配置约束散在 config 加载的各处 panic 分支（逐字但无统一判据）。本仓
表驱动化成单一 `validate_multi_agent_config`，一次返回**全部**违规项（对照逐条 fail-fast），
每条带逐字 codex 错误锚 —— 可 diff、可单测、可在配置装载前拦下自相矛盾的区间。
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "MultiAgentConfig",
    "ConfigViolation",
    "SpawnAdmission",
    "CODEX_ERR_DEFAULT_BELOW_MIN",
    "CODEX_ERR_DEFAULT_ABOVE_MAX",
    "CODEX_ERR_CONCURRENCY_AT_LEAST_ONE",
    "CODEX_ERR_DEPTH_LIMIT",
    "CODEX_ERR_INVALID_AGENT_ID",
    "CODEX_ERR_AGENT_ALREADY_CLOSED",
    "validate_multi_agent_config",
    "admit_spawn",
]

# 逐字错误锚（测试按常量断言，不手抄）
CODEX_ERR_DEFAULT_BELOW_MIN = (
    "features.multi_agent_v2.default_wait_timeout_ms must be at least "
    "features.multi_agent_v2.min_wait_timeout_ms"
)
CODEX_ERR_DEFAULT_ABOVE_MAX = (
    "features.multi_agent_v2.default_wait_timeout_ms must be at most "
    "features.multi_agent_v2.max_wait_timeout_ms"
)
CODEX_ERR_CONCURRENCY_AT_LEAST_ONE = (
    "features.multi_agent_v2.max_concurrent_threads_per_session must be at least 1"
)
CODEX_ERR_DEPTH_LIMIT = "Agent depth limit reached. Solve the task yourself."
CODEX_ERR_INVALID_AGENT_ID = "invalid agent id"
CODEX_ERR_AGENT_ALREADY_CLOSED = "resume reopen closed agent"


@dataclass(frozen=True)
class MultiAgentConfig:
    """multi-agent 配置（对标 MultiAgentV2ConfigToml 的四字段，毫秒单位）。"""

    min_wait_timeout_ms: int
    max_wait_timeout_ms: int
    default_wait_timeout_ms: int
    max_concurrent_threads_per_session: int


@dataclass(frozen=True)
class ConfigViolation:
    """配置校验违规项：逐字 codex 错误锚 + 字段名。合规时 codex_error=None。"""

    field: str
    codex_error: str | None = None


@dataclass(frozen=True)
class SpawnAdmission:
    """spawn/resume 准入判定：准入 + 逐字拒因（拒绝时 codex_error 非空）。"""

    allowed: bool
    codex_error: str | None = None


def validate_multi_agent_config(cfg: MultiAgentConfig) -> tuple[ConfigViolation, ...]:
    """校验 multi-agent 配置三段约束，返回**全部**违规项（非 fail-fast）。

    判据：
    - default_wait_timeout_ms 必须落在 [min_wait_timeout_ms, max_wait_timeout_ms]；
    - max_concurrent_threads_per_session 必须 ≥ 1。

    超越轴：对照逐条 panic（遇第一条即停），本仓一次报全部违规，便于配置审计一次修完。
    """
    violations: list[ConfigViolation] = []
    if cfg.default_wait_timeout_ms < cfg.min_wait_timeout_ms:
        violations.append(
            ConfigViolation(field="default_wait_timeout_ms", codex_error=CODEX_ERR_DEFAULT_BELOW_MIN)
        )
    if cfg.default_wait_timeout_ms > cfg.max_wait_timeout_ms:
        violations.append(
            ConfigViolation(field="default_wait_timeout_ms", codex_error=CODEX_ERR_DEFAULT_ABOVE_MAX)
        )
    if cfg.max_concurrent_threads_per_session < 1:
        violations.append(
            ConfigViolation(
                field="max_concurrent_threads_per_session",
                codex_error=CODEX_ERR_CONCURRENCY_AT_LEAST_ONE,
            )
        )
    return tuple(violations)


def admit_spawn(
    *,
    current_depth: int,
    max_depth: int,
    agent_id: str | None,
    agent_closed: bool,
) -> SpawnAdmission:
    """spawn/resume 准入门判据（优先级从上到下）：

    1. 深度已达上限 ⇒ 拒绝（DEPTH_LIMIT，逐字「Solve the task yourself.」）。
    2. agent id 缺失或空白 ⇒ 拒绝（INVALID_AGENT_ID）。
    3. 目标 agent 已关闭（resume 复用）⇒ 拒绝（AGENT_ALREADY_CLOSED）。
    4. 其余 ⇒ 准入。
    """
    if current_depth >= max_depth:
        return SpawnAdmission(allowed=False, codex_error=CODEX_ERR_DEPTH_LIMIT)
    if not agent_id or not agent_id.strip():
        return SpawnAdmission(allowed=False, codex_error=CODEX_ERR_INVALID_AGENT_ID)
    if agent_closed:
        return SpawnAdmission(allowed=False, codex_error=CODEX_ERR_AGENT_ALREADY_CLOSED)
    return SpawnAdmission(allowed=True)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
