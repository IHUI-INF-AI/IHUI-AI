# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_managed_policy 行为测试(按运行时行为规格 managed requirements.toml,2026-11-16)。

覆盖五面(逐条对齐 外部程序 ConfigRequirementsToml 字段语义,取证见
``内部规格``):
1. SandboxModeRequirement 四档枚举按行为规格;
2. allowed_* 约束门控(越界拒绝,fail-closed;None=不限制向后兼容);
3. allow_managed_hooks_only 供应链安全(非托管 hook 拒绝);
4. guardian_extra_policy 叠加主策略(只收紧不放宽);
5. compose_guardian_policy 合成语义。

安全语义:越界一律拒绝;extra_policy 只收紧;非法沙箱模式拒绝。
"""
from __future__ import annotations

import pytest

from app.core.guardian_managed_policy import (
    BrowserUseRequirements,
    ComputerUseRequirements,
    FilesystemDenyReadRequirements,
    GuardianExtraPolicy,
    LoginWorkspaceRequirements,
    ManagedModelRequirements,
    ManagedPolicyRequirements,
    MarketplaceSourceRequirements,
    NetworkDomainRequirements,
    SandboxModeRequirement,
    WindowsSandboxRequirements,
    check_approval_policy_allowed,
    check_browser_origin_allowed,
    check_computer_use_app_allowed,
    check_forced_chatgpt_workspace,
    check_forced_login_method,
    check_hooks_source_allowed,
    check_marketplace_source_allowed,
    check_network_domain_allowed,
    check_path_deny_read_allowed,
    check_permission_profile_allowed,
    check_sandbox_mode_allowed,
    check_windows_sandbox_selection_allowed,
    compose_guardian_policy,
    resolve_model_allowed,
)


def _req(**kwargs) -> ManagedPolicyRequirements:
    return ManagedPolicyRequirements(**kwargs)


# ---------- SandboxModeRequirement 四档 ----------

def test_sandbox_mode_four_tiers_match_codex():
    """按行为规格 外部实现.exe:SandboxModeRequirement 四档。"""
    assert {s.value for s in SandboxModeRequirement} == {
        "read-only", "workspace-write", "danger-full-access", "external-sandbox",
    }


# ---------- allowed_sandbox_modes 门控 ----------

def test_sandbox_mode_none_constraint_allows_any_valid():
    """未配置约束(None)→ 合法模式均放行(单机向后兼容)。"""
    req = _req()
    for mode in ("read-only", "workspace-write", "external-sandbox"):
        allowed, reason = check_sandbox_mode_allowed(mode, req)
        assert allowed is True
        assert reason is None


def test_sandbox_mode_out_of_allowlist_rejected():
    """越界:托管只允许 read-only,请求 danger-full-access → 拒绝。"""
    req = _req(allowed_sandbox_modes=frozenset({"read-only"}))
    allowed, reason = check_sandbox_mode_allowed("danger-full-access", req)
    assert allowed is False
    assert reason is not None
    assert "not in managed allowed_sandbox_modes" in reason


def test_sandbox_mode_in_allowlist_allowed():
    req = _req(allowed_sandbox_modes=frozenset({"read-only", "workspace-write"}))
    allowed, _ = check_sandbox_mode_allowed("workspace-write", req)
    assert allowed is True


def test_sandbox_mode_invalid_rejected_even_without_constraint():
    """非法沙箱模式(不在四档)→ 即便无约束也拒绝(fail-closed)。"""
    allowed, reason = check_sandbox_mode_allowed("yolo", _req())
    assert allowed is False
    assert "invalid sandbox mode" in reason


# ---------- allowed_approval_policies 门控 ----------

def test_approval_policy_none_allows_any():
    assert check_approval_policy_allowed("on-request", _req())[0] is True


def test_approval_policy_out_of_allowlist_rejected():
    req = _req(allowed_approval_policies=frozenset({"on-request", "never"}))
    allowed, reason = check_approval_policy_allowed("untrusted", req)
    assert allowed is False
    assert "not in managed allowed_approval_policies" in reason


def test_approval_policy_in_allowlist_allowed():
    req = _req(allowed_approval_policies=frozenset({"on-request"}))
    assert check_approval_policy_allowed("on-request", req)[0] is True


# ---------- allowed_permission_profiles 门控 ----------

def test_permission_profile_out_of_allowlist_rejected():
    req = _req(allowed_permission_profiles=frozenset({"default"}))
    allowed, reason = check_permission_profile_allowed("admin", req)
    assert allowed is False
    assert "not in managed allowed_permission_profiles" in reason


def test_permission_profile_in_allowlist_allowed():
    req = _req(allowed_permission_profiles=frozenset({"default", "restricted"}))
    assert check_permission_profile_allowed("restricted", req)[0] is True


# ---------- allow_managed_hooks_only 供应链安全 ----------

def test_non_managed_hook_rejected_when_managed_only():
    """托管强制只信托管 hook:非托管 hook → 拒绝(供应链安全)。"""
    req = _req(allow_managed_hooks_only=True)
    allowed, reason = check_hooks_source_allowed(is_managed=False, requirements=req)
    assert allowed is False
    assert "non-managed hook rejected" in reason


def test_managed_hook_allowed_when_managed_only():
    req = _req(allow_managed_hooks_only=True)
    assert check_hooks_source_allowed(is_managed=True, requirements=req)[0] is True


def test_non_managed_hook_allowed_without_constraint():
    """未开 allow_managed_hooks_only → 非托管 hook 放行(单机场景)。"""
    assert check_hooks_source_allowed(is_managed=False, requirements=_req())[0] is True


# ---------- guardian_extra_policy 叠加 ----------

def test_extra_policy_empty_is_noop():
    """空 extra_policy → 原样返回 base_policy。"""
    base = "Base security policy."
    assert compose_guardian_policy(base, _req()) == base


def test_extra_policy_appended_after_base():
    """extra rules 叠加在 base 之后(只收紧不放宽)。"""
    req = _req(extra_policy=GuardianExtraPolicy(rules="No network egress."))
    composed = compose_guardian_policy("Base policy.", req)
    assert composed.startswith("Base policy.")
    assert "No network egress." in composed
    assert composed.index("Base policy.") < composed.index("No network egress.")


def test_extra_policy_disable_auto_review_appended():
    """disable_auto_review → 合成文本含托管禁用声明。"""
    req = _req(extra_policy=GuardianExtraPolicy(disable_auto_review=True))
    composed = compose_guardian_policy("Base.", req)
    assert "Auto-review is disabled by managed policy." in composed


def test_extra_policy_both_rules_and_disable():
    """rules + disable 同时配置 → 两者都进合成文本。"""
    req = _req(
        extra_policy=GuardianExtraPolicy(
            rules="Deny all deletes.", disable_auto_review=True,
        )
    )
    composed = compose_guardian_policy("Base.", req)
    assert "Deny all deletes." in composed
    assert "Auto-review is disabled" in composed


def test_extra_policy_is_empty_property():
    """is_empty 判据:空 rules + 未禁用 = 空;否则非空。"""
    assert GuardianExtraPolicy().is_empty is True
    assert GuardianExtraPolicy(rules="x").is_empty is False
    assert GuardianExtraPolicy(disable_auto_review=True).is_empty is False


def test_compose_strips_base_trailing_whitespace():
    """base 尾部空白被规整,合成后不含多余空行。"""
    req = _req(extra_policy=GuardianExtraPolicy(rules="Extra."))
    composed = compose_guardian_policy("Base.   \n\n", req)
    assert "Base." in composed
    assert "Extra." in composed


# ---------- NetworkDomainRequirements ----------
# 取证:codex.exe strings → RawNetworkRequirementsToml
# 字段:allowed_domains / denied_domains / managed_allowed_domains_only


def test_network_domain_no_constraint_allows_any():
    """未启用 managed_only、无 denied → 任何 host 放行。"""
    net = NetworkDomainRequirements()
    allowed, reason = check_network_domain_allowed("anything.example.com", net)
    assert allowed is True
    assert reason is None


def test_network_domain_denied_list_rejects_exact_and_subdomain():
    """deny 列表精确匹配 + 子域匹配均拒绝。"""
    net = NetworkDomainRequirements(denied_domains=frozenset({"evil.com"}))
    assert check_network_domain_allowed("evil.com", net)[0] is False
    assert check_network_domain_allowed("sub.evil.com", net)[0] is False
    # 不相关域名放行
    assert check_network_domain_allowed("good.com", net)[0] is True


def test_network_domain_managed_only_ignores_user_domains():
    """managed_allowed_domains_only=True 时,用户白名单被忽略,
    只信托管 allowed_domains 集合(供应链安全核心语义)。"""
    net = NetworkDomainRequirements(
        allowed_domains=frozenset({"corp.example.com"}),
        managed_allowed_domains_only=True,
    )
    # 在托管白名单内 → 放行
    ok, _ = check_network_domain_allowed("api.corp.example.com", net)
    assert ok is True
    # 不在托管白名单 → 拒绝(即便用户侧原本放行)
    ok, reason = check_network_domain_allowed("random.org", net)
    assert ok is False
    assert "managed_allowed_domains_only" in reason


def test_network_domain_managed_only_empty_allow_fail_closed():
    """managed_only 启用但 allowed_domains 为空 → fail-closed 全部拒绝。"""
    net = NetworkDomainRequirements(managed_allowed_domains_only=True)
    ok, reason = check_network_domain_allowed("x.com", net)
    assert ok is False
    assert "fail-closed" in reason


def test_network_domain_deny_overrides_managed_allow():
    """deny 列表优先于 allow:同域命中 deny → 即便在 allow 里也拒绝。"""
    net = NetworkDomainRequirements(
        allowed_domains=frozenset({"example.com"}),
        denied_domains=frozenset({"bad.example.com"}),
        managed_allowed_domains_only=True,
    )
    ok, _ = check_network_domain_allowed("good.example.com", net)
    assert ok is True
    ok, reason = check_network_domain_allowed("bad.example.com", net)
    assert ok is False
    assert "denied_domains" in reason


def test_network_domain_empty_host_rejected():
    """空 host 一律拒绝(防脏输入绕过)。"""
    net = NetworkDomainRequirements()
    ok, reason = check_network_domain_allowed("", net)
    assert ok is False
    assert "empty host" in reason


# ---------- MarketplaceSourceRequirements ----------
# 取证:codex.exe strings → MarketplaceRequirementsToml
# 字段:restrict_to_allowed_sources / allowed_sources


def test_marketplace_unrestricted_allows_any_source():
    """restrict_to_allowed_sources=False(默认)→ 任何来源放行。"""
    mk = MarketplaceSourceRequirements()
    ok, _ = check_marketplace_source_allowed("random-market", mk)
    assert ok is True


def test_marketplace_restricted_allows_whitelisted():
    """restrict=True + source ∈ allowed → 放行。"""
    mk = MarketplaceSourceRequirements(
        restrict_to_allowed_sources=True,
        allowed_sources=frozenset({"openai-bundled", "corp-internal"}),
    )
    assert check_marketplace_source_allowed("openai-bundled", mk)[0] is True
    assert check_marketplace_source_allowed("corp-internal", mk)[0] is True


def test_marketplace_restricted_rejects_unknown_source():
    """restrict=True + source ∉ allowed → 拒绝。"""
    mk = MarketplaceSourceRequirements(
        restrict_to_allowed_sources=True,
        allowed_sources=frozenset({"openai-bundled"}),
    )
    ok, reason = check_marketplace_source_allowed("random-market", mk)
    assert ok is False
    assert "not in managed allowed_sources" in reason


def test_marketplace_restricted_empty_allow_fail_closed():
    """restrict=True 但 allowed_sources 为空 → fail-closed 全部拒绝。"""
    mk = MarketplaceSourceRequirements(restrict_to_allowed_sources=True)
    ok, reason = check_marketplace_source_allowed("openai-bundled", mk)
    assert ok is False
    assert "fail-closed" in reason


def test_marketplace_empty_source_rejected_when_restricted():
    """restrict=True + 空 source → 拒绝(防脏输入绕过)。"""
    mk = MarketplaceSourceRequirements(
        restrict_to_allowed_sources=True,
        allowed_sources=frozenset({"openai-bundled"}),
    )
    ok, reason = check_marketplace_source_allowed("", mk)
    assert ok is False
    assert "empty marketplace source" in reason


# ---------- FilesystemDenyReadRequirements ----------
# 取证:codex.exe strings → RawFilesystemRequirementsToml
# 字段:deny_read / managed_deny_all(错误串 "all managed deny_read restrictions")
# 默认敏感路径:~/.ssh / ~/.aws/credentials / ~/.gnupg / id_rsa 等


def test_filesystem_default_sensitive_paths_denied():
    """默认内置敏感路径(.ssh/.aws/.gnupg)一律拒绝。"""
    req = FilesystemDenyReadRequirements()
    for path in (
        "/Users/x/.ssh/id_rsa",
        "/root/.ssh/config",
        "/Users/x/.aws/credentials",
        "/Users/x/.aws/config",
        "/home/u/.gnupg/secring.gpg",
        "/Users/x/.netrc",
    ):
        ok, _ = check_path_deny_read_allowed(path, req)
        assert ok is False, f"expected deny for {path}"


def test_filesystem_normal_paths_allowed():
    """非敏感路径放行(默认门控只拦凭据类)。"""
    req = FilesystemDenyReadRequirements()
    for path in (
        "/Users/x/project/src/main.py",
        "/tmp/workspace/file.txt",
        "/Users/x/.aws/other.txt",  # .aws 下非 credentials/config 文件
    ):
        ok, reason = check_path_deny_read_allowed(path, req)
        assert ok is True, f"expected allow for {path}, got: {reason}"


def test_filesystem_tilde_glob_expands_to_any_home():
    """内置 glob 的 ``~/`` 前缀展开为任意 home 路径(跨用户/系统可匹配)。"""
    req = FilesystemDenyReadRequirements()
    # 不同 home 前缀都能命中 .ssh 保护
    for home in ("/Users/alice", "/home/bob", "/root"):
        ok, _ = check_path_deny_read_allowed(f"{home}/.ssh/id_rsa", req)
        assert ok is False, f"expected deny for {home}/.ssh/id_rsa"


def test_filesystem_custom_deny_read_without_defaults():
    """use_defaults=False 时只信托管自定义 deny_read,内置默认关闭。"""
    req = FilesystemDenyReadRequirements(
        deny_read=("**/secret/**",),
        use_defaults=False,
    )
    # 自定义规则命中
    ok, reason = check_path_deny_read_allowed("/a/b/secret/key.txt", req)
    assert ok is False
    assert "**/secret/**" in reason
    # 内置默认已关闭(.ssh 应放行)
    ok, _ = check_path_deny_read_allowed("/Users/x/.ssh/id_rsa", req)
    assert ok is True


def test_filesystem_managed_deny_all_fail_closed():
    """managed_deny_all=True ⇒ 任何路径拒绝(fail-closed 极端模式)。"""
    req = FilesystemDenyReadRequirements(managed_deny_all=True)
    for path in ("/tmp/a.txt", "/Users/x/project/main.py", "/"):
        ok, reason = check_path_deny_read_allowed(path, req)
        assert ok is False
        assert "managed_deny_all" in reason


def test_filesystem_empty_path_rejected():
    """空 path 一律拒绝(防脏输入绕过)。"""
    req = FilesystemDenyReadRequirements()
    ok, reason = check_path_deny_read_allowed("", req)
    assert ok is False
    assert "empty path" in reason


def test_filesystem_double_star_glob_spans_directories():
    """``**`` 跨目录段匹配(对齐 codex deny_read glob 语义)。"""
    req = FilesystemDenyReadRequirements(
        deny_read=("**/secrets/**",),
        use_defaults=False,
    )
    # 多层目录下的 secrets 均命中
    assert check_path_deny_read_allowed("/a/secrets/x.txt", req)[0] is False
    assert check_path_deny_read_allowed("/a/b/c/secrets/deep/key", req)[0] is False
    # 根级 secrets 也命中(**/ 可匹配零层)
    assert check_path_deny_read_allowed("/secrets/x.txt", req)[0] is False
    # 不相关路径放行
    assert check_path_deny_read_allowed("/a/public/x.txt", req)[0] is True


def test_filesystem_single_star_does_not_span_slash():
    """``*`` 单段不跨 ``/``(与 ``**`` 语义区分)。

    ``*.pem`` 只匹配无目录前缀的裸文件名 ``server.pem``,
    不匹配子目录内的 ``certs/server.pem``(用 ``**/*.pem`` 才能跨目录)。
    """
    req = FilesystemDenyReadRequirements(
        deny_read=("**/*.pem",),
        use_defaults=False,
    )
    # **/*.pem 跨目录段:根级 + 子目录都命中
    assert check_path_deny_read_allowed("/server.pem", req)[0] is False
    assert check_path_deny_read_allowed("/certs/server.pem", req)[0] is False
    assert check_path_deny_read_allowed("/a/b/c/server.pem", req)[0] is False

    # 只用 *.pem(无 ** 前缀):只匹配无目录前缀的裸文件名
    req2 = FilesystemDenyReadRequirements(
        deny_read=("*.pem",),
        use_defaults=False,
    )
    assert check_path_deny_read_allowed("server.pem", req2)[0] is False
    # 有目录前缀不命中(* 不跨 /)
    ok, _ = check_path_deny_read_allowed("/certs/server.pem", req2)
    assert ok is True


