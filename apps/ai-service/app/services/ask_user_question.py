# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AskUserQuestion 闭环:进程内问题注册表(创建/答复/撤回/会话中断)。

模型调用 `ask_user_question` 工具后,执行侧在这里登记一个问题并阻塞等待;
用户答复经上行端点 `POST /llm/complete/stream/{session_id}/question-response`
回到同一问题。**一个 questionId 只认一次答复**:重复提交返回 duplicate,
原答案原样保留,不唤醒等待方第二次。

并发纪律:注册表只用 `threading.RLock` 保护同步段(测试与路由可能跨事件循环),
任何 await 都不持锁;唤醒靠 `asyncio.Event.set()`(Python 3.12 起 Event 不绑定
创建时的 loop,跨请求结算安全)。

下行帧形状与 `app/core/question_parser.Question.to_dict()` 同形
(questionId/prompt/options/allowCustom/allowMultiple),额外只加 sessionId/expiresAt。
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

DEFAULT_TIMEOUT_S = 300.0
#: 终态条目保留时长(秒):超过后登记新问题时顺手清理,防内存泄漏。
STALE_RETENTION_S = 600
MAX_OPTIONS = 8

# 定时继续(2026-11-14 立,遵循统一工程规范):
# `timeout_s` 显式传入时进入 timed 模式 —— 前台等待到期后**不把问题判死**,而是
# 返回 pending 让模型继续;登记表保留 pending 并给一段宽限期,迟到答复按
# answer_to_pending_question 注入后续迭代。缺省(None)保持既有阻塞 300s 语义。
MAX_TIMEOUT_S = 86_400.0
INDEFINITE_TIMEOUT_S = -1
#: -1(等到底)在登记表里的实用上限,避免一个条目永久驻留。
INDEFINITE_WAIT_S = 86_400.0
#: timed 到期后问题仍可答复的宽限时长。
CONTINUED_GRACE_S = DEFAULT_TIMEOUT_S

STATUS_PENDING = "pending"
STATUS_CONTINUED = "continued"
STATUS_ANSWERED = "answered"
STATUS_TIMEOUT = "timeout"
STATUS_WITHDRAWN = "withdrawn"
STATUS_INTERRUPTED = "interrupted"
STATUS_DUPLICATE = "duplicate"
STATUS_NOT_FOUND = "not_found"
STATUS_FORBIDDEN = "forbidden"
STATUS_INVALID = "invalid"


@dataclass
class AskUserQuestionItem:
    """一条待答/已答问题。`status` 只会向终态单向迁移。"""

    question_id: str
    session_id: str
    user_id: str | None
    prompt: str
    header: str
    options: list[dict[str, str]]
    allow_custom: bool
    allow_multiple: bool
    created_at: datetime
    expires_at: datetime
    event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)
    status: str = STATUS_PENDING
    selected_ids: list[str] = field(default_factory=list)
    custom_text: str = ""
    reason: str = ""
    #: timed 到期转入"可迟到答复"后为 True(条目仍是 pending,不判 timeout)。
    continued: bool = False
    #: 转入 continued 的那次工具调用 id;迟到答复据此回填 callId。
    continued_call_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        """SSE 下行帧形状(与 question_parser.Question.to_dict() 同形 + 两个附加键)。

        header 只在非空时出现:旧客户端按未知键忽略,新客户端用于卡片小标题;
        空标题不吐键,避免把"未设置"写成空串漂到前端。
        """
        options: list[dict[str, str]] = []
        for opt in self.options:
            item = {"id": opt["id"], "label": opt["label"]}
            # description 是可选附加键(既有 id/label 键名不变,前端按未知键忽略)
            if opt.get("description"):
                item["description"] = opt["description"]
            options.append(item)
        payload: dict[str, Any] = {"questionId": self.question_id, "prompt": self.prompt}
        if self.header:
            payload["header"] = self.header
        payload.update({
            "options": options,
            "allowCustom": self.allow_custom,
            "allowMultiple": self.allow_multiple,
            "sessionId": self.session_id,
            "expiresAt": _iso(self.expires_at),
        })
        return payload

    def resolved_payload(
        self, status: str | None = None, *, continued: bool = False
    ) -> dict[str, Any]:
        """question-resolved 帧载荷(questionId/status 为必需键)。

        `continued=True` 是定时继续的附加键:前端词表只有四态,该场景按 timeout
        结算,靠这个键区分"用户跳过"与"只是挂起、迟到答复仍会送达"。
        """
        payload: dict[str, Any] = {
            "questionId": self.question_id,
            "status": status or self.status,
            "selectedOptionIds": list(self.selected_ids),
            "customText": self.custom_text,
        }
        if continued:
            payload["continued"] = True
        return payload

    def timeout_seconds(self) -> int:
        """本问的答复时限(秒),用于超时回灌文案(不依赖调用方各自算一遍)。"""
        return int((self.expires_at - self.created_at).total_seconds())


