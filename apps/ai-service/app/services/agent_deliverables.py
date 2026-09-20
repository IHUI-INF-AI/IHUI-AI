# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D27 任务完成交付清单(TaskDeliverables)聚合与存储。

职责:
- DeliverablesCollector:单次 agent run 内聚合「引用来源 citations /
  文件改动 filesChanged / 工具统计 toolsSummary / 产出摘要 outputSummary」,
  run 收尾 build() 产出契约形状 dict;
- 模块级 LRU store:session_id -> deliverables dict(容量 256 会话),
  供 GET /api/agents/sessions/{session_id}/deliverables 读取。

跨端契约(与 web/api 侧钉死,camelCase):
{
  "citations": [{"source": "wiki"|"memory"|"skill"|"mcp"|其他,
                 "label": str, "url": str|None}],   # 按 (source,label,url) 去重,上限 20
  "filesChanged": [{"path": str, "kind": "add"|"delete"|"update",
                    "stepIds": [tool_call_id,...],
                    "additions": int, "deletions": int}],  # 按 path 合并,上限 100
  "toolsSummary": {"total": int, "byTool": {tool_name: count}},
  "outputSummary": str,     # final_output 前 500 字符
  "generatedAt": str,       # ISO8601 UTC
}

降级纪律:全部方法内部 try/except + logger.warning,任何异常不抛出,
绝不阻塞 agent loop(与 agent_checkpoint 同款纪律)。
本模块只依赖标准库,不 import agent_loop_v2(避免循环依赖)。
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

# 契约上限
_MAX_CITATIONS = 20
_MAX_FILES_CHANGED = 100
_MAX_OUTPUT_SUMMARY = 500
# 进程内 LRU 存储容量(会话数)
_MAX_SESSIONS = 256


