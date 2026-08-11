"""Prompt 注册表 — 按 name+version 存储 prompt，支持版本管理、回滚、diff。

存储: 内存 dict 优先，Redis 可用时持久化。
设计:
- 每个 prompt 有 name、versions[]、latest_version
- 每个版本有 content、description、created_at
- 支持回滚(创建新版本，内容为上一版本)
"""

from __future__ import annotations

import copy
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class PromptVersion:
    version: int
    content: str
    description: str = ""
    created_at: str = ""


@dataclass
class PromptEntry:
    name: str
    description: str = ""
    versions: list[PromptVersion] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    @property
    def latest_version(self) -> int:
        return max((v.version for v in self.versions), default=0)

    def get_content(self, version: int | None = None) -> str | None:
        """获取指定版本内容，不传 version 则返回最新版。"""
        if not self.versions:
            return None
        if version is None:
            return self.versions[-1].content
        for v in self.versions:
            if v.version == version:
                return v.content
        return None


class PromptRegistry:
    def __init__(self) -> None:
        self._prompts: dict[str, PromptEntry] = {}
        self._load_defaults()

    def _load_defaults(self) -> None:
        """从默认 prompt 初始化。"""
        for name, info in DEFAULT_PROMPTS.items():
            now = datetime.now(timezone.utc).isoformat()
            entry = PromptEntry(
                name=name,
                description=info.get("description", ""),
                versions=[
                    PromptVersion(
                        version=1,
                        content=info["content"],
                        description="初始版本",
                        created_at=now,
                    )
                ],
                created_at=now,
                updated_at=now,
            )
            self._prompts[name] = entry

    def create(self, name: str, content: str, description: str = "") -> PromptEntry:
        """创建新 prompt。"""
        now = datetime.now(timezone.utc).isoformat()
        entry = PromptEntry(
            name=name,
            description=description,
            versions=[
                PromptVersion(
                    version=1,
                    content=content,
                    description="初始版本",
                    created_at=now,
                )
            ],
            created_at=now,
            updated_at=now,
        )
        self._prompts[name] = entry
        logger.info("Prompt 创建成功: name=%s", name)
        return entry

    def update(self, name: str, content: str, description: str = "") -> PromptEntry:
        """更新 prompt(创建新版本)。"""
        entry = self._prompts.get(name)
        if not entry:
            return self.create(name, content, description)

        now = datetime.now(timezone.utc).isoformat()
        new_version = entry.latest_version + 1
        entry.versions.append(
            PromptVersion(
                version=new_version,
                content=content,
                description=description or f"版本 {new_version}",
                created_at=now,
            )
        )
        entry.updated_at = now
        if description:
            entry.description = description
        logger.info("Prompt 更新成功: name=%s, version=%d", name, new_version)
        return entry

    def get(self, name: str, version: int | None = None) -> str | None:
        """获取 prompt 内容。"""
        entry = self._prompts.get(name)
        if not entry:
            return None
        return entry.get_content(version)

    def rollback(self, name: str, target_version: int) -> PromptEntry:
        """回滚到指定版本(创建新版本，内容为 target_version 内容)。"""
        entry = self._prompts.get(name)
        if not entry:
            raise ValueError(f"Prompt 不存在: {name}")

        content = entry.get_content(target_version)
        if content is None:
            raise ValueError(f"版本 {target_version} 不存在: {name}")

        now = datetime.now(timezone.utc).isoformat()
        new_version = entry.latest_version + 1
        entry.versions.append(
            PromptVersion(
                version=new_version,
                content=content,
                description=f"回滚到版本 {target_version}",
                created_at=now,
            )
        )
        entry.updated_at = now
        logger.info("Prompt 回滚成功: name=%s, target_version=%d, new_version=%d", name, target_version, new_version)
        return entry

    def list_prompts(self) -> list[dict]:
        """列出所有 prompt。"""
        return [
            {
                "name": e.name,
                "description": e.description,
                "latest_version": e.latest_version,
                "versions_count": len(e.versions),
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            }
            for e in self._prompts.values()
        ]

    def get_versions(self, name: str) -> list[dict]:
        """获取指定 prompt 的所有版本。"""
        entry = self._prompts.get(name)
        if not entry:
            return []
        return [
            {
                "version": v.version,
                "content": v.content,
                "description": v.description,
                "created_at": v.created_at,
            }
            for v in entry.versions
        ]

    def delete(self, name: str) -> bool:
        """删除 prompt。"""
        if name in self._prompts:
            del self._prompts[name]
            logger.info("Prompt 删除成功: name=%s", name)
            return True
        return False