_registry: dict[str, AskUserQuestionItem] = {}
_registry_lock = threading.RLock()


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _now() -> datetime:
    return datetime.now(UTC)


def question_timeout_s() -> float:
    """读 env ASK_USER_QUESTION_TIMEOUT(秒),缺省/非法/非正数一律回落 300。"""
    raw = os.getenv("ASK_USER_QUESTION_TIMEOUT", "")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_S
    return value if value > 0 else DEFAULT_TIMEOUT_S


def normalize_timeout_s(raw: object) -> tuple[float | None, bool, dict[str, Any] | None]:
    """把模型给的 `timeout_s` 归一为登记表可用的秒数。

    返回 (effective_s, timed, error):
    - (None, False, None) 未显式给值 —— 沿用 env 默认的阻塞语义;
    - (86400, False, None) `-1` —— 等到底(实用上限 24h,不返回 pending);
    - (n, True, None) 正整数 1..86400 —— timed 模式,前台到期返回 pending;
    - (None, False, error) 非法值。
    """
    if raw is None:
        return None, False, None
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return None, False, _error(
            "question_invalid_timeout",
            f"timeout_s 必须是整数秒({INDEFINITE_TIMEOUT_S} 表示等到底,或 1..{int(MAX_TIMEOUT_S)})",
        )
    if raw == INDEFINITE_TIMEOUT_S:
        return INDEFINITE_WAIT_S, False, None
    if raw < 1 or raw > MAX_TIMEOUT_S:
        return None, False, _error(
            "question_invalid_timeout",
            f"timeout_s 必须在 1..{int(MAX_TIMEOUT_S)} 之间,或用 {INDEFINITE_TIMEOUT_S} 表示等到底",
        )
    return float(raw), True, None


def _error(code: str, message: str) -> dict[str, Any]:
    """结构化参数错误(调用侧转成工具失败/400,不抛 500)。"""
    return {"ok": False, "error": message, "errorCode": code}


def _normalize_options(options: object) -> tuple[list[dict[str, str]] | None, dict[str, Any] | None]:
    if not isinstance(options, list) or not 1 <= len(options) <= MAX_OPTIONS:
        return None, _error(
            "question_invalid_options",
            f"options 必须是 1..{MAX_OPTIONS} 项的数组",
        )
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in options:
        if not isinstance(raw, dict):
            return None, _error("question_invalid_option", "每个选项必须是对象")
        opt_id = raw.get("id")
        label = raw.get("label")
        if not isinstance(opt_id, str) or not opt_id.strip():
            return None, _error("question_invalid_option", "选项 id 必须是非空字符串")
        if not isinstance(label, str) or not label.strip():
            return None, _error("question_invalid_option", "选项 label 必须是非空字符串")
        if opt_id in seen:
            return None, _error("question_invalid_option", f"选项 id 重复: {opt_id}")
        seen.add(opt_id)
        item = {"id": opt_id, "label": label}
        description = raw.get("description")
        if isinstance(description, str) and description.strip():
            item["description"] = description
        normalized.append(item)
    return normalized, None


def _prune_stale(now: datetime) -> None:
    """清理超期条目:pending 先落 timeout 唤醒等待方,再按保留时长逐出。

    调用方必须已持有 `_registry_lock`(同步段,不 await)。
    """
    for qid, item in list(_registry.items()):
        if item.expires_at >= now:
            continue
        if item.status == STATUS_PENDING:
            item.status = STATUS_TIMEOUT
            item.reason = "timeout"
            item.event.set()
        if item.expires_at < now - timedelta(seconds=STALE_RETENTION_S):
            _registry.pop(qid, None)


