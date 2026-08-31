// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CompetitorConfig } from './types'

export const internationalSaasCompetitors: Partial<
  Record<CompetitorConfig['id'], CompetitorConfig>
> = {
  'zapier-ai': {
    id: 'zapier-ai',
    name: 'Zapier AI Actions',
    tagline: 'Zapier 偏自动化集成;IHUI AI 在工作流上叠加 LLM + Agent + 六端',
    verdict:
      '如果只需连接 SaaS 工具做自动化,Zapier 集成生态较丰富;如果需要 LLM/Agent 作为工作流核心 + 知识库 + 六端分发 + 团队协作,IHUI AI 是更 AI-native 的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: 'AI 优先的全栈操作系统',
        competitor: '自动化集成平台',
        ihuiDetail: 'LLM/Agent 是一等公民',
        competitorDetail: '7000+ SaaS 集成,LLM 是节点',
      },
      {
        dimension: 'AI 能力',
        ihui: '原生 AI 优先',
        competitor: 'AI Actions(中央编排)',
        ihuiDetail: 'Agent + 知识库 + 工作流一体',
        competitorDetail: '通过 Zapier Central 调用 LLM',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '基础 AI Actions',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '预置 AI Action 模板',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需对接外部',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '通过 Zapier 接 Vector DB',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + Zapier 集成',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队账户',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础团队协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$19.99/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按任务数计费',
      },
    ],
  },

  make: {
    id: 'make',
    name: 'Make.com',
    tagline: 'Make.com 是可视化自动化;IHUI AI 是 AI 优先的全栈操作系统',
    verdict:
      '如果需要可视化自动化连接 SaaS,Make 体验优秀;如果需要 LLM/Agent 为核心 + 知识库 + 六端分发 + 私有化,IHUI AI 是更 AI-native 的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: 'AI 优先全栈操作系统',
        competitor: '可视化自动化平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '拖拽场景 + 1800+ app',
      },
      {
        dimension: 'AI 能力',
        ihui: '原生 AI 优先',
        competitor: 'AI 模块(OpenAI 等)',
        ihuiDetail: 'LLM/Agent 是核心',
        competitorDetail: 'AI 作为模块之一',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '可视化场景',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '场景模板库',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需对接外部',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '接 Pinecone/Weaviate',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + Make API',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队 + 角色',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础团队协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$9/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按操作数计费',
      },
    ],
  },

  'relevance-ai': {
    id: 'relevance-ai',
    name: 'Relevance AI',
    tagline: 'Relevance AI 偏 AI Worker;IHUI AI 是完整 Agent 操作系统 + 六端',
    verdict:
      '如果需要快速部署 AI Worker 跑独立任务,Relevance AI 上手快;如果需要完整 Agent 编排 + 知识库 + 六端分发 + 私有化 + 团队协作,IHUI AI 更完整。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: 'AI Worker 平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '构建 AI Worker 跑任务',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: 'Chain 模式',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '任务链编排',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '内置',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '基础向量检索',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '多模型',
        ihuiDetail: '跨厂商 + 自动 fallback',
        competitorDetail: '支持 OpenAI/Anthropic 等',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + API',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队空间',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础团队功能',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$19/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按任务/credit 计费',
      },
    ],
  },

  'stack-ai': {
    id: 'stack-ai',
    name: 'Stack AI',
    tagline: 'Stack AI 偏企业 AI 编排;IHUI AI 开源 + 六端 + Agent 市场',
    verdict:
      '如果需要快速搭建企业 AI 内部工具,Stack AI 直观;如果需要开源 + 私有化 + Agent 市场 + 六端分发 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '企业 AI 编排平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '可视化 AI 工作流',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '可视化画布',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '节点画布',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '内置',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '向量检索 + 多数据源',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '多模型',
        ihuiDetail: '跨厂商 + 自动 fallback',
        competitorDetail: 'OpenAI/Anthropic/Bedrock',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + 嵌入',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + iframe 嵌入',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队 + 角色',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础团队功能',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$99/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按用户/credit 计费',
      },
    ],
  },

  wordware: {
    id: 'wordware',
    name: 'Wordware',
    tagline: 'Wordware 是可读 AI 编程;IHUI AI 是完整 OS(无需编程)',
    verdict:
      '如果工程师喜欢用类自然语言编程构建 Agent,Wordware 创新有趣;如果业务/产品需要零代码可视化 + 200+ 模板 + 六端分发 + 团队协作,IHUI AI 上手更低。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统(零代码)',
        competitor: '可读 AI 编程语言',
        ihuiDetail: '可视化拖拽 + 200+ 模板',
        competitorDetail: '类自然语言编程',
      },
      {
        dimension: '上手成本',
        ihui: '30 分钟注册',
        competitor: '需学语法',
        ihuiDetail: '业务/产品可上手',
        competitorDetail: '面向工程师',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '代码编排',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '写 .word 文件',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需自己接',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需对接外部',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'API 调用',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队账户',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$30/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按 credit 计费',
      },
    ],
  },

  voiceflow: {
    id: 'voiceflow',
    name: 'Voiceflow',
    tagline: 'Voiceflow 偏语音对话 AI;IHUI AI 是全栈 Agent 操作系统(含语音)',
    verdict:
      '如果专注构建语音/聊天对话 IVR,Voiceflow 体验较好;如果需要全栈 Agent(语音 + 文本 + 工作流 + 知识库)+ 六端分发 + 团队协作,IHUI AI 更完整。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '对话式 AI 平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '语音 + 聊天对话设计',
      },
      {
        dimension: '语音能力',
        ihui: '可对接讯飞/百度/Whisper/11Labs',
        competitor: '原生支持',
        ihuiDetail: '灵活对接多家',
        competitorDetail: '原生 STT/TTS/语音对话',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '对话画布',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '对话流程画布',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '内置 Knowledge Base',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '基础知识库',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + 嵌入 + 语音渠道',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + 电话/智能音箱',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源,无自托管',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '团队 + 评论',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$40/月起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按对话数计费',
      },
    ],
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
