# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:retained context — 压缩契约外的有界宿主事实账本。

对标 codex-rs/history/src/retained_context.rs(510 行,逐条移植核心语义):
- 宿主持有的模型不可见事实,活在 compaction 契约之外;
  压缩不过期它们,指令边界回滚才清除。
- 两族记录:VerifiedAnswer(原始问题+宿主验证回答,绝非推断授权)
  与 RetainedUserMessage(原始用户指令,供委托审查留存)。
- Local/Inherited 双序域:父线程计数器不得在本线程建立顺序;
  Inherited 前缀序恒先于 Local 接受序。
- 有界:MAX_FAMILY_RECORDS=8 / MAX_RECORD_BYTES=16384 / MAX_FAMILY_BYTES=65536,
  驱逐按接受序(非落盘序),驱逐即置 incomplete(丢失证据不得当完整授权史)。
- 记录幂等:同内容同源重复记录零副作用;变更内容替换该源记录。
- rollback:按原用户消息边界回滚(含其后接受的全部事实)。
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Iterator

MAX_FAMILY_RECORDS = 8
MAX_RECORD_BYTES = 16_384
MAX_FAMILY_BYTES = 65_536

_INHERITED_SEQ_BASE = -(1 << 62)  # Inherited 序域映射到负空间,保证先于 Local


@dataclass
class VerifiedQuestionAnswer:
    question: str
    answer: str


@dataclass
class VerifiedAnswer:
    turn_id: str
    call_id: str
    questions: list[VerifiedQuestionAnswer] = field(default_factory=list)


@dataclass
class RetainedUserMessage:
    turn_id: str
    message_id: str | None
    text: str
    complete: bool


@dataclass
class _Ordered:
    inherited: bool
    order: int
    value: Any

    def sort_key(self) -> int:
        """Inherited 前缀序先于 Local 接受序(双序域不裸比较)。"""
        if self.inherited:
            return _INHERITED_SEQ_BASE + self.order
        return self.order


def _json_bytes(obj: Any) -> int:
    try:
        return len(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))
    except (TypeError, ValueError):
        return MAX_RECORD_BYTES + 1


def _floor_char_boundary(text: str, index: int) -> int:
    if index >= len(text):
        return len(text)
    while index > 0 and (text[index].encode("utf-8") and (ord(text[index]) & 0xC0) == 0x80):
        index -= 1
    return index


def _bound_message(message: RetainedUserMessage) -> None:
    """对标 RetainedUserMessage::bound():超限清空正文,身份截 1024 字符边界。"""
    if _json_bytes(message) > MAX_RECORD_BYTES:
        message.text = ""
        message.complete = False
        message.turn_id = message.turn_id[: _floor_char_boundary(message.turn_id, 1024)]
        if message.message_id is not None:
            message.message_id = message.message_id[
                : _floor_char_boundary(message.message_id, 1024)
            ]


def _bound_answer(answer: VerifiedAnswer) -> None:
    if _json_bytes(answer) > MAX_RECORD_BYTES:
        answer.questions = []
        answer.turn_id = answer.turn_id[: _floor_char_boundary(answer.turn_id, 1024)]
        answer.call_id = answer.call_id[: _floor_char_boundary(answer.call_id, 1024)]


def _bound_family(items: deque[_Ordered], incomplete: bool) -> tuple[deque[_Ordered], bool]:
    """对标 bound_family():按接受序排序后驱逐最旧,驱逐即置 incomplete。"""
    ordered = sorted(items, key=_Ordered.sort_key)
    while len(ordered) > MAX_FAMILY_RECORDS or _json_bytes(
        [e.value for e in ordered]
    ) > MAX_FAMILY_BYTES:
        if not ordered:
            break
        ordered.pop(0)
        incomplete = True
    return deque(ordered), incomplete


