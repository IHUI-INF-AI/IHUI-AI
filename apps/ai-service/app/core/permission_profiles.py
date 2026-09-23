# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""权限档案(PermissionProfile)——对标 codex config/src/permissions_toml.rs
+ network-proxy/src/policy.rs normalize_host(2026-09-20 批58十八)。

codex 语义忠实移植:

- ``PermissionsToml`` 是一组具名档案(profile),每个档案可声明
  ``description`` / ``extends`` / ``workspace_roots`` / ``filesystem`` / ``network``;
  ``default_permissions`` 指向生效档案。
- ``resolve_profile(name, parent_lookup)``:沿 ``extends`` 链上溯收集档案,父档案
  先合并、子档案覆盖同名键;解析结果保留**被选档案自己的**声明元数据
  (``description`` / ``extends`` 不属于继承内容,父档案不得填充)。
- 错误面逐字对齐:未定义档案 / 继承未定义父档案 / 继承不受支持的内置档案
  (名字以 ``:`` 开头的内置档案不可被 extends)/ 继承环。
- ``normalize_host``:去空白 → 剥 ``[IPv6]`` 方括号 → 单个 ``:`` 视为端口并剥离 →
  ASCII 小写 → 去尾部点(FQDN 与去点形态等价)→ IP 字面量归一(含 ``%25``/``%`` 作用域)。
- 归一化仅在**父子两侧都声明了 network.domains** 时执行(codex 原注释:否则
  子档案的键原样继承,不做隐式改写)。

范围界定(有据跳过):
- MITM hook/action 与 unix socket 权限的**运行时编译**(codex proxy 子系统专属),
  本模块只保留档案声明面与网络模式/域名/开关的解析语义;
- ``merge_toml_values`` 的 structured-feature-path 与 shell env policy 表示替换属
  codex 配置层特例(依赖其 feature 注册表),不移植。
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

__all__ = [
    "FileSystemAccessMode",
    "NetworkDomainPermission",
    "NetworkMode",
    "PermissionProfile",
    "PermissionProfileResolutionError",
    "PermissionProfileError",
    "UndefinedProfileError",
    "UndefinedParentError",
    "UnsupportedBuiltInParentError",
    "CycleError",
    "NetworkSettings",
    "normalize_host",
    "normalize_profile_network_domains",
    "merge_permission_profiles",
    "resolve_permission_profile",
]


class FileSystemAccessMode(str, Enum):
    """文件系统访问模式(``none`` 为兼容旧输入的别名 → ``deny``)。"""

    READ = "read"
    WRITE = "write"
    DENY = "deny"

    @classmethod
    def parse(cls, value: str) -> "FileSystemAccessMode":
        lowered = str(value).strip().lower()
        if lowered == "none":
            return cls.DENY
        return cls(lowered)

    @property
    def can_read(self) -> bool:
        return self is not FileSystemAccessMode.DENY

    @property
    def can_write(self) -> bool:
        return self is FileSystemAccessMode.WRITE


class NetworkDomainPermission(str, Enum):
    ALLOW = "allow"
    DENY = "deny"


class NetworkMode(str, Enum):
    LIMITED = "limited"
    FULL = "full"


class PermissionProfileError(Exception):
    """档案解析错误基类(对标 PermissionProfileResolutionError)。"""

    code = "permission_profile_error"


class UndefinedProfileError(PermissionProfileError):
    code = "undefined_profile"

    def __init__(self, profile_name: str) -> None:
        self.profile_name = profile_name
        super().__init__(f"default_permissions refers to undefined profile `{profile_name}`")


class UndefinedParentError(PermissionProfileError):
    code = "undefined_parent"

    def __init__(self, profile_name: str, parent_profile_name: str) -> None:
        self.profile_name = profile_name
        self.parent_profile_name = parent_profile_name
        super().__init__(
            f"permissions profile `{profile_name}` extends undefined profile"
            f" `{parent_profile_name}`"
        )


class UnsupportedBuiltInParentError(PermissionProfileError):
    code = "unsupported_builtin_parent"

    def __init__(self, profile_name: str, parent_profile_name: str) -> None:
        self.profile_name = profile_name
        self.parent_profile_name = parent_profile_name
        super().__init__(
            f"permissions profile `{profile_name}` cannot extend unsupported built-in"
            f" profile `{parent_profile_name}`"
        )


class CycleError(PermissionProfileError):
    code = "cycle"

    def __init__(self, cycle: list[str]) -> None:
        self.cycle = list(cycle)
        super().__init__(
            "permissions profile inheritance cycle detected: " + " -> ".join(self.cycle)
        )


# 兼容别名(codex 侧同名枚举,便于跨系统对账)
PermissionProfileResolutionError = PermissionProfileError


