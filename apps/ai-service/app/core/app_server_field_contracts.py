# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Field-level contracts, read out of the 329 stable object schemas (R132).

R130 could only say how many methods exist. This module goes one level down: every object schema
the generator emitted has ``properties``, and the shape of those properties is a fact about the
protocol rather than an inference about it.

**The scale**, all machine-counted over the 329 objects:

- 285 objects declare properties; 44 are envelopes or aliases with none
- 259 objects declare ``required``, and those declarations total **521** required fields
- **863** property slots across **349** distinct names
- 312 fields carry a description; 223 are nullable unions

**Naming: the wire is camelCase, with exactly four exceptions — and all four are the same field.**
Of 863 slots, 859 are camelCase and 4 are snake_case. Every one of those four is ``_meta``, and they
sit in the four MCP objects that forward raw MCP payloads
(``McpServerElicitationRequestResponse``, ``McpResourceReadParams``, ``McpServerToolCallParams``,
``McpServerToolCallResponse``). That is MCP's own reserved metadata key crossing the boundary
unchanged — the protocol does not rename a foreign convention, it carries it.

**194 properties carry no ``type`` at all**, and that is not an omission — it is the shape of a
composed field: 92 are ``$ref``, 71 ``anyOf``, 26 ``allOf``, 5 are bare schemas. Reading these as
"untyped" would be wrong; they are typed by reference.

**The two biggest request objects are about intent, not plumbing.** ``TurnStartParams`` has 19
fields and requires only ``input`` and ``threadId``. ``ThreadStartParams`` has 15 fields and
requires **nothing**. ``ThreadForkParams`` has 15 and requires only ``threadId``. Every other field
— model, cwd, approvals, sandbox — is optional and mostly ``["…","null"]``.

Two asymmetries worth keeping in view:

- ``ThreadStartParams.ephemeral`` is ``["boolean","null"]`` while ``ThreadForkParams.ephemeral`` is a
  plain ``boolean``. Same concept, two nullabilities.
- ``TurnStartParams`` carries both ``serviceTier`` and ``serviceTierForTurn``. Two fields for one
  idea is what a rename looks like when the old name cannot be dropped yet.

``ThreadStartParams.config`` is ``["object","null"]`` with ``additionalProperties`` — a deliberately
unconstrained bag, so the config surface is not enumerable from the protocol side at all.

