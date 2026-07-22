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

Scope 继承链(2026-07-22 深化):
  - global → workspace → agent 三层继承
  - 子 scope 默认继承父 scope 所有规则
  - 同名规则冲突:更具体 scope 胜出(agent > workspace > global)
  - 跨 scope 优先级:agent +1000, workspace +500
  - resolved() 返回合并后的最终生效规则集(含 inherited_from 字段)

版本控制(2026-07-22 深化):
  - 规则变更时旧版本写入 .trae-cn/rules/history/<timestamp>-<rule-id>.md
  - get_history / rollback / diff_versions 支持版本回溯
  - 文件写入失败不阻塞规则变更

效果评估(2026-07-22 深化):
  - record_effect: 记录 ruleId + 输入 + 输出 + token 增量
  - record_feedback: 接收用户反馈(thumbs_up / thumbs_down)
  - get_rule_stats: 命中率(7/30 天)、平均 token 增量、满意度
  - ab_test: 两条规则对同一输入分别应用,返回两份输出

Redis 审计日志(2026-07-22 深化):
  - _audit_log 迁移到 Redis list "rules:audit-log"(LPUSH + LTRIM 5000)
  - _effect_log 迁移到 Redis list "rules:effect-log:{ruleId}"(LPUSH + LTRIM 1000)
  - 初始化时从 Redis 加载最近 100 条审计日志到内存
  - 降级:Redis 不可用时用内存

触发统计(2026-07-22 深化):
  - 每条规则 match_count 字段(持久化到 frontmatter)
  - 命中时 match_count += 1,异步写入文件(不阻塞匹配)
  - get_global_stats: 总规则数、活跃规则数(7 天)、最常用规则 top 10

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
    matchCount: 0
    lastMatchedAt:
    createdAt: 2026-07-22T00:00:00Z
    updatedAt: 2026-07-22T00:00:00Z
    ---
    规则正文(markdown,作为 prompt 注入)...

安全:规则 content 只作为 prompt 注入,不执行任意代码;
      不解析 YAML 中的 !!python 等危险标签(用简单行解析,非 PyYAML)。
