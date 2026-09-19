# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/turn_metadata.py
"""Codex 会话元数据键与请求元数据构建(2026-09-19 第三十一批,对标 Codex responses_metadata.rs/turn_metadata.rs)。

本模块是 codex-rs `core/src/responses_metadata.rs` 与 `core/src/turn_metadata.rs` 的可移植切片:
只搬运**纯数据 / 纯函数**部分,供 ihui 的 Python 端复用同一套 metadata 键、截断与过滤语义。

忠实移植的纯函数 / 常量:
- metadata 键常量(INSTALLATION_ID_KEY 等)与 HTTP header 常量(X_CODEX_* / X_OPENAI_SUBAGENT_HEADER);
- 保留键集合 RESERVED_METADATA_KEYS、向后兼容保留键 BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS;
- 上限常量 MAX_EXTRA_METADATA_ENTRIES / KEY_BYTES / VALUE_BYTES;
- filter_extra_metadata(过滤保留键)、validate_extra_metadata(校验 16 条 / 64 字节键 / 128 字节值 / 保留键);
- subagent_header_value / subagent_metadata_kind(SessionSource -> 子代理 header / kind 字符串);
- CodexResponsesMetadata 等价 dataclass(new / has_turn_metadata / as_dict / as_json / client_metadata);
- ExecutionMetadata.apply_to(metadata) 把执行配置写回 metadata.extra 的语义。

**跳过(明确判定)的 Session / 异步耦合部分**(证据在对应函数注释):
- `TurnMetadataState`(turn_metadata.rs:154-529):内部使用 RwLock / OnceLock / AtomicBool / tokio::sync::watch /
  AbortOnDropHandle / Arc 等会话与异步原语,纯 Python 端无法也无必要复刻;
- `detached_memory_responses_metadata`(turn_metadata.rs:123-152):`async fn` 且依赖 `crate::ThreadManager` 与 git 发现;
- `spawn_git_enrichment_task` / `wait_for_git_enrichment` / `cancel_git_enrichment_task` /
  `memory_workspaces` / `git_workspaces`(turn_metadata.rs:481-565):全部 `async` + tokio::spawn + git 命令行;
- `compatibility_headers` / `insert_header`(responses_metadata.rs:354-471):依赖 http::HeaderMap / HeaderValue 等
  HTTP 客户端 crate,与具体传输耦合;本端口用 `client_metadata()`(返回纯 dict)等价替代其投影语义。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Iterable, Optional, Tuple


def _empty_obj_dict() -> dict[str, object]:
    return {}


def _empty_str_dict() -> dict[str, str]:
    return {}

# ---------------------------------------------------------------------------
# metadata 键常量(对标 responses_metadata.rs:27-57)
# ---------------------------------------------------------------------------
INSTALLATION_ID_KEY: str = "installation_id"
SESSION_ID_KEY: str = "session_id"
THREAD_ID_KEY: str = "thread_id"
AGENT_NAME_KEY: str = "agent_name"
TURN_ID_KEY: str = "turn_id"
WINDOW_ID_KEY: str = "window_id"
WINDOW_NUMBER_KEY: str = "window_number"
CONTEXT_WINDOW_ID_KEY: str = "context_window_id"
REQUEST_KIND_KEY: str = "request_kind"
COMPACTION_KEY: str = "compaction"
# 保留被移除的 inventory 键,防止调用方重新引入超大 metadata。
LEGACY_CODE_MODE_TOOL_NAMES_KEY: str = "code_mode_tool_names"
TOOL_NAMESPACES_INFO_KEY: str = "tool_namespaces_info"
TURN_STARTED_AT_UNIX_MS_KEY: str = "turn_started_at_unix_ms"
HISTORY_INGEST_REQUESTED_KEY: str = "history_ingest_requested"
ANALYTICS_ENABLED_KEY: str = "analytics_enabled"

FORKED_FROM_THREAD_ID_KEY: str = "forked_from_thread_id"
FORKED_FROM_ORDINAL_EXCLUSIVE_KEY: str = "forked_from_ordinal_exclusive"
PARENT_THREAD_ID_KEY: str = "parent_thread_id"
PARENT_TURN_ID_KEY: str = "parent_turn_id"
ROOT_TURN_ID_KEY: str = "root_turn_id"
SUBAGENT_KIND_KEY: str = "subagent_kind"
THREAD_SOURCE_KEY: str = "thread_source"
TURN_TRIGGER_KEY: str = "turn_trigger"
SANDBOX_KEY: str = "sandbox"
SANDBOX_MODE_KEY: str = "sandbox_mode"
AUTO_REVIEW_ENABLED_KEY: str = "auto_review_enabled"
NODE_REPL_AUTO_REVIEW_REQUIRED_KEY: str = "node_repl_auto_review_required"
NODE_REPL_DISABLED_KEY: str = "node_repl_disabled"
WORKSPACES_KEY: str = "workspaces"

# ---------------------------------------------------------------------------
# HTTP header 常量(对标 client.rs:156-163)
# ---------------------------------------------------------------------------
X_CODEX_INSTALLATION_ID_HEADER: str = "x-codex-installation-id"
X_CODEX_TURN_METADATA_HEADER: str = "x-codex-turn-metadata"
X_CODEX_PARENT_THREAD_ID_HEADER: str = "x-codex-parent-thread-id"
X_CODEX_WINDOW_ID_HEADER: str = "x-codex-window-id"
X_OPENAI_SUBAGENT_HEADER: str = "x-openai-subagent"

# turn_metadata.rs:47-51 中仅被会话耦合代码使用的常量(此处保留以便一致性;纯函数端口不调用)
MODEL_KEY: str = "model"
CODEX_VERSION_KEY: str = "codex_version"
REASONING_EFFORT_KEY: str = "reasoning_effort"
USER_INPUT_REQUESTED_DURING_TURN_KEY: str = "user_input_requested_during_turn"
WORKSPACE_KIND_KEY: str = "workspace_kind"

# ---------------------------------------------------------------------------
# 上限常量(对标 responses_metadata.rs:105-107)
# ---------------------------------------------------------------------------
MAX_EXTRA_METADATA_ENTRIES: int = 16
MAX_EXTRA_METADATA_KEY_BYTES: int = 64
MAX_EXTRA_METADATA_VALUE_BYTES: int = 128

# ---------------------------------------------------------------------------
# 保留键 / 向后兼容保留键(对标 responses_metadata.rs:61-104)
# ---------------------------------------------------------------------------
# App-server 客户端可在 responsesapi_client_metadata 中额外指定 metadata,但不得覆盖 core 自有字段。
RESERVED_METADATA_KEYS: list[str] = [
    "guardian_credits_requested",
    INSTALLATION_ID_KEY,
    X_CODEX_INSTALLATION_ID_HEADER,
    SESSION_ID_KEY,
    THREAD_ID_KEY,
    AGENT_NAME_KEY,
    TURN_ID_KEY,
    WINDOW_ID_KEY,
    WINDOW_NUMBER_KEY,
    CONTEXT_WINDOW_ID_KEY,
    X_CODEX_WINDOW_ID_HEADER,
    X_CODEX_TURN_METADATA_HEADER,
    X_CODEX_PARENT_THREAD_ID_HEADER,
    X_OPENAI_SUBAGENT_HEADER,
    REQUEST_KIND_KEY,
    COMPACTION_KEY,
    LEGACY_CODE_MODE_TOOL_NAMES_KEY,
    TOOL_NAMESPACES_INFO_KEY,
    TURN_STARTED_AT_UNIX_MS_KEY,
    HISTORY_INGEST_REQUESTED_KEY,
    ANALYTICS_ENABLED_KEY,
    FORKED_FROM_THREAD_ID_KEY,
    FORKED_FROM_ORDINAL_EXCLUSIVE_KEY,
    PARENT_THREAD_ID_KEY,
    PARENT_TURN_ID_KEY,
    ROOT_TURN_ID_KEY,
    SUBAGENT_KIND_KEY,
    THREAD_SOURCE_KEY,
    TURN_TRIGGER_KEY,
    SANDBOX_KEY,
    SANDBOX_MODE_KEY,
    AUTO_REVIEW_ENABLED_KEY,
    NODE_REPL_AUTO_REVIEW_REQUIRED_KEY,
    NODE_REPL_DISABLED_KEY,
    WORKSPACES_KEY,
]
# 这些键曾经是合法的客户端配置;接受既有配置,但在构造 core 自有请求 metadata 前过滤其值。
BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS: list[str] = [
    WINDOW_NUMBER_KEY,
    FORKED_FROM_ORDINAL_EXCLUSIVE_KEY,
    ANALYTICS_ENABLED_KEY,
]


# ---------------------------------------------------------------------------
# SessionSource / SubAgentSource / ThreadSource 的等价数据模型
# (对标 protocol.rs:2820-3063;均为纯枚举,与 Session/tokio 无耦合)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SubAgentSource:
    """子代理来源(对标 protocol.rs:2902 SubAgentSource)。"""

    tag: str  # "review" | "compact" | "thread_spawn" | "memory_consolidation" | "other"
    label: Optional[str] = None  # Other 变体携带的自定义标签

    @staticmethod
    def review() -> "SubAgentSource":
        return SubAgentSource("review")

    @staticmethod
    def compact() -> "SubAgentSource":
        return SubAgentSource("compact")

    @staticmethod
    def memory_consolidation() -> "SubAgentSource":
        return SubAgentSource("memory_consolidation")

    @staticmethod
    def thread_spawn() -> "SubAgentSource":
        return SubAgentSource("thread_spawn")

    @staticmethod
    def other(label: str) -> "SubAgentSource":
        return SubAgentSource("other", label)

    def kind(self) -> str:
        """对标 protocol.rs:3042 SubAgentSource::kind()。"""
        if self.tag == "review":
            return "review"
        if self.tag == "compact":
            return "compact"
        if self.tag == "thread_spawn":
            return "thread_spawn"
        if self.tag == "memory_consolidation":
            return "memory_consolidation"
        if self.tag == "other":
            return self.label if self.label is not None else ""
        return ""


@dataclass(frozen=True)
class SessionSource:
    """会话来源(对标 protocol.rs:2820 SessionSource)。"""

    tag: str  # cli | vscode | exec | mcp | custom | internal | subagent | unknown
    internal: Optional[str] = None  # internal 变体携带的 kind 字符串
    subagent: Optional[SubAgentSource] = None
    custom: Optional[str] = None

    @staticmethod
    def cli() -> "SessionSource":
        return SessionSource("cli")

    @staticmethod
    def vscode() -> "SessionSource":
        return SessionSource("vscode")

    @staticmethod
    def exec() -> "SessionSource":
        return SessionSource("exec")

    @staticmethod
    def mcp() -> "SessionSource":
        return SessionSource("mcp")

    @staticmethod
    def unknown() -> "SessionSource":
        return SessionSource("unknown")

    @staticmethod
    def from_custom(value: str) -> "SessionSource":
        return SessionSource("custom", custom=value)

    @staticmethod
    def from_internal(kind: str) -> "SessionSource":
        return SessionSource("internal", internal=kind)

    @staticmethod
    def from_subagent(src: SubAgentSource) -> "SessionSource":
        return SessionSource("subagent", subagent=src)


@dataclass(frozen=True)
class CompactionTurnMetadata:
    """对话压缩请求元数据(对标 responses_metadata.rs:114-121)。"""

    trigger: str
    reason: str
    implementation: str
    phase: str
    strategy: str = "memento"

    def as_dict(self) -> dict[str, str]:
        return {
            "trigger": self.trigger,
            "reason": self.reason,
            "implementation": self.implementation,
            "phase": self.phase,
            "strategy": self.strategy,
        }


@dataclass(frozen=True)
class CodexResponsesRequestKind:
    """请求种类(对标 responses_metadata.rs:156-177)。"""

    tag: str  # "turn" | "prewarm" | "compaction" | "memory"
    compaction: Optional[CompactionTurnMetadata] = None

    def metadata(self) -> Tuple[Optional[str], Optional[CompactionTurnMetadata]]:
        """对标 CodexResponsesRequestKind::metadata():返回 (request_kind 字符串, 压缩元数据)。"""
        if self.tag == "turn":
            return ("turn", None)
        if self.tag == "prewarm":
            return ("prewarm", None)
        if self.tag == "compaction":
            return ("compaction", self.compaction)
        if self.tag == "memory":
            return ("memory", None)
        return (None, None)

    def has_thread_identity(self) -> bool:
        """对标 has_thread_identity():除 Memory 外均携带线程身份。"""
        return self.tag != "memory"


# ---------------------------------------------------------------------------
# subagent header / kind 生成(对标 responses_metadata.rs:435-465)
# ---------------------------------------------------------------------------
def subagent_header_value(session_source: SessionSource) -> Optional[str]:
    """返回应写入 x-openai-subagent header 的值;非子代理来源返回 None。"""
    if session_source.tag == "subagent" and session_source.subagent is not None:
        sub = session_source.subagent
        if sub.tag == "review":
            return "review"
        if sub.tag == "compact":
            return "compact"
        if sub.tag == "memory_consolidation":
            return "memory_consolidation"
        if sub.tag == "thread_spawn":
            return "collab_spawn"
        if sub.tag == "other":
            return sub.label
        return None
    if session_source.tag == "internal" and session_source.internal is not None:
        return session_source.internal
    return None


def subagent_metadata_kind(session_source: SessionSource) -> Optional[str]:
    """返回 subagent_kind metadata 的值(仅 SubAgent 来源有);其余返回 None。"""
    if session_source.tag == "subagent" and session_source.subagent is not None:
        return session_source.subagent.kind()
    return None


# ---------------------------------------------------------------------------
# extra metadata 过滤 / 校验(对标 responses_metadata.rs:473-510)
# ---------------------------------------------------------------------------
def valid_extra_metadata_key(key: str) -> bool:
    """键必须是:首字符 ASCII 字母,其余为 ASCII 字母数字或 _ . -。"""
    chars = list(key)
    if not chars:
        return False
    first = chars[0]
    if not first.isascii() or not first.isalpha():
        return False
    for ch in chars[1:]:
        if not (ch.isascii() and (ch.isalnum() or ch in ("_", ".", "-"))):
            return False
    return True


def validate_extra_metadata(extra: Iterable[Tuple[str, str]]) -> None:
    """校验 extra metadata;非法时抛 ValueError(消息与 Rust 版一致)。

    规则:最多 16 条;键 ≤64 字节且为合法 ASCII 标识符;非向后兼容的保留键被拒;
    值 ≤128 字节。
    """
    count = 0
    for key, value in extra:
        count += 1
        if count > MAX_EXTRA_METADATA_ENTRIES:
            raise ValueError("responses_api_metadata may contain at most 16 entries")
        if (
            len(key.encode("utf-8")) > MAX_EXTRA_METADATA_KEY_BYTES
            or not valid_extra_metadata_key(key)
        ):
            raise ValueError("responses_api_metadata keys must be short ASCII identifiers")
        if (
            key in RESERVED_METADATA_KEYS
            and key not in BACKWARD_COMPATIBLE_RESERVED_METADATA_KEYS
        ):
            raise ValueError("responses_api_metadata contains a reserved key")
        if len(value.encode("utf-8")) > MAX_EXTRA_METADATA_VALUE_BYTES:
            raise ValueError("responses_api_metadata values may contain at most 128 bytes")


def filter_extra_metadata(extra: Iterable[Tuple[str, str]]) -> dict[str, str]:
    """过滤掉所有保留键(app-server 不能覆盖 core 自有字段)。对标 filter_extra_metadata。"""
    result: dict[str, str] = {}
    for key, value in extra:
        if key not in RESERVED_METADATA_KEYS:
            result[key] = value
    return result


def truncate_extra_metadata_value(value: str) -> str:
    """按 MAX_EXTRA_METADATA_VALUE_BYTES(128)字节上限截断值,且不在多字节字符中途切断。

    Rust 端通过 validate_extra_metadata 直接拒绝超长值;此处提供等价的**截断**工具,
    使 Python 端在无法回退时仍可安全落库(对标 MAX_EXTRA_METADATA_VALUE_BYTES 上限语义)。
    """
    encoded = value.encode("utf-8")
    if len(encoded) <= MAX_EXTRA_METADATA_VALUE_BYTES:
        return value
    truncated = encoded[:MAX_EXTRA_METADATA_VALUE_BYTES]
    # 丢弃落在多字节字符尾部的续字节,直到遇到首字节(或 ASCII)。
    while truncated and (truncated[-1] & 0xC0) == 0x80:
        truncated = truncated[:-1]
    return truncated.decode("utf-8", errors="ignore")


# ---------------------------------------------------------------------------
# CodexResponsesMetadata 等价 dataclass(对标 responses_metadata.rs:223-433)
# ---------------------------------------------------------------------------
@dataclass
class CodexResponsesMetadata:
    """调用方持有的 Codex metadata 快照(对标 CodexResponsesMetadata)。

    ThreadId / Uuid 在 Rust 中是 newtype(String),此处直接以 str 承载其字符串形式。
    """

    installation_id: str = ""
    session_id: str = ""
    thread_id: str = ""
    window_id: str = ""
    parent_response_id: Optional[str] = None
    agent_name: Optional[str] = None
    turn_id: Optional[str] = None
    # routing_hint 在 Rust 中是 Option<HeaderValue>(HTTP 耦合),此处仅占位不用于投影。
    routing_hint: Optional[str] = None
    window_number: Optional[int] = None
    context_window_id: Optional[str] = None
    request_kind: Optional[CodexResponsesRequestKind] = None
    forked_from_thread_id: Optional[str] = None
    forked_from_ordinal_exclusive: Optional[int] = None
    parent_thread_id: Optional[str] = None
    parent_turn_id: Optional[str] = None
    root_turn_id: Optional[str] = None
    subagent_header: Optional[str] = None
    subagent_kind: Optional[str] = None
    thread_source: Optional[str] = None
    turn_trigger: Optional[str] = None
    sandbox: Optional[str] = None
    sandbox_mode: Optional[str] = None
    auto_review_enabled: Optional[bool] = None
    node_repl_auto_review_required: Optional[bool] = None
    node_repl_disabled: Optional[bool] = None
    workspaces: dict[str, object] = field(default_factory=_empty_obj_dict)
    tool_namespaces_info: Optional[dict[str, object]] = None
    turn_started_at_unix_ms: Optional[int] = None
    history_ingest_requested: Optional[bool] = None
    analytics_enabled: Optional[bool] = None
    extra: dict[str, str] = field(default_factory=_empty_str_dict)

    @staticmethod
    def new(
        installation_id: str,
        session_id: str,
        thread_id: str,
        window_id: str,
    ) -> "CodexResponsesMetadata":
        """对标 CodexResponsesMetadata::new()。"""
        return CodexResponsesMetadata(
            installation_id=installation_id,
            session_id=session_id,
            thread_id=thread_id,
            window_id=window_id,
        )

    def has_turn_metadata(self) -> bool:
        """对标 has_turn_metadata():request_kind 已设置即视为有 turn metadata。"""
        return self.request_kind is not None

    def _has_thread_identity(self) -> bool:
        return self.request_kind is None or self.request_kind.has_thread_identity()

    def _has_request_identity(self) -> bool:
        return self.request_kind is not None and self.request_kind.has_thread_identity()

    def as_dict(self) -> dict[str, object]:
        """对标 turn_metadata_payload():生成 Codex turn metadata 投影(dict)。

        语义同 serde(skip_serializing_if = "Option::is_none" + flatten extra):
        None 字段省略,extra 中的键拍平到顶层。
        """
        has_thread = self._has_thread_identity()
        has_request = self._has_request_identity()
        payload: dict[str, object] = {}
        if has_request:
            payload[INSTALLATION_ID_KEY] = self.installation_id
        if has_thread:
            payload[SESSION_ID_KEY] = self.session_id
            payload[THREAD_ID_KEY] = self.thread_id
            if self.agent_name is not None:
                payload[AGENT_NAME_KEY] = self.agent_name
        if self.turn_id is not None:
            payload[TURN_ID_KEY] = self.turn_id
        if has_request:
            payload[WINDOW_ID_KEY] = self.window_id
            if self.window_number is not None:
                payload[WINDOW_NUMBER_KEY] = self.window_number
            if self.context_window_id is not None:
                payload[CONTEXT_WINDOW_ID_KEY] = self.context_window_id
        request_kind_value, compaction = self._request_kind_metadata()
        if request_kind_value is not None:
            payload[REQUEST_KIND_KEY] = request_kind_value
        if self.forked_from_thread_id is not None:
            payload[FORKED_FROM_THREAD_ID_KEY] = self.forked_from_thread_id
        if self.forked_from_ordinal_exclusive is not None:
            payload[FORKED_FROM_ORDINAL_EXCLUSIVE_KEY] = self.forked_from_ordinal_exclusive
        if self.parent_thread_id is not None:
            payload[PARENT_THREAD_ID_KEY] = self.parent_thread_id
        if self.parent_turn_id is not None:
            payload[PARENT_TURN_ID_KEY] = self.parent_turn_id
        if self.root_turn_id is not None:
            payload[ROOT_TURN_ID_KEY] = self.root_turn_id
        if self.subagent_kind is not None:
            payload[SUBAGENT_KIND_KEY] = self.subagent_kind
        if self.thread_source is not None:
            payload[THREAD_SOURCE_KEY] = self.thread_source
        if self.turn_trigger is not None:
            payload[TURN_TRIGGER_KEY] = self.turn_trigger
        if self.sandbox is not None:
            payload[SANDBOX_KEY] = self.sandbox
        if self.sandbox_mode is not None:
            payload[SANDBOX_MODE_KEY] = self.sandbox_mode
        if self.auto_review_enabled is not None:
            payload[AUTO_REVIEW_ENABLED_KEY] = self.auto_review_enabled
        if self.node_repl_auto_review_required is not None:
            payload[NODE_REPL_AUTO_REVIEW_REQUIRED_KEY] = self.node_repl_auto_review_required
        if self.node_repl_disabled is not None:
            payload[NODE_REPL_DISABLED_KEY] = self.node_repl_disabled
        if self.workspaces:
            payload[WORKSPACES_KEY] = self.workspaces
        if self.tool_namespaces_info is not None:
            payload[TOOL_NAMESPACES_INFO_KEY] = self.tool_namespaces_info
        if self.turn_started_at_unix_ms is not None:
            payload[TURN_STARTED_AT_UNIX_MS_KEY] = self.turn_started_at_unix_ms
        if self.history_ingest_requested is not None:
            payload[HISTORY_INGEST_REQUESTED_KEY] = self.history_ingest_requested
        if self.analytics_enabled is not None:
            payload[ANALYTICS_ENABLED_KEY] = self.analytics_enabled
        if compaction is not None:
            payload[COMPACTION_KEY] = compaction.as_dict()
        # 拍平 extra 到顶层。
        for k, v in self.extra.items():
            payload[k] = v
        return payload

    def as_json(self) -> str:
        """对标 turn_metadata_json():ASCII JSON 字符串(ensure_ascii=True 等价 to_ascii_json_string)。"""
        return json.dumps(self.as_dict(), ensure_ascii=True)

    def client_metadata(self) -> dict[str, str]:
        """对标 client_metadata():返回扁平 client_metadata 投影(dict 形式,等价 HTTP/WebSocket 头)。"""
        client: dict[str, str] = {
            X_CODEX_INSTALLATION_ID_HEADER: self.installation_id,
            SESSION_ID_KEY: self.session_id,
            THREAD_ID_KEY: self.thread_id,
            X_CODEX_WINDOW_ID_HEADER: self.window_id,
        }
        if self.turn_id is not None:
            client[TURN_ID_KEY] = self.turn_id
        if self.subagent_header is not None:
            client[X_OPENAI_SUBAGENT_HEADER] = self.subagent_header
        if self.parent_thread_id is not None:
            client[X_CODEX_PARENT_THREAD_ID_HEADER] = self.parent_thread_id
        if self.parent_turn_id is not None:
            client[PARENT_TURN_ID_KEY] = self.parent_turn_id
        if self.root_turn_id is not None:
            client[ROOT_TURN_ID_KEY] = self.root_turn_id
        if self.has_turn_metadata():
            client[X_CODEX_TURN_METADATA_HEADER] = self.as_json()
        return client

    def _request_kind_metadata(
        self,
    ) -> Tuple[Optional[str], Optional[CompactionTurnMetadata]]:
        if self.request_kind is None:
            return (None, None)
        return self.request_kind.metadata()


# ---------------------------------------------------------------------------
# ExecutionMetadata.apply_to(对标 turn_metadata.rs:54-95)
# ---------------------------------------------------------------------------
@dataclass
class ExecutionMetadata:
    """捕获的本次执行配置(对标 ExecutionMetadata),shared by Responses 与 MCP metadata。"""

    model: str
    reasoning_effort: Optional[str]
    node_repl_disabled: bool
    auto_review_enabled: bool
    node_repl_auto_review_required: bool

    def apply_to(self, metadata: CodexResponsesMetadata) -> None:
        """对标 ExecutionMetadata::apply_to():把执行配置写回 metadata 的布尔字段与 extra。"""
        metadata.auto_review_enabled = self.auto_review_enabled
        metadata.node_repl_auto_review_required = self.node_repl_auto_review_required
        metadata.node_repl_disabled = self.node_repl_disabled
        metadata.extra[MODEL_KEY] = self.model
        if self.reasoning_effort is not None:
            metadata.extra[REASONING_EFFORT_KEY] = self.reasoning_effort
        else:
            metadata.extra.pop(REASONING_EFFORT_KEY, None)
