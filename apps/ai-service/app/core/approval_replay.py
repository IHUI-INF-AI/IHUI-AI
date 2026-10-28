# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D1047 A 档·主对话流半 —— 待决审批重放的**取数侧**判据唯一出口。

病灶(D131 取证①,``tests/test_d131_pending_approval_resume.py``):主对话流
(``app/routers/llm.py`` 的 ``_sse``)帧不带 ``id:`` 行,重连 = 重新起一次 run,
"审批已下发但用户还没点"的弹窗在断线窗口里丢。

与 agent 任务流侧(``agent_loop_v2.pending_approval_replays``,2026-10-13 先行
交付)成对:那一半显式查 ``_approval_registry``,本函数显式查主对话流的
``_approval_sessions``。判据逐字同族(精确相等、fail-closed):

① 仍待决 = decision 未写入 ∧ 唤醒事件未置(已决条目重放 = 二次弹窗 = 副作用);
② 属主精确相等:条目须登记 ``owner_user_id`` 且 == 调用者主体;请求者无可证明
   身份(None)只能拿到属主同为 None 的条目 —— 与审批结算判据同向;
   **现读生产条目没有 owner 键**(llm.py:4514 的条目只登记 event/decision/scope/
   reason/argv/tool_name/net_fact),本判据对这种形态一律判"不重放" —— 这是有意的
   惰性闸:接线补丁(把 owner 等展示字段补进条目)落地之前,本函数对现读面
   **恒返回空**,已落代码零行为、可回滚;
③ 旧形态/畸形条目(非 dict、event 缺失或非 Event)跳过,不冒充判过。

**接线侧不在本模块**(llm.py 属禁碰面,且重放答复会唤醒孤儿生成器继续执行 ——
僵尸 run,须与 sse_contract 同批先立续传锚点;接线 diff 文字随 D1047 票报告交付)。
本模块只给事实,不给授权结论:身份只能从承载层显式入参进来(AGENTS §5 同纪律)。

纯内存 + 纯函数,不连 PostgreSQL / Redis,不 import 任何会触发建池的模块路径。
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

#: 重放载荷必须携带的展示字段(接线侧把帧组装成 {"type": "tool-approval", **payload,
#: "replay": True},与 agents.py:1512 的任务流重放帧同形)。字段缺席 ⇒ 条目判
#: "不可重放" —— 宁可丢弹窗(与今天的现状同态)也不发一个前端没法弹的半截帧。
_REPLAY_FIELDS: tuple[str, ...] = (
    "tool_name",
    "tool_call_id",
    "args_preview",
    "danger_level",
)

# ── D-07(2026-10-26 立,承 D131 取证 / D1047 diff② / D690 方案 A)──────────────
#
# D690 已把"重连时重放**仍待决**条目"接进 `llm.py::_approval_replay_frames`,但那条
# 支路的输入集被生命周期卡死:待决条目住在等待方(llm.py 工具循环的 `try/finally`)名下,
# 客户端一断,GeneratorExit 从等待循环里那个 `yield ": keep-alive…"` 抛入,`finally`
# 当场 `pop` ⇒ 重连时刻 `_approval_sessions` 恒空 ⇒ 已装车的重放分支拿不到条目,
# 弹窗**静默**丢失(既没有帧、没有任何一处留下"丢过"的事实)。
#
# 本区补的是票面第二档「**过期即失效并留痕**」:等待方摘条目时,若那一刻条目**无人应答**
# (decision 未写 ∧ event 未置),就把这一事实投影成一条有界留痕,供三个既有出口点名:
# ① `approval-response` 端点对"迟到的应答"给**具名拒绝**(而不是通用的 not found);
# ② 重连路径把失效条数落日志(运维可见,不再静默);
# ③ 影子对账测试钉住"断线→留痕→点名"整链。
#
# **为什么不选"跨断线存续条目 + 重连重发弹窗"**(票面第一档,即 D1047 落选的那一档):
# 条目离开活等待者就是空头支票 —— 用户点"批准"后没有任何执行体在听(僵尸 run),
# 而端上按 approvalId 幂等去重、重连新 run 又会为同一工具发**新** approval_id
# ⇒ 双弹窗。那一档的前提是"续传锚点 + 跨端契约同批"(packages/shared 的载荷键、
# apps/api 网关复用臂),不在本射程。本档**零 wire 变化**:一个新事件名都没加、
# 一个载荷键都没加,老客户端行为逐字不变 ⇒ 可单文件回滚。
#
# 纪律与取数侧同族(纯内存 + 纯函数,不连 PostgreSQL / Redis,不 import 建池路径):
# 属主精确相等才点名(fail-closed);展示字段不齐一律不记(不冒充判过);
# 同一 (会话, 审批) 重复登记只留第一条(幂等);账本有界且会到期出账(队列必须有死亡机制)。

