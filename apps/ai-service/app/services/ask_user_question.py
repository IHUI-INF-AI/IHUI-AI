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

STATUS_PENDING = "pending"
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

    def to_dict(self) -> dict[str, Any]:
        """SSE 下行帧形状(与 question_parser.Question.to_dict() 同形 + 两个附加键)。"""
        options: list[dict[str, str]] = []
        for opt in self.options:
            item = {"id": opt["id"], "label": opt["label"]}
            # description 是可选附加键(既有 id/label 键名不变,前端按未知键忽略)
            if opt.get("description"):
                item["description"] = opt["description"]
            options.append(item)
        return {
            "questionId": self.question_id,
            "prompt": self.prompt,
            "options": options,
            "allowCustom": self.allow_custom,
            "allowMultiple": self.allow_multiple,
            "sessionId": self.session_id,
            "expiresAt": _iso(self.expires_at),
        }

    def resolved_payload(self, status: str | None = None) -> dict[str, Any]:
        """question-resolved 帧载荷(questionId/status 为必需键)。"""
        return {
            "questionId": self.question_id,
            "status": status or self.status,
            "selectedOptionIds": list(self.selected_ids),
            "customText": self.custom_text,
        }


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
) -> AskUserQuestionItem | dict[str, Any]:
    """登记一个问题;参数非法时返回结构化错误 dict(不抛异常)。"""
    if not isinstance(session_id, str) or not session_id.strip():
        return _error("question_session_required", "session_id 必填")
    if not isinstance(prompt, str) or not prompt.strip():
        return _error("question_invalid_prompt", "question(prompt) 必须是非空字符串")
    normalized, option_error = _normalize_options(options)
    if option_error is not None:
        return option_error

    now = _now()
    timeout_s = question_timeout_s()
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
        expires_at=now + timedelta(seconds=timeout_s),
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