**Honest boundary.** This pins aggregates and three request objects, not all 329. The remaining
objects are extracted to disk but not pinned; the aggregates are exact because they are counted,
the per-object tables are exact because they were generated rather than typed by hand. Enum values
(``enum``/``const``) were counted as schema keys but not extracted as value sets.
"""

from __future__ import annotations

from typing import Final

SCHEMA_ROOT: Final = "D:/DevEnv/Temp/r130/schema-stable"
SCHEMA_LAYERS: Final = ("v1", "v2", "(top level)")
STABLE_OBJECT_COUNT: Final = 329

OBJECTS_WITH_PROPERTIES: Final = 285
OBJECTS_WITHOUT_PROPERTIES: Final = 44
OBJECTS_WITH_REQUIRED: Final = 259
REQUIRED_FIELD_TOTAL: Final = 521

FIELD_SLOT_TOTAL: Final = 863
DISTINCT_FIELD_NAME_COUNT: Final = 349
DESCRIBED_FIELD_COUNT: Final = 312
NULLABLE_UNION_COUNT: Final = 223

CAMEL_CASE_SLOTS: Final = 859
SNAKE_CASE_SLOTS: Final = 4
SNAKE_CASE_IS_ONLY_MCP_META: Final = True
SNAKE_CASE_FIELD_NAMES: Final = ("_meta",)
SNAKE_CASE_OWNING_OBJECTS: Final = (
    "McpServerElicitationRequestResponse",
    "McpResourceReadParams",
    "McpServerToolCallParams",
    "McpServerToolCallResponse",
)

NO_TYPE_TOTAL: Final = 194
NO_TYPE_BY_COMPOSER: Final = {
    "$ref": 92,
    "anyOf": 71,
    "allOf": 26,
    "bare": 5,
}

TYPE_DISTRIBUTION: Final = {
    "string": 283,
    "no-type": 194,
    "union(string,null)": 161,
    "array": 75,
    "boolean": 51,
    "union(integer,null)": 21,
    "union(array,null)": 20,
    "integer": 19,
    "bool-schema": 13,
    "union(boolean,null)": 13,
    "union(object,null)": 8,
    "object": 5,
}

FAMILY_OBJECT_COUNTS: Final = {
    "Thread": 91,
    "Plugin": 24,
    "Fs": 19,
    "Turn": 11,
    "McpServer": 10,
    "Apps": 6,
    "Item": 4,
    "Account": 3,
}
FAMILY_TOTAL_ACROSS_LISTED: Final = 168

BIGGEST_OBJECTS: Final = (
    ("TurnStartParams", 19),
    ("ThreadStartParams", 15),
    ("ThreadForkParams", 15),
    ("ThreadResumeResponse", 14),
    ("ThreadListParams", 14),
    ("CommandExecutionRequestApprovalParams", 14),
    ("ThreadResumeParams", 13),
    ("CommandExecParams", 13),
)

TURN_START_PARAMS_FIELDS: Final = (
    "approvalPolicy",
    "approvalsReviewer",
    "clientUserMessageId",
    "cwd",
    "disabledPluginIds",
    "effort",
    "input",
    "model",
    "outputSchema",
    "parentTurnId",
    "personality",
    "rootTurnId",
    "sandboxPolicy",
    "serviceTier",
    "serviceTierForTurn",
    "summary",
    "threadId",
    "toolOutput",
    "turnTrigger",
)
TURN_START_PARAMS_REQUIRED: Final = ("input", "threadId")
TURN_START_PARAMS_FIELD_COUNT: Final = 19

THREAD_START_PARAMS_FIELDS: Final = (
    "approvalPolicy",
    "approvalsReviewer",
    "baseInstructions",
    "config",
    "cwd",
    "developerInstructions",
    "ephemeral",
    "model",
    "modelProvider",
    "personality",
    "sandbox",
    "serviceName",
    "serviceTier",
    "sessionStartSource",
    "threadSource",
)
THREAD_START_PARAMS_REQUIRED: Final = ()
THREAD_START_PARAMS_FIELD_COUNT: Final = 15
THREAD_START_REQUIRES_NOTHING: Final = True

THREAD_FORK_PARAMS_FIELDS: Final = (
    "approvalPolicy",
    "approvalsReviewer",
    "baseInstructions",
    "config",
    "cwd",
    "developerInstructions",
    "ephemeral",
    "excludeTurns",
    "lastTurnId",
    "model",
    "modelProvider",
    "sandbox",
    "serviceTier",
    "threadId",
    "threadSource",
)
THREAD_FORK_PARAMS_REQUIRED: Final = ("threadId",)
THREAD_FORK_PARAMS_FIELD_COUNT: Final = 15

EPHEMERAL_NULLABILITY_ASYMMETRY: Final = True
SERVICE_TIER_DUPLICATED_ON_TURN_START: Final = True
THREAD_START_CONFIG_IS_AN_OPEN_BAG: Final = True


def family_object_count(prefix: str) -> int:
    """Number of objects whose title starts with ``prefix``, ``0`` when the family is unlisted."""
    return FAMILY_OBJECT_COUNTS.get(str(prefix), 0)


def object_field_count(title: str) -> int:
    """Pinned field count for the objects this module enumerates, else ``-1``."""
    for name, count in BIGGEST_OBJECTS:
        if name == str(title):
            return count
    return -1


def is_snake_case_field(name: str) -> bool:
    """Whether a field name uses snake_case (never true for a camelCase name)."""
    return "_" in str(name)


def field_name_is_expected(name: str) -> bool:
    """The whole naming rule: camelCase everywhere, plus MCP's own ``_meta``."""
    n = str(name)
    if n == "_meta":
        return True
    return "_" not in n


def required_is_subset_of_fields(title: str, fields: tuple[str, ...], required: tuple[str, ...]) -> bool:
    """``required`` must never name a field the object does not declare."""
    return all(r in fields for r in required)


def coverage() -> dict[str, object]:
    """What this module pins, for the ledger to cite."""
    return {
        "objects": STABLE_OBJECT_COUNT,
        "objects_with_properties": OBJECTS_WITH_PROPERTIES,
        "field_slots": FIELD_SLOT_TOTAL,
        "distinct_names": DISTINCT_FIELD_NAME_COUNT,
        "required_fields": REQUIRED_FIELD_TOTAL,
        "snake_case": SNAKE_CASE_SLOTS,
        "no_type": NO_TYPE_TOTAL,
        "nullable": NULLABLE_UNION_COUNT,
    }


