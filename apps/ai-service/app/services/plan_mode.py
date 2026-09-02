# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Plan Mode(计划模式)服务层。

对标 Claude Code Plan Mode:复杂任务先在"只读工具"阶段产出可编辑计划文档,
用户确认(可改)后才进入执行。本模块提供:
- READONLY_TOOLS:只读工具白名单(计划阶段只允许这些工具)
- PlanStore:进程内计划存储(带 TTL,默认 2 小时)
- create_draft:用 LLM 生成结构化 markdown 计划(stub 模式返回合法占位计划)

设计要点:
- 计划阶段只许"看"、不许"改"。READONLY_TOOLS 只包含读/查询/分析类工具,
  写文件、执行命令、数据库写、子 agent 派发、电脑控制、排程等一律排除。
- 状态机: draft ->(批准) executing -> done|failed ; draft ->(拒绝) rejected。
  非法迁移(如对 rejected/done 再次 decision)抛 ValueError,由路由层转 409。
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from ..core.llm_gateway import llm_gateway

# ---------------------------------------------------------------------------
# 只读工具白名单
# ---------------------------------------------------------------------------

# 计划阶段允许使用的工具:只读 / 查询 / 分析 / 观察类。
# 划类决策(docstring 记录):
#   纳入(只读):
#     - 文件读: read_file / list_files / file_search —— 仅读取,不改写
#     - 代码分析: search_codebase / analyze_code —— 检索与静态分析,纯读
#     - 网络检索: search_web / web_search / fetch_url —— 只读获取外部信息
#     - 知识/记忆: knowledge_lookup / current_memory / available_skills —— 查询,不改写
#     - 文档/产物: parse_document / generate_chart / summarize_artifacts —— 解析与
#       生成可视化产物,不改用户工程文件(generate_chart 产出图表数据而非写仓库文件)
#     - 视觉/截图: screenshot_url / vision_analyze —— 远程 URL 截图与视觉分析,只读
#     - 浏览器观察类(我判定为只读): browser_screenshot / browser_scroll /
#       browser_extract_dom / browser_navigate / browser_wait_for_element /
#       browser_get_attribute / browser_hover / browser_select_option /
#       browser_switch_tab / browser_close_tab —— 仅观察/浏览网页,不改变用户本地
#       代码库与系统状态。
#   排除(写/执行/交互可变,绝对不进计划阶段):
#     - 文件写: write_file / file_edit(=改名后的 write_file 同源)—— 改写仓库
#     - 测试生成: generate_test —— 向仓库写入测试文件,属写操作
#     - 命令/进程: run_command —— 执行任意 shell,可改系统状态
#     - 版本/库: git_operations —— 含 commit/push/rm,改写仓库与远端
#     - 数据库: db_query —— 含写操作(UPDATE/DELETE/INSERT),改写数据
#     - 子 agent: dispatch_subagent —— 派发执行,超出"只读计划"语义
#     - 排程: schedule_task —— 创建后台任务,改变系统状态
#     - 电脑控制前缀 computer_* 系列 —— 键鼠/剪贴板/截屏控制,改写本地状态
#     - 浏览器交互可变: browser_click_element / browser_type_text —— 向远端页面
#       注入点击/输入,产生副作用(与 agent_loop_v2 高危工具清单一致,故排除)
READONLY_TOOLS: frozenset[str] = frozenset(
    {
        # 文件读
        "read_file",
        "list_files",
        "file_search",
        # 代码分析
        "search_codebase",
        "analyze_code",
        # 网络检索
        "search_web",
        "web_search",
        "fetch_url",
        # 知识/记忆
        "knowledge_lookup",
        "current_memory",
        "available_skills",
        # 压缩回捞(只读:语义检索被压缩丢弃的旧消息,不改写任何状态)
        "context_recall",
        # 文档/产物
        "parse_document",
        "generate_chart",
        "summarize_artifacts",
        # 视觉/截图
        "screenshot_url",
        "vision_analyze",
        # 浏览器观察类(只读)
        "browser_screenshot",
        "browser_scroll",
        "browser_extract_dom",
        "browser_navigate",
        "browser_wait_for_element",
        "browser_get_attribute",
        "browser_hover",
        "browser_select_option",
        "browser_switch_tab",
        "browser_close_tab",
    }
)

# 非只读工具(仅作文档/对照,运行时不用;列在这里便于后续审计与扩展)
_WRITE_OR_EXEC_TOOLS: frozenset[str] = frozenset(
    {
        "write_file",
        "file_edit",
        "generate_test",
        "run_command",
        "git_operations",
        "db_query",
        "dispatch_subagent",
        "schedule_task",
        "browser_click_element",
        "browser_type_text",
    }
)


def is_readonly_tool(name: str) -> bool:
    """判断工具名是否属于计划阶段只读白名单。"""
    return name in READONLY_TOOLS


# ---------------------------------------------------------------------------
# 计划记录与状态机
# ---------------------------------------------------------------------------

# 合法状态集合
PLAN_STATUSES: frozenset[str] = frozenset(
    {"draft", "approved", "rejected", "executing", "done", "failed"}
)

