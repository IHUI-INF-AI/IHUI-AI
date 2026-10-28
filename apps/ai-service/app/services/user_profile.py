# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""用户画像建模(对标 Hermes Agent 用户画像)。

基于记忆聚合用户画像,按 5 维度分类:
- preference:           偏好(技术栈/工具/风格)
- expertise:            专业能力
- communication_style:  沟通风格
- workflow:             工作流习惯
- domain:               领域知识

画像生成优先用 LLM 归纳;LLM 失败时降级为按记忆 type 字段简单分类。
返回格式严格对齐 packages/types 的 UserProfileAggregate 契约。

L2-4(2026-07-25 立):画像聚合持久化到 PostgreSQL(agent_user_profile 表),
进程重启不丢失。启动时由 lifespan 调 load_all_profiles() 全量 hydrate,
运行时 build_profile / update_profile 增量 UPSERT 同步。
DB 异常降级:仅写内存,不阻塞主流程。
"""

import asyncio
import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

import asyncpg

from ..core.db_pool import get_shared_pool
from ._load_lifecycle import (
    DECISION_BACKOFF as _DECISION_BACKOFF,
)
from ._load_lifecycle import (
    DECISION_GAVE_UP as _DECISION_GAVE_UP,
)
from ._load_lifecycle import (
    DECISION_LOADED as _DECISION_LOADED,
)
from ._load_lifecycle import (
    STATE_GAVE_UP as _STATE_GAVE_UP,
)
from ._load_lifecycle import (
    STATE_LOADED as _STATE_LOADED,
)
from ._load_lifecycle import (
    STATE_NEVER_TRIED as _STATE_NEVER_TRIED,
)
from ._load_lifecycle import (
    STATE_RETRY_BACKOFF as _STATE_RETRY_BACKOFF,
)
from ._load_lifecycle import (
    LoadRecord,
)
from ._load_lifecycle import (
    monotonic as _monotonic,
)
from ._load_lifecycle import (
    state_label as _load_state_label,
)

logger = logging.getLogger(__name__)

# 5 维度(对齐 agent-runtime.ts UserProfileDimension)
_DIMENSIONS = (
    "preference",
    "expertise",
    "communication_style",
    "workflow",
    "domain",
)

# 记忆 type → 画像维度(降级分类映射)
_TYPE_TO_DIMENSION: dict[str, str] = {
    "preference": "preference",
    "feedback": "preference",       # 用户反馈归入偏好维度
    "convention": "workflow",       # 项目约定归入工作流
    "decision": "domain",           # 历史决策归入领域知识
    "fact": "expertise",            # 事实信息归入专业能力
}


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容)。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


def _parse_uuid(user_id: str) -> Any:
    """解析 user_id 为 UUID 对象(asyncpg 需要),失败返回 None。"""
    if not user_id:
        return None
    try:
        import uuid as _uuid
        return _uuid.UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        return None


class UserProfileBuilder:
    """基于记忆聚合用户画像。

    L2-4:画像聚合持久化到 agent_user_profile 表,重启不丢失。
    """

    def __init__(self, memory_client: Any = None) -> None:
        # 构造时可选传 memory_client(兼容 MemorySystem 现有调用)
        self._client = memory_client
        # 画像缓存:user_id -> UserProfileAggregate
        self._profiles: dict[str, dict[str, Any]] = {}
        # P1 修复:按需懒加载,替代 main.py startup 全量 hydrate
        # G-748(2026-09-29):原来的 `_loaded_users: set[str]` 只能表达"加载过",
        # 表达不了"试过了但没读到" —— 而 `finally: add(user_id)` 正是把后者写成前者
        # 的那一型。换成 per-key 的 LoadRecord(判定住在 _load_lifecycle,唯一一份)。
        self._load_records: dict[str, LoadRecord] = {}
        self._loaded_lock: asyncio.Lock = asyncio.Lock()

    # ==================================================================
    # P1 修复:按需懒加载(替代启动时全量 hydrate)
    # ==================================================================

    async def _ensure_loaded(self, user_id: str) -> None:
        """按需加载单个用户画像(首次访问时触发,替代启动时全量 hydrate)。

        P1 修复:原 main.py lifespan 调 load_all_profiles() 全量加载所有用户画像,
        导致启动慢 + 内存峰值高。改为首次访问该用户时调用 load_profile
        只加载该用户的画像。

        线程安全:asyncio.Lock 防止并发首次访问重复加载同一用户。

        G-748(2026-09-29,取代旧口径"加载失败也标记为已加载、从此不再重试"):
        旧写法把该用户的一次瞬时 DB 故障永久固化成"这个用户没有画像"且余生不再重试
        —— 与 G-702 在 ab_test_tracker 上修掉的那一处同型。判定住在 _load_lifecycle
        (唯一一份):读成功(含"该行不存在"这种权威的空)才固化;读失败不置 loaded,
        指数退避(底 1s 封顶 60s),连续失败到上限才停自动重试且仍非 loaded。
        """
        if not user_id:
            return
        rec = self._load_records.get(user_id)
        if rec is not None and rec.loaded:
            return
        async with self._loaded_lock:
            # double-check:拿到锁后再次确认(可能在等锁期间被其他协程加载)
            rec = self._load_records.setdefault(user_id, LoadRecord())
            now = _monotonic()
            decision = rec.decide(now)
            if decision == _DECISION_LOADED:
                return
            if decision == _DECISION_GAVE_UP:
                if not rec.give_up_logged:
                    rec.give_up_logged = True
                    logger.warning(
                        "[user_profile] _ensure_loaded 连续 %d 次读取失败,停止自动重试"
                        "(user=%s 状态=读不到,非无画像;恢复靠下一次进程重启或人工触发)",
                        rec.failures,
                        user_id,
                    )
                return
            if decision == _DECISION_BACKOFF:
                return  # 退避窗口内:本次调用不打 DB
            ok, _profile = await self._try_load_profile(user_id)
            if ok:
                rec.apply_success()
            else:
                rec.apply_failure(now)

    # ==================================================================
    # 状态查询(G-759:loadState 对外投影)
    # ==================================================================

    def get_status(self) -> dict[str, Any]:
        """返回用户画像的加载生命周期投影(供运维/状态出口读)。

        G-759(2026-10-03):G-748 把"读失败也固化"收回了同一份判据
        (_load_lifecycle.state_label),但本模块**没有对外出口** ——
        上面 :141 那条 give_up warning 只有日志,运维读不到"有哪些用户的画像读不到、
        哪些已经放弃自动重试"。本方法补这一层。

        ① **形态差异:per-key 字典,不是单例标量。**
        meta_learner / federated_learner / ab_test_tracker 是**单例标量**
        (`_loaded: bool` / `_load_failures: int`);本模块的载体是
        `self._load_records: dict[str, LoadRecord]`(per user_id,见 :103 与 :132),
        "有没有人在放弃"这件事**只对 per-key 才有意义** —— 单例只有一个状态,
        不存在"最坏档"。所以本投影按"全库聚合"给,而不是逐 user_id 展开
        (展开等于把 user_id 全量吐进状态面,既读不出严重度、又放大响应体)。

        ② **投影形状与依据。**
        - `loadState` = **最坏档**(severity 取最高:never_tried < loaded <
          retry_backoff < gave_up)。依据:运维的问题是"有没有人在放弃",不是
          "平均处于什么档";取最坏档让 give_up 永远压过 retry_backoff 与
          loaded,一眼可判。**取值域仍是 _load_lifecycle 的四档**,不新增第五档
          (crash-loop-stopped 属崩溃预算,是另一域,见 tests/test_crash_budget_b76.py)。
        - `allKeysLoaded` / `maxLoadFailures`:⚠️ **刻意不用 `loaded` /
          `loadFailures` 这两个单例族键名**。同名不同义是最坏的下游陷阱:单例族的
          `loaded` 是"**我这一次**读到没有",本模块若也用 `loaded` 却表达
          "**所有 user_id** 都读到没有",两者在"该值随哪个主体变化"上根本不同
          —— 部分 key 读不到时单例读法会以为"读到了"。故改名并把口径写进键名:
          - `allKeysLoaded` = **全称**:全部 key 都已固化。空字典时为 False
            (见下面那条显式分支);部分 key 读不到时为 False。
          - `maxLoadFailures` = 各 key 失败次数的**最大值**(与 loadState 的
            取最坏口径同向;不用 sum —— sum 会让"一个 key 挂 5 次"与
            "五个 key 各挂 1 次"不可比,而这两种严重度完全不同)。
          逐 key 精确值走 `loadStateByUser`,这里不假装只有一个标量。
        - `loadStateByUser`:per-key 明细(user_id → 那一档),供定位到人。
        - `gaveUpKeys`:已放弃自动重试的 user_id 清单(最需要人工介入的那批)。
        - `trackedKeys` / `loadedKeys`:分母与分子,让 `allKeysLoaded` 的全称可核对。
          **刻意不报 `_profiles` 规模**:`_profiles` 是全用户混在一起的画像缓存,报它会
          诱导下游把"某用户读不到"读成"全库没有画像"—— 正是本票要修的歧义。

        ③ **本族无 `_load_state()`,但有另一义的 `load_profile()`。**
        已逐行核过:本文件**没有** `_load_state()`(memory_decay:499 那类同形方法在此
        不存在),故无同形伪命中。真正需要声明的是 :500 `async def load_profile(
        self, user_id)`:它是**另一义** —— 按 user_id 取**画像内容**的出口,返回
        `dict | None`,且其 docstring 已写明"返回 None **分不出**'无画像'与'读不到'"。
        它讲的是"画像是什么",本投影讲的是"画像读到了没有";本方法**不改它、不从它
        派生任何字段**。`grep loadState` 会在它附近伪命中(`load_profile` 字面近),
        那是另一义,不要按本投影读它。

        四态词汇只有一份实现,本模块**不写死任何四档字面量**;最坏档的比较用
        共享常量,单档判定转发 LoadRecord.state_label()。
        """
        by_user: dict[str, str] = {
            user_id: rec.state_label() for user_id, rec in self._load_records.items()
        }
        # 最坏档:用共享常量定 severity,不给四档字面量(见上)。
        _severity = {
            _STATE_NEVER_TRIED: 0,
            _STATE_LOADED: 1,
            _STATE_RETRY_BACKOFF: 2,
            _STATE_GAVE_UP: 3,
        }
        # 没有任何 key 时:_load_records 为空 ⇒ 从未尝试过(不是"全部已加载")。
        # 这一分支必须显式落定,否则空库会被下面的 all() 读成 loaded。
        if not by_user:
            worst = _load_state_label(loaded=False, failures=0)
        else:
            worst = max(by_user.values(), key=lambda label: _severity[label])
        loaded_keys = [uid for uid, label in by_user.items() if label == _STATE_LOADED]
        return {
            "loadState": worst,
            # ⚠️ 聚合口径(非单例族的"我这一次"):全称 / 最坏值。见 docstring ②。
            "allKeysLoaded": len(loaded_keys) == len(by_user) and bool(by_user),
            "maxLoadFailures": max(
                (rec.failures for rec in self._load_records.values()),
                default=0,
            ),
            "loadStateByUser": dict(sorted(by_user.items())),
            "gaveUpKeys": sorted(
                uid for uid, label in by_user.items() if label == _STATE_GAVE_UP
            ),
            "trackedKeys": len(by_user),
            "loadedKeys": len(loaded_keys),
        }

    # ==================================================================
    # 全量画像构建
    # ==================================================================

    async def build_profile(
        self,
        user_id: str,
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """基于用户所有记忆构建画像(全量)。

        Args:
            user_id:       用户 ID
            memory_client: UnifiedMemoryClient(可选,未传则用构造时的)

        Returns:
            UserProfileAggregate 字典:
            {userId, entries: [UserProfileEntry], totalMemories, completeness, updatedAt}
        """
        # P1 修复:build_profile 会全量重建并覆盖缓存,预先标记已加载
        # 避免 build_profile 后 update_profile 的 _ensure_loaded 用 DB 旧数据覆盖新画像
        # G-748:这是"缓存刚被本进程写全"的正当固化,走共享出口的 mark_loaded
        # (失败计数与退避一并归零),不是"读失败也当加载完"。
        if user_id:
            self._load_records.setdefault(user_id, LoadRecord()).mark_loaded()
        client = memory_client or self._client
        entries = await self._get_entries(user_id, client)
        if not entries:
            return self._empty_profile(user_id)

        # 优先 LLM 归纳
        llm_entries = await self._llm_build_profile(user_id, entries)
        if llm_entries:
            profile = self._assemble_profile(user_id, entries, llm_entries)
            self._profiles[user_id] = profile
            # L2-4:写穿 DB(失败不阻塞主流程)
            await self._persist_profile(user_id, profile)
            return profile

        # 降级:按记忆 type 字段简单分类
        profile = self._fallback_build_profile(user_id, entries)
        self._profiles[user_id] = profile
        # L2-4:写穿 DB(失败不阻塞主流程)
        await self._persist_profile(user_id, profile)
        return profile

    # ==================================================================
    # 增量更新画像
    # ==================================================================

    async def update_profile(
        self,
        user_id: str,
        new_memory: dict[str, Any],
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """增量更新画像(读取现有画像 + 新记忆,避免全量重建)。

        Args:
            user_id:       用户 ID
            new_memory:    新增的记忆条目
            memory_client: UnifiedMemoryClient(可选)

        Returns:
            更新后的 UserProfileAggregate 字典
        """
        # P1 修复:按需懒加载该用户画像(替代启动时全量 hydrate)
        await self._ensure_loaded(user_id)
        client = memory_client or self._client
        # 读取现有画像(缓存优先,否则全量构建)
        profile = self._profiles.get(user_id)
        if profile is None:
            return await self.build_profile(user_id, client)

        # 按降级规则确定新记忆影响的维度
        dimension = self._dimension_of(new_memory)
        memory_id = str(new_memory.get("id", ""))
        now = datetime.now(UTC).isoformat()

        # 找到对应维度的画像条目
        target_entry: dict[str, Any] | None = None
        for entry in profile.get("entries", []):
            if entry.get("dimension") == dimension:
                target_entry = entry
                break

        if target_entry is None:
            # 该维度不存在,新建
            target_entry = {
                "userId": user_id,
                "dimension": dimension,
                "content": str(new_memory.get("text", "")),
                "confidence": 0.4,
                "supportingMemoryIds": [memory_id] if memory_id else [],
                "updatedAt": now,
            }
            profile["entries"].append(target_entry)
        else:
            # 已存在:加入 supportingMemoryIds,提升 confidence
            support_ids = list(target_entry.get("supportingMemoryIds", []))
            if memory_id and memory_id not in support_ids:
                support_ids.append(memory_id)
            target_entry["supportingMemoryIds"] = support_ids
            target_entry["confidence"] = min(1.0, 0.3 + 0.15 * len(support_ids))
            target_entry["updatedAt"] = now
            # 追加新记忆内容(简短摘要)
            new_text = str(new_memory.get("text", ""))
            if new_text:
                existing_content = str(target_entry.get("content", ""))
                if new_text not in existing_content:
                    target_entry["content"] = (
                        f"{existing_content}; {new_text}"[:500]
                    )

        # 重新计算完整度 + totalMemories
        profile["totalMemories"] = int(profile.get("totalMemories", 0)) + 1
        covered = sum(
            1 for e in profile["entries"]
            if e.get("supportingMemoryIds") or e.get("content")
        )
        profile["completeness"] = round(covered / len(_DIMENSIONS), 2)
        profile["updatedAt"] = now

        self._profiles[user_id] = profile
        # L2-4:写穿 DB(失败不阻塞主流程)
        await self._persist_profile(user_id, profile)
        return profile

    # ==================================================================
    # LLM 归纳(优先)
    # ==================================================================

    async def _llm_build_profile(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """调 LLM 归纳用户画像(5 维度)。失败返回空列表。"""
        # 构建记忆摘要(控制 token)
        memory_lines: list[str] = []
        for idx, e in enumerate(entries[:50]):  # 最多 50 条
            text = str(e.get("text", ""))[:200]
            if not text:
                continue
            memory_lines.append(f"[{idx}] {text}")
        memory_text = "\n".join(memory_lines)
        if not memory_text:
            return []
        if len(memory_text) > 3000:
            memory_text = memory_text[:3000] + "\n...(已截断)"

        dims_hint = "\n".join(f"- {d}" for d in _DIMENSIONS)
        prompt = (
            "你是用户画像建模助手。基于以下用户记忆,归纳用户画像。\n"
            f"画像维度:\n{dims_hint}\n\n"
            "用户记忆:\n"
            f"{memory_text}\n\n"
            "请输出 JSON 数组,每个元素代表一个维度的画像:\n"
            '{"dimension": "维度名", '
            '"content": "该维度画像内容(陈述句)", '
            '"confidence": 0.0-1.0, '
            '"supportingMemoryIndices": [记忆索引整数]}\n\n'
            "只输出 JSON 数组,不要额外解释。若无足够信息,输出 []。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_profile_output(content, entries, user_id)
        except Exception as e:
            logger.warning("user_profile._llm_build_profile LLM 归纳失败: %s", e, exc_info=True)
            return []

    @staticmethod
    def _parse_profile_output(
        content: str,
        entries: list[dict[str, Any]],
        user_id: str,
    ) -> list[dict[str, Any]]:
        """解析 LLM 输出为 UserProfileEntry 列表(容错)。"""
        if not content:
            return []
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if not arr_match:
            return []
        try:
            arr = json.loads(arr_match.group())
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(arr, list):
            return []

        result: list[dict[str, Any]] = []
        now = datetime.now(UTC).isoformat()
        for item in arr:
            if not isinstance(item, dict):
                continue
            dimension = str(item.get("dimension", ""))
            if dimension not in _DIMENSIONS:
                continue
            # 把 indices 转成 memory ids
            indices = item.get("supportingMemoryIndices", [])
            support_ids: list[str] = []
            if isinstance(indices, list):
                for i in indices:
                    try:
                        idx = int(i)
                        if 0 <= idx < len(entries):
                            mid = str(entries[idx].get("id", ""))
                            if mid:
                                support_ids.append(mid)
                    except (ValueError, TypeError):
                        continue
            result.append({
                "userId": user_id,
                "dimension": dimension,
                "content": str(item.get("content", "")),
                "confidence": float(item.get("confidence", 0.5)),
                "supportingMemoryIds": support_ids,
                "updatedAt": now,
            })
        return result

    # ==================================================================
    # 降级:按记忆 type 字段简单分类
    # ==================================================================

    def _fallback_build_profile(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """LLM 失败降级:按记忆 type 字段分类到对应维度。"""
        now = datetime.now(UTC).isoformat()
        # dimension -> {texts, support_ids}
        grouped: dict[str, dict[str, Any]] = {d: {"texts": [], "ids": []} for d in _DIMENSIONS}

        for entry in entries:
            dim = self._dimension_of(entry)
            text = str(entry.get("text", ""))
            mid = str(entry.get("id", ""))
            if text:
                grouped[dim]["texts"].append(text)
            if mid:
                grouped[dim]["ids"].append(mid)

        profile_entries: list[dict[str, Any]] = []
        for dim in _DIMENSIONS:
            data = grouped[dim]
            if not data["texts"]:
                continue
            content = "; ".join(data["texts"])[:500]
            support_ids = data["ids"]
            confidence = min(1.0, 0.3 + 0.15 * len(support_ids))
            profile_entries.append({
                "userId": user_id,
                "dimension": dim,
                "content": content,
                "confidence": round(confidence, 2),
                "supportingMemoryIds": support_ids,
                "updatedAt": now,
            })

        return self._assemble_profile_from_entries(user_id, entries, profile_entries)

    # ==================================================================
    # 内部工具
    # ==================================================================

    @staticmethod
    def _dimension_of(memory: dict[str, Any]) -> str:
        """根据记忆 type 字段映射到画像维度(降级规则)。"""
        mtype = str(memory.get("type", "")).lower()
        return _TYPE_TO_DIMENSION.get(mtype, "preference")

    @staticmethod
    def _assemble_profile(
        user_id: str,
        entries: list[dict[str, Any]],
        profile_entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """组装 UserProfileAggregate(LLM 路径)。"""
        now = datetime.now(UTC).isoformat()
        covered = sum(1 for d in _DIMENSIONS if any(e.get("dimension") == d for e in profile_entries))
        return {
            "userId": user_id,
            "entries": profile_entries,
            "totalMemories": len(entries),
            "completeness": round(covered / len(_DIMENSIONS), 2),
            "updatedAt": now,
        }

    @staticmethod
    def _assemble_profile_from_entries(
        user_id: str,
        entries: list[dict[str, Any]],
        profile_entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """组装 UserProfileAggregate(降级路径)。"""
        now = datetime.now(UTC).isoformat()
        covered = len(profile_entries)
        return {
            "userId": user_id,
            "entries": profile_entries,
            "totalMemories": len(entries),
            "completeness": round(covered / len(_DIMENSIONS), 2),
            "updatedAt": now,
        }

    @staticmethod
    def _empty_profile(user_id: str) -> dict[str, Any]:
        """空画像(无记忆时)。"""
        now = datetime.now(UTC).isoformat()
        return {
            "userId": user_id,
            "entries": [],
            "totalMemories": 0,
            "completeness": 0.0,
            "updatedAt": now,
        }

    @staticmethod
    async def _get_entries(
        user_id: str,
        memory_client: Any,
    ) -> list[dict[str, Any]]:
        """从 memory_client 读取用户记忆(降级返回空列表)。"""
        if memory_client is None:
            return []
        try:
            if hasattr(memory_client, "get_entries"):
                result = await memory_client.get_entries(user_id, scope="user")
                return result if isinstance(result, list) else []
        except Exception as e:
            logger.warning("user_profile._get_entries 读取用户记忆失败: %s", e, exc_info=True)
        return []

    # ==================================================================
    # L2-4:持久化层(DB hydrate / UPSERT / delete)
    # ==================================================================

    async def load_profile(self, user_id: str) -> dict[str, Any] | None:
        """公开投影:读成功返回画像(或 None=该用户确实没有),读失败返回 None。

        ⚠️ 返回 None **分不出**"无画像"与"读不到"——内部判定必须走
        _try_load_profile 的二元组(G-748:口径同 ab_test_tracker.load_active_tests)。
        """
        ok, profile = await self._try_load_profile(user_id)
        return profile if ok else None

    async def _try_load_profile(self, user_id: str) -> tuple[bool, dict[str, Any] | None]:
        """从 DB 加载单个用户画像,并把"读不到"与"权威的空"分开返回。

        返回 (read_ok, profile):
        - (False, None) ⇒ 连接/查询异常,或**行存在但 JSON 解析不出** = "读不到",
          与 agent_card._scope_meta_index 对损坏文件的判定同形,**不得**固化成"无画像";
        - (True, None)  ⇒ 该 id 无画像行(或 id 为空/非 UUID,DB 里不可能有它)=
          **权威的空**,可以固化;
        - (True, dict)  ⇒ 读到画像。
        失败不抛(调用方按 read_ok 决定退避)。

        Args:
            user_id: 用户 ID
        """
        if not user_id:
            return True, None
        user_uuid = _parse_uuid(user_id)
        if user_uuid is None:
            return True, None
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """SELECT profile::text FROM agent_user_profile WHERE user_id = $1""",
                    user_uuid,
                )
        except Exception as e:
            logger.warning(
                "[user_profile] _try_load_profile 读取失败(user=%s,不固化为无画像): %s",
                user_id, e,
            )
            return False, None
        if not row:
            return True, None  # 权威的空:该用户还没有画像行
        try:
            profile = json.loads(row["profile"])
            if isinstance(profile, dict):
                self._profiles[user_id] = profile
                return True, profile
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning(
                "[user_profile] _try_load_profile JSON 解析失败(user=%s): %s",
                user_id, e,
            )
        # 行在、内容读不出来 ⇒ 算"读不到"(不得固化成"这个用户没有画像")
        return False, None

    async def load_all_profiles(self, limit: int = 1000) -> int:
        """启动时从 DB 全量 hydrate 用户画像到内存。

        由 main.py lifespan 调用,失败不阻塞启动(返回 0 + warning)。
        limit 默认 1000,防止超大用户量一次性加载爆内存。

        Args:
            limit: 最大加载条数(默认 1000)

        Returns:
            加载到内存的画像条数
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT user_id::text, profile::text FROM agent_user_profile
                       ORDER BY updated_at DESC LIMIT $1""",
                    limit,
                )
        except Exception as e:
            logger.warning("[user_profile] load_all_profiles 失败(降级空内存): %s", e)
            return 0
        count = 0
        for row in rows:
            user_id = str(row["user_id"])
            if not user_id:
                continue
            try:
                profile = json.loads(row["profile"])
                if isinstance(profile, dict):
                    self._profiles[user_id] = profile
                    count += 1
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    "[user_profile] load_all_profiles JSON 解析失败(user=%s): %s",
                    user_id, e,
                )
        return count

    async def _persist_profile(
        self,
        user_id: str,
        profile: dict[str, Any],
    ) -> None:
        """UPSERT 单个用户画像到 DB(失败不抛错,仅 warning)。

        Args:
            user_id:  用户 ID
            profile:  UserProfileAggregate 字典
        """
        if not user_id:
            return
        user_uuid = _parse_uuid(user_id)
        if user_uuid is None:
            # user_id 不是合法 UUID,跳过持久化(只写内存)
            return
        try:
            completeness = float(profile.get("completeness", 0.0))
            total_memories = int(profile.get("totalMemories", 0))
            profile_json = json.dumps(profile, ensure_ascii=False, default=str)
            snippet = self._build_system_prompt_snippet_from_profile(profile)

            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO agent_user_profile
                           (user_id, completeness, total_memories, profile,
                            system_prompt_snippet)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (user_id) DO UPDATE SET
                           completeness = EXCLUDED.completeness,
                           total_memories = EXCLUDED.total_memories,
                           profile = EXCLUDED.profile,
                           system_prompt_snippet = EXCLUDED.system_prompt_snippet,
                           updated_at = NOW()""",
                    user_uuid,
                    completeness,
                    total_memories,
                    profile_json,
                    snippet,
                )
        except Exception as e:
            logger.warning(
                "[user_profile] _persist_profile 失败(user=%s 降级仅写内存): %s",
                user_id, e,
            )

    async def delete_profile(self, user_id: str) -> bool:
        """从 DB 删除用户画像(用于用户注销 / GDPR 清理)。

        Args:
            user_id: 用户 ID

        Returns:
            True 表示删除成功(或内存已清除),False 表示失败
        """
        if not user_id:
            return False
        # 内存清除
        self._profiles.pop(user_id, None)
        user_uuid = _parse_uuid(user_id)
        if user_uuid is None:
            return True  # 内存已清除,无 DB 记录
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """DELETE FROM agent_user_profile WHERE user_id = $1""",
                    user_uuid,
                )
            return True
        except Exception as e:
            logger.warning(
                "[user_profile] delete_profile 失败(user=%s,内存已清): %s",
                user_id, e,
            )
            return False

    # ==================================================================
    # L2-4:System prompt 注入(供 AgentLoop 调用)
    # ==================================================================

    def get_cached_profile(self, user_id: str) -> dict[str, Any] | None:
        """读取内存缓存的画像(同步,不查 DB)。

        供 AgentLoop 同步上下文使用,避免每次请求都查 DB。
        内存未命中时返回 None,调用方应主动调 load_profile 或 build_profile。
        """
        if not user_id:
            return None
        return self._profiles.get(user_id)

    def build_system_prompt_snippet(self, user_id: str) -> str:
        """根据内存缓存的画像构建 system prompt 片段(同步,无 DB 查询)。

        供 AgentLoop 注入到 system prompt,让 LLM 知道用户偏好 / 专业能力 / 沟通风格等。
        若内存无缓存 → 返回空字符串(调用方应预先 load_profile)。

        Args:
            user_id: 用户 ID

        Returns:
            system prompt 片段(多行字符串),或空字符串
        """
        profile = self._profiles.get(user_id)
        if not profile:
            return ""
        return self._build_system_prompt_snippet_from_profile(profile)

    @staticmethod
    def _build_system_prompt_snippet_from_profile(profile: dict[str, Any]) -> str:
        """从画像聚合构建 system prompt 片段(紧凑 + 严格 ≤ 800 字符)。

        格式:
          ## 用户画像
          - 偏好: ...
          - 专业能力: ...
          - 沟通风格: ...
          - 工作流: ...
          - 领域知识: ...

        Args:
            profile: UserProfileAggregate 字典

        Returns:
            system prompt 片段(多行字符串,≤ 800 字符)
        """
        entries = profile.get("entries", [])
        if not entries:
            return ""
        # 维度中文标签
        dim_labels = {
            "preference": "偏好",
            "expertise": "专业能力",
            "communication_style": "沟通风格",
            "workflow": "工作流",
            "domain": "领域知识",
        }
        lines = ["## 用户画像"]
        for entry in entries:
            dim = str(entry.get("dimension", ""))
            label = dim_labels.get(dim, dim)
            content = str(entry.get("content", "")).strip()
            if not content:
                continue
            # 每条内容限制 150 字符,避免 prompt 过长
            if len(content) > 150:
                content = content[:147] + "..."
            confidence = float(entry.get("confidence", 0.5))
            # confidence < 0.3 的低置信度画像不注入(避免噪声)
            if confidence < 0.3:
                continue
            lines.append(f"- {label}: {content}")
        snippet = "\n".join(lines)
        # 总长度限制 800 字符(防止 prompt 过长)
        if len(snippet) > 800:
            snippet = snippet[:797] + "..."
        return snippet


# 单例(与 dream_scheduler / memory_decay_manager 风格一致)
user_profile_builder = UserProfileBuilder()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