def validate_contract() -> list[str]:
    """Assert the counted field-level facts are internally consistent."""
    problems: list[str] = []

    if OBJECTS_WITH_PROPERTIES + OBJECTS_WITHOUT_PROPERTIES != STABLE_OBJECT_COUNT:
        problems.append("objects with and without properties must account for all 329")
    if OBJECTS_WITH_REQUIRED > OBJECTS_WITH_PROPERTIES:
        problems.append("more objects declare required than declare properties")
    if REQUIRED_FIELD_TOTAL < OBJECTS_WITH_REQUIRED:
        problems.append("required fields cannot be fewer than the objects declaring them")

    if CAMEL_CASE_SLOTS + SNAKE_CASE_SLOTS != FIELD_SLOT_TOTAL:
        problems.append("camel and snake slots must sum to the measured slot total")
    if len(SNAKE_CASE_FIELD_NAMES) * len(SNAKE_CASE_OWNING_OBJECTS) != SNAKE_CASE_SLOTS:
        problems.append("the four snake_case slots must be one field across four objects")
    if not SNAKE_CASE_IS_ONLY_MCP_META:
        problems.append("the snake_case exception is MCP's _meta and that must stay recorded")
    if SNAKE_CASE_FIELD_NAMES != ("_meta",):
        problems.append("_meta is the only snake_case field name on the wire")
    if any(not name.startswith("Mcp") for name in SNAKE_CASE_OWNING_OBJECTS):
        problems.append("all _meta holders are MCP objects")
    if len(SNAKE_CASE_OWNING_OBJECTS) != 4:
        problems.append("exactly four objects forward raw MCP payloads")

    if sum(NO_TYPE_BY_COMPOSER.values()) != NO_TYPE_TOTAL:
        problems.append("the composer breakdown must sum to the untyped total")
    if "$ref" not in NO_TYPE_BY_COMPOSER or "anyOf" not in NO_TYPE_BY_COMPOSER:
        problems.append("composed fields are typed by reference, not untyped")
    if NO_TYPE_TOTAL > FIELD_SLOT_TOTAL:
        problems.append("untyped slots cannot exceed total slots")

    if FIELD_SLOT_TOTAL < DISTINCT_FIELD_NAME_COUNT:
        problems.append("slots must be at least the number of distinct names")
    if sum(TYPE_DISTRIBUTION.values()) != FIELD_SLOT_TOTAL:
        problems.append("every slot has exactly one type bucket and they must sum to 863")
    if TYPE_DISTRIBUTION["no-type"] != NO_TYPE_TOTAL:
        problems.append("the no-type bucket and the composer breakdown must agree")
    if TYPE_DISTRIBUTION["string"] != 283:
        problems.append("string is the largest single type at 283")
    if DESCRIBED_FIELD_COUNT > FIELD_SLOT_TOTAL:
        problems.append("described fields cannot exceed slots")
    if NULLABLE_UNION_COUNT > FIELD_SLOT_TOTAL:
        problems.append("nullable fields cannot exceed slots")

    if family_object_count("Thread") != 91:
        problems.append("Thread must remain the largest family at 91 objects")
    if family_object_count("Account") != 3:
        problems.append("Account is a three-object family")
    if family_object_count("Nope") != 0:
        problems.append("an unlisted family must resolve to zero")
    if sum(FAMILY_OBJECT_COUNTS.values()) != FAMILY_TOTAL_ACROSS_LISTED:
        problems.append("listed family counts must sum to their pinned total")

    if len(TURN_START_PARAMS_FIELDS) != TURN_START_PARAMS_FIELD_COUNT:
        problems.append("TurnStartParams field count drifted from its list")
    if len(THREAD_START_PARAMS_FIELDS) != THREAD_START_PARAMS_FIELD_COUNT:
        problems.append("ThreadStartParams field count drifted from its list")
    if len(THREAD_FORK_PARAMS_FIELDS) != THREAD_FORK_PARAMS_FIELD_COUNT:
        problems.append("ThreadForkParams field count drifted from its list")
    if not required_is_subset_of_fields(
        "TurnStartParams", TURN_START_PARAMS_FIELDS, TURN_START_PARAMS_REQUIRED
    ):
        problems.append("TurnStartParams required names a field it does not declare")
    if not THREAD_START_REQUIRES_NOTHING or THREAD_START_PARAMS_REQUIRED != ():
        problems.append("ThreadStartParams requires nothing and that is a measured fact")
    if THREAD_START_PARAMS_FIELDS[6] != "ephemeral":
        problems.append("ephemeral must stay declared on ThreadStartParams")
    if "ephemeral" not in THREAD_FORK_PARAMS_FIELDS:
        problems.append("ephemeral must stay declared on ThreadForkParams")
    if not EPHEMERAL_NULLABILITY_ASYMMETRY:
        problems.append("the two ephemeral fields differ in nullability")
    if "serviceTier" not in TURN_START_PARAMS_FIELDS or "serviceTierForTurn" not in TURN_START_PARAMS_FIELDS:
        problems.append("TurnStartParams carries two service tier fields")
    if not SERVICE_TIER_DUPLICATED_ON_TURN_START:
        problems.append("the duplicated service tier is a measured asymmetry")
    if not THREAD_START_CONFIG_IS_AN_OPEN_BAG:
        problems.append("config is an unconstrained object bag")

    if object_field_count("TurnStartParams") != 19:
        problems.append("object_field_count must resolve the pinned objects")
    if object_field_count("NotAnObject") != -1:
        problems.append("an unknown object must not resolve to a field count")
    if is_snake_case_field("threadId"):
        problems.append("threadId is camelCase")
    if not is_snake_case_field("_meta"):
        problems.append("_meta is snake_case by composition, not by convention")
    if not field_name_is_expected("threadId") or not field_name_is_expected("_meta"):
        problems.append("the naming rule must accept both camelCase and _meta")
    if field_name_is_expected("thread_id"):
        problems.append("a snake_case name other than _meta is not expected on the wire")

    problems.extend(validate_value_surface())

    return problems


