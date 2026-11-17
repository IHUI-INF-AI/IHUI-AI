# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Field arrays are Rust fat pointers: `&'static str` is (ptr, len), 16 bytes wide.

Why this module exists: serde's `FIELDS` is `&'static [&'static str]`, so on this binary it
is a *contiguous array of 16-byte (ptr,len) records*, not an 8-byte pointer table. Scanning
.rdata at 8-byte alignment therefore finds 15,234 record runs, and every one of R65's 44
attributed structs is reproduced **exactly** (44/44) by an arity-sized run — that is the
attestation this module rests on.

Recovered here: `ConfigRequirementsToml` (arity 46). Its array at 0x151cc6138 holds 48
records; the first 46 are the struct, the trailing two (`guardian_policy_config`,
`guardian_extra_policy`) are a neighbouring 2-field table — the same pair also closes a
32-field array at 0x151cc6e48, which is why arity decides the split.

Still not recoverable this way: `ThreadStartParams` (27) and `TurnStartParams` (28) have no
arity-sized array at all (the only 27/28-record runs are an agent-op list and ordinal
words), so they stay on the R67 frontier.

::

    fields = CONFIG_REQUIREMENTS_TOML_FIELDS
    assert len(fields) == 46 and fields[0] == "config_server"
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

CONFIG_REQUIREMENTS_TOML_FIELDS: Final[tuple[str, ...]] = (
    'config_server',
    'allowed_login_methods',
    'allowed_chatgpt_workspaces',
    'cli_auth_credentials_store',
    'chatgpt_base_url',
    'sqlite_home',
    'unsafe_enforce_sqlite_journal_mode',
    'log_dir',
    'model_catalog_json',
    'model_provider',
    'model_providers',
    'check_for_update_on_startup',
    'allow_login_shell',
    'feedback',
    'allowed_approval_policies',
    'allowed_approvals_reviewers',
    'allowed_sandbox_modes',
    'allowed_permission_profiles',
    'default_permissions',
    'remote_sandbox_config',
    'allowed_web_search_modes',
    'allow_managed_hooks_only',
    'allow_browser_and_computer_use',
    'allow_appshots',
    'allow_remote_control',
    'computer_use',
    'browser_use',
    'in_app_browser',
    'windows',
    'feature_requirements',
    'features',
    'hooks',
    'mcp_servers',
    'plugins',
    'marketplaces',
    'otel',
    'apps',
    'rules',
    'enforce_residency',
    'experimental_network',
    'network_proxy',
    'application',
    'permissions',
    'auto_review',
    'models',
    'additional_developer_instructions',
)


CONFIG_REQUIREMENTS_TOML_ARITY: Final[int] = 46
CONFIG_REQUIREMENTS_TOML_ARRAY: Final[str] = '0x151cc6138'
CONFIG_REQUIREMENTS_TOML_ARRAY_LEN: Final[int] = 48

#: The two records that the array holds beyond the struct's arity, plus the 32-field array
#: that closes with the same pair — the evidence that they belong to a neighbour.
NEIGHBOUR_TAIL_FIELDS: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType({
    "guardian_pair": ("guardian_policy_config", "guardian_extra_policy"),
    "other_array": '0x151cc6e48',
    "other_array_len": 34,
})

FAT_POINTER_STRIDE: Final[int] = 16
RECORD_RUNS_SCANNED: Final[int] = 15234
TRUTH_EXACT_REPRODUCED: Final[int] = 44
TRUTH_TOTAL: Final[int] = 44


class FatPointerContractError(Exception):

    """Raised when the recovered array no longer matches the recorded evidence."""


def config_requirements_toml_fields() -> tuple[str, ...]:

    """The struct's 46 field names, in declaration order."""

    return CONFIG_REQUIREMENTS_TOML_FIELDS


def excluded_array_entries() -> tuple[str, ...]:

    """Array records that arity says are *not* this struct's fields."""

    return NEIGHBOUR_TAIL_FIELDS["guardian_pair"]


def validate_fat_pointer_contract(arity: Mapping[str, int] | None = None) -> None:

    """Self-check the recovered list against the recorded evidence and the arity catalogue.

    Raises FatPointerContractError on any divergence: count, order endpoints, neighbour
    leakage, duplicate names, or an arity that no longer matches (46).
    """

    fields = CONFIG_REQUIREMENTS_TOML_FIELDS
    if len(fields) != CONFIG_REQUIREMENTS_TOML_ARITY:
        raise FatPointerContractError(
            f"ConfigRequirementsToml: {len(fields)} fields, arity {CONFIG_REQUIREMENTS_TOML_ARITY}")
    if fields[0] != "config_server":
        raise FatPointerContractError("first field drifted away from config_server")
    if fields[-1] != "additional_developer_instructions":
        raise FatPointerContractError("last field drifted away from additional_developer_instructions")
    leaked = [name for name in excluded_array_entries() if name in fields]
    if leaked:
        raise FatPointerContractError(f"neighbour fields leaked into the struct: {leaked}")
    if len(set(fields)) != len(fields):
        raise FatPointerContractError("duplicate field names in the recovered list")
    if arity is not None:
        got = arity.get("ConfigRequirementsToml")
        if got != CONFIG_REQUIREMENTS_TOML_ARITY:
            raise FatPointerContractError(f"arity catalogue says {got}, contract says 46")


def ensure_fat_pointer_contract(arity: Mapping[str, int] | None = None) -> None:

    """Assert-style wrapper for risk paths."""

    validate_fat_pointer_contract(arity)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
