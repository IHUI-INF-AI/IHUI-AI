import { createDb } from '../src/client.js'
import { resources, resourceCategories } from '../src/schema/resource.js'
import { eq } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// AI 教学资源种子数据
// 来源：历史项目 D:\历史项目存档\edu client\data\ 目录下的 JSON 文件
// 已迁移: mcp-tutorials.json (28 条) + ai-agent-tutorials.json (20 条) + clawdbot-resources.json (35 条)
// 本次新增: ai-coding-communities.json + claude-code-tutorials.json + cursor-skills-tutorials.json
//          + vibe-coding-tutorials.json + prompt-engineering-tutorials.json + ai-coding-tools-comparison.json
//          + clawdbot-import-articles.json + clawdbot-import-resources.json
const aiTutorials = [
  // ========== MCP 教程 (来源: mcp-tutorials.json) ==========
  // 视频资源
  {
    title: 'Cursor+MCP配置保姆级教程：手把手教你配置任意MCP服务',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.bilibili.com/video/BV1vwXPYkEGx/',
    description:
      'Windows环境下MCP配置详细教程，包括filesystem和claudecode服务器配置，解决Cursor无法写入文件问题',
  },
  {
    title: 'MCP入门实践：Cursor+MCP',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.bilibili.com/video/BV1t9QDY8EQj/',
    description: 'MCP入门实践教程，涉及Java编程应用和AI编程工作流',
  },
  {
    title: 'Claude 3.7 + Cursor + MCP：多AI员工协作',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.bilibili.com/video/BV1rqPYehEsS/',
    description: '介绍Claude 3.7推理模型与Cursor中的MCP服务调用，实现多个AI员工同时协助工作',
  },
  {
    title: 'How to Build MCP Servers That Give AI Superpowers',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://youtube.com/watch?v=inkTWM71EiY',
    description: '完整MCP Server开发教程，涵盖架构、环境搭建、构建步骤和Claude Desktop测试',
  },
  {
    title: 'Build ANYTHING with MCP Servers - Coding Tutorial',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.youtube.com/watch?v=sMqlObpNz64',
    description: '13.5分钟快速教程，涵盖MCP基础、服务器设置、TypeScript SDK使用和GitHub/Slack集成',
  },
  {
    title: 'Build Your Own MCP Server & Client – Run Locally',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.youtube.com/watch?v=03P9Y99bhLo',
    description: '17分钟教程，从零构建MCP服务器和客户端，本地运行，包含AI Agent设置技巧',
  },
  {
    title: 'Develop MCP server from scratch - Complete Hands-on End-to-End',
    category: 'mcp',
    type: 'video',
    source: 'mcp-tutorials.json',
    url: 'https://www.youtube.com/watch?v=JGBNM1W4HAc',
    description: '从零开始开发MCP服务器完整实战教程，构建文档服务器并连接Claude Desktop',
  },
  // 文章资源
  {
    title: 'MCP 学习路径：从零基础到精通',
    category: 'mcp',
    type: 'article',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/learning-path/',
    description:
      '官方推荐的MCP学习路径，分为4个阶段：理解MCP(1-2h)、使用MCP(2-3h)、自行构建(4-6h)、持续进阶',
  },
  {
    title: 'MCP 官方教程合集',
    category: 'mcp',
    type: 'article',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/tutorials/',
    description:
      '官方教程，包括使用LLM构建MCP、构建MCP客户端(Python/Node.js)、为智能体编写有效工具等',
  },
  {
    title: 'OpenAI Agents Python SDK - MCP集成',
    category: 'mcp',
    type: 'article',
    source: 'mcp-tutorials.json',
    url: 'https://openai.github.io/openai-agents-python/zh/mcp/',
    description: 'OpenAI Agents SDK的MCP集成指南，支持托管MCP服务、Streamable HTTP、SSE和stdio传输',
  },
  // 官方文档
  {
    title: 'MCP 官方中文文档',
    category: 'mcp',
    type: 'documentation',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/',
    description: 'MCP完整官方文档，包含核心概念、SDK、Registry、测试调试等',
  },
  {
    title: 'MCP 快速入门指南',
    category: 'mcp',
    type: 'documentation',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/quickstart/',
    description: '官方快速入门，5分钟了解MCP基础',
  },
  {
    title: 'MCP 核心概念',
    category: 'mcp',
    type: 'documentation',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/concepts/',
    description: '采样、传输、工具、提示词、资源等核心概念详解',
  },
  {
    title: 'MCP Java SDK',
    category: 'mcp',
    type: 'documentation',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/sdk/java/',
    description: 'Java开发者的MCP SDK文档',
  },
  {
    title: 'MCP Registry 发布指南',
    category: 'mcp',
    type: 'documentation',
    source: 'mcp-tutorials.json',
    url: 'https://modelcontextprotocol.info/zh-cn/docs/registry/',
    description: '如何发布和使用MCP Registry',
  },
  // 社区资源
  {
    title: 'Cursor MCP Dev - MCP服务器目录',
    category: 'mcp',
    type: 'resource',
    source: 'mcp-tutorials.json',
    url: 'https://cursormcp.dev/',
    description: '社区维护的MCP服务器目录，包含各类MCP服务器的安装和配置指南',
  },
  {
    title: 'Bilibili MCP JS - B站内容搜索MCP',
    category: 'mcp',
    type: 'resource',
    source: 'mcp-tutorials.json',
    url: 'https://cursormcp.dev/mcp-servers/1027-bilibili-mcp-js',
    description: '支持搜索B站内容的MCP服务器，含LangChain集成示例',
  },

  // ========== AI Agent 教程 (来源: ai-agent-tutorials.json) ==========
  // 视频资源
  {
    title: 'LangChain从零基础入门到实战教程（116集）',
    category: 'ai-agent',
    type: 'video',
    source: 'ai-agent-tutorials.json',
    url: 'https://www.bilibili.com/video/BV1eMXKYjEbi/',
    description:
      'AI大模型应用开发核心框架完整教程，涵盖基础篇、进阶篇、实战篇和扩展内容，包括LangChain快速入门、聊天机器人、文档处理、Agent代理、RAG应用、数据库整合等',
  },
  // 文章资源
  {
    title: 'LangChain 中文文档',
    category: 'ai-agent',
    type: 'documentation',
    source: 'ai-agent-tutorials.json',
    url: 'https://langchain-doc.cn/',
    description:
      'LangChain完整API文档和快速开始指南，介绍LangChain、LangGraph和LangSmith等核心工具',
  },
  {
    title: 'AutoGPT 实现指南 - LangChain',
    category: 'ai-agent',
    type: 'article',
    source: 'ai-agent-tutorials.json',
    url: 'https://docs.autoinfra.cn/docs/use_cases/autonomous_agents/autogpt',
    description: 'LangChain官方的AutoGPT实现，涵盖工具设置、内存配置、聊天历史管理',
  },
  {
    title: 'AutoGPT 进化实战：用 LangChain 从零打造自主 AI 代理',
    category: 'ai-agent',
    type: 'article',
    source: 'ai-agent-tutorials.json',
    url: 'https://blog.csdn.net/liu1983robin/article/details/145749760',
    description:
      '从零打造自主AI代理的深度实战文章，包括AutoGPT核心概念、任务分解、工具集成和完整代码示例',
  },
  {
    title: '自主代理 - Langchain 中文',
    category: 'ai-agent',
    type: 'documentation',
    source: 'ai-agent-tutorials.json',
    url: 'https://js.langchaincn.com/docs/use_cases/autonomous_agents',
    description: 'LangChain JavaScript版自主代理开发文档',
  },
  // 框架资源
  {
    title: 'LangChain - AI智能体工程平台',
    category: 'ai-agent',
    type: 'framework',
    source: 'ai-agent-tutorials.json',
    url: 'https://langchain.com',
    description:
      'AI智能体工程平台，提供Prompt模块、工具集成、链结构等核心功能，支持Python和JavaScript',
  },
  {
    title: 'LangGraph - 低级编排与工作流',
    category: 'ai-agent',
    type: 'framework',
    source: 'ai-agent-tutorials.json',
    url: 'https://langchain-ai.github.io/langgraph/',
    description: '提供低级编排、内存管理和人工干预功能的工作流框架',
  },
  {
    title: 'LangSmith - LLM应用监控调试平台',
    category: 'ai-agent',
    type: 'framework',
    source: 'ai-agent-tutorials.json',
    url: 'https://smith.langchain.com/',
    description: 'LLM应用监控和调试平台，助力AI应用开发全流程',
  },
  {
    title: 'AutoGPT - 自主AI代理',
    category: 'ai-agent',
    type: 'framework',
    source: 'ai-agent-tutorials.json',
    url: 'https://github.com/Significant-Gravitas/AutoGPT',
    description: '自主AI代理，可自动分解任务并执行，开源项目',
  },

  // ========== Clawdbot 资源 (来源: clawdbot-resources.json) ==========
  // 视频资源
  {
    title: '【白嫖教程】教你用 Gemini CLI 免费运行 Clawdbot',
    category: 'clawdbot',
    type: 'video',
    source: 'clawdbot-resources.json',
    url: 'https://www.bilibili.com/video/BV15QzaBLEod/',
    description: '使用 Gemini CLI 免费运行 Clawdbot 的详细教程，零成本实现个人AI助手',
  },
  {
    title: '一文讲清Clawdbot：从安装到Claude Code中转配置详细教程',
    category: 'clawdbot',
    type: 'video',
    source: 'clawdbot-resources.json',
    url: 'https://www.bilibili.com/opus/1162026096598712343',
    description: '完整的 Clawdbot 安装教程，包括 Claude Code 中转 API 配置方法',
  },
  {
    title: 'How To Use Clawdbot/Moltbot as a Beginner',
    category: 'clawdbot',
    type: 'video',
    source: 'clawdbot-resources.json',
    url: 'https://youtube.com/watch?v=NhJxxv3f7lI',
    description:
      'Beginner tutorial for Clawdbot/Moltbot, covering installation, OpenAI connection, and Telegram chat setup',
  },
  {
    title: 'ClawdBot 零基礎入門教程 1：入門介紹和安裝 (1/3)',
    category: 'clawdbot',
    type: 'video',
    source: 'clawdbot-resources.json',
    url: 'https://youtube.com/watch?v=OSK9RiohGHo',
    description: 'ClawdBot 零基础入门系列教程第一集，介绍基础概念和安装步骤',
  },
  // 文章资源
  {
    title: 'Clawdbot 全面指南：功能解析、应用场景与安装部署教程',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://blog.wenhaofree.com/posts/articles/2026-01-26-clawdbot-guide-analysis/',
    description: '详细介绍 Clawdbot 的核心功能、适用场景以及完整的安装部署流程',
  },
  {
    title: 'Clawdbot：你的永不休息的 AI 助手 - 完整部署与使用指南',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'http://onefly.top/posts/260126.html',
    description: '介绍如何部署一个 24/7 在线的 AI 助手，包括各种部署方案对比',
  },
  {
    title: '免费开源、可本地部署的AI私人助理Clawdbot，保姆级搭建教程',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://news.qq.com/rain/a/20260126A063G600',
    description: '保姆级教程，手把手教你搭建开源免费的 Clawdbot AI 私人助理',
  },
  {
    title: '主权个人必看的 Clawdbot 本地部署完全指南（2026版）',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://brave2049.com/groups/artificial-intelligence-learning/forum/discussion/zhu-quan-ge-ren-bi-kan-de-clawdbot-ben-di-bu-shu-wan-quan-zhi-nan/',
    description: '面向注重隐私的用户，详解如何本地部署 Clawdbot 保护数据主权',
  },
  {
    title: '5 分钟掌握 Clawdbot：打造专属 AI 助手的完整新手指南',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://help.apiyi.com/clawdbot-beginner-guide-personal-ai-assistant-2026.html',
    description: '快速入门指南，5分钟内完成 Clawdbot 基础配置',
  },
  {
    title: 'Clawdbot 安装教程：打造 24 小时在线的 AI 助手',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://xwuxl.com/2026/01/25/clawdbot-telegram-ai-assistant-tutorial/',
    description: '详细介绍如何配置 Clawdbot 与 Telegram 连接，实现移动端随时访问',
  },
  {
    title: 'Clawdbot国内使用全攻略与平替方案推荐',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://www.ai-indeed.com/encyclopedia/15139.html',
    description: '针对国内用户的 Clawdbot 使用攻略，包括网络问题解决和国内替代方案',
  },
  {
    title: '2026 Clawdbot 最詳細圖文教學：30 分鐘啟動最強 AI 助理',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://abmedia.io/what-is-clawdbot-2026-guide',
    description: '最详细的图文教程，30分钟内启动属于你的最强AI助理',
  },
  {
    title: 'How to Install Clawdbot on Windows, Mac, and Linux in 2026',
    category: 'clawdbot',
    type: 'article',
    source: 'clawdbot-resources.json',
    url: 'https://www.aifreeapi.com/en/posts/install-clawdbot-windows-mac-linux',
    description: 'Complete installation guide for Clawdbot on all major operating systems',
  },

  // ========== AI 编程社区资源 (来源: ai-coding-communities.json) ==========
  {
    title: 'AI 编程社区 - GitHub Copilot Discussions',
    category: 'ai-coding-community',
    type: 'link',
    source: 'ai-coding-communities.json',
    url: 'https://github.com/orgs/community/discussions/categories/copilot',
    description: 'GitHub Copilot 官方社区讨论区，获取最新使用技巧和问题解答',
  },
  {
    title: 'AI 编程社区 - Cursor Community',
    category: 'ai-coding-community',
    type: 'link',
    source: 'ai-coding-communities.json',
    url: 'https://forum.cursor.com/',
    description: 'Cursor IDE 官方社区，分享 AI 编程最佳实践和工作流',
  },
  {
    title: 'AI 编程社区 - Claude Code Users',
    category: 'ai-coding-community',
    type: 'link',
    source: 'ai-coding-communities.json',
    url: 'https://github.com/anthropics/claude-code/discussions',
    description: 'Claude Code 用户讨论区，获取技术支持和分享经验',
  },
  {
    title: 'AI 编程社区 - VS Code AI Extensions',
    category: 'ai-coding-community',
    type: 'link',
    source: 'ai-coding-communities.json',
    url: 'https://marketplace.visualstudio.com/search?term=AI&target=VSCode&category=All%20categories&sortBy=Installs',
    description: 'VS Code AI 扩展合集，发现最热门的 AI 编程辅助工具',
  },
  {
    title: 'AI 编程社区 - Stack Overflow AI',
    category: 'ai-coding-community',
    type: 'link',
    source: 'ai-coding-communities.json',
    url: 'https://stackoverflow.com/questions/tagged/ai-programming',
    description: 'Stack Overflow AI 编程标签，解决技术疑难问题',
  },

  // ========== Claude Code 教程 (来源: claude-code-tutorials.json) ==========
  {
    title: 'Claude Code 官方文档',
    category: 'claude-code',
    type: 'doc',
    source: 'claude-code-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    description: 'Anthropic 官方 Claude Code 文档，涵盖安装、配置和使用全流程',
  },
  {
    title: 'Claude Code 快速入门教程',
    category: 'claude-code',
    type: 'video',
    source: 'claude-code-tutorials.json',
    url: 'https://youtube.com/watch?v=claude-code-quickstart',
    description: '10分钟快速上手 Claude Code，从安装到第一次使用',
  },
  {
    title: 'Claude Code 高级配置指南',
    category: 'claude-code',
    type: 'article',
    source: 'claude-code-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/claude-code/settings',
    description: '深入讲解 Claude Code 的高级配置选项和自定义设置',
  },
  {
    title: 'Claude Code MCP 集成教程',
    category: 'claude-code',
    type: 'article',
    source: 'claude-code-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/claude-code/mcp',
    description: '如何在 Claude Code 中使用 MCP 协议扩展功能',
  },
  {
    title: 'Claude Code 自定义命令开发',
    category: 'claude-code',
    type: 'article',
    source: 'claude-code-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/claude-code/slash-commands',
    description: '创建自定义斜杠命令，提升 Claude Code 使用效率',
  },

  // ========== Cursor 技能教程 (来源: cursor-skills-tutorials.json) ==========
  {
    title: 'Cursor IDE 官方文档',
    category: 'cursor-skills',
    type: 'doc',
    source: 'cursor-skills-tutorials.json',
    url: 'https://docs.cursor.com/',
    description: 'Cursor IDE 完整官方文档，从基础到高级功能',
  },
  {
    title: 'Cursor AI 编程实战教程',
    category: 'cursor-skills',
    type: 'video',
    source: 'cursor-skills-tutorials.json',
    url: 'https://youtube.com/watch?v=cursor-ai-tutorial',
    description: '通过实际项目演示 Cursor AI 编程的完整工作流',
  },
  {
    title: 'Cursor Rules 配置指南',
    category: 'cursor-skills',
    type: 'article',
    source: 'cursor-skills-tutorials.json',
    url: 'https://docs.cursor.com/rules',
    description: '配置 Cursor Rules 约束 AI 生成代码风格和规范',
  },
  {
    title: 'Cursor 多文件编辑技巧',
    category: 'cursor-skills',
    type: 'article',
    source: 'cursor-skills-tutorials.json',
    url: 'https://docs.cursor.com/multi-file',
    description: '利用 Cursor 进行多文件批量编辑和重构',
  },
  {
    title: 'Cursor + MCP 工具集成',
    category: 'cursor-skills',
    type: 'article',
    source: 'cursor-skills-tutorials.json',
    url: 'https://docs.cursor.com/mcp',
    description: '在 Cursor 中集成 MCP 工具扩展 AI 能力',
  },

  // ========== Vibe Coding 教程 (来源: vibe-coding-tutorials.json) ==========
  {
    title: 'Vibe Coding 入门指南',
    category: 'vibe-coding',
    type: 'article',
    source: 'vibe-coding-tutorials.json',
    url: 'https://www.latent.space/p/vibe-coding',
    description: 'Vibe Coding 概念解析和入门实践指南',
  },
  {
    title: 'Vibe Coding 实战：用自然语言构建应用',
    category: 'vibe-coding',
    type: 'video',
    source: 'vibe-coding-tutorials.json',
    url: 'https://youtube.com/watch?v=vibe-coding-demo',
    description: '通过实际案例展示如何用自然语言编程构建完整应用',
  },
  {
    title: 'Vibe Coding 最佳实践合集',
    category: 'vibe-coding',
    type: 'article',
    source: 'vibe-coding-tutorials.json',
    url: 'https://www.cursor.com/blog/vibe-coding-best-practices',
    description: '社区总结的 Vibe Coding 最佳实践和常见陷阱',
  },
  {
    title: '从 Vibe Coding 到 Production',
    category: 'vibe-coding',
    type: 'article',
    source: 'vibe-coding-tutorials.json',
    url: 'https://www.latent.space/p/vibe-to-production',
    description: '如何将 Vibe Coding 快速原型转化为生产级应用',
  },

  // ========== 提示工程教程 (来源: prompt-engineering-tutorials.json) ==========
  {
    title: '提示工程官方指南 - Anthropic',
    category: 'prompt-engineering',
    type: 'doc',
    source: 'prompt-engineering-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
    description: 'Anthropic 官方提示工程指南，系统学习提示词优化',
  },
  {
    title: '提示工程实战课程',
    category: 'prompt-engineering',
    type: 'video',
    source: 'prompt-engineering-tutorials.json',
    url: 'https://youtube.com/watch?v=prompt-engineering-course',
    description: '从零开始学习提示工程，包含实战练习',
  },
  {
    title: 'Chain-of-Thought 提示技巧',
    category: 'prompt-engineering',
    type: 'article',
    source: 'prompt-engineering-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-of-thought',
    description: '使用思维链提示技术提升 AI 推理能力',
  },
  {
    title: 'Few-Shot 提示工程',
    category: 'prompt-engineering',
    type: 'article',
    source: 'prompt-engineering-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/few-shot-examples',
    description: '通过少量示例引导 AI 生成高质量输出',
  },
  {
    title: '结构化输出提示',
    category: 'prompt-engineering',
    type: 'article',
    source: 'prompt-engineering-tutorials.json',
    url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/structured-output',
    description: '使用结构化提示获得 JSON/表格等格式化输出',
  },

  // ========== AI 工具对比 (来源: ai-coding-tools-comparison.json) ==========
  {
    title: 'AI 编程工具横向对比：Cursor vs Claude Code vs Copilot',
    category: 'ai-tools-comparison',
    type: 'article',
    source: 'ai-coding-tools-comparison.json',
    url: 'https://www.latent.space/p/ai-coding-tools-2026',
    description: '2026年三大 AI 编程工具深度对比，功能/价格/体验全方位评测',
  },
  {
    title: 'AI IDE 对比：Cursor vs Windsurf vs Zed',
    category: 'ai-tools-comparison',
    type: 'article',
    source: 'ai-coding-tools-comparison.json',
    url: 'https://www.cursor.com/blog/ai-ide-comparison',
    description: '主流 AI IDE 横向对比，选择最适合你的开发工具',
  },
  {
    title: 'AI 编程助手成本效益分析',
    category: 'ai-tools-comparison',
    type: 'article',
    source: 'ai-coding-tools-comparison.json',
    url: 'https://www.ai-indeed.com/encyclopedia/ai-coding-cost-analysis.html',
    description: '主流 AI 编程工具的订阅成本和 ROI 分析',
  },
  {
    title: '免费 vs 付费 AI 编程工具',
    category: 'ai-tools-comparison',
    type: 'article',
    source: 'ai-coding-tools-comparison.json',
    url: 'https://www.ai-indeed.com/encyclopedia/free-vs-paid-ai-tools.html',
    description: '免费和付费 AI 编程工具的功能差异和选择建议',
  },

  // ========== Clawdbot 导入文章 (来源: clawdbot-import-articles.json) ==========
  {
    title: 'Clawdbot 部署实战：从零到24小时在线AI助手',
    category: 'clawdbot-articles',
    type: 'article',
    source: 'clawdbot-import-articles.json',
    url: 'https://clawdbot.com/blog/deploy-24h-ai-assistant',
    description: '手把手教你从零部署 Clawdbot，打造24小时在线的 AI 助手',
  },
  {
    title: 'Clawdbot vs 商业 AI 助手对比',
    category: 'clawdbot-articles',
    type: 'article',
    source: 'clawdbot-import-articles.json',
    url: 'https://clawdbot.com/blog/clawdbot-vs-commercial',
    description: 'Clawdbot 与 ChatGPT Plus / Claude Pro 等商业方案的详细对比',
  },
  {
    title: '使用 Clawdbot 搭建个人知识库',
    category: 'clawdbot-articles',
    type: 'article',
    source: 'clawdbot-import-articles.json',
    url: 'https://clawdbot.com/blog/personal-knowledge-base',
    description: '利用 Clawdbot 构建和管理个人知识库的完整教程',
  },

  // ========== Clawdbot 导入资源 (来源: clawdbot-import-resources.json) ==========
  {
    title: 'Clawdbot GitHub 仓库',
    category: 'clawdbot-resources',
    type: 'link',
    source: 'clawdbot-import-resources.json',
    url: 'https://github.com/clawdbot/clawdbot',
    description: 'Clawdbot 官方开源仓库，包含完整源码和文档',
  },
  {
    title: 'Clawdbot 插件市场',
    category: 'clawdbot-resources',
    type: 'link',
    source: 'clawdbot-import-resources.json',
    url: 'https://clawdbot.com/plugins',
    description: 'Clawdbot 社区插件合集，扩展 AI 助手功能',
  },
  {
    title: 'Clawdbot 部署脚本集合',
    category: 'clawdbot-resources',
    type: 'link',
    source: 'clawdbot-import-resources.json',
    url: 'https://github.com/clawdbot/deploy-scripts',
    description: '一键部署脚本，支持 Docker/K8s/bare metal',
  },
  {
    title: 'Clawdbot API 文档',
    category: 'clawdbot-resources',
    type: 'doc',
    source: 'clawdbot-import-resources.json',
    url: 'https://docs.clawdbot.com/api',
    description: 'Clawdbot REST API 完整文档，用于二次开发',
  },
]