def normalize_host(host: str) -> str:
    """把主机名/域名/IP 字面量归一(对标 codex network-proxy normalize_host)。

    - 去首尾空白;
    - ``[IPv6]`` 形态剥方括号后按 IP 字面量归一;
    - 恰好一个 ``:`` 视为 ``host:port`` 并剥离端口;
    - ASCII 小写后去尾部点(FQDN 与去点形态等价);
    - IP 字面量(含 ``%25``/``%`` 作用域后缀)去除作用域后归一。
    """
    raw = str(host).strip()
    if raw.startswith("[") and "]" in raw:
        end = raw.index("]")
        return _normalize_dns_host_or_ip_literal(raw[1:end])
    # 未加括号的 IPv6 含多个冒号,不能按端口剥离(避免损伤字面量)
    if raw.count(":") == 1:
        return _normalize_dns_host_or_ip_literal(raw.split(":", 1)[0])
    return _normalize_dns_host_or_ip_literal(raw)


def _normalize_dns_host_or_ip_literal(host: str) -> str:
    lowered = host.lower()
    lowered = lowered.rstrip(".")
    return _normalize_ip_literal(lowered) or lowered


def _normalize_ip_literal(host: str) -> str | None:
    """IP 字面量归一:纯 IP 原样返回;带作用域(``%25``/``%``)时剥作用域后归一。"""
    if _is_ip_literal(host):
        return host
    for delimiter in ("%25", "%"):
        if delimiter in host:
            candidate, _scope = host.split(delimiter, 1)
            if _is_ip_literal(candidate):
                return candidate
    return None


def _is_ip_literal(value: str) -> bool:
    """IP 字面量判定(对齐 codex/Rust ``IpAddr::parse``:不接受 ``%scope`` 后缀)。

    注意:Python 3.9+ 的 ``ipaddress.ip_address`` **接受** IPv6 作用域 ID
    (如 ``fe80::1%eth0``),而 Rust 的 ``IpAddr`` 不接受——若不加 ``%`` 前置拒绝,
    带作用域的地址会被当作合法 IP 原样返回,跳过 codex 的"剥作用域"分支。
    """
    from ipaddress import ip_address

    if "%" in value:
        return False
    try:
        ip_address(value)
    except ValueError:
        return False
    return True


@dataclass
class NetworkSettings:
    """网络档案声明面(codex NetworkToml 的可移植子集)。"""

    enabled: bool | None = None
    proxy_url: str | None = None
    mode: NetworkMode | None = None
    domains: dict[str, NetworkDomainPermission] = field(default_factory=dict)
    allow_local_binding: bool | None = None
    allow_upstream_proxy: bool | None = None

    def allowed_domains(self) -> list[str] | None:
        """允许域名清单(空 → None,对标 codex allowed_domains)。"""
        allowed = [
            pattern
            for pattern, perm in self.domains.items()
            if perm is NetworkDomainPermission.ALLOW
        ]
        return allowed or None

    def denied_domains(self) -> list[str] | None:
        denied = [
            pattern
            for pattern, perm in self.domains.items()
            if perm is NetworkDomainPermission.DENY
        ]
        return denied or None


@dataclass
class PermissionProfile:
    """单个权限档案(codex PermissionProfileToml 等价)。"""

    description: str | None = None
    extends: str | None = None
    workspace_roots: dict[str, bool] = field(default_factory=dict)
    filesystem: dict[str, Any] = field(default_factory=dict)
    network: NetworkSettings | None = None
    glob_scan_max_depth: int | None = None

    def enabled_roots(self) -> list[str]:
        """已启用的工作区根(只保留 True 项)。

        codex 的 ``WorkspaceRootsToml.entries`` 是 ``BTreeMap``(字典序迭代),
        本实现按字典序返回以保持跨系统输出可比对。
        """
        return sorted(path for path, enabled in self.workspace_roots.items() if enabled)


def normalize_profile_network_domains(profile: PermissionProfile) -> None:
    """就地把档案的 network.domains 键归一(对标 normalize_profile_network_domains)。

    输出按归一后主机名字典序排列(codex ``BTreeMap`` 迭代语义),重复归一结果稳定。
    """
    if profile.network is None or not profile.network.domains:
        return
    # 先全部归一,再按归一键字典序重排(顺序需基于归一后形态,否则 "Z.com" 会
    # 排在 "a.com" 前面——大写 ASCII 小于小写)
    normalized: dict[str, NetworkDomainPermission] = {}
    for pattern, permission in profile.network.domains.items():
        normalized[normalize_host(pattern)] = permission
    profile.network.domains = {
        key: normalized[key] for key in sorted(normalized)
    }


def merge_permission_profiles(
    parent: PermissionProfile, child: PermissionProfile
) -> PermissionProfile:
    """父档案合并进子档案(子键覆盖父键),对标 codex merge_permission_profiles。

    - 父档案的 ``description`` / ``extends`` 不参与继承(声明元数据属于被选档案);
    - 父子两侧都声明 ``network.domains`` 时先各自归一,避免同一主机出现两种写法;
    - ``network`` / ``workspace_roots`` / ``filesystem`` 逐键浅合并(与 TOML 表
      覆盖语义一致),``network`` 中标量字段由子档案覆盖。
    """
    parent.description = None
    parent.extends = None

    merges_network_domains = bool(
        parent.network is not None
        and parent.network.domains
        and child.network is not None
        and child.network.domains
    )
    if merges_network_domains:
        normalize_profile_network_domains(parent)
        normalize_profile_network_domains(child)

    merged = PermissionProfile(
        description=child.description,
        extends=child.extends,
        workspace_roots={**parent.workspace_roots, **child.workspace_roots},
        filesystem={**parent.filesystem, **child.filesystem},
        glob_scan_max_depth=(
            child.glob_scan_max_depth
            if child.glob_scan_max_depth is not None
            else parent.glob_scan_max_depth
        ),
        network=_merge_network(parent.network, child.network),
    )
    return merged


