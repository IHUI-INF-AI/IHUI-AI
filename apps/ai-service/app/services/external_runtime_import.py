# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部运行时导入器 —— 对齐 Qoder「导入数据」4 维命名空间(2026-10-31 立)。

对标(goal-b40 Qoder 0.5.1 本机取证,附录见 E 盘报告):Qoder 设置→导入数据
支持 6 枚来源(source_product 含 workbuddy)× 4 维命名空间
(sessions / automations / capabilities / memory),导的是**运行时全量**而非
聊天记录。

本仓对位物(每维一条真出口,不造第二份写入判据,§0.6):
- memory 维       → agent_longterm_memory.bulk_import_from_extract(现成出口,
                    自带去重合并 added/merged/skipped 计数)
- automations 维  → task_scheduler.add_task(cron/date/interval 三态触发器,
                    APScheduler 3.x 原生参数);幂等键 = 确定性 task_id
                    (`ext-<source>-<sha1(name|trigger)[:12]>`),重复导入同一
                    bundle 时 get_task 命中即跳过,不重复建任务
- capabilities 维 → 声明式登记:只校验形状并回显清单,**不静默注册** ——
                    本仓能力注册面(MCP 工具表/能力矩阵)有自己的准入纪律,
                    导入只产生"声明",准入归既有裁决链
- sessions 维     → 显式让位:会话搬家归属 relay 会话腿(scripts/relay-*,
                    多会话共写面,§12),本模块只校验形状并报数,绝不代写

bundle 形态(spec v1):
{
  "specVersion": 1,
  "source": "qoder|trae|workbuddy|...",          # 来源标识(自由文本,进幂等键)
  "namespaces": {
    "memory":       {"items": [{"content": str, "type"?, "keywords"?, "tags"?, "importance"?}]},
    "automations":  {"items": [{"name": str, "triggerType": "cron|date|interval",
                                "triggerConfig": {...}, "callback": {...含 type}}]},
    "capabilities": {"items": [{"id": str, "kind": str, "note"?}]},
    "sessions":     {"items": [...]}              # 只校验 + 报数
  }
}

三态诚实(AGENTS.md §0.3):形状取不到 ⇒ parsed.ok=False 带逐条 problems,
不冒绿;空维 = 零动作如实报 0,不编"导入成功"。
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

SPEC_VERSION = 1
_NAMESPACE_KEYS = ("memory", "automations", "capabilities", "sessions")
_TASK_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
# add_task 的 trigger_type 白名单(单源 = scheduler_service._VALID_TRIGGER_TYPES;
# 此处抄形态会漂移,故以"出口自己拒绝"为兜底:非法值照样透传给 add_task,
# 由它返回 INVALID_TRIGGER —— 本模块只预判明显形状错,不复制第二份白名单)
_VALID_TRIGGER_TYPES = ("cron", "date", "interval")


@dataclass
class ParsedBundle:
    """解析后的外部 bundle(ok=False 时 problems 逐条点名)。"""

    ok: bool
    spec_version: int
    source: str
    namespaces: dict[str, dict[str, Any]] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)


def _validate_item(ns: str, idx: int, item: Any, problems: list[str]) -> dict[str, Any] | None:
    """单条 item 形状校验;坏条目记 problems 返回 None,不抛(逐条点名)。"""
    if not isinstance(item, dict):
        problems.append(f"{ns}[{idx}]: 不是对象({type(item).__name__})")
        return None
    if ns == "memory":
        if not str(item.get("content") or "").strip():
            problems.append(f"{ns}[{idx}]: 缺 content")
            return None
        return item
    if ns == "automations":
        name = str(item.get("name") or "").strip()
        trigger = str(item.get("triggerType") or "").strip()
        if not name:
            problems.append(f"{ns}[{idx}]: 缺 name")
            return None
        if trigger not in _VALID_TRIGGER_TYPES:
            problems.append(f"{ns}[{idx}]: triggerType {trigger!r} 不在 {list(_VALID_TRIGGER_TYPES)}")
            return None
        if not isinstance(item.get("triggerConfig"), dict):
            problems.append(f"{ns}[{idx}]: triggerConfig 必须是对象")
            return None
        if not isinstance(item.get("callback"), dict) or not item["callback"].get("type"):
            problems.append(f"{ns}[{idx}]: callback 必须是含 type 的对象")
            return None
        return item
    if ns == "capabilities":
        if not str(item.get("id") or "").strip() or not str(item.get("kind") or "").strip():
            problems.append(f"{ns}[{idx}]: 缺 id 或 kind")
            return None
        return item
    # sessions:只校验"是对象",语义归 relay 腿
    return item