# ---------------------------------------------------------------- value surface
#
# The first pass over these files reported zero enums. That pass was wrong, and the
# way it was wrong is worth recording: every object file embeds its own `definitions`
# block, so the value sets live one level down from `properties`. A scan of
# `properties` alone sees composed fields ($ref/anyOf) and no values at all.

ENUM_SUBSCHEMA_TOTAL: Final = 3488
INLINE_ENUM_SUBSCHEMAS: Final = 224
ENUM_DEFINITION_SUBTREE_TOTAL: Final = 3264
ENUM_DEFINITION_COUNT: Final = 131
ENUM_DEFINITION_OCCURRENCES: Final = 700
SINGLE_VALUE_ENUM_OCCURRENCES: Final = 56
WIDEST_ENUM: Final = ("RealtimeVoice", 35)
CONST_DEFINITIONS: Final = 0

ADDITIONAL_PROPERTIES_FALSE: Final = 1
ADDITIONAL_PROPERTIES_TRUE: Final = 0
ADDITIONAL_PROPERTIES_ABSENT: Final = 328
PROPERTY_LEVEL_ADDITIONAL_PROPERTIES: Final = 13

# The one object that refuses unknown fields is the one that writes model provider
# configuration: a single `settings` bag, required, and nothing else accepted. That is the
# only place in the dictionary where a stray key is a protocol error rather than a shrug —
# which makes sense, because this is the write path for provider credentials and endpoints.
STRICT_OBJECT: Final = "ModelProviderConfigWriteParams"
STRICT_OBJECT_FIELDS: Final = ("settings",)
STRICT_OBJECT_REQUIRED: Final = ("settings",)

# ---------------------------------------------------------------- reference surface
#
# 92 properties point straight at a named definition; they resolve to 61 distinct targets, so
# references are reused rather than one-off. A further 71 sit inside `anyOf` and 26 inside `allOf`.
# The recursive total is 4,586 because every object file re-embeds the definitions it uses — the
# same node appears in every file that needs it, which is why raw counts are misleading twice over.
REF_DIRECT_COUNT: Final = 92
REF_DIRECT_DISTINCT_TARGETS: Final = 61
REF_IN_ANYOF: Final = 71
REF_IN_ALLOF: Final = 26
REF_RECURSIVE_TOTAL: Final = 4586
TOP_REF_TARGETS: Final = (
    ("AbsolutePathBuf", 7),
    ("Thread", 7),
    ("RequestId", 4),
    ("Turn", 4),
    ("AskForApproval", 3),
    ("ThreadId", 2),
)

