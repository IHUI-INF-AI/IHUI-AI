# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 级（更完整）agent 会话持久化引擎 —— 纯标准库 sqlite3 实现。

三级会话模型:Thread（跨进程持久会话）/ Turn（一次用户输入触发的完整往返）/
Item（回合内原子事件）。

设计要点(2026-09-06 立):
- 崩溃安全:WAL + synchronous=FULL + 每条写操作独立 BEGIN IMMEDIATE 事务;
- 全局单调 seq + client_item_id 幂等去重;
- FTS5 全文索引(不可用时自动降级 LIKE);
- JSON1 半结构化 payload;
- 版本化 migration 框架(schema_version 表 + 顺序迁移);
- turn 状态机:running → completed/interrupted/failed,非法迁移拒绝;
- resume 时自动修复悬挂 tool_call(补 synthetic interrupted result);
- fork 从某 item 处分支出新 thread,复制前缀;
- rollback 软删除标记,保留审计;
- compact 压缩边界 item,resume 时只回放边界后内容+摘要。

mypy --strict 通过;仅依赖标准库 sqlite3 + pydantic(项目已有)。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .branch_generation import bump_branch_generation

logger = logging.getLogger(__name__)

# ==================== Fork 边界对齐(批58十四,对标 codex thread_rollout_truncation.rs) ====================

_FORK_BOUNDARY_ALIGN_ENV = "IHUI_SESSION_FORK_BOUNDARY_ALIGN"


def _fork_boundary_align_enabled() -> bool:
    """fork 边界对齐开关(env IHUI_SESSION_FORK_BOUNDARY_ALIGN)。

    默认 off:fork 停在调用方给定 seq(与现状逐零差异);on/1/true/yes 时把 fork 点
    吸附到最近的指令回合边界(防止新 thread 以半截回合开头)。
    """
    return os.environ.get(_FORK_BOUNDARY_ALIGN_ENV, "false").strip().lower() in (
        "on",
        "1",
        "true",
        "yes",
    )


def _project_item_for_boundary(item_type: str, payload: str) -> dict[str, Any]:
    """把会话 item 行投影为 rollout ResponseItem 形态(仅边界判定所需字段)。

    对标 codex rollout 的 ResponseItem::Message 形态:user_message/agent_message
    投影为 role+content 列表(供 parse_turn_item 识别用户回合);其余 item 类型
    投影为无 role 的非 message 项(is_user_turn_boundary 恒 False)。
    """
    if item_type in ("user_message", "agent_message"):
        role = "user" if item_type == "user_message" else "assistant"
        text = ""
        try:
            parsed = json.loads(payload) if payload else None
            if isinstance(parsed, dict):
                raw = parsed.get("content")
                text = raw if isinstance(raw, str) else ""
        except (ValueError, TypeError):
            text = ""
        content_type = "input_text" if role == "user" else "output_text"
        return {
            "type": "message",
            "role": role,
            "content": [{"type": content_type, "text": text}],
        }
    return {"type": item_type}


# ==================== Item 类型族 ====================

ITEM_ENVELOPE_FIELDS: frozenset[str] = frozenset(
    {"seq", "thread_id", "turn_id", "parent_seq", "created_at", "item_type", "client_item_id"}
)


class ItemBase(BaseModel):
    """所有 Item 的公共信封。"""

    model_config = ConfigDict(extra="forbid")

    seq: int = 0
    thread_id: str = ""
    turn_id: str | None = None
    parent_seq: int | None = None
    created_at: float = Field(default_factory=time.time)
    client_item_id: str | None = None  # 客户端提供的幂等键
    item_type: str

    def search_text(self) -> str:
        return ""

    def body_payload(self) -> dict[str, Any]:
        return self.model_dump(mode="json", exclude=set(ITEM_ENVELOPE_FIELDS))


class UserMessageItem(ItemBase):
    item_type: Literal["user_message"] = "user_message"
    content: str = ""

    def search_text(self) -> str:
        return self.content


class AgentMessageItem(ItemBase):
    item_type: Literal["agent_message"] = "agent_message"
    content: str = ""
    model: str | None = None

    def search_text(self) -> str:
        return self.content


class ReasoningItem(ItemBase):
    item_type: Literal["reasoning"] = "reasoning"
    content: str = ""
    summary: str | None = None

    def search_text(self) -> str:
        return self.summary or self.content


class ToolCallItem(ItemBase):
    item_type: Literal["tool_call"] = "tool_call"
    call_id: str = ""
    tool: str = ""
    arguments: dict[str, Any] = Field(default_factory=dict)

    def search_text(self) -> str:
        return f"{self.tool} {self.arguments}"


class ToolResultItem(ItemBase):
    item_type: Literal["tool_result"] = "tool_result"
    call_id: str = ""
    ok: bool = True
    output: str = ""
    error: str | None = None

    def search_text(self) -> str:
        return self.output if self.ok else (self.error or self.output)


class FileEditItem(ItemBase):
    item_type: Literal["file_edit"] = "file_edit"
    path: str = ""
    op: Literal["create", "update", "delete"] = "update"
    before: str | None = None
    after: str | None = None
    diff: str | None = None

    def search_text(self) -> str:
        return self.path


class ApprovalRequestItem(ItemBase):
    item_type: Literal["approval_request"] = "approval_request"
    request_id: str = ""
    tool: str = ""
    arguments: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""

    def search_text(self) -> str:
        return f"{self.tool} {self.reason}"


class ApprovalResponseItem(ItemBase):
    item_type: Literal["approval_response"] = "approval_response"
    request_id: str = ""
    approved: bool = False
    decided_by: str = "user"
    comment: str | None = None

    def search_text(self) -> str:
        return self.comment or ""


class ErrorItem(ItemBase):
    """错误事件。"""

    item_type: Literal["error"] = "error"
    message: str = ""
    code: str | None = None

    def search_text(self) -> str:
        return self.message


class CompactionBoundaryItem(ItemBase):
    """压缩边界:此前条目被 summary 取代。"""

    item_type: Literal["compaction_boundary"] = "compaction_boundary"
    summary: str = ""
    first_seq: int = 0
    tokens_before: int = 0
    tokens_after: int = 0
    # 生成该摘要的模型标识(2026-09-19 第十八批,对标 Codex history::
    # CompactionCheckpoint 的 model_hash)。换模型继续用旧摘要会引入语义漂移,
    # 引擎据此判定兼容性(见 agent_engine._compaction_compatible)。
    model: str = ""

    def search_text(self) -> str:
        return self.summary


Item = (
    UserMessageItem
    | AgentMessageItem
    | ReasoningItem
    | ToolCallItem
    | ToolResultItem
    | FileEditItem
    | ApprovalRequestItem
    | ApprovalResponseItem
    | ErrorItem
    | CompactionBoundaryItem
)

ItemKind = Literal[
    "user_message",
    "agent_message",
    "reasoning",
    "tool_call",
    "tool_result",
    "file_edit",
    "approval_request",
    "approval_response",
    "error",
    "compaction_boundary",
]

ITEM_ADAPTER: TypeAdapter[Any] = TypeAdapter(
    UserMessageItem
    | AgentMessageItem
    | ReasoningItem
    | ToolCallItem
    | ToolResultItem
    | FileEditItem
    | ApprovalRequestItem
    | ApprovalResponseItem
    | ErrorItem
    | CompactionBoundaryItem
)

ForkMode = Literal["shared", "copy"]

# ---------------------------------------------------------------------------
# 身份键:只能由**承载层绑定的已验证主体**写入,任何客户端可写通道都改不动它
# (2026-09-27 批 60 / G-249)
# ---------------------------------------------------------------------------
#
# 为什么要有这份清单:threads 表没有 user_id 列(见 `_SCHEMA_V1`),属主与角色只存在
# metadata JSON 里,而 metadata 是**客户端可整写**的字段(`thread/metadata` 的
# merge=False、`POST /sessions/threads` 的 body.metadata)。实测两条敞口:
#   · alice 的一次 merge=False 整写就把 `userId`/`roleId` 一起冲掉 ⇒ 重启恢复出的
#     线程无属主 ⇒ 按 `_principal_allows` ② 的"无从对账"语义,**任何**已登录连接都能
#     操作它(探针 .ihui-agent/tmp/b59/probe-meta-before.txt 记为 VULNERABLE);
#   · 反过来,body.metadata 里塞 `userId:"<victim>"` 就能把线程**认领成别人的** ——
#     它会出现在受害者的 thread.list 里,且只有受害者能续跑它。
# 所以判序只有一处定义:创建时由显式入参盖章(调用方传进来的 metadata 一律先剥),
# 之后任何 patch 都从**已落库的那份**带回来。这里刻意不写"哪些端点算客户端"的清单 ——
# 清单必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 的教训);不变量落在最下面的写入口上。
IDENTITY_METADATA_KEYS: tuple[str, ...] = ("userId", "roleId")


