export interface BlogPost {
  slug: string // URL slug,如 '8-ends-same-source-architecture'
  title: string // 文章标题
  date: string // 发布日期 YYYY-MM-DD
  category: string // 分类
  tags: string[] // 标签数组
  description: string // SEO 描述
  fileName: string // 原始文件名(如 '01-8-ends-same-source-architecture.md')
}

export const posts: BlogPost[] = [
  {
    slug: '8-ends-same-source-architecture',
    title:
      '8 端同源架构:一个 TypeScript Monorepo 如何同时输出 Web/API/CLI/Desktop/Extension/Mobile/Miniapp',
    date: '2026-07-26',
    category: 'AI 工程',
    tags: ['AI', 'LLM', 'TypeScript', 'Monorepo', '开源'],
    description:
      '用 pnpm workspace + Turborepo 在一个仓库里同时交付 8 个端,IHUI AI 实战分享 340 表 / 144 迁移 / 1300+ API 的同源架构设计',
    fileName: '01-8-ends-same-source-architecture.md',
  },
  {
    slug: '176-models-unified-dispatch',
    title:
      '176 大模型统一调度:LiteLLM + LangGraph 如何让 OpenAI/Claude/Qwen/DeepSeek 一键切换',
    date: '2026-07-26',
    category: 'AI 工程',
    tags: ['AI', 'LLM', 'LangGraph', 'LiteLLM', '开源'],
    description:
      '用 LiteLLM 统一 176 个大模型接口 + LangGraph 编排多步推理,实战分享模型字典化、自动路由、降级策略与成本控制',
    fileName: '02-176-models-unified-dispatch.md',
  },
  {
    slug: 'mcp-protocol-integration',
    title: 'MCP 协议集成实战:让 AI Agent 调用任意工具',
    date: '2026-07-26',
    category: 'AI 工程',
    tags: ['AI', 'MCP', 'Agent', 'LangGraph', '开源'],
    description:
      '用 Model Context Protocol 标准化 AI Agent 工具调用,实战分享 MCP server 架构、工具注册、权限控制与沙箱执行',
    fileName: '03-mcp-protocol-integration.md',
  },
  {
    slug: 'rag-knowledge-base-pgvector',
    title: '从 0 到 1 构建企业级 RAG 知识库:pgvector + 文档切片 + 混合检索',
    date: '2026-07-26',
    category: 'AI 工程',
    tags: ['AI', 'RAG', 'pgvector', 'PostgreSQL', '开源'],
    description:
      '用 PostgreSQL + pgvector 构建企业级 RAG 知识库,实战分享智能切片、混合检索(向量+全文+重排)与引用溯源',
    fileName: '04-rag-knowledge-base-pgvector.md',
  },
  {
    slug: 'open-source-monetization',
    title: '开源项目如何挣钱:IHUI AI 的 7 大盈利模式设计',
    date: '2026-07-26',
    category: 'AI 商业',
    tags: ['AI', '开源', '商业化', 'SaaS', '创业'],
    description:
      'Apache 2.0 开源 + SaaS 订阅 + 私有化 + API 计费 + 企业定制 + Agent 市场分成 + 培训认证,7 大盈利模式实战设计',
    fileName: '05-open-source-monetization.md',
  },
  {
    slug: 'mcp-protocol-deep-dive',
    title: 'MCP 协议深度解析:从 Function Call 到通用工具调用标准',
    date: '2026-07-27',
    category: 'AI 协议',
    tags: ['MCP', 'Model Context Protocol', 'AI 工具集成', 'Anthropic MCP', 'MCP server'],
    description:
      '深度剖析 MCP 协议设计理念、JSON-RPC 传输层、与 OpenAI Function Call 的本质差异,以及 IHUI-AI 如何同时实现 MCP 客户端与服务端',
    fileName: '06-mcp-protocol-deep-dive.md',
  },
  {
    slug: 'rag-knowledge-base-implementation',
    title: 'RAG 知识库从零到一实现:5 步把文档变成可对话的 AI 大脑',
    date: '2026-07-27',
    category: 'AI 工程',
    tags: ['RAG', '检索增强生成', '向量数据库', '知识库', 'embedding'],
    description:
      '从文档解析、chunking、向量嵌入、检索策略到引用追溯,完整拆解一个生产级 RAG 知识库的 5 步实现',
    fileName: '07-rag-knowledge-base-implementation.md',
  },
  {
    slug: 'multi-end-architecture-design',
    title: '8 端同源架构设计模式:Monorepo + 共享包的工程方法论',
    date: '2026-07-27',
    category: '前端架构',
    tags: ['多端架构', 'Monorepo', 'Turborepo', '同源代码', '跨端开发'],
    description:
      '用 pnpm workspace + Turborepo 把 8 端代码合并到同一仓库,拆解端特定隔离、共享契约、构建优化三类设计模式',
    fileName: '08-multi-end-architecture-design.md',
  },
  {
    slug: 'ai-agent-marketplace-design',
    title: 'AI Agent 市场设计:让 Agent 像 App 一样被交易与编排',
    date: '2026-07-27',
    category: 'AI 产品',
    tags: ['AI Agent', 'Agent 市场', 'Agent 交易', 'Agent 编排', 'LangGraph Agent'],
    description:
      'AI Agent 不再是写死在某个产品里的功能,而是可以被定价、上架、订阅、编排的数字商品。本文拆解 Agent 市场的产品设计与市场架构',
    fileName: '09-ai-agent-marketplace-design.md',
  },
  {
    slug: 'open-source-saas-monetization',
    title: '开源项目的 7 种 SaaS 变现模式:从 Open Core 到 API 计费',
    date: '2026-07-27',
    category: '开源商业化',
    tags: ['开源变现', 'SaaS 订阅', 'open core', '商业化', 'Apache 2.0 商用'],
    description:
      '系统梳理 7 种被验证过的开源项目 SaaS 变现模式,从 Open Core、托管 SaaS、企业版到 API 计费、市场抽成、咨询定制、认证培训',
    fileName: '10-open-source-saas-monetization.md',
  },
]
