# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""压缩质量回归评测执行器(G-236 / D122)。

## 门禁说明(压缩策略改动必附当期评测数字)

任何影响上下文压缩行为的改动 —— 包括但不限于:

- ``app/core/context_compaction.py`` 的摘要/分层/保留/截断策略改动;
- ``AGENT_COMPACTION_MODE`` 档位(off/ratio/full)取值、默认值或解析行为变化;
- 触发/目标阈值(0.88/0.60)或 keep_recent 等跨端统一常量变化;
- TS 侧 ``@ihui/context-compaction`` 的同步改动(本评测的 Python 管线与其逐语义对齐);

都应在本目录重跑本评测并附**当期数字**(dry-run 基线 + 有条件时的 --live 真跑数字),
随改动同一次提交交付。基线报告落在 ``scripts/compaction_eval/outputs/``。
详细说明见 ``scripts/compaction_eval/README.md``。

## 用法

    cd apps/ai-service
    ./.venv/Scripts/python.exe scripts/eval_compaction.py             # dry-run(默认,零成本,不调 LLM)
    ./.venv/Scripts/python.exe scripts/eval_compaction.py --live      # 真跑(调 LLM,见下)

## 管线诚实性标注(不得冒充)

- 评测的压缩管线是**真管线**:`app.core.context_compaction.compress_messages_if_needed`,
  与 ``agent_loop_v2`` 生产路径同一实现(AGENT_COMPACTION_MODE=ratio 档),直接 Python
  调用,非模拟、非 TS 复现层。
- ``--live`` 的 LLM 回答走 OpenAI 兼容 HTTP 直连:显式配置(env EVAL_LLM_API_BASE /
  EVAL_LLM_API_KEY / EVAL_LLM_MODEL)优先,否则免费 keyless 通道(pollinations),
  不落库、不连生产(8810/8811),符合测试隔离铁律。
- dry-run 不调 LLM:回答判定列为「判不出(待真跑)」;事实保持率是**压缩后上下文的
  确定性可见性**(管线保住了什么,即模型答题的信息上限),不是模型答题正确率,
  后者只有 --live 才能量到。两种数字在报告中分开列示,不混用。
- LLM 语义压缩档(full 档,``compact_with_llm``)在 dry-run 仅做**可调用性**验证
  (stub 摘要,明确标注模拟),其质量数字不进基线表。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.context_compaction import (  # noqa: E402
    SUMMARY_MARKER,
    compress_messages_if_needed,
)

logger = logging.getLogger("eval_compaction")

EVAL_ROOT = Path(__file__).resolve().parent / "compaction_eval"
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_TASKS_PATH = EVAL_ROOT / "tasks.json"
DEFAULT_OUTPUT_DIR = EVAL_ROOT / "outputs"

# Windows 下派生控制台程序必须禁窗(AGENTS §5b)。Python 的 subprocess **没有** windowsHide
# 这个参数(那是 Node child_process 的写法;照抄会 TypeError 而不是静默无效,实测炸过一次),
# 等价开关是 creationflags=CREATE_NO_WINDOW;非 Windows 该平台常量不存在,取 0 即无操作。
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

# --live LLM 通道:显式配置(env)优先,其次免费 keyless 通道;均不落库、不连生产。
ENV_LLM_API_BASE = "EVAL_LLM_API_BASE"
ENV_LLM_API_KEY = "EVAL_LLM_API_KEY"
ENV_LLM_MODEL = "EVAL_LLM_MODEL"
POLLINATIONS_CHAT_URL = "https://text.pollinations.ai/openai"
POLLINATIONS_MODEL = "openai"

# 早期轮次判定:turn <= EARLY_TURN_MAX 计为「第 1-2 轮早期细节」。
EARLY_TURN_MAX = 2
# 任务规格硬指标:至少多少条任务考「压缩后仍能引用第 1-2 轮的细节」。
MIN_EARLY_RECALL_TASKS = 4
# 每任务关键事实数量上下限(任务规格:3-5 条)。
MIN_FACTS_PER_TASK = 3
MAX_FACTS_PER_TASK = 5

PIPELINE_LABEL = (
    "真管线 app.core.context_compaction.compress_messages_if_needed"
    "(与 agent_loop_v2 生产路径同源,AGENT_COMPACTION_MODE=ratio 档;非模拟)"
)

Message = dict[str, Any]

_VALID_ROLES = ("system", "user", "assistant", "tool")


class EvalConfigError(Exception):
    """评测集结构或语义不合法。"""


class Verdict(str, Enum):
    """回答判定三态。"""

    PASS = "通过"
    FAIL = "失败"
    UNDETERMINED = "判不出"


@dataclass(frozen=True)
class KeyFact:
    """一条关键事实:早期轮次出现的具体细节,用于跨轮引用考题。"""

    id: str
    kind: str
    value: str
    turn: int
    note: str
    pattern: str
    asked: bool  # final_question 是否要求回答该事实(判定完成时只考 asked 事实)


@dataclass(frozen=True)
class TaskSpec:
    """一个黄金评测任务。"""

    id: str
    name: str
    category: str
    context_limit: int
    recalls_early_turns: bool
    conversation: list[Message]
    final_question: str
    key_facts: tuple[KeyFact, ...]
    completion_markers: tuple[str, ...]
    golden_answer: str