# ---------- WindowsSandboxRequirements ----------
# 取证:codex.exe strings → WindowsRequirementsToml(3 字段)
# 错误串:"windows.sandbox = 'mxc' is not allowed when windows.allow_mxc = false"


def test_windows_sandbox_default_allows_any_valid():
    """默认(无约束)四档全部放行。"""
    req = WindowsSandboxRequirements()
    for sel in ("mxc", "elevated", "restricted_token", "disabled"):
        ok, _ = check_windows_sandbox_selection_allowed(sel, req)
        assert ok is True, f"expected allow for {sel}"


def test_windows_sandbox_invalid_implementation_rejected():
    """非法取值一律拒绝(不在四档内)。"""
    req = WindowsSandboxRequirements()
    for sel in ("foo", "", "MXC", "Elevated"):
        ok, reason = check_windows_sandbox_selection_allowed(sel, req)
        assert ok is False, f"expected deny for {sel!r}"
        assert "invalid windows sandbox" in reason


def test_windows_sandbox_allow_mxc_false_blocks_mxc():
    """allow_mxc=False 且请求 mxc ⇒ 拒绝(对齐 codex 错误串)。"""
    req = WindowsSandboxRequirements(allow_mxc=False)
    ok, reason = check_windows_sandbox_selection_allowed("mxc", req)
    assert ok is False
    assert "allow_mxc = false" in reason
    # 非 mxc 仍放行
    assert check_windows_sandbox_selection_allowed("elevated", req)[0] is True


