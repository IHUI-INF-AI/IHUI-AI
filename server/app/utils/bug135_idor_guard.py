"""Bug-135: 越权读取 (IDOR 防护).
设计:
  - 资源 ownership 校验: 谁能访问什么
  - 角色 (role) + 资源范围 (scope) 矩阵
  - 黑/白名单 owner_id
  - 租户级隔离
  - 显式拒绝优先, 默认 deny
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class AccessDecision(StrEnum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class ResourceScope(StrEnum):
    PRIVATE = "PRIVATE"  # 仅 owner
    INTERNAL = "INTERNAL"  # 租户内任意
    ROLE = "ROLE"  # 同角色
    PUBLIC = "PUBLIC"  # 公开
    SHARED = "SHARED"  # 显式共享名单


@dataclass
class Resource:
    resource_id: str
    resource_type: str
    owner_id: str
    tenant_id: str = ""
    scope: ResourceScope = ResourceScope.PRIVATE
    allowed_users: set[str] = field(default_factory=set)
    allowed_roles: set[str] = field(default_factory=set)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Principal:
    user_id: str
    tenant_id: str = ""
    roles: set[str] = field(default_factory=set)
    is_admin: bool = False
    is_super: bool = False


@dataclass
class AccessRequest:
    principal: Principal
    action: str  # read / write / delete / share
    resource_type: str
    resource_id: str


@dataclass
class AccessLog:
    request: AccessRequest
    decision: AccessDecision
    reason: str = ""
    ts: float = 0.0


class IDORGuard:
    """越权读取防护器 (Insecure Direct Object Reference)."""

    def __init__(self, deny_by_default: bool = True) -> None:
        self.deny_by_default = deny_by_default
        self._lock = threading.RLock()
        self._resources: dict[tuple[str, str], Resource] = {}
        self._logs: list[AccessLog] = []
        self._stats = {"allow": 0, "deny": 0, "registered": 0}

    def register_resource(self, resource: Resource) -> None:
        with self._lock:
            self._resources[(resource.resource_type, resource.resource_id)] = resource
            self._stats["registered"] += 1

    def remove_resource(self, resource_type: str, resource_id: str) -> bool:
        with self._lock:
            return self._resources.pop((resource_type, resource_id), None) is not None

    def get_resource(self, resource_type: str, resource_id: str) -> Resource | None:
        with self._lock:
            return self._resources.get((resource_type, resource_id))

    def _check(self, req: AccessRequest) -> tuple[AccessDecision, str]:
        p = req.principal
        if p.is_super:
            return AccessDecision.ALLOW, "超级管理员"
        res = self._resources.get((req.resource_type, req.resource_id))
        if res is None:
            return (
                (AccessDecision.DENY, "资源不存在")
                if self.deny_by_default
                else (AccessDecision.ALLOW, "无注册且非默认拒绝")
            )
        if p.tenant_id and res.tenant_id and p.tenant_id != res.tenant_id:
            return AccessDecision.DENY, "跨租户访问"
        if p.is_admin and p.tenant_id == res.tenant_id:
            return AccessDecision.ALLOW, "租户管理员"
        if res.scope == ResourceScope.PUBLIC:
            return AccessDecision.ALLOW, "公开资源"
        if res.scope == ResourceScope.PRIVATE:
            if res.owner_id == p.user_id:
                return AccessDecision.ALLOW, "资源所有者"
            return AccessDecision.DENY, "私有资源"
        if res.scope == ResourceScope.INTERNAL:
            if p.tenant_id == res.tenant_id:
                return AccessDecision.ALLOW, "租户内成员"
            return AccessDecision.DENY, "租户不匹配"
        if res.scope == ResourceScope.ROLE:
            if p.roles & res.allowed_roles:
                return AccessDecision.ALLOW, "角色命中"
            return AccessDecision.DENY, "角色不匹配"
        if res.scope == ResourceScope.SHARED:
            if res.owner_id == p.user_id or p.user_id in res.allowed_users:
                return AccessDecision.ALLOW, "共享名单命中"
            return AccessDecision.DENY, "共享名单未命中"
        return AccessDecision.DENY, "未匹配规则"

    def check(self, req: AccessRequest) -> tuple[AccessDecision, str]:
        decision, reason = self._check(req)
        with self._lock:
            self._stats["allow" if decision == AccessDecision.ALLOW else "deny"] += 1
            self._logs.append(AccessLog(request=req, decision=decision, reason=reason, ts=__import__("time").time()))
            if len(self._logs) > 5000:
                self._logs = self._logs[-5000:]
        return decision, reason

    def check_or_raise(self, req: AccessRequest) -> None:
        decision, reason = self.check(req)
        if decision == AccessDecision.DENY:
            raise PermissionError(f"IDOR 拒绝: {reason}")

    def batch_check(self, reqs: list[AccessRequest]) -> list[tuple[AccessDecision, str]]:
        return [self.check(r) for r in reqs]

    def logs(self, limit: int = 100) -> list[AccessLog]:
        with self._lock:
            return list(self._logs[-limit:])

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "resources": len(self._resources)}