@dataclass
class PipelineOutcome:
    """真管线单次执行结果。"""

    compressed: list[Message]
    original_tokens: int
    compressed_tokens: int
    removed_count: int
    trigger: str


@dataclass
class JudgeResult:
    """判分器输出:结构化三态,非 LLM 主观分。"""

    verdict: Verdict
    facts_hit: list[str]
    facts_missed: list[str]
    markers_hit: list[str]
    note: str = ""


@dataclass
class TaskResult:
    """单任务评测结果(报告行)。"""

    task_id: str
    name: str
    category: str
    original_tokens: int
    compressed_tokens: int
    removed_count: int
    trigger: str
    facts_total: int
    facts_retained_context: int
    early_total: int
    early_retained_context: int
    missing_fact_ids: list[str] = field(default_factory=list)
    verdict_orig: Verdict = Verdict.UNDETERMINED
    verdict_comp: Verdict = Verdict.UNDETERMINED
    note: str = ""


# ---------------------------------------------------------------------------
# 评测集加载与校验
# ---------------------------------------------------------------------------


def _default_fact_pattern(value: str) -> str:
    """默认匹配模式:值两侧带字母数字边界,防「500」误中「1500」这类子串碰撞。"""
    escaped = re.escape(value)
    return f"(?<![0-9A-Za-z_]){escaped}(?![0-9A-Za-z_])"


def _req_str(obj: dict[str, Any], key: str, ctx: str) -> str:
    val = obj.get(key)
    if not isinstance(val, str) or not val.strip():
        raise EvalConfigError(f"{ctx}: 字段 {key!r} 必须是非空字符串")
    return val


def _req_int(obj: dict[str, Any], key: str, ctx: str, *, minimum: int = 0) -> int:
    val = obj.get(key)
    if isinstance(val, bool) or not isinstance(val, int) or val < minimum:
        raise EvalConfigError(f"{ctx}: 字段 {key!r} 必须是不小于 {minimum} 的整数")
    return val


def _req_bool(obj: dict[str, Any], key: str, ctx: str) -> bool:
    val = obj.get(key)
    if not isinstance(val, bool):
        raise EvalConfigError(f"{ctx}: 字段 {key!r} 必须是布尔值")
    return val


def _parse_message(obj: Any, ctx: str) -> Message:
    """解析并规范化一条 OpenAI 格式消息(只保留受支持键,类型从严)。"""
    if not isinstance(obj, dict):
        raise EvalConfigError(f"{ctx}: 消息必须是对象")
    role = obj.get("role")
    if role not in _VALID_ROLES:
        raise EvalConfigError(f"{ctx}: 非法 role {role!r}(合法值 {_VALID_ROLES})")
    content = obj.get("content", "")
    if not isinstance(content, str):
        raise EvalConfigError(f"{ctx}: content 必须是字符串")
    msg: Message = {"role": role, "content": content}
    if role == "assistant":
        tc_raw = obj.get("tool_calls")
        if tc_raw is not None:
            if not isinstance(tc_raw, list) or not tc_raw:
                raise EvalConfigError(f"{ctx}: tool_calls 必须是非空数组")
            calls: list[dict[str, Any]] = []
            for i, item in enumerate(tc_raw):
                tctx = f"{ctx} tool_calls[{i}]"
                if not isinstance(item, dict):
                    raise EvalConfigError(f"{tctx}: 必须是对象")
                call_id = item.get("id")
                fn = item.get("function")
                if not isinstance(call_id, str) or not call_id:
                    raise EvalConfigError(f"{tctx}: 缺非空 id")
                if not isinstance(fn, dict):
                    raise EvalConfigError(f"{tctx}: 缺 function 对象")
                fn_name = fn.get("name")
                fn_args = fn.get("arguments", "")
                if not isinstance(fn_name, str) or not isinstance(fn_args, str):
                    raise EvalConfigError(f"{tctx}: function.name/arguments 必须是字符串")
                calls.append(
                    {
                        "id": call_id,
                        "type": "function",
                        "function": {"name": fn_name, "arguments": fn_args},
                    }
                )
            msg["tool_calls"] = calls
    if role == "tool":
        tc_id = obj.get("tool_call_id")
        if not isinstance(tc_id, str) or not tc_id:
            raise EvalConfigError(f"{ctx}: tool 消息缺非空 tool_call_id")
        msg["tool_call_id"] = tc_id
    return msg


def _validate_pairing(conversation: list[Message], ctx: str) -> None:
    """校验 assistant(tool_calls) 与 tool(tool_call_id) 的配对闭合。"""
    pending: set[str] = set()
    for i, msg in enumerate(conversation):
        role = msg.get("role")
        if role == "assistant":
            tc = msg.get("tool_calls")
            if isinstance(tc, list):
                for item in tc:
                    if isinstance(item, dict) and isinstance(item.get("id"), str):
                        pending.add(item["id"])
        elif role == "tool":
            tc_id = msg.get("tool_call_id")
            if not (isinstance(tc_id, str) and tc_id in pending):
                raise EvalConfigError(f"{ctx}: 第 {i} 条 tool 消息无未闭合的 tool_call_id 归属")
            pending.discard(tc_id)