def test_windows_sandbox_require_mxc_enforces_mxc_only():
    """require_mxc=True ⇒ 只允许 mxc,其余一律拒绝(强制模式)。"""
    req = WindowsSandboxRequirements(require_mxc=True)
    assert check_windows_sandbox_selection_allowed("mxc", req)[0] is True
    ok, reason = check_windows_sandbox_selection_allowed("elevated", req)
    assert ok is False
    assert "require_mxc" in reason
    ok, reason = check_windows_sandbox_selection_allowed("restricted_token", req)
    assert ok is False
    assert "require_mxc" in reason


def test_windows_sandbox_whitelist_rejects_unknown():
    """allowed_sandbox_implementations 非空且请求不在集合 ⇒ 拒绝。"""
    req = WindowsSandboxRequirements(
        allowed_sandbox_implementations=frozenset({"mxc", "elevated"})
    )
    assert check_windows_sandbox_selection_allowed("mxc", req)[0] is True
    assert check_windows_sandbox_selection_allowed("elevated", req)[0] is True
    ok, reason = check_windows_sandbox_selection_allowed("restricted_token", req)
    assert ok is False
    assert "allowed_sandbox_implementations" in reason


def test_windows_sandbox_whitelist_empty_allows_any():
    """allowed_sandbox_implementations 为空集(默认)⇒ 不限制。"""
    req = WindowsSandboxRequirements()
    for sel in ("mxc", "elevated", "restricted_token", "disabled"):
        ok, _ = check_windows_sandbox_selection_allowed(sel, req)
        assert ok is True