#: 失效原因封闭集:`stream_closed` = 连接被回收(GeneratorExit),`cancelled` = 任务取消,
#: `timeout` = 等待窗口走完仍无人应答。之外的值一律拒收(不写第二套词汇)。
APPROVAL_LOSS_REASONS: frozenset[str] = frozenset({"stream_closed", "cancelled", "timeout"})

#: 留痕存续秒数:必须显著大于 `_APPROVAL_TIMEOUT`(人工决策窗口),否则"迟到的应答"
#: 一到就查不到,点名窗口形同不存在。取值只需覆盖一次断线-重连-再点的时间尺。
EXPIRY_RETENTION_SECONDS: int = 600

#: 账本上界(防内存泄漏:断线只记账不回收 = 第二个病灶)。
EXPIRY_MAX_SESSIONS: int = 512
#: 会话格内条目上界。
EXPIRY_MAX_PER_SESSION: int = 20

#: 失效留痕账本:session_id -> approval_id -> 记录(与待决表同一键空间,便于对账)。
_expiry_ledger: dict[str, dict[str, dict[str, Any]]] = {}


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _parse_iso(value: Any) -> datetime | None:
    """ISO 字符串 → aware datetime;形态坏/非字符串一律返回 None(判不了 ⇒ 不给结论)。"""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def _expiry_is_fresh(record: dict[str, Any], now: datetime) -> bool:
    closed_at = _parse_iso(record.get("closed_at"))
    if closed_at is None:
        # 时刻判不了 ⇒ 不点名也不冒充点名(fail-closed,同 §0.3 的"没判不写成判过")
        return False
    return 0.0 <= (now - closed_at).total_seconds() < EXPIRY_RETENTION_SECONDS


def _expiry_display_complete(record: dict[str, Any]) -> bool:
    return all(record.get(field) is not None for field in _REPLAY_FIELDS)


def clear_approval_expiry() -> None:
    """排空失效账本(测试夹具专用;生产不显式调用,靠到期出账 + 上界裁剪)。"""
    _expiry_ledger.clear()


def approval_expiry_size() -> int:
    """现读账本行数(会话格内条目总数)。影子对账用它证"跑两次行数不变"。"""
    return sum(len(bucket) for bucket in _expiry_ledger.values())


def prune_approval_expiry(now: datetime | None = None) -> int:
    """到期出账 + 超界裁剪,返回被剔行数。幂等:账本已净时返回 0 且不新增任何格。"""
    moment = now or _now_utc()
    removed = 0
    for session_id in list(_expiry_ledger):
        bucket = _expiry_ledger[session_id]
        for approval_id in list(bucket):
            if not _expiry_is_fresh(bucket[approval_id], moment):
                del bucket[approval_id]
                removed += 1
        if not bucket:
            del _expiry_ledger[session_id]
    while len(_expiry_ledger) > EXPIRY_MAX_SESSIONS:
        oldest = next(iter(_expiry_ledger))
        removed += len(_expiry_ledger.pop(oldest))
    return removed


