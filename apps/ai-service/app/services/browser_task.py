# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器任务模板与检查点纯逻辑(2026-11-25 立)。

对齐 TRAE「画中画模式」里“任务模板 = 目标 + 运行要求 + 人工节点”那一层:

- 模板是**只读目录**(内置四套),不是执行面;
- 会话绑定任务后,检查点由自动化显式进入,或由导航 URL 的**整段路径**命中自动进入;
- 所有校验在这里做,`BrowserSession` 只消费归一后的快照,避免两份判据漂开。

刻意不做的事:
- 不接受正则/通配符做 match —— 用户输入不该变成执行面;
- 不持久化任务到磁盘 —— 任务生命周期跟浏览器会话,进程重启即失效,避免陈旧状态复活;
- 不做跨会话模板 CRUD —— 本轮先给内置目录 + 会话级绑定,减少一个可被滥用的写入面。
"""
from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlsplit

MAX_GOAL_CHARS = 160
MAX_REQUIREMENTS = 8
MAX_REQUIREMENT_CHARS = 80
MAX_CHECKPOINTS = 8
MAX_LABEL_CHARS = 40
MAX_LABEL_KEY_CHARS = 48
MAX_MATCH_CHARS = 24
MAX_TEMPLATE_ID_CHARS = 32

#: 检查点等待超过这个时长就标记 `timed_out`,但**绝不自动恢复**:
#: 人工确认不能因为等得久就被机器代签。超时只改变展示与审计信号,
#: 仍由人点「已处理,继续」或接管。
CHECKPOINT_WAIT_TIMEOUT_SECONDS = 15 * 60

#: 检查点 id / 模板 id 共用的安全字符集。只允许小写,避免大小写两套 id 指向同一项。
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")

CHECKPOINT_PENDING = "pending"
CHECKPOINT_ACTIVE = "active"
CHECKPOINT_DONE = "done"

TASK_ACTIVE = "active"
TASK_CLEARED = "cleared"


class TaskValidationError(ValueError):
    """具名校验错误:code 给前端/自动化分支,message 给人看。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value: object) -> datetime | None:
    """解析任务里的 ISO 时间;坏值返回 None,不让一条脏时间打断快照。"""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def _normalize_id(raw: object, *, field: str, code: str) -> str:
    value = str(raw or "").strip().lower()
    if not value:
        raise TaskValidationError(code, f"{field} 不能为空")
    if len(value) > MAX_TEMPLATE_ID_CHARS or not _ID_RE.match(value):
        raise TaskValidationError(
            code,
            f"{field} 只允许小写字母、数字、下划线和连字符(1-{MAX_TEMPLATE_ID_CHARS} 位)",
        )
    return value


def normalize_match(raw: object, *, field: str) -> str | None:
    """归一 URL 命中片段:只接受单个路径整段或单个 query 键名。

    刻意不做子串:文章能力里已经踩过 `/blog/how-to-login` 被 `login` 子串误判的坑。
    这里把 match 限制成“整段相等”,由 `checkpoint_matches_url` 按段比对。
    """
    value = str(raw or "").strip().lower()
    if not value:
        return None
    if len(value) > MAX_MATCH_CHARS:
        raise TaskValidationError(
            "checkpoint_match_invalid", f"{field} 最长 {MAX_MATCH_CHARS} 字符"
        )
    if "/" in value or "?" in value or "*" in value or "\\" in value:
        raise TaskValidationError(
            "checkpoint_match_invalid",
            f"{field} 只能是单个路径段或 query 键名,不接受斜杠/通配符/正则",
        )
    if not re.match(r"^[a-z0-9][a-z0-9._-]*$", value):
        raise TaskValidationError("checkpoint_match_invalid", f"{field} 含不允许的字符")
    return value


def _normalize_requirements(raw: object) -> list[str]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise TaskValidationError("task_invalid_requirements", "requirements 必须是数组")
    if len(raw) > MAX_REQUIREMENTS:
        raise TaskValidationError(
            "task_invalid_requirements", f"requirements 最多 {MAX_REQUIREMENTS} 条"
        )
    out: list[str] = []
    for index, item in enumerate(raw):
        text = str(item or "").strip()
        if not text:
            raise TaskValidationError(
                "task_invalid_requirements", f"requirements[{index}] 不能为空"
            )
        if len(text) > MAX_REQUIREMENT_CHARS:
            raise TaskValidationError(
                "task_invalid_requirements",
                f"requirements[{index}] 最长 {MAX_REQUIREMENT_CHARS} 字符",
            )
        out.append(text)
    return out


