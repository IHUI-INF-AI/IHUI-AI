# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""任务经验沉淀抽取器(2-1c,2026-09-10 立)。

从 Agent 任务对话中提炼可复用的知识卡片(任务经验/项目事实/最佳实践/踩坑记录),
经 LLM 抽取后写入 apps/api 的 knowledge_cards 表(source='agent'),
与手动录入(2-1b 前端)、knowledge_lookup 检索(本任务 2-1c-3)构成经验复用闭环:

    任务对话 → LLM 抽取 ──→ 写卡(HTTP POST /api/knowledge-cards/,X-Internal-Secret)
                                    ↓
    同仓库后续任务 ← knowledge_lookup 注入(knowledge_cards 源,GET /search)

设计原则(对标 memory_extractor):
- LLM 失败降级返回空列表,不抛错;写卡失败降级跳过该卡,不阻塞其余卡片
- 容错 JSON 解析(剥 ```json 围栏 → 数组正则 → 对象 extracted 字段兜底)
- 字段标准化(kind 白名单 / tags 清洗截断 / confidence 0-1 → 0-100 整数)

V3 #76(2026-09-28)补的那一节:上面这套抽取器此前**生产面零调用方**(函数在、
没有一条路走到它)。自动蒸馏的入口现在是本文件末尾的
`schedule_distillation_from_conversation`,v1/v2 执行循环共用同一份 gating ——
见该函数注释。跳过时必打日志,"安静地什么都没做"就是这一型缺陷原本的样子。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

# 卡片类型白名单(与 api 侧 knowledge-card.ts cardKindSchema 对齐)
_VALID_KINDS = {"experience", "fact", "practices", "pitfall"}

# 单条消息截断长度(prompt token 控制,同 memory_extractor)
_MAX_MSG_CHARS = 500
# 对话整体截断长度
_MAX_CONVO_CHARS = 4000
# 少于这么多次交互不值得起一次 LLM 调用(一问一答几乎提炼不出"可复用经验",
# 却要为每次真实请求付一次 token —— 自动蒸馏必须自带成本闸门,否则每句话都烧一次)
_MIN_MESSAGES_FOR_DISTILLATION = 4

# 未拿到调用方 pending 集合时,task 的强引用放这里。
# 不是防御性冗余 —— `asyncio.create_task` 的返回值如果不被任何地方持有,事件循环
# 只握弱引用,任务可能在跑到一半时被 GC 掉(CPython asyncio 文档明写的陷阱),
# 表现正是"蒸馏偶尔什么都没发生且无任何报错"。调用方给了集合就用调用方的,
# 不给就由本模块持有到完成,绝不因为"没人传集合"而让任务裸奔。
_self_held_tasks: set[asyncio.Task[Any]] = set()


class KnowledgeCardExtractor:
    """从任务对话中抽取知识卡片并写库。"""

    # 卡片类型 → 中文说明(喂给 LLM 的 prompt 用)
    _KIND_HINTS = {
        "experience": "任务经验(完成某类任务的可复用做法/步骤/方法)",
        "fact": "项目事实(架构/约定/依赖/环境约束)",
        "practices": "最佳实践(本仓库验证有效的规范做法)",
        "pitfall": "踩坑记录(遇到的问题 + 根因 + 解决办法)",
    }

    async def extract_and_save(
        self,
        messages: list[dict[str, Any]] | dict[str, Any],
        repo_name: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """从任务对话中抽取知识卡片并写入 knowledge_cards 表。

        Args:
            messages:   对话消息列表 [{role, content}],或单 dict 调用
                        {messages, repoName, userId, sessionId}(键名兼容驼峰)
            repo_name:  仓库名(卡片绑定维度)
            user_id:    归属用户(缺省写全局卡 userId=NULL,所有登录用户可见)
            session_id: 会话 ID(可选,记入卡片 context 便于溯源)

        Returns:
            {"extracted": [标准化后的卡片...], "saved": [api 返回的落库行...],
             "durationMs": int}
            LLM 失败 → extracted=[];写卡失败的卡片不进 saved,均不抛错。
        """
        start = time.time()

        # 兼容单 dict 调用
        if isinstance(messages, dict):
            req = messages
            messages = req.get("messages", []) or []
            repo_name = str(req.get("repoName") or req.get("repo_name") or repo_name)
            user_id = req.get("userId") or req.get("user_id") or user_id
            session_id = req.get("sessionId") or req.get("session_id") or session_id

        if not messages or not repo_name:
            return {
                "extracted": [],
                "saved": [],
                "durationMs": int((time.time() - start) * 1000),
            }

        # 1. LLM 抽取(失败降级空列表)
        cards = await self._llm_extract(messages, repo_name)

        # 2. 逐卡写库(单卡失败跳过,不阻塞其余)
        saved: list[dict[str, Any]] = []
        for card in cards:
            row = await self._save_card(card, repo_name, user_id=user_id, session_id=session_id)
            if row is not None:
                saved.append(row)

        if cards:
            logger.info(
                "[knowledge_card_extractor] 仓库 %s 抽取 %d 卡,落库 %d",
                repo_name,
                len(cards),
                len(saved),
            )

        return {
            "extracted": cards,
            "saved": saved,
            "durationMs": int((time.time() - start) * 1000),
        }

    async def _llm_extract(
        self,
        messages: list[dict[str, Any]],
        repo_name: str,
    ) -> list[dict[str, Any]]:
        """调 LLM 从任务对话中抽取知识卡片,返回标准化后的卡片列表。失败返回空列表。"""
        # 构建对话文本(控制 token,过长则截断,同 memory_extractor 策略)
        convo_lines: list[str] = []
        for idx, msg in enumerate(messages):
            role = str(msg.get("role", "user"))
            content = str(msg.get("content", ""))
            if not content:
                continue
            if len(content) > _MAX_MSG_CHARS:
                content = content[:_MAX_MSG_CHARS] + "..."
            convo_lines.append(f"[{idx}] {role}: {content}")
        convo_text = "\n".join(convo_lines)
        if len(convo_text) > _MAX_CONVO_CHARS:
            convo_text = convo_text[:_MAX_CONVO_CHARS] + "\n...(已截断)"

        kind_hints = "\n".join(
            f"- {k}: {desc}" for k, desc in self._KIND_HINTS.items()
        )
        prompt = (
            "你是任务经验沉淀助手。从下面的任务对话中提炼可复用的知识卡片,"
            f"沉淀到仓库「{repo_name}」。\n"
            "卡片类型:\n"
            f"{kind_hints}\n\n"
            "任务对话:\n"
            f"{convo_text}\n\n"
            "请输出 JSON 数组,每个元素格式:\n"
            '{"kind": "experience|fact|practices|pitfall", '
            '"title": "一句话标题(概括卡片要点)", '
            '"content": "卡片正文(markdown,含可操作细节:做法/步骤/根因/解法)", '
            '"tags": ["检索标签"], '
            '"confidence": 0.0-1.0}\n\n'
            "只输出 JSON 数组,不要额外解释。若无值得沉淀的经验,输出 []。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_extract_output(content)
        except Exception as e:
            logger.warning(
                "knowledge_card_extractor._llm_extract LLM 抽取失败: %s", e, exc_info=True
            )
            return []

    @staticmethod
    def _parse_extract_output(content: str) -> list[dict[str, Any]]:
        """解析 LLM 输出为标准化卡片列表(容错,复用 memory_extractor 模式)。

        优先提取 JSON 数组,其次提取 JSON 对象中的 extracted/cards 字段;
        每条标准化:kind 白名单校验、title/content 去空白、tags 清洗截断、
        confidence 0-1 浮点 → 0-100 整数。
        """
        if not content:
            return []
        # 去除 ```json 包裹
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        # 优先尝试 JSON 数组
        raw_items: list[Any] = []
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if arr_match:
            try:
                arr = json.loads(arr_match.group())
                if isinstance(arr, list):
                    raw_items = arr
            except (json.JSONDecodeError, TypeError):
                pass
        # 兜底:JSON 对象中的 extracted / cards 字段
        if not raw_items:
            obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if obj_match:
                try:
                    obj = json.loads(obj_match.group())
                    if isinstance(obj, dict):
                        for key in ("extracted", "cards"):
                            field = obj.get(key)
                            if isinstance(field, list):
                                raw_items = field
                                break
                except (json.JSONDecodeError, TypeError):
                    pass

        cards: list[dict[str, Any]] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            card = KnowledgeCardExtractor._normalize_card(item)
            if card is not None:
                cards.append(card)
        return cards

    @staticmethod
    def _normalize_card(item: dict[str, Any]) -> dict[str, Any] | None:
        """标准化单张卡片:字段校验 + 清洗。无 title 或 content → 返回 None(丢弃)。"""
        title = str(item.get("title", "")).strip()
        content = str(item.get("content", "")).strip()
        if not title or not content:
            return None

        kind = str(item.get("kind", "experience")).strip().lower()
        if kind not in _VALID_KINDS:
            kind = "experience"

        # tags 清洗:字符串条目 → strip → 去空 → 截断 20 个,单个 ≤50 字符
        raw_tags = item.get("tags")
        tags: list[str] = []
        if isinstance(raw_tags, list):
            tags = [t[:50] for t in (str(x).strip() for x in raw_tags) if t][:20]

        # confidence:LLM 自评 0.0-1.0 → 0-100 整数(非法值回退 80)
        try:
            conf = float(item.get("confidence", 0.8))
        except (TypeError, ValueError):
            conf = 0.8
        confidence = max(0, min(100, int(round(conf * 100))))

        return {
            "kind": kind,
            "title": title[:300],
            "content": content[:20_000],
            "tags": tags,
            "confidence": confidence,
        }

    async def _save_card(
        self,
        card: dict[str, Any],
        repo_name: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any] | None:
        """写单张卡片到 apps/api(source=agent,内部密钥认证)。失败返回 None。"""
        from ..core.config import settings
        from .api_client import get_api_client

        payload: dict[str, Any] = {
            "repoName": repo_name,
            "kind": card["kind"],
            "title": card["title"],
            "content": card["content"],
            "tags": card["tags"],
            "confidence": card["confidence"],
        }
        if user_id:
            payload["userId"] = user_id
        # 结构化上下文:票面要求的"三维元数据"里,来源与置信已各有第一等字段
        # (api 侧 source='agent' / confidence 0-100),时效没有列可落 ——
        # knowledge_cards 表无 distilled_at 列,加列属迁移动作(本票禁改 drizzle),
        # 故按既有自由结构 context 记 ISO 时间戳。**不得**把这里读成"时效已有列"。
        payload["context"] = {
            "source": "agent",
            "distilledAt": datetime.now(UTC).isoformat(),
            **({"sessionId": session_id} if session_id else {}),
        }

        try:
            client = get_api_client()
            resp = await client.post(
                f"{settings.api_service_url}/api/knowledge-cards/",
                json=payload,
                headers={"X-Internal-Secret": settings.ai_callback_secret},
            )
            resp.raise_for_status()
            body = resp.json()
            if isinstance(body, dict) and body.get("code") == 0:
                data = body.get("data")
                if isinstance(data, dict):
                    return data
            logger.warning(
                "[knowledge_card_extractor] 写卡响应异常(跳过): %s", body
            )
            return None
        except Exception as e:
            logger.warning(
                "[knowledge_card_extractor] 写卡失败(降级跳过): %s", e, exc_info=True
            )
            return None


# 模块级单例(与 memory_extractor 等服务同风格)
knowledge_card_extractor = KnowledgeCardExtractor()


# =============================================================================
# 自动蒸馏入口(V3 #76,2026-09-28 立)
# =============================================================================
#
# 本文件此前的状态是"生成器写完了、生产面零调用方":`extract_and_save` 之外没有任何
# 一处代码引用过这个模块(取证见交付报告 —— 全仓 grep 只有本文件自身与两条把它当
# "命名先例"提及的注释)。这正是本仓反复出现的"造好没装车"型:功能在、测试绿、
# 运行时永不发生。下面这组函数就是那节"装车"接线,并且刻意做成**唯一出口**:
# v1 / v2 两个执行循环都调用同一个 `schedule_distillation_from_conversation`,
# 不得在端内各写一遍 gating —— 两份 gating 必然漂移(图谱抽取那处就有过两份同形分支)。


def resolve_repo_name(explicit: str | None = None) -> str:
    """确定卡片归属仓库:运行显式声明 > 部署级默认 > 空(空即跳过,不猜)。

    部署级默认**只有一个来源**:`settings.knowledge_card_default_repo`
    (pydantic-settings 已把 env 的 `KNOWLEDGE_CARD_DEFAULT_REPO` 映射到它)。
    这里刻意不再读第二个环境变量名 —— 本仓记过两次"代码自己读 os.environ,
    于是 .env 那条永远读不到"的同类缺陷(config.py 的 COMBO_CHAINS 注释即其一),
    一个配置两个入口迟早不同形。
    """
    name = (explicit or "").strip()
    if name:
        return name[:200]
    from ..core.config import settings

    return (settings.knowledge_card_default_repo or "").strip()[:200]


def should_distill(
    *,
    repo_name: str,
    message_count: int,
    enabled: bool,
) -> tuple[bool, str]:
    """纯判据:该不该为这次会话起一次蒸馏。返回 (是否起, 原因)。

    把判据单列成纯函数而不是埋在调度里,是为了让"为什么没蒸馏"这件事可被测、可读 ——
    自动功能最坏的失效形态不是报错,而是安静地什么都没做。
    """
    if not enabled:
        return False, "开关已关停(auto_knowledge_card_extract_enabled=false)"
    if not repo_name:
        return False, (
            "无法确定归属仓库:运行未声明 repoName 且部署未配 knowledge_card_default_repo"
            "(卡片必须绑定仓库,猜测会把经验挂到别的仓库上)"
        )
    if message_count < _MIN_MESSAGES_FOR_DISTILLATION:
        return False, f"消息数 {message_count} < {_MIN_MESSAGES_FOR_DISTILLATION},不值得起一次 LLM"
    return True, f"仓库 {repo_name} 命中,起一次会话蒸馏"


def schedule_distillation_from_conversation(
    messages: list[dict[str, Any]],
    *,
    repo_name: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    conversation_length: int | None = None,
    pending_tasks: set[asyncio.Task[Any]] | None = None,
) -> asyncio.Task[Any] | None:
    """会话结束时的 fire-and-forget 蒸馏出口(v1/v2 执行循环共用这一份)。

    Args:
        messages: 要喂给 LLM 的那一批消息(调用方决定窗口;本函数不截断)。
        repo_name: 归属仓库;为空时回落到部署级默认,仍为空即跳过(见 `should_distill`)。
        user_id: 卡片归属用户;缺省时 api 侧写成全局卡(userId=NULL)。
        session_id: 会话 ID,记进 card.context 便于溯源。
        conversation_length: **整场**会话的消息数,只用于"值不值得起一次 LLM"的闸门。
            传窗口时必须一起传它 —— 否则一场 40 轮的会话只看窗口里的 8 条,
            闸门判的就不是"这次会话有多长",而是"我截了多短"。缺省取 len(messages)。
        pending_tasks: 调用方的在飞任务集合(与 agent_loop 里 `_pending_tasks` 同一套
            登记口径);给就登记,不给就只靠 done_callback 打异常,不各造一份注册表。

    Returns:
        创建的 Task,或 None(判据不通过 / 无运行中事件循环)。跳过一定打日志,
        不静默返回。
    """
    from ..core.config import settings

    resolved_repo = resolve_repo_name(repo_name)
    gate_length = (
        conversation_length if conversation_length is not None else len(messages or [])
    )
    ok, reason = should_distill(
        repo_name=resolved_repo,
        message_count=gate_length,
        enabled=bool(settings.auto_knowledge_card_extract_enabled),
    )
    if not ok:
        logger.info(
            "[knowledge_card_distill] 跳过蒸馏(user=%s session=%s):%s",
            user_id,
            session_id,
            reason,
        )
        return None

    try:
        task = asyncio.create_task(
            knowledge_card_extractor.extract_and_save(
                messages,
                resolved_repo,
                user_id=user_id,
                session_id=session_id,
            )
        )
    except RuntimeError as e:
        # 无运行中事件循环(同步上下文调用)—— 这不是"该跳过",是调用点写错了,
        # 必须 WARN 而不是静默 None,否则这型缺陷只表现为"功能没生效"。
        logger.warning("[knowledge_card_distill] 无法起任务(无事件循环?)%s", e)
        return None

    if pending_tasks is not None:
        pending_tasks.add(task)
        task.add_done_callback(pending_tasks.discard)
    else:
        # 调用方没有登记集合:本模块替它持有强引用,直到任务完成(见上面注释)
        _self_held_tasks.add(task)
        task.add_done_callback(_self_held_tasks.discard)

    def _log_result(finished: asyncio.Task[Any]) -> None:
        """收尾记账:异常/取消都必须留痕,但绝不在回调里再抛一次。

        done_callback 里抛异常会被 asyncio 打成"Exception in callback"噪声,
        而且真正的失败原因(下面这两条日志)反而被埋。
        """
        if finished.cancelled():
            logger.warning("[knowledge_card_distill] 蒸馏任务被取消(未落库)")
            return
        exc = finished.exception()
        if exc is not None:
            logger.warning(
                "[knowledge_card_distill] 蒸馏任务异常(已降级,不影响主流程): %s", exc
            )
            return
        outcome = finished.result()
        extracted = outcome.get("extracted") if isinstance(outcome, dict) else None
        saved = outcome.get("saved") if isinstance(outcome, dict) else None
        logger.info(
            "[knowledge_card_distill] 完成 repo=%s 抽取 %d 张 / 落库 %d 张",
            resolved_repo,
            len(extracted or []),
            len(saved or []),
        )

    task.add_done_callback(_log_result)
    return task
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
