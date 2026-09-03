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
- 状态机(审批门控闭环): draft|pending_approval ->(批准) executing -> done|failed;
  pending_approval ->(拒绝) rejected;pending_approval ->(改签) pending_approval(新版本)。
  每次细化作新版(version bump + reason),可审计"最终执行的是哪个版本、为何"。
  非法迁移(如对 rejected/done 再次 decision)抛 ValueError,由路由层转 409。
"""

from __future__ import annotations

import difflib
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

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

# 合法状态集合(含审批门控 pending_approval;draft 为旧别名,兼容既有迁移)
PLAN_STATUSES: frozenset[str] = frozenset(
    {"draft", "pending_approval", "approved", "rejected", "executing", "done", "failed"}
)

# 合法状态迁移表(键=当前状态,值=允许迁移到的目标状态集合)
# 审批门控闭环:
#   draft/pending_approval -> executing(批准即执行,兼容既有单步行为)
#   draft/pending_approval -> approved(仅批准门,不立即执行,待后续 executing 启动)
#   pending_approval -> rejected(拒绝)
#   pending_approval -> pending_approval(改签:细化新版本后重新回到待审批)
#   rejected -> pending_approval(拒绝后可基于新版本重提)
#   approved -> executing(启动执行)/ rejected(事后否决)/ pending_approval(撤回修改)
_PLAN_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"pending_approval", "approved", "executing", "rejected"}),
    "pending_approval": frozenset({"approved", "rejected", "executing", "pending_approval"}),
    "approved": frozenset({"executing", "rejected", "pending_approval"}),
    "rejected": frozenset({"pending_approval"}),
    "executing": frozenset({"done", "failed", "rejected"}),
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
    """计划记录(进程内,带 TTL)。

    版本与任务追踪字段:
    - version / version_history:每次细化(批准时改签 / 拒绝改稿 / revise)会 version bump
      + 记录 reason,历史可追溯 "最终执行的是哪个版本、为何"。
    - tasks:把获批计划展开为可勾选 task 序列(pending/done/blocked),供前端展示进度。
    """

    plan_id: str
    goal: str
    plan_md: str
    readonly_tools: frozenset[str]
    session_id: str | None
    status: str  # draft|pending_approval|approved|rejected|executing|done|failed
    created_at: str  # ISO8601
    result: dict[str, Any] | None = None
    updated_at: str | None = None
    version: int = 1
    # 每个条目: {version, reason, channel, plan_md, created_at}(含当前版本,末项即最新)
    version_history: list[dict[str, Any]] = field(default_factory=list)
    tasks: list[dict[str, Any]] = field(default_factory=list)


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
        expired = [pid for pid, ts in self._created_at.items() if now - ts > self._ttl]
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
    session_id: str | None = None,
    model: str | None = None,
) -> PlanRecord:
    """创建计划草稿(只读阶段,不执行任何工具)。

    用 llm_gateway.complete 生成结构化 markdown 计划;stub 模式(无 API key)
    返回合法占位计划,保证无 key 可测。

    Args:
        goal: 用户目标/任务描述
        session_id: 关联会话 id(可选)
        model: 指定模型(可选)

    Returns:
        PlanRecord: 刚创建的草稿(状态 pending_approval,暂停待审批)
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

    created_at = datetime.now(UTC).isoformat()
    record = PlanRecord(
        plan_id=uuid.uuid4().hex,
        goal=goal,
        plan_md=plan_md,
        readonly_tools=READONLY_TOOLS,
        session_id=session_id,
        status="pending_approval",
        created_at=created_at,
        version=1,
        version_history=[
            {
                "version": 1,
                "reason": "initial",
                "channel": "llm",
                "plan_md": plan_md,
                "created_at": created_at,
            }
        ],
    )
    plan_store.save(record)
    return record


# ---------------------------------------------------------------------------
# 版本变更与可追溯(每次细化 -> 新版 version bump + reason)
# ---------------------------------------------------------------------------

_RULES_STEP_RE = re.compile(r"^\s*(\d+)[.、]\s*(.*)$")