def parse_external_bundle(raw: Any) -> ParsedBundle:
    """解析 + 形状校验(纯函数;坏 bundle 整体 ok=False,坏条目逐条 problems)。"""
    problems: list[str] = []
    if not isinstance(raw, dict):
        return ParsedBundle(False, 0, "", {}, [f"bundle 不是对象({type(raw).__name__})"])
    spec = raw.get("specVersion")
    if spec != SPEC_VERSION:
        return ParsedBundle(False, 0, "", {}, [f"specVersion 只认 {SPEC_VERSION},得到 {spec!r}"])
    source = str(raw.get("source") or "").strip()
    if not source or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", source):
        problems.append("source 缺失或含非法字符([a-zA-Z0-9_-] 1-40)")
    namespaces: dict[str, dict[str, Any]] = {}
    ns_raw = raw.get("namespaces")
    if not isinstance(ns_raw, dict):
        problems.append("namespaces 缺失或不是对象")
    else:
        for key in _NAMESPACE_KEYS:
            block = ns_raw.get(key)
            if block is None:
                continue
            if not isinstance(block, dict) or not isinstance(block.get("items"), list):
                problems.append(f"{key}: 维必须形如 {{\"items\":[...]}}")
                continue
            items: list[dict[str, Any]] = []
            for idx, item in enumerate(block["items"]):
                valid = _validate_item(key, idx, item, problems)
                if valid is not None:
                    items.append(valid)
            namespaces[key] = {"items": items, "skipped": len(block["items"]) - len(items)}
    if problems and not namespaces:
        return ParsedBundle(False, SPEC_VERSION if isinstance(spec, int) else 0, source, {}, problems)
    return ParsedBundle(True, SPEC_VERSION, source, namespaces, problems)


def automation_task_id(source: str, item: dict[str, Any]) -> str:
    """确定性幂等键:同 bundle 重复导入 → 同 task_id → get_task 命中即跳过。"""
    fingerprint = f"{source}|{item.get('name')}|{item.get('triggerType')}|{sorted((item.get('triggerConfig') or {}).items())}"
    digest = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:12]  # noqa: S324 — 非安全用途,仅幂等指纹
    tid = f"ext-{source}-{digest}"
    if not _TASK_ID_RE.fullmatch(tid):
        tid = f"ext-{digest}"
    return tid


async def apply_bundle(
    parsed: ParsedBundle,
    user_id: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    """逐维执行导入;各维独立计数,单维失败不拖垮其余维(逐条点名)。"""
    if not parsed.ok:
        return {
            "status": "rejected",
            "problems": parsed.problems,
        }
    if not user_id:
        return {
            "status": "skipped_missing_identity",
            "detail": "user_id 未注入:导入产物必须归属到人,拒绝无身份导入",
        }
    result: dict[str, Any] = {"status": "ok", "source": parsed.source}

    if "memory" in parsed.namespaces:
        from .agent_longterm_memory import agent_longterm_memory

        block = parsed.namespaces["memory"]
        outcome = agent_longterm_memory.bulk_import_from_extract(
            block["items"], user_id=user_id, session_id=session_id
        )
        result["memory"] = {**outcome, "skipped_shape": block.get("skipped", 0)}

    if "automations" in parsed.namespaces:
        from .scheduler_service import task_scheduler

        block = parsed.namespaces["automations"]
        created = failed = duplicated = 0
        failures: list[str] = []
        for idx, item in enumerate(block["items"]):
            tid = automation_task_id(parsed.source, item)
            existing = await task_scheduler.get_task(tid)
            if existing.get("ok"):
                duplicated += 1
                continue
            outcome = await task_scheduler.add_task(
                tid,
                str(item["triggerType"]),
                item["triggerConfig"],
                item["callback"],
                conversation_id=session_id,
            )
            if outcome.get("ok"):
                created += 1
            else:
                failed += 1
                failures.append(f"automations[{idx}] {item.get('name')!r}: {outcome.get('message')}")
        result["automations"] = {
            "created": created,
            "duplicated": duplicated,
            "failed": failed,
            "skipped_shape": block.get("skipped", 0),
            **({"failures": failures} if failures else {}),
        }

    if "capabilities" in parsed.namespaces:
        block = parsed.namespaces["capabilities"]
        result["capabilities"] = {
            "declared": [
                {"id": i.get("id"), "kind": i.get("kind"), "note": i.get("note")}
                for i in block["items"]
            ],
            "registered": 0,
            "note": "能力注册面归 MCP 工具表/能力矩阵既有准入纪律,导入只产生声明,不静默注册",
            "skipped_shape": block.get("skipped", 0),
        }

    if "sessions" in parsed.namespaces:
        block = parsed.namespaces["sessions"]
        result["sessions"] = {
            "count": len(block["items"]),
            "skipped_shape": block.get("skipped", 0),
            "owner": "relay-session-leg",
            "note": "会话搬家归属 scripts/relay-* 会话腿(多会话共写面),本模块只校验形状并报数",
        }

    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
