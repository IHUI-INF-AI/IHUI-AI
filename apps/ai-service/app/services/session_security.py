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

    def __init__(self, redis: object | None = None, *, memory: "dict | None" = None) -> None:
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

    def _load(self, session_id: str) -> "dict | None":
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
