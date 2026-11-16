# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_managed_policy.py
"""Guardian 托管策略层(按运行时行为规格 managed requirements.toml,2026-11-16)。

遵循统一工程规范)中的**托管策略注入 + 约束门控**,
取证来自 ``外部程序`` 静态字符串(见
``内部规格``)。

**统一规范 取证要点**:
- ``ConfigRequirementsToml`` 46 字段,含两层 guardian 策略:
  - ``guardian_policy_config``:主安全策略(注入 classifier prompt 的
    ``{{ tenant_policy_config }}`` 段);
  - ``guardian_extra_policy``:附加策略原文:"To enforce additional Guardian rules,
    set guardian_extra_policy in managed requirements.toml"——**这是企业托管方
    强加额外 Guardian 规则的入口**(比主策略更高优先级的强制约束);
- 约束门控(allowlist):``allowed_sandbox_modes`` / ``allowed_approval_policies`` /
  ``allowed_approvals_reviewers`` / ``allowed_permission_profiles`` /
  ``allowed_web_search_modes`` / ``allow_managed_hooks_only`` /
  ``allow_browser_and_computer_use`` / ``allow_remote_control`` /
  ``allow_appshots`` / ``enforce_residency`` 等——托管方圈定**允许的配置取值集合**,
  用户 config 只能在圈内取值;
- ``SandboxModeRequirement = read-only | workspace-write | danger-full-access |
  external-sandbox``(沙箱模式要求四档)。

**这是"企业托管强制"层**:区别于用户可自由改的 ``config.toml``,托管方通过
``requirements.toml``(**强制**)下发策略——``guardian_extra_policy`` 注入额外规则,
``allowed_*`` 圈死取值范围,用户即便想放宽也被托管约束拦住。这是 统一规范 的
企业管控安全模型。

**为什么复现**:本仓 ``mcp_tool_approval`` / ``permission_mode`` 是用户侧自由配置,
缺"托管方强制约束"这层——即"企业下发 guardian 额外策略 + 圈死允许的审批/沙箱/
权限取值集合,用户越界即拒绝"。本模块用纯函数复现该门控内核。

**安全语义(fail-closed)**:
- 约束门控:**拒绝越界**——用户请求的取值不在 ``allowed_*`` 圈内 → 拒绝(绝不放行);
- ``allow_managed_hooks_only=True`` → 非托管来源的 hook 一律拒绝;
- ``guardian_extra_policy`` 注入的额外规则**叠加在主策略之上**(更严不更松);
- 未配置约束(None)→ 不限制(向后兼容单机场景),但一旦配置即强制。

设计纪律:纯函数、无 IO、不解析 TOML(调用方若从 requirements.toml 读,自行喂字段)。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

__all__ = [
    "SandboxModeRequirement",
    "ManagedPolicyRequirements",
    "GuardianExtraPolicy",
    "NetworkDomainRequirements",
    "MarketplaceSourceRequirements",
    "FilesystemDenyReadRequirements",
    "WindowsSandboxRequirements",
    "BrowserUseRequirements",
    "ComputerUseRequirements",
    "ManagedModelRequirements",
    "LoginWorkspaceRequirements",
    "check_sandbox_mode_allowed",
    "check_approval_policy_allowed",
    "check_permission_profile_allowed",
    "check_hooks_source_allowed",
    "check_network_domain_allowed",
    "check_marketplace_source_allowed",
    "check_path_deny_read_allowed",
    "check_windows_sandbox_selection_allowed",
    "check_browser_origin_allowed",
    "check_computer_use_app_allowed",
    "resolve_model_allowed",
    "check_forced_login_method",
    "check_forced_chatgpt_workspace",
    "compose_guardian_policy",
]


class SandboxModeRequirement(StrEnum):
    """沙箱模式要求四档(按行为规格 外部实现 ``SandboxModeRequirement``)。"""

    READ_ONLY = "read-only"
    WORKSPACE_WRITE = "workspace-write"
    DANGER_FULL_ACCESS = "danger-full-access"
    EXTERNAL_SANDBOX = "external-sandbox"


@dataclass
class GuardianExtraPolicy:
    """托管方注入的额外 Guardian 规则(按行为规格 ``guardian_extra_policy``)。

    ``rules`` 是企业额外强制的策略文本,叠加在主策略 ``guardian_policy_config``
    之上(**只收紧不放宽**)。统一规范 原文:它走 managed requirements.toml 下发,
    用于 "enforce additional Guardian rules"。
    """

    rules: str = ""
    #: 是否禁用自动复核(托管方可强制关闭 auto-review,按行为规格 disable/enable_auto_review)。
    disable_auto_review: bool = False

    @property
    def is_empty(self) -> bool:
        """是否无额外规则(空 rules 且未禁用 auto-review)。"""
        return not self.rules.strip() and not self.disable_auto_review


@dataclass
class ManagedPolicyRequirements:
    """托管策略约束门控(按行为规格 ``ConfigRequirementsToml`` 的 allowed_* 字段)。

    每个 ``allowed_*`` 为 None 表示"不限制"(单机场景向后兼容);一旦配置成
    集合,用户请求的取值必须落在集合内,否则拒绝(fail-closed)。
    """

    allowed_sandbox_modes: frozenset[str] | None = None
    allowed_approval_policies: frozenset[str] | None = None
    allowed_permission_profiles: frozenset[str] | None = None
    allowed_web_search_modes: frozenset[str] | None = None
    #: 仅允许托管来源的 hook(非托管 hook 一律拒绝)。
    allow_managed_hooks_only: bool = False
    allow_browser_and_computer_use: bool = True
    allow_remote_control: bool = False
    allow_appshots: bool = True
    enforce_residency: bool = False
    extra_policy: GuardianExtraPolicy = field(default_factory=GuardianExtraPolicy)


@dataclass
class NetworkDomainRequirements:
    """网络域名托管约束(按行为规格 ``RawNetworkRequirementsToml``)。

    企业托管方通过 managed requirements.toml 下发域名白/黑名单:
    - ``allowed_domains``: 托管方允许的域名后缀集合;
    - ``denied_domains``: 托管方强制拒绝的域名后缀集合(deny 优先于 allow);
    - ``managed_allowed_domains_only``: **强制覆盖**——为 True 时只信托管下发的
      ``allowed_domains``,用户侧自由配置的白名单被**完全忽略**(供应链安全)。

    fail-closed:``managed_allowed_domains_only=True`` 且 ``allowed_domains`` 为空
    ⇒ 全部域名拒绝(绝不静默放行)。
    """

    allowed_domains: frozenset[str] = field(default_factory=frozenset)
    denied_domains: frozenset[str] = field(default_factory=frozenset)
    managed_allowed_domains_only: bool = False

    def _domain_matches(self, host: str, domain_set: frozenset[str]) -> bool:
        """后缀匹配:host 等于域或以 .domain 结尾(对齐 codex 域名白/黑名单语义)。"""
        host = host.lower().rstrip(".")
        for d in domain_set:
            d = d.lower().lstrip(".")
            if host == d or host.endswith("." + d):
                return True
        return False

    def check(self, host: str) -> tuple[bool, str | None]:
        """判定 host 是否被托管域名约束允许。

        判定顺序(对齐 codex,deny 恒优先):
        1. host ∈ denied_domains ⇒ 拒绝(托管黑名单硬拦);
        2. ``managed_allowed_domains_only=True``:
           - allowed_domains 为空 ⇒ 拒绝(fail-closed:强制模式但没配白名单);
           - host ∉ allowed_domains ⇒ 拒绝(用户白名单被忽略,只信托管白名单);
        3. 其余 ⇒ 放行(未启用 managed_only 时不强管用户侧自由配置)。

        Returns:
            ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        """
        if not host or not host.strip():
            return False, "empty host rejected by managed network policy"
        if self._domain_matches(host, self.denied_domains):
            return False, f"host '{host}' in managed denied_domains"
        if self.managed_allowed_domains_only:
            if not self.allowed_domains:
                return (
                    False,
                    "managed_allowed_domains_only enforced but allowed_domains is empty"
                    " (fail-closed)",
                )
            if not self._domain_matches(host, self.allowed_domains):
                return (
                    False,
                    f"host '{host}' not in managed allowed_domains"
                    " (managed_allowed_domains_only is enforced)",
                )
        return True, None


@dataclass
class MarketplaceSourceRequirements:
    """插件市场来源托管约束(按行为规格 ``MarketplaceRequirementsToml``)。

    企业托管方可强制收紧插件安装来源:
    - ``restrict_to_allowed_sources=True`` ⇒ 仅允许从 ``allowed_sources``
      集合中的市场标识安装插件,其余来源一律拒绝(供应链安全);
    - ``allowed_sources``: 市场标识集合(如 ``{"openai-bundled", "corp-internal"}``)。

    fail-closed:``restrict_to_allowed_sources=True`` 且 ``allowed_sources`` 为空
    ⇒ 任何来源均拒绝(绝不静默放行)。
    """

    restrict_to_allowed_sources: bool = False
    allowed_sources: frozenset[str] = field(default_factory=frozenset)

    def check(self, source: str) -> tuple[bool, str | None]:
        """判定插件市场来源是否被托管约束允许。

        Returns:
            ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        """
        if not self.restrict_to_allowed_sources:
            return True, None
        if not source or not source.strip():
            return False, "empty marketplace source rejected (restrict_to_allowed_sources)"
        if not self.allowed_sources:
            return (
                False,
                "restrict_to_allowed_sources enforced but allowed_sources is empty"
                " (fail-closed)",
            )
        if source not in self.allowed_sources:
            return (
                False,
                f"marketplace source '{source}' not in managed allowed_sources"
                " (restrict_to_allowed_sources is enforced)",
            )
        return True, None


# 默认敏感凭据路径(codex 内置 deny_read,对齐取证:
# ~/.ssh / ~/.aws/credentials / ~/.aws/config / AWS_*_FILE)。
_DEFAULT_DENY_READ_GLOBS: tuple[str, ...] = (
    "~/.ssh/**",
    "~/.aws/credentials",
    "~/.aws/config",
    "~/.aws/**/credentials",
    "~/.gnupg/**",
    "~/.netrc",
    "~/.docker/config.json",
    "~/.kube/config",
    "~/.codex/auth.json",
    "~/.config/gcloud/**",
    "**/id_rsa",
    "**/id_ed25519",
    "**/*.pem",
    "**/*.key",
)


@dataclass
class FilesystemDenyReadRequirements:
    """文件系统托管 deny_read 约束(按行为规格 ``RawFilesystemRequirementsToml``)。

    企业托管方通过 managed requirements.toml 下发 ``permissions.filesystem.deny_read``
    路径集合(glob 模式),强制拒绝读取敏感路径(凭据/密钥/SSH 等)。

    安全语义:
    - ``deny_read``: 托管方强制拒绝的路径 glob 集合(叠加在默认敏感路径之上);
    - ``use_defaults``(默认 True): 是否叠加内置敏感凭据路径(对齐 codex 内置保护);
    - ``managed_deny_all``: 为 True 时**全部读取一律拒绝**(fail-closed 极端模式,
      对齐 codex 错误串 "all managed deny_read restrictions")。

    fail-closed:
    - ``managed_deny_all=True`` ⇒ 任何路径拒绝;
    - 路径命中 deny_read glob ⇒ 拒绝(绝不静默放行)。
    """

    deny_read: tuple[str, ...] = ()
    use_defaults: bool = True
    managed_deny_all: bool = False

    def _iter_globs(self) -> tuple[str, ...]:
        """返回实际生效的 deny_read glob 集合(托管 + 可选内置默认)。

        ``~`` 前缀按 codex 语义视为"任意 home 路径"——展开为 ``**`` 前缀,
        使内置敏感路径(如 ``~/.ssh/**``)能匹配任意用户 home 下的绝对路径。
        """
        globs = tuple(self.deny_read) + (_DEFAULT_DENY_READ_GLOBS if self.use_defaults else ())
        expanded: list[str] = []
        for g in globs:
            if g.startswith("~/"):
                # ~/.ssh/** → **/.ssh/**
                expanded.append("**/" + g[2:])
            else:
                expanded.append(g)
        return tuple(expanded)

    @staticmethod
    def _path_matches_glob(path: str, glob: str) -> bool:
        """纯路径 glob 匹配(支持 ``**`` 跨段 + ``*`` 单段 + ``?`` 单字符)。

        设计纪律:不触 IO,路径仅作字符串处理;``~`` 前缀已在 ``_iter_globs``
        展开为 ``**``,此处只处理普通 glob。手写转换避免引入 pathspec 依赖。
        """
        import re

        result: list[str] = []
        i = 0
        while i < len(glob):
            c = glob[i]
            if c == "*":
                if i + 1 < len(glob) and glob[i + 1] == "*":
                    # ** 跨段
                    if i + 2 < len(glob) and glob[i + 2] == "/":
                        result.append("(?:.*/)?")
                        i += 3
                    else:
                        result.append(".*")
                        i += 2
                else:
                    # * 单段(不跨 /)
                    result.append("[^/]*")
                    i += 1
            elif c == "?":
                result.append("[^/]")
                i += 1
            else:
                result.append(re.escape(c))
                i += 1
        regex = "^" + "".join(result) + "$"
        return re.match(regex, path) is not None

    def check(self, path: str) -> tuple[bool, str | None]:
        """判定 path 是否被托管 deny_read 约束允许读取。

        Returns:
            ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        """
        if not path or not path.strip():
            return False, "empty path rejected by managed deny_read policy"
        if self.managed_deny_all:
            return False, "all reads denied by managed_deny_all (fail-closed)"
        # 归一化:去尾部斜杠 + 统一 ~ 前缀
        normalized = path.rstrip("/")
        for glob in self._iter_globs():
            if self._path_matches_glob(normalized, glob) or \
               self._path_matches_glob(normalized + "/", glob):
                return (
                    False,
                    f"path '{path}' matched managed deny_read glob '{glob}'",
                )
        return True, None


def check_path_deny_read_allowed(
    path: str,
    requirements: FilesystemDenyReadRequirements,
) -> tuple[bool, str | None]:
    """校验路径是否被托管 deny_read 约束允许(对齐 ``RawFilesystemRequirementsToml``)。

    转发给 :meth:`FilesystemDenyReadRequirements.check`;独立函数便于调用方按
    现有 ``check_*_allowed`` 范式统一接入门控链。
    """
    return requirements.check(path)


# Windows 沙箱实现白名单合法取值(对齐 codex WindowsSandboxModeToml + 沙箱标签)
_WINDOWS_SANDBOX_IMPLEMENTATIONS: frozenset[str] = frozenset(
    {"mxc", "elevated", "restricted_token", "disabled"}
)


@dataclass
class WindowsSandboxRequirements:
    """Windows 沙箱托管约束(按行为规格 ``WindowsRequirementsToml``,3 字段)。

    企业托管方可约束 Windows 平台沙箱实现选择:
    - ``allowed_sandbox_implementations``: 沙箱实现白名单(取值集合:
      ``mxc`` / ``elevated`` / ``restricted_token`` / ``disabled``);
    - ``allow_mxc``: 是否允许 MXC 沙箱(对齐 codex 错误串
      "windows.sandbox = mxc is not allowed when windows.allow_mxc = false");
    - ``require_mxc``: 强制使用 MXC(为 True 时 mxc 是唯一合法选择)。

    安全语义(fail-closed):
    - ``require_mxc=True`` 且请求非 mxc ⇒ 拒绝(强制模式);
    - ``allow_mxc=False`` 且请求 mxc ⇒ 拒绝(MXC 被企业禁用);
    - ``allowed_sandbox_implementations`` 非空且请求不在集合 ⇒ 拒绝(越界)。
    """

    allowed_sandbox_implementations: frozenset[str] = field(default_factory=frozenset)
    allow_mxc: bool = True
    require_mxc: bool = False

    def check(self, requested: str) -> tuple[bool, str | None]:
        """判定请求的 Windows 沙箱实现是否被托管约束允许。

        判定顺序(强约束优先):
        1. 请求非法(不在四档内)⇒ 拒绝;
        2. ``require_mxc=True`` 且请求非 mxc ⇒ 拒绝(强制模式);
        3. ``allow_mxc=False`` 且请求 mxc ⇒ 拒绝(MXC 被禁用);
        4. ``allowed_sandbox_implementations`` 非空且请求不在集合 ⇒ 拒绝;
        5. 其余 ⇒ 放行。

        Returns:
            ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        """
        if requested not in _WINDOWS_SANDBOX_IMPLEMENTATIONS:
            return (
                False,
                f"invalid windows sandbox implementation: {requested}"
                f" (valid: {sorted(_WINDOWS_SANDBOX_IMPLEMENTATIONS)})",
            )
        if self.require_mxc and requested != "mxc":
            return (
                False,
                f"windows sandbox '{requested}' rejected: require_mxc is enforced"
                " (only 'mxc' allowed)",
            )
        if requested == "mxc" and not self.allow_mxc:
            return (
                False,
                "windows.sandbox = 'mxc' is not allowed when windows.allow_mxc = false",
            )
        if (
            self.allowed_sandbox_implementations
            and requested not in self.allowed_sandbox_implementations
        ):
            return (
                False,
                f"windows sandbox '{requested}' not in managed"
                " allowed_sandbox_implementations",
            )
        return True, None


def check_windows_sandbox_selection_allowed(
    requested: str,
    requirements: WindowsSandboxRequirements,
) -> tuple[bool, str | None]:
    """校验 Windows 沙箱实现选择是否被托管约束允许(对齐 ``WindowsRequirementsToml``)。

    转发给 :meth:`WindowsSandboxRequirements.check`;独立函数便于调用方按
    现有 ``check_*_allowed`` 范式统一接入门控链。
    """
    return requirements.check(requested)


@dataclass
class BrowserUseRequirements:
    """浏览器使用托管约束(按行为规格 ``BrowserUseRequirementsToml``,7 字段)。

    企业托管方可约束浏览器自动化能力边界:
    - ``extension``: 是否允许浏览器扩展(供应链安全);
    - ``allow_webmcp``: 是否允许 WebMCP(浏览器内 MCP 调用);
    - ``allow_history_access``: 是否允许读取浏览器历史(隐私敏感);
    - ``disable_auto_review``: 是否禁用自动复核(对齐 AutoReview 语义);
    - ``allow_global_persistent_approval``: 是否允许全局持久化审批(跨会话记忆授权);
    - ``default_origin_policy``: 默认源策略(allow / deny,未匹配 origins 时的兜底);
    - ``origins``: 明确允许的源集合(对齐 codex origin allowlist)。

    安全语义(fail-closed):
    - ``default_origin_policy=deny`` 且 origin ∉ origins ⇒ 拒绝(白名单模式);
    - ``allow_history_access=False`` 时历史访问请求 ⇒ 拒绝(隐私保护)。
    """

    extension: bool = True
    allow_webmcp: bool = True
    allow_history_access: bool = False
    disable_auto_review: bool = False
    allow_global_persistent_approval: bool = False
    default_origin_policy: str = "deny"  # allow | deny
    origins: frozenset[str] = field(default_factory=frozenset)

    def check_origin(self, origin: str) -> tuple[bool, str | None]:
        """判定浏览器访问的 origin 是否被托管策略允许。

        判定顺序:
        1. origin ∈ origins ⇒ 放行(白名单命中,优先于 default);
        2. origin 不在 origins:
           - default_origin_policy=deny ⇒ 拒绝(默认拒绝);
           - default_origin_policy=allow ⇒ 放行(默认允许);
        3. 非法 default_origin_policy ⇒ fail-closed 拒绝。

        Returns:
            ``(allowed, reason)``。
        """
        if not origin or not origin.strip():
            return False, "empty origin rejected by managed browser policy"
        if origin in self.origins:
            return True, None
        if self.default_origin_policy == "deny":
            return (
                False,
                f"origin '{origin}' not in managed origins"
                " (default_origin_policy=deny)",
            )
        if self.default_origin_policy == "allow":
            return True, None
        return (
            False,
            f"invalid default_origin_policy: {self.default_origin_policy}"
            " (fail-closed)",
        )

    def check_history_access(self) -> tuple[bool, str | None]:
        """判定历史访问是否被托管策略允许(隐私敏感)。"""
        if not self.allow_history_access:
            return (
                False,
                "history access rejected: allow_history_access is false"
                " (managed privacy policy)",
            )
        return True, None


def check_browser_origin_allowed(
    origin: str,
    requirements: BrowserUseRequirements,
) -> tuple[bool, str | None]:
    """校验浏览器 origin 是否被托管策略允许(对齐 ``BrowserUseRequirementsToml``)。"""
    return requirements.check_origin(origin)


@dataclass
class ComputerUseRequirements:
    """电脑使用托管约束(按行为规格 ``ComputerUseRequirementsToml``,5 字段)。

    企业托管方可约束电脑控制能力边界(高风险面):
    - ``allow_locked_computer_use``: 是否允许控制**锁定状态**的电脑(极高风险);
    - ``allow_persistent_approval``: 是否允许持久化审批(跨会话记忆授权);
    - ``default_app_access``: 默认应用访问策略(allow / deny);
    - ``macos``: macOS 平台配置(bundle_ids 白名单);
    - ``windows``: Windows 平台配置(aumids / exes 白名单)。

    安全语义(fail-closed):
    - ``allow_locked_computer_use=False`` 且请求控制锁定电脑 ⇒ 拒绝(极高风险保护);
    - ``default_app_access=deny`` 且 app 不在平台白名单 ⇒ 拒绝。
    """

    allow_locked_computer_use: bool = False
    allow_persistent_approval: bool = False
    default_app_access: str = "deny"  # allow | deny
    macos_bundle_ids: frozenset[str] = field(default_factory=frozenset)
    windows_aumids: frozenset[str] = field(default_factory=frozenset)
    windows_exes: frozenset[str] = field(default_factory=frozenset)

    def check_app_allowed(
        self, app_id: str, platform: str
    ) -> tuple[bool, str | None]:
        """判定应用是否被托管策略允许(按平台查白名单)。

        Args:
            app_id: 应用标识(macos=bundle_id, windows=aumid 或 exe 路径)。
            platform: 'macos' | 'windows'。

        Returns:
            ``(allowed, reason)``。
        """
        if not app_id or not app_id.strip():
            return False, "empty app_id rejected by managed computer_use policy"
        if platform == "macos":
            whitelist = self.macos_bundle_ids
        elif platform == "windows":
            whitelist = self.windows_aumids | self.windows_exes
        else:
            return False, f"unsupported platform: {platform} (fail-closed)"

        if app_id in whitelist:
            return True, None
        if self.default_app_access == "deny":
            return (
                False,
                f"app '{app_id}' not in managed {platform} whitelist"
                " (default_app_access=deny)",
            )
        if self.default_app_access == "allow":
            return True, None
        return (
            False,
            f"invalid default_app_access: {self.default_app_access} (fail-closed)",
        )

    def check_locked_computer_use(self) -> tuple[bool, str | None]:
        """判定控制锁定电脑是否被托管策略允许(极高风险)。"""
        if not self.allow_locked_computer_use:
            return (
                False,
                "locked computer use rejected: allow_locked_computer_use is false"
                " (managed high-risk policy)",
            )
        return True, None


def check_computer_use_app_allowed(
    app_id: str,
    platform: str,
    requirements: ComputerUseRequirements,
) -> tuple[bool, str | None]:
    """校验电脑使用应用是否被托管策略允许(对齐 ``ComputerUseRequirementsToml``)。"""
    return requirements.check_app_allowed(app_id, platform)


# ============================================================
# Models 托管(对齐 ModelsRequirementsToml + forced_* 字段)
# 取证错误串:"disallowed by requirements; falling back to required default"
# 安全语义:与硬拒绝不同——不在白名单的模型**软降级**到企业强制默认值,
# 用户侧不报错但实际用的是企业指定的 fallback_model。
# ============================================================


@dataclass
class ManagedModelRequirements:
    """模型托管约束(按行为规格 ``ModelsRequirementsToml`` + forced_default 模式)。

    企业托管方通过 managed requirements.toml 下发模型约束:
    - ``allowed_models``: 允许的模型 slug 集合(空集 = 不限制);
    - ``required_default``: 企业强制默认模型(不在 allowed 里的用户请求降级到此);
    - ``required_on_models``(对齐 AutoReview 语义,可选延伸): 强制开启 auto-review
      的模型集合。

    安全语义(**软降级**,区别于硬拒绝):
    - 模型 ∈ allowed_models ⇒ 放行(原样返回);
    - 模型 ∉ allowed_models 且 required_default 非空 ⇒ 软降级到 required_default
      (返回降级后的模型 slug + reason 说明被托管覆盖);
    - 模型 ∉ allowed_models 且 required_default 为空 ⇒ 硬拒绝(fail-closed)。

    ``required_default`` 相当于企业"兜底安全模型",即使用户请求了不在白名单里
    的模型也不报错,只是静默替换为企业认可的默认值——对齐 codex
    "falling back to required default" 的行为模式。
    """

    allowed_models: frozenset[str] = field(default_factory=frozenset)
    required_default: str | None = None
    required_on_models: frozenset[str] = field(default_factory=frozenset)

    def resolve(
        self, requested_model: str
    ) -> tuple[str | None, str | None]:
        """解析用户请求的模型,按托管策略返回**实际生效**的模型 slug。

        与 ``check_*_allowed`` 范式不同,这里返回的不是 ``(bool, reason)`` 而是
        ``(effective_model, reason)``——effective_model 为 None 表示硬拒绝。

        判定顺序:
        1. 空 slug ⇒ 脏输入,先判:有 required_default 软降级,否则硬拒绝;
        2. allowed_models 为空集 ⇒ 未配置约束,原样放行(向后兼容单机场景);
        3. 模型 ∈ allowed_models ⇒ 原样放行;
        4. 模型 ∉ allowed_models 且 required_default 非空 ⇒ 软降级;
        5. 模型 ∉ allowed_models 且 required_default 为空 ⇒ 硬拒绝。

        Returns:
            ``(effective_model, reason)``:
            - effective_model = requested_model: 放行(原样);
            - effective_model = required_default: 软降级(用户侧无感知);
            - effective_model = None: 硬拒绝(不允许且无降级目标)。
        """
        # 空 slug 是脏输入,优先于 allowlist 判定(不能因 allowlist 空就放行脏输入)
        if not requested_model or not requested_model.strip():
            if self.required_default:
                return self.required_default, (
                    "empty model slug; falling back to required_default"
                    " (managed policy)"
                )
            return None, "empty model slug rejected by managed model policy"

        # 未配置约束:allowed_models 空集 = 不限制(向后兼容单机场景)
        if not self.allowed_models:
            return requested_model, None

        if requested_model in self.allowed_models:
            return requested_model, None

        # 不在白名单
        if self.required_default:
            return (
                self.required_default,
                (
                    f"model '{requested_model}' is disallowed by requirements;"
                    f" falling back to required default '{self.required_default}'"
                ),
            )
        return (
            None,
            f"model '{requested_model}' not in managed allowed_models"
            " (no required_default configured, fail-closed)",
        )

    def is_auto_review_required(self, model: str) -> bool:
        """判定模型是否强制开启 auto-review(对齐 ``required_on_models``)。"""
        return model in self.required_on_models


def resolve_model_allowed(
    requested_model: str,
    requirements: ManagedModelRequirements,
) -> tuple[str | None, str | None]:
    """解析模型是否被托管策略允许(对齐 ``ModelsRequirementsToml``)。

    转发给 :meth:`ManagedModelRequirements.resolve`;独立函数便于调用方统一接入。
    """
    return requirements.resolve(requested_model)


# ============================================================
# Login/Workspace 强制约束(对齐 forced_login_method / forced_chatgpt_workspace_id)
# 取证字段:
#   allowed_login_methods / allowed_chatgpt_workspaces
#   forced_login_method / forced_chatgpt_workspace_id
# 安全语义:企业锁定登录方式与 ChatGPT 工作区(企业账号治理),
#   用户不能切换到非企业认可的身份。
# ============================================================


@dataclass
class LoginWorkspaceRequirements:
    """登录方式 + ChatGPT 工作区托管约束。

    - ``allowed_login_methods``: 允许的登录方式集合(空 = 不限制);
    - ``allowed_chatgpt_workspaces``: 允许的 ChatGPT 工作区 ID 集合(空 = 不限制);
    - ``forced_login_method``: 企业强制登录方式(非 None 时**覆盖**用户选择);
    - ``forced_chatgpt_workspace_id``: 企业强制 ChatGPT 工作区 ID(非 None 时覆盖)。

    安全语义(fail-closed):
    - forced_* 非空 ⇒ 用户侧请求无论填什么都强制覆盖为 forced 值(治理面);
    - forced_* 为空但白名单非空 ⇒ 用户请求必须落在白名单内,否则拒绝。
    """

    allowed_login_methods: frozenset[str] = field(default_factory=frozenset)
    allowed_chatgpt_workspaces: frozenset[str] = field(default_factory=frozenset)
    forced_login_method: str | None = None
    forced_chatgpt_workspace_id: str | None = None

    def check_login_method(self, requested: str) -> tuple[str | None, str | None]:
        """解析实际生效的登录方式(返回 (effective_method, reason))。"""
        if self.forced_login_method:
            if requested == self.forced_login_method:
                return requested, None
            return (
                self.forced_login_method,
                (
                    f"login method '{requested}' overridden by"
                    f" forced_login_method='{self.forced_login_method}'"
                    " (managed policy)"
                ),
            )
        if self.allowed_login_methods:
            if requested in self.allowed_login_methods:
                return requested, None
            return None, (
                f"login method '{requested}' not in managed allowed_login_methods"
            )
        return requested, None

    def check_chatgpt_workspace(
        self, requested: str
    ) -> tuple[str | None, str | None]:
        """解析实际生效的 ChatGPT 工作区 ID(返回 (effective_workspace, reason))。"""
        if self.forced_chatgpt_workspace_id:
            if requested == self.forced_chatgpt_workspace_id:
                return requested, None
            return (
                self.forced_chatgpt_workspace_id,
                (
                    f"workspace '{requested}' overridden by"
                    f" forced_chatgpt_workspace_id="
                    f"'{self.forced_chatgpt_workspace_id}' (managed policy)"
                ),
            )
        if self.allowed_chatgpt_workspaces:
            if requested in self.allowed_chatgpt_workspaces:
                return requested, None
            return None, (
                f"workspace '{requested}' not in managed"
                " allowed_chatgpt_workspaces"
            )
        return requested, None


def check_forced_login_method(
    requested: str,
    requirements: LoginWorkspaceRequirements,
) -> tuple[str | None, str | None]:
    """校验/覆盖登录方式(对齐 ``forced_login_method`` + ``allowed_login_methods``)。"""
    return requirements.check_login_method(requested)


def check_forced_chatgpt_workspace(
    requested: str,
    requirements: LoginWorkspaceRequirements,
) -> tuple[str | None, str | None]:
    """校验/覆盖 ChatGPT 工作区(对齐 ``forced_chatgpt_workspace_id``)。"""
    return requirements.check_chatgpt_workspace(requested)


def check_sandbox_mode_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的沙箱模式是否被托管约束允许。

    Returns:
        ``(allowed, reason)``:allowed=False 时 reason 说明违反了哪条约束。
        fail-closed:请求模式非法或不在 allowed 集合 → 拒绝。
    """
    # 先校验请求本身是合法沙箱模式(四档之一)。
    try:
        SandboxModeRequirement(requested)
    except ValueError:
        return False, f"invalid sandbox mode: {requested}"

    allowed = requirements.allowed_sandbox_modes
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"sandbox mode '{requested}' not in managed allowed_sandbox_modes",
        )
    return True, None


def check_approval_policy_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的审批策略是否被托管约束允许(按行为规格 allowed_approval_policies)。"""
    allowed = requirements.allowed_approval_policies
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"approval policy '{requested}' not in managed allowed_approval_policies",
        )
    return True, None