# 合法状态迁移表(键=当前状态,值=允许迁移到的目标状态集合)
_PLAN_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"executing", "rejected"}),
    "approved": frozenset({"executing", "done", "failed"}),
    "rejected": frozenset(),
    "executing": frozenset({"done", "failed"}),
    "done": frozenset(),
    "failed": frozenset(),
}


def validate_transition(current: str, target: str) -> None:
    """校验计划状态迁移是否合法。

    Args:
        current: 当前状态
        target: 目标状态

    Raises:
        ValueError: 当 current/target 非法或迁移不在白名单内
    """
    if current not in PLAN_STATUSES:
        raise ValueError(f"非法计划状态: {current}")
    if target not in PLAN_STATUSES:
        raise ValueError(f"非法计划状态: {target}")
    allowed = _PLAN_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise ValueError(f"非法状态迁移: {current} -> {target}")


@dataclass
class PlanRecord:
    """计划记录(进程内,带 TTL)。"""

    plan_id: str
    goal: str
    plan_md: str
    readonly_tools: frozenset[str]
    session_id: Optional[str]
    status: str  # draft|approved|rejected|executing|done|failed
    created_at: str  # ISO8601
    result: Optional[dict[str, Any]] = None
    updated_at: Optional[str] = None


class PlanStore:
    """进程内计划存储(字典 + TTL 过期清理)。"""

    def __init__(self, ttl_seconds: int = 7200) -> None:
        """初始化存储。

        Args:
            ttl_seconds: 计划记录存活时长(秒),默认 2 小时
        """
        self._store: dict[str, PlanRecord] = {}
        self._created_at: dict[str, float] = {}
        self._ttl = float(ttl_seconds)

    def save(self, record: PlanRecord) -> None:
        """保存/更新计划记录,刷新创建时间为当前(用于 TTL 计算)。"""
        self._store[record.plan_id] = record
        self._created_at[record.plan_id] = time.time()
        self._cleanup()

    def get(self, plan_id: str) -> PlanRecord:
        """按 plan_id 获取计划记录。

        Raises:
            KeyError: 记录不存在或已过期
        """
        self._cleanup()
        rec = self._store.get(plan_id)
        if rec is None:
            raise KeyError(plan_id)
        return rec

    def _cleanup(self) -> None:
        """清理过期记录(TTL 到期则从内存移除)。"""
        if not self._created_at:
            return
        now = time.time()
        expired = [
            pid for pid, ts in self._created_at.items() if now - ts > self._ttl
        ]
        for pid in expired:
            self._store.pop(pid, None)
            self._created_at.pop(pid, None)

    def __len__(self) -> int:
        self._cleanup()
        return len(self._store)


# 进程内单例(测试可整体清空隔离)
plan_store = PlanStore()


# ---------------------------------------------------------------------------
# 计划草稿生成
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "你是一个资深软件架构师与计划助手。用户会给你一个目标,你需要产出一份"
    "结构化的执行计划文档(markdown),仅供后续人工确认。计划阶段严禁调用任何"
    "写/执行类工具——你只需基于已有知识产出计划。\n"
    "计划文档必须严格包含以下四个二级标题章节:\n"
    "## 目标\n"
    "## 步骤(使用编号列表,每步注明使用哪个只读工具,例如 `read_file` / "
    "`search_codebase`)\n"
    "## 验收标准\n"
    "## 风险与回滚\n"
    "只输出 markdown 计划本身,不要输出额外解释。"
)


def _placeholder_plan(goal: str) -> str:
    """生成合法占位计划(stub 模式 / LLM 无内容时兜底)。"""
    return (
        "## 目标\n"
        f"{goal}\n\n"
        "## 步骤\n"
        "1. 使用 `list_files` / `read_file` 了解项目结构\n"
        "2. 使用 `search_codebase` 检索与目标相关的代码\n"
        "3. 使用 `analyze_code` 分析关键实现细节\n"
        "4. 汇总发现并形成结论\n\n"
        "## 验收标准\n"
        "- 已通过只读工具充分探查目标相关代码与资源\n"
        "- 产出明确、可执行的后续执行计划\n\n"
        "## 风险与回滚\n"
        "- 计划阶段仅使用只读工具,不修改任何文件与系统状态,无回滚需求\n"
        "- 若后续进入执行阶段,需在用户确认范围内进行\n"
    )


async def create_draft(
    goal: str,
    session_id: Optional[str] = None,
    model: Optional[str] = None,
) -> PlanRecord:
    """创建计划草稿(只读阶段,不执行任何工具)。

    用 llm_gateway.complete 生成结构化 markdown 计划;stub 模式(无 API key)
    返回合法占位计划,保证无 key 可测。

    Args:
        goal: 用户目标/任务描述
        session_id: 关联会话 id(可选)
        model: 指定模型(可选)

    Returns:
        PlanRecord: 刚创建的草稿(状态 draft)
    """
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"请为以下目标制定计划:\n{goal}"},
    ]
    result = await llm_gateway.complete(messages, model=model)
    if result.get("stub"):
        plan_md = _placeholder_plan(goal)
    else:
        plan_md = (result.get("content") or "").strip() or _placeholder_plan(goal)

    record = PlanRecord(
        plan_id=uuid.uuid4().hex,
        goal=goal,
        plan_md=plan_md,
        readonly_tools=READONLY_TOOLS,
        session_id=session_id,
        status="draft",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    plan_store.save(record)
    return record
