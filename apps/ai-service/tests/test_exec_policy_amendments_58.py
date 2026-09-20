# -*- coding: utf-8 -*-
"""test_exec_policy_amendments_58.py — 对标 codex-rs execpolicy/src/amend.rs 的测试移植。

通过 importlib 直接按文件路径加载被测模块（--noconftest 下不依赖包/配置）。
覆盖 amend.rs 末尾 `mod tests` 的 6 个 Rust 单测 + 额外的禁用前缀/host 归一/幂等/
空 prefix/justification 空/水印校验用例（目标 ≥ 26 项全绿）。
"""

from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path

import pytest

CORE_DIR = Path(__file__).resolve().parents[1] / "app" / "core"
MODULE_PATH = CORE_DIR / "exec_policy_amendments.py"
RB_PATH = CORE_DIR / "rollout_budget.py"

_spec = importlib.util.spec_from_file_location("exec_policy_amendments", MODULE_PATH)
amend = importlib.util.module_from_spec(_spec)
assert _spec is not None and _spec.loader is not None
_spec.loader.exec_module(amend)


# ===========================================================================
# 移植 amend.rs:201 appends_rule_and_creates_directories
# ===========================================================================
def test_appends_rule_and_creates_directories(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    amend.append_allow_prefix_rule(policy_path, ["echo", "Hello, world!"])
    contents = policy_path.read_text(encoding="utf-8")
    assert (
        contents
        == 'prefix_rule(pattern=["echo", "Hello, world!"], decision="allow")\n'
    )


# ===========================================================================
# 移植 amend.rs:220 appends_rule_without_duplicate_newline
# ===========================================================================
def test_appends_rule_without_duplicate_newline(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    policy_path.parent.mkdir(parents=True, exist_ok=True)
    policy_path.write_text(
        'prefix_rule(pattern=["ls"], decision="allow")\n', encoding="utf-8"
    )
    amend.append_allow_prefix_rule(policy_path, ["echo", "Hello, world!"])
    contents = policy_path.read_text(encoding="utf-8")
    assert (
        contents
        == 'prefix_rule(pattern=["ls"], decision="allow")\n'
        'prefix_rule(pattern=["echo", "Hello, world!"], decision="allow")\n'
    )
    assert contents.count("\n") == 2


# ===========================================================================
# 移植 amend.rs:247 inserts_newline_when_missing_before_append
# ===========================================================================
def test_inserts_newline_when_missing_before_append(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    policy_path.parent.mkdir(parents=True, exist_ok=True)
    policy_path.write_text(
        'prefix_rule(pattern=["ls"], decision="allow")', encoding="utf-8"
    )
    amend.append_allow_prefix_rule(policy_path, ["echo", "Hello, world!"])
    contents = policy_path.read_text(encoding="utf-8")
    assert (
        contents
        == 'prefix_rule(pattern=["ls"], decision="allow")\n'
        'prefix_rule(pattern=["echo", "Hello, world!"], decision="allow")\n'
    )
    assert contents.count("\n") == 2


# ===========================================================================
# 移植 amend.rs:273 appends_network_rule
# ===========================================================================
def test_appends_network_rule(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    amend.append_network_rule(
        policy_path,
        "Api.GitHub.com",
        amend.NetworkRuleProtocol.HTTPS,
        "allow",
        justification="Allow https_connect access to api.github.com",
    )
    contents = policy_path.read_text(encoding="utf-8")
    assert (
        contents
        == 'network_rule(host="api.github.com", protocol="https", decision="allow", '
        'justification="Allow https_connect access to api.github.com")\n'
    )


# ===========================================================================
# 移植 amend.rs:295 appends_prefix_and_network_rules
# ===========================================================================
def test_appends_prefix_and_network_rules(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    amend.append_allow_prefix_rule(policy_path, ["curl"])
    amend.append_network_rule(
        policy_path,
        "api.github.com",
        amend.NetworkRuleProtocol.HTTPS,
        "allow",
        justification="Allow https_connect access to api.github.com",
    )
    contents = policy_path.read_text(encoding="utf-8")
    assert (
        contents
        == 'prefix_rule(pattern=["curl"], decision="allow")\n'
        'network_rule(host="api.github.com", protocol="https", decision="allow", '
        'justification="Allow https_connect access to api.github.com")\n'
    )


# ===========================================================================
# 移植 amend.rs:320 rejects_wildcard_network_rule_host
# ===========================================================================
def test_rejects_wildcard_network_rule_host(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    with pytest.raises(amend.InvalidNetworkRuleError) as excinfo:
        amend.append_network_rule(
            policy_path,
            "*.example.com",
            amend.NetworkRuleProtocol.HTTPS,
            "allow",
            justification=None,
        )
    assert excinfo.value is not None
    assert str(excinfo.value) == (
        "invalid network rule: invalid rule: network_rule host must be a specific host; "
        "wildcards are not allowed"
    )


# ===========================================================================
# 禁用前缀判定（is_banned_prefix_suggestion）— 精确匹配（长度相等且逐元素相等）
# ===========================================================================
def test_banned_prefix_bash_lc() -> None:
    assert amend.is_banned_prefix_suggestion(["bash", "-lc"]) is True


def test_banned_prefix_cmd_exe_c() -> None:
    assert amend.is_banned_prefix_suggestion(["cmd.exe", "/c"]) is True


def test_banned_prefix_powershell_encoded() -> None:
    assert amend.is_banned_prefix_suggestion(["powershell", "-EncodedCommand"]) is True


def test_banned_prefix_npm_run_dev_false() -> None:
    # ("npm","run","dev") 长度 3，但 BANNED 仅有 ("npm","run")，故不命中
    assert amend.is_banned_prefix_suggestion(["npm", "run", "dev"]) is False


def test_banned_prefix_bash_exact_true() -> None:
    # ("bash",) 在 exec_policy.rs:68 是显式禁用项，精确匹配应为 True。
    # 注：任务书曾写 ("bash",) 期望 False，但与源数据矛盾，此处按源忠实实现。
    assert amend.is_banned_prefix_suggestion(["bash"]) is True


def test_banned_prefix_git_status_false() -> None:
    # ("git","status") 长度 2，BANNED 仅有 ("git",)，故不命中
    assert amend.is_banned_prefix_suggestion(["git", "status"]) is False


def test_banned_prefix_empty_false() -> None:
    assert amend.is_banned_prefix_suggestion([]) is False


# ===========================================================================
# 幂等：同一 rule 追加两次，文件仍只有一行
# ===========================================================================
def test_idempotent_allow_prefix(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    amend.append_allow_prefix_rule(policy_path, ["echo", "hi"])
    amend.append_allow_prefix_rule(policy_path, ["echo", "hi"])
    lines = [
        ln for ln in policy_path.read_text(encoding="utf-8").splitlines() if ln != ""
    ]
    assert lines == ['prefix_rule(pattern=["echo", "hi"], decision="allow")']
    assert len(lines) == 1


def test_idempotent_network_rule(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    amend.append_network_rule(
        policy_path, "api.github.com", amend.NetworkRuleProtocol.HTTPS, "allow"
    )
    amend.append_network_rule(
        policy_path, "api.github.com", amend.NetworkRuleProtocol.HTTPS, "allow"
    )
    lines = [
        ln for ln in policy_path.read_text(encoding="utf-8").splitlines() if ln != ""
    ]
    assert len(lines) == 1


# ===========================================================================
# 空 prefix -> EmptyPrefixError
# ===========================================================================
def test_empty_prefix_format_raises() -> None:
    with pytest.raises(amend.EmptyPrefixError) as excinfo:
        amend.format_allow_prefix_rule([])
    assert str(excinfo.value) == "prefix rule requires at least one token"


def test_empty_prefix_append_raises(tmp_path: Path) -> None:
    policy_path = tmp_path / "rules" / "default.rules"
    with pytest.raises(amend.EmptyPrefixError):
        amend.append_allow_prefix_rule(policy_path, [])


# ===========================================================================
# normalize_network_rule_host 归一与异常
# ===========================================================================
def test_normalize_trim_and_lowercase() -> None:
    assert amend.normalize_network_rule_host("  API.GitHub.com.  ") == "api.github.com"


def test_normalize_ipv6_bracket_port() -> None:
    assert amend.normalize_network_rule_host("[::1]:8080") == "::1"


def test_normalize_host_port_stripped() -> None:
    assert amend.normalize_network_rule_host("Example.COM:443") == "example.com"


def test_normalize_scheme_raises() -> None:
    with pytest.raises(amend._NetworkRuleError):
        amend.normalize_network_rule_host("https://x.com")


def test_normalize_path_raises() -> None:
    with pytest.raises(amend._NetworkRuleError):
        amend.normalize_network_rule_host("a.com/path")


def test_normalize_empty_raises() -> None:
    with pytest.raises(amend._NetworkRuleError):
        amend.normalize_network_rule_host("")


def test_normalize_wildcard_raises() -> None:
    with pytest.raises(amend._NetworkRuleError):
        amend.normalize_network_rule_host("*.example.com")


def test_normalize_invalid_ipv6_bracket() -> None:
    with pytest.raises(amend._NetworkRuleError):
        amend.normalize_network_rule_host("[::1")


# ===========================================================================
# format_network_rule 输出与 justification 校验
# ===========================================================================
def test_format_network_rule_output() -> None:
    out = amend.format_network_rule(
        "Api.GitHub.com",
        amend.NetworkRuleProtocol.HTTPS,
        "allow",
        justification="Allow https_connect access to api.github.com",
    )
    assert out == (
        'network_rule(host="api.github.com", protocol="https", decision="allow", '
        'justification="Allow https_connect access to api.github.com")'
    )


def test_format_network_rule_omits_justification_when_none() -> None:
    out = amend.format_network_rule(
        "api.github.com", amend.NetworkRuleProtocol.HTTPS, "allow"
    )
    assert out == 'network_rule(host="api.github.com", protocol="https", decision="allow")'
    assert "justification" not in out


def test_format_network_rule_forbidden_maps_to_deny() -> None:
    out = amend.format_network_rule(
        "api.github.com", amend.NetworkRuleProtocol.HTTP, "forbidden"
    )
    assert out == 'network_rule(host="api.github.com", protocol="http", decision="deny")'


def test_format_network_rule_empty_justification_raises() -> None:
    with pytest.raises(amend.InvalidNetworkRuleError) as excinfo:
        amend.format_network_rule(
            "api.github.com", amend.NetworkRuleProtocol.HTTPS, "allow", justification=""
        )
    assert str(excinfo.value) == "invalid network rule: justification cannot be empty"


def test_format_network_rule_whitespace_justification_raises() -> None:
    with pytest.raises(amend.InvalidNetworkRuleError):
        amend.format_network_rule(
            "api.github.com",
            amend.NetworkRuleProtocol.HTTPS,
            "allow",
            justification="   ",
        )


# ===========================================================================
# NetworkRuleProtocol.as_policy_string
# ===========================================================================
def test_protocol_as_policy_string() -> None:
    assert amend.NetworkRuleProtocol.HTTP.as_policy_string() == "http"
    assert amend.NetworkRuleProtocol.HTTPS.as_policy_string() == "https"
    assert amend.NetworkRuleProtocol.SOCKS5_TCP.as_policy_string() == "socks5_tcp"
    assert amend.NetworkRuleProtocol.SOCKS5_UDP.as_policy_string() == "socks5_udp"


# ===========================================================================
# 水印头 md5 与 rollout_budget.py 前 3 行一致
# ===========================================================================
def test_watermark_md5_matches_rollout_budget() -> None:
    def head3_md5(p: Path) -> str:
        lines = p.read_text(encoding="utf-8").splitlines(keepends=True)[:3]
        return hashlib.md5("".join(lines).encode("utf-8")).hexdigest()

    assert head3_md5(MODULE_PATH) == head3_md5(RB_PATH)
    assert head3_md5(MODULE_PATH) == "f7421cf7680c54ba9dc3a2d054f7fd98"


def test_file_is_lf_no_bom() -> None:
    raw = MODULE_PATH.read_bytes()
    assert raw[:3] != b"\xef\xbb\xbf"  # 无 BOM
    assert b"\r\n" not in raw  # 全 LF
