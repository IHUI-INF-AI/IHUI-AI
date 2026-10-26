# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""会话级安全门(P0-2 生产接线,2026-10-26,对标 nanoMuse Sentinel)。

连接纯函数内核(`app.core.session_taint` / `app.core.vault`)与生产运行时:

- ``SessionTaintStore``:会话污点状态的持久后端。生产用 Redis hash
  (key ``session:taint:<session_id>``),无 Redis 时降级内存 dict(便于单测)。
  agent_loop_v2 在工具批准判定处经它取用本会话的 ``SessionTaint``。
- ``SessionVault``:绑定全局 ``VaultStore`` 的会话级 vault 应用入口
  (mask / resolve / redact / filter_env),供工具参数解析、输出脱敏、
  子进程环境过滤调用。

本模块是"内核 → 生产"的薄适配层,不持有任何业务逻辑判定(判定全在
`session_taint` / `vault` 内核),也不接触网络/文件系统(除 Redis 客户端外)。
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

from app.core.session_taint import SessionTaint, TaintSource, requires_egress_approval
from app.core.vault import (
    VaultStore,
    filter_vault_env,
    mask_vault_values,
    redact_vault_values,
    resolve_vault_references,
)

_REDIS_KEY_PREFIX = "session:taint:"


def _decode(value: "str | bytes") -> str:
    return value.decode() if isinstance(value, bytes) else value


class SessionTaintStore:
    """会话污点状态后端(Redis hash + 内存降级)。

    生产构造:``SessionTaintStore(redis=server.redis)``;单测构造:
    ``SessionTaintStore(memory={})``(内存后端,零依赖)。
    """

    def __init__(self, redis: "Any | None" = None, *, memory: "dict[str, Any] | None" = None) -> None:
        self._redis = redis
        self._memory = memory if memory is not None else {}

    # ── 公共 API ──────────────────────────────────────────────────────────
    def get(self, session_id: str) -> SessionTaint:
        """取本会话污点状态(未记录则返回未污点的默认态)。"""
        raw = self._load(session_id)
        if not raw:
            return SessionTaint()
        return SessionTaint(
            tainted=bool(int(raw.get("tainted", "0") or "0")),
            sources=frozenset(raw.get("sources", []) or []),
            egress_allowlist=frozenset(raw.get("allowlist", []) or []),
        )

    def mark(self, session_id: str, source: "str | TaintSource") -> SessionTaint:
        """标记一次污点来源(会话读私密数据/凭据),持久化并返回新风。"""
        src = source.value if isinstance(source, TaintSource) else source
        tainted = self.get(session_id).mark(src)
        self._save(session_id, tainted)
        return tainted

    def set_allowlist(self, session_id: str, allow: "Iterable[str]") -> SessionTaint:
        """设置本会话出网免批白名单,持久化并返回新风。"""
        updated = self.get(session_id).with_allowlist(allow)
        self._save(session_id, updated)
        return updated

    def requires_egress_approval(self, session_id: str, url: str) -> bool:
        """本会话对 url 的出网是否被污点闸门拦下(委托内核判定)。"""
        return requires_egress_approval(self.get(session_id), url)

    # ── 后端读写 ──────────────────────────────────────────────────────────
    def _key(self, session_id: str) -> str:
        return _REDIS_KEY_PREFIX + session_id

    def _load(self, session_id: str) -> "dict[str, Any] | None":
        if self._redis is not None:
            raw = self._redis.hgetall(self._key(session_id))
            if not raw:
                return None
            return {_decode(k): _decode(v) for k, v in raw.items()}
        return self._memory.get(self._key(session_id))

    def _save(self, session_id: str, t: SessionTaint) -> None:
        data = {
            "tainted": "1" if t.tainted else "0",
            "sources": list(t.sources),
            "allowlist": list(t.egress_allowlist),
        }
        if self._redis is not None:
            self._redis.hset(self._key(session_id), mapping=data)
            self._redis.expire(self._key(session_id), 3600)
        else:
            self._memory[self._key(session_id)] = data


class SessionVault:
    """绑定全局 ``VaultStore`` 的会话级 vault 应用入口。

    构造:``SessionVault(store)``,``store`` 由凭据服务注入(测试用内存 VaultStore)。
    """

    def __init__(self, store: VaultStore) -> None:
        self._store = store

    def mask(self, text: str) -> str:
        """把文本里的真值隐去为 ``{{vault:NAME}}``(出库前/回显前)。"""
        return mask_vault_values(text, self._store)

    def resolve(self, text: str) -> str:
        """审批通过后:占位符 → 真值(未知 NAME 保留占位符)。"""
        return resolve_vault_references(text, self._store)

    def redact(self, text: str) -> str:
        """工具输出命中真值 ⇒ ``[REDACTED:NAME]``(入库/落日志前)。"""
        return redact_vault_values(text, self._store)

    def filter_env(self, env: Mapping[str, str]) -> "dict[str, str]":
        """子进程环境:剔除凭据形环境变量(绝不外带真值)。"""
        return filter_vault_env(env, self._store)


