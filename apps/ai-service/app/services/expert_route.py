# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D09 意图自动路由专家包 —— 发送前轻量意图分类(规则优先,零 LLM)。

票面三格对应关系:
① 发送前轻量意图分类:``classify_intent`` + ``plan_route``(纯函数,无 IO、无 await)。
② 命中专家包时并入工具白名单/系统提示 + 流首交代帧:``merge_tools`` / ``system_hint`` /
   ``frame_payload`` 三个出口,接线在 ``routers/llm.py``(复用 ``injection_applied`` 帧,
   kind=``expert_pack``,不新造帧)。
③ 用户可关:``resolve_mode`` —— 请求字段 ``expert_auto_route`` 三档,部署方可置
   env ``IHUI_EXPERT_AUTO_ROUTE=off`` 硬关。**默认 hint = 只交代分类结果,不改工具、
   不改提示词**(票面"默认温和提示不强切");``auto`` 才真并入。

本切片刻意不做的部分(不得读成已交付):
- **模型兜底未实现**:规则未命中时多半本就"不该路由",再调一次上游只会把首字延迟和
  误路由一起放大;要做须另立票并先量出规则召回缺口。
- 不新增数据实体:专家包是**运行时常量表**。apps/web 生态页的 ``EXPERT_PACKS`` 是纯导航
  聚合(content-creator/developer-extension,不含工具面),两者**暂不同源**;与 D01 数据面
  统一属后续串行工作,本切片刻意不触碰 D01 的 persona 文件,避免同文件冲突。

边界:本切片不读写 D01(persona)数据面;``merge_tools`` 是**并集**、不替换调用方给的
``agent_tools``,且接线在 chat_mode 过滤之前 —— plan/review 档照旧只留只读工具。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from .agent_events import SSE_INJECTION_APPLIED

logger = logging.getLogger(__name__)

#: 合法的路由档位(封闭集)。非法值回落默认档并留日志,不静默按 auto 处理。
MODES: tuple[str, ...] = ("off", "hint", "auto")
DEFAULT_MODE = "hint"
ENV_KEY = "IHUI_EXPERT_AUTO_ROUTE"


@dataclass(frozen=True)
class ExpertPack:
    """一个专家包:触发词面 + 工具白名单 + 系统提示。

    工具名必须是 ``mcp_server`` 已注册的名字(接线处按名字查 schema,查不到即跳过),
    所以这里写错一个名字只会"少给工具",不会造出空 schema。
    """

    slug: str
    title: str
    terms: tuple[str, ...]
    tools: tuple[str, ...]
    hint: str


#: 运行时常量表。匹配用**小写字面量包含**,不是正则 —— 反向锁要求"命中词可原样报出",
#: 正则会把"为什么命中"藏进表达式里。英文词条一律小写(判定前 text 已 lower)。
EXPERT_PACKS: tuple[ExpertPack, ...] = (
    ExpertPack(
        slug="code-review",
        title="代码审查",
        terms=(
            "代码审查",
            "审查代码",
            "帮我审",
            "审查这个",
            "review 代码",
            "review一下",
            "review 一下",
            "code review",
        ),
        tools=("read_file", "list_files", "search_codebase", "analyze_code", "review_pr"),
        hint=(
            "## Expert pack active: code-review\n"
            "The user's request is a code review. Read the code before commenting; cite every "
            "finding as path:line with the concrete risk and a one-line fix. Separate blocking "
            "issues from suggestions. Prefer read-only tools and do not rewrite files unless "
            "the user explicitly asks for a fix."
        ),
    ),
    ExpertPack(
        slug="debug-fix",
        title="调试修复",
        terms=(
            "报错",
            "异常",
            "堆栈",
            "traceback",
            "崩溃",
            "调试",
            "bug",
            "跑不起来",
            "不生效",
        ),
        tools=("read_file", "search_codebase", "run_command", "file_edit", "write_file",
               "generate_test"),
        hint=(
            "## Expert pack active: debug-fix\n"
            "The user is debugging a failure. Establish the failing fact first (error text / "
            "stack / reproduction), then locate the root cause before proposing a fix. Do not "
            "claim a fix without a way to verify it (test or command output)."
        ),
    ),
    ExpertPack(
        slug="docs-report",
        title="文档与报表",
        terms=(
            "写文档",
            "技术文档",
            "生成报告",
            "做一份报告",
            "调研报告",
            "导出报告",
            "整理成文档",
            "周报",
            "月报",
            "readme",
        ),
        tools=("read_file", "search_codebase", "parse_document", "document_tables",
               "generate_chart", "generate_report"),
        hint=(
            "## Expert pack active: docs-report\n"
            "The user wants a document or report. Gather facts from the sources first, then "
            "produce a structured document (summary, sections, evidence). Do not invent numbers "
            "or citations that are not present in the gathered material."
        ),
    ),
)