def scrub_identity_keys(metadata: dict[str, Any]) -> dict[str, Any]:
    """剥掉调用方自带的身份键(返回新 dict,不改入参)。"""
    return {k: v for k, v in metadata.items() if k not in IDENTITY_METADATA_KEYS}


def carry_identity_keys(current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    """让身份键以 `current`(已落库的那份)为准盖回 `proposed`。

    `current` 里没有该键 ⇒ 从 `proposed` 里**删掉**,而不是留下调用方写的新值:
    "没有属主"与"属主是攻击者选的那个人"必须区分开,后者是伪造,前者只是未绑定。
    """
    result = dict(proposed)
    for key in IDENTITY_METADATA_KEYS:
        if key in current:
            result[key] = current[key]
        else:
            result.pop(key, None)
    return result


# ---------------------------------------------------------------------------
# D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」):
# 会话内「目标(goal)」的服务侧主副本 —— 第三条通道,与上面两条都**不相交**
# ---------------------------------------------------------------------------
#
# 为什么单开一组,而不是并进 IDENTITY_METADATA_KEYS 或 ENGINE_OWNED_METADATA_KEYS:
#   · 身份键的真值来自「承载层绑定的已验证主体」,配置段的真值来自「线程当前生效的
#     配置」,而 goalState 的真值来自 **POST /llm/sessions/{session_id}/goal 这一条
#     服务端专有写入口**(set/pause/resume/clear)。三种判序不同,混用就是本仓反复
#     记过的「两处算同一件事必漂移」。
#   · 引擎自己已有一个 `goal` 字符串键(`_engine_config_of` 注入 system 用),那是
#     **提示词载荷**不是**状态机**;这里落的是 `goalState`(带 status 的对象),
#     两个键名刻意不同,免得一次系统提示注入顺带把状态机改了。
#   · 零迁移:它就是一个 metadata 键,不新增列、不建新表(拍板口径)。
GOAL_METADATA_KEYS: tuple[str, ...] = ("goalState",)

# goal 状态六档(2026-09-29 拍板:在现存四态上并入 usageLimited/budgetLimited)。
# ⚠️ 这是**第三个域**:与 packages/types/src/agent-runtime.ts 的 AGENT_TASK_STATUSES
#    (Kanban 六档)与 WORKSPACE_AGENT_TASK_STATUSES **不得并集**,同名值
#    (blocked/done)属同词不同义 —— 守门 check-agent-status-vocabulary-parity 判的
#    是前两个域的等值与本域的「不得被并进去」,加档必须同枚补齐五语言词表(AGENTS §30)。
GOAL_STATUSES: tuple[str, ...] = (
    "active",
    "paused",
    "blocked",
    "done",
    "usageLimited",
    "budgetLimited",
)


def scrub_goal_keys(metadata: dict[str, Any]) -> dict[str, Any]:
    """创建时剥掉调用方自带的 goalState(返回新 dict,不改入参)。

    与 `scrub_identity_keys` 同一条理由:`POST /sessions/threads` 的 body.metadata
    是客户端可整写的字段,若允许自带 goalState,就等于把「这台浏览器声称的目标状态」
    写成服务端主副本 —— 换浏览器即分叉,正是本票要修的那一型。
    """
    return {k: v for k, v in metadata.items() if k not in GOAL_METADATA_KEYS}


def carry_goal_keys(current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
    """让 goalState 以 `current`(已落库的那份)为准盖回 `proposed`。

    判序与 `carry_identity_keys` 逐字同形:current 没有该键 ⇒ 从结果里**删掉**,
    而不是留下调用方写的新值。合法写口是 `set_thread_goal_state`(它直接写 metadata,
    不经本函数),所以客户端任何一次 `thread/metadata` 整写(merge=False)都既抹不掉
    也改不动服务端那份。
    """
    result = dict(proposed)
    for key in GOAL_METADATA_KEYS:
        if key in current:
            result[key] = current[key]
        else:
            result.pop(key, None)
    return result


def normalize_goal_state(raw: Any) -> dict[str, Any] | None:
    """把 goalState 收窄成受管形状;形状不对一律返回 None(不猜、不静默补默认)。"""
    if not isinstance(raw, dict):
        return None
    status = raw.get("status")
    if not isinstance(status, str) or status not in GOAL_STATUSES:
        return None
    objective = raw.get("objective")
    state: dict[str, Any] = {
        "status": status,
        "objective": objective if isinstance(objective, str) else "",
    }
    for num_key in ("elapsedMs", "tokenUsage"):
        value = raw.get(num_key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value >= 0:
            state[num_key] = value
    updated_at = raw.get("updatedAt")
    if isinstance(updated_at, (int, float)) and not isinstance(updated_at, bool):
        state["updatedAt"] = float(updated_at)
    return state


# ---------------------------------------------------------------------------
# 引擎 owns 的配置段:由引擎写入、客户端不得经 `thread/metadata` 整写冲掉
# (2026-09-27 G-255)
# ---------------------------------------------------------------------------
#
# 为什么身份键之外还要这一份清单:`thread.start` 落库时把**线程当前生效的配置**
# (模型 / 权限档 / 迭代上限 / 工具集 / 工作区 / 审批策略 / token 预算 / 自动压缩 /
# 系统提示……)整体写进 `threads.metadata`,注释就写着"供重启恢复还原"。而
# `agent_engine._handle_thread_metadata` 无论 merge 与否,落库那一趟走的都是
# `update_thread_metadata(..., merge=False)` —— 于是客户端一次只带业务键的 metadata
# 写入,就会把库里这十几个配置键整行替换掉。内存侧那时还是空 dict(引擎的配置住在
# `EngineThread` 字段上,不住在 `thread.metadata` 里),所以进程内一切正常,只有**重启
# 恢复**时才现形:恢复侧按缺省还原(`model` → None、`permissionMode` → 校验失败、
# `maxIterations` → 8……),表现为"线程的配置在重启后悄悄换了一套",而任何一次调用
# 的响应体都看不见这一格。身份那三条(批 60)只盖住 `userId`/`roleId`,所以这一型
# 当时仍然无人看守。
#
# 清单内容不是手抄直觉,而是从**写侧实际写了什么**推导:`agent_engine.
# AgentEngine._engine_config_of` 逐键给出线程当前生效值,`_persist_thread_created`
# 写库的就是它的产物;那个方法在构造完字典后与本清单做双向对账(缺一个键或多一个键
# 即抛),所以清单与实际写入永不漂开 —— 两处各记一份"哪些键算引擎的"正是本仓反复
# 记过的失效型。
#
# 与 `IDENTITY_METADATA_KEYS` 是两条独立通道、键集刻意不相交:身份键的真值来自
# "承载层绑定的已验证主体",配置段的真值来自"线程当前生效的配置",两者判序不同
# (见 `carry_identity_keys` / `carry_engine_owned_keys` 的 docstring)。
# **不得**把配置名塞进 `IDENTITY_METADATA_KEYS` —— 那条通道会把"引擎刚改的档位"和
# "库里那行旧值"混成一件事。
ENGINE_OWNED_METADATA_KEYS: tuple[str, ...] = (
    "sessionId",
    "model",
    "permissionMode",
    "maxIterations",
    "toolNames",
    "workspace",
    "conversationId",
    "approvalPolicies",
    "modelParams",
    "reasoning",
    "denyTools",
    "tokenBudget",
    "goal",
    "outputSchema",
    "autoCompact",
    "autoCompactThreshold",
    "role",
    "systemPromptSource",
    "systemPrompt",
)


def carry_engine_owned_keys(
    provided: dict[str, Any], proposed: dict[str, Any]
) -> dict[str, Any]:
    """让引擎 owns 的配置段以 `provided`(引擎当场给出的生效值)盖回 `proposed`。

    守的位置是 **RPC 处理器** `agent_engine._handle_thread_metadata`(客户端 metadata
    的唯一入口),真值取**线程当前生效的配置**,而**不是库里那一行的旧值**。理由是要紧
    的一条:合法写者与客户端整写走的是**同一个** `update_thread_metadata(merge=False)`
    出口 —— `thread.settings` 先改档位(写 `EngineThread` 字段)、随后一次 metadata
    整写,若在 store 咽喉点按"库里那行为准"回灌,就会把**刚改的档位**回滚成改之前的
    旧值(实测这条正向对照见 tests/test_thread_metadata_config_segment.py)。取"线程
    当前值"则两种结果同时成立:整写冲不掉配置段,也冲不掉刚生效的新配置。

    `provided` 里没有某键 ⇒ 从结果里**删掉**该键,而不是留下调用方写的新值 —— 与
    `carry_identity_keys` 同一条判序:引擎不再产出该配置项时,客户端不得替它占位。
    业务键(清单之外)一律照原样保留,所以"整写"仍然能整体替换业务段 —— 本函数收的
    是配置段被连带抹掉,不是把 metadata 冻成只读。
    """
    result = dict(proposed)
    for key in ENGINE_OWNED_METADATA_KEYS:
        if key in provided:
            result[key] = provided[key]
        else:
            result.pop(key, None)
    return result


def owner_scoped_allows(principal: str | None, owner: str | None) -> bool:
    """**只读/销毁面**的严格属主判据:带身份时要求逐字相等(批 61 / G-250)。

    与 `agent_engine._principal_allows` 只差一格:`principal` 有值而 `owner` 没有 ——
    这里判**不通过**,那边判"无从对账"。差这一格是有意的,不是漂移:

      · `_principal_allows` 守的是"已经建在内存里的线程归谁",那条线程是同一台引擎在
        无人可证明身份时创建的(dev 通道),放宽它才不会把既有 dev/未鉴权链路改坏;
      · 只读/销毁面拿到的是一个**任意 threadId**。无属主的那批行(未鉴权通道建的、
        批 60 之前被整写抹掉身份的、fork/relay 派生的)一旦被认作"谁都能读",
        就是"第一个带身份的调用者可以读走所有人没绑身份的会话"。

    所以本判据与 `list_threads(owner_user_id=…)` / `full_text_search(owner_user_id=…)`
    的 SQL 过滤**同形**:两处算同一件事必须一份实现,否则"列表里看不到但能直接读"这种
    自相矛盾会长期存在。`principal` 为 None(未鉴权/dev 通道)时仍然全放。
    """
    if principal is None:
        return True
    return isinstance(owner, str) and owner == principal


def thread_owner(thread: Thread | None) -> str | None:
    """从库里那一行取属主(行不存在 / 键缺席 / 值不合型 ⇒ None)。"""
    if thread is None:
        return None
    owner = thread.metadata.get("userId")
    return owner if isinstance(owner, str) and owner else None
TurnStatus = Literal["running", "completed", "interrupted", "failed"]

# 合法状态迁移表
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "running": {"completed", "interrupted", "failed"},
    "completed": set(),
    "interrupted": set(),
    "failed": set(),
}


# ==================== Thread / Turn / 辅助模型 ====================


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    turn_id: str
    thread_id: str
    turn_seq: int
    status: TurnStatus = "running"
    started_at: float = Field(default_factory=time.time)
    ended_at: float | None = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Thread(BaseModel):
    model_config = ConfigDict(extra="forbid")

    thread_id: str
    title: str = ""
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    metadata: dict[str, Any] = Field(default_factory=dict)
    parent_thread_id: str | None = None
    fork_point_seq: int | None = None
    fork_mode: ForkMode | None = None
    archived: bool = False
    archived_at: float | None = None
    item_count: int = 0
    last_seq: int | None = None


class ThreadPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    threads: list[Thread] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False


class SearchHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seq: int
    thread_id: str
    item_type: ItemKind
    snippet: str
    score: float | None = None


class LLMMessage(BaseModel):
    """OpenAI 风格消息(replay 出口)。"""

    model_config = ConfigDict(extra="allow")

    role: str
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None


# ==================== 异常 ====================


class ThreadNotFoundError(KeyError):
    pass


class TurnNotFoundError(KeyError):
    pass


class TurnMismatchError(ValueError):
    pass


class InvalidTurnTransitionError(ValueError):
    """非法 turn 状态迁移。"""

    pass


class DuplicateItemError(ValueError):
    """client_item_id 重复(幂等去重)。"""

    pass


# ==================== Schema DDL ====================

_SCHEMA_V1 = """
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  REAL    NOT NULL,
    description TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta (key, value) VALUES ('last_seq', '0');

CREATE TABLE IF NOT EXISTS threads (
    thread_id         TEXT    PRIMARY KEY,
    title             TEXT    NOT NULL DEFAULT '',
    created_at        REAL    NOT NULL,
    updated_at        REAL    NOT NULL,
    metadata          TEXT    NOT NULL DEFAULT '{}',
    parent_thread_id  TEXT,
    fork_point_seq    INTEGER,
    fork_mode         TEXT,
    archived          INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS turns (
    turn_id    TEXT    PRIMARY KEY,
    thread_id  TEXT    NOT NULL,
    turn_seq   INTEGER NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'running',
    started_at REAL    NOT NULL,
    ended_at   REAL,
    error      TEXT,
    metadata   TEXT    NOT NULL DEFAULT '{}',
    UNIQUE(thread_id, turn_seq),
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_turns_thread ON turns(thread_id, turn_seq);

CREATE TABLE IF NOT EXISTS items (
    seq            INTEGER PRIMARY KEY,
    thread_id      TEXT    NOT NULL,
    turn_id        TEXT,
    parent_seq     INTEGER,
    item_type      TEXT    NOT NULL,
    created_at     REAL    NOT NULL,
    payload        TEXT    NOT NULL,
    search_text    TEXT    NOT NULL DEFAULT '',
    client_item_id TEXT,
    content_hash   TEXT,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id),
    FOREIGN KEY (turn_id) REFERENCES turns(turn_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_client_id
    ON items(client_item_id) WHERE client_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_thread ON items(thread_id, seq);
CREATE INDEX IF NOT EXISTS idx_items_turn ON items(turn_id, seq);

CREATE TABLE IF NOT EXISTS rollbacks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id    TEXT    NOT NULL,
    to_seq       INTEGER NOT NULL,
    reason       TEXT    NOT NULL DEFAULT '',
    created_at   REAL    NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_rollbacks_thread ON rollbacks(thread_id, to_seq DESC);
"""

_FTS5_DDL = """
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    search_text,
    seq UNINDEXED,
    thread_id UNINDEXED,
    item_type UNINDEXED,
    tokenize='unicode61'
);
"""


_RELAY_DDL = """
CREATE TABLE IF NOT EXISTS relay_summaries (
    summary_id      TEXT    PRIMARY KEY,
    thread_id       TEXT    NOT NULL,
    prev_thread_id  TEXT,
    objective       TEXT    NOT NULL DEFAULT '',
    payload         TEXT    NOT NULL,
    refined         INTEGER NOT NULL DEFAULT 0,
    created_at      REAL    NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_relay_thread ON relay_summaries(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relay_created ON relay_summaries(created_at DESC);
"""


# ==================== 工具函数 ====================


def _now() -> float:
    # 并发写入会把"读快照时的旧时刻"压到已推进的值之上,故 threads.updated_at 一律写 max(列现值, 本函数值)。
    return time.time()


def _content_hash(item: ItemBase) -> str:
    """基于 item_type + body_payload 的内容哈希(用于去重辅助)。"""
    raw = json.dumps(item.body_payload(), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _row_str(row: sqlite3.Row, key: str) -> str:
    return str(row[key])


def _row_float(row: sqlite3.Row, key: str) -> float:
    return float(row[key])


def _row_int(row: sqlite3.Row, key: str) -> int:
    return int(row[key])


def _row_opt_int(row: sqlite3.Row, key: str) -> int | None:
    v = row[key]
    return None if v is None else int(v)


def _row_opt_str(row: sqlite3.Row, key: str) -> str | None:
    v = row[key]
    return None if v is None else str(v)


def _row_opt_float(row: sqlite3.Row, key: str) -> float | None:
    v = row[key]
    return None if v is None else float(v)


def _json_dict(raw: str) -> dict[str, Any]:
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _probe_fts5(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE temp._fts_probe USING fts5(x)")
        conn.execute("DROP TABLE temp._fts_probe")
        return True
    except sqlite3.OperationalError:
        return False


def _row_to_thread(row: sqlite3.Row) -> Thread:
    return Thread(
        thread_id=_row_str(row, "thread_id"),
        title=_row_str(row, "title"),
        created_at=_row_float(row, "created_at"),
        updated_at=_row_float(row, "updated_at"),
        metadata=_json_dict(_row_str(row, "metadata")),
        parent_thread_id=_row_opt_str(row, "parent_thread_id"),
        fork_point_seq=_row_opt_int(row, "fork_point_seq"),
        fork_mode=cast(ForkMode | None, _row_opt_str(row, "fork_mode")),
        archived=bool(row["archived"]),
        archived_at=_row_opt_float(row, "archived_at"),
    )


def _row_to_turn(row: sqlite3.Row) -> Turn:
    return Turn(
        turn_id=_row_str(row, "turn_id"),
        thread_id=_row_str(row, "thread_id"),
        turn_seq=_row_int(row, "turn_seq"),
        status=cast(TurnStatus, _row_str(row, "status")),
        started_at=_row_float(row, "started_at"),
        ended_at=None if row["ended_at"] is None else _row_float(row, "ended_at"),
        error=_row_opt_str(row, "error"),
        metadata=_json_dict(_row_str(row, "metadata")),
    )


def _row_to_item(row: sqlite3.Row) -> ItemBase:
    envelope: dict[str, Any] = {
        "seq": _row_int(row, "seq"),
        "thread_id": _row_str(row, "thread_id"),
        "turn_id": _row_opt_str(row, "turn_id"),
        "parent_seq": _row_opt_int(row, "parent_seq"),
        "created_at": _row_float(row, "created_at"),
        "item_type": _row_str(row, "item_type"),
        "client_item_id": _row_opt_str(row, "client_item_id"),
    }
    data: dict[str, Any] = dict(json.loads(_row_str(row, "payload")))
    data.update(envelope)
    obj = ITEM_ADAPTER.validate_python(data)
    if not isinstance(obj, ItemBase):
        raise ValueError(f"非法 item: {envelope['item_type']}")
    return obj


# ==================== SessionStore ====================


class SessionStore:
    """Codex 级会话持久化引擎。"""

    SCHEMA_VERSION = 4  # v1=基线, v2=FTS5, v3=跨会话接力摘要, v4=threads.archived_at 归档时刻

    def __init__(
        self,
        db_path: str | Path,
        *,
        busy_timeout_ms: int = 5000,
        synchronous: str = "FULL",
    ) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(
            str(self._path),
            check_same_thread=False,
            isolation_level=None,
        )
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(f"PRAGMA synchronous={synchronous}")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._fts_enabled = False
        self._migrate()

    @property
    def db_path(self) -> Path:
        return self._path

    @property
    def fts_enabled(self) -> bool:
        return self._fts_enabled

    @property
    def schema_version(self) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT MAX(version) AS v FROM schema_version"
            ).fetchone()
        return 0 if row is None or row["v"] is None else _row_int(row, "v")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def __enter__(self) -> SessionStore:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ==================== Migration ====================

    def _migrate(self) -> None:
        with self._lock:
            self._conn.executescript(_SCHEMA_V1)
            if not self._has_version(1):
                self._add_version(1, "baseline: threads/turns/items/rollbacks")
            if _probe_fts5(self._conn):
                self._conn.executescript(_FTS5_DDL)
                if not self._has_version(2):
                    # 回填已有数据
                    self._conn.execute(
                        "INSERT OR IGNORE INTO items_fts (search_text, seq, thread_id, item_type)"
                        " SELECT search_text, seq, thread_id, item_type FROM items"
                        " WHERE search_text <> ''"
                    )
                    self._add_version(2, "fts5: items_fts virtual table")
                self._fts_enabled = True
            # v3: 跨会话接力摘要表(复用现有 sqlite 引擎,不另造存储层)
            self._conn.executescript(_RELAY_DDL)
            if not self._has_version(3):
                self._add_version(3, "relay_summaries: cross-session relay summary")
            # v4: 归档时刻墓碑列(G-815919)。删除动作留下的是可恢复的标记,
            # 不是行的消失 —— 归档进迁移、进行类型、进编解码,三格缺一不可。
            if not self._has_column("threads", "archived_at"):
                self._conn.execute("ALTER TABLE threads ADD COLUMN archived_at REAL")
            if not self._has_version(4):
                self._add_version(
                    4, "threads.archived_at: tombstone timestamp (G-815919)"
                )

    def _has_version(self, version: int) -> bool:
        row = self._conn.execute(
            "SELECT 1 AS x FROM schema_version WHERE version = ?", (version,)
        ).fetchone()
        return row is not None

    def _has_column(self, table: str, column: str) -> bool:
        rows = self._conn.execute(f"PRAGMA table_info({table})").fetchall()
        return any(_row_str(r, "name") == column for r in rows)

    def _add_version(self, version: int, description: str) -> None:
        self._conn.execute(
            "INSERT INTO schema_version (version, applied_at, description) VALUES (?,?,?)",
            (version, _now(), description),
        )

    # ==================== Thread CRUD ====================

    def create_thread(
        self,
        *,
        title: str = "",
        metadata: dict[str, Any] | None = None,
        thread_id: str | None = None,
        parent_thread_id: str | None = None,
        fork_point_seq: int | None = None,
        fork_mode: ForkMode | None = None,
        user_id: str | None = None,
        role_id: int | None = None,
    ) -> Thread:
        """新建线程。**身份只能从 user_id/role_id 这两个显式入参进来**。

        调用方在 metadata 里自带的 userId/roleId 一律先剥掉(见 IDENTITY_METADATA_KEYS
        上方那段实测)—— 否则 `POST /sessions/threads` 等于把"认领别人的会话"开放给
        任何已登录用户。显式入参由承载层传(令牌主体),不是由请求体传。
        """
        import uuid

        tid = thread_id or uuid.uuid4().hex
        now = _now()
        stored = scrub_goal_keys(scrub_identity_keys(dict(metadata or {})))
        if user_id:
            stored["userId"] = user_id
        if role_id:
            stored["roleId"] = role_id
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO threads (thread_id, title, created_at, updated_at, metadata,"
                " parent_thread_id, fork_point_seq, fork_mode, archived)"
                " VALUES (?,?,?,?,?,?,?,?,0)",
                (
                    tid,
                    title,
                    now,
                    now,
                    json.dumps(stored, ensure_ascii=False),
                    parent_thread_id,
                    fork_point_seq,
                    fork_mode,
                ),
            )
        return Thread(
            thread_id=tid,
            title=title,
            created_at=now,
            updated_at=now,
            metadata=dict(stored),
            parent_thread_id=parent_thread_id,
            fork_point_seq=fork_point_seq,
            fork_mode=fork_mode,
        )

    def get_thread(
        self, thread_id: str, *, include_archived: bool = False
    ) -> Thread | None:
        """按业务读路径取线程(G-815919):已归档(墓碑)的行默认不可读。

        include_archived=True 是恢复面的专用读(对标上游 codec 把 time_archived
        映射出来那一格);普通业务读不得把墓碑当活会话。
        """
        with self._lock:
            sql = "SELECT * FROM threads WHERE thread_id = ?"
            if not include_archived:
                sql += " AND archived = 0"
            row = self._conn.execute(sql, (thread_id,)).fetchone()
            if row is None:
                return None
            cnt = self._conn.execute(
                "SELECT COUNT(*) AS c, MAX(seq) AS m FROM items WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        t = _row_to_thread(row)
        t.item_count = _row_int(cnt, "c") if cnt else 0
        t.last_seq = _row_opt_int(cnt, "m") if cnt else None
        return t

    def set_thread_archived(self, thread_id: str, archived: bool) -> bool:
        """设置线程归档标记(2026-09-18 第七批,对标 Codex thread/archive)。

        Returns:
            线程是否存在并被更新。
        """
        with self._lock, self._tx() as conn:
            flag = 1 if archived else 0
            now = _now()
            # 归档时刻与布尔标记同写同清(G-815919:标记必须带时刻,两路写入口不漂移):
            # 置档 → 首次时刻(COALESCE 保留);恢复 → 墓碑清空。
            cur = conn.execute(
                "UPDATE threads SET archived = ?,"
                " archived_at = CASE WHEN ? = 1 THEN COALESCE(archived_at, ?) ELSE NULL END,"
                " updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (flag, flag, now, now, thread_id),
            )
            return cur.rowcount > 0

    def archive_thread(
        self, thread_id: str, *, archived_at: float | None = None
    ) -> int:
        """把线程归档成墓碑(G-815919):删除动作留下可恢复的标记,不是行的消失。

        行保留(items/turns 一并保留,"这条会话当时是什么状态"问库不问备份),
        archived=1 + archived_at=首次归档时刻;业务读路径(get_thread /
        list_threads)从此不可见。仅对未归档行生效(WHERE archived = 0):
        重复归档返回 0,保住 thread/delete 的幂等契约(第二次删返回
        deleted=False,对标 delete_threads 对 ThreadNotFound 静默)。

        Returns:
            被归档的线程数(0 或 1)。
        """
        ts = _now() if archived_at is None else archived_at
        with self._lock, self._tx() as conn:
            cur = conn.execute(
                "UPDATE threads SET archived = 1,"
                " archived_at = COALESCE(archived_at, ?),"
                " updated_at = max(updated_at, ?)"
                " WHERE thread_id = ? AND archived = 0",
                (ts, ts, thread_id),
            )
            return cur.rowcount

    def set_thread_name(self, thread_id: str, name: str) -> bool:
        """设置线程名称(2026-09-20 批 45,对标 Codex thread/name/set +
        update_thread_metadata name patch)。

        写 threads.title(用户可见名);调用方负责空名校验(对标
        normalize_thread_name 返回 None 即拒)。

        Returns:
            线程是否存在并被更新。
        """
        with self._lock, self._tx() as conn:
            cur = conn.execute(
                "UPDATE threads SET title = ?, updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (name, _now(), thread_id),
            )
            return cur.rowcount > 0

    def set_thread_goal_state(
        self, thread_id: str, state: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        """D152(2026-09-29 立):写 / 清 服务端那份 goal 主副本。

        这是 `goalState` 的**唯一合法写入口**,刻意不经 `update_thread_metadata`
        —— 那个咽喉点对 goalState 做的是「以库内那份为准盖回」(见
        `carry_goal_keys`),若本方法也走它,自己的写就会被自己的守卫挡掉。
        直写 metadata 的读-改-写在同一把锁 + 同一个事务里完成,只碰 `goalState`
        这一个键,其余键逐字不动(所以它不会顺带冲掉身份键或配置段)。

        Args:
            state: 已收窄的 goal 状态对象;None = 清除(clear 动作)。

        Returns:
            更新后的完整 metadata;线程不存在返回 None(调用方据此回"没这条会话")。
        """
        with self._lock, self._tx() as conn:
            row = conn.execute(
                "SELECT metadata FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone()
            if row is None:
                return None
            current = _json_dict(_row_str(row, "metadata"))
            new_meta = dict(current)
            if state is None:
                new_meta.pop("goalState", None)
            else:
                new_meta["goalState"] = state
            conn.execute(
                "UPDATE threads SET metadata = ?, updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (json.dumps(new_meta, ensure_ascii=False), _now(), thread_id),
            )
        return new_meta

    def get_thread_goal_state(self, thread_id: str) -> dict[str, Any] | None:
        """读服务端那份 goal 主副本(形状不对 ⇒ None,不猜)。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            return None
        return normalize_goal_state(thread.metadata.get("goalState"))

    def resolve_thread_id_for_conversation(self, conversation_id: str) -> str | None:
        """按 conversationId 找它的引擎线程 id(2026-09-29 D152)。

        为什么需要这一层:客户端知道的是**会话(conversationId)**,而 goal 主副本
        落在 threads.metadata 上,键是 thread_id;`ENGINE_OWNED_METADATA_KEYS` 里
        正是引擎把 conversationId 写进了自己的 metadata(`_engine_config_of`)。
        用 json_extract 定位,零新表零迁移;命中多行时取**最近一次更新**的那一行
        (同一会话重开/续跑会派生新线程,当前目标必然挂在最新那份上)。
        找不到返回 None —— 调用方必须回"没有这条会话"的同形包,不得据此区分归属。
        """
        if not conversation_id:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT thread_id FROM threads"
                " WHERE json_extract(metadata, '$.conversationId') = ?"
                " ORDER BY updated_at DESC LIMIT 1",
                (conversation_id,),
            ).fetchone()
        return _row_str(row, "thread_id") if row is not None else None

    def update_thread_metadata(
        self,
        thread_id: str,
        patch: dict[str, Any],
        *,
        merge: bool = True,
    ) -> dict[str, Any] | None:
        """线程元数据 patch 更新(2026-09-20 批 47,对标 OpenAI codex
        thread-store update_thread_metadata + ThreadMetadataPatch)。

        merge=True:把 patch 深合并进既有 threads.metadata(dict 递归合并,
        标量覆盖;patch 值为 None 的键=删除该键,对标 codex ClearableField
        语义);merge=False:整体替换为 patch。顺带更新 threads.updated_at。
        线程不存在返回 None。

        两种 merge 模式下**身份键都不受 patch 影响**(`carry_identity_keys`):
        这个方法是 metadata 的落库咽喉点,而 metadata 是客户端可整写的字段 ——
        不在这里挡住,`thread/metadata` 的一次 merge=False 就会把属主抹成"无从对账",
        或把线程认领成别人(实测见 IDENTITY_METADATA_KEYS 上方那段)。
        codex 的 ClearableField 语义因此对这两个键刻意不适用:可清除的是业务元数据,
        不是授权凭据。

        Returns:
            更新后的完整 metadata dict;线程不存在返回 None。
        """
        with self._lock, self._tx() as conn:
            row = conn.execute(
                "SELECT metadata FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone()
            if row is None:
                return None
            current = _json_dict(_row_str(row, "metadata"))
            merged = (
                self._deep_merge_metadata(current, patch) if merge else dict(patch)
            )
            new_meta = carry_goal_keys(current, carry_identity_keys(current, merged))
            conn.execute(
                "UPDATE threads SET metadata = ?, updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (json.dumps(new_meta, ensure_ascii=False), _now(), thread_id),
            )
        return new_meta

    def delete_thread(self, thread_id: str) -> int:
        """删除线程(2026-09-20 批 45,对标 Codex thread/delete + thread_store
        delete_thread 事务级联)。

        items → turns → threads 依序删除(外键引用方向),单事务保证原子;
        不存在时返回 0(幂等,对标 delete_threads 对 ThreadNotFound 静默)。
        子线程(fork 派生)按 parent_thread_id 一并级联(对标 codex
        validate_root_thread_delete 拒绝删有活跃派生的根线程 —— 我方简化为
        级联同删,派生数据随根消亡)。

        Returns:
            被删除的线程数(0 或 1)。
        """
        with self._lock, self._tx() as conn:
            ids = [r["thread_id"] for r in conn.execute(
                "SELECT thread_id FROM threads WHERE thread_id = ? OR parent_thread_id = ?",
                (thread_id, thread_id),
            ).fetchall()]
            if not ids:
                return 0
            placeholders = ",".join("?" for _ in ids)
            conn.execute(
                f"DELETE FROM items WHERE thread_id IN ({placeholders})", ids
            )
            conn.execute(
                f"DELETE FROM turns WHERE thread_id IN ({placeholders})", ids
            )
            conn.execute(
                f"DELETE FROM threads WHERE thread_id IN ({placeholders})", ids
            )
            return 1

    def list_threads(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
        owner_user_id: str | None = None,
    ) -> ThreadPage:
        """线程分页。**owner_user_id 非空时按承载层绑定的属主过滤**。

        threads 表没有 user_id 列(见 _SCHEMA),属主只存在 metadata JSON 里 ——
        所以过滤必须走 `json_extract(metadata,'$.userId')`,不能事后在响应侧筛:
        那样 total 说的是全量、threads 说的是筛过的那批,两个数出自两批行
        ("计数诚实性":回报的数字必须是被审那批的数)。WHERE 里判 ⇒ COUNT(*) 与
        被分页的天然是同一批。

        owner_user_id=None(调用方拿不到已验证身份:未鉴权/dev 通道)⇒ 不加该条件,
        全量给 —— 这是"无从对账"时的历史行为,不是"允许看别人的"。
        带 owner_user_id 时,**没有 userId 的历史行按排除**处理:它们没有可证明的
        属主,把它算进任何一个人的清单等于凭空给一个身份背书(而引擎侧
        `_principal_allows` 对 None 属主的放过只适用于"同一连接也拿不到身份"那一格;
        这里是"连接拿到了身份、行拿不到",方向相反,必须排除)。
        """
        conditions: list[str] = [] if include_archived else ["archived = 0"]
        args: list[Any] = []
        if owner_user_id is not None:
            conditions.append("json_extract(metadata, '$.userId') = ?")
            args.append(owner_user_id)
        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        with self._lock:
            total_row = self._conn.execute(
                f"SELECT COUNT(*) AS c FROM threads{where}", args
            ).fetchone()
            rows = self._conn.execute(
                f"SELECT * FROM threads{where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                [*args, max(0, int(limit)), max(0, int(offset))],
            ).fetchall()
        threads = [_row_to_thread(r) for r in rows]
        total = _row_int(total_row, "c")
        return ThreadPage(
            threads=threads,
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(threads) < total,
        )

    # ==================== Turn CRUD + 状态机 ====================

    def start_turn(
        self,
        thread_id: str,
        *,
        turn_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Turn:
        import uuid

        tid = turn_id or uuid.uuid4().hex
        now = _now()
        with self._tx() as conn:
            if conn.execute(
                "SELECT 1 FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone() is None:
                raise ThreadNotFoundError(thread_id)
            seq_row = conn.execute(
                "SELECT COALESCE(MAX(turn_seq), 0) + 1 AS n FROM turns WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
            turn_seq = _row_int(cast(sqlite3.Row, seq_row), "n")
            conn.execute(
                "INSERT INTO turns (turn_id, thread_id, turn_seq, status, started_at, metadata)"
                " VALUES (?,?,?,'running',?,?)",
                (tid, thread_id, turn_seq, now, json.dumps(metadata or {}, ensure_ascii=False)),
            )
            conn.execute(
                "UPDATE threads SET updated_at = max(updated_at, ?) WHERE thread_id = ?", (now, thread_id)
            )
        return Turn(
            turn_id=tid,
            thread_id=thread_id,
            turn_seq=turn_seq,
            status="running",
            started_at=now,
            metadata=dict(metadata or {}),
        )

    def end_turn(
        self,
        turn_id: str,
        *,
        status: TurnStatus = "completed",
        error: str | None = None,
    ) -> Turn:
        now = _now()
        with self._tx() as conn:
            row = conn.execute(
                "SELECT thread_id, status FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
            if row is None:
                raise TurnNotFoundError(turn_id)
            current = _row_str(row, "status")
            allowed = _VALID_TRANSITIONS.get(current, set())
            if status not in allowed:
                raise InvalidTurnTransitionError(
                    f"turn {turn_id}: {current} → {status} 不合法(允许: {allowed})"
                )
            conn.execute(
                "UPDATE turns SET status = ?, ended_at = ?, error = ? WHERE turn_id = ?",
                (status, now, error, turn_id),
            )
            conn.execute(
                "UPDATE threads SET updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (now, _row_str(row, "thread_id")),
            )
        return self.get_turn(turn_id) or self._ensure_turn(turn_id)

    def get_turn(self, turn_id: str) -> Turn | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
        return _row_to_turn(row) if row else None

    def revert_thread(
        self,
        thread_id: str,
        before_turn_id: str,
    ) -> int:
        """把线程持久历史截断到 before_turn_id 之前(对标 codex thread-store
        revert_thread):该 turn 及其后的全部 turns 连同其 items 一并删除,
        线程元数据保持不变。返回被删除的 turn 数;turn 不属于该线程时抛
        TurnMismatchError,线程/turn 不存在时抛 ThreadNotFoundError /
        TurnNotFoundError。调用方须先确认线程无在跑轮次(对标 codex
        'close the thread's live writer first' 语义)。"""
        with self._tx() as conn:
            if conn.execute(
                "SELECT 1 FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone() is None:
                raise ThreadNotFoundError(thread_id)
            trow = conn.execute(
                "SELECT thread_id, turn_seq FROM turns WHERE turn_id = ?",
                (before_turn_id,),
            ).fetchone()
            if trow is None:
                raise TurnNotFoundError(before_turn_id)
            owner = _row_str(cast(sqlite3.Row, trow), "thread_id")
            if owner != thread_id:
                raise TurnMismatchError(
                    f"turn {before_turn_id} 不属于 thread {thread_id}"
                )
            cutoff = _row_int(cast(sqlite3.Row, trow), "turn_seq")
            # 该 turn 及其后的 items(turn_id 关联)先删,再删 turns 本身
            cur = conn.execute(
                "DELETE FROM items WHERE thread_id = ? AND turn_id IN ("
                "SELECT turn_id FROM turns WHERE thread_id = ? AND turn_seq >= ?)",
                (thread_id, thread_id, cutoff),
            )
            _ = cur.rowcount
            cur = conn.execute(
                "DELETE FROM turns WHERE thread_id = ? AND turn_seq >= ?",
                (thread_id, cutoff),
            )
            deleted = cur.rowcount
            conn.execute(
                "UPDATE threads SET updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (_now(), thread_id),
            )
        return deleted

    def list_turns(
        self,
        thread_id: str,
        *,
        status: TurnStatus | None = None,
    ) -> list[Turn]:
        sql = "SELECT * FROM turns WHERE thread_id = ?"
        args: list[Any] = [thread_id]
        if status:
            sql += " AND status = ?"
            args.append(status)
        sql += " ORDER BY turn_seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_turn(r) for r in rows]

    # ==================== Item 追加(幂等 + 内容哈希) ====================

    def append_item(
        self,
        turn_id: str,
        item: ItemBase,
        *,
        thread_id: str | None = None,
    ) -> ItemBase:
        """追加单个 item。turn_id 必填;thread_id 可从 turn 推断。"""
        with self._tx() as conn:
            trow = conn.execute(
                "SELECT thread_id FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
            if trow is None:
                raise TurnNotFoundError(turn_id)
            effective_thread = thread_id or _row_str(trow, "thread_id")
            if thread_id and _row_str(trow, "thread_id") != thread_id:
                raise TurnMismatchError(
                    f"turn {turn_id} 不属于 thread {thread_id}"
                )
            # 幂等去重
            if item.client_item_id is not None:
                existing = conn.execute(
                    "SELECT seq FROM items WHERE client_item_id = ?",
                    (item.client_item_id,),
                ).fetchone()
                if existing is not None:
                    raise DuplicateItemError(
                        f"client_item_id={item.client_item_id} 已存在(seq={existing['seq']})"
                    )
            seq = self._next_seq(conn)
            chash = _content_hash(item)
            payload = json.dumps(item.body_payload(), ensure_ascii=False)
            search = item.search_text()
            conn.execute(
                "INSERT INTO items (seq, thread_id, turn_id, parent_seq, item_type,"
                " created_at, payload, search_text, client_item_id, content_hash)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    seq,
                    effective_thread,
                    turn_id,
                    item.parent_seq,
                    item.item_type,
                    _now(),
                    payload,
                    search,
                    item.client_item_id,
                    chash,
                ),
            )
            if self._fts_enabled and search:
                conn.execute(
                    "INSERT INTO items_fts (search_text, seq, thread_id, item_type)"
                    " VALUES (?,?,?,?)",
                    (search, seq, effective_thread, item.item_type),
                )
            conn.execute(
                "UPDATE threads SET updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (_now(), effective_thread),
            )
        return item.model_copy(
            update={"seq": seq, "thread_id": effective_thread, "turn_id": turn_id}
        )

    # ==================== Resume(重建消息历史 + 配对修复) ====================

    def resume(self, thread_id: str) -> list[LLMMessage]:
        """重建消息历史。中断的 tool_call 自动补 synthetic interrupted result。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        # 找到最新 compaction boundary
        with self._lock:
            boundary_row = self._conn.execute(
                "SELECT seq, payload FROM items WHERE thread_id = ?"
                " AND item_type = 'compaction_boundary'"
                " ORDER BY seq DESC LIMIT 1",
                (thread_id,),
            ).fetchone()
        messages: list[LLMMessage] = []
        if boundary_row is not None:
            bseq = (
                _row_int(boundary_row, "boundary_seq")
                if "boundary_seq" in dict(boundary_row)
                else _row_int(boundary_row, "seq")
            )
            bpayload = json.loads(_row_str(boundary_row, "payload"))
            summary = bpayload.get("summary", "")
            messages.append(
                LLMMessage(role="system", content=f"[Previous context summary] {summary}")
            )
            after_seq = bseq
        else:
            after_seq = 0
        items = self._list_items_after(thread_id, after_seq)
        # 配对修复:找出没有对应 tool_result 的 tool_call
        pending_calls: dict[str, ToolCallItem] = {}
        resolved_calls: set[str] = set()
        for it in items:
            if isinstance(it, ToolCallItem):
                pending_calls[it.call_id] = it
            elif isinstance(it, ToolResultItem):
                resolved_calls.add(it.call_id)
        dangling_ids = set(pending_calls.keys()) - resolved_calls
        # 构建消息列表
        for it in items:
            if isinstance(it, UserMessageItem):
                messages.append(LLMMessage(role="user", content=it.content))
            elif isinstance(it, AgentMessageItem):
                messages.append(LLMMessage(role="assistant", content=it.content))
            elif isinstance(it, ToolCallItem):
                tc = {
                    "id": it.call_id,
                    "type": "function",
                    "function": {
                        "name": it.tool,
                        "arguments": json.dumps(it.arguments, ensure_ascii=False),
                    },
                }
                # 检查是否已有 assistant 消息可以附加 tool_calls
                if messages and messages[-1].role == "assistant":
                    existing = messages[-1]
                    tcs = list(existing.tool_calls or [])
                    tcs.append(tc)
                    messages[-1] = LLMMessage(
                        role="assistant",
                        content=existing.content,
                        tool_calls=tcs,
                    )
                else:
                    messages.append(
                        LLMMessage(role="assistant", content="", tool_calls=[tc])
                    )
            elif isinstance(it, ToolResultItem):
                messages.append(
                    LLMMessage(
                        role="tool",
                        content=it.output if it.ok else (it.error or it.output),
                        tool_call_id=it.call_id,
                    )
                )
        # 为悬挂的 tool_call 补 synthetic interrupted result
        for cid in sorted(dangling_ids):
            messages.append(
                LLMMessage(
                    role="tool",
                    content="[interrupted] tool execution was interrupted",
                    tool_call_id=cid,
                )
            )
        return messages

    # ==================== Fork ====================

    def fork(
        self,
        thread_id: str,
        at_response_id: int,
        *,
        title: str = "",
    ) -> Thread:
        """从某 item seq 处分支出新 thread,复制前缀。"""
        source = self.get_thread(thread_id)
        if source is None:
            raise ThreadNotFoundError(thread_id)
        # 批58(十四):fork 边界对齐(对标 codex fork_turn_positions_in_rollout)——
        # fork 只能停在指令回合边界上,否则新 thread 历史以半截回合开头(工具调用
        # 无回复 / assistant 无对应用户指令)。开关默认 off 与现状逐零差异。
        if _fork_boundary_align_enabled():
            at_response_id = self._align_fork_boundary(thread_id, at_response_id)
        # 验证 at_response_id 属于该 thread
        with self._lock:
            item_row = self._conn.execute(
                "SELECT seq FROM items WHERE thread_id = ? AND seq = ?",
                (thread_id, at_response_id),
            ).fetchone()
        if item_row is None:
            raise ValueError(f"seq={at_response_id} 不属于 thread {thread_id}")
        new_thread = self.create_thread(
            title=title or f"Fork of {source.title}",
            parent_thread_id=thread_id,
            fork_point_seq=at_response_id,
            fork_mode="copy",
            # 派生线程继承来源的属主/角色:它们是**引擎盖章过**的值(不是调用方可写的),
            # 不继承就会造出一批"无属主"线程 —— 按 _principal_allows ② 那是"无从对账",
            # 等于每次 fork 都把这条会话开放给所有已登录连接。
            user_id=source.metadata.get("userId")
            if isinstance(source.metadata.get("userId"), str)
            else None,
            role_id=source.metadata.get("roleId")
            if isinstance(source.metadata.get("roleId"), int)
            else None,
        )
        # G-815974:fork 成功即分支装配出口 —— 提升**来源**线程的分支代数。
        # 挂在来源会话上的在飞后台任务完成时,经 background_tasks 复校发现旧令牌
        # 过期 ⇒ 不寄通知、不写历史;fork 出的新线程 key 独立(代数 0 起步),
        # 自己的任务不会被父分支的代数误杀。
        bump_branch_generation(thread_id, "fork")
        # 复制前缀 items(<=at_response_id)到新 thread
        with self._tx() as conn:
            rows = conn.execute(
                "SELECT * FROM items WHERE thread_id = ? AND seq <= ? ORDER BY seq ASC",
                (thread_id, at_response_id),
            ).fetchall()
            for row in rows:
                new_seq = self._next_seq(conn)
                conn.execute(
                    "INSERT INTO items (seq, thread_id, turn_id, parent_seq, item_type,"
                    " created_at, payload, search_text, client_item_id, content_hash)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (
                        new_seq,
                        new_thread.thread_id,
                        _row_opt_str(row, "turn_id"),
                        _row_opt_int(row, "parent_seq"),
                        _row_str(row, "item_type"),
                        _row_float(row, "created_at"),
                        _row_str(row, "payload"),
                        _row_str(row, "search_text"),
                        None,  # fork 后清除 client_item_id 避免冲突
                        _row_opt_str(row, "content_hash"),
                    ),
                )
                if self._fts_enabled and _row_str(row, "search_text"):
                    conn.execute(
                        "INSERT INTO items_fts (search_text, seq, thread_id, item_type)"
                        " VALUES (?,?,?,?)",
                        (
                            _row_str(row, "search_text"),
                            new_seq,
                            new_thread.thread_id,
                            _row_str(row, "item_type"),
                        ),
                    )
            conn.execute(
                "UPDATE threads SET updated_at = max(updated_at, ?) WHERE thread_id = ?",
                (_now(), new_thread.thread_id),
            )
        return new_thread

    # ==================== Rollback(软删除) ====================

    # ==================== Fork 边界对齐(批58十四) ====================

    def _align_fork_boundary(self, thread_id: str, at_response_id: int) -> int:
        """把 fork 点吸附到 <= at_response_id 的最近指令回合边界。

        对标 codex thread_rollout_truncation.rs `fork_turn_positions_in_rollout`:
        fork 边界 = 真实用户消息(或 trigger_turn 代理间通信)。本方法把会话 items
        投影为 rollout 形态后调用该函数,取 <= 目标 seq 的最近边界;找不到边界
        (如全部为 agent 消息)/投影失败 → 原样返回(绝不阻断 fork,失败静默降级)。
        """
        try:
            from app.core.thread_rollout_truncation import fork_turn_positions_in_rollout

            with self._lock:
                exists = self._conn.execute(
                    "SELECT 1 FROM items WHERE thread_id = ? AND seq = ?",
                    (thread_id, at_response_id),
                ).fetchone()
                if exists is None:
                    # 无效 seq 不吸附(保留原校验路径的报错语义,不掩盖调用方错误)
                    return at_response_id
                rows = self._conn.execute(
                    "SELECT seq, item_type, payload FROM items"
                    " WHERE thread_id = ? AND seq <= ? ORDER BY seq ASC",
                    (thread_id, at_response_id),
                ).fetchall()
            if not rows:
                return at_response_id
            projected: list[dict[str, Any]] = []
            seq_by_index: list[int] = []
            for row in rows:
                seq = _row_opt_int(row, "seq")
                if seq is None:
                    continue
                item_type = _row_str(row, "item_type")
                projected.append(
                    {
                        "type": "response_item",
                        "item": _project_item_for_boundary(item_type, _row_str(row, "payload")),
                    }
                )
                seq_by_index.append(seq)
            positions = fork_turn_positions_in_rollout(projected)
            boundary_seqs = [
                seq_by_index[p] for p in positions if 0 <= p < len(seq_by_index)
            ]
            if not boundary_seqs:
                return at_response_id
            aligned = max(boundary_seqs)
            if aligned != at_response_id:
                logger.info(
                    "[session-store] fork 边界吸附: seq %s → %s(回合边界对齐,thread=%s)",
                    at_response_id,
                    aligned,
                    thread_id,
                )
            return aligned
        except Exception as e:  # noqa: BLE001 - 边界对齐失败绝不阻断 fork
            logger.warning("[session-store] fork 边界对齐失败(用原 seq): %s", e)
            return at_response_id

    def rollback(
        self,
        thread_id: str,
        to_turn_id: str,
        *,
        reason: str = "",
    ) -> int:
        """软回滚到指定 turn 的最后一条 item。返回截断上界 seq。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        turn = self.get_turn(to_turn_id)
        if turn is None:
            raise TurnNotFoundError(to_turn_id)
        if turn.thread_id != thread_id:
            raise TurnMismatchError(f"turn {to_turn_id} 不属于 thread {thread_id}")
        # 找该 turn 最后一条 item 的 seq
        with self._lock:
            last_item = self._conn.execute(
                "SELECT MAX(seq) AS m FROM items WHERE turn_id = ?",
                (to_turn_id,),
            ).fetchone()
        to_seq = _row_opt_int(last_item, "m") if last_item else 0
        if to_seq is None:
            to_seq = 0
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO rollbacks (thread_id, to_seq, reason, created_at)"
                " VALUES (?,?,?,?)",
                (thread_id, to_seq, reason, now),
            )
        return to_seq

    # ==================== Compact ====================

    def compact(
        self,
        thread_id: str,
        summary_item: CompactionBoundaryItem,
        *,
        turn_id: str | None = None,
    ) -> CompactionBoundaryItem:
        """插入压缩边界 item。resume 时只回放此边界后内容+摘要。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        if turn_id is None:
            # 自动开一个 turn
            t = self.start_turn(thread_id)
            turn_id = t.turn_id
        appended = self.append_item(turn_id, summary_item, thread_id=thread_id)
        assert isinstance(appended, CompactionBoundaryItem)
        return appended

    # ==================== 全文检索 ====================

    def full_text_search(
        self,
        query: str,
        *,
        thread_id: str | None = None,
        limit: int = 20,
        owner_user_id: str | None = None,
    ) -> list[SearchHit]:
        """全文检索。`owner_user_id` 非空时**过滤写在 SQL 里**。

        与 `list_threads` 的属主过滤同一条理由:事后在响应侧筛会让"命中集合"与
        "被筛掉的那批"来自两次读取,而且漏一处调用点就等于没过滤。判据口径与
        `_owner_scoped_allows` 一致(带身份 ⇒ 无属主的行同样排除,那批行属 dev/未绑定通道)。
        """
        if not query.strip():
            return []
        if self._fts_enabled:
            hits = self._search_fts(query, thread_id, limit, owner_user_id)
            if hits is not None:
                return hits
        return self._search_like(query, thread_id, limit, owner_user_id)

    def _scope_sql(self, thread_id: str | None, owner_user_id: str | None) -> tuple[str, list[Any]]:
        """两条检索路径**共用**的过滤片段(两份实现必漂移,本仓记过太多次)。"""
        sql = ""
        args: list[Any] = []
        if thread_id:
            sql += " AND thread_id = ?"
            args.append(thread_id)
        if owner_user_id:
            sql += (
                " AND thread_id IN (SELECT thread_id FROM threads"
                " WHERE json_extract(metadata,'$.userId') = ?)"
            )
            args.append(owner_user_id)
        return sql, args

    def _search_fts(
        self,
        query: str,
        thread_id: str | None,
        limit: int,
        owner_user_id: str | None = None,
    ) -> list[SearchHit] | None:
        scope_sql, scope_args = self._scope_sql(thread_id, owner_user_id)
        sql = (
            "SELECT seq, thread_id, item_type,"
            " snippet(items_fts, 0, '', '', ' … ', 24) AS snip,"
            " bm25(items_fts) AS score"
            " FROM items_fts WHERE items_fts MATCH ?"
            f"{scope_sql} ORDER BY score LIMIT ?"
        )
        try:
            with self._lock:
                rows = self._conn.execute(
                    sql, [query, *scope_args, int(limit)]
                ).fetchall()
        except sqlite3.OperationalError:
            return None
        return [
            SearchHit(
                seq=_row_int(r, "seq"),
                thread_id=_row_str(r, "thread_id"),
                item_type=cast(ItemKind, _row_str(r, "item_type")),
                snippet=_row_str(r, "snip"),
                score=_row_float(r, "score"),
            )
            for r in rows
        ]

    def _search_like(
        self,
        query: str,
        thread_id: str | None,
        limit: int,
        owner_user_id: str | None = None,
    ) -> list[SearchHit]:
        term = query.strip()
        pattern = "%" + _escape_like(term) + "%"
        scope_sql, scope_args = self._scope_sql(thread_id, owner_user_id)
        sql = (
            "SELECT seq, thread_id, item_type, search_text FROM items"
            " WHERE search_text LIKE ? ESCAPE '\\'"
            f"{scope_sql} ORDER BY seq DESC LIMIT ?"
        )
        with self._lock:
            rows = self._conn.execute(
                sql, [pattern, *scope_args, int(limit)]
            ).fetchall()
        hits: list[SearchHit] = []
        low = term.lower()
        for r in rows:
            text = _row_str(r, "search_text")
            pos = text.lower().find(low)
            start = max(0, pos - 40) if pos >= 0 else 0
            snippet = ("…" if start > 0 else "") + text[start : start + 120]
            hits.append(
                SearchHit(
                    seq=_row_int(r, "seq"),
                    thread_id=_row_str(r, "thread_id"),
                    item_type=cast(ItemKind, _row_str(r, "item_type")),
                    snippet=snippet,
                    score=None,
                )
            )
        return hits

    # ==================== 跨会话接力摘要(P2-7) ====================

    def save_relay_summary(
        self,
        thread_id: str,
        *,
        objective: str,
        completed_steps: list[str],
        key_decisions: list[str],
        unfinished: list[str],
        files: list[str],
        refined: bool = False,
        prev_thread_id: str | None = None,
    ) -> str:
        """持久化一条接力摘要,返回 summary_id(同 thread 允许多条,取最新为权威)。"""
        import uuid

        if self.get_thread(thread_id) is None:
            raise ThreadNotFoundError(thread_id)
        sid = uuid.uuid4().hex
        payload = json.dumps(
            {
                "completed_steps": list(completed_steps or []),
                "key_decisions": list(key_decisions or []),
                "unfinished": list(unfinished or []),
                "files": list(files or []),
            },
            ensure_ascii=False,
        )
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO relay_summaries (summary_id, thread_id, prev_thread_id,"
                " objective, payload, refined, created_at) VALUES (?,?,?,?,?,?,?)",
                (
                    sid,
                    thread_id,
                    prev_thread_id,
                    objective,
                    payload,
                    int(bool(refined)),
                    now,
                ),
            )
        return sid

    def get_relay_summary(self, thread_id: str) -> dict[str, Any] | None:
        """取某 thread 最新一条接力摘要(含 payload 各段列表);无则 None。"""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM relay_summaries WHERE thread_id = ?"
                " ORDER BY created_at DESC LIMIT 1",
                (thread_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_relay(row)

    def list_relay_summaries(
        self, *, limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        """跨 thread 列出接力摘要(created_at 倒序)。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM relay_summaries ORDER BY created_at DESC"
                " LIMIT ? OFFSET ?",
                (max(0, int(limit)), max(0, int(offset))),
            ).fetchall()
        return [self._row_to_relay(r) for r in rows]

    def _row_to_relay(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "summary_id": _row_str(row, "summary_id"),
            "thread_id": _row_str(row, "thread_id"),
            "prev_thread_id": _row_opt_str(row, "prev_thread_id"),
            "objective": _row_str(row, "objective"),
            "payload": _row_str(row, "payload"),
            "refined": bool(row["refined"]),
            "created_at": _row_float(row, "created_at"),
        }

    # ==================== 内部 ====================

    def _deep_merge_metadata(
        self, base: dict[str, Any], patch: dict[str, Any]
    ) -> dict[str, Any]:
        """深合并 patch 进 base(2026-09-20 批 47,对标 codex
        ThreadMetadataPatch:dict 递归合并,标量覆盖;patch 值为 None 的键从
        base 删除,对标 ClearableField)。"""
        result: dict[str, Any] = dict(base)
        for key, value in patch.items():
            if value is None:
                result.pop(key, None)
                continue
            if isinstance(value, dict) and isinstance(result.get(key), dict):
                result[key] = self._deep_merge_metadata(result[key], value)
            else:
                result[key] = value
        return result

    def _next_seq(self, conn: sqlite3.Connection) -> int:
        conn.execute(
            "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'last_seq'"
        )
        row = conn.execute("SELECT value FROM meta WHERE key = 'last_seq'").fetchone()
        return int(str(row["value"]))

    @contextmanager
    def _tx(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                yield self._conn
            except BaseException:
                self._conn.execute("ROLLBACK")
                raise
            self._conn.execute("COMMIT")

    def _list_items_after(self, thread_id: str, after_seq: int) -> list[ItemBase]:
        """列出 thread 中 seq > after_seq 的所有 items(考虑 rollback ceiling)。"""
        ceiling = self._get_rollback_ceiling(thread_id)
        sql = "SELECT * FROM items WHERE thread_id = ? AND seq > ?"
        args: list[Any] = [thread_id, after_seq]
        if ceiling is not None:
            sql += " AND seq <= ?"
            args.append(ceiling)
        sql += " ORDER BY seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_item(r) for r in rows]

    def _get_rollback_ceiling(self, thread_id: str) -> int | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT MIN(to_seq) AS m FROM rollbacks WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        return _row_opt_int(row, "m") if row else None

    def _ensure_turn(self, turn_id: str) -> Turn:
        """兜底获取 turn(不应失败)。"""
        t = self.get_turn(turn_id)
        if t is None:
            raise TurnNotFoundError(turn_id)
        return t

    def list_items(
        self,
        thread_id: str,
        *,
        after_seq: int | None = None,
        upto_seq: int | None = None,
        kinds: Sequence[ItemKind] | None = None,
    ) -> list[ItemBase]:
        """列出 thread 中的 items(考虑 rollback ceiling)。"""
        ceiling = self._get_rollback_ceiling(thread_id)
        sql = "SELECT * FROM items WHERE thread_id = ?"
        args: list[Any] = [thread_id]
        if after_seq is not None:
            sql += " AND seq > ?"
            args.append(after_seq)
        if upto_seq is not None:
            sql += " AND seq <= ?"
            args.append(upto_seq)
        if ceiling is not None:
            sql += " AND seq <= ?"
            args.append(ceiling)
        if kinds:
            placeholders = ", ".join("?" for _ in kinds)
            sql += f" AND item_type IN ({placeholders})"
            args.extend(list(kinds))
        sql += " ORDER BY seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_item(r) for r in rows]


__all__ = [
    "AgentMessageItem",
    "ApprovalRequestItem",
    "ApprovalResponseItem",
    "CompactionBoundaryItem",
    "DuplicateItemError",
    "ErrorItem",
    "FileEditItem",
    "ForkMode",
    "InvalidTurnTransitionError",
    "ItemBase",
    "ItemKind",
    "LLMMessage",
    "ReasoningItem",
    "SearchHit",
    "SessionStore",
    "Thread",
    "ThreadNotFoundError",
    "ThreadPage",
    "ToolCallItem",
    "ToolResultItem",
    "Turn",
    "TurnMismatchError",
    "TurnNotFoundError",
    "TurnStatus",
    "UserMessageItem",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