"""

from __future__ import annotations

import difflib
import json
import logging
import os
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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

# ── Redis 配置 ──────────────────────────────────────────
_AUDIT_LOG_REDIS_KEY = "rules:audit-log"
_AUDIT_LOG_REDIS_MAX = 5000
_EFFECT_LOG_REDIS_PREFIX = "rules:effect-log:"
_EFFECT_LOG_REDIS_MAX = 1000
_FEEDBACK_LOG_REDIS_PREFIX = "rules:feedback-log:"
_FEEDBACK_LOG_REDIS_MAX = 1000
_REDIS_INIT_LOAD = 100  # 初始化时从 Redis 加载审计日志条数

# ── 超越创新模块常量(行为学习 + LLM 模式提取 + 冲突协商 + 效果预测 + 知识图谱)──
_BEHAVIOR_KEY_PREFIX = "rules:behavior:"      # 用户行为 hash
_BEHAVIOR_MAX_ENTRIES = 1000                    # 每用户最多保留行为数
_PATTERN_MIN_SAMPLES = 5                        # 模式提取最小样本数
_KG_SIM_DUP_THRESHOLD = 0.9                      # 知识图谱:重复边阈值
_KG_SIM_COMP_THRESHOLD = 0.7                    # 知识图谱:互补边阈值
_KG_SIM_CONFLICT_THRESHOLD = 0.3                # 知识图谱:冲突边阈值

# ── Scope 继承链 ────────────────────────────────────────
_SCOPE_CHAIN: dict[str, list[str]] = {
    "global": ["global"],
    "workspace": ["global", "workspace"],
    "agent": ["global", "workspace", "agent"],
}
_SCOPE_PRIORITY_BOOST: dict[str, int] = {
    "global": 0,
    "workspace": 500,
    "agent": 1000,
}

# Redis 客户端(降级为 None)
try:
    import redis as _sync_redis
except ImportError:
    _sync_redis = None  # type: ignore[assignment]

# settings(降级为环境变量)
try:
    from ..core.config import settings as _settings
    _REDIS_URL = str(_settings.redis_url)
except Exception:  # noqa: BLE001
    _settings = None  # type: ignore[assignment]
    _REDIS_URL = os.environ.get("REDIS_URL", "")


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
    # ── 触发统计(持久化到 frontmatter)──
    match_count: int = 0
    last_matched_at: str = ""
    # ── 继承标记(瞬态,不持久化;match/resolved 时设置)──
    inherited_from: Optional[str] = None

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
            "matchCount": self.match_count,
            "lastMatchedAt": self.last_matched_at,
            "inheritedFrom": self.inherited_from,
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
            match_count=int(data.get("matchCount", data.get("match_count", 0)) or 0),
            last_matched_at=str(
                data.get("lastMatchedAt", data.get("last_matched_at", ""))
            ),
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
        f"matchCount: {rule.match_count}\n"
        f"lastMatchedAt: {rule.last_matched_at}\n"
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
        self._history_dir = os.path.join(self._rules_dir, "history")
        self._rules: dict[str, Rule] = {}
        self._dir_mtime: float = 0.0
        self._lock = threading.Lock()
        # Embedding LRU 缓存:key=pattern, value=(embedding, timestamp)
        self._embedding_cache: "OrderedDict[str, tuple[list[float], float]]" = (
            OrderedDict()
        )
        # 审计日志(内存降级,容量 _AUDIT_LOG_MAX)
        self._audit_log: list[dict[str, Any]] = []
        # 效果日志(内存降级):{rule_id: [entry, ...]}
        self._effect_log: dict[str, list[dict[str, Any]]] = {}
        # 反馈日志(内存降级):{rule_id: [entry, ...]}
        self._feedback_log: dict[str, list[dict[str, Any]]] = {}
        # 用户行为日志(内存降级,Redis 不可用时)
        self._behavior_fallback: list[dict[str, Any]] = []
        # 学习反馈日志(内存降级,Redis 不可用时):{rule_id: [entry, ...]}
        self._learn_feedback_log: dict[str, list[dict[str, Any]]] = {}
        # Redis 客户端(懒初始化)
        self._redis: Any = None
        self._use_redis = bool(_REDIS_URL) and _sync_redis is not None
        self._redis_inited = False
        self._ensure_dir()
        self.reload()

    def _ensure_dir(self) -> None:
        """确保规则目录 + 版本历史目录存在。"""
        try:
            os.makedirs(self._rules_dir, exist_ok=True)
            os.makedirs(self._history_dir, exist_ok=True)
        except Exception as e:
            logger.warning("[rules_engine] 创建规则目录失败: %s", e)

    # ── Redis ──────────────────────────────────────────────

    def _get_redis(self) -> Any:
        """获取 sync Redis 客户端,连接失败时降级为内存模式。"""
        if not self._use_redis:
            return None
        if not self._redis_inited:
            self._redis_inited = True
            try:
                self._redis = _sync_redis.from_url(
                    _REDIS_URL, decode_responses=True
                )
                self._redis.ping()
                # 从 Redis 加载最近 100 条审计日志到内存
                self._load_audit_from_redis()
            except Exception as e:
                logger.warning("[rules_engine] Redis 连接失败,降级内存: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    def _load_audit_from_redis(self) -> None:
        """初始化时从 Redis 加载最近 100 条审计日志到内存(快速访问)。"""
        if not self._redis:
            return
        try:
            raw = self._redis.lrange(_AUDIT_LOG_REDIS_KEY, 0, _REDIS_INIT_LOAD - 1)
            entries: list[dict[str, Any]] = []
            for r in raw:
                try:
                    entries.append(json.loads(r))
                except (json.JSONDecodeError, TypeError):
                    continue
            # Redis LPUSH 存储最新在前(index 0 = 最新)
            # 内存列表存储最旧在前(append 到尾部)
            with self._lock:
                self._audit_log = list(reversed(entries))
                while len(self._audit_log) > _AUDIT_LOG_MAX:
                    self._audit_log.pop(0)
        except Exception as e:
            logger.debug("[rules_engine] 从 Redis 加载审计日志失败: %s", e)

    # ── 文件加载 ────────────────────────────────────────────

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
                        match_count=int(meta.get("matchCount", "0") or 0),
                        last_matched_at=meta.get("lastMatchedAt", ""),
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
        # 版本控制:保存旧版本
        self._save_version(existing, "update")
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
            match_count=existing.match_count,
            last_matched_at=existing.last_matched_at,
        )
        self._write_rule(updated)
        with self._lock:
            self._rules[rule_id] = updated
        self._record_audit("update", updated.id, updated.name, user)
        return updated

    def delete(self, rule_id: str, user: str = "system") -> bool:
        """删除规则 → 删除 .md 文件。"""
        # 先捕获规则(供审计 + 版本控制)
        with self._lock:
            rule = self._rules.get(rule_id)
            rule_name = rule.name if rule else rule_id
        if rule:
            self._save_version(rule, "delete")
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
                        r = self._rules[rule_id]
                        alt_path = os.path.join(self._rules_dir, f"{r.id}.md")
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

    # ── 版本控制 ────────────────────────────────────────────

    def _save_version(self, rule: Rule, action: str) -> None:
        """保存当前规则版本到历史目录(变更前调用)。

        文件:.trae-cn/rules/history/<timestamp>-<rule_id>.md
        降级:文件写入失败不阻塞规则变更。
        """
        try:
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            filename = f"{ts}-{rule.id}.md"
            path = os.path.join(self._history_dir, filename)
            content = _render_rule_md(rule)
            # 在 frontmatter 前加 action 注释
            content = f"<!-- action: {action} -->\n{content}"
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            logger.warning("[rules_engine] 版本保存失败(不阻塞): %s", e)

    def get_history(self, rule_id: str) -> list[dict[str, Any]]:
        """返回规则版本历史列表(timestamp + action + content_diff)。

        Returns:
            [{"timestamp": str, "action": str, "content": str}, ...]
            按 timestamp DESC 排序(最新在前)。
        """
        history: list[dict[str, Any]] = []
        try:
            if not os.path.isdir(self._history_dir):
                return history
            suffix = f"-{rule_id}.md"
            for fname in os.listdir(self._history_dir):
                if not fname.endswith(".md"):
                    continue
                if not fname.endswith(suffix):
                    continue
                # 从文件名提取 timestamp(去掉 "-<rule_id>.md" 后缀)
                ts_str = fname[: -(len(rule_id) + 4)]
                try:
                    path = os.path.join(self._history_dir, fname)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                    # 提取 action 注释
                    action = "update"
                    am = re.match(r"^<!-- action: (\w+) -->", content)
                    if am:
                        action = am.group(1)
                    # 去掉 action 注释,保留纯规则内容
                    clean = re.sub(r"^<!-- action: \w+ -->\n", "", content)
                    history.append(
                        {
                            "timestamp": ts_str,
                            "action": action,
                            "content": clean,
                        }
                    )
                except Exception as e:
                    logger.debug(
                        "[rules_engine] 读取版本文件 %s 失败: %s", fname, e
                    )
        except Exception as e:
            logger.warning("[rules_engine] 读取版本历史失败: %s", e)
        history.sort(key=lambda h: h["timestamp"], reverse=True)
        return history

    def rollback(self, rule_id: str, version: str) -> Optional[Rule]:
        """回滚规则到指定版本。

        Args:
            rule_id: 规则 ID。
            version: 版本 timestamp(文件名前缀)。

        Returns:
            回滚后的 Rule,失败返回 None。
        """
        try:
            filename = f"{version}-{rule_id}.md"
            path = os.path.join(self._history_dir, filename)
            if not os.path.exists(path):
                return None
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            # 去掉 action 注释
            content = re.sub(r"^<!-- action: \w+ -->\n", "", content)
            meta, body = _parse_frontmatter(content)
            if not meta.get("id"):
                meta["id"] = rule_id
            now = datetime.now(timezone.utc).isoformat()
            rule = Rule(
                id=meta.get("id", rule_id),
                name=meta.get("name", rule_id),
                content=body.strip(),
                scope=meta.get("scope", "global"),
                agent_id=meta.get("agentId") or None,
                priority=int(meta.get("priority", "50") or 50),
                enabled=meta.get("enabled", "true").lower() == "true",
                match_type=meta.get("matchType", "always"),
                match_pattern=meta.get("matchPattern") or None,
                description=meta.get("description") or None,
                created_at=meta.get("createdAt", ""),
                updated_at=now,
                match_count=int(meta.get("matchCount", "0") or 0),
                last_matched_at=meta.get("lastMatchedAt", ""),
            )
            # 保存当前版本(回滚前)
            with self._lock:
                current = self._rules.get(rule_id)
            if current:
                self._save_version(current, "rollback")
            # 写入回滚版本
            self._write_rule(rule)
            with self._lock:
                self._rules[rule_id] = rule
            self._record_audit("rollback", rule.id, rule.name, "system")
            return rule
        except Exception as e:
            logger.warning("[rules_engine] 回滚失败: %s", e)
            return None

    def diff_versions(
        self, rule_id: str, from_ts: str, to_ts: str
    ) -> str:
        """返回两个版本之间的 unified diff。"""
        from_content = self._read_version_content(rule_id, from_ts)
        to_content = self._read_version_content(rule_id, to_ts)
        if from_content is None or to_content is None:
            return ""
        diff = difflib.unified_diff(
            from_content.splitlines(keepends=True),
            to_content.splitlines(keepends=True),
            fromfile=f"{from_ts}-{rule_id}.md",
            tofile=f"{to_ts}-{rule_id}.md",
        )
        return "".join(diff)

    def _read_version_content(
        self, rule_id: str, timestamp: str
    ) -> Optional[str]:
        """读取指定版本的规则文件内容(去掉 action 注释)。"""
        try:
            filename = f"{timestamp}-{rule_id}.md"
            path = os.path.join(self._history_dir, filename)
            if not os.path.exists(path):
                return None
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            return re.sub(r"^<!-- action: \w+ -->\n", "", content)
        except Exception:
            return None

    # ── 匹配(Scope 继承链)──────────────────────────────────

    def match(self, message: str, scope: Optional[str] = None) -> list[Rule]:
        """匹配消息,返回命中的规则(按 priority DESC,截断 top 10)。

        Scope 继承链合并(2026-07-22 深化):
          - 无 scope:匹配所有规则(legacy 行为)
          - 有 scope:按 global → workspace → agent 三层继承合并
            - 子 scope 继承父 scope 所有规则
            - 同名规则:更具体 scope 胜出(agent > workspace > global)
            - 跨 scope 优先级:agent +1000, workspace +500
            - 返回的规则设置 inherited_from 字段

        Args:
            message: 用户消息/当前对话上下文。
            scope: 限定作用域(为空则匹配所有 scope)。

        Returns:
            命中的规则列表(enabled=true 的),按 priority DESC 排序。
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())

        if not scope:
            # Legacy:匹配所有 scope
            matched: list[tuple[int, Rule]] = []
            for rule in all_rules:
                if not rule.enabled:
                    continue
                if self._match_single(rule, message):
                    matched.append((rule.priority, rule))
            matched.sort(key=lambda x: x[0], reverse=True)
            result = [r for _, r in matched[:MAX_APPLIED_RULES]]
            for r in result:
                r.inherited_from = None
                self._increment_match_count(r)
            return result

        # Scope 继承链匹配
        chain = _SCOPE_CHAIN.get(scope, ["global"])
        scope_matched: dict[str, list[Rule]] = {s: [] for s in chain}
        for rule in all_rules:
            if not rule.enabled:
                continue
            if rule.scope not in chain:
                continue
            if self._match_single(rule, message):
                scope_matched[rule.scope].append(rule)

        merged = self._merge_scope_rules(scope_matched, chain)
        for rule, inherited in merged:
            rule.inherited_from = inherited
            self._increment_match_count(rule)
        return [r for r, _ in merged]

    def _merge_scope_rules(
        self,
        scope_matched: dict[str, list[Rule]],
        chain: list[str],
    ) -> list[tuple[Rule, str]]:
        """合并跨 scope 命中规则(更具体 scope 胜出同名冲突)。

        Returns:
            [(rule, inherited_from), ...] 按 effective priority DESC 排序。
        """
        merged: dict[str, tuple[int, Rule, str]] = {}
        for s in chain:  # global 先,更具体后
            boost = _SCOPE_PRIORITY_BOOST.get(s, 0)
            for rule in scope_matched.get(s, []):
                effective_priority = rule.priority + boost
                if rule.name in merged:
                    if effective_priority > merged[rule.name][0]:
                        merged[rule.name] = (effective_priority, rule, s)
                else:
                    merged[rule.name] = (effective_priority, rule, s)
        sorted_rules = sorted(merged.values(), key=lambda x: x[0], reverse=True)
        return [(r, inh) for _, r, inh in sorted_rules[:MAX_APPLIED_RULES]]

    def resolved(
        self, scope: str, agent_id: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """返回合并后的最终生效规则集(含 inherited_from 字段)。

        按 global → workspace → agent 三层继承合并,同名规则更具体 scope 胜出。
        不做消息匹配,返回该 scope 下所有 enabled 规则的合并集。

        Args:
            scope: 目标作用域(global / workspace / agent)。
            agent_id: scope='agent' 时过滤特定 agent 的规则。

        Returns:
            规则 dict 列表(含 inheritedFrom 字段),按 effective priority DESC。
        """
        self.reload()
        chain = _SCOPE_CHAIN.get(scope, ["global"])
        with self._lock:
            all_rules = list(self._rules.values())

        by_scope: dict[str, list[Rule]] = {s: [] for s in chain}
        for rule in all_rules:
            if not rule.enabled:
                continue
            if rule.scope not in chain:
                continue
            # agent scope:有 agentId 过滤时,跳过其他 agent 的规则
            if (
                rule.scope == "agent"
                and agent_id
                and rule.agent_id
                and rule.agent_id != agent_id
            ):
                continue
            by_scope[rule.scope].append(rule)

        merged = self._merge_scope_rules(by_scope, chain)
        return [
            {**rule.to_dict(), "inheritedFrom": inherited}
            for rule, inherited in merged
        ]

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
        支持 Scope 继承链合并(同 match())。
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())

        if not scope:
            # Legacy:匹配所有 scope
            matched: list[tuple[int, Rule]] = []
            for rule in all_rules:
                if not rule.enabled:
                    continue
                if rule.match_type == "semantic":
                    hit = await self._match_semantic_async(rule, message)
                else:
                    hit = self._match_single(rule, message)
                if hit:
                    matched.append((rule.priority, rule))
            matched.sort(key=lambda x: x[0], reverse=True)
            result = [r for _, r in matched[:MAX_APPLIED_RULES]]
            for r in result:
                r.inherited_from = None
                self._increment_match_count(r)
            return result

        # Scope 继承链匹配
        chain = _SCOPE_CHAIN.get(scope, ["global"])
        scope_matched: dict[str, list[Rule]] = {s: [] for s in chain}
        for rule in all_rules:
            if not rule.enabled:
                continue
            if rule.scope not in chain:
                continue
            if rule.match_type == "semantic":
                hit = await self._match_semantic_async(rule, message)
            else:
                hit = self._match_single(rule, message)
            if hit:
                scope_matched[rule.scope].append(rule)

        merged = self._merge_scope_rules(scope_matched, chain)
        for rule, inherited in merged:
            rule.inherited_from = inherited
            self._increment_match_count(rule)
        return [r for r, _ in merged]

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

    # ── 触发统计 ────────────────────────────────────────────

    def _increment_match_count(self, rule: Rule) -> None:
        """命中时 match_count += 1 + 更新 last_matched_at,异步写入文件。

        异步写入(daemon thread)不阻塞匹配。
        """
        with self._lock:
            r = self._rules.get(rule.id)
            if r:
                r.match_count += 1
                r.last_matched_at = datetime.now(timezone.utc).isoformat()
                count = r.match_count
                last = r.last_matched_at
            else:
                return
        # 异步写入(daemon thread,不阻塞)
        threading.Thread(
            target=self._async_write_match_count,
            args=(rule.id, count, last),
            daemon=True,
        ).start()

    def _async_write_match_count(
        self, rule_id: str, count: int, last_matched: str
    ) -> None:
        """后台线程:仅更新文件 frontmatter 中的 matchCount + lastMatchedAt 行。

        采用正则替换(非全文件重写),避免与 update() 的文件写入冲突。
        """
        try:
            path = os.path.join(self._rules_dir, f"{rule_id}.md")
            if not os.path.exists(path):
                return
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            # 仅替换 matchCount 行
            if re.search(r"^matchCount:", content, re.MULTILINE):
                content = re.sub(
                    r"^matchCount:.*$",
                    f"matchCount: {count}",
                    content,
                    flags=re.MULTILINE,
                )
            else:
                content = content.replace(
                    "\n---\n", f"\nmatchCount: {count}\n---\n", 1
                )
            # 仅替换 lastMatchedAt 行
            if re.search(r"^lastMatchedAt:", content, re.MULTILINE):
                content = re.sub(
                    r"^lastMatchedAt:.*$",
                    f"lastMatchedAt: {last_matched}",
                    content,
                    flags=re.MULTILINE,
                )
            else:
                content = content.replace(
                    "\n---\n", f"\nlastMatchedAt: {last_matched}\n---\n", 1
                )
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            logger.debug("[rules_engine] match_count 异步写入失败: %s", e)

    def get_global_stats(self) -> dict[str, Any]:
        """返回全局统计:总规则数、活跃规则数(7 天命中)、最常用规则 top 10。"""
        rules = self.list()
        total = len(rules)
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        active_7d = sum(
            1 for r in rules if r.last_matched_at and r.last_matched_at >= seven_days_ago
        )
        top_10 = sorted(rules, key=lambda r: r.match_count, reverse=True)[:10]
        return {
            "totalRules": total,
            "activeRules7d": active_7d,
            "topRules": [
                {"id": r.id, "name": r.name, "matchCount": r.match_count}
                for r in top_10
            ],
        }

    # ── 效果评估 ────────────────────────────────────────────

    def record_effect(
        self,
        rule_id: str,
        message: str,
        output: str = "",
        token_delta: int = 0,
    ) -> None:
        """记录规则命中效果(供 agent loop 在 LLM 响应后调用)。

        存储到 Redis list "rules:effect-log:{ruleId}"(LPUSH + LTRIM 1000),
        Redis 不可用时降级为内存。
        """
        entry = {
            "ruleId": rule_id,
            "message": message[:500],  # 截断防内存膨胀
            "output": output[:500],
            "tokenDelta": int(token_delta),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_EFFECT_LOG_REDIS_PREFIX}{rule_id}"
                redis.lpush(key, json.dumps(entry, ensure_ascii=False))
                redis.ltrim(key, 0, _EFFECT_LOG_REDIS_MAX - 1)
                return
            except Exception as e:
                logger.debug("[rules_engine] Redis effect log 写入失败: %s", e)
        # 内存降级
        with self._lock:
            self._effect_log.setdefault(rule_id, []).insert(0, entry)
            if len(self._effect_log[rule_id]) > _EFFECT_LOG_REDIS_MAX:
                self._effect_log[rule_id] = self._effect_log[rule_id][
                    :_EFFECT_LOG_REDIS_MAX
                ]

    def _get_effect_log(self, rule_id: str) -> list[dict[str, Any]]:
        """读取规则效果日志(Redis 优先,降级内存)。"""
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_EFFECT_LOG_REDIS_PREFIX}{rule_id}"
                raw = redis.lrange(key, 0, -1)
                entries: list[dict[str, Any]] = []
                for r in raw:
                    try:
                        entries.append(json.loads(r))
                    except (json.JSONDecodeError, TypeError):
                        continue
                return entries
            except Exception as e:
                logger.debug("[rules_engine] Redis effect log 读取失败: %s", e)
        with self._lock:
            return list(self._effect_log.get(rule_id, []))

    def record_feedback(self, rule_id: str, feedback: str) -> bool:
        """记录用户反馈(thumbs_up / thumbs_down)。

        存储到 Redis list "rules:feedback-log:{ruleId}"(LPUSH + LTRIM 1000)。
        """
        if feedback not in ("thumbs_up", "thumbs_down"):
            return False
        entry = {
            "feedback": feedback,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_FEEDBACK_LOG_REDIS_PREFIX}{rule_id}"
                redis.lpush(key, json.dumps(entry, ensure_ascii=False))
                redis.ltrim(key, 0, _FEEDBACK_LOG_REDIS_MAX - 1)
                return True
            except Exception as e:
                logger.debug("[rules_engine] Redis feedback 写入失败: %s", e)
        # 内存降级
        with self._lock:
            self._feedback_log.setdefault(rule_id, []).insert(0, entry)
        return True

    def _get_feedback_log(self, rule_id: str) -> list[dict[str, Any]]:
        """读取用户反馈日志(Redis 优先,降级内存)。"""
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_FEEDBACK_LOG_REDIS_PREFIX}{rule_id}"
                raw = redis.lrange(key, 0, -1)
                entries: list[dict[str, Any]] = []
                for r in raw:
                    try:
                        entries.append(json.loads(r))
                    except (json.JSONDecodeError, TypeError):
                        continue
                return entries
            except Exception as e:
                logger.debug("[rules_engine] Redis feedback 读取失败: %s", e)
        with self._lock:
            return list(self._feedback_log.get(rule_id, []))

    @staticmethod
    def _parse_ts(ts: str) -> datetime:
        """解析 ISO timestamp,失败返回 epoch。"""
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    def get_rule_stats(self, rule_id: str) -> dict[str, Any]:
        """返回规则效果统计:命中率(7/30 天)、平均 token 增量、满意度。

        Returns:
            {ruleId, hits7d, hits30d, avgTokenDelta, totalFeedback,
             positiveFeedback, satisfactionRate, matchCount}
        """
        effects = self._get_effect_log(rule_id)
        feedbacks = self._get_feedback_log(rule_id)

        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        hits_7d = sum(
            1 for e in effects if self._parse_ts(e.get("timestamp", "")) >= seven_days_ago
        )
        hits_30d = sum(
            1
            for e in effects
            if self._parse_ts(e.get("timestamp", "")) >= thirty_days_ago
        )

        token_deltas = [int(e.get("tokenDelta", 0) or 0) for e in effects]
        avg_token = (
            sum(token_deltas) / len(token_deltas) if token_deltas else 0.0
        )

        positive = sum(1 for f in feedbacks if f.get("feedback") == "thumbs_up")
        total_feedback = len(feedbacks)
        satisfaction = (
            (positive / total_feedback * 100) if total_feedback > 0 else 0.0
        )

        with self._lock:
            rule = self._rules.get(rule_id)
            match_count = rule.match_count if rule else 0

        return {
            "ruleId": rule_id,
            "hits7d": hits_7d,
            "hits30d": hits_30d,
            "avgTokenDelta": round(avg_token, 1),
            "totalFeedback": total_feedback,
            "positiveFeedback": positive,
            "satisfactionRate": round(satisfaction, 1),
            "matchCount": match_count,
        }

    def ab_test(
        self, rule_id_a: str, rule_id_b: str, message: str
    ) -> dict[str, Any]:
        """A/B 测试:两条规则对同一输入分别应用,返回两份输出供对比。"""
        rule_a = self.get(rule_id_a)
        rule_b = self.get(rule_id_b)
        if not rule_a:
            return {"error": f"规则不存在: {rule_id_a}"}
        if not rule_b:
            return {"error": f"规则不存在: {rule_id_b}"}

        matched_a = self._match_single(rule_a, message)
        matched_b = self._match_single(rule_b, message)

        output_a = (
            f"## {rule_a.name}\n{rule_a.content}" if matched_a else ""
        )
        output_b = (
            f"## {rule_b.name}\n{rule_b.content}" if matched_b else ""
        )

        return {
            "ruleA": {
                "id": rule_a.id,
                "name": rule_a.name,
                "matched": matched_a,
                "output": output_a,
            },
            "ruleB": {
                "id": rule_b.id,
                "name": rule_b.name,
                "matched": matched_b,
                "output": output_b,
            },
            "message": message,
        }

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

    # ── 审计日志(Redis + 内存降级)──────────────────────────

    def _record_audit(
        self,
        action: str,
        rule_id: str,
        rule_name: str,
        user: str = "system",
    ) -> None:
        """记录审计日志(Redis list LPUSH + LTRIM 5000,降级内存)。

        Args:
            action: 操作类型(create/update/delete/test/rollback)
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
        # 写入 Redis(主)
        redis = self._get_redis()
        if redis:
            try:
                redis.lpush(
                    _AUDIT_LOG_REDIS_KEY, json.dumps(entry, ensure_ascii=False)
                )
                redis.ltrim(_AUDIT_LOG_REDIS_KEY, 0, _AUDIT_LOG_REDIS_MAX - 1)
            except Exception as e:
                logger.debug("[rules_engine] Redis 审计日志写入失败: %s", e)
        # 同时写入内存(快速访问)
        with self._lock:
            self._audit_log.append(entry)
            while len(self._audit_log) > _AUDIT_LOG_MAX:
                self._audit_log.pop(0)

    def get_audit_log(self, limit: int = 100) -> dict[str, Any]:
        """返回审计日志(最新 limit 条,倒序)。

        Redis 优先,降级内存。

        Returns:
            {"entries": [...], "total": int}
        """
        redis = self._get_redis()
        if redis:
            try:
                raw = redis.lrange(_AUDIT_LOG_REDIS_KEY, 0, limit - 1)
                entries: list[dict[str, Any]] = []
                for r in raw:
                    try:
                        entries.append(json.loads(r))
                    except (json.JSONDecodeError, TypeError):
                        continue
                total = redis.llen(_AUDIT_LOG_REDIS_KEY)
                return {"entries": entries, "total": total}
            except Exception as e:
                logger.debug("[rules_engine] Redis 审计日志读取失败: %s", e)
        # 内存降级
        with self._lock:
            snapshot = list(self._audit_log)
        total = len(snapshot)
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

    # ── 超越创新:行为学习 + LLM 模式提取 + 冲突协商 + 效果预测 + 知识图谱 ──

    async def _call_llm(
        self, system_prompt: str, user_prompt: str, max_tokens: int = 2000
    ) -> str:
        """调用 LLM,失败返回空字符串(让调用方降级)。

        复用 app.core.llm_gateway.llm_gateway.complete()。
        max_tokens 参数透传给 LiteLLM(若 gateway 支持)。
        """
        try:
            from ..core.llm_gateway import llm_gateway

            resp = await llm_gateway.complete(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            if isinstance(resp, dict):
                return str(resp.get("content", ""))
            return ""
        except Exception as e:
            logger.debug("[rules_engine] LLM 调用失败(降级空字符串): %s", e)
            return ""

    async def _track_behavior(
        self,
        user_id: str,
        action: str,
        rule_id: str,
        details: Optional[dict] = None,
    ) -> None:
        """记录用户行为到 Redis hash(失败降级到内存)。

        action ∈ {create, update, delete, match, feedback, apply}。
        field = timestamp(ms),value = JSON({action, rule_id, details, timestamp})。
        超过 _BEHAVIOR_MAX_ENTRIES 时按 timestamp 删除最早条目。
        """
        entry = {
            "action": action,
            "rule_id": rule_id,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_BEHAVIOR_KEY_PREFIX}{user_id}"
                field = str(int(datetime.now(timezone.utc).timestamp() * 1000))
                redis.hset(key, field, json.dumps(entry, ensure_ascii=False))
                # 超容量时删除最早 field(timestamp 字典序 == 时间序)
                current_count = redis.hlen(key)
                if current_count > _BEHAVIOR_MAX_ENTRIES:
                    all_fields = redis.hkeys(key)
                    all_fields.sort()
                    to_delete = all_fields[: current_count - _BEHAVIOR_MAX_ENTRIES]
                    if to_delete:
                        redis.hdel(key, *to_delete)
                return
            except Exception as e:
                logger.debug("[rules_engine] Redis 行为记录失败: %s", e)
        # 内存降级
        with self._lock:
            self._behavior_fallback.append(entry)
            if len(self._behavior_fallback) > _BEHAVIOR_MAX_ENTRIES:
                self._behavior_fallback = self._behavior_fallback[
                    -_BEHAVIOR_MAX_ENTRIES:
                ]

    async def _get_behaviors(self, user_id: str) -> list[dict[str, Any]]:
        """读取用户行为列表(Redis hash,降级内存),按 timestamp 升序。"""
        redis = self._get_redis()
        if redis:
            try:
                key = f"{_BEHAVIOR_KEY_PREFIX}{user_id}"
                all_values = redis.hgetall(key)
                entries: list[dict[str, Any]] = []
                for value in all_values.values():
                    try:
                        entries.append(json.loads(value))
                    except (json.JSONDecodeError, TypeError):
                        continue
                entries.sort(key=lambda e: e.get("timestamp", ""))
                return entries
            except Exception as e:
                logger.debug("[rules_engine] Redis 行为读取失败: %s", e)
        with self._lock:
            return list(self._behavior_fallback)

    def _extract_patterns_statistical(
        self, behaviors: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """降级:基于行为频率的简单统计(top-3 最常操作的 action+scope 组合)。"""
        from collections import Counter

        counter: Counter[tuple[str, str]] = Counter()
        for b in behaviors:
            action = str(b.get("action", ""))
            details = b.get("details", {}) or {}
            scope = str(details.get("scope", "global"))
            counter[(action, scope)] += 1
        patterns: list[dict[str, Any]] = []
        for (action, scope), count in counter.most_common(3):
            patterns.append(
                {
                    "pattern": (
                        f"用户频繁执行 {action} 操作(scope={scope}),"
                        f"共 {count} 次"
                    ),
                    "suggested_rule": (
                        f"针对 {scope} scope 的 {action} 操作提供建议"
                    ),
                    "confidence": min(count / 10.0, 0.8),
                }
            )
        return patterns

    async def _extract_patterns(self, user_id: str) -> list[dict[str, Any]]:
        """从用户行为提取重复模式(LLM 分析,失败降级为简单统计)。

        样本 < _PATTERN_MIN_SAMPLES 时返回空列表。
        LLM 返回 JSON [{pattern, suggested_rule, confidence}]。
        """
        behaviors = await self._get_behaviors(user_id)
        if len(behaviors) < _PATTERN_MIN_SAMPLES:
            return []
        try:
            llm_resp = await self._call_llm(
                system_prompt=(
                    "你是规则行为分析专家。从用户行为历史中提取重复模式,"
                    "生成建议规则。只输出 JSON 数组,不要额外解释。"
                ),
                user_prompt=(
                    f"用户行为历史(JSON,最近 50 条):\n"
                    f"{json.dumps(behaviors[-50:], ensure_ascii=False, indent=2)}\n\n"
                    f'请输出 JSON 数组:[{{"pattern": str, '
                    f'"suggested_rule": str, "confidence": 0.0-1.0}}]'
                ),
            )
            if llm_resp:
                cleaned = re.sub(r"```(?:json)?\s*", "", llm_resp).strip()
                arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
                if arr_match:
                    patterns = json.loads(arr_match.group())
                    if isinstance(patterns, list):
                        return patterns
        except Exception as e:
            logger.debug("[rules_engine] LLM 模式提取降级: %s", e)
        # 降级:基于行为频率的简单统计
        return self._extract_patterns_statistical(behaviors)

    async def auto_generate_rules(self, user_id: str) -> list[dict[str, Any]]:
        """基于行为模式自动生成规则草稿(不自动创建,返回草稿供用户确认)。

        对 confidence > 0.6 的模式生成草稿。
        Returns:
            [{pattern, draft_rule: {name, description, content, scope}, confidence}]
        """
        patterns = await self._extract_patterns(user_id)
        drafts: list[dict[str, Any]] = []
        for p in patterns:
            confidence = float(p.get("confidence", 0) or 0)
            if confidence <= 0.6:
                continue
            suggested = str(p.get("suggested_rule", ""))
            pattern_desc = str(p.get("pattern", ""))
            draft_rule = {
                "name": suggested[:64] or "auto-generated-rule",
                "description": f"基于模式「{pattern_desc}」自动生成",
                "content": suggested,
                "scope": "global",
            }
            drafts.append(
                {
                    "pattern": pattern_desc,
                    "draft_rule": draft_rule,
                    "confidence": confidence,
                }
            )
        return drafts

    async def _auto_resolve_conflicts(
        self, conflicts: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """LLM 仲裁冲突,失败降级为按 created_at 时间戳保留较新规则。

        输入 detect_conflicts() 的输出。
        Returns:
            [{conflict_id, resolution, reason, action}]
            resolution ∈ {merge, disable, priority_adjust}
        """
        if not conflicts:
            return []
        try:
            llm_resp = await self._call_llm(
                system_prompt=(
                    "你是规则冲突仲裁专家。为每个冲突提供解决方案"
                    "(merge/disable/priority_adjust)。只输出 JSON 数组。"
                ),
                user_prompt=(
                    f"冲突列表(JSON):\n"
                    f"{json.dumps(conflicts, ensure_ascii=False, indent=2)}\n\n"
                    f'请输出 JSON 数组:[{{"conflict_id": int, '
                    f'"resolution": "merge|disable|priority_adjust", '
                    f'"reason": str, "action": str}}]'
                ),
            )
            if llm_resp:
                cleaned = re.sub(r"```(?:json)?\s*", "", llm_resp).strip()
                arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
                if arr_match:
                    resolutions = json.loads(arr_match.group())
                    if isinstance(resolutions, list):
                        return resolutions
        except Exception as e:
            logger.debug("[rules_engine] LLM 冲突仲裁降级: %s", e)
        # 降级:按 created_at 时间戳保留较新规则,禁用较旧规则
        resolutions: list[dict[str, Any]] = []
        for idx, conflict in enumerate(conflicts):
            rule_ids = list(conflict.get("ruleIds", []) or [])
            rules_meta: list[tuple[str, str]] = []
            for rid in rule_ids:
                r = self.get(rid)
                if r:
                    rules_meta.append((rid, r.created_at))
            rules_meta.sort(key=lambda x: x[1], reverse=True)
            keep_id = rules_meta[0][0] if rules_meta else None
            disable_ids = [rid for rid, _ in rules_meta[1:]]
            resolutions.append(
                {
                    "conflict_id": idx,
                    "resolution": "disable",
                    "reason": (
                        f"降级策略:保留最新规则 {keep_id},"
                        f"禁用较旧的 {disable_ids}"
                    ),
                    "action": (
                        f"keep:{keep_id};disable:{','.join(disable_ids)}"
                    ),
                }
            )
        return resolutions

    async def predict_effect(
        self, rule_id: str, dry_run_message: str = ""
    ) -> dict[str, Any]:
        """预测规则应用效果(LLM 预测,失败降级为历史统计)。

        Returns:
            {rule_id, predicted_match_rate, false_positive_risk,
             recommendation, degraded}
        """
        effects = self._get_effect_log(rule_id)
        rule = self.get(rule_id)
        rule_name = rule.name if rule else rule_id

        # 历史统计
        success_rate = 0.0
        if effects:
            token_deltas = [
                int(e.get("tokenDelta", 0) or 0) for e in effects
            ]
            success_rate = (
                sum(1 for t in token_deltas if t > 0) / len(token_deltas)
                if token_deltas
                else 0.0
            )
        avg_match_rate = 1.0 if effects else 0.0

        # LLM 预测
        try:
            context = (
                f"规则名:{rule_name}\n"
                f"规则内容:{rule.content if rule else '未知'}\n"
            )
            if dry_run_message:
                context += f"测试消息:{dry_run_message}\n"
            if effects:
                context += (
                    f"历史效果(最近 5 条):"
                    f"{json.dumps(effects[:5], ensure_ascii=False)}\n"
                )
            llm_resp = await self._call_llm(
                system_prompt=(
                    "你是规则效果预测专家。基于规则内容和历史数据,"
                    "预测应用该规则后的效果。只输出 JSON 对象。"
                ),
                user_prompt=(
                    f"{context}\n"
                    f'请输出 JSON:{{"match_rate": 0.0-1.0, '
                    f'"false_positive_risk": 0.0-1.0, '
                    f'"recommendation": "apply|review|reject"}}'
                ),
            )
            if llm_resp:
                cleaned = re.sub(r"```(?:json)?\s*", "", llm_resp).strip()
                obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
                if obj_match:
                    pred = json.loads(obj_match.group())
                    return {
                        "rule_id": rule_id,
                        "predicted_match_rate": float(
                            pred.get("match_rate", avg_match_rate)
                        ),
                        "false_positive_risk": float(
                            pred.get("false_positive_risk", 0.5)
                        ),
                        "recommendation": str(
                            pred.get("recommendation", "review")
                        ),
                        "degraded": False,
                    }
        except Exception as e:
            logger.debug("[rules_engine] LLM 效果预测降级: %s", e)
        # 降级:基于历史 effect_log 的简单统计
        return {
            "rule_id": rule_id,
            "predicted_match_rate": avg_match_rate,
            "false_positive_risk": 1.0 - success_rate,
            "recommendation": "apply" if success_rate > 0.7 else "review",
            "degraded": True,
        }

    async def _build_knowledge_graph(
        self, scope: Optional[str] = None
    ) -> dict[str, Any]:
        """构建规则知识图谱(基于 embedding cosine 相似度)。

        - sim > _KG_SIM_DUP_THRESHOLD → edge type="duplicate"
        - sim ∈ [_KG_SIM_COMP_THRESHOLD, _KG_SIM_DUP_THRESHOLD] → "complementary"
        - sim < _KG_SIM_CONFLICT_THRESHOLD → edge type="conflict"
        - embedding 失败时降级:只返回节点,无边。

        Returns:
            {nodes: [{id, name, scope, pattern}],
             edges: [{source, target, type, similarity}]}
        """
        self.reload()
        with self._lock:
            all_rules = list(self._rules.values())
        if scope:
            all_rules = [r for r in all_rules if r.scope == scope]

        nodes = [
            {
                "id": r.id,
                "name": r.name,
                "scope": r.scope,
                "pattern": r.match_pattern or "",
            }
            for r in all_rules
        ]

        edges: list[dict[str, Any]] = []
        embeddings: dict[str, list[float]] = {}
        for r in all_rules:
            emb_text = (
                f"{r.name} {r.description or ''} "
                f"{r.match_pattern or ''} {r.content[:200]}"
            )
            emb = await self._get_embedding_async(emb_text)
            if emb:
                embeddings[r.id] = emb

        if len(embeddings) >= 2:
            rule_ids = list(embeddings.keys())
            for i, id1 in enumerate(rule_ids):
                for id2 in rule_ids[i + 1 :]:
                    sim = _cosine_similarity(embeddings[id1], embeddings[id2])
                    if sim > _KG_SIM_DUP_THRESHOLD:
                        edge_type = "duplicate"
                    elif sim >= _KG_SIM_COMP_THRESHOLD:
                        edge_type = "complementary"
                    elif sim < _KG_SIM_CONFLICT_THRESHOLD:
                        edge_type = "conflict"
                    else:
                        continue
                    edges.append(
                        {
                            "source": id1,
                            "target": id2,
                            "type": edge_type,
                            "similarity": round(sim, 3),
                        }
                    )
        return {"nodes": nodes, "edges": edges}

    async def record_learn_feedback(
        self, rule_id: str, feedback: str, accepted: bool
    ) -> bool:
        """记录用户对自动生成规则的反馈(accepted=True 采纳 / False 拒绝)。

        写入 Redis list "rules:learn_feedback:{rule_id}"。
        用于未来 _extract_patterns 的优化(正反馈的模式 confidence 提升)。
        """
        entry = {
            "feedback": feedback,
            "accepted": bool(accepted),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        redis = self._get_redis()
        if redis:
            try:
                key = f"rules:learn_feedback:{rule_id}"
                redis.lpush(key, json.dumps(entry, ensure_ascii=False))
                redis.ltrim(key, 0, _BEHAVIOR_MAX_ENTRIES - 1)
                return True
            except Exception as e:
                logger.debug(
                    "[rules_engine] Redis 学习反馈写入失败: %s", e
                )
        # 内存降级
        with self._lock:
            self._learn_feedback_log.setdefault(rule_id, []).insert(0, entry)
        return True


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