def test_windows_sandbox_require_mxc_overrides_whitelist():
    """require_mxc=True 但白名单含非 mxc ⇒ require_mxc 优先拒绝(强约束优先)。"""
    req = WindowsSandboxRequirements(
        require_mxc=True,
        allowed_sandbox_implementations=frozenset({"mxc", "elevated"}),
    )
    assert check_windows_sandbox_selection_allowed("mxc", req)[0] is True
    ok, reason = check_windows_sandbox_selection_allowed("elevated", req)
    assert ok is False
    assert "require_mxc" in reason


# ---------- BrowserUseRequirements ----------
# 取证:codex.exe strings → BrowserUseRequirementsToml(7 字段)


def test_browser_origin_default_deny_blocks_unknown():
    """default_origin_policy=deny(默认)且 origin ∉ origins ⇒ 拒绝。"""
    req = BrowserUseRequirements()
    ok, reason = check_browser_origin_allowed("https://unknown.com", req)
    assert ok is False
    assert "default_origin_policy=deny" in reason


def test_browser_origin_whitelist_hit():
    """origin ∈ origins ⇒ 放行(白名单优先于 default)。"""
    req = BrowserUseRequirements(
        origins=frozenset({"https://corp.example.com", "https://intranet.local"})
    )
    assert check_browser_origin_allowed("https://corp.example.com", req)[0] is True
    assert check_browser_origin_allowed("https://intranet.local", req)[0] is True


