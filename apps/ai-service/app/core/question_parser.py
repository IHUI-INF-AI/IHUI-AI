"""AI 主动提问标记解析器。

LLM 在流式输出中可嵌入特殊标记向用户提问,本解析器负责:
- 检测内容中的 `[[ASK_USER:JSON]]` 标记
- 解析为结构化 Question 对象
- 从原始内容中剥离标记(不污染对话文本)

标记格式(JSON 内字段):
    [[ASK_USER:{"prompt":"需要澄清的问题","options":[{"id":"opt1","label":"选项1"}],"allowCustom":true,"allowMultiple":false}]]

设计原则:
- 标记可能跨多个 chunk 到达(流式分片),解析器需状态化累积
- 不完整标记不立即输出,等收到完整闭合 `]]` 后再 emit
- 一个 chunk 内可能含多个标记
- 已剥离标记的纯文本照常作为 delta 流式输出
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any


MARKER_OPEN = "[[ASK_USER:"
MARKER_CLOSE = "]]"

# 完整标记正则(用于一次性匹配整段已累积内容)
# 标记内可以是任意内容(不强制 JSON 对象格式),由 parse_question_json 负责合法性校验
_COMPLETE_RE = re.compile(re.escape(MARKER_OPEN) + r"(.*?)" + re.escape(MARKER_CLOSE), re.DOTALL)


@dataclass
class QuestionOption:
    """问题选项。"""

    id: str
    label: str


@dataclass
class Question:
    """结构化提问对象。"""

    question_id: str
    prompt: str
    options: list[QuestionOption] = field(default_factory=list)
    allow_custom: bool = True
    allow_multiple: bool = False

    def to_dict(self) -> dict[str, Any]:
        """转 SSE 推送格式。"""
        return {
            "questionId": self.question_id,
            "prompt": self.prompt,
            "options": [{"id": o.id, "label": o.label} for o in self.options],
            "allowCustom": self.allow_custom,
            "allowMultiple": self.allow_multiple,
        }


def _gen_question_id() -> str:
    """生成问题 ID(短UUID,够用且对前端友好)。"""
    import uuid

    return uuid.uuid4().hex[:12]


def parse_question_json(raw: str) -> Question | None:
    """把标记内的 JSON 字符串解析为 Question 对象。

    JSON 字段映射:
    - prompt (str, 必填): 问题文本
    - options (list, 可选): 选项数组,每项 {id,label}
    - allowCustom (bool, 默认 True): 是否允许自由输入
    - allowMultiple (bool, 默认 False): 是否允许多选

    解析失败返回 None(调用方应丢弃,不应阻塞流)。
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    prompt = data.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return None

    options: list[QuestionOption] = []
    raw_opts = data.get("options") or []
    if isinstance(raw_opts, list):
        for opt in raw_opts:
            if not isinstance(opt, dict):
                continue
            oid = opt.get("id")
            olabel = opt.get("label")
            if not isinstance(oid, str) or not isinstance(olabel, str):
                continue
            options.append(QuestionOption(id=oid, label=olabel))

    return Question(
        question_id=_gen_question_id(),
        prompt=prompt.strip(),
        options=options,
        allow_custom=bool(data.get("allowCustom", True)),
        allow_multiple=bool(data.get("allowMultiple", False)),
    )


class QuestionStreamParser:
    """流式提问标记解析器(状态化,处理跨 chunk 分片)。

    用法:
        parser = QuestionStreamParser()
        for chunk in stream:
            text_delta, questions = parser.feed(chunk)
            if text_delta:
                yield text_delta  # 正常内容继续流式
            for q in questions:
                yield q  # 结构化提问,触发 UI 弹窗
        # 流结束时 flush 残留(不完整标记丢弃,不阻塞)
        text_delta, _ = parser.flush()
        if text_delta:
            yield text_delta
    """

    def __init__(self) -> None:
        # 累积缓冲(可能含不完整标记)
        self._buffer: str = ""

    def feed(self, chunk: str) -> tuple[str, list[Question]]:
        """喂入一个 chunk,返回 (纯文本 delta, 提问列表)。

        - 纯文本 delta:已剥离完整标记的可见文本(可能为空字符串)
        - 提问列表:本 chunk 内解析出的所有完整提问(可能为空)
        """
        if not chunk:
            return "", []

        self._buffer += chunk
        text_out: list[str] = []
        questions: list[Question] = []

        # 反复扫描完整标记,直到没有完整标记可匹配
        while True:
            match = _COMPLETE_RE.search(self._buffer)
            if not match:
                break

            # 标记前的文本(纯内容)
            before = self._buffer[: match.start()]
            if before:
                text_out.append(before)

            # 解析标记内的 JSON
            raw_json = match.group(1)
            q = parse_question_json(raw_json)
            if q is not None:
                questions.append(q)

            # 移除已消费部分(标记本身丢弃,不进 text_out)
            self._buffer = self._buffer[match.end() :]

        # 检查 buffer 中是否有"未闭合的开标记"
        # 如果有,把开标记之前的内容输出,保留开标记及之后的内容等待下个 chunk
        open_idx = self._buffer.find(MARKER_OPEN)
        if open_idx != -1:
            # 有开标记,把开标记之前的内容输出,保留开标记及之后
            if open_idx > 0:
                text_out.append(self._buffer[:open_idx])
                self._buffer = self._buffer[open_idx:]
        else:
            # 无完整开标记,检查 buffer 末尾是否是 MARKER_OPEN 的某个前缀
            # (可能是开标记被切到下个 chunk,如 "[[ASK_USE")
            max_prefix_len = 0
            max_check = min(len(MARKER_OPEN) - 1, len(self._buffer))
            for plen in range(max_check, 0, -1):
                if self._buffer.endswith(MARKER_OPEN[:plen]):
                    max_prefix_len = plen
                    break

            if max_prefix_len > 0:
                # 保留末尾前缀,输出之前的内容
                safe_len = len(self._buffer) - max_prefix_len
                if safe_len > 0:
                    text_out.append(self._buffer[:safe_len])
                    self._buffer = self._buffer[safe_len:]
            else:
                # 末尾不是任何前缀,全部输出
                text_out.append(self._buffer)
                self._buffer = ""

        return "".join(text_out), questions

    def flush(self) -> tuple[str, list[Question]]:
        """流结束时调用,返回残留文本(不完整标记直接丢弃,不阻塞)。

        残留 buffer 可能是:
        - 空字符串
        - 不完整的开标记(如 `[[ASK_USE` 或 `[[ASK_USER:{"prompt":"未闭合`)
        - 完整开标记但未闭合(如 `[[ASK_USER:{"prompt":"x"}`)
        全部作为普通文本输出(让用户看到 AI 的原始输出,避免吞内容)。
        """
        leftover = self._buffer
        self._buffer = ""
        if not leftover:
            return "", []
        # 残留含开标记 → 不安全直接输出(可能是 AI 输出失误,把标记原样暴露)
        # 但为了"不吞内容",原样输出
        return leftover, []