def record_approval_expiry(
    session_id: str,
    approval_id: str,
    entry: Any,
    *,
    reason: str,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """等待方摘条目时登记"无人应答即失效"的留痕。返回账内那条(或 None = 未登记)。

    Args:
        session_id: 承载层给的流会话 id(``streamSessionId``),与待决表同一键空间。
        approval_id: 被摘条目的审批 id。
        entry: 被摘下来的条目本身(**只读投影**,本函数不改动它)。
        reason: 必须落在 :data:`APPROVAL_LOSS_REASONS`,之外的值当场拒收。
        now: 注入时钟(测试用;生产留 None 取当前 UTC)。

    Returns:
        账内该 (会话, 审批) 的记录(新登记或已存在的**第一条**);输入不合格 ⇒ None。
        None 不代表"没丢",只代表"这一格判不出来" —— 调用方须自行落日志点名。
    """
    if reason not in APPROVAL_LOSS_REASONS:
        return None
    if not isinstance(session_id, str) or not session_id:
        return None
    if not isinstance(approval_id, str) or not approval_id:
        return None
    if not isinstance(entry, dict):
        return None
    moment = now or _now_utc()
    bucket = _expiry_ledger.setdefault(session_id, {})
    existing = bucket.get(approval_id)
    if isinstance(existing, dict):
        # 幂等:同一审批被重复登记(重放/重试/双 finally)只留第一条,不叠加、不改写
        return existing
    record: dict[str, Any] = {
        "approval_id": approval_id,
        "session_id": session_id,
        "reason": reason,
        "created_at": entry.get("created_at"),
        "closed_at": moment.isoformat(),
        "owner_user_id": entry.get("owner_user_id"),
    }
    for field_name in _REPLAY_FIELDS:
        record[field_name] = entry.get(field_name)
    if not _expiry_display_complete(record):
        # 展示字段不齐 ⇒ 连"丢了什么"都说不清,不写一条半截留痕冒充判过
        if not bucket:
            _expiry_ledger.pop(session_id, None)
        return None
    if len(bucket) >= EXPIRY_MAX_PER_SESSION:
        # 会话格满 ⇒ 不吞新事实也不无界长:先剔本格最旧一条再登记(closed_at 单调)
        oldest_id = next(iter(bucket))
        del bucket[oldest_id]
    bucket[approval_id] = record
    prune_approval_expiry(moment)
    return record


def chat_expired_approval_notices(
    session_id: str,
    owner_user_id: str | None,
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """某会话"已随断线/超时失效"的审批名单(只读快照,属主精确相等才给)。

    与 :func:`chat_pending_approval_replays` 同族三闸:属主精确相等 ∧ 展示字段齐备 ∧
    仍在存续窗内。**只读**:不在取数时删除,故同一名单被问 N 次得同一条目集合(幂等),
    出账一律走 :func:`prune_approval_expiry` 的到期/上界两档。
    """
    bucket = _expiry_ledger.get(session_id)
    if not bucket:
        return []
    moment = now or _now_utc()
    notices: list[dict[str, Any]] = []
    for record in bucket.values():
        if record.get("owner_user_id") != owner_user_id:
            continue
        if not _expiry_display_complete(record) or not _expiry_is_fresh(record, moment):
            continue
        notices.append(dict(record))
    return notices


def approval_expiry_notice(
    session_id: str,
    approval_id: str,
    owner_user_id: str | None,
    *,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    """单条审批的失效留痕(给 `approval-response` 具名拒绝用)。

    属主不等 ⇒ None —— 与"这条不存在"**同形**,端点因此不可能被当成存在性探针。
    """
    for record in chat_expired_approval_notices(session_id, owner_user_id, now=now):
        if record.get("approval_id") == approval_id:
            return record
    return None



def chat_pending_approval_replays(
    entries: dict[str, Any] | None, owner_user_id: str | None
) -> list[dict[str, Any]]:
    """主对话流(``_approval_sessions``)仍待决条目的重放载荷(只读快照)。

    Args:
        entries: ``_approval_sessions[session_id]`` 那一格(``{approval_id: 条目}``)。
            传 None / 空 dict 是合法调用(旧会话已收口 ⇒ 恒空)。
        owner_user_id: 调用者主体(JWT 派生)。None 只能拿到属主同为 None 的条目。

    Returns:
        重放载荷列表(每项含 approval_id / tool_name / tool_call_id / args_preview /
        danger_level / created_at / owner_user_id)。调用方负责包上 ``type:
        "tool-approval"`` 帧形与 ``replay: True`` 标记(与任务流 agents.py 同形)。
    """
    if not entries:
        return []
    payloads: list[dict[str, Any]] = []
    for approval_id, entry in entries.items():
        if not isinstance(entry, dict):
            # 历史形态/畸形条目:不参与(与 list_pending_approvals 跳过二元组同口径)
            continue
        event = entry.get("event")
        if not isinstance(event, asyncio.Event):
            # 没有可判"仍待决"的唤醒位 ⇒ fail-closed,跳过
            continue
        if entry.get("decision") is not None or event.is_set():
            # 已决/已唤醒:重放即二次弹窗(副作用),不重放
            continue
        if entry.get("owner_user_id") != owner_user_id:
            # 属主精确相等(②):现读生产条目无 owner 键 ⇒ .get() 得 None,
            # 仅当调用者也无身份时才可能相等;即便如此,下方展示字段闸(接线
            # 补丁未落 ⇒ 字段缺席)仍会把这一档挡住 —— 双闸,接线前恒惰性。
            continue
        if any(entry.get(f) is None for f in _REPLAY_FIELDS):
            # 展示字段不全(条目扩展补丁未落地)⇒ 不发半截帧
            continue
        payloads.append(
            {
                "approval_id": approval_id,
                "tool_name": entry["tool_name"],
                "tool_call_id": entry["tool_call_id"],
                "args_preview": entry["args_preview"],
                "danger_level": entry["danger_level"],
                "created_at": entry.get("created_at"),
                "owner_user_id": entry.get("owner_user_id"),
            }
        )
    return payloads
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
