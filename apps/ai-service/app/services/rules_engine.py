"""Rules 引擎 — 用户可编辑的规则集,约束 agent 运行时行为。

对标 Trae IDE 的 Rules:用户自定义规则在 agent 运行时动态加载,
按匹配条件注入到 system prompt 末尾。与 AGENTS.md(项目级强制规则)互补:
AGENTS.md 是人读 + 守门脚本执行,Rule 是 agent 运行时动态加载。

存储:文件系统(.trae-cn/rules/*.md frontmatter + 正文),不走数据库(轻量)。
支持热加载:目录 mtime 变化时自动 reload。

匹配算法:
  - always:  无条件注入 system prompt
  - keyword: message.includes(keyword) 任一命中即注入
  - regex:   re.search(pattern, message) 命中注入
  - semantic: llm_gateway.embed() 生成 embedding + cosine similarity,阈值 0.7
              embedding 不可用时降级为 keyword 匹配(按 matchPattern 拆词)

优先级:多个规则同时命中时,按 priority DESC 排序,截断到 top 10 防 prompt 爆炸。

文件格式(.md frontmatter):
    ---
    id: rule-xxx
    name: 规则名
    description: 描述
    scope: global
    priority: 50
    enabled: true
    matchType: always
    matchPattern:
    agentId:
    createdAt: 2026-07-22T00:00:00Z
    updatedAt: 2026-07-22T00:00:00Z
    ---
    规则正文(markdown,作为 prompt 注入)...

安全:规则 content 只作为 prompt 注入,不执行任意代码;
      不解析 YAML 中的 !!python 等危险标签(用简单行解析,非 PyYAML)。
"""

from __future__ import annotations

import logging
import os
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 规则文件目录(项目根 .trae-cn/rules/)
_DEFAULT_RULES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", ".trae-cn", "rules"
)
# 语义匹配 cosine 相似度阈值
SEMANTIC_THRESHOLD = 0.7
# 最多注入的规则数(防 prompt 爆炸)
MAX_APPLIED_RULES = 10
# Embedding LRU 缓存:TTL 300s(5 分钟),容量 100 条
_EMBEDDING_CACHE_TTL = 300.0
_EMBEDDING_CACHE_MAX = 100
# 审计日志容量(内存,超出淘汰最早条目)
_AUDIT_LOG_MAX = 500
# 语义冲突检测相似度阈值(>0.9 视为重复)
_SEMANTIC_CONFLICT_THRESHOLD = 0.9