@dataclass
class RetainedContext:
    """有界宿主事实快照,随压缩 checkpoint 一起持久化。"""

    verified_answers: deque[_Ordered] = field(default_factory=deque)
    verified_answers_incomplete: bool = False
    user_messages: deque[_Ordered] = field(default_factory=deque)
    # 旧 checkpoint 未留存用户指令供委托审查——默认 incomplete。
    user_messages_incomplete: bool = True
    next_order: int = 0

    def reserve_order(self) -> int:
        """预留顺序但不留存可能被 hook 拒绝的输入。"""
        order = self.next_order
        self.next_order += 1
        return order

    def _record_order(self, acceptance_order: int | None) -> int:
        order = self.next_order if acceptance_order is None else acceptance_order
        self.next_order = max(self.next_order, order + 1)
        return order

    def record_user_message(
        self,
        message: RetainedUserMessage,
        *,
        inherited: bool = False,
        acceptance_order: int | None = None,
    ) -> None:
        """记录已投递用户项;继承指令用前缀序,不推进本地计数器。

        继承即置 verified_answers_incomplete(worker fork 缺父答案记录,
        采纳其指令无法确认遗漏的回答是否限制了继承授权)。
        """
        _bound_message(message)
        self.verified_answers_incomplete |= inherited
        index = next(
            (
                i
                for i, entry in enumerate(self.user_messages)
                if message.message_id is not None
                and entry.value.message_id == message.message_id
            ),
            None,
        )
        if index is not None:
            entry = self.user_messages[index]
            if entry.value == message and entry.inherited == inherited:
                return
            del self.user_messages[index]
        if inherited:
            order = (
                max(
                    (
                        entry.order + 1
                        for entry in self.user_messages
                        if entry.inherited
                    ),
                    default=0,
                )
            )
        else:
            order = self._record_order(acceptance_order)
        self.user_messages.append(_Ordered(inherited, order, message))
        self.user_messages, self.user_messages_incomplete = _bound_family(
            self.user_messages, self.user_messages_incomplete
        )

    def record_verified_answer(
        self,
        answer: VerifiedAnswer,
        acceptance_order: int | None = None,
    ) -> bool:
        """同事件幂等;变更内容替换该源记录。返回是否实际写入。"""
        _bound_answer(answer)
        index = next(
            (
                i
                for i, entry in enumerate(self.verified_answers)
                if entry.value.turn_id == answer.turn_id
                and entry.value.call_id == answer.call_id
            ),
            None,
        )
        if index is not None:
            if self.verified_answers[index].value == answer:
                return False
            del self.verified_answers[index]
        order = self._record_order(acceptance_order)
        self.verified_answers.append(_Ordered(False, order, answer))
        self.verified_answers, self.verified_answers_incomplete = _bound_family(
            self.verified_answers, self.verified_answers_incomplete
        )
        return True

    def verified_answers_complete(self) -> bool:
        return not self.verified_answers_incomplete and all(
            entry.value.questions for entry in self.verified_answers
        )

    def user_messages_complete(self) -> bool:
        return not self.user_messages_incomplete and all(
            entry.value.complete for entry in self.user_messages
        )

    def mark_user_messages_incomplete(self) -> None:
        """跳过的指令留下缺口,后续 checkpoint 必须保留该缺口。"""
        self.user_messages_incomplete = True

    def ordered_entries(self) -> Iterator[tuple[bool, int, Any]]:
        """跨两族按持久序输出(显式接受序跨延迟记录存活)。"""
        merged = [
            (entry.sort_key(), entry.inherited, entry.order, entry.value)
            for entry in [*self.verified_answers, *self.user_messages]
        ]
        merged.sort(key=lambda t: t[0])
        for _, inherited, order, value in merged:
            yield inherited, order, value

    def rollback(
        self,
        turn_ids: list[str],
        first_removed_message_id: str | None,
        *,
        acceptance_order: int | None = None,
    ) -> None:
        """按原用户消息边界回滚,含其后接受的全部事实。

        steering 可能共享 turn ID;无消息身份的 legacy 源退化为
        turn 移除,且无法建立完整留存指令(置 incomplete)。
        """
        boundary: int | None = None
        if acceptance_order is not None:
            boundary = acceptance_order
        elif first_removed_message_id is not None:
            for entry in self.user_messages:
                if entry.value.message_id == first_removed_message_id:
                    boundary = entry.sort_key()
                    break
        if boundary is not None:
            self.user_messages = deque(
                e for e in self.user_messages if e.sort_key() < boundary
            )
            self.verified_answers = deque(
                e for e in self.verified_answers if e.sort_key() < boundary
            )
            return
        self.user_messages_incomplete |= first_removed_message_id is not None or any(
            entry.value.turn_id in turn_ids for entry in self.user_messages
        )
        self.verified_answers = deque(
            e for e in self.verified_answers if e.value.turn_id not in turn_ids
        )
        self.user_messages = deque(
            e for e in self.user_messages if e.value.turn_id not in turn_ids
        )