def _merge_network(
    parent: NetworkSettings | None, child: NetworkSettings | None
) -> NetworkSettings | None:
    if parent is None:
        return child
    if child is None:
        return parent
    domains = {**parent.domains, **child.domains}
    return NetworkSettings(
        enabled=child.enabled if child.enabled is not None else parent.enabled,
        proxy_url=child.proxy_url if child.proxy_url is not None else parent.proxy_url,
        mode=child.mode if child.mode is not None else parent.mode,
        domains=domains,
        allow_local_binding=(
            child.allow_local_binding
            if child.allow_local_binding is not None
            else parent.allow_local_binding
        ),
        allow_upstream_proxy=(
            child.allow_upstream_proxy
            if child.allow_upstream_proxy is not None
            else parent.allow_upstream_proxy
        ),
    )


def resolve_permission_profile(
    profile_name: str,
    entries: Mapping[str, PermissionProfile],
    parent_lookup: Callable[[str], PermissionProfile | None] | None = None,
) -> PermissionProfile:
    """解析档案及其全部 ``extends`` 祖先为单一档案(对标 PermissionsToml::resolve_profile)。

    查找顺序:``entries`` 自有档案 → ``parent_lookup(名字)``(内置档案回调)。
    错误语义逐字对齐 codex:环 → CycleError;顶层名字缺失 → UndefinedProfileError;
    被 extends 的父名字缺失且以 ``:`` 开头 → UnsupportedBuiltInParentError;
    否则 UndefinedParentError。合并自最远祖先起逐层向下(子覆盖父)。
    """
    profile_names: list[str] = []
    profiles: list[PermissionProfile] = []
    next_name = profile_name
    referenced_by: str | None = None

    while True:
        if next_name in profile_names:
            start = profile_names.index(next_name)
            raise CycleError([*profile_names[start:], next_name])

        found: PermissionProfile | None = entries.get(next_name)
        if found is None and parent_lookup is not None:
            found = parent_lookup(next_name)
        if found is None:
            if referenced_by is None:
                raise UndefinedProfileError(next_name)
            if next_name.startswith(":"):
                raise UnsupportedBuiltInParentError(referenced_by, next_name)
            raise UndefinedParentError(referenced_by, next_name)

        # 深拷贝,避免合并过程改写调用方持有的档案对象
        profile = _clone_profile(found)
        parent_name = profile.extends
        profile_names.append(next_name)

        if parent_name is not None:
            profiles.append(profile)
            referenced_by = next_name
            next_name = parent_name
            continue

        merged = profile
        # codex: profiles 按上溯顺序收集,rev 后从最远祖先的父侧逐层向下合并——
        # merge(已合并的父侧, 更近的祖先) 保证"子覆盖父",且最终结果保留被选档案
        # (链首)的声明元数据。
        for ancestor in reversed(profiles):
            merged = merge_permission_profiles(merged, ancestor)
        return merged


def _clone_profile(profile: PermissionProfile) -> PermissionProfile:
    network = profile.network
    return PermissionProfile(
        description=profile.description,
        extends=profile.extends,
        workspace_roots=dict(profile.workspace_roots),
        filesystem=dict(profile.filesystem),
        glob_scan_max_depth=profile.glob_scan_max_depth,
        network=(
            None
            if network is None
            else NetworkSettings(
                enabled=network.enabled,
                proxy_url=network.proxy_url,
                mode=network.mode,
                domains=dict(network.domains),
                allow_local_binding=network.allow_local_binding,
                allow_upstream_proxy=network.allow_upstream_proxy,
            )
        ),
    )


def resolve_enabled_roots(profile: PermissionProfile) -> list[str]:
    """便捷入口:档案生效工作区根(codex WorkspaceRootsToml::enabled_roots)。"""
    return profile.enabled_roots()


def parse_filesystem_entries(
    raw: Mapping[str, Any],
) -> dict[str, Any]:
    """把原始 filesystem 声明解析为 ``{路径: FileSystemAccessMode}``(跳过非法值)。"""
    out: dict[str, Any] = {}
    for path, value in raw.items():
        try:
            if isinstance(value, str):
                out[str(path)] = FileSystemAccessMode.parse(value)
            elif isinstance(value, Iterable) and not isinstance(value, (bytes, dict)):
                parsed = {str(k): FileSystemAccessMode.parse(str(v)) for k, v in value}
                out[str(path)] = parsed
        except (ValueError, TypeError):
            continue
    return out
