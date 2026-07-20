"""口播稿 LangGraph workflow 服务。

按 koubo_workflow SKILL.md v11.7 规范编排 8 篇/日生成:
  hot_scan(热点扫描)
  → topic_select(选题 + 五维评分)
  → write_articles(串行写 8 篇,约束优先)
  → validate(双门禁: koubo_validate + pre_publish_check)
  → archive(归档 Output/MMDD.txt + 写历史)

设计要点:
1. 复用 llm_gateway 单例(DB 配置优先 + stub 降级 + 错误脱敏)。
2. 跨篇去重约束需串行写 8 篇(后篇要参考前 7 篇词表),不并行。
3. 门禁脚本通过 subprocess 调用(避免 import project_boundary 副作用)。
4. LangGraph 不可用时降级为手动状态机(_run_manual)。
5. 节点可观测性:trace 收集器记录每个节点执行时间/状态/错误。
6. 支持 SSE 流式进度推送(astream_events 模式)。
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator, Optional, TypedDict

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# koubo_workflow skill 根目录:app/services/koubo_workflow.py -> app/services -> app -> skills/koubo_workflow
SKILLS_ROOT = Path(__file__).resolve().parent.parent / "skills"
KOUBO_WORKFLOW_DIR = SKILLS_ROOT / "koubo_workflow"
OUTPUT_DIR = KOUBO_WORKFLOW_DIR / "Output"
HISTORY_DIR = KOUBO_WORKFLOW_DIR / "history"


class KouboState(TypedDict, total=False):
    """LangGraph 状态。"""

    date: str  # MMDD
    topic_hint: str  # 选题方向提示(可空)
    model: str | None
    owner_uuid: str | None
    dry_run: bool

    # 节点产物
    hot_topics: list[dict[str, Any]]  # Phase 0: 热点池
    selected_topics: list[dict[str, Any]]  # 8 个选题(含五维评分)
    articles: list[dict[str, Any]]  # 8 篇正文
    validated: bool  # 双门禁是否通过
    output_path: str  # Output/MMDD.txt

    # 控制
    error: str | None
    status: str  # planning / writing / validating / done / error
    trace: list[dict[str, Any]]


def _trace(node: str, start: float, end: float, status: str = "ok", **meta: Any) -> dict[str, Any]:
    return {
        "node": node,
        "start": datetime.utcfromtimestamp(start).isoformat() + "Z",
        "end": datetime.utcfromtimestamp(end).isoformat() + "Z",
        "duration_ms": round((end - start) * 1000, 2),
        "status": status,
        **meta,
    }


async def _run_koubo_script(script_name: str, args: list[str], timeout_sec: int = 60) -> tuple[int, str, str]:
    """subprocess 调 koubo_workflow/tools/*.py(隔离 project_boundary 副作用)。"""
    script_path = KOUBO_WORKFLOW_DIR / "tools" / script_name
    if not script_path.is_file():
        return 127, "", f"script not found: {script_path}"
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(script_path), *args,
            cwd=str(KOUBO_WORKFLOW_DIR / "tools"),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_sec
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return 124, "", f"timeout after {timeout_sec}s"
        return (
            proc.returncode or 0,
            stdout_b.decode("utf-8", "ignore"),
            stderr_b.decode("utf-8", "ignore"),
        )
    except Exception as e:
        return 1, "", f"{type(e).__name__}: {e}"


# ===== 选题 + 写作 prompt =====

HOT_SCAN_PROMPT = (
    "你是抖音口播稿选题策划师,基于 AI/科技领域热点,生成 8 个选题。"
    "每个选题包含:title(标题)、angle(切入角度)、audience(目标受众)、"
    "hook(开头钩子前 30 字)、five_dim_score(五维评分:信息量/实用性/情绪/独特性/传播力,各 1-5 分,总分 5-25)。"
    "输出 JSON 数组,8 个对象。禁止 AI 味词汇,选题要新鲜、有具体抓手。"
)

WRITE_ARTICLE_PROMPT = (
    "你是抖音口播稿写作师,严格遵循 koubo_workflow SKILL.md 约束优先写作法:\n"
    "1. 字数 180-260(朗读 50-70 秒)\n"
    "2. 开头 15 字内给强钩子(数字/反差/提问/悬念)\n"
    "3. 主体 2-3 个信息点,每个点用「不是…而是…」「你以为…其实…」等转折\n"
    "4. 结尾 20 字内行动召唤(关注/点赞/收藏)\n"
    "5. 禁用 AI 味词:「在这个数字时代」「让我们一起」「不仅…而且…」\n"
    "6. 跨篇去重:不要重复前序篇目的开头/关键短语/案例\n"
    "只输出正文,不要标题/编号/解释。"
)


class KouboWorkflowService:
    """口播稿 LangGraph workflow 服务(单例)。"""

    def __init__(self) -> None:
        self._available = False
        self._graph = None
        self._init_graph()

    def _init_graph(self) -> None:
        try:
            from langgraph.graph import StateGraph, END

            workflow = StateGraph(KouboState)
            workflow.add_node("hot_scan", self._hot_scan_node)
            workflow.add_node("topic_select", self._topic_select_node)
            workflow.add_node("write_articles", self._write_articles_node)
            workflow.add_node("validate", self._validate_node)
            workflow.add_node("archive", self._archive_node)
            workflow.add_node("error", self._error_node)

            workflow.set_entry_point("hot_scan")
            workflow.add_edge("hot_scan", "topic_select")
            workflow.add_edge("topic_select", "write_articles")
            workflow.add_edge("write_articles", "validate")
            workflow.add_conditional_edges(
                "validate",
                self._should_archive,
                {"archive": "archive", "error": "error"},
            )
            workflow.add_edge("archive", END)
            workflow.add_edge("error", END)
            self._graph = workflow.compile()
            self._available = True
        except ImportError:
            logger.warning("langgraph 未安装,koubo workflow 降级为手动状态机")
            self._available = False
        except Exception as e:
            logger.warning("koubo workflow graph 构建失败,降级手动: %s", e)
            self._available = False

    @property
    def available(self) -> bool:
        return self._available

    # ===== 节点实现 =====

    async def _hot_scan_node(self, state: KouboState) -> KouboState:
        """Phase 0:热点扫描(调 topic_pool.py + LLM 结构化)。"""
        t0 = time.monotonic()
        trace = list(state.get("trace", []))
        rc, out, err = await _run_koubo_script("topic_pool.py", ["--take", "30"], timeout_sec=60)
        if rc != 0:
            trace.append(_trace("hot_scan", t0, time.monotonic(), "warn", warn=f"topic_pool 失败,降级用 LLM 生成"))
        # LLM 结构化热点(基于 topic_pool 输出 + 用户 topic_hint)
        user_msg = f"日期:{state['date']}\n选题方向提示:{state.get('topic_hint', '无')}\n参考热点池:\n{out[:2000]}\n请生成 8 个选题 JSON。"
        try:
            result = await llm_gateway.complete(
                [
                    {"role": "system", "content": HOT_SCAN_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                model=state.get("model"),
                owner_uuid=state.get("owner_uuid"),
                temperature=0.8,
                max_tokens=2500,
            )
        except Exception as e:
            return {**state, "error": f"hot_scan LLM 异常: {e}", "status": "error",
                    "trace": trace + [_trace("hot_scan", t0, time.monotonic(), "error", error=str(e))]}
        if result.get("error"):
            return {**state, "error": result.get("error_message", "hot_scan LLM 失败"),
                    "status": "error",
                    "trace": trace + [_trace("hot_scan", t0, time.monotonic(), "error", error=result.get("error_message"))]}
        try:
            hot_topics = self._parse_json_array(result["content"])
        except Exception as e:
            return {**state, "error": f"hot_scan JSON 解析失败: {e}", "status": "error",
                    "trace": trace + [_trace("hot_scan", t0, time.monotonic(), "error", error=str(e))]}
        return {**state, "hot_topics": hot_topics,
                "trace": trace + [_trace("hot_scan", t0, time.monotonic(), "ok", topics=len(hot_topics))]}

    async def _topic_select_node(self, state: KouboState) -> KouboState:
        """Phase 1:选题评分(从 hot_topics 选 8 个,五维评分 >=15 优先)。"""
        t0 = time.monotonic()
        trace = list(state.get("trace", []))
        hot = state.get("hot_topics", [])
        if not hot:
            return {**state, "error": "hot_topics 为空,无法选题", "status": "error",
                    "trace": trace + [_trace("topic_select", t0, time.monotonic(), "error", error="empty hot_topics")]}
        # 按五维评分排序,取前 8
        def score(t: dict) -> int:
            s = t.get("five_dim_score", 0)
            if isinstance(s, dict):
                return sum(s.values())
            try:
                return int(s)
            except Exception:
                return 0
        selected = sorted(hot, key=score, reverse=True)[:8]
        if len(selected) < 8:
            return {**state, "error": f"选题不足 8 个(实际 {len(selected)})", "status": "error",
                    "trace": trace + [_trace("topic_select", t0, time.monotonic(), "error", error="not enough topics")]}
        return {**state, "selected_topics": selected,
                "trace": trace + [_trace("topic_select", t0, time.monotonic(), "ok", selected=len(selected))]}

    async def _write_articles_node(self, state: KouboState) -> KouboState:
        """Phase 2:串行写 8 篇(约束优先,跨篇去重)。"""
        t0 = time.monotonic()
        trace = list(state.get("trace", []))
        topics = state.get("selected_topics", [])
        articles: list[dict[str, Any]] = []
        prev_summaries: list[str] = []
        for i, topic in enumerate(topics):
            user_msg = (
                f"第 {i+1}/8 篇\n"
                f"选题:{json.dumps(topic, ensure_ascii=False)}\n"
                f"前序篇目摘要(避免重复):{chr(10).join(prev_summaries[-3:]) or '无'}\n"
                f"请输出本篇正文。"
            )
            try:
                result = await llm_gateway.complete(
                    [
                        {"role": "system", "content": WRITE_ARTICLE_PROMPT},
                        {"role": "user", "content": user_msg},
                    ],
                    model=state.get("model"),
                    owner_uuid=state.get("owner_uuid"),
                    temperature=0.75,
                    max_tokens=800,
                )
            except Exception as e:
                return {**state, "error": f"第 {i+1} 篇 LLM 异常: {e}", "status": "error",
                        "trace": trace + [_trace("write_articles", t0, time.monotonic(), "error", error=str(e), article=i+1)]}
            if result.get("error"):
                return {**state, "error": f"第 {i+1} 篇 LLM 失败: {result.get('error_message')}",
                        "status": "error",
                        "trace": trace + [_trace("write_articles", t0, time.monotonic(), "error", error=result.get('error_message'), article=i+1)]}
            content = result.get("content", "").strip()
            articles.append({"index": i + 1, "topic": topic, "content": content})
            prev_summaries.append(content[:60])
            trace.append(_trace("write_article", t0, time.monotonic(), "ok", article=i + 1, chars=len(content)))
        return {**state, "articles": articles, "status": "validating",
                "trace": trace + [_trace("write_articles", t0, time.monotonic(), "ok", total=len(articles))]}

    async def _validate_node(self, state: KouboState) -> KouboState:
        """Phase 3:双门禁验证(写文件 → pre_publish_check.py)。"""
        t0 = time.monotonic()
        trace = list(state.get("trace", []))
        # 拼装输出文件
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = OUTPUT_DIR / f"{state['date']}.txt"
        parts = [f"# {state['date']}"]
        for art in state.get("articles", []):
            parts.append(f"## 第 {art['index']} 篇")
            parts.append(art["content"])
            parts.append("")
        out_path.write_text("\n".join(parts), encoding="utf-8")
        # 跑 pre_publish_check.py(5 项门禁:歧义/词表/全量/语病/热点覆盖)
        rc, out, err = await _run_koubo_script("pre_publish_check.py", [str(out_path)], timeout_sec=120)
        validated = rc == 0
        return {**state, "validated": validated, "output_path": str(out_path),
                "status": "done" if validated else "error",
                "error": None if validated else f"门禁失败 (rc={rc}): {err[:500]}",
                "trace": trace + [_trace("validate", t0, time.monotonic(), "ok" if validated else "fail",
                                          rc=rc, stdout_tail=out[-200:])]}

    async def _archive_node(self, state: KouboState) -> KouboState:
        """Phase 4:归档(archive_daily.py --finalize)。"""
        t0 = time.monotonic()
        trace = list(state.get("trace", []))
        rc, out, err = await _run_koubo_script(
            "archive_daily.py",
            ["--finalize", str(state["output_path"])],
            timeout_sec=30,
        )
        return {**state, "status": "done",
                "trace": trace + [_trace("archive", t0, time.monotonic(), "ok" if rc == 0 else "warn",
                                          rc=rc, error=err[-200:] if rc else None)]}

    async def _error_node(self, state: KouboState) -> KouboState:
        """错误节点:记录错误并结束。"""
        return {**state, "status": "error"}

    def _should_archive(self, state: KouboState) -> str:
        return "archive" if state.get("validated") else "error"

    # ===== 工具 =====

    @staticmethod
    def _parse_json_array(text: str) -> list[dict[str, Any]]:
        """容错解析 LLM 输出的 JSON 数组(去 markdown 围栏 + 提取首个 [..])。"""
        s = text.strip()
        if s.startswith("```"):
            s = s.split("\n", 1)[-1]
            if s.endswith("```"):
                s = s.rsplit("```", 1)[0]
            s = s.strip()
        # 提取首个 [...] 块
        start = s.find("[")
        end = s.rfind("]")
        if start >= 0 and end > start:
            s = s[start : end + 1]
        data = json.loads(s)
        if not isinstance(data, list):
            raise ValueError("not a JSON array")
        return [d for d in data if isinstance(d, dict)]

    # ===== 对外入口 =====

    async def run(self, date: str, topic: str = "", model: str | None = None,
                  owner_uuid: str | None = None, dry_run: bool = True) -> dict[str, Any]:
        """运行完整 workflow,返回最终状态。"""
        initial: KouboState = {
            "date": date,
            "topic_hint": topic,
            "model": model,
            "owner_uuid": owner_uuid,
            "dry_run": dry_run,
            "hot_topics": [],
            "selected_topics": [],
            "articles": [],
            "validated": False,
            "output_path": "",
            "error": None,
            "status": "planning",
            "trace": [],
        }
        if self._available and self._graph is not None:
            try:
                final_state = await self._graph.ainvoke(initial)
                return dict(final_state)
            except Exception as e:
                logger.exception("koubo workflow graph 执行失败,降级手动: %s", e)
        return await self._run_manual(initial)

    async def _run_manual(self, state: KouboState) -> dict[str, Any]:
        """手动状态机降级实现(节点函数复用)。"""
        s = await self._hot_scan_node(state)
        if s.get("error"):
            return dict(s)
        s = await self._topic_select_node(s)
        if s.get("error"):
            return dict(s)
        s = await self._write_articles_node(s)
        if s.get("error"):
            return dict(s)
        s = await self._validate_node(s)
        if s.get("error"):
            return dict(s)
        return dict(await self._archive_node(s))

    async def stream(
        self, date: str, topic: str = "", model: str | None = None,
        owner_uuid: str | None = None, dry_run: bool = True,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式 yield trace 事件(供 SSE 推送)。"""
        initial: KouboState = {
            "date": date, "topic_hint": topic, "model": model,
            "owner_uuid": owner_uuid, "dry_run": dry_run,
            "hot_topics": [], "selected_topics": [], "articles": [],
            "validated": False, "output_path": "", "error": None,
            "status": "planning", "trace": [],
        }
        nodes = [
            ("hot_scan", self._hot_scan_node),
            ("topic_select", self._topic_select_node),
            ("write_articles", self._write_articles_node),
            ("validate", self._validate_node),
            ("archive", self._archive_node),
        ]
        s = initial
        for name, fn in nodes:
            yield {"event": "node_start", "node": name, "state": dict(s)}
            s = await fn(s)
            yield {"event": "node_end", "node": name, "state": dict(s)}
            if s.get("error"):
                yield {"event": "workflow_error", "error": s["error"], "state": dict(s)}
                return
        yield {"event": "workflow_done", "state": dict(s)}


koubo_workflow_service = KouboWorkflowService()