def check_permission_profile_allowed(
    requested: str,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验请求的权限 profile 是否被托管约束允许(按行为规格 allowed_permission_profiles)。"""
    allowed = requirements.allowed_permission_profiles
    if allowed is not None and requested not in allowed:
        return (
            False,
            f"permission profile '{requested}' not in managed allowed_permission_profiles",
        )
    return True, None


def check_hooks_source_allowed(
    is_managed: bool,
    requirements: ManagedPolicyRequirements,
) -> tuple[bool, str | None]:
    """校验 hook 来源:``allow_managed_hooks_only=True`` 时非托管 hook 一律拒绝。

    对齐 统一规范 ``allow_managed_hooks_only``——企业托管下只信自己下发的 hook,
    用户自定义 hook 一律拦(供应链安全)。
    """
    if requirements.allow_managed_hooks_only and not is_managed:
        return False, "non-managed hook rejected: allow_managed_hooks_only is enforced"
    return True, None


def check_network_domain_allowed(
    host: str,
    requirements: NetworkDomainRequirements,
) -> tuple[bool, str | None]:
    """校验网络域名是否被托管约束允许(对齐 ``RawNetworkRequirementsToml``)。

    转发给 :meth:`NetworkDomainRequirements.check`;独立函数便于调用方按现有
    ``check_*_allowed`` 范式统一接入门控链。
    """
    return requirements.check(host)


def check_marketplace_source_allowed(
    source: str,
    requirements: MarketplaceSourceRequirements,
) -> tuple[bool, str | None]:
    """校验插件市场来源是否被托管约束允许(对齐 ``MarketplaceRequirementsToml``)。

    转发给 :meth:`MarketplaceSourceRequirements.check`;独立函数便于调用方按现有
    ``check_*_allowed`` 范式统一接入门控链。
    """
    return requirements.check(source)


def compose_guardian_policy(
    base_policy: str,
    requirements: ManagedPolicyRequirements,
) -> str:
    """合成最终注入 classifier prompt 的安全策略文本。

    逐条对齐 统一规范:
    - 主策略 ``base_policy``(对应 ``guardian_policy_config`` / ``tenant_policy_config``);
    - 托管 ``guardian_extra_policy`` **叠加在其后**(只收紧不放宽)。

    Returns:
        合成后的策略文本;extra_policy 为空时原样返回 base_policy。
    """
    extra = requirements.extra_policy
    if extra.is_empty:
        return base_policy
    parts = [base_policy.rstrip()]
    if extra.rules.strip():
        parts.append(extra.rules.strip())
    if extra.disable_auto_review:
        parts.append("Auto-review is disabled by managed policy.")
    return "\n\n".join(parts)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