# ---------------------------------------------------------------- prose surface
#
# 312 properties carry a description. 59 begin with "Optional", which states the same fact the
# nullable union already states — the prose and the type repeat each other. 93 contain a
# conditional ("when", "if", "unless", "only"), so behaviour lives in prose rather than in schema.
# Median length is 72 characters; the longest is 726, which is an essay, not a label.
DESCRIPTION_COUNT: Final = 312
DESCRIPTION_OPTIONAL_PREFIX: Final = 59
# Corrected by R133: the first matcher searched for " if " with a leading space and therefore missed
# every sentence that *starts* with "If". Padding the text before matching finds 93, eleven more.
DESCRIPTION_WITH_CONDITIONAL: Final = 93
DESCRIPTION_MEDIAN_LENGTH: Final = 72
DESCRIPTION_MAX_LENGTH: Final = 726

ENUM_DEFINITIONS: Final = {
    "AccountRoutingOverride": ("NO_CONSTRAINT", "us", "us_cr",),
    "AccountSessionWorkspaceKind": ("personal", "workspace",),
    "AddCreditsNudgeCreditType": ("credits", "usage_limit",),
    "AddCreditsNudgeEmailStatus": ("sent", "cooldown_active",),
    "AdditionalContextKind": ("untrusted", "application",),
    "AgentMessageDelivery": ("async",),
    "AllowDenyRequirement": ("allow", "deny",),
    "AppTemplateUnavailableReason": ("NOT_CONFIGURED_FOR_WORKSPACE", "NO_ACTIVE_WORKSPACE",),
    "AppToolApproval": ("auto", "prompt", "writes", "approve",),
    "ApprovalsReviewer": ("user", "auto_review", "guardian_subagent",),
    "AutoReviewDecisionSource": ("agent",),
    "BedrockProviderId": ("amazon-bedrock", "amazon-bedrock-runtime",),
    "BrowserUseAccessApprovalLifetime": ("turn", "thread",),
    "CancelLoginAccountStatus": ("canceled", "notFound",),
    "CliAuthCredentialsStoreMode": ("file", "keyring", "auto", "ephemeral",),
    "CodexResponseHandoffMode": ("thinking", "commentary", "bemTags",),
    "CollabAgentStatus": ("pendingInit", "running", "interrupted", "completed", "errored", "shutdown", "notFound",),
    "CollabAgentTool": ("spawnAgent", "sendInput", "resumeAgent", "wait", "closeAgent", "sendMessage", "followupTask", "interruptAgent", "listAgents",),
    "CollabAgentToolCallStatus": ("inProgress", "completed", "failed", "interrupted",),
    "CommandExecutionSource": ("agent", "userShell", "unifiedExecStartup", "unifiedExecInteraction",),
    "CommandExecutionStatus": ("inProgress", "completed", "failed", "declined",),
    "ConversationTextRole": ("user", "developer", "assistant",),
    "CyberAccessProgram": ("standard", "daybreakBlue", "daybreakRed",),
    "DesktopOnboardingEntrypoint": ("life_sciences",),
    "DynamicToolCallStatus": ("inProgress", "completed", "failed",),
    "ExternalAgentConfigMigrationItemType": ("AGENTS_MD", "CONFIG", "SKILLS", "PLUGINS", "MCP_SERVER_CONFIG", "SUBAGENTS", "HOOKS", "COMMANDS", "MEMORY", "SESSIONS",),
    "ExternalAgentDetectedConnectorSource": ("remoteMcpServersConfig", "sessionToolUse",),
    "ExternalAgentImportedConnectorSource": ("remoteMcpServersConfig",),
    "FileSystemAccessMode": ("read", "write", "deny",),
    "ForcedLoginMethod": ("chatgpt", "api",),
    "FuzzyFileSearchMatchType": ("file", "directory",),
    "GatewayOAuthStatus": ("notReady", "started", "succeeded", "failed",),
    "GcpProviderId": ("gcp",),
    "GuardianApprovalReviewStatus": ("inProgress", "approved", "denied", "timedOut", "aborted",),
    "GuardianCommandSource": ("shell", "unifiedExec",),
    "GuardianRiskLevel": ("low", "medium", "high", "critical",),
    "GuardianUserAuthorization": ("unknown", "low", "medium", "high",),
    "HookEventName": ("preModelRequest", "postModelRequest", "preToolUse", "permissionRequest", "postToolUse", "preCompact", "postCompact", "sessionStart", "sessionEnd", "userPromptSubmit", "subagentStart", "subagentStop", "stop", "interrupt",),
    "HookExecutionMode": ("sync", "async",),
    "HookHandlerType": ("command", "mcpTool", "prompt", "agent",),
    "HookOutputEntryKind": ("warning", "stop", "feedback", "context", "error",),
    "HookRunStatus": ("running", "completed", "failed", "blocked", "stopped",),
    "HookScope": ("thread", "turn",),
    "HookSource": ("system", "user", "project", "mdm", "sessionFlags", "plugin", "cloudRequirements", "cloudManagedConfig", "legacyManagedConfigFile", "legacyManagedConfigMdm", "unknown",),
    "HookTrustStatus": ("managed", "untrusted", "trusted", "modified",),
    "ImageDetail": ("auto", "low", "high", "original",),
    "LocalShellStatus": ("completed", "in_progress", "incomplete",),
    "LoginAppBrand": ("codex", "chatgpt",),
    "McpAppDisplayMode": ("inline", "fullscreen",),
    "McpAuthStatus": ("unknown", "unsupported", "notLoggedIn", "bearerToken", "oAuth",),
    "McpElicitationArrayType": ("array",),
    "McpElicitationBooleanType": ("boolean",),
    "McpElicitationNumberType": ("number", "integer",),
    "McpElicitationObjectType": ("object",),
    "McpElicitationStringFormat": ("email", "uri", "date", "date-time",),
    "McpElicitationStringType": ("string",),
    "McpServerConnectionStatus": ("notStarted", "starting", "connected", "authenticationRequired", "failed", "cancelled", "disabled",),
    "McpServerElicitationAction": ("accept", "decline", "cancel",),
    "McpServerOauthClientRegistration": ("auto", "cimd", "dcr",),
    "McpServerStartupFailureReason": ("reauthenticationRequired",),
    "McpServerStartupState": ("starting", "ready", "failed", "cancelled",),
    "McpServerStatusDetail": ("full", "toolsAndAuthOnly",),
    "McpToolCallStatus": ("inProgress", "completed", "failed",),
    "MergeStrategy": ("replace", "upsert",),
    "ModeKind": ("plan", "default",),
    "ModelRerouteReason": ("highRiskCyberActivity",),
    "ModelVerification": ("trustedAccessForCyber",),
    "MultiAgentVersion": ("disabled", "v1", "v2",),
    "NetworkAccess": ("restricted", "enabled",),
    "NetworkApprovalProtocol": ("http", "https", "socks5Tcp", "socks5Udp",),
    "NetworkDomainPermission": ("allow", "deny",),
    "NetworkPolicyRuleAction": ("allow", "deny",),
    "NetworkUnixSocketPermission": ("allow", "deny",),
    "NonSteerableTurnKind": ("review", "compact",),
    "OtelHttpProtocol": ("binary", "json",),
    "PatchApplyStatus": ("inProgress", "completed", "failed", "declined",),
    "PermissionGrantScope": ("turn", "session",),
    "Personality": ("none", "friendly", "pragmatic",),
    "PlanType": ("free", "go", "plus", "pro", "prolite", "promax", "team", "self_serve_business_prolite", "self_serve_business_usage_based", "business", "ent26", "enterprise_cbp_automation", "enterprise_cbp_usage_based", "enterprise", "edu", "edu_plus", "edu_pro", "sci", "sci_plus", "unknown",),
    "PluginAuthPolicy": ("ON_INSTALL", "ON_USE",),
    "PluginDisabledReason": ("disabled_by_admin", "plan_not_eligible", "required_app_unavailable", "unknown",),
    "PluginInstallPolicy": ("NOT_AVAILABLE", "AVAILABLE", "INSTALLED_BY_DEFAULT",),
    "PluginInstallPolicySource": ("WORKSPACE_SETTING", "IMPLICIT_CANONICAL_APP",),
    "PluginListMarketplaceKind": ("local", "vertical", "workspace-directory", "shared-with-me", "created-by-me-remote",),
    "PluginSearchScope": ("global", "workspace", "personal",),
    "PluginShareDiscoverability": ("LISTED", "UNLISTED", "PRIVATE",),
    "PluginSharePrincipalRole": ("reader", "editor", "owner",),
    "PluginSharePrincipalType": ("user", "group", "workspace",),
    "PluginShareTargetRole": ("reader", "editor",),
    "PluginShareUpdateDiscoverability": ("UNLISTED", "PRIVATE", "LISTED",),
    "ProjectChangeType": ("created", "updated", "deleted",),
    "ProjectSortKey": ("position", "recencyAt",),
    "RateLimitReachedType": ("rate_limit_reached", "workspace_owner_credits_depleted", "workspace_member_credits_depleted", "workspace_owner_usage_limit_reached", "workspace_member_usage_limit_reached",),
    "RateLimitResetCreditStatus": ("available", "redeeming", "redeemed", "unknown",),
    "RateLimitResetType": ("codexRateLimits", "unknown",),
    "RealtimeConversationVersion": ("v1", "v2", "v3",),
    "RealtimeOutputModality": ("text", "audio",),
    "RealtimeVoice": ("alloy", "arbor", "ash", "aube", "ballad", "breeze", "bubbie", "cedar", "coral", "cove", "echo", "ember", "haetsal", "hanul", "himari", "juniper", "leher", "maple", "marin", "miko", "neer", "porto", "rindo", "rio", "rivage", "sage", "selva", "shimmer", "sol", "sonna", "spruce", "tinta", "vale", "verse", "viola",),
    "RemoteControlConnectionStatus": ("disabled", "connecting", "connected", "errored",),
    "ResidencyRequirement": ("us",),
    "ReviewDelivery": ("inline",),
    "SandboxMode": ("read-only", "workspace-write", "danger-full-access",),
    "ScheduledTaskWeekday": ("MO", "TU", "WE", "TH", "FR", "SA", "SU",),
    "SkillScope": ("user", "repo", "system", "admin",),
    "SortDirection": ("asc", "desc",),
    "SubAgentActivityKind": ("started", "interacted", "interrupted", "completed",),
    "ThreadActiveFlag": ("waitingOnApproval", "waitingOnUserInput",),
    "ThreadAttachmentAddOutcome": ("created", "existing",),
    "ThreadAttachmentOperation": ("created", "deleted",),
    "ThreadGoalMutationOrigin": ("user", "automatic",),
    "ThreadGoalStatus": ("active", "paused", "blocked", "usageLimited", "budgetLimited", "complete",),
    "ThreadHistoryMode": ("legacy", "paginated",),
    "ThreadMemoryMode": ("enabled", "disabled",),
    "ThreadRealtimeSessionOutcome": ("ended", "failed",),
    "ThreadRealtimeTranscriptRole": ("user", "assistant",),
    "ThreadSearchSortKey": ("created_at", "updated_at", "recency_at",),
    "ThreadSortKey": ("created_at", "updated_at", "recency_at", "section_position",),
    "ThreadSourceKind": ("cli", "vscode", "exec", "appServer", "subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther", "unknown",),
    "ThreadStartSource": ("startup", "clear",),
    "ThreadUnsubscribeStatus": ("notLoaded", "notSubscribed", "unsubscribed",),
    "TurnPlanStepStatus": ("pending", "inProgress", "completed",),
    "TurnStatus": ("completed", "interrupted", "failed", "inProgress",),
    "Verbosity": ("low", "medium", "high",),
    "WebSearchContextSize": ("low", "medium", "high",),
    "WebSearchMode": ("disabled", "cached", "indexed", "live",),
    "WebSearchProvider": ("standalone", "search_mcp",),
    "WindowsSandboxImplementation": ("elevated", "unelevated", "mxc",),
    "WindowsSandboxReadiness": ("ready", "notConfigured", "updateRequired",),
    "WindowsSandboxSetupMode": ("elevated", "unelevated",),
    "WorkspaceMessageType": ("headline", "announcement", "unknown",),
    "WriteStatus": ("ok", "okOverridden",),
}

