# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话级 Skill 授权(对齐 Qoder 的 ``allowed-tools`` 语义,自研实现)。

**语义是"授权",不是"限制"**。Qoder 自己的说明原文(从安装目录的
``qoder-worker-runtime.obf.mjs`` 解出的字面量,偏移 25750955):

    "the frontmatter `allowed-tools` (also spelled `allowed_tools`) is a
    permission grant, not a restriction: once the skill is activated, each
    listed tool or pattern is added as a session allow rule, so matching calls
    are allowed by rule instead of reaching this review"

换成 IHUI 的话:技能激活后,名单里的工具在**本会话**免走"高危工具审批"
(``AgentLoopV2._request_approval`` / exec_policy PROMPT),而不是把名单外的
工具拒之门外。把授权误实现成收窄会直接打断正常技能(声明 ``Bash`` 的技能会让
``read_file`` 也用不了),这一点必须按原文对齐。

边界(刻意写死,别在后续"优化"里放松):

* 只跳过**审批**这一层。角色矩阵(普通用户调 admin 工具)、能力门、路径校验、
  沙箱、permission_mode 的 plan 拦截都在审批门**之前**,一律不受本授权影响;
* 授权按 (user_id, session_id) 隔离并 2 小时过期;
* 缺 session_id 时不落授权(宁可不免审批,也不能让 A 会话的授权漏到 B 会话);
* 未声明 allowed-tools 的技能不产生任何授权 ⇒ 接线前后默认行为零差异。

IHUI 现状(可核对):``app/services/skill_md.py`` 已把 frontmatter 的
``allowed-tools`` 原样保留到 ``SkillMd.extra``,但 ``SkillRegistry._load_auto_skills``
只取 name/description/instructions,该字段从未被消费 —— 技能"声明了工具范围"
这件事在运行期是空的。本模块就是它的第一个消费方。
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Sequence

__all__ = [
    "DEFAULT_SKILL_SCOPE_TTL_SECONDS",
    "SkillScope",
    "activate_skill_scope",
    "describe_scope",
    "get_active_skill_scope",
    "normalize_allowed_tools",
    "parse_allowed_tools",
    "release_skill_scope",
    "reset_scopes_for_tests",
    "scope_grants",
]

# 单条授权有效期:2 小时。技能加载属于回合级动作,超过 2 小时的同会话调用
# 视为"另一个上下文窗口",按过期处理(重新加载即可恢复)。
DEFAULT_SKILL_SCOPE_TTL_SECONDS = 2 * 60 * 60

# 进程内最多保留多少个会话的授权(只淘汰最久未激活的条目,防泄漏)。
_MAX_SCOPES = 1024

# ``ToolName`` 或 ``ToolName(specifier)``;specifier 里允许逗号/空格,所以不能
# 先按逗号切分再剔后缀(``Bash(git add, git commit)`` 会被切成两半)。
_ALLOWED_TOOL_TOKEN = re.compile(r"([A-Za-z0-9_:\-.]+)(?:\([^)]*\))?")


@dataclass(frozen=True)
class SkillScope:
    """一条已激活的会话授权。"""

    skill: str
    allowed: tuple[str, ...]
    activated_at: float
    expires_at: float

    def grants(self, tool_name: str) -> bool:
        """工具名是否被本授权覆盖(大小写不敏感;空名单 = 不授权任何工具)。"""
        if not self.allowed:
            return False
        folded = tool_name.strip().casefold()
        return any(item.casefold() == folded for item in self.allowed)


def parse_allowed_tools(raw: str | Sequence[str] | None) -> tuple[str, ...]:
    """解析 SKILL.md 的 ``allowed-tools`` 声明。

    Args:
        raw: frontmatter 原值(常见形态 ``Read, Grep`` 或
            ``Bash(git add, git commit), Read``),也接受已切好的序列。

    Returns:
        去重保序的工具名元组。``(specifier)`` 后缀被剥掉(与 Qoder 一致:
        名单按工具名授权;IHUI 的细化规则由工具自身的参数校验承担)。
        解析不到任何名字时返回空元组(= 不授权)。
    """
    if raw is None:
        return ()
    if isinstance(raw, str):
        tokens = [m.group(1) for m in _ALLOWED_TOOL_TOKEN.finditer(raw)]
    else:
        tokens = []
        for item in raw:
            if not isinstance(item, str):
                continue
            found = [m.group(1) for m in _ALLOWED_TOOL_TOKEN.finditer(item)]
            tokens.extend(found if found else [])
    seen: set[str] = set()
    out: list[str] = []
    for token in tokens:
        folded = token.strip().casefold()
        if not folded or folded in seen:
            continue
        seen.add(folded)
        out.append(token.strip())
    return tuple(out)