# 预置规则模板(5 个常用模板,GET /api/rules/templates 返回)
RULE_TEMPLATES: list[dict[str, Any]] = [
    {
        "name": "code_review",
        "description": "代码审查规则 — 触发代码审查场景时注入审查要点",
        "matchType": "keyword",
        "pattern": "review,审查,代码审查",
        "priority": 100,
        "scope": "global",
        "content": (
            "在进行代码审查时,请关注:\n"
            "1. 函数复杂度与可读性\n"
            "2. 潜在的安全漏洞\n"
            "3. 测试覆盖是否充分\n"
            "4. 命名规范与一致性\n"
            "5. 错误处理是否完善"
        ),
    },
    {
        "name": "security_check",
        "description": "安全检查规则 — 涉及敏感信息时注入安全约束",
        "matchType": "keyword",
        "pattern": "password,token,secret,密码,密钥",
        "priority": 200,
        "scope": "global",
        "content": (
            "处理敏感信息时必须:\n"
            "1. 禁止将密钥/密码硬编码到代码中\n"
            "2. 使用环境变量或密钥管理服务\n"
            "3. 日志中不得打印敏感字段\n"
            "4. 传输层必须使用 HTTPS/TLS\n"
            "5. 存储层必须使用加密"
        ),
    },
    {
        "name": "commit_convention",
        "description": "提交规范规则 — 校验 commit message 格式",
        "matchType": "regex",
        "pattern": r"^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\(.+\))?: .{1,100}$",
        "priority": 50,
        "scope": "global",
        "content": (
            "提交信息必须遵循 Conventional Commits 规范:\n"
            "- 类型前缀:feat/fix/docs/style/refactor/test/chore/perf/build/ci\n"
            "- 可选作用域:(<scope>)\n"
            "- 冒号 + 空格分隔\n"
            "- 简短描述(≤100 字符)"
        ),
    },
    {
        "name": "i18n_reminder",
        "description": "国际化提醒规则 — 涉及多语言时注入 i18n 约束",
        "matchType": "keyword",
        "pattern": "中文,i18n,国际化,多语言",
        "priority": 80,
        "scope": "global",
        "content": (
            "国际化要求:\n"
            "1. 用户可见文案必须走 i18n 资源文件\n"
            "2. 禁止硬编码中文字符串到代码\n"
            "3. 新增 key 必须同步更新所有 locale 文件\n"
            "4. 翻译遵循品牌词典(品牌名优先英文名)"
        ),
    },
    {
        "name": "test_coverage",
        "description": "测试覆盖规则 — 涉及测试时注入覆盖要求",
        "matchType": "keyword",
        "pattern": "test,测试,单元测试,集成测试",
        "priority": 90,
        "scope": "global",
        "content": (
            "测试要求:\n"
            "1. 新增功能必须配套单元测试\n"
            "2. 关键路径必须有集成测试\n"
            "3. 测试覆盖率不低于 80%\n"
            "4. 测试必须可独立运行,不依赖外部服务\n"
            "5. mock 必须明确标注,禁止 mock 真实生产逻辑"
        ),
    },
]


@dataclass
class Rule:
    """用户可编辑的规则定义。"""

    id: str
    name: str
    content: str
    scope: str = "global"  # global / workspace / agent
    agent_id: Optional[str] = None
    priority: int = 50
    enabled: bool = True
    match_type: str = "always"  # always / keyword / regex / semantic
    match_pattern: Optional[str] = None
    description: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict(供 API 返回)。"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "content": self.content,
            "scope": self.scope,
            "agentId": self.agent_id,
            "priority": self.priority,
            "enabled": self.enabled,
            "matchType": self.match_type,
            "matchPattern": self.match_pattern,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }

    @staticmethod
    def from_dict(data: dict[str, Any], content: str = "") -> "Rule":
        """从 dict 构造(供 API 创建时使用)。"""
        now = datetime.now(timezone.utc).isoformat()
        rule_id = str(data.get("id") or data.get("name", "rule")).strip()
        if not rule_id:
            rule_id = f"rule-{int(datetime.now(timezone.utc).timestamp())}"
        return Rule(
            id=rule_id,
            name=str(data.get("name", rule_id)),
            content=str(data.get("content", content)),
            scope=str(data.get("scope", "global")),
            agent_id=data.get("agentId") or data.get("agent_id"),
            priority=int(data.get("priority", 50)),
            enabled=bool(data.get("enabled", True)),
            match_type=str(data.get("matchType", data.get("match_type", "always"))),
            match_pattern=data.get("matchPattern") or data.get("match_pattern"),
            description=data.get("description"),
            created_at=str(data.get("createdAt", data.get("created_at", now))),
            updated_at=str(data.get("updatedAt", data.get("updated_at", now))),
        )


