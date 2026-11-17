# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R65 pytest: struct_field_name_contract（非 hook struct 的 serde FIELDS 字段名契约）。

取证路径：codex.exe 的 ``.rdata`` 里 serde ``FIELDS`` 是 N 组 16 字节 ``(ptr,len)`` 表；字段字面量
按声明顺序首尾相连并紧贴 ``"struct X with N elements"`` 模板。判据 = 字段串接逐字节成为
「模板前连续可打印文本」的后缀且覆盖 ≥3 个字段名。44 个结构归属、0 歧义。
"""

from __future__ import annotations

import re

import pytest

from app.core.struct_field_name_contract import (
    STRUCT_FIELD_ARITY,
    STRUCT_FIELD_EVIDENCE,
    STRUCT_FIELD_NAMES,
    STRUCT_FIELD_NAMES_SET,
    StructFieldNameError,
    ensure_struct_field_contract,
    field_style,
    fields_of,
    is_struct_field_contract,
    missing_struct_fields,
    struct_arity,
    struct_fingerprint,
    struct_names,
    unknown_struct_fields,
    validate_struct_fields,
)

IDENT = re.compile(r"^(?:[a-z][A-Za-z0-9_]{1,48}|[A-Z][A-Za-z0-9_]{1,60})$")

# R65 锚点：R62 的 arity 读数（24 / 106）与字段数逐一相等；末字段与消息串前文本逐字节对齐。
MODEL_PROVIDER_INFO = (
    'name', 'base_url', 'model_catalog_url', 'env_key', 'env_key_instructions',
    'experimental_bearer_token', 'auth', 'gateway_oauth', 'aws', 'project_id',
    'location', 'credential_file', 'wire_api', 'capabilities', 'query_params',
    'http_headers', 'env_http_headers', 'request_max_retries', 'stream_max_retries',
    'stream_idle_timeout_ms', 'websocket_connect_timeout_ms', 'requires_openai_auth',
    'supports_websockets', 'supports_standalone_web_search',
)
CONFIG_TOML_HEAD = (
    'model', 'daybreak', 'review_model', 'model_provider', 'model_context_window',
    'model_auto_compact_token_limit', 'model_auto_compact_token_limit_scope',
    'model_post_turn_compact_threshold_percent',
)
CONFIG_TOML_TAIL = (
    'experimental_compact_prompt_file', 'experimental_use_unified_exec_tool', 'oss_provider',
)
FINGERPRINT_MODEL_PROVIDER = "02c1f2bdff556d724f26cd7a1251e2fb93f953f96aeb37db27b45db7002d3297"
FINGERPRINT_CONFIG_TOML = "2af3b085cf9fb5a9ff44e7dd25d2d992d456c4608a971f5b53c527f207364b47"


class TestCensus:
    def test_struct_count(self) -> None:
        assert len(STRUCT_FIELD_NAMES) == 44

    def test_names_set_matches_dict(self) -> None:
        assert frozenset(STRUCT_FIELD_NAMES) == STRUCT_FIELD_NAMES_SET

    def test_struct_names_order_stable(self) -> None:
        assert struct_names() == tuple(STRUCT_FIELD_NAMES)

    def test_arity_map_covers_every_struct(self) -> None:
        assert set(STRUCT_FIELD_ARITY) == set(STRUCT_FIELD_NAMES)

    def test_evidence_covers_every_struct(self) -> None:
        assert set(STRUCT_FIELD_EVIDENCE) == set(STRUCT_FIELD_NAMES)


class TestStructuralInvariants:
    def test_arity_equals_field_count(self) -> None:
        for name, fields in STRUCT_FIELD_NAMES.items():
            assert STRUCT_FIELD_ARITY[name] == len(fields), name

    def test_no_duplicates_inside_struct(self) -> None:
        for name, fields in STRUCT_FIELD_NAMES.items():
            assert len(fields) == len(set(fields)), name

    def test_all_fields_are_identifiers(self) -> None:
        for name, fields in STRUCT_FIELD_NAMES.items():
            assert fields, name
            for field in fields:
                assert IDENT.match(field), (name, field)

    def test_minimum_two_fields(self) -> None:
        for name, fields in STRUCT_FIELD_NAMES.items():
            assert len(fields) >= 2, name

    def test_evidence_strength_floor(self) -> None:
        """判据下限：后缀 ≥40 字节且完整覆盖 ≥3 个字段名，否则不得登记。"""
        for name, ev in STRUCT_FIELD_EVIDENCE.items():
            assert int(ev["suffix_bytes"]) >= 40, name  # type: ignore[arg-type]
            assert int(ev["fields_covered"]) >= 3, name  # type: ignore[arg-type]
            assert int(ev["occurrences"]) >= 1, name  # type: ignore[arg-type]
            assert ev["tables"], name

    def test_field_style_is_closed_set(self) -> None:
        styles = {field_style(name) for name in STRUCT_FIELD_NAMES}
        assert styles <= {"snake", "camel", "mixed"}

    def test_snake_structs_are_lower_with_underscores(self) -> None:
        snake = re.compile(r"^[a-z][a-z0-9_]*$")
        for name in STRUCT_FIELD_NAMES:
            if field_style(name) == "snake":
                for field in fields_of(name):
                    assert snake.fullmatch(field), (name, field)


class TestAnchors:
    def test_model_provider_info_exact(self) -> None:
        assert fields_of("ModelProviderInfo") == MODEL_PROVIDER_INFO

    def test_model_provider_info_arity(self) -> None:
        assert struct_arity("ModelProviderInfo") == 24

    def test_config_toml_arity(self) -> None:
        assert struct_arity("ConfigToml") == 106

    def test_config_toml_head(self) -> None:
        assert fields_of("ConfigToml")[:8] == CONFIG_TOML_HEAD

    def test_config_toml_tail(self) -> None:
        assert fields_of("ConfigToml")[-3:] == CONFIG_TOML_TAIL

    def test_config_toml_known_members(self) -> None:
        members = set(fields_of("ConfigToml"))
        for field in ("model_providers", "mcp_servers", "hooks", "skills", "projects"):
            assert field in members, field

    def test_anchors_are_snake(self) -> None:
        assert field_style("ModelProviderInfo") == "snake"
        assert field_style("ConfigToml") == "snake"


class TestFingerprint:
    def test_anchor_fingerprints(self) -> None:
        assert struct_fingerprint("ModelProviderInfo") == FINGERPRINT_MODEL_PROVIDER
        assert struct_fingerprint("ConfigToml") == FINGERPRINT_CONFIG_TOML

    def test_fingerprints_are_hex(self) -> None:
        prints = [struct_fingerprint(name) for name in STRUCT_FIELD_NAMES]
        assert all(re.fullmatch(r"[0-9a-f]{64}", p) for p in prints)

    def test_identical_field_lists_share_fingerprint(self) -> None:
        """字段表逐字相同的两个结构名（真实存在一对）指纹必然相同。"""
        assert struct_fingerprint("ModelTokenBudgetConfig") == struct_fingerprint(
            "TokenBudgetConfigToml"
        )

    def test_distinct_field_lists_have_distinct_fingerprints(self) -> None:
        seen: dict[str, tuple[str, ...]] = {}
        for name in STRUCT_FIELD_NAMES:
            fields = fields_of(name)
            print_value = struct_fingerprint(name)
            if print_value in seen:
                assert seen[print_value] == fields, name
            seen[print_value] = fields

    def test_fingerprint_is_order_sensitive(self) -> None:
        name = "AgentRoleToml"
        baseline = struct_fingerprint(name)
        assert baseline != struct_fingerprint("BrowserUseConfigToml")


class TestValidation:
    def test_accepts_exact_mapping(self) -> None:
        for name, fields in STRUCT_FIELD_NAMES.items():
            mapping = dict.fromkeys(fields, None)
            assert validate_struct_fields(name, mapping) == name

    def test_order_insensitive(self) -> None:
        fields = fields_of("ModelProviderInfo")
        mapping = dict.fromkeys(reversed(fields), 1)
        assert validate_struct_fields("ModelProviderInfo", mapping) == "ModelProviderInfo"
        assert missing_struct_fields("ModelProviderInfo", mapping) == ()

    def test_missing_field_rejected(self) -> None:
        mapping = dict.fromkeys(fields_of("ModelProviderInfo")[:-1], 1)
        assert missing_struct_fields("ModelProviderInfo", mapping) == (
            'supports_standalone_web_search',
        )
        with pytest.raises(StructFieldNameError):
            validate_struct_fields("ModelProviderInfo", mapping)

    def test_unknown_field_rejected(self) -> None:
        mapping = dict.fromkeys(fields_of("ModelProviderInfo"), 1)
        mapping["bogus"] = 1
        assert unknown_struct_fields("ModelProviderInfo", mapping) == ("bogus",)
        with pytest.raises(StructFieldNameError):
            validate_struct_fields("ModelProviderInfo", mapping)

    def test_renamed_field_rejected(self) -> None:
        fields = fields_of("ConfigToml")
        mapping = dict.fromkeys(fields, 1)
        del mapping["model"]
        mapping["Model"] = 1
        with pytest.raises(StructFieldNameError):
            validate_struct_fields("ConfigToml", mapping)

    def test_unregistered_struct_rejected(self) -> None:
        with pytest.raises(StructFieldNameError):
            validate_struct_fields("ThreadStartParams", {"anything": 1})

    def test_is_and_ensure(self) -> None:
        assert is_struct_field_contract("ConfigToml")
        assert not is_struct_field_contract("ThreadStartParams")
        assert not is_struct_field_contract("")
        assert ensure_struct_field_contract("ConfigToml") == "ConfigToml"
        with pytest.raises(StructFieldNameError):
            ensure_struct_field_contract("bogus")

    def test_unattributed_structs_stay_out(self) -> None:
        """诚实边界：无相邻字段表的两个锚点不得混进契约。"""
        for name in ("ThreadStartParams", "TurnStartParams"):
            assert name not in STRUCT_FIELD_NAMES_SET
            assert not is_struct_field_contract(name)


class TestR64Isolation:
    def test_hook_contracts_not_imported_here(self) -> None:
        import app.core.hook_field_type_contract as hook

        assert not set(STRUCT_FIELD_NAMES) & set(getattr(hook, "HOOK_FIELD_TYPE_SCHEMA_NAMES", ()))


# 全量指纹注册表：44 个结构的字段序逐字钉死（任一改名/增删都会红）。
EXPECT_FINGERPRINTS: dict[str, str] = {
    'AgentMessageDisplay': '4a467677158dcc3798250d8967bca85833f1cf590fe9c4be2b5b61eabda141cb',
    'AgentRoleToml': 'f1136b8c10778447e54836f1e6322628832dc24e0538b1081c2b1124a4fed2f4',
    'AppInfo': '43d3be9c9daa62c087b3131ae71a7c7c5e6ae85af5967ac3c05d8b3fd2dc9f42',
    'AwsSigV4Config': '43a64b27225c40b22a53b8e1e3bb93753f027a67bf7ef999842c60afedd9ae2f',
    'BrowserUseConfigToml': '8444cc4532caa077eb5bbf890081bf8856c192a8093e2ea1129b438f1dde6513',
    'ChatgptAuthTokensRefreshResponse': 'a0f91d76654fb0a728668eceb7dbc6ca63cb26614405b1f25f97cda9faddd382',
    'CodeModeConfigToml': '23efa54a3000c8a873d73882020a33f4f11970e7e42fa198c5cc46501b64b05e',
    'CodexWorkspaceMessage': 'bbf61811cbd105dc0d49c780ec9f216c330bb3aa418d2168c9b0e25102a80569',
    'CompactedItemWire': '003ded24cf54207f21747c936a0b63baaf58dad71f3ea318a1fd415c084009ed',
    'ConfigToml': '2af3b085cf9fb5a9ff44e7dd25d2d992d456c4608a971f5b53c527f207364b47',
    'CurrentTimeReminderConfigToml': '9fa99bde4273656cc9c61b398aed65026a9dca00b87d0811ae2128503a47f0d4',
    'EnvironmentInfo': '8797e468d706ff4b7934116c87ac76d6080b5b8ca37d5a3565941849911fb89a',
    'ExternalConfigMigrationPrompts': 'a6afcb85481efd6a9c1c42548cf64ac3212468a8964fe9c2443a679da7775f4b',
    'FileSystemSandboxContext': '85d2143ee8499d3f8d511ad188ae60d3638fc81a23eb1637ff616a2981d2d748',
    'FsCopyParams': 'e272a514063df1ce147c0c7f7ab8fcd01b931eacb84975fdea668710e951e320',
    'GranularApprovalConfig': '51d81da6fcffc31de815d45b6fe27e6a049de43b738e922f37228ed4c4dc5f77',
    'GuardianElasticSectionConfigToml': '3509202377037b8b1834c49bca7d21b36775c667937992bb3b5c0bef5fbeabd5',
    'GuardianV2ConfigToml': '3479bc6640f640fd8d563bb5c4b7b5b897f0f8e7368c926de1af7f85523e6b44',
    'GuardianV2TranscriptConfigToml': '116fde9b303b521bebc47ec467ae4cb13952a1331d890ae3beacc49d46822407',
    'ImagegenArgs': '10d03e06594491d5721a82583b4de0816cab93da984b62a7dc88eefc4b1571b9',
    'McpResourceOrigin': '768980753107a6a0add516a31c97302051581b1990877fdbd158eaa1522cd102',
    'MisalignmentErrorDetails': '05e9ec20f01188e9bb883bbb024603ebfe5d753db6a35c9f0cdd5a1653a93238',
    'ModelProviderCapabilities': 'b0e07e3196cfc2ce0409a3a1ead3c597f10d1b4b69a9f9b95b0f5b58e4ef442b',
    'ModelProviderInfo': '02c1f2bdff556d724f26cd7a1251e2fb93f953f96aeb37db27b45db7002d3297',
    'ModelTokenBudgetConfig': 'df2d727305b506be3dd46a3260bd3ecda4e8e0b836dbe6be11e4eb82c6c574f5',
    'MultiAgentV2ConfigToml': '606a1f27f04f14d3103cdad31412d61a6e31b6c5a611ebed4e06c0884f463c1e',
    'NetworkMitmHookToml': '51c3c0fadad17733ffb6de11b0cccd6a908bcf52a08d3ff24665c2a0af6a256d',
    'NetworkToml': 'bc0045e945fa50f948e676dc6b2a5a09383dff01af502f6d1887ecbe97c91503',
    'OtelConfigToml': 'c17e1375c067042773f86721a985b3bcf41ce73735b9a928199b3793390caef0',
    'ProcessExitedNotification': '73dc00dcfdd2ca135cd52f932abf2e987b3cd8544bd6f60f572e06feb67d2a02',
    'RateLimitSnapshot': 'ca73dc0309437d075a91581f8d32c5215d1f9fa8aedba26bdb5e37a89488c543',
    'RawNetworkRequirementsToml': 'bf5fb830cf990f437a0eaa503fc9aaaa9600bd9580e69f17f781fa265ffd8826',
    'RemoteControlClientResponse': 'aea736781c05e7025ac649b4033f8b2adbe195af82d0ba222fe2f957c06f7ab4',
    'RemotePluginDirectoryItem': '700caa83dbc3d94b0f93ff99889524de0f940371a478635c1e57166205a0f912',
    'RequirementsExecPolicyPrefixRuleToml': '01b7e62b0b9096cd058c2bd4a4f0fbdc9082a2a3a036c002dfadfe2e2b46298f',
    'ResponseCompletedUsage': 'c75ca19d546aab7ad14e727b5968d08f5647bd865b4b21121c25a9ecc2b84f20',
    'RolloutBudgetConfigToml': '14bad96cc885dafaebf4c7d93f611c3d96af4b00ca5889e1710b2d4a617a5712',
    'SandboxProvisioningRequest': 'c9b4d59ef5d7718b047bdd467b6bebd8a8e8104d323bddd7af3cb8ef9bf1475c',
    'SportsOperation': '91dbe8d606c44c88e7ed4541a853d7c578d5d760e00e4ab189654464809206d9',
    'ThreadGoal': '1dbc1496b85f7417349e6ecf3d045c0daf0d15df4f1e317f9d66e651febb82f3',
    'TokenBudgetConfigToml': 'df2d727305b506be3dd46a3260bd3ecda4e8e0b836dbe6be11e4eb82c6c574f5',
    'TokenUsageBreakdown': '30a7f301968b60aa48f1e50be4624f9417f0d33f16aca246cf4ecdeb3d9de5b2',
    'TokenUsageProfileStats': 'd5e3f2d705eceeae92ea64b5ce6d3e19b5aa179cd640ba8a19387be0b5f7d11e',
    'TurnError': '936ab1bacca19771ffb82cfebbdf9947c28bb63dd7a609778cdb6043b8e23ea7',
}


class TestFingerprintRegistry:
    def test_registry_covers_all(self) -> None:
        assert set(EXPECT_FINGERPRINTS) == set(STRUCT_FIELD_NAMES)

    def test_every_struct_fingerprint_pinned(self) -> None:
        for name, expected in EXPECT_FINGERPRINTS.items():
            assert struct_fingerprint(name) == expected, name
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