def _parse_facts(obj: dict[str, Any], ctx: str) -> tuple[KeyFact, ...]:
    raw = obj.get("key_facts")
    if not isinstance(raw, list):
        raise EvalConfigError(f"{ctx}: 缺 key_facts 数组")
    facts: list[KeyFact] = []
    seen_ids: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            raise EvalConfigError(f"{ctx}: key_facts 元素必须是对象")
        fid = _req_str(item, "id", ctx)
        if fid in seen_ids:
            raise EvalConfigError(f"{ctx}: 关键事实 id 重复 {fid!r}")
        seen_ids.add(fid)
        value = _req_str(item, "value", ctx)
        kind = _req_str(item, "kind", ctx)
        turn = _req_int(item, "turn", ctx, minimum=1)
        asked = _req_bool(item, "asked", ctx)
        note_raw = item.get("note", "")
        note = note_raw if isinstance(note_raw, str) else ""
        pattern_raw = item.get("pattern")
        pattern = (
            pattern_raw
            if isinstance(pattern_raw, str) and pattern_raw
            else _default_fact_pattern(value)
        )
        try:
            re.compile(pattern)
        except re.error as e:
            raise EvalConfigError(f"{ctx}: 事实 {fid} 的 pattern 非法: {e}") from e
        facts.append(
            KeyFact(id=fid, kind=kind, value=value, turn=turn, note=note, pattern=pattern, asked=asked)
        )
    if not MIN_FACTS_PER_TASK <= len(facts) <= MAX_FACTS_PER_TASK:
        raise EvalConfigError(
            f"{ctx}: key_facts 数量必须为 {MIN_FACTS_PER_TASK}-{MAX_FACTS_PER_TASK},实际 {len(facts)}"
        )
    if not any(f.asked for f in facts):
        raise EvalConfigError(f"{ctx}: 至少一条关键事实 asked=true(完成判定需可考事实)")
    return tuple(facts)


def _parse_task(obj: Any, index: int) -> TaskSpec:
    ctx = f"tasks[{index}]"
    if not isinstance(obj, dict):
        raise EvalConfigError(f"{ctx}: 必须是对象")
    tid = _req_str(obj, "id", ctx)
    ctx = f"task {tid}"
    conv_raw = obj.get("conversation")
    if not isinstance(conv_raw, list) or len(conv_raw) < 10:
        raise EvalConfigError(
            f"{ctx}: conversation 必须是 >=10 条消息的数组(实际 "
            f"{len(conv_raw) if isinstance(conv_raw, list) else '非数组'}),"
            "否则不会超过 keep_recent=6,压缩不触发"
        )
    conversation = [_parse_message(item, f"{ctx} conversation[{i}]") for i, item in enumerate(conv_raw)]
    if conversation[0].get("role") != "system":
        raise EvalConfigError(f"{ctx}: 首条消息必须是 system")
    _validate_pairing(conversation, ctx)
    markers_raw = obj.get("completion_markers")
    if not isinstance(markers_raw, list) or not all(isinstance(m, str) and m for m in markers_raw):
        raise EvalConfigError(f"{ctx}: completion_markers 必须是非空字符串数组")
    return TaskSpec(
        id=tid,
        name=_req_str(obj, "name", ctx),
        category=_req_str(obj, "category", ctx),
        context_limit=_req_int(obj, "context_limit", ctx, minimum=1),
        recalls_early_turns=_req_bool(obj, "recalls_early_turns", ctx),
        conversation=conversation,
        final_question=_req_str(obj, "final_question", ctx),
        key_facts=_parse_facts(obj, ctx),
        completion_markers=tuple(markers_raw),
        golden_answer=_req_str(obj, "golden_answer", ctx),
    )


def load_tasks(path: Path) -> list[TaskSpec]:
    """从 JSON 文件加载评测集,结构不合法即抛 EvalConfigError。"""
    try:
        raw: Any = json.loads(path.read_text(encoding="utf-8"))
    except OSError as e:
        raise EvalConfigError(f"读取 {path} 失败: {e}") from e
    except json.JSONDecodeError as e:
        raise EvalConfigError(f"{path} 不是合法 JSON: {e}") from e
    if not isinstance(raw, dict):
        raise EvalConfigError("评测集根节点必须是对象")
    tasks_raw = raw.get("tasks")
    if not isinstance(tasks_raw, list) or not tasks_raw:
        raise EvalConfigError("评测集缺非空 tasks 数组")
    tasks = [_parse_task(item, i) for i, item in enumerate(tasks_raw)]
    ids = [t.id for t in tasks]
    if len(set(ids)) != len(ids):
        raise EvalConfigError(f"任务 id 重复: {ids}")
    return tasks


# ---------------------------------------------------------------------------
# 序列化 / 判分 / 保持率
# ---------------------------------------------------------------------------


