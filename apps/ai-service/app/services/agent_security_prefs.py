# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 安全防护五开关的**按用户生效**唯一取数出口(2026-10-21 立)。

## 为什么要有这一层

`security_config.py` 的那份快照是**进程级单份**(env 默认 + PUT /agent/security-config
的进程内更新),对全站所有人同值。机主拍板"这五个开关按用户生效"后,写面由 apps/api
落在 `user_preferences(group='security', key='agentSecurity.*')`,本模块是**读面 + 生效面**:
把「进程默认 ⊕ 该用户显式覆盖」合成一份 `SecurityConfig`,交给三个消费点
(`agent_loop_v2._pre_guard_check` / `agent_loop_v2._resolve_exec_policy_approval` /
`mcp_server._tool_run_command`)。

## 口径(逐条都是"缺行 = 现状一字不变")

- **基准恒为进程快照**:每次解析都实时 `get_security_config()` 起算,所以设置页对进程档的
  热更仍然立即生效;本模块只在其上叠加**该用户显式设置过**的字段。
- **未显式设置的字段一律不覆盖**(`AgentSecurityPrefs` 里 None = 「没表态」而不是「表了否」)。
  库里没有行 / 值不可解析 / 主体不是 UUID ⇒ 一律回落进程快照 = 改动前的行为。
- **读库失败的方向 = 进程快照,绝不放松**(`_FETCH_FAILED_FALLBACK` 注释)。理由:进程快照
  是本次改造前**唯一**存在过的配置,它的四个安全字段默认全 ON;把一次 DB 抖动读成"该用户
  关过防护"等于让故障面去放宽安全档,方向必须是反过来 —— 宁可多拦一分,不多放一寸
  (AGENTS §0.10「失效方向必须是多要一次说明,绝不能是多放一次跳门」同一条)。

## 主体从哪来(不允许从请求体/头里读,也不允许从被操作记录反推)

`_PRINCIPAL` 这个 ContextVar 只有一个语义:**承载层已验证的身份**。写入点两处 ——
`mcp_server.call_tool`(它的 `user_id` 形参由 `routers/mcp.py` 从 `request.state.user_id`
即 JWT 中间件注入)与 `agent_loop_v2._execute_single`(它的 `self._user_id` 由
`routers/agents.py` / `routers/engine.py::_bind_principal` 注入)。工具入参里那个
`__user_id` 是 `call_tool` 覆盖写进去的,本模块**不读它**,免得把"模型可填的字段"当身份。
空主体**不覆盖**已有主体(见 `set_security_principal`):把一次已证明的身份降回"无主体"
不带来任何收紧,只会让用户自己的开关静默失效,而静默失效是本仓最贵的缺陷型。

## 哪些档受用户开关影响、哪些恒不受影响(边界,判据由用例钉死)

受用户开关影响的(本模块解析后进消费点):
- `prompt_guard_enabled` —— stage1 提示注入探测总开关;
- `prompt_guard_policy` —— flag|sanitize|refuse 三档处置;
- `input_scan_enabled` —— **只**关启发式两类(`ssrf_loopback` / `arg_too_long`);
- `exec_policy_mode` —— enforce|audit|off 三档命令执行策略;
- `pipeline_record_enabled` —— 步骤录制(见下"录制"一段)。

**恒不受用户开关影响**的(任何档位都不放松,`tests/test_agent_security_prefs_per_user.py`
逐条断言"副作用没发生"):
1. `mcp_server` 的破坏性命令硬门(`DANGEROUS_COMMAND_BLOCKED`,默认 ON,只由 env 关):
   `rm -rf /`、`mkfs`、`dd of=/dev/…` 那一批,在 `exec_policy_mode=off` +
   `input_scan_enabled=false` + `prompt_guard_enabled=false` 三档同时关死时仍拒绝执行;
2. `path_traversal` / `command_injection` 两类硬拦截(`HARD_SCAN_FLAGS`):`input_scan_enabled`
   关到 false 也照扫照拦;
3. exec_policy 的 DENY 红线:`audit` 只降级 PROMPT 不降级 DENY,`off` 才整体跳过评估
   (跳过的是"策略引擎评估",不是硬门,与 `security_config` 头注既有语义一致);
4. 高危工具审批门的全局 kill switch `TOOL_APPROVAL_ENABLED`:优先级高于用户档 ——
   它关掉时,用户把 `exec_policy_mode` 设成 enforce 也**不会**多出一次弹窗;