def normalize_allowed_tools(
    allowed: tuple[str, ...], normalize: Callable[[str], str] | None = None
) -> tuple[str, ...]:
    """把声明名归一到本仓注册表里的正式名(别名如 ``read`` → ``read_file``)。"""
    if not allowed or normalize is None:
        return allowed
    seen: set[str] = set()
    out: list[str] = []
    for name in allowed:
        mapped = normalize(name) or name
        folded = mapped.strip().casefold()
        if folded in seen:
            continue
        seen.add(folded)
        out.append(mapped.strip())
    return tuple(out)


_SCOPES: dict[tuple[str, str], SkillScope] = {}
_LOCK = threading.Lock()


def _key(user_id: str | None, session_id: str | None) -> tuple[str, str] | None:
    """授权键。会话缺失 ⇒ None(不落授权,宁可"不免审批")。"""
    sid = (session_id or "").strip()
    if not sid:
        return None
    return ((user_id or "").strip(), sid)


def _prune(now: float) -> None:
    """过期清理 + 容量上限(最久未激活者先走)。调用方须已持有锁。"""
    for key in [k for k, v in _SCOPES.items() if v.expires_at <= now]:
        _SCOPES.pop(key, None)
    if len(_SCOPES) > _MAX_SCOPES:
        ordered = sorted(_SCOPES.items(), key=lambda kv: kv[1].activated_at)
        for key, _scope in ordered[: len(_SCOPES) - _MAX_SCOPES]:
            _SCOPES.pop(key, None)


def activate_skill_scope(
    *,
    user_id: str | None,
    session_id: str | None,
    skill: str,
    allowed_tools: Sequence[str],
    ttl_seconds: int = DEFAULT_SKILL_SCOPE_TTL_SECONDS,
    normalize: Callable[[str], str] | None = None,
    now: float | None = None,
) -> SkillScope | None:
    """激活/覆盖当前会话的技能授权。

    Returns:
        生效授权;缺 session_id 时返回 None(调用方应把"未生效"如实回报给模型)。
    """
    key = _key(user_id, session_id)
    if key is None:
        return None
    allowed = normalize_allowed_tools(parse_allowed_tools(list(allowed_tools)), normalize)
    ts = time.monotonic() if now is None else now
    ttl = max(1, int(ttl_seconds))
    scope = SkillScope(
        skill=(skill or "").strip(),
        allowed=allowed,
        activated_at=ts,
        expires_at=ts + ttl,
    )
    with _LOCK:
        _SCOPES[key] = scope
        _prune(ts)
    return scope


def release_skill_scope(*, user_id: str | None, session_id: str | None) -> bool:
    """结束当前会话的技能授权。返回是否真有一条被移除。"""
    key = _key(user_id, session_id)
    if key is None:
        return False
    with _LOCK:
        return _SCOPES.pop(key, None) is not None


def get_active_skill_scope(
    *, user_id: str | None, session_id: str | None, now: float | None = None
) -> SkillScope | None:
    """读当前会话的生效授权(过期即视为无)。"""
    key = _key(user_id, session_id)
    if key is None:
        return None
    ts = time.monotonic() if now is None else now
    with _LOCK:
        scope = _SCOPES.get(key)
        if scope is None:
            return None
        if scope.expires_at <= ts:
            _SCOPES.pop(key, None)
            return None
        return scope


def scope_grants(
    *,
    user_id: str | None,
    session_id: str | None,
    tool_name: str,
    normalize: Callable[[str], str] | None = None,
) -> bool:
    """执行面出口:本会话是否有工具授权(先按原名,再按注册表正式名)。"""
    scope = get_active_skill_scope(user_id=user_id, session_id=session_id)
    if scope is None:
        return False
    if scope.grants(tool_name):
        return True
    if normalize is not None:
        mapped = normalize(tool_name) or tool_name
        if mapped != tool_name and scope.grants(mapped):
            return True
    return False


def describe_scope(scope: SkillScope | None) -> dict[str, Any] | None:
    """把授权折成可回执的形状(供 ``skill`` 工具返回值使用)。"""
    if scope is None:
        return None
    return {
        "skill": scope.skill,
        "allowedTools": list(scope.allowed),
        "granted": bool(scope.allowed),
    }


def reset_scopes_for_tests() -> None:
    """清空进程内授权(仅测试用;生产没有清空需求)。"""
    with _LOCK:
        _SCOPES.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