def create_question(
    *,
    session_id: str,
    user_id: str | None,
    prompt: str,
    header: str | None = None,
    options: object = None,
    allow_custom: bool = True,
    allow_multiple: bool = False,
    timeout_s: object = None,
    call_id: str = "",
) -> AskUserQuestionItem | dict[str, Any]:
    """登记一个问题;参数非法时返回结构化错误 dict(不抛异常)。

    `timeout_s` 显式给出时覆盖 env 默认值,并记录 timed 模式(见 normalize_timeout_s);
    `call_id` 只在 timed 到期转入 continued 时用于迟到答复回填。
    """
    if not isinstance(session_id, str) or not session_id.strip():
        return _error("question_session_required", "session_id 必填")
    if not isinstance(prompt, str) or not prompt.strip():
        return _error("question_invalid_prompt", "question(prompt) 必须是非空字符串")
    normalized, option_error = _normalize_options(options)
    if option_error is not None:
        return option_error
    effective_timeout, _timed, timeout_error = normalize_timeout_s(timeout_s)
    if timeout_error is not None:
        return timeout_error

    now = _now()
    budget = effective_timeout if effective_timeout is not None else question_timeout_s()
    item = AskUserQuestionItem(
        question_id=f"q_{uuid.uuid4().hex[:12]}",
        session_id=session_id,
        user_id=user_id or None,
        prompt=prompt.strip(),
        header=header.strip() if isinstance(header, str) else "",
        options=normalized or [],
        allow_custom=bool(allow_custom),
        allow_multiple=bool(allow_multiple),
        created_at=now,
        expires_at=now + timedelta(seconds=budget),
        continued_call_id=call_id if isinstance(call_id, str) else "",
    )
    with _registry_lock:
        _prune_stale(now)
        _registry[item.question_id] = item
    return item


def _lookup(question_id: str) -> AskUserQuestionItem | None:
    return _registry.get(question_id)


def _owned_by(item: AskUserQuestionItem, session_id: str, user_id: str | None) -> bool:
    """归属判定:会话必须一致;创建时绑定的用户必须一致(None 只认 None)。"""
    if item.session_id != session_id:
        return False
    return item.user_id == (user_id or None)


def _selection(
    item: AskUserQuestionItem,
    selected_ids: object,
    custom_text: object,
) -> tuple[list[str], str, dict[str, Any] | None]:
    """校验并归一选择;非法时返回 (原样, 原样, 结构化错误)。"""
    raw_ids = selected_ids if isinstance(selected_ids, list) else []
    ids = [x for x in raw_ids if isinstance(x, str)]
    if len(ids) != len(raw_ids):
        return [], "", _error("question_invalid_selection", "selectedOptionIds 必须全是字符串")
    allowed = {opt["id"] for opt in item.options}
    unknown = [x for x in ids if x not in allowed]
    if unknown:
        return [], "", _error("question_invalid_selection", f"未知选项: {unknown}")
    custom = custom_text.strip() if isinstance(custom_text, str) else ""
    if not item.allow_multiple and len(ids) != 1:
        return [], "", _error("question_invalid_selection", "单选必须且只能选 1 项")
    if item.allow_multiple and not ids and not (custom and item.allow_custom):
        return [], "", _error("question_invalid_selection", "多选至少选 1 项或给出自定义文本")
    if custom and not item.allow_custom:
        custom = ""  # allowCustom=false:自由文本被忽略,不影响选项答案
    return ids, custom, None


def resolve_question(
    question_id: str,
    *,
    session_id: str,
    user_id: str | None,
    selected_ids: object = None,
    custom_text: object = "",
) -> tuple[str, AskUserQuestionItem | None]:
    """答复一个问题;返回 (status, item)。

    answered 只在首次答复发生;answered 之后再来一律 duplicate(**不覆盖原答案**)。
    """
    item = _lookup(question_id)
    if item is None:
        return STATUS_NOT_FOUND, None
    if not _owned_by(item, session_id, user_id):
        return STATUS_FORBIDDEN, item

    with _registry_lock:
        if item.status == STATUS_ANSWERED:
            return STATUS_DUPLICATE, item
        if item.status != STATUS_PENDING:
            return item.status, item  # timeout / withdrawn / interrupted
        if item.expires_at <= _now():
            item.status = STATUS_TIMEOUT
            item.reason = "timeout"
            item.event.set()
            return STATUS_TIMEOUT, item
        ids, custom, selection_error = _selection(item, selected_ids, custom_text)
        if selection_error is not None:
            return STATUS_INVALID, item
        item.selected_ids = ids
        item.custom_text = custom
        item.status = STATUS_ANSWERED
        item.event.set()
        return STATUS_ANSWERED, item


def withdraw_question(
    question_id: str,
    *,
    session_id: str,
    user_id: str | None,
    reason: str = "withdrawn_by_user",
) -> tuple[str, AskUserQuestionItem | None]:
    """撤回一个问题(模型侧等待方会以 withdrawn 结束)。"""
    item = _lookup(question_id)
    if item is None:
        return STATUS_NOT_FOUND, None
    if not _owned_by(item, session_id, user_id):
        return STATUS_FORBIDDEN, item

    with _registry_lock:
        if item.status != STATUS_PENDING:
            return item.status, item
        if item.expires_at <= _now():
            item.status = STATUS_TIMEOUT
            item.reason = "timeout"
            item.event.set()
            return STATUS_TIMEOUT, item
        item.status = STATUS_WITHDRAWN
        item.reason = reason
        item.event.set()
        return STATUS_WITHDRAWN, item


