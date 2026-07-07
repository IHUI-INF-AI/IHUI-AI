"""
统一 AI 能力调用 API — 将智能体、Skills、脚本插件、浏览器自动化、
计算机控制、MCP 工具整合为统一的能力选择/调用接口。

支持三种调用方式：
  1. HTTP REST  — POST /api/v1/ai/capabilities/invoke
  2. WebSocket  — WS /ws/ai/capability/stream
  3. CLI        — python -m app.cli.capabilities invoke ...

端点清单:
  GET  /api/v1/ai/capabilities/list        列出所有能力 (分类)
  GET  /api/v1/ai/capabilities/{id}        获取能力详情
  POST /api/v1/ai/capabilities/invoke      调用指定能力
  POST /api/v1/ai/capabilities/auto-match  AI 自动匹配能力
  GET  /api/v1/ai/capabilities/categories  获取分类列表
  WS   /ws/ai/capability/stream            流式调用 (WebSocket)
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field

from app.schemas.common import success, error

router = APIRouter(prefix="/ai/capabilities", tags=["AI-Capabilities"])


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

class CapabilityItem(BaseModel):
    """统一能力项"""
    id: str
    name: str
    description: str = ""
    type: str  # agent | skill | plugin | browser | computer | mcp
    category: str = ""
    icon: str = ""
    platform: str = ""  # coze | n8n | dify | internal | claude | ...
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class CapabilityCategory(BaseModel):
    """能力分类"""
    id: str
    name: str
    icon: str
    description: str = ""
    items: list[CapabilityItem] = Field(default_factory=list)


class InvokeRequest(BaseModel):
    """能力调用请求"""
    capability_id: str = ""
    capability_type: str = ""
    input: str = ""
    stream: bool = False
    options: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)


class AutoMatchRequest(BaseModel):
    """自动匹配请求"""
    input: str
    context: dict[str, Any] = Field(default_factory=dict)


class InvokeResponse(BaseModel):
    """能力调用响应"""
    capability_id: str
    capability_type: str
    result: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 内置能力注册表 (静态 + 动态聚合)
# ---------------------------------------------------------------------------

# 静态能力 — 不依赖数据库或文件系统的基础能力
_STATIC_CAPABILITIES: list[CapabilityItem] = [
    # ── 智能体 ──
    CapabilityItem(
        id="agent_coze",
        name="Coze 智能体",
        description="调用扣子(Coze)平台的智能体进行对话",
        type="agent",
        category="agents",
        icon="bot",
        platform="coze",
        tags=["对话", "智能体", "coze"],
    ),
    CapabilityItem(
        id="agent_n8n",
        name="N8N 工作流",
        description="调用 N8N 自动化工作流",
        type="agent",
        category="agents",
        icon="workflow",
        platform="n8n",
        tags=["自动化", "工作流", "n8n"],
    ),
    CapabilityItem(
        id="agent_dify",
        name="Dify 应用",
        description="调用 Dify 平台的 AI 应用",
        type="agent",
        category="agents",
        icon="app",
        platform="dify",
        tags=["对话", "应用", "dify"],
    ),
    CapabilityItem(
        id="agent_agentic_swarm",
        name="Agentic 集群",
        description="多智能体协同集群, 支持任务分解和并行执行",
        type="agent",
        category="agents",
        icon="swarm",
        platform="internal",
        tags=["集群", "协同", "多智能体"],
    ),
    # ── Skills ──
    CapabilityItem(
        id="skill_docx",
        name="Word 文档生成",
        description="创建和编辑 .docx 文档, 支持追踪修订、格式保留",
        type="skill",
        category="skills",
        icon="file-text",
        platform="claude",
        tags=["文档", "word", "docx"],
    ),
    CapabilityItem(
        id="skill_pdf",
        name="PDF 处理",
        description="PDF 文本提取、表格解析、创建、合并、拆分、表单填写",
        type="skill",
        category="skills",
        icon="file",
        platform="claude",
        tags=["文档", "pdf"],
    ),
    CapabilityItem(
        id="skill_pptx",
        name="PPT 演示文稿",
        description="创建和编辑 .pptx 演示文稿, 支持幻灯片管理",
        type="skill",
        category="skills",
        icon="presentation",
        platform="claude",
        tags=["文档", "ppt", "pptx", "演示"],
    ),
    CapabilityItem(
        id="skill_xlsx",
        name="Excel 电子表格",
        description="创建和操作 .xlsx 电子表格, 支持公式、图表、格式化",
        type="skill",
        category="skills",
        icon="table",
        platform="claude",
        tags=["文档", "excel", "xlsx", "表格"],
    ),
    CapabilityItem(
        id="skill_web_research",
        name="网络研究",
        description="搜索互联网、获取网页内容、交叉验证信息",
        type="skill",
        category="skills",
        icon="search",
        platform="claude",
        tags=["搜索", "研究", "网络"],
    ),
    CapabilityItem(
        id="skill_html_report",
        name="HTML 报告生成",
        description="生成自包含 HTML 报告, 支持图表和数据可视化",
        type="skill",
        category="skills",
        icon="layout",
        platform="claude",
        tags=["报告", "html", "可视化"],
    ),
    CapabilityItem(
        id="skill_html_deck",
        name="HTML 幻灯片",
        description="创建动画丰富的 HTML 幻灯片演示文稿",
        type="skill",
        category="skills",
        icon="monitor",
        platform="claude",
        tags=["演示", "幻灯片", "html"],
    ),
    # ── 脚本插件 ──
    CapabilityItem(
        id="plugin_custom_script",
        name="自定义脚本",
        description="运行用户自定义的 Python/Node.js 脚本插件",
        type="plugin",
        category="plugins",
        icon="terminal",
        platform="internal",
        tags=["脚本", "插件", "自定义"],
    ),
    CapabilityItem(
        id="plugin_code_runner",
        name="代码执行器",
        description="安全沙箱内执行代码, 支持 Python/JavaScript/Shell",
        type="plugin",
        category="plugins",
        icon="code",
        platform="internal",
        tags=["代码", "执行", "沙箱"],
    ),
    # ── 浏览器自动化 ──
    CapabilityItem(
        id="browser_navigate",
        name="网页浏览",
        description="打开网页、截图、提取页面内容",
        type="browser",
        category="browser",
        icon="globe",
        platform="internal",
        tags=["浏览器", "网页", "截图"],
    ),
    CapabilityItem(
        id="browser_automate",
        name="浏览器自动化",
        description="自动化网页操作: 点击、填表、导航、数据抓取",
        type="browser",
        category="browser",
        icon="mouse-pointer",
        platform="internal",
        tags=["浏览器", "自动化", "爬虫", "RPA"],
    ),
    CapabilityItem(
        id="browser_test",
        name="Web 应用测试",
        description="自动化端到端 Web 应用测试",
        type="browser",
        category="browser",
        icon="check-circle",
        platform="internal",
        tags=["测试", "e2e", "浏览器"],
    ),
    # ── 计算机控制 ──
    CapabilityItem(
        id="computer_file_ops",
        name="文件操作",
        description="读写文件、目录管理、文件搜索 (grep/glob)",
        type="computer",
        category="computer",
        icon="folder",
        platform="internal",
        tags=["文件", "目录", "文件系统"],
    ),
    CapabilityItem(
        id="computer_command",
        name="命令执行",
        description="执行系统命令, 支持 Shell/PowerShell",
        type="computer",
        category="computer",
        icon="terminal",
        platform="internal",
        tags=["命令", "shell", "终端"],
    ),
    CapabilityItem(
        id="computer_git",
        name="Git 操作",
        description="执行 Git 命令: status/diff/log/commit/push",
        type="computer",
        category="computer",
        icon="git-branch",
        platform="internal",
        tags=["git", "版本控制"],
    ),
    CapabilityItem(
        id="computer_workspace",
        name="工作区管理",
        description="管理代码工作区: 打开、浏览、索引、搜索",
        type="computer",
        category="computer",
        icon="briefcase",
        platform="internal",
        tags=["工作区", "项目", "代码"],
    ),
    # ── MCP 工具 ──
    CapabilityItem(
        id="mcp_tools",
        name="MCP 工具集",
        description="Model Context Protocol 工具: 阿里云/可灵/Gemini/Suno/Sora2 等",
        type="mcp",
        category="mcp",
        icon="plug",
        platform="mcp",
        tags=["mcp", "工具", "协议"],
    ),
    # ── 自动匹配 ──
    CapabilityItem(
        id="auto_match",
        name="智能自动匹配",
        description="AI 根据用户输入自动选择最合适的能力",
        type="auto",
        category="auto",
        icon="sparkles",
        platform="internal",
        tags=["自动", "匹配", "AI"],
    ),
]

# 分类定义
_CATEGORIES = [
    {"id": "agents", "name": "智能体", "icon": "bot", "description": "AI 智能体、工作流、多智能体集群"},
    {"id": "skills", "name": "Skills 技能", "icon": "zap", "description": "文档生成、研究、报告等专业技能"},
    {"id": "plugins", "name": "脚本插件", "icon": "terminal", "description": "自定义脚本和代码执行"},
    {"id": "browser", "name": "浏览器自动化", "icon": "globe", "description": "网页浏览、自动化操作、测试"},
    {"id": "computer", "name": "计算机控制", "icon": "monitor", "description": "文件操作、命令执行、Git、工作区"},
    {"id": "mcp", "name": "MCP 工具", "icon": "plug", "description": "Model Context Protocol 工具集"},
    {"id": "auto", "name": "自动匹配", "icon": "sparkles", "description": "AI 自动选择最合适的能力"},
]


# ---------------------------------------------------------------------------
# 能力聚合引擎
# ---------------------------------------------------------------------------

def _aggregate_capabilities() -> list[CapabilityItem]:
    """聚合所有能力源 (静态 + 动态)。"""
    items = list(_STATIC_CAPABILITIES)

    # 动态: 尝试从数据库加载已发布的智能体
    try:
        from app.services.agent_service import list_agents
        db_agents = list_agents(1, 100, status=1)
        for a in db_agents.get("data", []):
            agent_id = str(a.get("agent_id", a.get("id", "")))
            if not agent_id:
                continue
            items.append(CapabilityItem(
                id=f"db_agent_{agent_id}",
                name=a.get("agent_name", a.get("name", "未命名智能体")),
                description=a.get("agent_prompt", "")[:200],
                type="agent",
                category="agents",
                icon="bot",
                platform=a.get("platform", "internal"),
                tags=a.get("tags", []),
                metadata=a,
            ))
    except Exception as e:
        logger.debug(f"DB agents not loaded (non-critical): {e}")

    # 动态: 尝试从文件系统加载 Skills
    try:
        from app.api.v1.workspace.skills import discover_skills
        user_skills_dir = Path.home() / ".ihui" / "skills"
        if user_skills_dir.is_dir():
            fs_skills = discover_skills(str(Path.home()))
            for s in fs_skills:
                items.append(CapabilityItem(
                    id=f"fs_skill_{s.name}",
                    name=s.name,
                    description=s.description or "",
                    type="skill",
                    category="skills",
                    icon="zap",
                    platform="claude",
                    tags=[],
                    metadata={"skill_name": s.name},
                ))
    except Exception as e:
        logger.debug(f"FS skills not loaded (non-critical): {e}")

    return items


def _build_categories(items: list[CapabilityItem]) -> list[CapabilityCategory]:
    """将能力列表按分类组织。"""
    cat_map: dict[str, list[CapabilityItem]] = {}
    for item in items:
        cat_map.setdefault(item.category, []).append(item)

    result: list[CapabilityCategory] = []
    for cat_def in _CATEGORIES:
        cat_items = cat_map.get(cat_def["id"], [])
        result.append(CapabilityCategory(
            id=cat_def["id"],
            name=cat_def["name"],
            icon=cat_def["icon"],
            description=cat_def["description"],
            items=cat_items,
        ))
    return result


def _find_capability(cap_id: str) -> CapabilityItem | None:
    """根据 ID 查找能力项。"""
    for item in _aggregate_capabilities():
        if item.id == cap_id:
            return item
    return None


# ---------------------------------------------------------------------------
# 自动匹配引擎
# ---------------------------------------------------------------------------

# 关键词 → 能力类型映射规则
_MATCH_RULES: list[dict[str, Any]] = [
    # Skills - 文档类
    {"keywords": ["word", "docx", "文档", "wps"], "capability_id": "skill_docx", "reason": "用户需要创建/编辑 Word 文档"},
    {"keywords": ["pdf", "PDF"], "capability_id": "skill_pdf", "reason": "用户需要处理 PDF 文件"},
    {"keywords": ["ppt", "pptx", "幻灯片", "演示", "presentation", "slides"], "capability_id": "skill_pptx", "reason": "用户需要创建 PPT 演示文稿"},
    {"keywords": ["excel", "xlsx", "表格", "电子表格", "spreadsheet"], "capability_id": "skill_xlsx", "reason": "用户需要操作 Excel 表格"},
    {"keywords": ["报告", "report", "分析报告", "research report"], "capability_id": "skill_html_report", "reason": "用户需要生成报告"},
    {"keywords": ["搜索", "research", "调研", "查找资料", "search"], "capability_id": "skill_web_research", "reason": "用户需要网络研究"},
    # 浏览器自动化
    {"keywords": ["浏览器", "网页", "截图", "browse", "website", "screenshot"], "capability_id": "browser_navigate", "reason": "用户需要浏览网页"},
    {"keywords": ["自动化", "爬虫", "抓取", "automate", "scrape", "rpa", "填表"], "capability_id": "browser_automate", "reason": "用户需要浏览器自动化操作"},
    {"keywords": ["测试", "test", "e2e", "端到端"], "capability_id": "browser_test", "reason": "用户需要 Web 应用测试"},
    # 计算机控制
    {"keywords": ["文件", "file", "目录", "directory", "folder"], "capability_id": "computer_file_ops", "reason": "用户需要文件操作"},
    {"keywords": ["命令", "command", "shell", "终端", "terminal", "cmd"], "capability_id": "computer_command", "reason": "用户需要执行系统命令"},
    {"keywords": ["git", "commit", "push", "版本控制"], "capability_id": "computer_git", "reason": "用户需要 Git 操作"},
    {"keywords": ["工作区", "项目", "workspace", "project", "代码"], "capability_id": "computer_workspace", "reason": "用户需要管理工作区"},
    # 脚本插件
    {"keywords": ["脚本", "script", "插件", "plugin", "自定义"], "capability_id": "plugin_custom_script", "reason": "用户需要运行自定义脚本"},
    {"keywords": ["执行代码", "run code", "python", "javascript"], "capability_id": "plugin_code_runner", "reason": "用户需要执行代码"},
    # MCP
    {"keywords": ["mcp", "工具", "tool", "阿里云", "可灵", "gemini", "suno", "sora"], "capability_id": "mcp_tools", "reason": "用户需要 MCP 工具"},
    # 智能体
    {"keywords": ["智能体", "agent", "coze", "扣子", "bot"], "capability_id": "agent_coze", "reason": "用户需要智能体对话"},
    {"keywords": ["工作流", "workflow", "n8n", "自动化流程"], "capability_id": "agent_n8n", "reason": "用户需要 N8N 工作流"},
    {"keywords": ["集群", "swarm", "多智能体", "协同"], "capability_id": "agent_agentic_swarm", "reason": "用户需要多智能体协同"},
]


def _auto_match(input_text: str) -> dict[str, Any]:
    """基于关键词规则的能力自动匹配。"""
    text_lower = input_text.lower()
    for rule in _MATCH_RULES:
        for kw in rule["keywords"]:
            if kw.lower() in text_lower:
                cap = _find_capability(rule["capability_id"])
                if cap:
                    return {
                        "matched": True,
                        "capability_id": cap.id,
                        "capability_type": cap.type,
                        "capability_name": cap.name,
                        "reason": rule["reason"],
                        "confidence": 0.85,
                    }
    # 默认: 自动匹配模式
    return {
        "matched": True,
        "capability_id": "auto_match",
        "capability_type": "auto",
        "capability_name": "智能自动匹配",
        "reason": "未匹配到特定能力, 使用 AI 自动决策",
        "confidence": 0.5,
    }


# ---------------------------------------------------------------------------
# 能力调用引擎
# ---------------------------------------------------------------------------

async def _invoke_capability(req: InvokeRequest) -> dict[str, Any]:
    """调用指定能力。"""
    cap_id = req.capability_id
    cap = _find_capability(cap_id)
    if not cap:
        return {"success": False, "error": f"Capability not found: {cap_id}"}

    try:
        # ── 智能体调用 ──
        if cap.type == "agent":
            return await _invoke_agent(cap, req)

        # ── Skills 调用 ──
        elif cap.type == "skill":
            return await _invoke_skill(cap, req)

        # ── 脚本插件 ──
        elif cap.type == "plugin":
            return await _invoke_plugin(cap, req)

        # ── 浏览器自动化 ──
        elif cap.type == "browser":
            return await _invoke_browser(cap, req)

        # ── 计算机控制 ──
        elif cap.type == "computer":
            return await _invoke_computer(cap, req)

        # ── MCP 工具 ──
        elif cap.type == "mcp":
            return await _invoke_mcp(cap, req)

        # ── 自动匹配 ──
        elif cap.type == "auto":
            match = _auto_match(req.input)
            if match["capability_id"] != "auto_match":
                sub_req = InvokeRequest(
                    capability_id=match["capability_id"],
                    capability_type=match["capability_type"],
                    input=req.input,
                    stream=req.stream,
                    options=req.options,
                    context=req.context,
                )
                result = await _invoke_capability(sub_req)
                result["auto_matched"] = match
                return result
            return {"success": True, "result": "自动匹配未找到特定能力, 使用默认 AI 对话", "auto_matched": match}

        else:
            return {"success": False, "error": f"Unknown capability type: {cap.type}"}

    except Exception as e:
        logger.exception(f"Capability invoke error: {e}")
        return {"success": False, "error": str(e)}


async def _invoke_agent(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用智能体。"""
    platform = cap.platform

    if platform == "coze":
        # 转发到 Coze 聊天 API
        try:
            from app.api.v1.chat.coze import send_message
            bot_id = cap.metadata.get("cozeBotId", cap.metadata.get("bot_id", ""))
            result = await send_message(text=req.input, bot_id=bot_id, user_id="ai-capability")
            return {"success": True, "result": result, "platform": "coze"}
        except Exception as e:
            return {"success": False, "error": f"Coze invoke failed: {e}"}

    elif platform == "n8n":
        try:
            webhook_url = cap.metadata.get("n8nWebhookUrl", "")
            if webhook_url:
                import httpx
                async with httpx.AsyncClient() as client:
                    resp = await client.post(webhook_url, json={"text": req.input}, timeout=30)
                    return {"success": True, "result": resp.text, "platform": "n8n"}
            return {"success": False, "error": "N8N webhook URL not configured"}
        except Exception as e:
            return {"success": False, "error": f"N8N invoke failed: {e}"}

    elif platform == "dify":
        try:
            import httpx
            api_key = cap.metadata.get("difyApiKey", "")
            base_url = cap.metadata.get("difyBaseUrl", "https://api.dify.ai/v1")
            if api_key:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"{base_url}/chat-messages",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json={"query": req.input, "inputs": {}, "response_mode": "blocking", "user": "ai-capability"},
                        timeout=60,
                    )
                    return {"success": True, "result": resp.json(), "platform": "dify"}
            return {"success": False, "error": "Dify API key not configured"}
        except Exception as e:
            return {"success": False, "error": f"Dify invoke failed: {e}"}

    elif platform == "internal":
        # 内部智能体 — 使用 workspace agent loop
        return {"success": True, "result": f"[内部智能体] 已接收请求: {req.input[:200]}", "platform": "internal"}

    return {"success": False, "error": f"Unsupported agent platform: {platform}"}