def _slugify(name: str) -> str:
    """把规则名转为安全文件名 slug(kebab-case)。"""
    slug = re.sub(r"[^\w\-]", "-", name.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or f"rule-{int(datetime.now(timezone.utc).timestamp())}"


def _parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    """解析 .md frontmatter + 正文,返回 (metadata_dict, body)。

    简单行解析(不用 PyYAML,避免 !!python 等危险标签注入)。
    仅支持 key: value 行格式,值不去引号。
    """
    if not content.startswith("---"):
        return {}, content
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", content, re.DOTALL)
    if not match:
        return {}, content
    frontmatter, body = match.group(1), match.group(2)
    meta: dict[str, str] = {}
    for line in frontmatter.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return meta, body


def _render_rule_md(rule: Rule) -> str:
    """把 Rule 渲染为 .md 文件内容(frontmatter + 正文)。"""
    return (
        "---\n"
        f"id: {rule.id}\n"
        f"name: {rule.name}\n"
        f"description: {rule.description or ''}\n"
        f"scope: {rule.scope}\n"
        f"agentId: {rule.agent_id or ''}\n"
        f"priority: {rule.priority}\n"
        f"enabled: {str(rule.enabled).lower()}\n"
        f"matchType: {rule.match_type}\n"
        f"matchPattern: {rule.match_pattern or ''}\n"
        f"createdAt: {rule.created_at}\n"
        f"updatedAt: {rule.updated_at}\n"
        "---\n\n"
        f"{rule.content}\n"
    )


class RulesEngine:
    """Rules 引擎:文件存储 + 热加载 + 匹配 + 应用到 system prompt。

    线程安全:用 threading.Lock 保护 _rules 字典 + mtime 缓存。
    """

    def __init__(self, rules_dir: Optional[str] = None) -> None:
        self._rules_dir = rules_dir or os.path.abspath(_DEFAULT_RULES_DIR)
        self._rules: dict[str, Rule] = {}
        self._dir_mtime: float = 0.0
        self._lock = threading.Lock()
        # Embedding LRU 缓存:key=pattern, value=(embedding, timestamp)
        self._embedding_cache: "OrderedDict[str, tuple[list[float], float]]" = (
            OrderedDict()
        )
        # 审计日志(内存,容量 _AUDIT_LOG_MAX)
        self._audit_log: list[dict[str, Any]] = []
        self._ensure_dir()
        self.reload()

    def _ensure_dir(self) -> None:
        """确保规则目录存在。"""
        try:
            os.makedirs(self._rules_dir, exist_ok=True)
        except Exception as e:
            logger.warning("[rules_engine] 创建规则目录失败: %s", e)

    def reload(self) -> int:
        """重新加载规则目录所有 .md 文件,返回加载数量。

        通过比较目录 mtime 实现热加载:mtime 未变时跳过 reload。
        """
        try:
            current_mtime = os.path.getmtime(self._rules_dir)
        except OSError:
            return 0

        # mtime 未变 → 跳过(热加载优化)
        if current_mtime == self._dir_mtime and self._rules:
            return len(self._rules)

        with self._lock:
            self._dir_mtime = current_mtime
            self._rules.clear()
            try:
                files = os.listdir(self._rules_dir)
            except OSError:
                return 0
            for fname in files:
                if not fname.endswith(".md"):
                    continue
                try:
                    path = os.path.join(self._rules_dir, fname)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                    meta, body = _parse_frontmatter(content)
                    if not meta.get("id"):
                        # 用文件名(去 .md)作为 id
                        meta["id"] = fname[:-3]
                    rule = Rule(
                        id=meta.get("id", fname[:-3]),
                        name=meta.get("name", meta["id"]),
                        content=body.strip(),
                        scope=meta.get("scope", "global"),
                        agent_id=meta.get("agentId") or None,
                        priority=int(meta.get("priority", "50") or 50),
                        enabled=meta.get("enabled", "true").lower() == "true",
                        match_type=meta.get("matchType", "always"),
                        match_pattern=meta.get("matchPattern") or None,
                        description=meta.get("description") or None,
                        created_at=meta.get("createdAt", ""),
                        updated_at=meta.get("updatedAt", ""),
                    )
                    self._rules[rule.id] = rule
                except Exception as e:
                    logger.warning("[rules_engine] 加载规则文件 %s 失败: %s", fname, e)
        return len(self._rules)

    def list(self) -> list[Rule]:
        """列出全部规则(按 priority DESC 排序)。"""
        self.reload()
        with self._lock:
            rules = list(self._rules.values())
        rules.sort(key=lambda r: r.priority, reverse=True)
        return rules

    def get(self, rule_id: str) -> Optional[Rule]:
        """获取单个规则。"""
        self.reload()
        with self._lock:
            return self._rules.get(rule_id)

    def create(self, data: dict[str, Any], user: str = "system") -> Rule:
        """创建规则 → 写入 .md 文件。"""
        now = datetime.now(timezone.utc).isoformat()
        rule_id = _slugify(str(data.get("name", "")))
        if not rule_id:
            rule_id = f"rule-{int(datetime.now(timezone.utc).timestamp())}"
        # 确保唯一
        with self._lock:
            if rule_id in self._rules:
                rule_id = f"{rule_id}-{int(datetime.now(timezone.utc).timestamp()) % 10000}"
        rule = Rule.from_dict(
            {
                **data,
                "id": rule_id,
                "createdAt": now,
                "updatedAt": now,
            },
            content=str(data.get("content", "")),
        )
        self._write_rule(rule)
        with self._lock:
            self._rules[rule.id] = rule
        self._record_audit("create", rule.id, rule.name, user)
        return rule

    def update(
        self, rule_id: str, data: dict[str, Any], user: str = "system"
    ) -> Optional[Rule]:
        """更新规则(部分字段) → 重写 .md 文件。"""
        with self._lock:
            existing = self._rules.get(rule_id)
        if not existing:
            return None
        now = datetime.now(timezone.utc).isoformat()
        updated = Rule(
            id=existing.id,
            name=data.get("name", existing.name),
            content=data.get("content", existing.content),
            scope=data.get("scope", existing.scope),
            agent_id=data.get("agentId", existing.agent_id),
            priority=int(data.get("priority", existing.priority)),
            enabled=bool(data.get("enabled", existing.enabled)),
            match_type=data.get("matchType", existing.match_type),
            match_pattern=data.get("matchPattern", existing.match_pattern),
            description=data.get("description", existing.description),
            created_at=existing.created_at,
            updated_at=now,
        )
        self._write_rule(updated)
        with self._lock:
            self._rules[rule_id] = updated
        self._record_audit("update", updated.id, updated.name, user)
        return updated

    def delete(self, rule_id: str, user: str = "system") -> bool:
        """删除规则 → 删除 .md 文件。"""
        # 先捕获规则名(供审计日志)
        with self._lock:
            rule_name = self._rules.get(rule_id, Rule(id=rule_id, name=rule_id)).name
        path = os.path.join(self._rules_dir, f"{rule_id}.md")
        deleted = False
        try:
            if os.path.exists(path):
                os.remove(path)
                deleted = True
            else:
                # 尝试按 id 匹配文件名(id 可能与文件名不完全一致)
                with self._lock:
                    if rule_id in self._rules:
                        rule = self._rules[rule_id]
                        alt_path = os.path.join(self._rules_dir, f"{rule.id}.md")
                        if os.path.exists(alt_path):
                            os.remove(alt_path)
                            deleted = True
        except Exception as e:
            logger.warning("[rules_engine] 删除规则 %s 失败: %s", rule_id, e)
        with self._lock:
            self._rules.pop(rule_id, None)
        if deleted:
            self._record_audit("delete", rule_id, rule_name, user)
        return deleted

    def _write_rule(self, rule: Rule) -> None:
        """写入规则到 .md 文件。"""
        path = os.path.join(self._rules_dir, f"{rule.id}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(_render_rule_md(rule))

    # ── 匹配 ──────────────────────────────────────────────

    def match(self, message: str, scope: Optional[str] = None) -> list[Rule]:
        """匹配消息,返回命中的规则(按 priority DESC,截断 top 10)。

        Args:
            message: 用户消息/当前对话上下文。
            scope: 限定作用域(为空则匹配所有 scope)。

        Returns:
            命中的规则列表(enabled=true 的),按 priority DESC 排序。
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())

        matched: list[tuple[int, Rule]] = []
        for rule in all_rules:
            if not rule.enabled:
                continue
            if scope and rule.scope != scope and rule.scope != "global":
                continue
            if self._match_single(rule, message):
                matched.append((rule.priority, rule))

        # priority DESC 排序
        matched.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in matched[:MAX_APPLIED_RULES]]

    def _match_single(self, rule: Rule, message: str) -> bool:
        """匹配单个规则(按 matchType 分发)。"""
        if rule.match_type == "always":
            return True
        if not rule.match_pattern:
            return False
        if rule.match_type == "keyword":
            keywords = [k.strip() for k in rule.match_pattern.split(",") if k.strip()]
            return any(k in message for k in keywords)
        if rule.match_type == "regex":
            try:
                return bool(re.search(rule.match_pattern, message))
            except re.error as e:
                logger.warning("[rules_engine] 规则 %s 正则无效: %s", rule.id, e)
                return False
        if rule.match_type == "semantic":
            return self._match_semantic(rule, message)
        return False

    def _match_semantic(self, rule: Rule, message: str) -> bool:
        """语义匹配:embedding cosine similarity ≥ 阈值。

        使用 _get_embedding LRU 缓存(rule pattern 复用)。
        embedding 不可用时降级为 keyword 匹配(按 matchPattern 拆词)。
        """
        if not rule.match_pattern:
            return False
        try:
            msg_emb = self._get_embedding(message)
            rule_emb = self._get_embedding(rule.match_pattern)
            if not msg_emb or not rule_emb:
                return self._fallback_keyword(rule, message)
            score = _cosine_similarity(msg_emb, rule_emb)
            return score >= SEMANTIC_THRESHOLD
        except Exception as e:
            logger.debug("[rules_engine] 语义匹配降级为 keyword: %s", e)
            return self._fallback_keyword(rule, message)

    # ── Embedding LRU 缓存 ─────────────────────────────────

    def _get_embedding(self, pattern: str) -> list[float]:
        """获取 pattern 的 embedding(同步,带 LRU 缓存)。

        缓存 TTL 300s,容量 100 条,LRU 淘汰。
        缓存 miss 时调用 embedding API,失败返回空向量(匹配分数 0)。
        """
        if not pattern:
            return []
        now = time.time()
        # 查缓存(命中则 move_to_end 实现 LRU)
        with self._lock:
            cached = self._embedding_cache.get(pattern)
            if cached is not None:
                emb, ts = cached
                if now - ts < _EMBEDDING_CACHE_TTL:
                    self._embedding_cache.move_to_end(pattern)
                    return emb
                # 过期 → 删除
                self._embedding_cache.pop(pattern, None)
        # miss → 调用 embedding API(不持锁,避免阻塞)
        try:
            from ..core.llm_gateway import llm_gateway

            import asyncio

            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures

                with concurrent.futures.ThreadPoolExecutor() as pool:
                    emb = pool.submit(
                        asyncio.run, llm_gateway.embed(pattern[:8000])
                    ).result(timeout=15)
            else:
                emb = loop.run_until_complete(llm_gateway.embed(pattern[:8000]))
            if not emb:
                return []
            # 写缓存(持锁)
            with self._lock:
                self._embedding_cache[pattern] = (emb, now)
                while len(self._embedding_cache) > _EMBEDDING_CACHE_MAX:
                    self._embedding_cache.popitem(last=False)
            return emb
        except Exception as e:
            logger.debug("[rules_engine] embedding 获取失败(降级空向量): %s", e)
            return []

    async def _get_embedding_async(self, pattern: str) -> list[float]:
        """获取 pattern 的 embedding(异步,带 LRU 缓存)。

        供 agent loop 在事件循环中直接 await,无需线程池。
        """
        if not pattern:
            return []
        now = time.time()
        with self._lock:
            cached = self._embedding_cache.get(pattern)
            if cached is not None:
                emb, ts = cached
                if now - ts < _EMBEDDING_CACHE_TTL:
                    self._embedding_cache.move_to_end(pattern)
                    return emb
                self._embedding_cache.pop(pattern, None)
        try:
            from ..core.llm_gateway import llm_gateway

            emb = await llm_gateway.embed(pattern[:8000])
            if not emb:
                return []
            with self._lock:
                self._embedding_cache[pattern] = (emb, now)
                while len(self._embedding_cache) > _EMBEDDING_CACHE_MAX:
                    self._embedding_cache.popitem(last=False)
            return emb
        except Exception as e:
            logger.debug("[rules_engine] 异步 embedding 获取失败: %s", e)
            return []

    @staticmethod
    def _fallback_keyword(rule: Rule, message: str) -> bool:
        """语义匹配降级:把 matchPattern 按空格/逗号拆词做 keyword 匹配。"""
        if not rule.match_pattern:
            return False
        words = re.split(r"[\s,，]+", rule.match_pattern.strip())
        return any(w in message for w in words if w)

    async def match_async(self, message: str, scope: Optional[str] = None) -> list[Rule]:
        """异步匹配(供 agent loop 在事件循环中调用)。

        语义匹配时直接 await embed(),无需线程池。
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())

        matched: list[tuple[int, Rule]] = []
        for rule in all_rules:
            if not rule.enabled:
                continue
            if scope and rule.scope != scope and rule.scope != "global":
                continue
            if rule.match_type == "semantic":
                hit = await self._match_semantic_async(rule, message)
            else:
                hit = self._match_single(rule, message)
            if hit:
                matched.append((rule.priority, rule))

        matched.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in matched[:MAX_APPLIED_RULES]]

    async def _match_semantic_async(self, rule: Rule, message: str) -> bool:
        """异步语义匹配(使用 _get_embedding_async LRU 缓存)。"""
        if not rule.match_pattern:
            return False
        try:
            msg_emb = await self._get_embedding_async(message)
            rule_emb = await self._get_embedding_async(rule.match_pattern)
            if not msg_emb or not rule_emb:
                return self._fallback_keyword(rule, message)
            score = _cosine_similarity(msg_emb, rule_emb)
            return score >= SEMANTIC_THRESHOLD
        except Exception as e:
            logger.debug("[rules_engine] 异步语义匹配降级: %s", e)
            return self._fallback_keyword(rule, message)

    # ── 应用到 agent ────────────────────────────────────────

    def apply(self, message: str, scope: Optional[str] = None) -> dict[str, Any]:
        """匹配规则并返回拼接结果(供调用方追加到 system prompt)。

        Returns:
            {"appliedRules": [...], "promptSuffix": "..."}
        """
        rules = self.match(message, scope)
        if not rules:
            return {"appliedRules": [], "promptSuffix": ""}
        suffix = "\n\n".join(
            f"## {r.name}\n{r.content}" for r in rules
        )
        return {
            "appliedRules": [r.to_dict() for r in rules],
            "promptSuffix": f"\n\n--- 用户规则 ---\n{suffix}",
        }

    def test(self, rule_id: str, message: str, user: str = "system") -> dict[str, Any]:
        """测试单个规则是否匹配某消息。

        Returns:
            {"matched": bool, "reason": str}
        """
        rule = self.get(rule_id)
        if not rule:
            return {"matched": False, "reason": f"规则不存在: {rule_id}"}
        if not rule.enabled:
            return {"matched": False, "reason": "规则已禁用"}
        hit = self._match_single(rule, message)
        self._record_audit("test", rule.id, rule.name, user)
        if hit:
            return {
                "matched": True,
                "reason": f"匹配类型 {rule.match_type} 命中",
            }
        return {
            "matched": False,
            "reason": f"匹配类型 {rule.match_type} 未命中",
        }

    # ── 审计日志 ────────────────────────────────────────────

    def _record_audit(
        self,
        action: str,
        rule_id: str,
        rule_name: str,
        user: str = "system",
    ) -> None:
        """记录审计日志(内存,容量 _AUDIT_LOG_MAX,超出淘汰最早条目)。

        Args:
            action: 操作类型(create/update/delete/test)
            rule_id: 规则 ID
            rule_name: 规则名
            user: 操作者(默认 system,router 层可传入实际用户)
        """
        entry = {
            "action": action,
            "ruleId": rule_id,
            "ruleName": rule_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": user,
        }
        with self._lock:
            self._audit_log.append(entry)
            while len(self._audit_log) > _AUDIT_LOG_MAX:
                self._audit_log.pop(0)

    def get_audit_log(self, limit: int = 100) -> dict[str, Any]:
        """返回审计日志(最新 limit 条,倒序)。

        Returns:
            {"entries": [...], "total": int}
        """
        with self._lock:
            snapshot = list(self._audit_log)
        total = len(snapshot)
        # 返回最新 limit 条(倒序:最新在前)
        entries = snapshot[-limit:][::-1] if limit > 0 else snapshot[::-1]
        return {"entries": entries, "total": total}

    # ── 冲突检测 ────────────────────────────────────────────

    async def detect_conflicts(self) -> list[dict[str, Any]]:
        """检测规则冲突,返回冲突列表。

        检测 3 类冲突:
          a) name_conflict:同名不同 ID 的规则
          b) semantic_duplicate:semantic 匹配类型 + pattern cosine 相似度 > 0.9
          c) priority_collision:同 scope + 相同 priority 值

        Returns:
            [{"type": "name_conflict"|"semantic_duplicate"|"priority_collision",
               "ruleIds": [str], "detail": str}, ...]
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())

        conflicts: list[dict[str, Any]] = []

        # a) 同名冲突
        by_name: dict[str, list[Rule]] = {}
        for r in all_rules:
            by_name.setdefault(r.name, []).append(r)
        for name, group in by_name.items():
            if len(group) > 1:
                conflicts.append(
                    {
                        "type": "name_conflict",
                        "ruleIds": [r.id for r in group],
                        "detail": f"存在 {len(group)} 条名为「{name}」的规则",
                    }
                )

        # b) 语义重复(semantic + cosine > 0.9)
        semantic_rules = [
            r
            for r in all_rules
            if r.match_type == "semantic" and r.match_pattern
        ]
        for i, r1 in enumerate(semantic_rules):
            for r2 in semantic_rules[i + 1 :]:
                if r1.id == r2.id:
                    continue
                try:
                    e1 = await self._get_embedding_async(r1.match_pattern)
                    e2 = await self._get_embedding_async(r2.match_pattern)
                    if e1 and e2:
                        score = _cosine_similarity(e1, e2)
                        if score > _SEMANTIC_CONFLICT_THRESHOLD:
                            conflicts.append(
                                {
                                    "type": "semantic_duplicate",
                                    "ruleIds": [r1.id, r2.id],
                                    "detail": (
                                        f"语义相似度 {score:.3f} > "
                                        f"{_SEMANTIC_CONFLICT_THRESHOLD}"
                                        f"(规则「{r1.name}」与「{r2.name}」)"
                                    ),
                                }
                            )
                except Exception as e:
                    logger.debug("[rules_engine] 语义冲突检测失败: %s", e)

        # c) 优先级碰撞(同 scope + 相同 priority)
        by_scope_priority: dict[tuple[str, int], list[Rule]] = {}
        for r in all_rules:
            key = (r.scope, r.priority)
            by_scope_priority.setdefault(key, []).append(r)
        for (scope, priority), group in by_scope_priority.items():
            if len(group) > 1:
                conflicts.append(
                    {
                        "type": "priority_collision",
                        "ruleIds": [r.id for r in group],
                        "detail": (
                            f"作用域 {scope} 下有 {len(group)} 条规则"
                            f"使用相同优先级 {priority}"
                        ),
                    }
                )

        return conflicts

    # ── 规则模板库 ──────────────────────────────────────────

    @staticmethod
    def list_templates() -> list[dict[str, Any]]:
        """返回预置规则模板(5 个常用模板)。

        每个模板字段:name, description, matchType, pattern, priority, scope, content。
        前端点击模板可快速创建规则(把模板字段填入新建表单)。
        """
        return [dict(t) for t in RULE_TEMPLATES]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度。"""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# 全局单例
rules_engine = RulesEngine()