def cancel_session_questions(
    session_id: str,
    *,
    reason: str = "session_interrupted",
) -> list[AskUserQuestionItem]:
    """会话中断/断开:该会话所有 pending 置 interrupted 并唤醒等待方。

    返回被中断的条目,供调用方尽力下发 question-resolved 帧。
    """
    affected: list[AskUserQuestionItem] = []
    with _registry_lock:
        for item in _registry.values():
            if item.session_id != session_id or item.status != STATUS_PENDING:
                continue
            item.status = STATUS_INTERRUPTED
            item.reason = reason
            item.event.set()
            affected.append(item)
    return affected


def pending_questions_for_session(session_id: str) -> list[AskUserQuestionItem]:
    """该会话仍待答的问题(重连重放用,按创建时间有序)。"""
    with _registry_lock:
        items = [
            item
            for item in _registry.values()
            if item.session_id == session_id and item.status == STATUS_PENDING
        ]
    return sorted(items, key=lambda x: x.created_at)


def pending_question_frames(session_id: str, user_id: str | None) -> list[dict[str, Any]]:
    """重连重放载荷:该会话 ∧ 该属主**仍待答**的问题帧(与 events.question 同形)。

    病灶与审批重放同型(D131/D1047):续传按游标只补锚点之后的事件,而提问帧几乎总
    在锚点之前 ⇒ 断线窗口里"已下发未应答"的内联卡丢失,用户重连后既看不到卡也答不了,
    服务端只能等超时。修法同样是显式查注册表,不靠事件缓冲回放。

    三道闸,与 `resolve_question` 的归属判定**同判据**(单一真相源,不另写一份):
    - 会话精确相等(`pending_questions_for_session` 已做);
    - 属主精确相等(None 只认 None,fail-closed);
    - 仍为 pending(已决条目不重放:二次弹窗/二次结算都是副作用)。
    `replay=True` 是给前端的幂等标记(按 questionId 识别,重连 N 次不新增卡片)。
    """
    if not session_id:
        return []
    frames: list[dict[str, Any]] = []
    for item in pending_questions_for_session(session_id):
        if not _owned_by(item, session_id, user_id):
            continue
        frames.append(
            {
                "type": "question",
                "question": item.to_dict(),
                "session_id": item.session_id,
                "replay": True,
            }
        )
    return frames


def mark_continued(
    item: AskUserQuestionItem,
    *,
    call_id: str = "",
    grace_s: float = CONTINUED_GRACE_S,
) -> str:
    """timed 前台等待到期:把条目转入 continued(仍是 pending,可迟到答复)。

    - 已被答复/撤回/中断时原样返回该终态(不覆盖先到的结局);
    - pending 时记 continued 标志并延长登记表有效期到 now+grace_s;
    - 返回 STATUS_CONTINUED 或实际终态。
    """
    with _registry_lock:
        if item.status != STATUS_PENDING:
            return item.status
        item.continued = True
        if isinstance(call_id, str) and call_id:
            item.continued_call_id = call_id
        extended = _now() + timedelta(seconds=max(float(grace_s), 1.0))
        if item.expires_at < extended:
            item.expires_at = extended
        return STATUS_CONTINUED


def drain_continued_answers(session_id: str) -> list[AskUserQuestionItem]:
    """取走该会话已答复的 continued 条目(每条只交付一次)。

    供带交互宿主的执行面在下一轮 LLM 调用前注入 `answer_to_pending_question`
    用户消息 —— 对齐 外部实现 的迟到答复 steering 语义。
    """
    with _registry_lock:
        items = [
            item
            for item in _registry.values()
            if item.session_id == session_id
            and item.continued
            and item.status == STATUS_ANSWERED
        ]
        for item in items:
            _registry.pop(item.question_id, None)
    return sorted(items, key=lambda x: x.created_at)


def continued_answer_message(item: AskUserQuestionItem) -> str:
    """迟到答复的模型侧消息体(与 外部实现 answer_to_pending_question 同形,单问变体)。"""
    labels = [opt["label"] for opt in item.options if opt["id"] in item.selected_ids]
    return json.dumps(
        {
            "kind": "answer_to_pending_question",
            "tool": "ask_user_question",
            "callId": item.continued_call_id,
            "questionId": item.question_id,
            "question": item.prompt,
            "selectedOptionIds": list(item.selected_ids),
            "labels": labels,
            "customText": item.custom_text,
        },
        ensure_ascii=False,
    )