def _normalize_checkpoints(raw: object) -> list[dict[str, Any]]:
    if not isinstance(raw, list) or not raw:
        raise TaskValidationError("task_invalid_checkpoints", "checkpoints 必须是 1..N 的数组")
    if len(raw) > MAX_CHECKPOINTS:
        raise TaskValidationError(
            "task_invalid_checkpoints", f"checkpoints 最多 {MAX_CHECKPOINTS} 个"
        )
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            raise TaskValidationError(
                "task_invalid_checkpoints", f"checkpoints[{index}] 必须是对象"
            )
        cp_id = str(item.get("id") or "").strip().lower()
        if not cp_id:
            raise TaskValidationError(
                "task_invalid_checkpoints", f"checkpoints[{index}].id 不能为空"
            )
        if not re.match(r"^[a-z0-9][a-z0-9_-]{0,31}$", cp_id):
            raise TaskValidationError(
                "task_invalid_checkpoints", f"checkpoints[{index}].id 含非法字符"
            )
        if cp_id in seen:
            raise TaskValidationError(
                "task_invalid_checkpoints", f"checkpoints 里 id 重复: {cp_id}"
            )
        seen.add(cp_id)
        label = str(item.get("label") or "").strip()
        if not label:
            raise TaskValidationError(
                "task_invalid_checkpoints", f"checkpoints[{index}].label 不能为空"
            )
        if len(label) > MAX_LABEL_CHARS:
            raise TaskValidationError(
                "task_invalid_checkpoints",
                f"checkpoints[{index}].label 最长 {MAX_LABEL_CHARS} 字符",
            )
        # 2026-11-25:label_key 只给内置模板用,客户端据此本地化;自定义任务可省,
        # 省了就一直显示 label 原文,不因缺翻译而报错。
        label_key = str(item.get("label_key") or "").strip().lower()
        if label_key:
            if len(label_key) > MAX_LABEL_KEY_CHARS or not re.match(
                r"^[a-z0-9][a-z0-9._-]*$", label_key
            ):
                raise TaskValidationError(
                    "task_invalid_checkpoints",
                    f"checkpoints[{index}].label_key 含非法字符",
                )
        out.append(
            {
                "id": cp_id,
                "label": label,
                "label_key": label_key or None,
                "match": normalize_match(item.get("match"), field=f"checkpoints[{index}].match"),
                "status": CHECKPOINT_PENDING,
                "entered_at": None,
                "done_at": None,
            }
        )
    return out


def normalize_task(payload: object) -> dict[str, Any]:
    """把客户端/自动化载荷归一成会话内任务快照。

    错误一律抛 `TaskValidationError`;调用方转成 HTTP 400 / WS error,不吞成成功。
    """
    if not isinstance(payload, dict):
        raise TaskValidationError("task_invalid_payload", "task 必须是对象")
    goal = str(payload.get("goal") or "").strip()
    if not goal:
        raise TaskValidationError("task_invalid_goal", "goal 不能为空")
    if len(goal) > MAX_GOAL_CHARS:
        raise TaskValidationError(
            "task_invalid_goal", f"goal 最长 {MAX_GOAL_CHARS} 字符"
        )
    template_id = str(payload.get("template_id") or "").strip().lower()
    if template_id:
        template_id = _normalize_id(
            template_id, field="template_id", code="task_invalid_template_id"
        )
    task_id_raw = str(payload.get("task_id") or "").strip().lower()
    task_id = (
        _normalize_id(task_id_raw, field="task_id", code="task_invalid_id")
        if task_id_raw
        else f"task_{uuid.uuid4().hex[:10]}"
    )
    return {
        "task_id": task_id,
        "template_id": template_id or None,
        "goal": goal,
        "requirements": _normalize_requirements(payload.get("requirements")),
        "checkpoints": _normalize_checkpoints(payload.get("checkpoints")),
        "status": TASK_ACTIVE,
        "created_at": _now_iso(),
    }


def checkpoint_timed_out(
    checkpoint: dict[str, Any] | None,
    *,
    now: datetime | None = None,
    timeout_seconds: float = CHECKPOINT_WAIT_TIMEOUT_SECONDS,
) -> bool:
    """active 检查点是否已超过等待上限;从不改变状态。"""
    if not checkpoint or checkpoint.get("status") != CHECKPOINT_ACTIVE:
        return False
    entered = _parse_iso(checkpoint.get("entered_at"))
    if entered is None:
        return False
    current = now or datetime.now(UTC)
    return (current - entered).total_seconds() >= timeout_seconds


