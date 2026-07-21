/**
 * 插件市场数据源(2026-07-22 立)
 *
 * 两类数据:
 *  1. PROJECT_PLUGINS — 本项目已集成的内置插件能力,点击卡片进入对应路由
 *  2. MARKET_PLUGINS  — 全网主流 AI 插件 / 脚本 / MCP 市场,点击访问官方网站
 *
 * 图标策略:
 *  - 项目插件:统一用 lucide-react 图标(与侧边栏导航项视觉一致)
 *  - 市场插件:优先用 BrandIcon(@lobehub/icons 厂商官方矢量图标),
 *    lobehub 未收录的厂商用 lucide-react 图标兜底
 *
 * 数据来源:
 *  - 项目插件来自 apps/web/app/(main) 下已存在的路由(/mcp-projects /agents /workflows 等)
 *  - 市场插件来自 2026-07 联网搜索,覆盖 OpenAI / Anthropic / Coze / Dify / Hugging Face /
 *    LangChain / Cursor / VSCode / OpenRouter / Smithery / OpenWebUI / LobeHub / n8n /
 *    Replit / OpenClaw / GitHub Models / Cline 等 17 个主流市场
 */

import {
  Cable,
  Bot,
  Workflow,
  Sparkles,
  Wrench,
  Image as ImageIcon,
  Code,
  Globe,
  Boxes,
  Link2,
  MousePointer2,
  Server,
  Rocket,
  Terminal,
  Send,
  type LucideIcon,
} from 'lucide-react'

export interface ProjectPlugin {
  id: string
  name: string
  description: string
  href: string
  icon: LucideIcon
  tags: string[]
}

export interface MarketPlugin {
  id: string
  name: string
  description: string
  url: string
  /** lobehub 厂商代码,用于 BrandIcon 渲染官方图标;为空则用 fallbackIcon */
  vendor?: string
  /** lobehub 未收录时的兜底图标 */
  fallbackIcon: LucideIcon
  tags: string[]
  /** 是否免费 */
  free?: boolean
  /** 是否官方市场 */
  official?: boolean
}

/** 本项目已集成的插件能力(8 项,对应 (main) 路由组下已有页面) */
export const PROJECT_PLUGINS: ProjectPlugin[] = [
  {
    id: 'mcp-projects',
    name: 'MCP 项目',
    description: 'Model Context Protocol 服务器管理,让 AI 调用外部工具与数据源',
    href: '/mcp-projects',
    icon: Cable,
    tags: ['MCP', '工具调用'],
  },
  {
    id: 'agents',
    name: 'AI 智能体',
    description: '创建与管理自定义 AI Agent,支持多模型编排与工具组合',
    href: '/agents',
    icon: Bot,
    tags: ['Agent', '多模型'],
  },
  {
    id: 'workflows',
    name: '工作流',
    description: '可视化工作流编排,串联 AI 节点 / API 调用 / 条件分支',
    href: '/workflows',
    icon: Workflow,
    tags: ['工作流', '编排'],
  },
  {
    id: 'skills',
    name: 'AI 技能',
    description: '平台技能市场,管理与配置 AI 模型可调用的技能模板',
    href: '/models/skills',
    icon: Sparkles,
    tags: ['技能', '模板'],
  },
  {
    id: 'tools',
    name: 'AI 工具',
    description: '在线 AI 工具集合,涵盖 PDF 处理 / 文档转换 / 文本分析等',
    href: '/tools',
    icon: Wrench,
    tags: ['工具', '在线'],
  },
  {
    id: 'image-gen',
    name: '图像生成',
    description: 'AI 图像生成能力,支持文生图 / 图生图 / 多模型切换',
    href: '/image-gen',
    icon: ImageIcon,
    tags: ['图像', '生成'],
  },
  {
    id: 'api-test',
    name: 'API 测试',
    description: '在线 API 调试与测试工具,支持参数配置 / 历史记录 / 结果对比',
    href: '/api-test',
    icon: Code,
    tags: ['API', '调试'],
  },
  {
    id: 'ai-world',
    name: 'AI 世界',
    description: 'AI 应用探索中心,热门 AI 应用 / 智能创作 / 场景化体验',
    href: '/ai-world',
    icon: Globe,
    tags: ['应用', '探索'],
  },
]