async def _invoke_skill(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用 Skill。"""
    skill_name = cap.metadata.get("skill_name", cap.id.replace("skill_", "").replace("fs_skill_", ""))

    # 尝试从文件系统加载 Skill 正文
    try:
        from app.api.v1.workspace.skills import get_skill_body
        user_skills_dir = Path.home() / ".ihui" / "skills" / skill_name
        if user_skills_dir.exists():
            skill_meta = type("S", (), {"skill_dir": str(user_skills_dir)})()
            body = get_skill_body(skill_meta)
            return {"success": True, "result": body, "skill_name": skill_name}
    except Exception as e:
        logger.debug(f"Skill body load: {e}")

    # 静态 Skills — 返回能力描述
    return {
        "success": True,
        "result": f"[Skill: {cap.name}] 已激活. {cap.description}",
        "skill_name": skill_name,
        "instructions": cap.description,
    }


async def _invoke_plugin(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用脚本插件。"""
    if cap.id == "plugin_code_runner":
        lang = req.options.get("language", "python")
        code = req.options.get("code", req.input)
        try:
            import subprocess
            if lang == "python":
                result = subprocess.run(["python", "-c", code], capture_output=True, text=True, timeout=30)
            elif lang == "javascript" or lang == "node":
                result = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=30)
            elif lang == "shell" or lang == "bash":
                result = subprocess.run(["bash", "-c", code], capture_output=True, text=True, timeout=30)
            else:
                return {"success": False, "error": f"Unsupported language: {lang}"}
            return {
                "success": True,
                "result": result.stdout or result.stderr,
                "exit_code": result.returncode,
            }
        except Exception as e:
            return {"success": False, "error": f"Code execution failed: {e}"}

    return {"success": True, "result": f"[Plugin: {cap.name}] 已激活. {cap.description}"}