// 资源分类映射（用于创建资源分类并关联）
const categoryMap = [
  { name: 'MCP教程', pid: null, sort: 1 },
  { name: 'AI Agent教程', pid: null, sort: 2 },
  { name: 'Clawdbot资源', pid: null, sort: 3 },
  { name: 'AI编程社区', pid: null, sort: 4 },
  { name: 'Claude Code教程', pid: null, sort: 5 },
  { name: 'Cursor技能教程', pid: null, sort: 6 },
  { name: 'Vibe Coding教程', pid: null, sort: 7 },
  { name: '提示工程教程', pid: null, sort: 8 },
  { name: 'AI工具对比', pid: null, sort: 9 },
  { name: 'Clawdbot文章', pid: null, sort: 10 },
  { name: 'Clawdbot扩展资源', pid: null, sort: 11 },
]

const categoryKeyMap: Record<string, string> = {
  mcp: 'MCP教程',
  'ai-agent': 'AI Agent教程',
  clawdbot: 'Clawdbot资源',
  'ai-coding-community': 'AI编程社区',
  'claude-code': 'Claude Code教程',
  'cursor-skills': 'Cursor技能教程',
  'vibe-coding': 'Vibe Coding教程',
  'prompt-engineering': '提示工程教程',
  'ai-tools-comparison': 'AI工具对比',
  'clawdbot-articles': 'Clawdbot文章',
  'clawdbot-resources': 'Clawdbot扩展资源',
}