def checkpoint_wait_remaining(
    checkpoint: dict[str, Any] | None,
    *,
    now: datetime | None = None,
    timeout_seconds: float = CHECKPOINT_WAIT_TIMEOUT_SECONDS,
) -> float | None:
    """距超时还剩几秒;不是 active/没有进入时间就返回 None,已超时返回 0。"""
    if not checkpoint or checkpoint.get("status") != CHECKPOINT_ACTIVE:
        return None
    entered = _parse_iso(checkpoint.get("entered_at"))
    if entered is None:
        return None
    current = now or datetime.now(UTC)
    return max(0.0, timeout_seconds - (current - entered).total_seconds())


def checkpoint_snapshot(
    checkpoint: dict[str, Any],
    *,
    timeout_seconds: float = CHECKPOINT_WAIT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """单个检查点的对外快照;`timed_out` 是派生值,不写回会话状态。"""
    return {
        "id": checkpoint.get("id"),
        "label": checkpoint.get("label"),
        "label_key": checkpoint.get("label_key"),
        "match": checkpoint.get("match"),
        "status": checkpoint.get("status", CHECKPOINT_PENDING),
        "entered_at": checkpoint.get("entered_at"),
        "done_at": checkpoint.get("done_at"),
        "timed_out": checkpoint_timed_out(
            checkpoint, timeout_seconds=timeout_seconds
        ),
    }


def task_snapshot(task: dict[str, Any] | None) -> dict[str, Any] | None:
    """返回可 JSON 序列化的任务快照(深拷贝,不让调用方改到会话内状态)。"""
    if not task:
        return None
    return {
        "task_id": task.get("task_id"),
        "template_id": task.get("template_id"),
        "goal": task.get("goal"),
        "requirements": [str(item) for item in task.get("requirements") or []],
        "checkpoints": [
            checkpoint_snapshot(cp) for cp in task.get("checkpoints") or []
        ],
        "status": task.get("status", TASK_ACTIVE),
        "created_at": task.get("created_at"),
    }


def find_checkpoint(task: dict[str, Any] | None, checkpoint_id: str) -> dict[str, Any] | None:
    if not task:
        return None
    target = str(checkpoint_id or "").strip().lower()
    for cp in task.get("checkpoints") or []:
        if cp.get("id") == target:
            return cp
    return None


def active_checkpoint(task: dict[str, Any] | None) -> dict[str, Any] | None:
    if not task:
        return None
    for cp in task.get("checkpoints") or []:
        if cp.get("status") == CHECKPOINT_ACTIVE:
            return cp
    return None


def mark_checkpoint_active(task: dict[str, Any], checkpoint_id: str) -> dict[str, Any]:
    """把某项置为 active;保持“同一时刻只有一个 active”的不变量。"""
    cp = find_checkpoint(task, checkpoint_id)
    if cp is None:
        raise TaskValidationError("checkpoint_not_found", f"检查点不存在: {checkpoint_id}")
    if cp.get("status") == CHECKPOINT_DONE:
        raise TaskValidationError("checkpoint_already_done", f"检查点已完成: {checkpoint_id}")
    for other in task.get("checkpoints") or []:
        if other.get("status") == CHECKPOINT_ACTIVE and other.get("id") != cp.get("id"):
            other["status"] = CHECKPOINT_PENDING
            other["entered_at"] = None
    cp["status"] = CHECKPOINT_ACTIVE
    cp["entered_at"] = _now_iso()
    return cp


def mark_checkpoint_done(task: dict[str, Any], checkpoint_id: str) -> dict[str, Any]:
    cp = find_checkpoint(task, checkpoint_id)
    if cp is None:
        raise TaskValidationError("checkpoint_not_found", f"检查点不存在: {checkpoint_id}")
    if cp.get("status") == CHECKPOINT_DONE:
        return cp  # 幂等:重复恢复不报错、不重写时间
    cp["status"] = CHECKPOINT_DONE
    cp["done_at"] = _now_iso()
    return cp


def checkpoint_matches_url(match: str | None, url: str | None) -> bool:
    """match 是否命中该 URL:路径整段相等,或 query 键名相等。不做子串。"""
    if not match or not url:
        return False
    try:
        parsed = urlsplit(url)
    except ValueError:
        return False
    segments = [seg.lower() for seg in parsed.path.split("/") if seg]
    if match in segments:
        return True
    return match in {key.lower() for key in parse_qs(parsed.query, keep_blank_values=True)}


def first_unfinished_match(task: dict[str, Any] | None, url: str | None) -> dict[str, Any] | None:
    """按任务顺序找第一个“未完成且 match 命中”的检查点。"""
    if not task or not url:
        return None
    for cp in task.get("checkpoints") or []:
        if cp.get("status") == CHECKPOINT_DONE:
            continue
        if checkpoint_matches_url(cp.get("match"), url):
            return cp
    return None


def task_progress(task: dict[str, Any] | None) -> dict[str, int]:
    checkpoints = list((task or {}).get("checkpoints") or [])
    done = sum(1 for cp in checkpoints if cp.get("status") == CHECKPOINT_DONE)
    return {"done": done, "total": len(checkpoints)}


def _template(
    template_id: str,
    goal: str,
    requirements: list[str],
    checkpoints: list[tuple[str, str, str | None] | tuple[str, str, str | None, str]],
) -> dict[str, Any]:
    def _one(cp: tuple) -> dict[str, Any]:
        cp_id, label, match = cp[0], cp[1], cp[2]
        out: dict[str, Any] = {"id": cp_id, "label": label, "match": match}
        if len(cp) > 3 and cp[3]:
            out["label_key"] = cp[3]
        return out

    return {
        "id": template_id,
        "goal": goal,
        "requirements": requirements,
        "checkpoints": [_one(cp) for cp in checkpoints],
    }


#: 内置四套模板。match 只给高置信的单个路径段/query 键,宁可少触发也不误报。
BUILTIN_TASK_TEMPLATES: list[dict[str, Any]] = [
    _template(
        "login-handoff",
        "完成登录或验证,再回到目标任务继续。",
        [
            "只在登录、验证码或二次验证页面停下来等人",
            "不代替用户输入账号密码",
            "登录成功后确认页面已离开验证墙",
        ],
        [
            ("login", "登录页已出现", "login", "ck_login_handoff_login"),
            ("verify", "验证码已提交", "verify", "ck_login_handoff_verify"),
            ("back", "已回到目标任务", None, "ck_login_handoff_back"),
        ],
    ),
    _template(
        "form-commit",
        "把表单填写完整,提交前停下来等人确认。",
        [
            "提交按钮只在人工确认后点击",
            "提交前核对必填项与附件",
            "提交后确认成功回执,不留半提交状态",
        ],
        [
            ("confirm", "提交前确认", "confirm", "ck_form_commit_confirm"),
            ("receipt", "提交结果确认", None, "ck_form_commit_receipt"),
        ],
    ),
    _template(
        "payment-confirm",
        "走到结算页,付款前必须由人确认金额与收款方。",
        [
            "金额、币种、收款方逐项核对",
            "付款动作必须人工确认后执行",
            "完成后保留订单号或支付回执",
        ],
        [
            ("checkout", "已进入结算页", "checkout", "ck_payment_confirm_checkout"),
            ("pay", "付款前确认", "pay", "ck_payment_confirm_pay"),
            ("done", "支付结果确认", None, "ck_payment_confirm_done"),
        ],
    ),
    _template(
        "download-export",
        "触发导出或下载,并确认产物真的落到本地。",
        [
            "导出前确认范围与格式",
            "下载完成后核对文件名与大小",
            "失败时保留错误信息,不谎报成功",
        ],
        [
            ("export", "已触发生成/导出", "export", "ck_download_export_export"),
            ("download", "下载已开始", "download", "ck_download_export_download"),
            ("done", "产物核对完成", None, "ck_download_export_done"),
        ],
    ),
]


def list_task_templates() -> list[dict[str, Any]]:
    """内置模板目录(只读,深拷贝)。"""
    return [
        {
            "id": item["id"],
            "goal": item["goal"],
            "requirements": list(item["requirements"]),
            "checkpoints": [dict(cp) for cp in item["checkpoints"]],
        }
        for item in BUILTIN_TASK_TEMPLATES
    ]


def task_from_template(template_id: str, *, goal_override: str | None = None) -> dict[str, Any]:
    """按模板生成可交给 `normalize_task` 的载荷(不直接落会话)。"""
    wanted = str(template_id or "").strip().lower()
    for item in BUILTIN_TASK_TEMPLATES:
        if item["id"] == wanted:
            payload = {
                "template_id": item["id"],
                "goal": goal_override or item["goal"],
                "requirements": list(item["requirements"]),
                "checkpoints": [dict(cp) for cp in item["checkpoints"]],
            }
            return normalize_task(payload)
    raise TaskValidationError("template_not_found", f"模板不存在: {template_id}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