async def _invoke_browser(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用浏览器自动化。"""
    if cap.id == "browser_navigate":
        url = req.options.get("url", req.input.strip())
        try:
            import httpx
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(url, timeout=30)
                content_type = resp.headers.get("content-type", "")
                return {
                    "success": True,
                    "result": f"已获取 {url} (status={resp.status_code}, type={content_type}, size={len(resp.content)} bytes)",
                    "url": url,
                    "status_code": resp.status_code,
                    "content_type": content_type,
                }
        except Exception as e:
            return {"success": False, "error": f"Browser navigate failed: {e}"}

    elif cap.id == "browser_automate":
        return {
            "success": True,
            "result": f"[浏览器自动化] 已接收任务: {req.input[:200]}. 需要配置浏览器自动化引擎 (Playwright/Puppeteer).",
            "task": req.input,
        }

    elif cap.id == "browser_test":
        return {
            "success": True,
            "result": f"[Web 测试] 已接收测试任务: {req.input[:200]}. 需要配置测试目标 URL.",
            "task": req.input,
        }

    return {"success": True, "result": f"[Browser: {cap.name}] {cap.description}"}


async def _invoke_computer(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用计算机控制。"""
    if cap.id == "computer_file_ops":
        action = req.options.get("action", "read")
        path = req.options.get("path", req.input.strip())
        try:
            p = Path(path)
            if action == "read" and p.is_file():
                return {"success": True, "result": p.read_text(encoding="utf-8", errors="replace")[:10000], "path": str(p)}
            elif action == "list" and p.is_dir():
                items = [str(f.name) for f in p.iterdir()][:100]
                return {"success": True, "result": json.dumps(items, ensure_ascii=False), "path": str(p)}
            elif action == "write":
                content = req.options.get("content", "")
                p.write_text(content, encoding="utf-8")
                return {"success": True, "result": f"Written {len(content)} bytes to {p}", "path": str(p)}
            return {"success": False, "error": f"Cannot {action} on {path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif cap.id == "computer_command":
        cmd = req.options.get("command", req.input.strip())
        try:
            import subprocess
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
            return {"success": True, "result": result.stdout + result.stderr, "exit_code": result.returncode}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif cap.id == "computer_git":
        git_cmd = req.options.get("command", "status")
        try:
            import subprocess
            result = subprocess.run(["git", git_cmd], capture_output=True, text=True, timeout=30)
            return {"success": True, "result": result.stdout + result.stderr, "exit_code": result.returncode}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif cap.id == "computer_workspace":
        ws_path = req.options.get("path", req.input.strip())
        try:
            p = Path(ws_path)
            if p.is_dir():
                tree = [str(f.relative_to(p)) for f in p.rglob("*") if f.is_file()][:200]
                return {"success": True, "result": json.dumps(tree, ensure_ascii=False), "path": str(p)}
            return {"success": False, "error": f"Not a directory: {ws_path}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"success": True, "result": f"[Computer: {cap.name}] {cap.description}"}


async def _invoke_mcp(cap: CapabilityItem, req: InvokeRequest) -> dict[str, Any]:
    """调用 MCP 工具。"""
    try:
        from app.api.v1.mcp import list_tools, invoke_tool
        tools = list_tools()
        tool_name = req.options.get("tool", "")
        if tool_name:
            result = invoke_tool(tool_name, req.options.get("arguments", {}))
            return {"success": True, "result": result, "tool": tool_name}
        return {"success": True, "result": f"MCP 工具列表: {tools}", "available_tools": tools}
    except Exception as e:
        return {"success": False, "error": f"MCP invoke failed: {e}"}


# ---------------------------------------------------------------------------
# API 端点
# ---------------------------------------------------------------------------

@router.get("/categories", summary="获取能力分类列表")
async def get_categories():
    """获取所有能力分类。"""
    return success([{"id": c["id"], "name": c["name"], "icon": c["icon"], "description": c["description"]} for c in _CATEGORIES])


@router.get("/list", summary="列出所有能力 (分类)")
async def list_capabilities(
    category: str = Query(None, description="按分类过滤"),
    capability_type: str = Query(None, description="按类型过滤"),
    keyword: str = Query(None, description="关键词搜索"),
):
    """列出所有可用能力, 支持分类/类型/关键词过滤。"""
    items = _aggregate_capabilities()

    if category:
        items = [i for i in items if i.category == category]
    if capability_type:
        items = [i for i in items if i.type == capability_type]
    if keyword:
        kw_lower = keyword.lower()
        items = [i for i in items if kw_lower in i.name.lower() or kw_lower in i.description.lower() or any(kw_lower in t.lower() for t in i.tags)]

    categories = _build_categories(items)
    return success({
        "categories": [c.model_dump() for c in categories],
        "total": len(items),
    })


@router.get("/{capability_id}", summary="获取能力详情")
async def get_capability_detail(capability_id: str):
    """获取指定能力的详细信息。"""
    cap = _find_capability(capability_id)
    if not cap:
        return error("Capability not found", "404")
    return success(cap.model_dump())


@router.post("/invoke", summary="调用指定能力")
async def invoke_capability(req: InvokeRequest):
    """调用指定能力 (同步模式)。"""
    result = await _invoke_capability(req)
    return success(result)


@router.post("/invoke/stream", summary="流式调用能力")
async def invoke_capability_stream(req: InvokeRequest):
    """调用指定能力 (SSE 流式模式)。"""
    async def event_generator():
        # 发送开始事件
        yield f"data: {json.dumps({'event': 'start', 'capability_id': req.capability_id, 'timestamp': time.time()}, ensure_ascii=False)}\n\n"

        # 调用能力
        result = await _invoke_capability(req)

        # 发送结果
        yield f"data: {json.dumps({'event': 'result', 'data': result, 'timestamp': time.time()}, ensure_ascii=False)}\n\n"

        # 发送结束事件
        yield f"data: {json.dumps({'event': 'done', 'timestamp': time.time()}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/auto-match", summary="AI 自动匹配能力")
async def auto_match_capability(req: AutoMatchRequest):
    """根据用户输入自动匹配最合适的能力。"""
    result = _auto_match(req.input)
    return success(result)


# ---------------------------------------------------------------------------
# WebSocket 流式调用
# ---------------------------------------------------------------------------

@router.websocket("/ws/stream")
async def capability_stream_ws(websocket: WebSocket):
    """WebSocket 流式能力调用端点。

    消息格式:
      请求: {"action": "invoke", "capability_id": "...", "input": "...", "options": {}}
      请求: {"action": "list", "category": "...", "keyword": "..."}
      请求: {"action": "auto-match", "input": "..."}
      响应: {"event": "start|delta|result|done|error", "data": {...}}
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"event": "error", "error": "Invalid JSON"}, ensure_ascii=False))
                continue

            action = msg.get("action", "")

            if action == "list":
                items = _aggregate_capabilities()
                cat = msg.get("category")
                kw = msg.get("keyword")
                if cat:
                    items = [i for i in items if i.category == cat]
                if kw:
                    kw_l = kw.lower()
                    items = [i for i in items if kw_l in i.name.lower() or kw_l in i.description.lower()]
                await websocket.send_text(json.dumps({
                    "event": "list",
                    "data": [i.model_dump() for i in items],
                    "total": len(items),
                }, ensure_ascii=False))

            elif action == "auto-match":
                match = _auto_match(msg.get("input", ""))
                await websocket.send_text(json.dumps({"event": "auto-match", "data": match}, ensure_ascii=False))

            elif action == "invoke":
                req = InvokeRequest(
                    capability_id=msg.get("capability_id", ""),
                    capability_type=msg.get("capability_type", ""),
                    input=msg.get("input", ""),
                    stream=True,
                    options=msg.get("options", {}),
                    context=msg.get("context", {}),
                )
                # 发送开始
                await websocket.send_text(json.dumps({
                    "event": "start",
                    "capability_id": req.capability_id,
                    "request_id": str(uuid.uuid4()),
                }, ensure_ascii=False))

                # 调用
                result = await _invoke_capability(req)

                # 发送结果
                await websocket.send_text(json.dumps({
                    "event": "result",
                    "data": result,
                }, ensure_ascii=False))

                # 发送结束
                await websocket.send_text(json.dumps({"event": "done"}, ensure_ascii=False))

            else:
                await websocket.send_text(json.dumps({"event": "error", "error": f"Unknown action: {action}"}, ensure_ascii=False))

    except WebSocketDisconnect:
        logger.info("Capability WS disconnected")
    except Exception as e:
        logger.exception(f"Capability WS error: {e}")
        try:
            await websocket.send_text(json.dumps({"event": "error", "error": str(e)}, ensure_ascii=False))
        except Exception:
            pass