def pending_question_notice(item: AskUserQuestionItem, call_id: str) -> str:
    """timed 到期后回填给模型的 pending 说明(对齐 外部实现 的 pendingNotice)。"""
    return (
        "前台等待已到期,但这只是「挂起」而不是「用户跳过」:用户仍可继续作答。"
        "请继续可独立推进的工作,不要重复提问;用户答复会以 "
        f"answer_to_pending_question 用户消息送达(callId={call_id or item.continued_call_id or '-'},"
        f" questionId={item.question_id})。不要把挂起当作许可。"
    )


def tool_result_payload(
    item: AskUserQuestionItem, status: str, *, call_id: str = ""
) -> dict[str, Any]:
    """工具结果回灌给模型的唯一定义(两个执行面共用,避免各写一份漂移)。

    形状对齐既有主聊天流(2026-11-08 定稿):answered 给结构化答案;撤回/超时/
    中断各带 errorCode 与"下一步该怎么做"的 message;continued 是 pending 回执
    (ok=True 但 **不是** 答案,message 明确"不要把挂起当许可")。
    """
    if status == STATUS_CONTINUED:
        return {
            "ok": True,
            "pending": True,
            "status": STATUS_CONTINUED,
            "questionId": item.question_id,
            "callId": call_id or item.continued_call_id,
            "message": pending_question_notice(item, call_id),
        }
    if status == STATUS_ANSWERED:
        labels = [opt["label"] for opt in item.options if opt["id"] in item.selected_ids]
        return {
            "ok": True,
            "status": STATUS_ANSWERED,
            "selectedOptionIds": list(item.selected_ids),
            "labels": labels,
            "customText": item.custom_text,
        }
    if status == STATUS_WITHDRAWN:
        return {
            "ok": False,
            "status": STATUS_WITHDRAWN,
            "errorCode": "question_withdrawn",
            "error": "问题已被撤回,未得到用户答复",
            "message": "不要重试同一问题;确有必要请另起一次提问",
        }
    if status == STATUS_INTERRUPTED:
        return {
            "ok": False,
            "status": STATUS_INTERRUPTED,
            "errorCode": "question_interrupted",
            "error": "会话中断,问题未得到用户答复",
        }
    return {
        "ok": False,
        "status": STATUS_TIMEOUT,
        "errorCode": "question_timeout",
        "error": f"用户未在 {item.timeout_seconds()}s 内答复",
        "message": "用户没有答复;不要自行假设答案,按未答继续",
    }


#: 结局 → (isError, error, errorType, 给用户看的解释)。两个执行面同源。
_TOOL_OUTCOMES: dict[str, tuple[bool, str | None, str | None, str]] = {
    STATUS_ANSWERED: (True, None, None, "用户已答复提问"),
    STATUS_CONTINUED: (True, None, None, "提问等待到期,转入挂起(用户仍可答复)"),
    STATUS_WITHDRAWN: (False, "question_withdrawn", "question_withdrawn", "提问已被撤回"),
    STATUS_INTERRUPTED: (False, "question_interrupted", "question_interrupted", "提问因会话中断结束"),
    STATUS_TIMEOUT: (False, "question_timeout", "question_timeout", "提问等待答复超时"),
}


def tool_result_outcome(status: str) -> tuple[bool, str | None, str | None, str]:
    """结局 → (ok, error, errorType, explanation);未知结局按 timeout 收口。"""
    return _TOOL_OUTCOMES.get(status, _TOOL_OUTCOMES[STATUS_TIMEOUT])


async def wait_for_answer(item: AskUserQuestionItem, timeout_s: float | None = None) -> str:
    """阻塞等待答复;返回 answered / timeout / withdrawn / interrupted。

    超时把条目落为 timeout 并 set event(幂等:已被别处结算时保持原状态)。
    """
    budget = timeout_s if timeout_s is not None else question_timeout_s()
    remaining = (item.expires_at - _now()).total_seconds()
    effective = min(budget, remaining) if remaining > 0 else 0.0
    try:
        await asyncio.wait_for(item.event.wait(), timeout=effective)
    except TimeoutError:
        with _registry_lock:
            if item.status == STATUS_PENDING:
                item.status = STATUS_TIMEOUT
                item.reason = "timeout"
                item.event.set()
        return item.status
    return item.status
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