# 10 个默认 prompt 内容(从 agent_orchestrator.py 提取，保持完全一致)
DEFAULT_PROMPTS: dict[str, dict[str, str]] = {
    "researcher": {
        "content": (
            "你是研究助手。负责收集信息、调研问题并给出事实性回答。"
            "回答时引用具体来源,不要猜测。"
        ),
        "description": "研究助手:调研任务、收集信息、生成摘要",
    },
    "coder": {
        "content": (
            "你是代码助手。负责实现功能、修复 bug、编写测试。"
            "优先使用 read_file / search_codebase / run_command 等工具探索代码库。"
        ),
        "description": "代码助手:实现功能、修复 bug、写代码",
    },
    "reviewer": {
        "content": (
            "你是代码审查助手。审查代码 diff 并给出具体修改建议。"
            "重点关注正确性、安全性、性能、可读性。"
        ),
        "description": "代码审查助手:审查 diff、给出修改建议",
    },
    "architect": {
        "content": (
            "你是架构师。负责设计系统方案、规划模块结构、定义 API 契约。"
            "输出需包含模块划分、数据流、关键技术决策。"
        ),
        "description": "架构师:设计方案、规划模块、API 契约",
    },
    "debugger": {
        "content": (
            "你是调试助手。负责定位 bug 的根因并给出修复方案。"
            "通过 run_command / read_file / search_codebase 收集证据。"
        ),
        "description": "调试助手:定位 bug、给出修复方案",
    },
    "frontend-dev": {
        "content": (
            "你是前端开发专家。精通 React 19 / Next.js 15 / Tailwind 4 / shadcn/ui。"
            "遵循项目 AGENTS.md 的 UI 约束:compact/elegant、禁止蓝色发光边框、"
            "禁止 rounded-full 容器、禁止分割线。"
            "用 packages/ui 的 Card/Button/Input/Dialog,每个页面 < 250 行。"
            "时间用 Intl.DateTimeFormat,头像用 initials。"
        ),
        "description": "前端开发专家:React/Next.js/Tailwind/shadcn 组件开发,熟悉 SSR/SSG/ISR",
    },
    "backend-dev": {
        "content": (
            "你是后端开发专家。精通 Fastify 5 + Drizzle ORM 0.38 + PostgreSQL + Redis。"
            "遵循项目 AGENTS.md 的后端约束:Zod 校验、复用 packages/auth、"
            "admin 路由用 preHandler、onConflictDoNothing 幂等、"
            "API 响应统一 {code, message, data} 格式。"
        ),
        "description": "后端开发专家:Fastify/Drizzle ORM/PostgreSQL/Redis,熟悉 REST API 设计",
    },
    "devops": {
        "content": (
            "你是 DevOps 工程师。精通 Docker / Turborepo / pnpm workspace / GitHub Actions。"
            "能优化构建速度、设计 CI/CD 流水线、排查部署问题。"
            "遵循项目 AGENTS.md 的验证命令规范:pnpm turbo build typecheck lint test。"
        ),
        "description": "DevOps 工程师:Docker/Turborepo/pnpm workspace/CI/CD,熟悉 monorepo 构建",
    },
    "security-auditor": {
        "content": (
            "你是安全审计专家。精通 OWASP Top 10 / CWE 检测。"
            "重点检查:RCE(new Function/eval)、SSRF(localhost/内网 IP)、"
            "SQL 注入、XSS、硬编码密钥、路径穿越、不安全的反序列化。"
            "输出按严重程度分级(critical/high/medium/low)+ 具体修复建议。"
        ),
        "description": "安全审计专家:OWASP Top 10/CWE 检测,熟悉 RCE/SSRF/SQL注入/XSS 等漏洞模式",
    },
    "test-engineer": {
        "content": (
            "你是测试工程师。精通 Vitest / pytest / Playwright。"
            "遵循项目 AGENTS.md 的测试规范:覆盖默认态/hover 态/active 态/dark mode 态 4 状态。"
            "优先 TDD,测试名用中文描述清晰场景。"
        ),
        "description": "测试工程师:Vitest/pytest/Playwright,熟悉单元/集成/E2E 测试设计",
    },
}


# 全局单例
prompt_registry = PromptRegistry()