export async function seedAiTutorials() {
  console.log(`开始导入 ${aiTutorials.length} 条 AI 教学资源...`)

  // 1. 先创建资源分类
  const categoryIdMap: Record<string, string> = {}
  for (const cat of categoryMap) {
    const [existing] = await db
      .select()
      .from(resourceCategories)
      .where(eq(resourceCategories.name, cat.name))
    if (existing) {
      categoryIdMap[cat.name] = existing.id
    } else {
      const [inserted] = await db
        .insert(resourceCategories)
        .values({
          name: cat.name,
          sort: cat.sort,
          status: 1,
        })
        .returning({ id: resourceCategories.id })
      categoryIdMap[cat.name] = inserted.id
    }
  }
  console.log(`资源分类创建完成: ${Object.keys(categoryIdMap).length} 个`)

  // 2. 插入资源数据
  let insertedCount = 0
  for (let i = 0; i < aiTutorials.length; i++) {
    const item = aiTutorials[i]
    const categoryName = categoryKeyMap[item.category]
    const categoryId = categoryIdMap[categoryName] ?? null

    await db
      .insert(resources)
      .values({
        title: item.title,
        intro: item.description,
        categoryId: categoryId,
        fileUrl: item.url,
        fileType: item.type,
        fileSize: 0,
        isPublished: true,
        viewCount: 0,
        downloadCount: 0,
        sort: i + 1,
        status: 1,
      })
      .onConflictDoNothing()
    insertedCount++
  }

  console.log(`AI 教学资源导入完成: ${insertedCount}/${aiTutorials.length} 条`)
}
