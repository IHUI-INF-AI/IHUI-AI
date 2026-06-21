"""Bug-107: LLM Prompt 模板缓存.

设计:
  - 模板按 (name, version) 维度存储
  - SHA-256 派生 template_hash 用于内容去重
  - 渲染结果按 (template_hash + variables_hash) 缓存
  - TTL + LRU 双淘汰
  - 模板版本化: 改模板不破坏旧版本, 可回滚
  - 命中率 / miss 率 / 平均渲染耗时统计
"""

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PromptTemplate:
    name: str
    version: int
    body: str
    variables: list[str] = field(default_factory=list)
    description: str = ""
    created_at: float = 0.0
    created_by: str = ""
    template_hash: str = ""

    def to_dict(self) -> dict:
        return self.__dict__.copy()

    @classmethod
    def from_dict(cls, d: dict) -> "PromptTemplate":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

    def compute_hash(self) -> str:
        body = f"{self.name}|{self.version}|{self.body}"
        return hashlib.sha256(body.encode("utf-8")).hexdigest()


@dataclass
class RenderEntry:
    template_hash: str
    variables_hash: str
    rendered: str
    created_at: float
    hit_count: int = 0


class PromptCache:
    """LLM Prompt 模板 + 渲染结果缓存."""

    def __init__(self, max_templates: int = 200, max_renders: int = 2000, default_ttl: float = 600.0):
        self._lock = threading.Lock()
        # 模板: (name, version) -> PromptTemplate
        self._templates: dict[tuple[str, int], PromptTemplate] = {}
        # 模板索引 by name: name -> [versions]
        self._by_name: dict[str, list[int]] = {}
        # 渲染缓存: (template_hash, variables_hash) -> RenderEntry
        self._renders: OrderedDict[tuple[str, str], RenderEntry] = OrderedDict()
        self._max_templates = max_templates
        self._max_renders = max_renders
        self._default_ttl = default_ttl
        # 统计
        self._render_calls = 0
        self._render_hits = 0
        self._render_misses = 0
        self._total_render_ms = 0.0
        # 模板历史
        self._history: deque[tuple[str, int, str, float]] = deque(maxlen=200)  # (name, version, action, ts)

    def _hash_variables(self, variables: dict[str, Any]) -> str:
        # 按 key 排序后序列化, 保证稳定
        body = json.dumps(variables, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(body.encode("utf-8")).hexdigest()

    def add_template(
        self,
        name: str,
        version: int,
        body: str,
        variables: list[str] | None = None,
        description: str = "",
        created_by: str = "system",
    ) -> PromptTemplate:
        tpl = PromptTemplate(
            name=name,
            version=version,
            body=body,
            variables=variables or [],
            description=description,
            created_at=time.time(),
            created_by=created_by,
        )
        tpl.template_hash = tpl.compute_hash()
        with self._lock:
            self._templates[(name, version)] = tpl
            self._by_name.setdefault(name, [])
            if version not in self._by_name[name]:
                self._by_name[name].append(version)
                self._by_name[name].sort()
            self._evict_templates_locked()
            self._history.append((name, version, "add", tpl.created_at))
        return tpl

    def get_template(self, name: str, version: int | None = None) -> PromptTemplate | None:
        with self._lock:
            if version is None:
                versions = self._by_name.get(name, [])
                if not versions:
                    return None
                version = max(versions)
            return self._templates.get((name, version))

    def list_versions(self, name: str) -> list[int]:
        with self._lock:
            return list(self._by_name.get(name, []))

    def latest_version(self, name: str) -> int | None:
        with self._lock:
            versions = self._by_name.get(name, [])
            return max(versions) if versions else None

    def remove_template(self, name: str, version: int | None = None) -> int:
        removed = 0
        with self._lock:
            if version is None:
                versions = list(self._by_name.get(name, []))
                for v in versions:
                    if self._templates.pop((name, v), None) is not None:
                        removed += 1
                self._by_name.pop(name, None)
            else:
                if self._templates.pop((name, version), None) is not None:
                    removed += 1
                    versions = self._by_name.get(name, [])
                    if version in versions:
                        versions.remove(version)
                    if not versions:
                        self._by_name.pop(name, None)
        return removed

    def _render_body(self, tpl: PromptTemplate, variables: dict[str, Any]) -> str:
        # 简单 {var} 替换
        out = tpl.body
        for k, v in variables.items():
            out = out.replace("{" + k + "}", str(v))
        # 同时对 declared variables 做默认空字符串
        for v in tpl.variables:
            if v not in variables:
                out = out.replace("{" + v + "}", "")
        return out

    def render(
        self,
        name: str,
        variables: dict[str, Any],
        version: int | None = None,
        ttl: float | None = None,
    ) -> dict[str, Any]:
        """渲染模板, 命中缓存直接返回."""
        ts_start = time.time()
        tpl = self.get_template(name, version=version)
        if tpl is None:
            return {"ok": False, "error": "template_not_found", "name": name, "version": version}
        th = tpl.template_hash
        vh = self._hash_variables(variables)
        key = (th, vh)
        with self._lock:
            entry = self._renders.get(key)
            now = time.time()
            ttl_eff = ttl if ttl is not None else self._default_ttl
            if entry is not None and (now - entry.created_at) < ttl_eff:
                entry.hit_count += 1
                self._render_hits += 1
                self._render_calls += 1
                self._total_render_ms += (time.time() - ts_start) * 1000
                # 移到末尾 (LRU)
                self._renders.move_to_end(key)
                return {
                    "ok": True,
                    "rendered": entry.rendered,
                    "cache_hit": True,
                    "template_hash": th,
                    "variables_hash": vh,
                    "hit_count": entry.hit_count,
                }
            # 未命中, 渲染
            rendered = self._render_body(tpl, variables)
            entry = RenderEntry(
                template_hash=th,
                variables_hash=vh,
                rendered=rendered,
                created_at=now,
            )
            self._renders[key] = entry
            self._render_misses += 1
            self._render_calls += 1
            self._total_render_ms += (time.time() - ts_start) * 1000
            self._evict_renders_locked()
        return {
            "ok": True,
            "rendered": rendered,
            "cache_hit": False,
            "template_hash": th,
            "variables_hash": vh,
        }

    def invalidate(self, name: str | None = None, version: int | None = None) -> int:
        """失效渲染缓存.

        name+version 指定时, 只失效该模板的所有渲染;
        仅 name 时, 失效该模板所有版本;
        都不传时, 失效全部.
        """
        with self._lock:
            if name is None:
                n = len(self._renders)
                self._renders.clear()
                return n
            target_hashes: set = set()
            for (n, v), tpl in self._templates.items():
                if n == name and (version is None or v == version):
                    target_hashes.add(tpl.template_hash)
            n = 0
            for k in list(self._renders.keys()):
                if k[0] in target_hashes:
                    del self._renders[k]
                    n += 1
        return n

    def _evict_templates_locked(self) -> None:
        if len(self._templates) <= self._max_templates:
            return
        # 按 created_at 排序, 淘汰最老的 (数量 - max) 个
        items = sorted(self._templates.items(), key=lambda kv: kv[1].created_at)
        excess = len(self._templates) - self._max_templates
        for k, _ in items[:excess]:
            del self._templates[k]
            name, v = k
            if name in self._by_name and v in self._by_name[name]:
                self._by_name[name].remove(v)
            if name in self._by_name and not self._by_name[name]:
                del self._by_name[name]

    def _evict_renders_locked(self) -> None:
        if len(self._renders) <= self._max_renders:
            return
        excess = len(self._renders) - self._max_renders
        for _ in range(excess):
            try:
                self._renders.popitem(last=False)
            except KeyError:
                break

    def gc_expired(self, ttl: float | None = None) -> int:
        """清理过期渲染缓存."""
        with self._lock:
            now = time.time()
            ttl_eff = ttl if ttl is not None else self._default_ttl
            n = 0
            for k in list(self._renders.keys()):
                if now - self._renders[k].created_at > ttl_eff:
                    del self._renders[k]
                    n += 1
        return n

    def get_history(self) -> list[tuple[str, int, str, float]]:
        with self._lock:
            return list(self._history)

    def stats(self) -> dict:
        with self._lock:
            hit_rate = self._render_hits / self._render_calls if self._render_calls else 0.0
            avg_ms = self._total_render_ms / self._render_calls if self._render_calls else 0.0
            return {
                "template_count": len(self._templates),
                "template_names": len(self._by_name),
                "render_cache_size": len(self._renders),
                "render_calls": self._render_calls,
                "render_hits": self._render_hits,
                "render_misses": self._render_misses,
                "hit_rate": round(hit_rate, 4),
                "avg_render_ms": round(avg_ms, 4),
                "max_templates": self._max_templates,
                "max_renders": self._max_renders,
                "default_ttl": self._default_ttl,
            }

    def clear(self) -> None:
        with self._lock:
            self._templates.clear()
            self._by_name.clear()
            self._renders.clear()
            self._render_calls = 0
            self._render_hits = 0
            self._render_misses = 0
            self._total_render_ms = 0.0
            self._history.clear()


# 全局单例
prompt_cache = PromptCache()