MOST_REPEATED_ENUMS: Final = (
    ("ImageDetail", 24),
    ("AgentMessageDelivery", 19),
    ("CollabAgentStatus", 19),
    ("CollabAgentTool", 19),
    ("CollabAgentToolCallStatus", 19),
    ("CommandExecutionSource", 19),
    ("CommandExecutionStatus", 19),
    ("DynamicToolCallStatus", 19),
)


def enum_values(name: str) -> tuple[str, ...]:
    """The value set for a named enum definition, empty when the name is unknown."""
    return ENUM_DEFINITIONS.get(str(name), ())


def is_single_value_enum(name: str) -> bool:
    """A one-value enum is a constant wearing an enum costume."""
    return len(enum_values(name)) == 1


def extra_fields_are_permitted() -> bool:
    """Absent `additionalProperties` means permitted (draft-07 default)."""
    return ADDITIONAL_PROPERTIES_ABSENT + ADDITIONAL_PROPERTIES_TRUE > ADDITIONAL_PROPERTIES_FALSE


def validate_value_surface() -> list[str]:
    """Assert the value-surface counts hold together."""
    problems: list[str] = []

    if len(ENUM_DEFINITIONS) != ENUM_DEFINITION_COUNT:
        problems.append("declared enum definitions must match the pinned table")
    if ENUM_DEFINITION_OCCURRENCES < ENUM_DEFINITION_COUNT:
        problems.append("occurrences cannot be fewer than distinct definitions")
    if INLINE_ENUM_SUBSCHEMAS + ENUM_DEFINITION_SUBTREE_TOTAL != ENUM_SUBSCHEMA_TOTAL:
        problems.append("inline and definition-subtree enums must account for every occurrence")
    if ENUM_DEFINITION_OCCURRENCES > ENUM_DEFINITION_SUBTREE_TOTAL:
        problems.append("named definitions cannot outnumber the enums in their subtree")
    if SINGLE_VALUE_ENUM_OCCURRENCES > ENUM_DEFINITION_OCCURRENCES:
        problems.append("single-value occurrences cannot exceed all occurrences")
    if CONST_DEFINITIONS != 0:
        problems.append("the dictionary expresses constants as one-value enums, not const")
    if WIDEST_ENUM[1] != len(enum_values(WIDEST_ENUM[0])):
        problems.append("the widest enum must resolve to its pinned width")
    if not is_single_value_enum("AgentMessageDelivery"):
        problems.append("AgentMessageDelivery has exactly one value")
    if enum_values("ImageDetail") != ("auto", "low", "high", "original"):
        problems.append("ImageDetail is the most embedded enum and its values are pinned")
    if enum_values("NoSuchEnum") != ():
        problems.append("an unknown enum name must resolve to an empty set")

    if ADDITIONAL_PROPERTIES_FALSE + ADDITIONAL_PROPERTIES_TRUE + ADDITIONAL_PROPERTIES_ABSENT != STABLE_OBJECT_COUNT:
        problems.append("the additionalProperties buckets must cover every object")
    if ADDITIONAL_PROPERTIES_FALSE != 1:
        problems.append("exactly one object forbids extra fields")
    if not extra_fields_are_permitted():
        problems.append("the dictionary is permissive about unknown fields")
    if STRICT_OBJECT_FIELDS != ("settings",) or STRICT_OBJECT_REQUIRED != ("settings",):
        problems.append("the strict object is the model provider write path with one settings bag")

    if REF_DIRECT_COUNT + REF_IN_ANYOF + REF_IN_ALLOF > REF_RECURSIVE_TOTAL:
        problems.append("direct and combinator refs cannot exceed the recursive total")
    if NO_TYPE_BY_COMPOSER["$ref"] != REF_DIRECT_COUNT:
        problems.append("the direct refs are the property-level refs already counted as untyped")
    if REF_DIRECT_DISTINCT_TARGETS > REF_DIRECT_COUNT:
        problems.append("distinct targets cannot exceed the refs that point at them")
    if sum(count for _, count in TOP_REF_TARGETS) > REF_DIRECT_COUNT:
        problems.append("the listed targets cannot account for more refs than exist")

    if DESCRIPTION_COUNT != DESCRIBED_FIELD_COUNT:
        problems.append("the prose surface must match the described-field count")
    if DESCRIPTION_OPTIONAL_PREFIX > DESCRIPTION_COUNT:
        problems.append("prose saying Optional cannot exceed the prose that exists")
    if DESCRIPTION_WITH_CONDITIONAL > DESCRIPTION_COUNT:
        problems.append("conditional prose cannot exceed the prose that exists")
    if DESCRIPTION_MEDIAN_LENGTH > DESCRIPTION_MAX_LENGTH:
        problems.append("a median longer than the maximum is impossible")

    return problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