class DeliverablesCollector:
    """单次 agent run 的交付清单聚合器(纯内存,失败降级)。

    生命周期:每次 run 在 loop 侧新建一个实例(_reset_run_state 重置),
    run 收尾经 build() 产出最终 dict 后即弃,聚合状态不跨 run 复用。
    """

    def __init__(self) -> None:
        # citations 列表 + 去重索引((source,label,url 空归一) -> True)
        self._citations: list[dict[str, Any]] = []
        self._citation_seen: set[tuple[str, str, str]] = set()
        # filesChanged:path -> 合并条目(保持首现顺序)
        self._files: OrderedDict[str, dict[str, Any]] = OrderedDict()
        # toolsSummary
        self._tools_total = 0
        self._by_tool: dict[str, int] = {}

    def record_tool_call(
        self,
        call_id: str,
        tool_name: str,
        args: dict[str, Any],
        diff: dict[str, Any] | None,
    ) -> None:
        """记录一次工具调用:统计 toolsSummary;有 diff 时聚合 filesChanged。

        diff 形如 {"tool":..., "path":..., "before": str, "after": str}
        (来自 derive_step_evidence;delete_file 类由调用方从 args 构造)。
        kind 演进:write 类首现(before 空)→ add;之后该 path 再改 → update;
        delete_file → delete。additions/deletions 用 before/after 行数差估算
        (update 累加,粗粒度即可)。
        """
        try:
            name = str(tool_name or "").strip() or "unknown"
            self._tools_total += 1
            self._by_tool[name] = self._by_tool.get(name, 0) + 1
            if not isinstance(diff, dict):
                return
            path = str(diff.get("path") or "").strip()
            if not path:
                return
            before = diff.get("before")
            after = diff.get("after")
            before_text = before if isinstance(before, str) else ""
            after_text = after if isinstance(after, str) else ""
            before_lines = len(before_text.splitlines()) if before_text else 0
            after_lines = len(after_text.splitlines()) if after_text else 0
            # 粗粒度行数差:净增行记 additions,净减行记 deletions
            delta_add = max(0, after_lines - before_lines)
            delta_del = max(0, before_lines - after_lines)
            is_delete = name in ("delete_file", "file_delete") or name.startswith("delete_")
            existing = self._files.get(path)
            if existing is not None:
                # 已有该 path:delete 定格终态;否则演进为 update
                if is_delete:
                    existing["kind"] = "delete"
                    existing["additions"] = 0
                    existing["deletions"] = before_lines
                else:
                    if existing["kind"] == "delete":
                        # delete 后又写入:文件重新出现,按 update 处理(粗粒度)
                        existing["kind"] = "update"
                        existing["additions"] += delta_add
                        existing["deletions"] += delta_del
                    else:
                        existing["kind"] = "update"
                        existing["additions"] += delta_add
                        existing["deletions"] += delta_del
                step_ids = existing.get("stepIds")
                if isinstance(step_ids, list):
                    if call_id and call_id not in step_ids:
                        step_ids.append(str(call_id))
            else:
                # 新 path:受上限约束(已有 path 的合并不受限)
                if len(self._files) >= _MAX_FILES_CHANGED:
                    logger.debug("deliverables filesChanged 达上限 %d,忽略新 path", _MAX_FILES_CHANGED)
                    return
                if is_delete:
                    kind = "delete"
                    add = 0
                    dele = before_lines
                elif not before_text and after_text:
                    kind = "add"
                    add = after_lines
                    dele = 0
                else:
                    kind = "update"
                    add = delta_add
                    dele = delta_del
                self._files[path] = {
                    "path": path,
                    "kind": kind,
                    "stepIds": [str(call_id)] if call_id else [],
                    "additions": add,
                    "deletions": dele,
                }
        except Exception as e:
            logger.warning("deliverables record_tool_call 失败(降级,不阻塞): %s", e)

    def record_citation(self, source: str, label: str, url: str | None = None) -> None:
        """记录一条引用来源(按 (source,label,url) 去重,上限 20)。"""
        try:
            src = str(source or "").strip()
            lab = str(label or "").strip()
            if not src or not lab:
                return
            link = str(url).strip() if url else None
            key = (src, lab, link or "")
            if key in self._citation_seen:
                return
            if len(self._citations) >= _MAX_CITATIONS:
                logger.debug("deliverables citations 达上限 %d,忽略新条目", _MAX_CITATIONS)
                return
            self._citation_seen.add(key)
            self._citations.append({"source": src, "label": lab, "url": link})
        except Exception as e:
            logger.warning("deliverables record_citation 失败(降级,不阻塞): %s", e)

    def build(self, output_summary: str) -> dict[str, Any]:
        """产出契约形状 dict(深拷贝,外部修改不污染聚合状态)。"""
        try:
            summary_text = output_summary if isinstance(output_summary, str) else ""
            return {
                # url 为 None 时省略键(JSON 不产 null,跨端宽松守卫更稳)
                "citations": [
                    {"source": c["source"], "label": c["label"], **({"url": c["url"]} if c["url"] else {})}
                    for c in self._citations
                ],
                "filesChanged": [
                    {
                        "path": f["path"],
                        "kind": f["kind"],
                        "stepIds": list(f["stepIds"]),
                        "additions": int(f["additions"]),
                        "deletions": int(f["deletions"]),
                    }
                    for f in self._files.values()
                ],
                "toolsSummary": {
                    "total": self._tools_total,
                    "byTool": dict(self._by_tool),
                },
                "outputSummary": summary_text[:_MAX_OUTPUT_SUMMARY],
                "generatedAt": datetime.now(UTC).isoformat(),
            }
        except Exception as e:
            # 兜底:build 本身不应失败;真失败时返回最小合法形状,调用方仍可下发
            logger.warning("deliverables build 失败(降级为最小形状): %s", e)
            return {
                "citations": [],
                "filesChanged": [],
                "toolsSummary": {"total": 0, "byTool": {}},
                "outputSummary": "",
                "generatedAt": datetime.now(UTC).isoformat(),
            }


# ---------------------------------------------------------------------------
# 模块级存储:session_id -> deliverables dict(LRU 256 会话)
# ---------------------------------------------------------------------------

_deliverables_store: OrderedDict[str, dict[str, Any]] = OrderedDict()


def save_deliverables(session_id: str, data: dict[str, Any]) -> None:
    """保存会话交付清单(LRU:重复保存视为触达,移到尾部)。"""
    try:
        if not session_id or not isinstance(data, dict):
            return
        _deliverables_store.pop(session_id, None)
        _deliverables_store[session_id] = data
        while len(_deliverables_store) > _MAX_SESSIONS:
            _deliverables_store.popitem(last=False)
    except Exception as e:
        logger.warning("deliverables save 失败(降级,不阻塞): %s", e)


def get_deliverables(session_id: str) -> dict[str, Any] | None:
    """读取会话交付清单(命中时触达 LRU;未命中返回 None,由端点透传 null)。"""
    try:
        data = _deliverables_store.get(session_id)
        if data is not None:
            _deliverables_store.move_to_end(session_id)
        return data
    except Exception as e:
        logger.warning("deliverables get 失败(降级返回 None): %s", e)
        return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
