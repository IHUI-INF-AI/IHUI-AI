# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R68 contract test: field arrays are fat-pointer record runs."""

from __future__ import annotations

import pytest

from app.core.struct_fields_fat_pointer import (
    CONFIG_REQUIREMENTS_TOML_ARITY,
    CONFIG_REQUIREMENTS_TOML_ARRAY_LEN,
    CONFIG_REQUIREMENTS_TOML_FIELDS,
    FAT_POINTER_STRIDE,
    TRUTH_EXACT_REPRODUCED,
    FatPointerContractError,
    config_requirements_toml_fields,
    ensure_fat_pointer_contract,
    excluded_array_entries,
    validate_fat_pointer_contract,
)


def test_arity_and_array_size_are_distinct() -> None:
    assert CONFIG_REQUIREMENTS_TOML_ARITY == 46
    assert CONFIG_REQUIREMENTS_TOML_ARRAY_LEN == 48
    assert len(CONFIG_REQUIREMENTS_TOML_FIELDS) == 46
    assert CONFIG_REQUIREMENTS_TOML_ARRAY_LEN - len(CONFIG_REQUIREMENTS_TOML_FIELDS) == 2


def test_field_order_endpoints_are_pinned() -> None:
    fields = config_requirements_toml_fields()
    assert fields[0] == "config_server"
    assert fields[1] == "allowed_login_methods"
    assert fields[2] == "allowed_chatgpt_workspaces"
    assert fields[-1] == "additional_developer_instructions"
    assert fields[-2] == "models"


def test_neighbour_pair_is_excluded() -> None:
    excluded = excluded_array_entries()
    assert excluded == ("guardian_policy_config", "guardian_extra_policy")
    for name in excluded:
        assert name not in CONFIG_REQUIREMENTS_TOML_FIELDS


def test_known_fields_are_present() -> None:
    fields = set(CONFIG_REQUIREMENTS_TOML_FIELDS)
    for name in ("model_providers", "hooks", "mcp_servers", "features", "rules", "apps"):
        assert name in fields


def test_no_duplicates() -> None:
    assert len(set(CONFIG_REQUIREMENTS_TOML_FIELDS)) == 46


def test_stride_and_attestation_numbers() -> None:
    assert FAT_POINTER_STRIDE == 16
    assert TRUTH_EXACT_REPRODUCED == 44


def test_validator_passes_on_catalogue_arity() -> None:
    validate_fat_pointer_contract({"ConfigRequirementsToml": 46})
    ensure_fat_pointer_contract()


def test_validator_rejects_wrong_arity() -> None:
    with pytest.raises(FatPointerContractError):
        validate_fat_pointer_contract({"ConfigRequirementsToml": 48})


def test_validator_rejects_leakage() -> None:
    import app.core.struct_fields_fat_pointer as mod

    patched = CONFIG_REQUIREMENTS_TOML_FIELDS + ("guardian_extra_policy",)
    original = mod.CONFIG_REQUIREMENTS_TOML_FIELDS
    try:
        mod.CONFIG_REQUIREMENTS_TOML_FIELDS = patched
        with pytest.raises(FatPointerContractError):
            validate_fat_pointer_contract()
    finally:
        mod.CONFIG_REQUIREMENTS_TOML_FIELDS = original


def test_validator_rejects_truncation() -> None:
    import app.core.struct_fields_fat_pointer as mod

    original = mod.CONFIG_REQUIREMENTS_TOML_FIELDS
    try:
        mod.CONFIG_REQUIREMENTS_TOML_FIELDS = original[:-1]
        with pytest.raises(FatPointerContractError):
            validate_fat_pointer_contract()
    finally:
        mod.CONFIG_REQUIREMENTS_TOML_FIELDS = original
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
