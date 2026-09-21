// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CompetitorConfig } from './types'

export const agentFrameworksCompetitorsPart2: Partial<
  Record<CompetitorConfig['id'], CompetitorConfig>
> = {
  llamaindex: {
    id: 'llamaindex',
    name: 'LlamaIndex',
    tagline: 'LlamaIndex 是数据连接 + RAG 框架;IHUI AI 是含 RAG 的全栈操作系统',
    verdict:
      '如果你只需要 RAG 数据管道,LlamaIndex 专业;如果需要 RAG + Agent + 工作流 + 跨端 + 团队协作,IHUI AI 更完整。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '数据连接 + RAG 框架',
        ihuiDetail: 'RAG 是组件之一',
        competitorDetail: '专注数据摄入 + 检索',
      },
      {
        dimension: '产品形态',
        ihui: '完整 OS(UI + 后端 + DB)',
        competitor: 'Python/TS SDK',
        ihuiDetail: '开箱即用',
        competitorDetail: '需自建前后端',
      },
      {
        dimension: 'RAG 能力',
        ihui: '向量 + BM25 + 知识图谱',
        competitor: '专业 + 丰富索引',
        ihuiDetail: '中文友好',
        competitorDetail: '索引类型多但需配置',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板',
        competitor: '无',
        ihuiDetail: '一键 fork 商用',
        competitorDetail: '需自己写',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: '代码编排',
        ihuiDetail: '业务人员可上手',
        competitorDetail: 'Workflow 编程式',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'SDK',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '自己写前端',
      },
      {
        dimension: 'MCP',
        ihui: '原生 + 100+ 预置',
        competitor: '需适配',
        ihuiDetail: '标准 MCP 生态',
        competitorDetail: '自己包装工具',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '无',
        ihuiDetail: '多租户企业级',
        competitorDetail: '需自建',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型 + 统一计费',
        competitor: '多模型 LlamaIndex',
        ihuiDetail: '统一积分 + 成本路由',
        competitorDetail: '需分别配凭证',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0',
        competitor: 'MIT',
        ihuiDetail: 'Docker/K8s 一键',
        competitorDetail: '自己搭',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费(MIT)',
        ihuiDetail: '云版统一积分',
        competitorDetail: '自己承担 LLM 成本',
      },
    ],
  },
  flowise: {
    id: 'flowise',
    name: 'Flowise',
    tagline: 'Flowise 是可视化 LangChain;IHUI AI 是含可视化 + 市场的全栈操作系统',
    verdict:
      '如果你只需要可视化拖拽 LLM 流程,Flowise 轻量;如果需要 Agent 市场 + 跨端 + 团队协作 + 私有化,IHUI AI 更完整。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '可视化 LLM 应用构建',
        ihuiDetail: '含市场 + 跨端 + 协作',
        competitorDetail: '专注拖拽流程',
      },
      {
        dimension: '产品形态',
        ihui: '完整 OS(6 端 + 后端 + DB)',
        competitor: 'Web 应用',
        ihuiDetail: '开箱即用 6 端',
        competitorDetail: '仅 Web',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: '模板库(社区)',
        ihuiDetail: '一键 fork 商用',
        competitorDetail: '需自己改造',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '仅 Web 应用',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 30+ 数据源',
        competitor: '基础 RAG 节点',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需自己配',
      },
      {
        dimension: 'MCP',
        ihui: '原生 + 100+ 预置',
        competitor: '需适配',
        ihuiDetail: '标准 MCP 生态',
        competitorDetail: '自己包装',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型 + 统一计费',
        competitor: '多模型',
        ihuiDetail: '统一积分 + 成本路由',
        competitorDetail: '需分别配凭证',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础多用户',
        ihuiDetail: '多租户企业级',
        competitorDetail: '简单权限',
      },
      {
        dimension: '工作流',
        ihui: 'n8n 风格画布 + 触发器',
        competitor: 'LangChain 拖拽',
        ihuiDetail: '业务人员可上手',
        competitorDetail: '需懂 LangChain',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0',
        competitor: 'Apache 2.0',
        ihuiDetail: 'Docker/K8s 一键',
        competitorDetail: 'Docker 部署',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费(开源)',
        ihuiDetail: '云版统一积分',
        competitorDetail: '自己承担 LLM 成本',
      },
    ],
  },
  typebot: {
    id: 'typebot',
    name: 'Typebot',
    tagline: 'Typebot 是开源聊天机器人构建器;IHUI AI 是含聊天 + Agent + RAG 的全栈操作系统',
    verdict:
      '如果你只需要可视化聊天机器人(表单/问卷),Typebot 专业;如果需要 AI Agent + 知识库 + 工作流 + 跨端,IHUI AI 更完整。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '聊天机器人构建器',
        ihuiDetail: '含 Agent + RAG + 工作流',
        competitorDetail: '专注聊天流程',
      },
      {
        dimension: '产品形态',
        ihui: '完整 OS(6 端 + 后端 + DB)',
        competitor: 'Web 应用',
        ihuiDetail: '开箱即用 6 端',
        competitorDetail: '仅 Web + 嵌入',
      },
      {
        dimension: 'AI 能力',
        ihui: 'Agent + RAG + 工作流',
        competitor: '聊天流程 + LLM 节点',
        ihuiDetail: '完整 AI 栈',
        competitorDetail: 'LLM 是节点之一',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: '模板库',
        ihuiDetail: '一键 fork 商用',
        competitorDetail: '需自己改造',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 30+ 数据源',
        competitor: '基础',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需自己接',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + 嵌入',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + iframe',
      },
      {
        dimension: 'MCP',
        ihui: '原生 + 100+ 预置',
        competitor: '需适配',
        ihuiDetail: '标准 MCP 生态',
        competitorDetail: '自己包装',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型 + 统一计费',
        competitor: '多模型',
        ihuiDetail: '统一积分 + 成本路由',
        competitorDetail: '需分别配凭证',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '多工作区',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础协作',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0',
        competitor: 'AGPL',
        ihuiDetail: 'Docker/K8s 一键',
        competitorDetail: 'Docker 部署',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费(自托管)',
        ihuiDetail: '云版统一积分',
        competitorDetail: '云版按对话计费',
      },
    ],
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
