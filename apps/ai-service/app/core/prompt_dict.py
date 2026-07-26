"""业务代号字典(G1 字典化闭环 PoC)。

把 IHUI-AI 8 端 + 通用 LLM/Agent 概念映射成短代号,序列化到 system prompt
头部,让 subagent 长任务里反复使用短代号,减少 token 消耗 + 降低假阳性。

设计原则:
- 唯一权威源(参考 koubo_terms.py / brand-glossary.json 的同源规则)
- 短代号(1-3 字符)+ 全称 + 简介 = 单行高密度
- 不动 i18n 5 语言文件(本字典只给 LLM 看,不给用户看)
- 不引入新依赖

典型用法:
    from app.core.prompt_dict import format_domain_dict
    system_prompt = base + format_domain_dict()
"""

from __future__ import annotations

# ════════════════════════════════════════════════
# 1. 组件代号(UI 层)
# ════════════════════════════════════════════════
_COMPONENT_ALIASES: dict[str, str] = {
    "D1": "Dialog 弹窗(shadcn/ui Dialog)",
    "T1": "Toast 提示(sonner)",
    "S1": "Sheet 抽屉(shadcn/ui Sheet)",
    "P1": "Popover 弹出层(shadcn/ui Popover)",
    "C1": "Card 卡片(shadcn/ui Card)",
    "BTN": "Button 按钮(shadcn/ui Button)",
    "INP": "Input 输入框(shadcn/ui Input)",
    "SEL": "Select 下拉选择(shadcn/ui Select)",
    "TAB": "Tabs 标签页(shadcn/ui Tabs)",
    "MOD": "Modal 模态层(语义=D1 的具体类型)",
    "DD":  "DropdownMenu 下拉菜单(shadcn/ui DropdownMenu)",
}

# ════════════════════════════════════════════════
# 2. 渲染代号(Rendering 层)
# ════════════════════════════════════════════════
_RENDER_ALIASES: dict[str, str] = {
    "SSR":  "Server-Side Rendering,服务端直出 HTML,无客户端 JS",
    "CSR":  "Client-Side Rendering,纯客户端渲染(use client)",
    "RSC":  "React Server Component,Next.js 13+ 服务端组件",
    "S1":   "Static 静态渲染(SSR 直出,无交互)— 复用代号,语义=SSR",
    "DYN":  "Dynamic 动态拼接(className 运行时拼)",
    "ISO":  "Isomorphic 同构(SSR + CSR 同一份代码)",
    "HYD":  "Hydration 注水(SSR HTML 在客户端激活)",
    "STR":  "Streaming 流式渲染(SSE/流式响应)",
}

# ════════════════════════════════════════════════
# 3. 端代号(Monorepo 8 端)
# ════════════════════════════════════════════════
_END_ALIASES: dict[str, str] = {
    "W1": "Web 端(apps/web,Next.js 15 + React 19 + Tailwind 4)",
    "A1": "API 端(apps/api,Fastify 5 + Drizzle ORM)",
    "AI": "AI-Service 端(apps/ai-service,FastAPI + LangGraph)",
    "DSK": "Desktop 端(apps/desktop,Tauri 2)",
    "EXT": "Extension 浏览器扩展(apps/extension,WXT)",
    "MOB": "Mobile-RN 端(apps/mobile-rn,React Native)",
    "MIN": "Miniapp-Taro 端(apps/miniapp-taro,微信/抖音/支付宝小程序)",
    "CLI": "CLI 端(apps/cli,Node + Commander)",
    "DB":  "packages/database(Drizzle + PostgreSQL)",
    "AUTH": "packages/auth(共享鉴权)",
    "TYPES": "packages/types(共享 TS 类型)",
    "UI":  "packages/ui(共享 React 组件)",
    "I18N": "packages/i18n(5 语言 zh-CN/zh-TW/ko/ja/en)",
}

# ════════════════════════════════════════════════
# 4. 模块代号(ai-service 内部)
# ════════════════════════════════════════════════
_MODULE_ALIASES: dict[str, str] = {
    "PM":  "Project Memory 项目记忆(.ihui/memory.md / CLAUDE.md / AGENTS.md)",
    "PA":  "Persona Agent(5 个 persona:researcher/coder/reviewer/architect/debugger)",
    "SK":  "Skill 技能(koubo_workflow 等 skills/ 子目录)",
    "AG":  "Agent Loop(agent_loop.py / agent_loop_v2.py)",
    "RAG": "Retrieval-Augmented Generation(rag.py + vector_memory.py)",
    "LTM": "Long-Term Memory(long_term_memory.py 跨会话持久化)",
    "MM":  "Multimodal Memory(多模态图文音视频)",
    "KG":  "Knowledge Graph 知识图谱(knowledge_graph.py)",
    "PR":  "Provider LLM 提供商(apps/ai-service/app/providers/ 16 个)",
    "GW":  "LLM Gateway 网关(llm_gateway.py,LiteLLM 转发)",
    "REG": "Persona Registry(persona_registry.py,JSON Schema 契约)",
    "CBI": "Codebase Indexer(codebase_indexer.py,tree-sitter + embedding)",
    "SCH": "Schema Check(schema_check.py,DB schema 字段对照守门)",
    "MCP": "Model Context Protocol(mcp_server.py,工具/资源/提示词三类 + 工作区白名单 + 全局超时)",
    "LG":  "LangGraph 工作流(langgraph_service.py,StateGraph plan→execute→summarize + checkpoint + interrupt HITL)",
    "A2A": "Agent-to-Agent 任务队列(a2a_service.py,Redis 持久化 + 内存热缓存 + 能力发现)",
    "SIO": "Socket.IO 实时双向通信(sio/handlers.py,/socket.io/* 路径,多端房间广播 + chunk 推送)",
}

# ════════════════════════════════════════════════
# 5. 数据形态代号
# ════════════════════════════════════════════════
_DATA_ALIASES: dict[str, str] = {
    "ZOD":  "Zod schema(TS 运行时校验,apps/api + apps/web)",
    "PYD":  "Pydantic model(Python 运行时校验,apps/ai-service)",
    "JSC":  "JSON Schema(Draft-07,persona_registry / structured_completion)",
    "DTO":  "Data Transfer Object(API 边界对象,@ihui/types 定义)",
    "ORM":  "Drizzle ORM TypeScript 定义(packages/database/src/schema)",
    "SQL":  "原生 SQL(asyncpg 直连,ai-service 用)",
    "VEC":  "Vector Embedding(1536 维,codebase_indexer / vector_memory)",
}

# ════════════════════════════════════════════════
# 6. 合并 + 暴露
# ════════════════════════════════════════════════
DOMAIN_ALIASES: dict[str, str] = {
    **_COMPONENT_ALIASES,
    **_RENDER_ALIASES,
    **_END_ALIASES,
    **_MODULE_ALIASES,
    **_DATA_ALIASES,
}


def format_domain_dict() -> str:
    """序列化为 system prompt 段落。

    Returns:
        多行 markdown 文本,形如:

            ## 业务代号字典
            - D1: Dialog 弹窗(shadcn/ui Dialog)
            - T1: Toast 提示(sonner)
            ...
    """
    lines = ["## 业务代号字典", ""]
    for code, desc in DOMAIN_ALIASES.items():
        lines.append(f"- {code}: {desc}")
    lines.append("")
    lines.append(
        "使用规则:后续指令与代码引用统一用短代号(如 D1/T1/SSR/RSC/PA/RAG/LTM),"
        "不再展开全称,除非首次引入某代号。")
    return "\n".join(lines)


__all__ = ["DOMAIN_ALIASES", "format_domain_dict"]