# ===========================================================================
# 进程内单例与纯函数助手(P0-2 生产接线,2026-10-26)
# ===========================================================================
import re as _re

from app.core.session_taint import requires_egress_approval as _requires_egress_approval
from app.core.vault import VAULT_PLACEHOLDER_RE as _VAULT_PLACEHOLDER_RE

# 进程内单例(生产替换为 redis 后端 / 凭据服务注入)。同一 uvicorn worker 内
# 跨请求共享,足以支撑"单进程内会话级污点 + 凭据保险库"闭环;多 worker 横向
# 扩展时把 _default_taint_store 换成 SessionTaintStore(redis=...) 即可。
_default_taint_store: SessionTaintStore = SessionTaintStore(memory={})
_default_vault_store: VaultStore = VaultStore()

# run_command 出网判定:命令内首个 http(s) 地址;无具体 URL 的出网工具(如
# open_world MCP 工具)用此哨兵表示"出网但目标未知",污点闸门一律拦。
EGRESS_UNKNOWN = "__egress_unknown__"
_URL_RE = _re.compile(r"https?://[^\s\"'`)]+")


def get_session_taint_store() -> SessionTaintStore:
    """取会话污点状态后端单例(生产接入 redis 见模块 docstring)。"""
    return _default_taint_store


def get_vault_store() -> VaultStore:
    """取凭据保险库单例(凭据服务审批通过后向此注入真值)。"""
    return _default_vault_store


def get_session_vault() -> SessionVault:
    """取会话级 vault 应用入口单例。"""
    return SessionVault(_default_vault_store)


def tool_egress_target(
    tool_name: str,
    args: "dict[str, Any] | None" = None,
    *,
    mcp_annotations: "dict[str, Any] | None" = None,
) -> "str | None":
    """工具出网目标判定(纯函数,可单测)。

    返回:
    - ``None``:非出网工具,不参与污点闸门;
    - :data:`EGRESS_UNKNOWN`:出网但无具体 URL(open_world MCP 工具);
    - 具体 URL 串:run_command 命令内出现的首个 http(s) 地址。

    设计点:run_command 仅当命令**确实含 URL** 才视为出网 —— 避免污点会话
    跑普通 git/python 命令也被迫审批(精确"出网"语义);
    外部 MCP 工具按 open_world 注解判出网(目标未知)。
    """
    args = args or {}
    if tool_name == "run_command":
        cmd = args.get("command", "") or ""
        m = _URL_RE.search(cmd)
        return m.group(0) if m else EGRESS_UNKNOWN
    if mcp_annotations is not None and mcp_annotations.get("open_world_hint") is True:
        return EGRESS_UNKNOWN
    return None


def taint_gate_requires_approval(
    taint: SessionTaint,
    tool_name: str,
    args: "dict[str, Any] | None" = None,
    *,
    mcp_annotations: "dict[str, Any] | None" = None,
    network_axis: bool = False,
) -> bool:
    """污点会话出网抬升需批(纯函数,可单测)。返回是否应抬升为需批。

    判定:
    - 会话未污点 ⇒ False;
    - 工具非出网(无 URL 且非 open_world / 非 network 双轴)⇒ False;
    - 否则 ⇒ True(含目标未知的出网工具:``None``/``EGRESS_UNKNOWN`` 一律拦,
      具体 URL 则交 ``requires_egress_approval`` 走 allowlist 判定)。
    """
    if not taint.tainted:
        return False
    target = tool_egress_target(tool_name, args, mcp_annotations=mcp_annotations)
    if target is None and not network_axis:
        return False
    # 出网但目标未知(无具体 URL / open_world / network 双轴)⇒ 直接拦
    if target is None or target == EGRESS_UNKNOWN:
        return True
    return _requires_egress_approval(taint, target)


def args_contain_resolvable_vault(args: "dict[str, Any] | None") -> "list[str]":
    """工具入参是否含可解析的凭据保险库占位符;返回命中的凭据名列表(空=无)。

    用于会话污点标记:模型把 ``{{vault:NAME}}`` 写进工具入参且保险库确有
    对应真值 ⇒ 本会话被标记 VAULT 污点(后续出网一律需批)。
    """
    if not isinstance(args, dict):
        return []
    import json as _json

    blob = _json.dumps(args, ensure_ascii=False, default=str)
    names = _VAULT_PLACEHOLDER_RE.findall(blob)
    store = _default_vault_store
    return [n for n in names if store.get(n) is not None]