def test_browser_origin_default_allow():
    """default_origin_policy=allow 且 origin ∉ origins ⇒ 放行。"""
    req = BrowserUseRequirements(
        default_origin_policy="allow",
        origins=frozenset({"https://corp.example.com"}),
    )
    assert check_browser_origin_allowed("https://any.com", req)[0] is True
    assert check_browser_origin_allowed("https://corp.example.com", req)[0] is True


def test_browser_origin_invalid_default_policy_fail_closed():
    """非法 default_origin_policy ⇒ fail-closed 拒绝。"""
    req = BrowserUseRequirements(default_origin_policy="weird")
    ok, reason = check_browser_origin_allowed("https://x.com", req)
    assert ok is False
    assert "invalid default_origin_policy" in reason


def test_browser_origin_empty_rejected():
    """空 origin 一律拒绝(防脏输入绕过)。"""
    req = BrowserUseRequirements()
    ok, reason = check_browser_origin_allowed("", req)
    assert ok is False
    assert "empty origin" in reason


def test_browser_history_access_denied_by_default():
    """allow_history_access=False(默认)⇒ 历史访问拒绝(隐私保护)。"""
    req = BrowserUseRequirements()
    ok, reason = req.check_history_access()
    assert ok is False
    assert "allow_history_access is false" in reason