def refine_plan(
    rec: PlanRecord,
    updated_plan_md: str | None,
    reason: str,
    channel: str = "user",
) -> PlanRecord:
    """细化计划:version bump + reason 记录到版本历史。

    若 updated_plan_md 为空或与当前内容一致,则仅记录 reason(不产生新内容版本);
    否则追加新版到 version_history 并把 rec.plan_md/version 推进到最新。

    Returns:
        原 rec(就地修改,便于链式调用)。
    """
    now = datetime.now(UTC).isoformat()
    new_md = (updated_plan_md or "").strip()
    if new_md and new_md != rec.plan_md.strip():
        rec.version += 1
        rec.plan_md = new_md
        rec.version_history.append(
            {
                "version": rec.version,
                "reason": reason,
                "channel": channel,
                "plan_md": new_md,
                "created_at": now,
            }
        )
    elif reason:
        # 无内容变更但给了 reason:补充最近一版的可追溯说明
        if rec.version_history:
            rec.version_history[-1]["reason"] = f"{rec.version_history[-1]['reason']} / {reason}"
    rec.updated_at = now
    return rec


def list_versions(rec: PlanRecord, include_plan_md: bool = True) -> list[dict[str, Any]]:
    """返回版本历史(含当前版本,按 version 升序)。

    Args:
        rec: 计划记录
        include_plan_md: 是否携带 plan_md(列表默认不带,避免大文本)

    Returns:
        [{version, reason, channel, created_at, plan_md?}, ...]
    """
    out: list[dict[str, Any]] = []
    for entry in rec.version_history:
        item: dict[str, Any] = {
            "version": entry["version"],
            "reason": entry["reason"],
            "channel": entry["channel"],
            "created_at": entry["created_at"],
        }
        if include_plan_md:
            item["plan_md"] = entry["plan_md"]
        out.append(item)
    return out


def _versions_index(rec: PlanRecord) -> dict[int, dict[str, Any]]:
    return {e["version"]: e for e in rec.version_history}


def diff_versions(rec: PlanRecord, from_version: int, to_version: int) -> str:
    """对两个历史版本做轻量行级 unified diff(用于审计最终执行的是哪个版本)。

    Raises:
        ValueError: 版本号不在历史中,或 from/to 相当。
    """
    index = _versions_index(rec)
    if from_version not in index:
        raise ValueError(f"版本不存在: v{from_version}(可用: {sorted(index)})")
    if to_version not in index:
        raise ValueError(f"版本不存在: v{to_version}(可用: {sorted(index)})")
    if from_version == to_version:
        return ""
    old = index[from_version]["plan_md"].splitlines()
    new = index[to_version]["plan_md"].splitlines()
    diff = difflib.unified_diff(
        old, new, fromfile=f"v{from_version}", tofile=f"v{to_version}", lineterm=""
    )
    return "\n".join(diff)


# ---------------------------------------------------------------------------
# 任务化执行(plan tasks):把获批计划展开为可勾选 task 序列
# ---------------------------------------------------------------------------

TASK_STATUSES: frozenset[str] = frozenset({"pending", "done", "blocked"})


def derive_tasks(plan_md: str) -> list[dict[str, Any]]:
    """从计划 markdown 的 `## 步骤` 编号列表展开为 task 序列。

    返回 [{task_id, order, title, status}] ;status 默认 pending。
    """
    tasks: list[dict[str, Any]] = []
    lines = plan_md.splitlines()
    in_steps = False
    order = 0
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("## 步骤"):
            in_steps = True
            continue
        if stripped.startswith("## "):
            in_steps = False
            continue
        if not in_steps:
            continue
        m = _RULES_STEP_RE.match(stripped)
        if m is None:
            continue
        order += 1
        tasks.append(
            {
                "task_id": f"task-{order}",
                "order": order,
                "title": m.group(2).strip(),
                "status": "pending",
            }
        )
    return tasks


def sync_tasks(rec: PlanRecord) -> list[dict[str, Any]]:
    """按当前计划内容重新派生 task 序列,保留同名任务的已有勾选状态。"""
    current = {t["task_id"]: t.get("status", "pending") for t in rec.tasks}
    new_tasks = derive_tasks(rec.plan_md)
    for task in new_tasks:
        old = current.get(task["task_id"])
        if old in TASK_STATUSES:
            task["status"] = old
    rec.tasks = new_tasks
    return rec.tasks


def update_task_status(rec: PlanRecord, task_id: str, status: str) -> bool:
    """更新单个 task 状态(done/pending/blocked)。

    Returns:
        True 更新成功;False task 不存在或状态非法。
    """
    if status not in TASK_STATUSES:
        return False
    for task in rec.tasks:
        if task.get("task_id") == task_id:
            task["status"] = status
            rec.updated_at = datetime.now(UTC).isoformat()
            return True
    return False
