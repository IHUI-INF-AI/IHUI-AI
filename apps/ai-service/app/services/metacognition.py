"""元认知系统(L9,2026-07-25 立,对标人类元认知)。

L9 元认知 = 记忆自我反思 + 主动遗忘策略(对比被动衰减)。

核心能力:
1. reflect_on_memories:记忆自我反思主入口
   - 调 active_forgetter.scan_stale_memories 获取过期候选
   - 抽样 → LLM 评估每条(forget / keep / merge / demote)
   - LLM 失败 / JSON 解析失败 → 降级启发式(days_stale>60 → forget,importance<0.2 → demote)
   - 应用行动 → 持久化反思日志到 agent_metacognition_log
2. detect_conflicts:冲突检测
   - 扫描 semantic + procedural 找潜在冲突
   - 启发式:关键词重叠但 importance 差异 > 0.5 / 同 tool_name 不同 pattern
   - 可选用 LLM 验证
3. get_reflection_history:从 DB 加载反思历史
4. build_system_prompt_snippet:从最近反思抽取 findings 注入 system prompt

数据流:
  active_forgetter.scan_stale_memories
    ↓ Metacognition.reflect_on_memories
  过期候选 → 抽样 → LLM 评估 → actions
    ↓ active_forgetter.forget_memory / demote_memory
  DB 更新 + agent_metacognition_log 持久化
    ↓ Metacognition._cache(内存)
  build_system_prompt_snippet → AgentLoop system prompt 注入

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 仅写内存 + warning
  - LLM 失败 / JSON 解析失败 → 启发式规则
  - active_forgetter 失败 → 跳过该 action,继续其他
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from ..core.db_pool import get_shared_pool
from ..core.llm_gateway import llm_gateway
from .active_forgetter import active_forgetter

logger = logging.getLogger(__name__)

# LLM prompt 字符上限(防止超长上下文)
_MAX_PROMPT_CHARS = 3000

# 启发式规则阈值
_HEURISTIC_FORGET_DAYS = 60  # days_stale > 60 → forget
_HEURISTIC_DEMOTE_IMPORTANCE = 0.2  # importance < 0.2 → demote

# 冲突检测阈值
_CONFLICT_IMPORTANCE_DIFF = 0.5  # importance 差异 > 0.5 视为潜在冲突
_KEYWORD_MIN_LEN = 2  # 关键词最短长度(过滤单字噪声)
_KEYWORD_MAX_PER_DOC = 20  # 单条记忆最多提取的关键词数

# system prompt snippet 上限
_MAX_SNIPPET_CHARS = 800


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容)。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


class Metacognition:
    """元认知系统:记忆自我反思 + 主动遗忘策略。

    L9:对标人类元认知,主动评估记忆质量 + 清理低价值记忆。
    """

    def __init__(self) -> None:
        # 反思历史缓存(内存,启动时由 lifespan hydrate,运行时增量追加)
        self._cache: list[dict[str, Any]] = []

    # ==================================================================
    # reflect_on_memories:自我反思主入口
    # ==================================================================

    async def reflect_on_memories(
        self,
        user_id: str | None = None,
        *,
        sample_size: int = 20,
    ) -> dict[str, Any]:
        """自我反思主入口:扫描过期记忆 → LLM 评估 → 应用行动 → 持久化日志。

        流程:
        1. 调 active_forgetter.scan_stale_memories 获取过期候选
        2. 从候选中抽样 sample_size 条
        3. 构造 LLM prompt,让 LLM 评估每条记忆是否过时/错误/冗余
        4. 调 llm_gateway.complete(prompt 限制 3000 字符)
        5. 解析 JSON 失败 → 降级启发式(days_stale>60 → forget,importance<0.2 → demote)
        6. 应用行动:对每条 action 调 active_forgetter.forget_memory / demote_memory
        7. 持久化反思日志到 agent_metacognition_log 表
        8. 返回 {"reflected_count": int, "actions_taken": list, "log_id": str}

        Args:
            user_id: 用户 ID(可空,空表示系统级反思)
            sample_size: 抽样数量(默认 20)

        Returns:
            反思结果字典,失败降级返回空 actions + log_id=""。
        """
        # 1. 扫描过期候选
        try:
            candidates = await active_forgetter.scan_stale_memories(
                user_id, limit=max(sample_size * 2, 50)
            )
        except Exception as e:
            logger.warning(
                "[metacognition] scan_stale_memories 失败: %s: %s",
                type(e).__name__, e,
            )
            candidates = []

        if not candidates:
            # 无候选,仍写一条空反思日志
            log_id = await self._persist_reflection_log(
                user_id=user_id,
                reflection_type="memory_audit",
                target_layer=None,
                target_id=None,
                findings=[{"issue": "no_stale_candidates", "severity": "low"}],
                actions_taken=[],
                confidence=0.5,
                llm_used=False,
                token_cost=0,
            )
            return {
                "reflected_count": 0,
                "actions_taken": [],
                "log_id": log_id,
            }

        # 2. 抽样
        sample = candidates[:sample_size] if sample_size > 0 else candidates

        # 3. 构造 LLM prompt
        prompt = self._build_reflection_prompt(sample, user_id)

        # 4. 调 LLM
        llm_used = False
        token_cost = 0
        actions: list[dict[str, Any]] = []
        confidence = 0.5
        try:
            response = await llm_gateway.complete(
                [
                    {
                        "role": "system",
                        "content": (
                            "你是元认知评估器,评估记忆是否过时/错误/冗余。"
                            '严格返回 JSON: {"actions": [{"target_id":"...",'
                            '"action":"forget|keep|merge|demote","reason":"..."}, ...]}'
                        ),
                    },
                    {"role": "user", "content": prompt},
                ]
            )
            llm_used = not response.get("error", False)
            usage = response.get("usage") or {}
            token_cost = int(usage.get("total_tokens") or 0)

            if llm_used:
                content = response.get("content", "") or ""
                actions = self._parse_actions_json(content)
                if actions:
                    confidence = 0.8  # LLM 成功解析 → 高置信度
                else:
                    # JSON 解析失败 → 降级启发式
                    actions = self._heuristic_actions(sample)
                    llm_used = False  # 标记为未成功用 LLM
            else:
                # LLM 返回 error → 降级启发式
                actions = self._heuristic_actions(sample)
        except Exception as e:
            logger.warning(
                "[metacognition] LLM 调用失败(降级启发式): %s: %s",
                type(e).__name__, e,
            )
            actions = self._heuristic_actions(sample)
            llm_used = False

        # 6. 应用行动
        applied_actions: list[dict[str, Any]] = []
        candidate_index: dict[str, dict[str, Any]] = {
            str(c.get("id")): c for c in sample
        }
        for action in actions:
            target_id = str(action.get("target_id", ""))
            act = str(action.get("action", "keep")).lower()
            reason = str(action.get("reason", ""))
            cand = candidate_index.get(target_id)
            if not cand:
                continue
            layer = str(cand.get("layer", ""))
            applied = await self._apply_action(
                layer=layer,
                target_id=target_id,
                action=act,
                reason=reason,
            )
            if applied:
                applied_actions.append({
                    "target_id": target_id,
                    "action": act,
                    "reason": reason,
                    "layer": layer,
                })

        # 7. 持久化反思日志
        findings = self._build_findings(sample, applied_actions)
        log_id = await self._persist_reflection_log(
            user_id=user_id,
            reflection_type="memory_audit",
            target_layer=None,
            target_id=None,
            findings=findings,
            actions_taken=applied_actions,
            confidence=confidence,
            llm_used=llm_used,
            token_cost=token_cost,
        )

        return {
            "reflected_count": len(sample),
            "actions_taken": applied_actions,
            "log_id": log_id,
        }

    # ==================================================================
    # detect_conflicts:冲突检测
    # ==================================================================

    async def detect_conflicts(
        self,
        user_id: str,
        *,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """冲突检测:扫描该用户 semantic + procedural 记忆找潜在冲突。

        启发式:
        - semantic:关键词重叠但 importance_score 差异 > 0.5
        - procedural:同 tool_name 不同 pattern 视为潜在冲突

        Args:
            user_id: 用户 ID
            top_k: 最多返回的冲突对数(默认 10)

        Returns:
            [{"id_a","id_b","layer","conflict_type","confidence"}, ...]
            失败返回 []。
        """
        conflicts: list[dict[str, Any]] = []
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                # semantic 冲突:关键词重叠 + importance 差异
                sem_rows = await conn.fetch(
                    """SELECT id::text AS id, content, importance_score::float AS score
                       FROM agent_memory_semantic
                       WHERE user_id::text = $1 AND content IS NOT NULL
                       ORDER BY importance_score DESC
                       LIMIT $2""",
                    user_id,
                    top_k * 4,
                )
                # procedural 冲突:同 tool_name 不同 pattern
                proc_rows = await conn.fetch(
                    """SELECT id::text AS id, pattern, tool_name,
                              importance_score::float AS score
                       FROM agent_memory_procedural
                       WHERE user_id::text = $1
                       ORDER BY importance_score DESC
                       LIMIT $2""",
                    user_id,
                    top_k * 4,
                )
        except Exception as e:
            logger.warning(
                "[metacognition] detect_conflicts 查询失败: %s: %s",
                type(e).__name__, e,
            )
            return []

        # semantic 两两对比
        for i in range(len(sem_rows)):
            for j in range(i + 1, len(sem_rows)):
                if len(conflicts) >= top_k:
                    break
                a, b = sem_rows[i], sem_rows[j]
                overlap = self._keyword_overlap(
                    str(a["content"] or ""), str(b["content"] or "")
                )
                score_diff = abs(float(a["score"] or 0) - float(b["score"] or 0))
                if overlap > 0 and score_diff > _CONFLICT_IMPORTANCE_DIFF:
                    conflicts.append({
                        "id_a": a["id"],
                        "id_b": b["id"],
                        "layer": "semantic",
                        "conflict_type": "importance_divergence",
                        "confidence": round(min(1.0, overlap / 5.0 + score_diff), 2),
                    })
            if len(conflicts) >= top_k:
                break

        # procedural 同 tool_name 配对
        proc_by_tool: dict[str, list[dict[str, Any]]] = {}
        for r in proc_rows:
            tool = str(r["tool_name"] or "")
            if not tool:
                continue
            proc_by_tool.setdefault(tool, []).append({
                "id": r["id"],
                "pattern": str(r["pattern"] or ""),
                "score": float(r["score"] or 0),
            })
        for tool, items in proc_by_tool.items():
            if len(items) < 2:
                continue
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    if len(conflicts) >= top_k:
                        break
                    a, b = items[i], items[j]
                    if a["pattern"] != b["pattern"]:
                        score_diff = abs(a["score"] - b["score"])
                        conflicts.append({
                            "id_a": a["id"],
                            "id_b": b["id"],
                            "layer": "procedural",
                            "conflict_type": "same_tool_diff_pattern",
                            "confidence": round(0.6 + score_diff * 0.3, 2),
                        })
                if len(conflicts) >= top_k:
                    break
            if len(conflicts) >= top_k:
                break

        return conflicts[:top_k]

    # ==================================================================
    # get_reflection_history:反思历史查询
    # ==================================================================

    async def get_reflection_history(
        self,
        user_id: str | None = None,
        *,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        """从 agent_metacognition_log 表 SELECT 反思历史。

        Args:
            user_id: 用户 ID(可空,空表示全部)
            top_k: 最多返回条数(默认 20)

        Returns:
            反思历史列表(按 created_at DESC),失败返回 []。
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                if user_id is not None:
                    rows = await conn.fetch(
                        """SELECT id::text AS id, user_id, reflection_type,
                                  target_layer, target_id, findings, actions_taken,
                                  confidence::float AS confidence, llm_used,
                                  token_cost::int AS token_cost, created_at
                           FROM agent_metacognition_log
                           WHERE user_id = $1
                           ORDER BY created_at DESC
                           LIMIT $2""",
                        user_id,
                        top_k,
                    )
                else:
                    rows = await conn.fetch(
                        """SELECT id::text AS id, user_id, reflection_type,
                                  target_layer, target_id, findings, actions_taken,
                                  confidence::float AS confidence, llm_used,
                                  token_cost::int AS token_cost, created_at
                           FROM agent_metacognition_log
                           ORDER BY created_at DESC
                           LIMIT $1""",
                        top_k,
                    )
        except Exception as e:
            logger.warning(
                "[metacognition] get_reflection_history 查询失败: %s: %s",
                type(e).__name__, e,
            )
            return []

        result: list[dict[str, Any]] = []
        for row in rows:
            result.append({
                "id": row["id"],
                "user_id": row["user_id"],
                "reflection_type": row["reflection_type"],
                "target_layer": row["target_layer"],
                "target_id": row["target_id"],
                "findings": list(row["findings"] or []),
                "actions_taken": list(row["actions_taken"] or []),
                "confidence": float(row["confidence"] or 0.5),
                "llm_used": bool(row["llm_used"]),
                "token_cost": int(row["token_cost"] or 0),
                "created_at": row["created_at"].isoformat()
                if row["created_at"] else None,
            })
        return result

    # ==================================================================
    # build_system_prompt_snippet:system prompt 注入
    # ==================================================================

    def build_system_prompt_snippet(self, *, max_findings: int = 3) -> str:
        """构建元认知 system prompt 片段(同步,无 DB 查询)。

        从最近反思中抽取关键 findings 注入 AgentLoop system prompt:
        格式:"## 元认知提示\n\n基于最近反思,请注意:\n- ...\n- ...\n"

        Args:
            max_findings: 最大注入条数(默认 3)

        Returns:
            system prompt 片段(多行字符串),空缓存返回空字符串。
        """
        if not self._cache or max_findings <= 0:
            return ""
        # 取最近 max_findings 条反思的 findings 汇总
        recent = self._cache[-max_findings:]
        findings_list: list[str] = []
        for entry in recent:
            findings = entry.get("findings") or []
            for f in findings:
                if isinstance(f, dict):
                    issue = str(f.get("issue", "")).strip()
                    if issue:
                        findings_list.append(issue)
                elif isinstance(f, str) and f.strip():
                    findings_list.append(f.strip())
            if len(findings_list) >= max_findings:
                break
        if not findings_list:
            return ""
        findings_list = findings_list[:max_findings]
        lines = ["## 元认知提示", "", "基于最近反思,请注意:"]
        for f in findings_list:
            lines.append(f"- {f}")
        snippet = "\n".join(lines)
        if len(snippet) > _MAX_SNIPPET_CHARS:
            snippet = snippet[: _MAX_SNIPPET_CHARS - 3] + "..."
        return snippet

    # ==================================================================
    # 内部工具:LLM prompt 构造 / JSON 解析 / 启发式
    # ==================================================================

    def _build_reflection_prompt(
        self, sample: list[dict[str, Any]], user_id: str | None
    ) -> str:
        """构造 LLM 反思 prompt(限制 3000 字符)。"""
        lines = [
            f"用户 ID: {user_id or 'system'}",
            f"待评估记忆数: {len(sample)}",
            "",
            "请评估每条记忆,决定 action:",
            "- forget: 内容过时 / 错误 / 已无价值",
            "- demote: 价值降低但保留(降 importance)",
            "- merge: 与其他重复(暂不实现合并,标记即可)",
            "- keep: 仍有价值,保留",
            "",
            "记忆列表:",
        ]
        for i, cand in enumerate(sample):
            entry = (
                f"[{i + 1}] id={cand.get('id')} layer={cand.get('layer')} "
                f"importance={cand.get('importance_score')} "
                f"days_stale={cand.get('days_stale')} "
                f"content={cand.get('content_preview', '')[:60]}"
            )
            lines.append(entry)
        prompt = "\n".join(lines)
        if len(prompt) > _MAX_PROMPT_CHARS:
            prompt = prompt[:_MAX_PROMPT_CHARS - 3] + "..."
        return prompt

    def _parse_actions_json(self, content: str) -> list[dict[str, Any]]:
        """解析 LLM 返回的 JSON,提取 actions 列表。

        支持:
        - 纯 JSON
        - ```json ... ``` 代码块
        - 带前后文本的 JSON
        """
        if not content:
            return []
        # 尝试提取 ```json ... ``` 代码块
        code_block = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
        if code_block:
            content = code_block.group(1)
        # 尝试提取最外层 {...}
        brace_match = re.search(r"\{.*\}", content, re.DOTALL)
        if brace_match:
            content = brace_match.group(0)
        try:
            data = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(data, dict):
            return []
        actions = data.get("actions")
        if not isinstance(actions, list):
            return []
        result: list[dict[str, Any]] = []
        for item in actions:
            if not isinstance(item, dict):
                continue
            target_id = str(item.get("target_id", "")).strip()
            action = str(item.get("action", "")).strip().lower()
            if not target_id or action not in ("forget", "keep", "merge", "demote"):
                continue
            result.append({
                "target_id": target_id,
                "action": action,
                "reason": str(item.get("reason", ""))[:200],
            })
        return result

    def _heuristic_actions(
        self, sample: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """启发式规则生成 actions(LLM 失败时降级用)。

        规则:
        - days_stale > 60 → forget
        - importance_score < 0.2 → demote
        - 其他 → keep(keep 不产生行动,跳过)
        """
        actions: list[dict[str, Any]] = []
        for cand in sample:
            days_stale = int(cand.get("days_stale") or 0)
            importance = float(cand.get("importance_score") or 0.0)
            target_id = str(cand.get("id", ""))
            if not target_id:
                continue
            if days_stale > _HEURISTIC_FORGET_DAYS:
                actions.append({
                    "target_id": target_id,
                    "action": "forget",
                    "reason": f"heuristic:days_stale={days_stale}>60",
                })
            elif importance < _HEURISTIC_DEMOTE_IMPORTANCE:
                actions.append({
                    "target_id": target_id,
                    "action": "demote",
                    "reason": f"heuristic:importance={importance}<0.2",
                })
            # keep 不加入 actions(无需应用)
        return actions

    async def _apply_action(
        self,
        *,
        layer: str,
        target_id: str,
        action: str,
        reason: str,
    ) -> bool:
        """应用单条 action 到 active_forgetter(失败返回 False,不抛错)。"""
        try:
            if action == "forget":
                return await active_forgetter.forget_memory(
                    layer, target_id, reason=reason
                )
            if action == "demote":
                return await active_forgetter.demote_memory(layer, target_id)
            # keep / merge / 未知 action → 不应用,视为成功跳过
            return action in ("keep", "merge")
        except Exception as e:
            logger.warning(
                "[metacognition] _apply_action 失败 layer=%s id=%s action=%s: %s: %s",
                layer, target_id, action, type(e).__name__, e,
            )
            return False

    def _build_findings(
        self,
        sample: list[dict[str, Any]],
        applied_actions: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """从样本和已应用行动构造 findings 列表。"""
        findings: list[dict[str, Any]] = []
        forget_count = sum(1 for a in applied_actions if a.get("action") == "forget")
        demote_count = sum(1 for a in applied_actions if a.get("action") == "demote")
        if forget_count:
            findings.append({
                "issue": f"forgot {forget_count} stale memories",
                "severity": "medium",
            })
        if demote_count:
            findings.append({
                "issue": f"demoted {demote_count} low-importance memories",
                "severity": "low",
            })
        stale_count = sum(
            1 for c in sample if int(c.get("days_stale") or 0) > 30
        )
        if stale_count:
            findings.append({
                "issue": f"{stale_count} memories stale > 30 days",
                "severity": "low",
            })
        return findings

    async def _persist_reflection_log(
        self,
        *,
        user_id: str | None,
        reflection_type: str,
        target_layer: str | None,
        target_id: str | None,
        findings: list[dict[str, Any]],
        actions_taken: list[dict[str, Any]],
        confidence: float,
        llm_used: bool,
        token_cost: int,
    ) -> str:
        """持久化反思日志到 agent_metacognition_log 表 + 内存缓存。

        失败降级:仅写内存 + warning,返回空 log_id。
        """
        log_id = ""
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """INSERT INTO agent_metacognition_log
                           (user_id, reflection_type, target_layer, target_id,
                            findings, actions_taken, confidence, llm_used, token_cost)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                       RETURNING id::text AS id""",
                    user_id,
                    reflection_type,
                    target_layer,
                    target_id,
                    json.dumps(findings, ensure_ascii=False),
                    json.dumps(actions_taken, ensure_ascii=False),
                    confidence,
                    llm_used,
                    token_cost,
                )
                if row:
                    log_id = str(row["id"])
        except Exception as e:
            logger.warning(
                "[metacognition] _persist_reflection_log DB 失败(仅写内存): %s: %s",
                type(e).__name__, e,
            )

        # 内存缓存(无论 DB 成功与否都写)
        cache_entry = {
            "id": log_id,
            "user_id": user_id,
            "reflection_type": reflection_type,
            "target_layer": target_layer,
            "target_id": target_id,
            "findings": findings,
            "actions_taken": actions_taken,
            "confidence": confidence,
            "llm_used": llm_used,
            "token_cost": token_cost,
        }
        self._cache.append(cache_entry)
        # 内存缓存上限(防止无限增长)
        if len(self._cache) > 100:
            self._cache = self._cache[-100:]
        return log_id

    @staticmethod
    def _extract_keywords(text: str) -> set[str]:
        """提取关键词(简单分词,过滤短词 / 数字)。"""
        if not text:
            return set()
        # 按非字母数字汉字分割
        tokens = re.findall(r"[\w\u4e00-\u9fff]+", text.lower())
        keywords: set[str] = set()
        for tok in tokens:
            tok = tok.strip()
            if len(tok) < _KEYWORD_MIN_LEN:
                continue
            if tok.isdigit():
                continue
            keywords.add(tok)
            if len(keywords) >= _KEYWORD_MAX_PER_DOC:
                break
        return keywords

    def _keyword_overlap(self, text_a: str, text_b: str) -> int:
        """计算两条文本的关键词重叠数。"""
        kw_a = self._extract_keywords(text_a)
        kw_b = self._extract_keywords(text_b)
        if not kw_a or not kw_b:
            return 0
        return len(kw_a & kw_b)


# 全局单例(与 active_forgetter / meta_learner 风格一致)
metacognition = Metacognition()