def test_browser_history_access_allowed_when_enabled():
    """allow_history_access=True ⇒ 历史访问放行。"""
    req = BrowserUseRequirements(allow_history_access=True)
    ok, _ = req.check_history_access()
    assert ok is True


# ---------- ComputerUseRequirements ----------
# 取证:codex.exe strings → ComputerUseRequirementsToml(5 字段)


def test_computer_use_locked_denied_by_default():
    """allow_locked_computer_use=False(默认)⇒ 锁定电脑控制拒绝(极高风险)。"""
    req = ComputerUseRequirements()
    ok, reason = req.check_locked_computer_use()
    assert ok is False
    assert "allow_locked_computer_use is false" in reason


def test_computer_use_locked_allowed_when_enabled():
    """allow_locked_computer_use=True ⇒ 锁定电脑控制放行。"""
    req = ComputerUseRequirements(allow_locked_computer_use=True)
    ok, _ = req.check_locked_computer_use()
    assert ok is True


def test_computer_use_macos_whitelist_hit():
    """macos platform + bundle_id ∈ macos_bundle_ids ⇒ 放行。"""
    req = ComputerUseRequirements(
        macos_bundle_ids=frozenset({"com.apple.finder", "com.apple.safari"})
    )
    ok, _ = check_computer_use_app_allowed("com.apple.finder", "macos", req)
    assert ok is True
    ok, _ = check_computer_use_app_allowed("com.apple.safari", "macos", req)
    assert ok is True


