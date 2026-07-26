import type { Metadata } from 'next'
import { FaqContent } from './FaqContent'

// FAQPage JSON-LD(2026-07-26 立,GEO 优化):
// - FAQPage schema 是 AI 引擎和 Google Rich Results 最高优先引用的格式之一
// - 12 个 Q&A 全部结构化,直接喂给 GPTBot/ClaudeBot/PerplexityBot
// - mainEntity 数组,每个 Question 配 acceptedAnswer
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': 'https://ihui.ai/faq#webpage',
  url: 'https://ihui.ai/faq',
  name: '智汇 AI 常见问题 — 12 个高频问题解答',
  description:
    '智汇 AI 常见问题:平台介绍、与 Dify/Coze/FastGPT 对比、价格、部署、API、模型支持、数据安全等 12 个高频问题。',
  inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
  isPartOf: { '@id': 'https://ihui.ai/#website' },
  about: { '@id': 'https://ihui.ai/#organization' },
  mainEntity: [
    {
      '@type': 'Question',
      name: '智汇 AI 是什么?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '智汇 AI(英文名 IHUI AI)是一站式全栈 AI 操作系统。它把 Agent 设计、知识库 RAG、多模型统一调度、跨端协作和团队运营装进同一个平台,支持 Web、桌面、小程序、浏览器插件、React Native、CLI 共六个客户端同源分发,核心代码 Apache 2.0 开源,可私有化部署。',
      },
    },
    {
      '@type': 'Question',
      name: '智汇 AI 与 Dify、Coze、FastGPT 的区别?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Dify 偏 LLM 应用开发(仅 Web);Coze 闭源(不支持私有化);FastGPT 偏知识库 Q&A。智汇 AI 是当前少数同时覆盖 Agent 市场 + 知识库 + 六端分发 + 团队协作 + 积分计费的开源平台,一个平台顶 Dify + Coze + FastGPT 三件套。',
      },
    },
    {
      '@type': 'Question',
      name: '智汇 AI 适合谁?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '三类用户最受益:AI 开发者(快速搭建/分发/变现 Agent,六端一键发布)、企业 IT(私有化部署,数据不出域,统一 AI 能力中心)、团队 Leader(多人协作,统一知识库,统一计费)。',
      },
    },
    {
      '@type': 'Question',
      name: '支持哪些 AI 模型?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'OpenAI(GPT-4o/o1/GPT-4.1)、Anthropic Claude(Opus 4/Sonnet 4)、Google Gemini、阿里通义千问(Qwen-Max/Plus)、DeepSeek(V3/R1)、智谱 GLM-4、文心一言、豆包、Kimi,以及 Ollama 等本地模型和任何 OpenAI 兼容端点。统一计费、自动 fallback、成本路由。',
      },
    },
    {
      '@type': 'Question',
      name: '"六端同源"是什么意思?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Web、桌面(Tauri 2)、微信/支付宝/抖音小程序(Taro 4)、浏览器插件(WXT MV3)、iOS/Android(React Native)、CLI(Node.js/Bun)六个客户端共享同一套 React 组件库、同一套 API 契约、同一套业务逻辑。你写一次,六端同步发布,不用为每个端重写。',
      },
    },
    {
      '@type': 'Question',
      name: '怎么和已有的业务系统集成?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '三种方式:① OpenAPI 3.1 REST API(SDK 覆盖 TypeScript/Python/Go);② Webhook 事件订阅;③ MCP 工具协议(你的内部系统可以发布为 MCP Server,被智汇 AI 的 Agent 调用)。企业版还支持 SSO/SAML 2.0/OIDC 单点登录。',
      },
    },
    {
      '@type': 'Question',
      name: '个人版是免费的吗?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '是的,个人版永久免费:每月 1000 积分、所有模型、所有 6 个客户端、API 访问全部包含。Pro 版 ¥49/月(10000 积分 + 优先级队列),Team 版 ¥299/月/user(共享积分池 + 审计日志),企业版定制(私有化 + SLA)。',
      },
    },
    {
      '@type': 'Question',
      name: '积分怎么算?能退款吗?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '积分按模型调用计费,不同模型消耗不同(详见定价页)。充值积分 7 天内未使用可全额退款,已使用部分按比例退;订阅版未使用月份按比例退。具体见退款政策页。',
      },
    },
    {
      '@type': 'Question',
      name: '支持私有化部署吗?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '支持,Apache 2.0 开源,自托管零授权费。Docker Compose 单机一键部署(5 分钟),Kubernetes 多节点部署(支持 Helm Chart)。企业版额外提供:高可用方案、备份恢复、灰度升级、专属技术支持。',
      },
    },
    {
      '@type': 'Question',
      name: '自托管需要什么硬件?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '最低配置:2 核 CPU / 4GB RAM / 20GB 磁盘,可支持 10-50 并发用户。推荐配置:4 核 CPU / 8GB RAM / 50GB SSD,可支持 200 并发用户。GPU 不是必需的(纯 LLM 推理走云端 API),如果跑本地模型(7B-13B)需要单卡 24GB 显存。',
      },
    },
    {
      '@type': 'Question',
      name: '我的数据安全吗?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '托管版数据存储在阿里云(中国大陆),传输 TLS 1.3,静态 AES-256 加密,符合中国《数据安全法》《个人信息保护法》以及 GDPR/CCPA。自托管版数据 100% 在你的基础设施内,我们不接触。我们不训练模型,不与第三方共享数据,所有访问都有审计日志。',
      },
    },
    {
      '@type': 'Question',
      name: '智汇 AI 会被用于训练你们的模型吗?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '绝对不会。我们既不训练自有模型,也不会用你的数据训练任何第三方模型。OpenAI/Anthropic 等 API 提供商的 data retention 政策请参考其官方文档(均默认不训练,API 模式下数据 30 天后自动删除)。',
      },
    },
  ],
}

export const metadata: Metadata = {
  title: '常见问题 — 智汇 AI | 12 个高频问题解答',
  description:
    '智汇 AI 常见问题:平台介绍、与 Dify/Coze/FastGPT 对比、价格、部署、API、模型支持、数据安全等 12 个高频问题。',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: '常见问题 — 智汇 AI',
    description: '12 个高频问题,30 秒找到答案。关于智汇 AI 的平台介绍、价格、部署、API、数据安全的完整 FAQ。',
    url: 'https://ihui.ai/faq',
    type: 'website',
  },
}

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FaqContent />
    </>
  )
}