@dataclass(frozen=True)
class ExpertRoute:
    """一次路由判定的结果(可观测对象;也被帧载荷直接消费)。"""

    mode: str
    pack: ExpertPack | None = None
    matched: tuple[str, ...] = ()

    @property
    def hit(self) -> bool:
        return self.pack is not None


def resolve_mode(requested: str | None) -> str:
    """三档解析唯一出口:env 硬关 > 请求字段 > env 档位 > 默认 hint。

    env ``off`` 是部署方硬开关,优先级高于请求字段(与 ``IHUI_AUTO_CONTEXT_DISABLE``
    的"部署级硬关"同语义)。请求字段写错值时**留日志并回落**,不静默当成 auto。
    """
    env_mode = os.environ.get(ENV_KEY, "").strip().lower()
    if env_mode == "off":
        return "off"
    if requested is not None and str(requested).strip():
        wanted = str(requested).strip().lower()
        if wanted in MODES:
            return wanted
        logger.warning("[expert-route] expert_auto_route=%r 非法,回落默认档", requested)
    if env_mode in MODES:
        return env_mode
    return DEFAULT_MODE


def classify_intent(text: str) -> tuple[ExpertPack | None, tuple[str, ...]]:
    """规则分类:返回 (命中的包, 原样命中的词面)。

    多包同时命中时按**命中词条数**取最高;同分按注册表顺序取先者(确定性,不掷骰子)。
    空文本/纯空白直接不命中(不把"没说话"路由成某个专家)。
    """
    lowered = (text or "").lower()
    if not lowered.strip():
        return None, ()
    best_pack: ExpertPack | None = None
    best_hits: tuple[str, ...] = ()
    for pack in EXPERT_PACKS:
        hits = tuple(term for term in pack.terms if term in lowered)
        if len(hits) > len(best_hits):
            best_pack, best_hits = pack, hits
    return best_pack, best_hits


def plan_route(text: str, requested_mode: str | None = None) -> ExpertRoute:
    """发送前唯一入口:解析档位 → (off 则完全不分类) → 规则分类。"""
    mode = resolve_mode(requested_mode)
    if mode == "off":
        return ExpertRoute(mode=mode)
    pack, matched = classify_intent(text)
    return ExpertRoute(mode=mode, pack=pack, matched=matched)


def merge_tools(route: ExpertRoute, agent_tools: list[str] | None) -> list[str] | None:
    """auto 档命中包时把包内工具**并集**进本次清单;其余情况原样返回。

    - 并集而非替换:调用方显式给的清单是用户的意图,不能被路由改写成另一张表。
    - 保持原顺序、去重:包内工具排在调用方清单之后。
    - ``agent_tools is None`` 且 auto 命中 ⇒ 由包开出一份清单(这是"按需加载"的本义);
      hint/off 档永不走到这里。
    """
    if route.mode != "auto" or route.pack is None:
        return agent_tools
    merged = list(agent_tools or [])
    merged.extend(tool for tool in route.pack.tools if tool not in merged)
    return merged


def system_hint(route: ExpertRoute) -> str | None:
    """auto 档命中包时的系统提示;**hint 档不改提示词**(温和提示只交代给用户)。"""
    if route.mode != "auto" or route.pack is None:
        return None
    return route.pack.hint


def frame_payload(route: ExpertRoute) -> dict[str, Any] | None:
    """``injection_applied`` 帧载荷(复用既有帧,不新帧);未命中/off 档返回 None。

    kind 是前端取词表键的**唯一**依据(``packages/shared/src/constants/injection-kinds.ts``
    已登记 ``expert_pack``);``collapsed`` 只作未知 kind 的兜底文本。``fullText`` 交代
    "为什么命中"与当前档位是否真改了工具/提示词 —— 用户能展开核对,而不是只看到一句结论。
    """
    if route.mode == "off" or route.pack is None:
        return None
    if route.mode == "auto":
        effect = "已并入该专家包的工具白名单(与本次请求的工具清单取并集),并追加系统提示。"
    else:
        effect = "当前为温和提示:未改动工具清单与系统提示。"
    hits = "、".join(route.matched)
    return {
        "type": SSE_INJECTION_APPLIED,
        "kind": "expert_pack",
        "collapsed": f"已按意图匹配专家包:{route.pack.title}",
        "fullText": (
            f"命中词:{hits} ⇒ 专家包「{route.pack.title}」({route.pack.slug})。{effect}"
        ),
    }