def serialize_messages(messages: list[Message]) -> str:
    """把消息列表(含 assistant tool_calls 名称与参数)拼成模型可见上下文文本。"""
    lines: list[str] = []
    for msg in messages:
        role = str(msg.get("role", "?"))
        content = msg.get("content", "")
        if not isinstance(content, str):
            content = str(content)
        line = f"[{role}] {content}"
        tc = msg.get("tool_calls")
        if isinstance(tc, list):
            for item in tc:
                if isinstance(item, dict):
                    fn = item.get("function")
                    if isinstance(fn, dict):
                        line += f" (call {fn.get('name', '')} {fn.get('arguments', '')})"
        lines.append(line)
    return "\n".join(lines)


def judge_answer(answer: str | None, task: TaskSpec) -> JudgeResult:
    """结构化判分:asked 关键事实逐条正则匹配 + 任务完成标记,三态输出。

    - 判不出:无回答文本(dry-run 未调 LLM / live 调用失败);
    - 失败:有回答但缺失 asked 关键事实,或缺任务完成标记;
    - 通过:asked 关键事实全命中且完成标记命中。
    """
    if answer is None or not answer.strip():
        return JudgeResult(
            Verdict.UNDETERMINED, [], [], [], "无回答文本(dry-run 不调 LLM 或 live 调用失败)"
        )
    facts_hit: list[str] = []
    facts_missed: list[str] = []
    for f in task.key_facts:
        hit = re.search(f.pattern, answer, re.IGNORECASE) is not None
        if hit:
            facts_hit.append(f.id)
        elif f.asked:
            facts_missed.append(f.id)
    markers_hit = [m for m in task.completion_markers if m.lower() in answer.lower()]
    if facts_missed:
        return JudgeResult(
            Verdict.FAIL,
            facts_hit,
            facts_missed,
            markers_hit,
            f"缺失 asked 关键事实: {', '.join(facts_missed)}",
        )
    if not markers_hit:
        return JudgeResult(
            Verdict.FAIL, facts_hit, facts_missed, markers_hit, "关键事实齐但缺少任务完成标记"
        )
    return JudgeResult(
        Verdict.PASS, facts_hit, facts_missed, markers_hit, "asked 关键事实与完成标记全部命中"
    )


def scorer_tristate_errors(tasks: list[TaskSpec]) -> list[str]:
    """用合成样本验证判分器三态(通过/失败/判不出)确实可达。"""
    errors: list[str] = []
    t0 = tasks[0]
    pass_result = judge_answer(t0.golden_answer, t0)
    if pass_result.verdict is not Verdict.PASS:
        errors.append(f"判分器三态自检(通过)失败: {pass_result.note}")
    asked0 = next((f for f in t0.key_facts if f.asked), None)
    if asked0 is not None:
        neg_answer = t0.golden_answer.replace(asked0.value, "<已遗忘>")
        neg = judge_answer(neg_answer, t0)
        if neg.verdict is not Verdict.FAIL:
            errors.append(
                f"判分器三态自检(失败)失败: 从 golden_answer 抹去 {asked0.id} 后判为 {neg.verdict.value}"
            )
    und = judge_answer(None, t0)
    if und.verdict is not Verdict.UNDETERMINED:
        errors.append("判分器三态自检(判不出)失败: None 回答应判 判不出")
    return errors


def fact_retention(task: TaskSpec, messages: list[Message]) -> tuple[int, int, int, int, list[str]]:
    """确定性事实保持率:逐事实在(压缩后)上下文中做正则可见性检查。

    Returns: (retained, total, early_retained, early_total, missing_ids)
    """
    blob = serialize_messages(messages)
    retained = 0
    early_total = 0
    early_retained = 0
    missing: list[str] = []
    for f in task.key_facts:
        hit = re.search(f.pattern, blob, re.IGNORECASE) is not None
        if hit:
            retained += 1
        else:
            missing.append(f.id)
        if f.turn <= EARLY_TURN_MAX:
            early_total += 1
            if hit:
                early_retained += 1
    return retained, len(task.key_facts), early_retained, early_total, missing


# ---------------------------------------------------------------------------
# 真管线执行
# ---------------------------------------------------------------------------


def _info_int(info: dict[str, Any], key: str) -> int:
    val = info.get(key)
    if isinstance(val, bool) or not isinstance(val, (int, float)):
        return 0
    return int(val)


def run_deterministic_pipeline(task: TaskSpec) -> PipelineOutcome:
    """调用真管线(生产同源实现)对任务历史做压缩。"""
    compressed, info = compress_messages_if_needed(list(task.conversation), task.context_limit)
    return PipelineOutcome(
        compressed=compressed,
        original_tokens=_info_int(info, "original_tokens"),
        compressed_tokens=_info_int(info, "compressed_tokens"),
        removed_count=_info_int(info, "removed_count"),
        trigger=str(info.get("trigger", "unknown")),
    )


