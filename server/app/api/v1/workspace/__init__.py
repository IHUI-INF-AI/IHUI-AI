"""
Workspace module — AI Coding 能力的核心入口。

提供:
- 本地文件系统访问层 (FS Bridge): 浏览/打开/最近/目录树/读写
- Agent Runtime: 工具循环 + prompt 构建 + 流式输出
- 统一 LLM 网关: OpenAI Responses + Anthropic Messages + OpenAI 兼容 + 工具调用
- MCP 协议桥接: 工具/资源/prompts 三大原语
- Skills/插件系统: SKILL.md frontmatter + 按需加载
- Hooks 系统: 生命周期事件 (PreToolUse/PostToolUse/SessionStart...)
- 记忆系统: AGENTS.md/CLAUDE.md 持久指令 + 会话记忆 + 项目记忆

对标: Claude Code / Cursor / Codex / Trae
"""

from app.api.v1.workspace.routes import router

__all__ = ["router"]
