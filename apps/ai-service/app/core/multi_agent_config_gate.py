# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""multi-agent 配置校验 + spawn 准入门 —— 遵循统一工程规范。

设计依据（2026-11-16，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
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
from typing import Any

__all__ = [
    "MultiAgentConfig",
    "ConfigViolation",
    "SpawnAdmission",
    "DEFAULT_CONFIG",
    "CODEX_ERR_DEFAULT_BELOW_MIN",
    "CODEX_ERR_DEFAULT_ABOVE_MAX",
    "CODEX_ERR_CONCURRENCY_AT_LEAST_ONE",
    "CODEX_ERR_DEPTH_LIMIT",
    "CODEX_ERR_INVALID_AGENT_ID",
    "CODEX_ERR_AGENT_ALREADY_CLOSED",
    "validate_multi_agent_config",
    "admit_spawn",
    "clamp_wait_timeout_s",
    "resolve_config",
    "DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET",
    "estimate_messages_tokens",
    "clip_messages_to_token_budget",
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
    """multi-agent 配置（对齐 MultiAgentV2ConfigToml 的四字段，毫秒单位）。"""

    min_wait_timeout_ms: int
    max_wait_timeout_ms: int
    default_wait_timeout_ms: int
    max_concurrent_threads_per_session: int


#: 运行时默认配置（毫秒）。接线处零显式配置时用它兜底：
#: default wait 30s，边界 [1s, 60s]，每会话并发上限 5 —— 与测试基线一致。
DEFAULT_CONFIG = MultiAgentConfig(
    min_wait_timeout_ms=1000,
    max_wait_timeout_ms=60000,
    default_wait_timeout_ms=30000,
    max_concurrent_threads_per_session=5,
)

#: settings 字段名（环境变量可覆盖）；缺省时回落 DEFAULT_CONFIG。
_SETTINGS_FIELD = "multi_agent_wait_max_timeout_ms"


def resolve_config() -> MultiAgentConfig:
    """从 settings 解析当前生效的 multi-agent 配置（惰性导入避免 core 循环依赖）。

    settings.multi_agent_wait_max_timeout_ms 只覆盖 max_wait_timeout_ms（运维最常调的一轴，
    控制 wait_agent 最长阻塞）；min/default/并发仍取 DEFAULT_CONFIG。读取失败（字段未定义 /
    settings 未初始化 / 非法值）一律回落 DEFAULT_CONFIG，绝不抛——配置门在运行时热路径上，
    取不到就按缺省放行，不阻塞子代理。
    """
    try:
        from app.core.config import settings  # noqa: PLC0415 - 惰性导入防循环

        max_ms = getattr(settings, _SETTINGS_FIELD, None)
        if isinstance(max_ms, int) and max_ms > 0:
            base = DEFAULT_CONFIG
            default_ms = min(base.default_wait_timeout_ms, max_ms)
            return MultiAgentConfig(
                min_wait_timeout_ms=min(base.min_wait_timeout_ms, max_ms),
                max_wait_timeout_ms=max_ms,
                default_wait_timeout_ms=max(default_ms, min(base.min_wait_timeout_ms, max_ms)),
                max_concurrent_threads_per_session=base.max_concurrent_threads_per_session,
            )
    except Exception:  # noqa: BLE001 - 取不到就回落,配置门不阻塞热路径
        pass
    return DEFAULT_CONFIG


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


def clamp_wait_timeout_s(
    requested_s: float | None,
    cfg: MultiAgentConfig | None = None,
) -> float:
    """把「调用方请求的 wait 超时（秒）」夹紧到配置 max 内 —— 运行时用判据。

    对齐 MultiAgentV2ConfigToml 的 min/max/default_wait_timeout_ms：
    - requested_s 为 None/≤0 ⇒ 用 default_wait_timeout_ms；
    - requested_s > max ⇒ 压到 max（避免 wait 长时间阻塞父级）；
    - 其余正数（含 < min 的极短探测）⇒ 原值返回。

    注意：min_wait_timeout_ms 在 Codex 是**配置自洽校验约束**（default 必须落在
    [min,max] 内），不是运行时强制地板——调用方刻意传极短值（如 0.1s）做探测
    时应尊重原值，强制抬升会让「快速看一眼就走」退化为「等满 min」。
    因此本函数不按 min 抬升，只按 max 压缩。

    入参秒、内部毫秒（×1000 换算），返回秒。cfg 缺省时用 resolve_config()
    （读 settings，回落 DEFAULT_CONFIG），保证接线处零配置也能拿到合理边界，
    且运维改环境变量后无需改代码。
    """
    c = cfg or resolve_config()
    if requested_s is None or requested_s <= 0:
        return c.default_wait_timeout_ms / 1000.0
    ms = requested_s * 1000.0
    if ms > c.max_wait_timeout_ms:
        return c.max_wait_timeout_ms / 1000.0
    return requested_s


#: 子代理 context 默认 token 预算。对齐 Codex subagent_default_context_limits：
#: 子代理不该与父级共享无界 context，默认给一个宽松上限作为安全网。
#: 默认值刻意大于 _run_agent 现有的 20 轮 history，保证零配置时不改变既有行为。
DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET = 32000

#: 粗略 token 估算：英文约 4 字符/token，中文约 1.5 字符/token。
#: 取保守值（按 3 字符/token）避免低估，宁可多裁不撑爆。
_CHARS_PER_TOKEN = 3.0


def estimate_messages_tokens(messages: list[dict[str, Any]]) -> int:
    """粗估一组 messages 的 token 数（保守偏高，避免低估撑爆上下文）。

    每条 message 计 content + 可选 tool_calls 序列化长度，再按 _CHARS_PER_TOKEN 折算。
    纯函数、无副作用；估算不准没关系——它只决定"要不要裁"，不决定"裁到多干净"。
    """
    total_chars = 0
    for m in messages:
        if not isinstance(m, dict):
            continue
        content = m.get("content")
        if isinstance(content, str):
            total_chars += len(content)
        tool_calls = m.get("tool_calls")
        if tool_calls:
            total_chars += len(str(tool_calls))
        # 每条消息的结构开销（role/tool_call_id 等）给固定小额度
        total_chars += 16
    return int(total_chars / _CHARS_PER_TOKEN)


def clip_messages_to_token_budget(
    messages: list[dict[str, Any]],
    budget_tokens: int | None = None,
) -> list[dict[str, Any]]:
    """把子代理 messages 裁剪到 token 预算内（对齐 Codex subagent_default_context_limits）。

    策略（保 system + 末轮 user，从最旧的中段开始丢）：
    1. system 消息（role=system）永远保留 —— 子代理身份/指令不能丢；
    2. 最后一条 user 消息（本次任务输入）永远保留 —— 丢了就答非所问；
    3. 中段历史从最旧往新依次丢弃，直到估算落在预算内；
    4. 若只剩 system + 末轮 user 仍超预算 ⇒ 原样返回（不能再裁，
       交给下游 compact / 模型端兜底，不在纯函数里硬截 system/user）。

    budget_tokens 缺省用 DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET。
    返回**新列表**，不改入参（纯函数）。
    """
    budget = budget_tokens or DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET
    if budget <= 0 or not messages:
        return list(messages)

    if estimate_messages_tokens(messages) <= budget:
        return list(messages)  # 未超预算，原样（新列表）返回

    # 定位 system 消息索引与最后一条 user 消息索引
    system_idx = [i for i, m in enumerate(messages) if isinstance(m, dict) and m.get("role") == "system"]
    system_set = set(system_idx)
    last_user_idx = max(
        (i for i, m in enumerate(messages) if isinstance(m, dict) and m.get("role") == "user"),
        default=-1,
    )

    # 保留集：system + 末轮 user；丢弃候选：中段（最旧优先）
    keep = set(system_set)
    if last_user_idx >= 0:
        keep.add(last_user_idx)
    droppable = [i for i in range(len(messages)) if i not in keep]

    # 从最旧开始逐条丢弃，直到估算落入预算
    dropped: set[int] = set()
    for idx in droppable:  # range 顺序即最旧→最新
        dropped.add(idx)
        candidate = [m for i, m in enumerate(messages) if i in keep or i not in dropped]
        if estimate_messages_tokens(candidate) <= budget:
            return candidate
    # 全部可丢弃项都丢了仍超预算（system+末轮 user 本身超）⇒ 不硬截 system/user，
    # 返回 keep 集合（去掉已无意义的中段），交下游 compact / 模型端兜底
    return [m for i, m in enumerate(messages) if i in keep]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