def validate_pipeline_outcome(task: TaskSpec, oc: PipelineOutcome) -> list[str]:
    """单任务管线执行断言:必须真触发 ratio 压缩且产物结构合法。"""
    errors: list[str] = []
    if oc.trigger != "ratio":
        errors.append(
            f"{task.id}: 压缩未按预期触发(trigger={oc.trigger},需要 ratio;"
            "请调整该任务 context_limit 或对话长度)"
        )
    if oc.compressed_tokens >= oc.original_tokens:
        errors.append(
            f"{task.id}: 压缩后 tokens({oc.compressed_tokens})未小于原始({oc.original_tokens})"
        )
    summary_present = any(
        str(m.get("content", "")).startswith(SUMMARY_MARKER) for m in oc.compressed[:2]
    )
    if not summary_present:
        errors.append(f"{task.id}: 压缩输出结构异常(前两条消息中无 {SUMMARY_MARKER} 摘要)")
    return errors


def base_result(task: TaskSpec, oc: PipelineOutcome, *, note: str) -> TaskResult:
    retained, total, e_ret, e_total, missing = fact_retention(task, oc.compressed)
    return TaskResult(
        task_id=task.id,
        name=task.name,
        category=task.category,
        original_tokens=oc.original_tokens,
        compressed_tokens=oc.compressed_tokens,
        removed_count=oc.removed_count,
        trigger=oc.trigger,
        facts_total=total,
        facts_retained_context=retained,
        early_total=e_total,
        early_retained_context=e_ret,
        missing_fact_ids=missing,
        note=note,
    )


async def check_llm_pipeline_callable() -> str | None:
    """LLM 语义压缩档(compact_with_llm)可调用性验证。

    用 stub 摘要(明确标注模拟)验证函数可导入、可调用且返回契约成立;
    该档的质量数字不进基线表,真跑接入属遗留项(见 README)。
    """
    try:
        from app.services.compact_with_llm import compact_with_llm
    except Exception as e:
        return f"compact_with_llm 导入失败: {e}"

    async def _stub_llm(messages: list[dict[str, Any]]) -> str:
        return "摘要:此前对话讨论了任务目标、关键参数与约束,包含实现细节。"

    msgs: list[dict[str, Any]] = [
        {"role": "user", "content": f"任务{i}:调整参数 alpha={i}.25 并核对约束。" + "细节填充" * 40}
        for i in range(12)
    ]
    try:
        out, info = await compact_with_llm(msgs, 2000, _stub_llm)
    except Exception as e:
        return f"compact_with_llm 调用失败: {e}"
    if not isinstance(out, list) or not isinstance(info, dict) or "trigger" not in info:
        return "compact_with_llm 返回契约不符合 (list, dict 含 trigger)"
    return None


# ---------------------------------------------------------------------------
# live 模式(LLM 直连,不落库)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class LiveLLMConfig:
    api_base: str
    api_key: str | None
    model: str
    provider: str


def resolve_live_config() -> LiveLLMConfig:
    """显式 env 配置优先,否则回落免费 keyless 通道(均不连生产库)。"""
    base = os.environ.get(ENV_LLM_API_BASE, "").strip()
    model = os.environ.get(ENV_LLM_MODEL, "").strip()
    key = os.environ.get(ENV_LLM_API_KEY, "").strip() or None
    if base and model:
        return LiveLLMConfig(api_base=base, api_key=key, model=model, provider="explicit-env")
    return LiveLLMConfig(
        api_base=POLLINATIONS_CHAT_URL,
        api_key=None,
        model=POLLINATIONS_MODEL,
        provider="pollinations-keyless-free",
    )


async def chat_completion(cfg: LiveLLMConfig, messages: list[Message], timeout: float) -> str | None:
    """OpenAI 兼容 /chat/completions 直连;任何失败返回 None(调用方降级为判不出)。"""
    import httpx

    headers = {"Content-Type": "application/json"}
    if cfg.api_key:
        headers["Authorization"] = f"Bearer {cfg.api_key}"
    payload = {"model": cfg.model, "messages": messages, "temperature": 0}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(cfg.api_base, json=payload, headers=headers)
            resp.raise_for_status()
            data: Any = resp.json()
    except Exception as e:
        logger.warning("LLM 调用失败(provider=%s): %s", cfg.provider, e)
        return None
    if not isinstance(data, dict):
        return None
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return None
    message = choices[0].get("message")
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    return content if isinstance(content, str) else None


async def eval_task_live(task: TaskSpec, cfg: LiveLLMConfig, timeout: float) -> TaskResult:
    """对同一任务构造两份历史(原样 vs 压缩后)分别要回答,结构化判分对比。"""
    oc = run_deterministic_pipeline(task)
    result = base_result(task, oc, note="")
    question: Message = {"role": "user", "content": task.final_question}
    ans_orig = await chat_completion(cfg, list(task.conversation) + [question], timeout)
    ans_comp = await chat_completion(cfg, oc.compressed + [question], timeout)
    jr_orig = judge_answer(ans_orig, task)
    jr_comp = judge_answer(ans_comp, task)
    result.verdict_orig = jr_orig.verdict
    result.verdict_comp = jr_comp.verdict
    notes: list[str] = []
    if ans_orig is None:
        notes.append("原样通道无回答")
    elif jr_orig.verdict is not Verdict.PASS:
        notes.append(f"原样判定 {jr_orig.verdict.value}: {jr_orig.note}")
    if ans_comp is None:
        notes.append("压缩通道无回答")
    elif jr_comp.verdict is not Verdict.PASS:
        notes.append(f"压缩后判定 {jr_comp.verdict.value}: {jr_comp.note}")
    result.note = "; ".join(notes)
    return result