/** 全网主流 AI 插件 / 脚本 / MCP 市场(17 项,2026-07 联网搜索) */
export const MARKET_PLUGINS: MarketPlugin[] = [
  {
    id: 'gpt-store',
    name: 'OpenAI GPT Store',
    description: 'OpenAI 官方 GPTs 市场,百万级自定义 GPT 机器人,涵盖工作 / 学习 / 生活场景',
    url: 'https://chatgpt.com/gpts',
    vendor: 'openai',
    fallbackIcon: Sparkles,
    tags: ['GPTs', '官方'],
    free: true,
    official: true,
  },
  {
    id: 'mcp-registry',
    name: 'Anthropic MCP Registry',
    description: 'Model Context Protocol 官方服务器注册表,10000+ MCP Server,跨客户端复用',
    url: 'https://modelcontextprotocol.io',
    vendor: 'anthropic',
    fallbackIcon: Server,
    tags: ['MCP', '官方', '协议'],
    free: true,
    official: true,
  },
  {
    id: 'coze-store',
    name: 'Coze 扣子',
    description: '字节跳动 AI Bot 开发平台,可视化编排 / 插件市场 / 知识库 / 工作流',
    url: 'https://www.coze.com',
    vendor: 'coze',
    fallbackIcon: Bot,
    tags: ['Bot', '插件', '字跳'],
    free: true,
    official: true,
  },
  {
    id: 'dify-marketplace',
    name: 'Dify Marketplace',
    description: 'Dify 开源 LLM 应用开发平台插件市场,工具 / 模型 / Agent 模板社区',
    url: 'https://dify.ai/marketplace',
    fallbackIcon: Boxes,
    tags: ['开源', '工具', 'Agent'],
    free: true,
  },
  {
    id: 'huggingface-spaces',
    name: 'Hugging Face Spaces',
    description: 'Hugging Face 模型演示空间,数十万 AI 应用 / Demo / 模型在线体验',
    url: 'https://huggingface.co/spaces',
    vendor: 'huggingface',
    fallbackIcon: Boxes,
    tags: ['模型', 'Demo', '开源'],
    free: true,
    official: true,
  },
  {
    id: 'langchain-hub',
    name: 'LangChain Hub',
    description: 'LangChain 官方 Prompt / Agent / Tool 仓库,LangGraph 工作流模板社区',
    url: 'https://smith.langchain.com/hub',
    fallbackIcon: Link2,
    tags: ['Prompt', 'Tool', 'LangGraph'],
    free: true,
    official: true,
  },
  {
    id: 'cursor-extensions',
    name: 'Cursor Extensions',
    description: 'Cursor AI 代码编辑器扩展市场,集成 MCP / 自定义工具 / 规则文件',
    url: 'https://cursor.com',
    fallbackIcon: MousePointer2,
    tags: ['IDE', '代码', '扩展'],
    official: true,
  },
  {
    id: 'vscode-marketplace',
    name: 'VSCode Marketplace',
    description: 'Visual Studio Code 扩展市场,AI 类扩展涵盖 Copilot / Continue / Cline 等',
    url: 'https://marketplace.visualstudio.com',
    vendor: 'microsoft',
    fallbackIcon: Code,
    tags: ['IDE', '扩展', '微软'],
    free: true,
    official: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '统一 LLM API 路由,300+ 模型聚合,内置函数调用 / 工具调用 / 结构化输出',
    url: 'https://openrouter.ai',
    vendor: 'openrouter',
    fallbackIcon: Link2,
    tags: ['API', '聚合', '路由'],
    free: true,
    official: true,
  },
  {
    id: 'smithery',
    name: 'Smithery MCP',
    description: 'Smithery MCP Server 注册中心,一键安装 / 运行 / 管理 MCP 服务器',
    url: 'https://smithery.ai',
    fallbackIcon: Server,
    tags: ['MCP', '注册中心'],
    free: true,
  },
  {
    id: 'openwebui',
    name: 'OpenWebUI',
    description: '开源 AI Web UI,兼容 Ollama / OpenAI,内置工具 / 函数 / 知识库插件系统',
    url: 'https://openwebui.com',
    vendor: 'openwebui',
    fallbackIcon: Globe,
    tags: ['开源', 'Web UI', 'Ollama'],
    free: true,
  },
  {
    id: 'lobehub-plugins',
    name: 'LobeHub Plugins',
    description: 'LobeChat 插件市场,数百个 AI 工具插件,支持搜索 / 联网 / 多模态',
    url: 'https://lobehub.com/plugins',
    fallbackIcon: Boxes,
    tags: ['插件', 'LobeChat'],
    free: true,
  },
  {
    id: 'n8n-templates',
    name: 'n8n Templates',
    description: 'n8n 工作流自动化平台模板市场,数千个 AI 工作流模板可一键导入',
    url: 'https://n8n.io/templates',
    fallbackIcon: Workflow,
    tags: ['工作流', '自动化', '模板'],
    free: true,
  },
  {
    id: 'replit-agent',
    name: 'Replit Agent',
    description: 'Replit AI 编程 Agent 平台,云端开发环境 + Agent 商店 + 一键部署',
    url: 'https://replit.com',
    vendor: 'replit',
    fallbackIcon: Terminal,
    tags: ['IDE', 'Agent', '云端'],
    official: true,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: '开源 AI Agent 平台,多智能体协作 / 工具调用 / 工作流编排',
    url: 'https://openclaw.com',
    fallbackIcon: Rocket,
    tags: ['开源', 'Agent', '协作'],
    free: true,
  },
  {
    id: 'github-models',
    name: 'GitHub Models',
    description: 'GitHub 官方模型市场,免费体验主流 LLM,集成 Codespaces / Copilot',
    url: 'https://github.com/models',
    vendor: 'githubcopilot',
    fallbackIcon: Code,
    tags: ['模型', 'GitHub', '官方'],
    free: true,
    official: true,
  },
  {
    id: 'cline',
    name: 'Cline',
    description: '开源 AI 编程 Agent,VSCode 扩展,支持 MCP / 自定义工具 / 浏览器控制',
    url: 'https://cline.bot',
    fallbackIcon: Terminal,
    tags: ['Agent', 'VSCode', '开源'],
    free: true,
  },
  {
    id: 'publish-platform',
    name: '多平台发布',
    description: '本项目内置的一键多平台发布工具,支持 md / docx / html / pdf / 图片 / 视频 → 14 平台',
    url: '/publish',
    fallbackIcon: Send,
    tags: ['发布', '内置', '多平台'],
    free: true,
    official: true,
  },
]