5. 单次入参长度阈值等硬编码常量(`DEFAULT_MAX_ARG_LEN`)不在用户面上,本模块不开档位。

## 录制(`pipeline_record_enabled`)

生产三个构造点都没有传 `recorder=`,所以改动前 `self._step_recorder` 恒 None、
`data/step_records.json` 一次都不写。要让这一项"真通"而又不把默认档掀翻,规则只有一条:
**只有用户显式设置过 `agentSecurity.pipeline_record_enabled='1'` 才自动接入录制器**。
进程档的 `pipeline_record_enabled`(env 默认就是 True)不作为自动接入条件 —— 否则这次改造
会让所有人的每一次 agent 运行开始写盘,那是没被要求过的行为变化。显式注入 recorder 的
调用方(测试/将来的云端 run)不受影响,仍按生效档开合。

## 缓存

按 user_id 的进程内 TTL 缓存,形态照抄 `app/core/llm_gateway.py` 的
`_provider_ownership_cache`(整表满即清、不做 LRU、未命中也写"空表态")。TTL 默认 30s
(env `AGENT_SECURITY_PREFS_TTL_SECONDS`,夹到 0..300;0 = 每轮直读):设置页写的是 apps/api,
ai-service 拿不到失效通知,只能靠 TTL 收敛,这个上界必须在回报与注释里写死,不许含糊。
"""

from __future__ import annotations

import contextlib
import contextvars
import logging
import os
import time
import uuid as _uuid
from collections.abc import Iterator
from dataclasses import dataclass, replace
from typing import Any

from .security_config import (
    GUARD_POLICIES,
    POLICY_MODES,
    SecurityConfig,
    get_security_config,
)

logger = logging.getLogger(__name__)

# —— 存储面:与 apps/api/src/routes/user/security-config-routes.ts 的写面逐字同形 ——
USER_PREFERENCE_GROUP = "security"
PREF_KEY_PREFIX = "agentSecurity."

PROMPT_GUARD_ENABLED_KEY = "prompt_guard_enabled"
PROMPT_GUARD_POLICY_KEY = "prompt_guard_policy"
EXEC_POLICY_MODE_KEY = "exec_policy_mode"
INPUT_SCAN_ENABLED_KEY = "input_scan_enabled"
PIPELINE_RECORD_ENABLED_KEY = "pipeline_record_enabled"

#: 本模块认识的五个键(不带前缀的裸名)。查询按这份**显式清单**做 `= ANY(...)`,
#: 不写 LIKE 前缀匹配:前缀一漂就是"读得到却永远读不到",而显式清单同时是解析面的定义域。
PREF_KEYS: tuple[str, ...] = (
    PROMPT_GUARD_ENABLED_KEY,
    PROMPT_GUARD_POLICY_KEY,
    EXEC_POLICY_MODE_KEY,
    INPUT_SCAN_ENABLED_KEY,
    PIPELINE_RECORD_ENABLED_KEY,
)

#: 送进 SQL 的完整键(含前缀),顺序与 `PREF_KEYS` 一致。
PREF_FULL_KEYS: tuple[str, ...] = tuple(PREF_KEY_PREFIX + k for k in PREF_KEYS)

_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_FALSE_VALUES = frozenset({"0", "false", "no", "off"})

_DEFAULT_PREFS_TTL_SECONDS = 30.0
_MAX_PREFS_TTL_SECONDS = 300.0
_PREFS_CACHE_MAX = 512  # 键是 UUID,给上限防爆;整表清,不做 LRU(同 llm_gateway 归属缓存)

_FETCH_FAILED_FALLBACK = "进程快照(= 改动前的行为),不放松"


@dataclass(frozen=True)
class AgentSecurityPrefs:
    """该用户的**显式表态**。None = 没有表态(缺行/坏值),一律不参与覆盖。"""

    prompt_guard_enabled: bool | None = None
    prompt_guard_policy: str | None = None
    exec_policy_mode: str | None = None
    input_scan_enabled: bool | None = None
    pipeline_record_enabled: bool | None = None

    def explicit_fields(self) -> tuple[str, ...]:
        """被该用户显式设置过的字段名(按 `PREF_KEYS` 稳定顺序)。"""
        return tuple(k for k in PREF_KEYS if getattr(self, k) is not None)

    def is_empty(self) -> bool:
        return not self.explicit_fields()

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {k: getattr(self, k) for k in PREF_KEYS}
        out["explicit"] = list(self.explicit_fields())
        return out


EMPTY_PREFS = AgentSecurityPrefs()


# =============================================================================
# 纯解析层(无 IO,mypy/用例可独立打)
# =============================================================================


def parse_bool(raw: str | None) -> bool | None:
    """'1'/'0'(apps/api 写面口径)→ bool;其余一律 None = 未表态。

    刻意不"非 0 即真":那样会把写面某天漏进来的 'yes'(未表态形态)读成 ON,
    读面宁可少认一个值,也不要替用户改档。
    """
    if raw is None:
        return None
    v = raw.strip().lower()
    if v in _TRUE_VALUES:
        return True
    if v in _FALSE_VALUES:
        return False
    return None


def parse_enum(raw: str | None, allowed: frozenset[str]) -> str | None:
    """枚举取值;不在 allowed 内 ⇒ None(未表态),绝不"就近取第一个合法值"。"""
    if raw is None:
        return None
    v = raw.strip().lower()
    return v if v in allowed else None


def prefs_from_rows(rows: Any) -> AgentSecurityPrefs:
    """asyncpg 行序列 → `AgentSecurityPrefs`(只认 `PREF_FULL_KEYS` 里登记的键)。

    未知键忽略(那是别的面的数据,不属于本出口);同一键多行按"取第一条"处理 ——
    唯一约束 `user_preferences_user_group_key_unique` 保证不会真的出现多行,这里不
    为它写分支,只保证不崩。
    """
    by_key: dict[str, str | None] = {}
    for row in rows:
        try:
            key = str(row["key"])
            value = row["value"]
        except (KeyError, IndexError, TypeError):
            continue
        if key not in PREF_FULL_KEYS or value is None or key in by_key:
            continue
        by_key[key] = str(value)

    def bare(full: str) -> str | None:
        return by_key.get(full)

    return AgentSecurityPrefs(
        prompt_guard_enabled=parse_bool(bare(PREF_KEY_PREFIX + PROMPT_GUARD_ENABLED_KEY)),
        prompt_guard_policy=parse_enum(
            bare(PREF_KEY_PREFIX + PROMPT_GUARD_POLICY_KEY), GUARD_POLICIES
        ),
        exec_policy_mode=parse_enum(
            bare(PREF_KEY_PREFIX + EXEC_POLICY_MODE_KEY), POLICY_MODES
        ),
        input_scan_enabled=parse_bool(bare(PREF_KEY_PREFIX + INPUT_SCAN_ENABLED_KEY)),
        pipeline_record_enabled=parse_bool(bare(PREF_KEY_PREFIX + PIPELINE_RECORD_ENABLED_KEY)),
    )


def apply_prefs(base: SecurityConfig, prefs: AgentSecurityPrefs) -> SecurityConfig:
    """进程默认 ⊕ 用户显式覆盖(纯函数)。

    非法枚举在 `prefs_from_rows` 已被折成 None,这里再兜一道:`base` 自身若被别的
    途径写成非法值,不替它"修正",原样返回(修正是 `set_security_config` 的职责)。
    """
    updates: dict[str, Any] = {}
    for key in PREF_KEYS:
        value = getattr(prefs, key)
        if value is not None:
            updates[key] = value
    if not updates:
        return base
    return replace(base, **updates)


# =============================================================================
# 进程内 TTL 缓存
# =============================================================================


def prefs_ttl_seconds() -> float:
    """缓存 TTL 秒(env `AGENT_SECURITY_PREFS_TTL_SECONDS`,默认 30,夹到 0..300)。

    解析不出来(env 写了垃圾)⇒ 用默认值并留一行 warning:静默退回 0 会让每轮都打 DB,
    静默退回一个大数会让"用户改了开关没反应"变成查不出来的事。
    """
    raw = os.environ.get("AGENT_SECURITY_PREFS_TTL_SECONDS")
    if raw is None or not raw.strip():
        return _DEFAULT_PREFS_TTL_SECONDS
    try:
        value = float(raw.strip())
    except ValueError:
        logger.warning(
            "AGENT_SECURITY_PREFS_TTL_SECONDS 解析失败(%r),按默认 %ss",
            raw,
            _DEFAULT_PREFS_TTL_SECONDS,
        )
        return _DEFAULT_PREFS_TTL_SECONDS
    if value < 0:
        return 0.0
    return min(value, _MAX_PREFS_TTL_SECONDS)


# user_id(小写 UUID 文本)→ (prefs, 过期时刻 monotonic)
_prefs_cache: dict[str, tuple[AgentSecurityPrefs, float]] = {}


def clear_agent_security_prefs_cache() -> None:
    """清空进程内缓存(测试收尾 / 运维要求"立刻按库里的值重读")。"""
    _prefs_cache.clear()


def snapshot_agent_security_prefs_cache() -> dict[str, Any]:
    """缓存快照(只读,便于诊断"这个人的开关到底读到的是哪一份")。"""
    now = time.monotonic()
    return {k: {"prefs": v[0].to_dict(), "fresh": v[1] > now} for k, v in _prefs_cache.items()}


def prime_agent_security_prefs_cache(user_id: str, prefs: AgentSecurityPrefs) -> None:
    """把一份表态写进缓存(测试/注入入口;生产不写库外的表态)。

    TTL 与真实读取同一把尺子(`prefs_ttl_seconds()`),免得测试注入的东西永远不过期、
    把"缓存会过期"这一维测成假绿。
    """
    key = _cache_key(user_id)
    if not key:
        return
    if len(_prefs_cache) >= _PREFS_CACHE_MAX:
        _prefs_cache.clear()
    _prefs_cache[key] = (prefs, time.monotonic() + prefs_ttl_seconds())


def _cache_key(user_id: Any) -> str:
    """缓存键 = 规范化后的小写 UUID 文本;非 UUID ⇒ 空串(不进缓存、不打库)。"""
    uid = _normalize_principal(user_id)
    return uid or ""


def _normalize_principal(user_id: Any) -> str | None:
    """主体规范化:必须是 UUID 文本,否则 None。

    为什么按 UUID 卡死:`user_preferences.user_id` 列型就是 uuid,非 UUID 的主体
    (`DEV_ANONYMOUS_PRINCIPAL = "dev-anonymous"`、`Depends(...)` 哨兵、空串、None)
    在库里**结构上不可能有行**。为它们打一次库不是"更严谨",而是把测试与开发通道
    变成生产 PostgreSQL(8810)的真实连接 —— AGENTS §5 测试隔离铁律禁止的那种。
    回落方向仍然安全:None ⇒ 无覆盖 ⇒ 进程快照 = 改动前的行为。
    """
    if user_id is None:
        return None
    if isinstance(user_id, bool):
        return None
    raw = str(user_id).strip()
    if not raw:
        return None
    try:
        return str(_uuid.UUID(raw)).lower()
    except (ValueError, AttributeError, TypeError):
        return None


# =============================================================================
# 读取出口
# =============================================================================


async def _fetch_prefs_rows(user_id: str) -> list[Any]:
    """一次查回该用户在 group='security' 下的五个键(列名现读自 schema,不 `SELECT *`)。

    连接池取 `memory_service._get_pool`(与 `auto_memory_optout.py:155-183` 同一份共享池,
    不新建池);延迟导入避免模块级成环 —— 同款手法见 auto_memory_optout 的原注释。
    """
    from .memory_service import _get_pool  # 延迟导入:避免与 memory_service 成环

    pool = await _get_pool()
    async with pool.acquire() as conn:
        return list(
            await conn.fetch(
                """SELECT key, value FROM user_preferences
                   WHERE user_id = $1::uuid AND "group" = $2 AND key = ANY($3::text[])""",
                user_id,
                USER_PREFERENCE_GROUP,
                list(PREF_FULL_KEYS),
            )
        )


async def get_agent_security_prefs(user_id: Any) -> AgentSecurityPrefs:
    """该用户的显式表态(带 TTL 缓存)。

    三态不并桶:
    - 主体不可用(非 UUID/空)⇒ `EMPTY_PREFS`,**不打库**,也不写缓存(不占用缓存名额);
    - 库里没有行 ⇒ `EMPTY_PREFS`(负结果进缓存,免得每轮打一次库);
    - 读库异常 ⇒ `EMPTY_PREFS` + warning,回落方向 = `_FETCH_FAILED_FALLBACK`。
      为什么这个方向更安全:进程快照里四个安全字段全是 ON(改动前唯一存在过的配置),
      把一次故障读成"该用户关过防护"等于让 DB 抖动去放宽安全档;反过来读成"没表态"
      最多让用户刚设的开关晚一个 TTL 生效,不会多放一寸。
    """
    uid = _normalize_principal(user_id)
    if not uid:
        return EMPTY_PREFS

    cached = _prefs_cache.get(uid)
    if cached is not None and cached[1] > time.monotonic():
        return cached[0]

    try:
        rows = await _fetch_prefs_rows(uid)
    except Exception as exc:  # noqa: BLE001 - 降级方向见本函数 docstring
        logger.warning(
            "[agent-security-prefs] 读取用户表态失败(user=%s),回落 %s: %s",
            uid,
            _FETCH_FAILED_FALLBACK,
            exc,
        )
        prefs = EMPTY_PREFS
    else:
        prefs = prefs_from_rows(rows)

    if len(_prefs_cache) >= _PREFS_CACHE_MAX:
        _prefs_cache.clear()
    _prefs_cache[uid] = (prefs, time.monotonic() + prefs_ttl_seconds())
    return prefs


async def resolve_security_config(user_id: Any) -> SecurityConfig:
    """**唯一**的"按用户生效"入口:进程默认 ⊕ 该用户覆盖。

    现有全局入口 `get_security_config()` 保持不动(其它调用方/进程级管理面仍读它)。
    """
    return apply_prefs(get_security_config(), await get_agent_security_prefs(user_id))


def user_explicit_pipeline_record(prefs: AgentSecurityPrefs) -> bool:
    """是否**由用户显式**把录制打开(只有 '1' 算 True)。

    单独一条判据而不是复用生效档:见模块 docstring「录制」一段 —— 进程默认 True
    不作为自动接入录制器的条件,否则本次改造会顺手给所有人开始写盘。
    """
    return prefs.pipeline_record_enabled is True


# =============================================================================
# 主体通道(承载层 → 工具 handler)
# =============================================================================


_PRINCIPAL: contextvars.ContextVar[str] = contextvars.ContextVar(
    "ihui_agent_security_principal", default=""
)


def current_security_principal() -> str | None:
    """当前协程上下文中已验证的主体;没有则 None(⇒ 进程快照 ⇒ 与改动前逐字一致)。"""
    return _PRINCIPAL.get() or None


def set_security_principal(user_id: Any) -> contextvars.Token[str] | None:
    """把已验证主体写进当前上下文,返回复位 token;没有可写主体时返回 None。

    两条例外都是刻意的:
    - 主体不可用(None/空/非 UUID)⇒ **不覆盖**已有主体、返回 None。空主体不构成任何
      授权增益,把一次已证明的身份降回"无主体"只会让那个用户自己的开关静默失效。
    - 与现值相同 ⇒ 不重复 set(省一次 token,少一处复位漏径)。
    """
    uid = _normalize_principal(user_id)
    if not uid or uid == _PRINCIPAL.get():
        return None
    return _PRINCIPAL.set(uid)


def reset_security_principal(token: contextvars.Token[str] | None) -> None:
    """复位主体(与 `set_security_principal` 配对;传 None 是 no-op)。

    复位失败绝不打断主链路(与 `reset_terminal_stream_context` 的调用侧同款抑制),
    但漏 set/漏配对这件事会被 `security_principal_scope` 的 with 形态规避掉。
    """
    if token is None:
        return
    with contextlib.suppress(Exception):
        _PRINCIPAL.reset(token)


@contextlib.contextmanager
def security_principal_scope(user_id: Any) -> Iterator[None]:
    """`with` 形态的主体作用域(推荐用法,结构上不会漏复位)。"""
    token = set_security_principal(user_id)
    try:
        yield
    finally:
        reset_security_principal(token)


__all__ = [
    "EMPTY_PREFS",
    "AgentSecurityPrefs",
    "PREF_FULL_KEYS",
    "PREF_KEYS",
    "USER_PREFERENCE_GROUP",
    "apply_prefs",
    "clear_agent_security_prefs_cache",
    "current_security_principal",
    "get_agent_security_prefs",
    "parse_bool",
    "parse_enum",
    "prefs_from_rows",
    "prefs_ttl_seconds",
    "prime_agent_security_prefs_cache",
    "reset_security_principal",
    "resolve_security_config",
    "security_principal_scope",
    "set_security_principal",
    "snapshot_agent_security_prefs_cache",
    "user_explicit_pipeline_record",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