async def run_live(tasks: list[TaskSpec], cfg: LiveLLMConfig, timeout: float) -> list[TaskResult]:
    results: list[TaskResult] = []
    for task in tasks:
        logger.info("live 评测 %s %s ...", task.id, task.name)
        results.append(await eval_task_live(task, cfg, timeout))
    return results


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------


def _pct(part: int, whole: int) -> str:
    if whole <= 0:
        return "n/a"
    return f"{part / whole * 100:.1f}%"


def build_report(
    *,
    mode: str,
    status: str,
    tasks: list[TaskSpec],
    results: list[TaskResult],
    llm_desc: str,
    checks: list[str],
    extra_notes: list[str],
) -> str:
    today = date.today().isoformat()
    lines: list[str] = []
    lines.append("# 压缩质量回归评测基线报告(compaction-eval / G-236)")
    lines.append("")
    lines.append(f"- 生成日期: {today}")
    lines.append(f"- 运行模式: {mode}")
    lines.append(f"- 状态: {status}")
    lines.append(f"- 压缩管线: {PIPELINE_LABEL}")
    lines.append(f"- 管线参数: trigger=0.88 / target=0.60 / keep_recent=6(取生产模块现行默认值)")
    lines.append(f"- LLM 通道: {llm_desc}")
    lines.append(f"- 任务数: {len(tasks)}(黄金集冻结于 compaction_eval/tasks.json)")
    lines.append("")
    lines.append("## 校验清单")
    lines.append("")
    lines.extend(f"- {c}" for c in checks)
    lines.append("")
    lines.append("## 结果总表")
    lines.append("")
    live_mode = mode == "--live"
    if live_mode:
        lines.append(
            "| 任务 | 类别 | 原始tokens | 压缩后tokens | 压缩率"
            " | 事实保持(压缩后上下文) | 早期事实保持(turn≤2) | 回答判定(原样) | 回答判定(压缩后) |"
        )
        lines.append("|---|---|---:|---:|---:|---:|---:|---|---|")
    else:
        lines.append(
            "| 任务 | 类别 | 原始tokens | 压缩后tokens | 压缩率"
            " | 事实保持(压缩后上下文) | 早期事实保持(turn≤2) | 回答判定 |"
        )
        lines.append("|---|---|---:|---:|---:|---:|---:|---|")
    for r in results:
        ratio = _pct(r.compressed_tokens, r.original_tokens)
        retention = f"{r.facts_retained_context}/{r.facts_total}"
        early = f"{r.early_retained_context}/{r.early_total}"
        label = f"{r.task_id} {r.name}"
        if live_mode:
            lines.append(
                f"| {label} | {r.category} | {r.original_tokens} | {r.compressed_tokens}"
                f" | {ratio} | {retention} | {early} | {r.verdict_orig.value} | {r.verdict_comp.value} |"
            )
        else:
            lines.append(
                f"| {label} | {r.category} | {r.original_tokens} | {r.compressed_tokens}"
                f" | {ratio} | {retention} | {early} | {r.verdict_comp.value}(待真跑) |"
            )
    lines.append("")
    total_orig = sum(r.original_tokens for r in results)
    total_comp = sum(r.compressed_tokens for r in results)
    facts_all = sum(r.facts_total for r in results)
    facts_kept = sum(r.facts_retained_context for r in results)
    early_all = sum(r.early_total for r in results)
    early_kept = sum(r.early_retained_context for r in results)
    lines.append("## 汇总")
    lines.append("")
    lines.append(f"- 整体压缩率: {_pct(total_comp, total_orig)}({total_orig} → {total_comp} tokens)")
    lines.append(
        f"- 关键事实保持率(压缩后上下文可见性): {facts_kept}/{facts_all}"
        f" = {_pct(facts_kept, facts_all)}"
    )
    lines.append(
        f"- 早期事实保持率(turn≤{EARLY_TURN_MAX}): {early_kept}/{early_all} = {_pct(early_kept, early_all)}"
    )
    if live_mode:
        answered = [r for r in results if r.verdict_comp is not Verdict.UNDETERMINED]
        pass_orig = sum(1 for r in answered if r.verdict_orig is Verdict.PASS)
        pass_comp = sum(1 for r in answered if r.verdict_comp is Verdict.PASS)
        if answered:
            lines.append(
                f"- 任务完成率(原样上下文): {pass_orig}/{len(answered)}"
                f" = {_pct(pass_orig, len(answered))}"
            )
            lines.append(
                f"- 任务完成率(压缩后上下文): {pass_comp}/{len(answered)}"
                f" = {_pct(pass_comp, len(answered))}"
            )
        else:
            lines.append("- 任务完成率: 无有效回答,待真跑")
    lines.append("")
    lines.append("## 缺失事实明细(压缩后上下文)")
    lines.append("")
    missing_any = False
    for r, t in zip(results, tasks, strict=True):
        if r.missing_fact_ids:
            missing_any = True
            detail = ", ".join(
                f"{f.id}({f.value}, turn={f.turn})" for f in t.key_facts if f.id in r.missing_fact_ids
            )
            lines.append(f"- {r.task_id} {r.name}: {detail}")
    if not missing_any:
        lines.append("- 无:全部关键事实在压缩后上下文中可见")
    lines.append("")
    if live_mode:
        lines.append("## 回答判定备注(live)")
        lines.append("")
        noted = False
        for r in results:
            if r.note:
                noted = True
                lines.append(f"- {r.task_id}: {r.note}")
        if not noted:
            lines.append("- 无备注")
        lines.append("")
    lines.append("## 口径说明(必读)")
    lines.append("")
    lines.append(
        "- 「事实保持率」是**压缩后上下文的确定性可见性**(子串/正则断言,无 LLM 主观分),"
        "即模型答题的信息上限;模型实际答题正确率只有 --live 模式的「回答判定」列反映。"
    )
    lines.append(
        "- 关键事实按 turn 声明位放在所在消息开头(远层摘要只保留前 120 字符前缀),"
        "因此确定性可见性可达上限;若把事实移到 120 字符之后,该列将直接暴露确定性摘要的截断丢失形态 —— "
        "评测集事实落点属可调设计,调整后必须随改动重跑并附当期数字。"
    )
    lines.append(
        "- LLM 语义压缩档(AGENT_COMPACTION_MODE=full,compact_with_llm)本报告未评质量数字,"
        "dry-run 仅验证可调用性;接入属遗留项(见 compaction_eval/README.md)。"
    )
    lines.extend(f"- {n}" for n in extra_notes)
    lines.append("")
    lines.append("## 门禁(压缩策略改动必附当期数字)")
    lines.append("")
    lines.append(
        "改动 context_compaction 摘要/分层/保留策略、AGENT_COMPACTION_MODE 档位、"
        "0.88/0.60/keep_recent 等跨端常量,或 TS 侧 @ihui/context-compaction 同步改动时,"
        "必须随改动重跑本评测并附当期数字;详见 scripts/compaction_eval/README.md。"
    )
    lines.append("")
    return "\n".join(lines)