def test_computer_use_windows_aumid_and_exe_hit():
    """windows platform + aumid 或 exe ∈ 白名单 ⇒ 放行。"""
    req = ComputerUseRequirements(
        windows_aumids=frozenset({"Microsoft.Calculator_8wekyb3d8bbwe!App"}),
        windows_exes=frozenset({"C:/Program Files/app.exe"}),
    )
    ok, _ = check_computer_use_app_allowed(
        "Microsoft.Calculator_8wekyb3d8bbwe!App", "windows", req
    )
    assert ok is True
    ok, _ = check_computer_use_app_allowed("C:/Program Files/app.exe", "windows", req)
    assert ok is True


def test_computer_use_default_deny_blocks_unknown():
    """default_app_access=deny(默认)且 app 不在白名单 ⇒ 拒绝。"""
    req = ComputerUseRequirements(
        macos_bundle_ids=frozenset({"com.apple.finder"})
    )
    ok, reason = check_computer_use_app_allowed("unknown.app", "macos", req)
    assert ok is False
    assert "default_app_access=deny" in reason


def test_computer_use_unsupported_platform_fail_closed():
    """非 macos/windows 平台 ⇒ fail-closed 拒绝。"""
    req = ComputerUseRequirements()
    for platform in ("linux", "", "Android", "windows10"):
        ok, reason = check_computer_use_app_allowed("x", platform, req)
        assert ok is False, f"expected deny for platform {platform!r}"
        assert "unsupported platform" in reason


def test_computer_use_empty_app_id_rejected():
    """空 app_id 一律拒绝(防脏输入绕过)。"""
    req = ComputerUseRequirements()
    ok, reason = check_computer_use_app_allowed("", "macos", req)
    assert ok is False
    assert "empty app_id" in reason


# ---------- ManagedModelRequirements ----------
# 取证:codex.exe strings → ModelsRequirementsToml
# 错误串:"disallowed by requirements; falling back to required default"


def test_managed_model_in_allowlist_passthrough():
    """模型 ∈ allowed_models ⇒ 原样放行(无降级)。"""
    req = ManagedModelRequirements(
        allowed_models=frozenset({"gpt-5", "o4-mini"}),
        required_default="gpt-5-safe",
    )
    effective, reason = resolve_model_allowed("gpt-5", req)
    assert effective == "gpt-5"
    assert reason is None


def test_managed_model_soft_downgrade_to_required_default():
    """模型 ∉ allowlist 且 required_default 非空 ⇒ 软降级(对齐 codex 错误串)。"""
    req = ManagedModelRequirements(
        allowed_models=frozenset({"gpt-5"}),
        required_default="gpt-5-safe",
    )
    effective, reason = resolve_model_allowed("gpt-4o", req)
    assert effective == "gpt-5-safe"
    assert "disallowed by requirements" in reason
    assert "falling back to required default" in reason


def test_managed_model_fail_closed_without_default():
    """模型 ∉ allowlist 且 required_default 为空 ⇒ 硬拒绝(fail-closed)。"""
    req = ManagedModelRequirements(allowed_models=frozenset({"gpt-5"}))
    effective, reason = resolve_model_allowed("gpt-4o", req)
    assert effective is None
    assert "no required_default configured" in reason


def test_managed_model_empty_slug_falls_back():
    """空模型 slug + required_default 非空 ⇒ 软降级。"""
    req = ManagedModelRequirements(required_default="gpt-5-safe")
    effective, reason = resolve_model_allowed("", req)
    assert effective == "gpt-5-safe"
    assert "empty model slug" in reason


