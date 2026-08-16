/**
 * RSS Feed 数据源(2026-07-26 立)
 * 集中维护所有要推送到 RSS 的内容条目
 */

export interface FeedItem {
  title: string
  path: string
  description: string
  category: string
  publishedAt: string
}

const PUBLISHED_BATCH = '2026-07-26T00:00:00.000Z'

/**
 * 所有要推送到 RSS 的路由
 * - 高价值页面(产品介绍 / 对比 / 用例 / 文档)
 * - 按 category 分类,方便 RSS 阅读器分组
 * - publishedAt 用批次时间(本次全量发布),后续可按页面单独维护
 */
export function getAllRoutesForFeed(): FeedItem[] {
  return [
    // === 核心产品页 ===
    {
      title: '智汇 AI — 全栈 AI 操作系统 | Agent 市场 / RAG / 多模型调度',
      path: '/',
      description:
        '智汇 AI(IHUI AI)是一站式全栈 AI 操作系统,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,支持 Web/桌面/小程序/插件/RN/CLI 六端同源,Apache 2.0 开源。',
      category: '产品',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: '关于智汇 AI — 一码六端,一站 AI',
      path: '/about',
      description:
        '智汇 AI 是开源的全栈 AI 操作系统,把 Agent 设计、知识库、多模型调度、跨端协作和团队运营装进同一个平台。',
      category: '产品',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: '常见问题 — 智汇 AI FAQ',
      path: '/faq',
      description:
        '智汇 AI 常见问题:什么是 IHUI AI?与 Dify/Coze/FastGPT/n8n 的区别?如何开始?支持私有化吗?数据安全吗?',
      category: '产品',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: '定价方案 — 智汇 AI',
      path: '/pricing',
      description:
        '智汇 AI 定价:个人免费 + Pro ¥49/月 + Team ¥299/月/人 + Enterprise 私有化定制。统一积分,无隐藏费用。',
      category: '产品',
      publishedAt: PUBLISHED_BATCH,
    },

    // === 文档 ===
    {
      title: '快速开始(5 分钟上手) — 智汇 AI',
      path: '/docs/quickstart',
      description:
        '5 分钟从注册到发布第一个 AI Agent。注册 → 浏览 Agent 市场 → 配置模型 → 上传知识库 → 一键发布六端。',
      category: '文档',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: '文档中心 — 智汇 AI',
      path: '/docs',
      description:
        '智汇 AI 完整文档:快速开始、自托管、API、MCP、Agent 开发、知识库、多模型、工作流、团队协作。',
      category: '文档',
      publishedAt: PUBLISHED_BATCH,
    },

    // === 产品对比(高搜索量长尾) ===
    {
      title: 'IHUI AI vs Dify:2026 年全栈 AI 平台对比',
      path: '/compare/ihui-vs-dify',
      description:
        'Dify 偏 Web 端 LLM 应用开发;IHUI AI 是六端同源全栈 AI 操作系统,集成 Agent 市场 + 知识库 + 多模型 + 团队协作。',
      category: '对比',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'IHUI AI vs Coze:开源 + 私有化替代',
      path: '/compare/ihui-vs-coze',
      description:
        'Coze 是字节出品的闭源 AI Agent 平台;IHUI AI 是开源 + 跨云 + 私有化部署的更优选择。',
      category: '对比',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'IHUI AI vs FastGPT:知识库 + Agent 市场',
      path: '/compare/ihui-vs-fastgpt',
      description: 'FastGPT 专注知识库 Q&A;IHUI AI 含知识库 + Agent 市场 + 六端分发 + 团队协作。',
      category: '对比',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'IHUI AI vs n8n:AI-First 工作流',
      path: '/compare/ihui-vs-n8n',
      description:
        'n8n 偏工作流自动化(LLM 是节点);IHUI AI 在工作流上叠加 LLM + Agent + 六端,AI-First。',
      category: '对比',
      publishedAt: PUBLISHED_BATCH,
    },

    // === 行业用例(高搜索量长尾) ===
    {
      title: 'AI 智能客服 Agent 用例 — 7×24 高质量服务',
      path: '/use-cases/customer-support',
      description:
        '基于智汇 AI 搭建的智能客服 Agent:7×24 在线、统一知识库、多模型路由、多渠道部署、人机协同,成本降低 70%,响应 0 秒。',
      category: '用例',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: '企业 AI 知识库用例 — 文档智能问答',
      path: '/use-cases/knowledge-base',
      description:
        '基于智汇 AI 搭建企业知识库:文档自动向量化,语义检索 + BM25 + 知识图谱,告别重复问题咨询。',
      category: '用例',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'AI 代码助手用例 — 团队编程效率倍增',
      path: '/use-cases/code-assistant',
      description:
        '基于智汇 AI 搭建 AI 代码助手:PR 自动审查、Bug 检测、代码生成、重构建议,支持 100+ 主流语言。',
      category: '用例',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'AI 内容创作用例 — 多模态一站生成',
      path: '/use-cases/content-generation',
      description:
        '基于智汇 AI 搭建内容创作 Agent:文/图/音/视频多模态生成,统一积分池,一键分发 6 端。',
      category: '用例',
      publishedAt: PUBLISHED_BATCH,
    },

    // === GEO 入口(供 AI 引擎检索) ===
    {
      title: 'llms.txt — 智汇 AI 短版 LLM 检索文件',
      path: '/llms.txt',
      description: '供 GPTBot / ClaudeBot / Gemini 检索的精炼项目介绍。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'llms-full.txt — 智汇 AI 完整 LLM 文档',
      path: '/llms-full.txt',
      description: '供 LLM 深度检索的完整项目文档(15KB)。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'gpt.txt — OpenAI / ChatGPT 优化检索',
      path: '/gpt.txt',
      description: 'Q&A 格式优化,适合 GPTBot / OAI-SearchBot 检索。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'claude.md — Anthropic Claude 优化检索',
      path: '/claude.md',
      description: '长篇叙事优化,适合 Claude / ClaudeBot 检索。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'perplexity.md — Perplexity 引用优化',
      path: '/perplexity.md',
      description: '引用友好事实清单,适合 PerplexityBot 检索。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
    {
      title: 'gemini.txt — Google Gemini 实体优化',
      path: '/gemini.txt',
      description: '实体-属性格式优化,适合 Google Gemini 检索。',
      category: 'GEO',
      publishedAt: PUBLISHED_BATCH,
    },
  ]
}