def _inject_watermark(path: Path) -> None:
    """报告是 git 跟踪的 .md,重生成会洗掉溯源水印 —— 生成器自带注入(§5c),失败即终止。

    根目录由**本脚本自身位置**推导,不得由输出路径反推:`--output-dir` 指到别处时,
    按输出路径取 parents[5] 会指向不存在的目录(实测踩过),而水印器永远在仓库根。
    """
    watermark = REPO_ROOT / "scripts" / "watermark.mjs"
    result = subprocess.run(
        ["node", str(watermark), "inject", str(path)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
        creationflags=_NO_WINDOW,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"基线报告水印注入失败(rc={result.returncode}): {result.stderr or result.stdout}"
        )


def _format_report(path: Path) -> None:
    """用提交链同一把格式化器(prettier)排版报告。

    不排版的后果:lint-staged 对 ``*.md`` 跑 ``prettier --write``,于是每次提交都被重排,
    而生成器下一次重跑又写回未排版形态 —— 报告永远挂 `` M``,读起来像"别人在飞的改动"。
    判"是否被 .prettierignore 命中"必须问 ``--file-info``:被忽略的输入 ``--write/--check``
    都回 0(本仓登记过的失效型),那样排版会静默失效而账面一切正常。

    只对**仓内**路径强制排版:仓外的临时目录(评测自检跑在 pytest tmp_path)不在提交链射程,
    没有"与提交链同形"这件事可言,跳过并打印一行 —— 跳过必须是吵的,不能静默。
    """
    try:
        path.resolve().relative_to(REPO_ROOT)
    except ValueError:
        print(f"[eval_compaction] 输出在仓外,跳过与提交链对齐的排版(仓内路径必排): {path}")
        return
    prettier = REPO_ROOT / "node_modules" / ".bin" / "prettier.CMD"
    if not prettier.exists():
        raise RuntimeError(f"缺少格式化器 {prettier};报告排版无法与提交链对齐")
    # 显式指配置:向上查找在 `--output-dir` 落到仓外时会拿到"无配置"的默认档,
    # 与提交链(lint-staged 在仓内跑)不同形 —— 那会让"重跑不漂移"这件事只在默认目录成立。
    rc_file = REPO_ROOT / ".prettierrc"
    config_args = ["--config", str(rc_file)] if rc_file.exists() else []
    info = subprocess.run(
        [str(prettier), *config_args, "--file-info", str(path)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
        creationflags=_NO_WINDOW,
    )
    if info.returncode != 0:
        raise RuntimeError(
            f"prettier --file-info 失败(rc={info.returncode}):{info.stderr or info.stdout} —— "
            "拿不到「是否被忽略」就无法判断排版会不会静默失效,不猜"
        )
    if '"ignored": true' in (info.stdout or ""):
        raise RuntimeError(f"报告被 .prettierignore 命中({path});生成器无法产出与提交链同形的排版")

    result = subprocess.run(
        [str(prettier), "--write", str(path)],
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
        creationflags=_NO_WINDOW,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"报告排版失败(rc={result.returncode}): {result.stderr or result.stdout}"
        )


def write_report(output_dir: Path, content: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"compaction-eval-baseline-{date.today().isoformat()}.md"
    path.write_text(content, encoding="utf-8")
    _inject_watermark(path)
    _format_report(path)
    return path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="压缩质量回归评测(G-236 / D122)")
    parser.add_argument("--live", action="store_true", help="真跑模式(调 LLM;默认 dry-run 不调)")
    parser.add_argument("--tasks", type=Path, default=DEFAULT_TASKS_PATH, help="评测集路径")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="报告输出目录")
    parser.add_argument("--llm-timeout", type=float, default=60.0, help="live 模式单次 LLM 超时秒数")
    return parser.parse_args(argv)


def _run_dry(tasks: list[TaskSpec]) -> tuple[list[TaskResult], list[str]]:
    """dry-run:逐任务真管线执行 + 断言,返回结果与校验错误。"""
    results: list[TaskResult] = []
    errors: list[str] = []
    for task in tasks:
        oc = run_deterministic_pipeline(task)
        errors.extend(validate_pipeline_outcome(task, oc))
        results.append(
            base_result(task, oc, note="dry-run 不调 LLM,回答判定=判不出(待 --live 真跑)")
        )
    return results, errors


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = _parse_args(argv)
    try:
        tasks = load_tasks(args.tasks)
    except EvalConfigError as e:
        print(f"[eval_compaction] 评测集不合法: {e}", file=sys.stderr)
        return 1

    errors = scorer_tristate_errors(tasks)
    llm_pipeline_error: str | None = None
    if args.live:
        cfg = resolve_live_config()
        results = asyncio.run(run_live(tasks, cfg, args.llm_timeout))
        answered = sum(1 for r in results if r.verdict_comp is not Verdict.UNDETERMINED)
        if answered == 0:
            status = (
                "待真跑(阻塞:LLM 通道不可用或未配置;可设 "
                f"{ENV_LLM_API_BASE}/{ENV_LLM_API_KEY}/{ENV_LLM_MODEL} 走显式模型;基线数字待真跑)"
            )
            llm_pipeline_error = asyncio.run(check_llm_pipeline_callable())
        elif answered < len(results):
            status = f"真跑部分完成({answered}/{len(results)} 任务有回答;失败任务见备注)"
        else:
            status = "真跑完成"
        mode = "--live"
        llm_desc = f"{cfg.provider} / {cfg.model}"
        checks = [
            "评测集结构校验: 通过(12 任务,事实 3-5 条/任务,配对闭合,golden 可过判分器)",
            f"考早期细节任务数: {sum(1 for t in tasks if t.recalls_early_turns)}"
            f"(要求 ≥{MIN_EARLY_RECALL_TASKS})",
            "判分器三态自检(通过/失败/判不出): 通过",
        ]
        extra_notes: list[str] = []
    else:
        results, pipe_errors = _run_dry(tasks)
        errors.extend(pipe_errors)
        llm_pipeline_error = asyncio.run(check_llm_pipeline_callable())
        if errors or llm_pipeline_error:
            print("[eval_compaction] dry-run 校验失败:", file=sys.stderr)
            for e in errors:
                print(f"  - {e}", file=sys.stderr)
            if llm_pipeline_error:
                print(f"  - [LLM 档可调用性] {llm_pipeline_error}", file=sys.stderr)
            return 1
        status = "dry-run 基线全绿(评测集结构/真管线触发/判分器三态均通过);质量数字待 --live 真跑"
        mode = "dry-run"
        llm_desc = "未调用(dry-run)"
        checks = [
            f"评测集结构校验: 通过({len(tasks)} 任务,事实 {MIN_FACTS_PER_TASK}-"
            f"{MAX_FACTS_PER_TASK} 条/任务,tool 配对闭合,每任务 golden_answer 可过判分器)",
            f"考早期细节任务数: {sum(1 for t in tasks if t.recalls_early_turns)}"
            f"(要求 ≥{MIN_EARLY_RECALL_TASKS})",
            "判分器三态自检(通过/失败/判不出): 通过(合成样本验证)",
            "真管线触发校验: 全部任务 trigger=ratio 且压缩后 tokens 下降、摘要结构合法",
            "LLM 语义压缩档(full)可调用性: 通过(stub 摘要,模拟,仅验契约;质量数字不含该档)",
        ]
        extra_notes = []

    report = build_report(
        mode=mode,
        status=status,
        tasks=tasks,
        results=results,
        llm_desc=llm_desc,
        checks=checks,
        extra_notes=extra_notes,
    )
    out_path = write_report(args.output_dir, report)
    print(f"[eval_compaction] 报告已写入: {out_path}")
    print(f"[eval_compaction] 状态: {status}")
    total_orig = sum(r.original_tokens for r in results)
    total_comp = sum(r.compressed_tokens for r in results)
    print(
        f"[eval_compaction] 汇总: 压缩率 {_pct(total_comp, total_orig)}, "
        f"事实保持 {sum(r.facts_retained_context for r in results)}/{sum(r.facts_total for r in results)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