def test_managed_model_empty_slug_no_default_fail_closed():
    """空模型 slug + required_default 为空 ⇒ 硬拒绝。"""
    req = ManagedModelRequirements()
    effective, reason = resolve_model_allowed("", req)
    assert effective is None
    assert "empty model slug" in reason


def test_managed_model_auto_review_required():
    """required_on_models 强制开启 auto-review 的模型集合判定。"""
    req = ManagedModelRequirements(required_on_models=frozenset({"gpt-5"}))
    assert req.is_auto_review_required("gpt-5") is True
    assert req.is_auto_review_required("o4-mini") is False


def test_managed_model_unrestricted_when_allowlist_empty():
    """allowed_models 为空集 ⇒ 不限制(向后兼容单机场景)。"""
    req = ManagedModelRequirements()
    for model in ("gpt-4o", "gpt-5", "o4-mini", "anything"):
        effective, reason = resolve_model_allowed(model, req)
        assert effective == model
        assert reason is None


# ---------- LoginWorkspaceRequirements ----------
# 取证:codex.exe strings → forced_login_method / forced_chatgpt_workspace_id


def test_login_method_forced_overrides_user_choice():
    """forced_login_method 非空 ⇒ 覆盖用户选择(治理面)。"""
    req = LoginWorkspaceRequirements(forced_login_method="chatgpt")
    effective, reason = check_forced_login_method("api_key", req)
    assert effective == "chatgpt"
    assert "overridden by" in reason
    assert "forced_login_method" in reason


def test_login_method_forced_match_passthrough():
    """用户请求等于 forced_login_method ⇒ 原样放行(无 reason)。"""
    req = LoginWorkspaceRequirements(forced_login_method="chatgpt")
    effective, reason = check_forced_login_method("chatgpt", req)
    assert effective == "chatgpt"
    assert reason is None


def test_login_method_allowlist_hit():
    """无 forced + allowed_login_methods 命中 ⇒ 放行。"""
    req = LoginWorkspaceRequirements(
        allowed_login_methods=frozenset({"chatgpt", "api_key"})
    )
    effective, reason = check_forced_login_method("chatgpt", req)
    assert effective == "chatgpt"
    assert reason is None


def test_login_method_allowlist_miss_fail_closed():
    """无 forced + allowed_login_methods 未命中 ⇒ 拒绝。"""
    req = LoginWorkspaceRequirements(allowed_login_methods=frozenset({"chatgpt"}))
    effective, reason = check_forced_login_method("api_key", req)
    assert effective is None
    assert "not in managed allowed_login_methods" in reason


def test_login_method_unrestricted():
    """无 forced + 白名单空 ⇒ 不限制。"""
    req = LoginWorkspaceRequirements()
    effective, reason = check_forced_login_method("api_key", req)
    assert effective == "api_key"
    assert reason is None


def test_workspace_forced_overrides_user_choice():
    """forced_chatgpt_workspace_id 非空 ⇒ 覆盖用户工作区。"""
    req = LoginWorkspaceRequirements(forced_chatgpt_workspace_id="ws_enterprise")
    effective, reason = check_forced_chatgpt_workspace("ws_personal", req)
    assert effective == "ws_enterprise"
    assert "forced_chatgpt_workspace_id" in reason


def test_workspace_forced_match_passthrough():
    """用户请求等于 forced workspace ⇒ 原样放行。"""
    req = LoginWorkspaceRequirements(forced_chatgpt_workspace_id="ws_enterprise")
    effective, reason = check_forced_chatgpt_workspace("ws_enterprise", req)
    assert effective == "ws_enterprise"
    assert reason is None


def test_workspace_allowlist_hit_and_miss():
    """无 forced + allowed_chatgpt_workspaces 白名单命中/未命中。"""
    req = LoginWorkspaceRequirements(
        allowed_chatgpt_workspaces=frozenset({"ws_enterprise"})
    )
    effective, reason = check_forced_chatgpt_workspace("ws_enterprise", req)
    assert effective == "ws_enterprise"
    assert reason is None

    effective, reason = check_forced_chatgpt_workspace("ws_personal", req)
    assert effective is None
    assert "not in managed allowed_chatgpt_workspaces" in reason
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
