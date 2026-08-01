'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, X, Sparkles, Rocket, Layers } from 'lucide-react'
import { Button } from '@ihui/ui-react'

type CellValue = boolean | string

interface CompareRow {
  dimension: string
  ihui: CellValue
  competitor: CellValue
  ihuiDetail?: string
  competitorDetail?: string
}

interface CompetitorConfig {
  id:
    | 'dify'
    | 'coze'
    | 'fastgpt'
    | 'n8n'
    | 'openai-agent'
    | 'langchain'
    | 'copilot-studio'
    | 'manus'
    | 'devin'
    | 'autogen'
    | 'crewai'
    | 'llamaindex'
    | 'flowise'
    | 'typebot'
    // 2026-07-26 阶段 8 新增:国内 AI 平台 8 个(高频搜索长尾)
    | 'ernie'
    | 'qwen-platform'
    | 'kimi-platform'
    | 'doubao'
    | 'deepseek-platform'
    | 'zhipu'
    | 'spark'
    | 'minimax'
    // 2026-07-26 阶段 8 新增:国际 SaaS 6 个(海外 AI 检索长尾)
    | 'zapier-ai'
    | 'make'
    | 'relevance-ai'
    | 'stack-ai'
    | 'wordware'
    | 'voiceflow'
    // 2026-07-26 阶段 9 新增:AI 编程助手 8 个(2025-2026 现象级,搜索量极高)
    | 'claude-code'
    | 'cursor'
    | 'github-copilot'
    | 'windsurf'
    | 'bolt-new'
    | 'replit-agent'
    | 'lovable'
    | 'v0-dev'
  name: string
  tagline: string
  rows: CompareRow[]
  verdict: string
}

const COMPETITORS: Record<CompetitorConfig['id'], CompetitorConfig> = {
  dify: {
    id: 'dify',
    name: 'Dify',
    tagline: 'Dify 偏 LLM 应用开发框架(Web 端);IHUI AI 是六端同源全栈 AI 操作系统',
    verdict:
      '如果你的团队只需要 Web 端的 LLM 应用开发,Dify 是不错的选择;如果你需要 Agent 市场化、六端分发、团队协作和私有化,IHUI AI 是更完整的方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'Web 端 LLM 应用开发框架',
        ihuiDetail: '一套代码,六端发布(Web/桌面/小程序/扩展/移动/CLI)',
        competitorDetail: '专注 Web 端 LLM 应用编排',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端(Web/桌面/小程序/扩展/移动/CLI)',
        competitor: 'Web only',
        ihuiDetail: '同源 React 组件库 + 同套 API 契约',
        competitorDetail: '仅 Web 应用,需自建其他端',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '内置 200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无内置 Agent 市场',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: true,
        ihuiDetail: '向量 + BM25 混合检索 + 中文友好 + 知识图谱',
        competitorDetail: '基础 RAG,文档解析能力相对简单',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '10+ 模型统一调度 + 自动 fallback + 成本路由',
        competitorDetail: '支持多模型,但无统一计费',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 Model Context Protocol,100+ 预置 MCP Server',
        competitorDetail: '不支持 MCP 协议',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: true,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支 + 人机协同',
        competitorDetail: '支持工作流,但节点类型相对有限',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO/OAuth + 积分共享',
        competitorDetail: '基础多用户,无 RBAC/审计/SSO',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: '受限',
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s Helm',
        competitorDetail: 'BSL 商业许可,生产环境需付费',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: 'Dify Open Source License (BSL)',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: 'BSL 限制商业竞争',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '社区版免费 + 云版按量计费',
        ihuiDetail: '自托管零费用,云版统一积分',
        competitorDetail: '云版按 token 计费,自托管有限制',
      },
    ],
  },
  coze: {
    id: 'coze',
    name: 'Coze',
    tagline: 'Coze 是字节跳动出品的闭源 AI Agent 平台;IHUI AI 是开源 + 私有化替代',
    verdict:
      '如果你的产品/数据不能上云,Coze 完全不适合你;如果可以上云但希望避免厂商锁定,IHUI AI 是开源 + 跨云的更好选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '字节出品的闭源 Agent 平台',
        ihuiDetail: '开源,Apache 2.0',
        competitorDetail: '闭源,字节跳动运营',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端',
        competitor: 'Web + 飞书/抖音插件',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '主要 Web + 飞书集成',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: true,
        ihuiDetail: '200+ 模板 + 创作者市场',
        competitorDetail: '字节官方 Bot 商店',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '不支持,数据全部上字节云',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: '无源码,无法审计',
      },
      {
        dimension: '数据主权',
        ihui: '自托管 100% 数据自有',
        competitor: '字节云托管',
        ihuiDetail: '自托管版数据不出域',
        competitorDetail: '数据由字节跳动掌控',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: '部分',
        ihuiDetail: '原生 MCP + 100+ 预置',
        competitorDetail: '部分插件支持',
      },
      {
        dimension: '多模型',
        ihui: '10+ 模型',
        competitor: '豆包为主 + 部分三方',
        ihuiDetail: 'OpenAI/Claude/Gemini/Qwen/DeepSeek/Kimi 等',
        competitorDetail: '豆包系列为主,接入有限',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础工作空间',
        ihuiDetail: '企业级协作',
        competitorDetail: '适合个人和小团队',
      },
      {
        dimension: '生态',
        ihui: '开源生态 + 跨云部署',
        competitor: '字节生态(飞书/抖音)',
        ihuiDetail: '中立,不被任何云锁定',
        competitorDetail: '深度绑定字节产品',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费(字节补贴)',
        ihuiDetail: '统一积分,无隐藏费用',
        competitorDetail: '免费但有调用上限',
      },
    ],
  },
  fastgpt: {
    id: 'fastgpt',
    name: 'FastGPT',
    tagline: 'FastGPT 专注知识库 Q&A;IHUI AI 含知识库 + Agent 市场 + 六端分发',
    verdict:
      '如果你的需求只是知识库 Q&A,FastGPT 够用;如果你需要 Agent 编排 + 跨端分发 + 团队协作,IHUI AI 是更完整的方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '知识库 Q&A 工具',
        ihuiDetail: '知识库是组件之一',
        competitorDetail: '专注知识库 RAG',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 应用',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: true,
        ihuiDetail: '向量 + BM25 + 知识图谱,中文友好',
        competitorDetail: '向量检索为主,中文友好',
      },
      {
        dimension: 'Agent 编排',
        ihui: true,
        competitor: '有限',
        ihuiDetail: '可视化拖拽 Agent + 200+ 模板',
        competitorDetail: '基础工作流,无 Agent 市场',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 MCP,100+ 预置',
        competitorDetail: '不支持',
      },
      {
        dimension: '多模型调度',
        ihui: '10+ 模型 + 自动 fallback',
        competitor: '多模型但无统一计费',
        ihuiDetail: '统一积分 + 成本路由',
        competitorDetail: '需分别配 API Key',
      },
      {
        dimension: '工作流',
        ihui: true,
        competitor: '基础',
        ihuiDetail: 'n8n 风格画布',
        competitorDetail: '基础节点',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础多用户',
        ihuiDetail: '多租户工作区',
        competitorDetail: '简单权限',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0',
        competitor: 'Apache 2.0',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: 'Docker 部署',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费',
        ihuiDetail: '云版统一积分',
        competitorDetail: '自托管免费',
      },
      {
        dimension: '生态',
        ihui: 'Agent 市场 + MCP 工具市场',
        competitor: '知识库模板',
        ihuiDetail: '完整 AI 操作系统生态',
        competitorDetail: '专注 RAG 场景',
      },
    ],
  },
  n8n: {
    id: 'n8n',
    name: 'n8n',
    tagline: 'n8n 偏工作流自动化;IHUI AI 在工作流上叠加 LLM + Agent + 六端',
    verdict:
      '如果你的需求是纯工作流自动化(无 AI),n8n 生态更丰富;如果你需要 LLM/Agent 作为工作流核心节点,IHUI AI 是更合适的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统,含工作流',
        competitor: '工作流自动化平台',
        ihuiDetail: '工作流是组件,LLM/Agent 是一等公民',
        competitorDetail: '通用工作流,LLM 只是一个节点',
      },
      {
        dimension: 'AI 能力',
        ihui: '原生 AI 优先',
        competitor: '作为节点集成',
        ihuiDetail: 'LLM/Agent/Knowledge Base 是核心模块',
        competitorDetail: '通过 AI 节点接入,需自己配',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化拖拽 + 200+ 模板',
        competitor: '无 Agent 概念',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需自己用 LLM 节点搭建',
      },
      {
        dimension: '知识库',
        ihui: '内置 RAG 模块',
        competitor: '需通过 Pinecone 等外部集成',
        ihuiDetail: '向量 + BM25 混合检索',
        competitorDetail: '外部向量库集成',
      },
      {
        dimension: 'MCP',
        ihui: true,
        competitor: '有限',
        ihuiDetail: '原生 MCP,100+ 预置',
        competitorDetail: '通过社区节点',
      },
      {
        dimension: '客户端',
        ihui: '6 端',
        competitor: 'Web + 自托管',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 编辑器 + 自托管',
      },
      {
        dimension: '多模型',
        ihui: '10+ 模型 + 统一计费',
        competitor: '通过节点接入',
        ihuiDetail: 'OpenAI/Claude/Gemini 等',
        competitorDetail: '需分别配凭证',
      },
      {
        dimension: '工作流节点',
        ihui: 'AI 节点 + 通用节点',
        competitor: '通用节点(400+)',
        ihuiDetail: 'AI 节点更丰富',
        competitorDetail: '集成节点更丰富',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: 'Sustainable Use License',
        ihuiDetail: '完全开源,商业可用',
        competitorDetail: 'SUL 限制商业竞争',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '多用户协作',
        ihuiDetail: '多租户 + 积分共享',
        competitorDetail: '协作功能较基础',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '云版按工作流执行计费',
        ihuiDetail: '统一积分',
        competitorDetail: '按执行次数',
      },
    ],
  },
  'openai-agent': {
    id: 'openai-agent',
    name: 'OpenAI Agent Builder',
    tagline: 'OpenAI Agent Builder 锁定 OpenAI 生态;IHUI AI 跨 30+ 模型中立',
    verdict:
      '如果你的项目全栈使用 OpenAI 且不需要私有化,OpenAI Agent Builder 够用;如果你需要多模型切换、私有化部署、数据主权,IHUI AI 是更灵活的选择。',
    rows: [
      {
        dimension: '模型选择',
        ihui: '30+ 模型中立',
        competitor: '仅 OpenAI 系列',
        ihuiDetail: 'GPT-4o / Claude / Gemini / DeepSeek / Qwen 等',
        competitorDetail: 'GPT-4o / o1 / o3 系列',
      },
      {
        dimension: '开源',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可审计',
        competitorDetail: '闭源,黑盒',
      },
      {
        dimension: '私有化',
        ihui: '完整支持',
        competitor: '不支持',
        ihuiDetail: 'Docker Compose / K8s 离线部署',
        competitorDetail: '仅 OpenAI 云端',
      },
      {
        dimension: '数据主权',
        ihui: '自托管 100% 自主',
        competitor: 'OpenAI 托管',
        ihuiDetail: '数据不出域',
        competitorDetail: '数据经 OpenAI',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: 'GPT Store',
        ihuiDetail: 'Apache 2.0 可商用',
        competitorDetail: 'OpenAI 审核上架',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'SDK 自行开发',
      },
      {
        dimension: 'MCP 协议',
        ihui: '原生支持',
        competitor: '部分支持',
        ihuiDetail: '100+ 预置 MCP Server',
        competitorDetail: 'MCP 规范新发布',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 可对接外部',
        competitor: '需自己实现',
        ihuiDetail: '向量 + BM25 + 中文友好',
        competitorDetail: '依赖 Assistants File Search',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: '代码编排',
        ihuiDetail: '拖拽节点 + 触发器',
        competitorDetail: '主要靠 SDK 代码',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: 'OpenAI Workspace 基础',
        ihuiDetail: '多租户企业级',
        competitorDetail: '适合小团队',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '按 token 计费',
        ihuiDetail: '统一积分,跨模型成本优化',
        competitorDetail: 'GPT-4o 较贵,无优化空间',
      },
    ],
  },
  langchain: {
    id: 'langchain',
    name: 'LangChain / LangGraph',
    tagline: 'LangChain 是 Python SDK 框架;IHUI AI 是完整生产就绪操作系统',
    verdict:
      '如果你是研究/原型阶段,LangChain 灵活;如果需要生产就绪的 UI、Agent 市场、跨端分发、私有化,IHUI AI 是更优选择。',
    rows: [
      {
        dimension: '产品形态',
        ihui: '完整 OS(UI + 后端 + DB)',
        competitor: 'Python SDK',
        ihuiDetail: '开箱即用',
        competitorDetail: '需自己搭建前后端',
      },
      {
        dimension: '上手成本',
        ihui: '30 分钟注册',
        competitor: '2-3 天搭原型',
        ihuiDetail: '无需开发',
        competitorDetail: '需写 FastAPI/前端/数据库',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: 'LangGraph 代码编排',
        ihuiDetail: '拖拽 + 一键 fork',
        competitorDetail: 'StateGraph 编程式',
      },
      {
        dimension: 'Agent 市场',
        ihui: '内置社区市场',
        competitor: '无',
        ihuiDetail: '创作者分成 + 商用',
        competitorDetail: 'Hub 主要是组件库',
      },
      {
        dimension: 'MCP',
        ihui: '原生支持',
        competitor: 'MCP 适配器',
        ihuiDetail: '100+ 预置',
        competitorDetail: 'langchain-mcp-adapters',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: '0 端(库)',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '需自行开发',
      },
      {
        dimension: '知识库',
        ihui: '内置 RAG + 向量库',
        competitor: '集成外部向量库',
        ihuiDetail: 'pgvector / Qdrant / Milvus',
        competitorDetail: '需自己配 Pinecone/Chroma',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: 'LangGraph 代码',
        ihuiDetail: '业务人员可上手',
        competitorDetail: '需 Python 工程师',
      },
      {
        dimension: '部署',
        ihui: 'Docker Compose / K8s 一键',
        competitor: '自建',
        ihuiDetail: '生产就绪',
        competitorDetail: '需自己写 Dockerfile',
      },
      {
        dimension: '生产案例',
        ihui: '120+ 企业付费客户',
        competitor: '开发者自部署',
        ihuiDetail: '完整 SLA 保障',
        competitorDetail: '社区支持',
      },
      {
        dimension: '许可证',
        ihui: 'Apache 2.0',
        competitor: 'MIT',
        ihuiDetail: '完全开源商用',
        competitorDetail: '更宽松',
      },
    ],
  },
  'copilot-studio': {
    id: 'copilot-studio',
    name: 'Microsoft Copilot Studio',
    tagline: 'Copilot Studio 锁定 Microsoft 365;IHUI AI 跨云中立',
    verdict:
      '如果你的企业全栈 Microsoft 365 且不要求自托管,Copilot Studio 适合;如果需要跨云中立、Apache 2.0 源码可控、数据自有,IHUI AI 是更灵活的选择。',
    rows: [
      {
        dimension: '云锁定',
        ihui: '跨云中立',
        competitor: 'Azure 锁定',
        ihuiDetail: 'AWS / Azure / GCP / 阿里云 / 腾讯云',
        competitorDetail: '必须 Microsoft 云',
      },
      {
        dimension: '开源',
        ihui: 'Apache 2.0',
        competitor: '闭源 SaaS',
        ihuiDetail: '可审计可定制',
        competitorDetail: '无法修改内核',
      },
      {
        dimension: '私有化',
        ihui: '完整支持',
        competitor: '受限',
        ihuiDetail: '离线 K8s 部署',
        competitorDetail: '需 Power Platform 环境',
      },
      {
        dimension: '数据主权',
        ihui: '自托管 100%',
        competitor: 'Microsoft 365 租户',
        ihuiDetail: '数据完全自有',
        competitorDetail: '数据在 Microsoft 云',
      },
      {
        dimension: 'Microsoft 365 集成',
        ihui: '丰富(Teams/Outlook/Word/Excel/SharePoint)',
        competitor: '原生',
        ihuiDetail: 'IHUI AI 集成更广(同时支持飞书/钉钉/微信)',
        competitorDetail: 'Microsoft 全家桶原生',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web + Teams',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 画布 + Teams 应用',
      },
      {
        dimension: '模型',
        ihui: '30+ 模型',
        competitor: 'OpenAI + Azure OpenAI',
        ihuiDetail: '跨厂商模型 + 成本路由',
        competitorDetail: 'Azure OpenAI 为主',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$200/月/租户起',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按消息计费,较贵',
      },
      {
        dimension: 'RBAC',
        ihui: '完整',
        competitor: 'Microsoft Entra ID',
        ihuiDetail: '细粒度',
        competitorDetail: '依赖 Entra',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板社区',
        competitor: 'Copilot Template Library',
        ihuiDetail: 'Apache 2.0 可商用',
        competitorDetail: 'Microsoft 官方模板',
      },
      {
        dimension: '国产化',
        ihui: '信创全栈适配',
        competitor: '不支持',
        ihuiDetail: '麒麟/统信/鲲鹏/海光',
        competitorDetail: 'Microsoft 生态外不兼容',
      },
    ],
  },
  manus: {
    id: 'manus',
    name: 'Manus AI',
    tagline: 'Manus 是单任务自主 Agent;IHUI AI 是可复用的 Agent 操作系统',
    verdict:
      '如果你想跑一次性研究/操作任务,Manus 体验酷炫;如果你需要构建可复用、可分享、可商业化的 Agent 产品,IHUI AI 是更系统化的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统(可复用)',
        competitor: '单任务自主 Agent(一次性)',
        ihuiDetail: '构建可复用 Agent 产品',
        competitorDetail: '跑一次性研究/操作任务',
      },
      {
        dimension: 'Agent 复用',
        ihui: '完整支持',
        competitor: '有限',
        ihuiDetail: 'Agent 市场 + 模板 + 一键 fork',
        competitorDetail: '任务完成即结束,无持久化',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: '无',
        ihuiDetail: '社区市场 + 商业化',
        competitorDetail: '无市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 RAG 模块',
        competitor: '临时检索',
        ihuiDetail: '向量 + BM25 + 中文友好',
        competitorDetail: '任务期间临时检索',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: '黑盒自主决策',
        ihuiDetail: '可控 + 可审计',
        competitorDetail: '黑盒,难控制',
      },
      {
        dimension: 'MCP 工具',
        ihui: '原生 + 100+ 预置',
        competitor: '部分支持',
        ihuiDetail: '完整 MCP 生态',
        competitorDetail: '基础工具调用',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型',
        competitor: 'Claude 为主',
        ihuiDetail: '跨厂商模型 + 成本路由',
        competitorDetail: '依赖单一模型',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 体验',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '单用户',
        ihuiDetail: '多租户企业级',
        competitorDetail: '适合个人',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0 + 完整私有化',
        competitor: '闭源 SaaS',
        ihuiDetail: '数据自有',
        competitorDetail: '数据经 Manus 云',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '邀请制 + 订阅',
        ihuiDetail: '开源透明',
        competitorDetail: '邀请码 + 付费',
      },
    ],
  },
  devin: {
    id: 'devin',
    name: 'Devin AI',
    tagline: 'Devin 专注 AI 程序员(单点);IHUI AI 是通用全栈 AI 操作系统',
    verdict:
      '如果你的需求是"AI 软件工程师"单点工具,Devin 体验前沿;如果你需要 AI Agent 全场景(客服/知识库/内容/工作流)+ 跨端分发,IHUI AI 是更全面的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '通用全栈 AI 操作系统',
        competitor: 'AI 软件工程师(单点)',
        ihuiDetail: '通用场景:客服/知识库/内容/工作流',
        competitorDetail: '专注代码任务',
      },
      {
        dimension: '应用场景',
        ihui: '10+ 场景',
        competitor: '1 场景(编程)',
        ihuiDetail: '客服/教育/医疗/法律/制造/媒体/政企...',
        competitorDetail: '软件工程',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多种格式',
        competitor: '代码上下文',
        ihuiDetail: 'PDF/Word/网页/数据库/Notion',
        competitorDetail: '代码仓库为主',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 跨场景模板',
        competitor: '编程模板',
        ihuiDetail: '客服 Agent/教育 Agent/销售 Agent...',
        competitorDetail: 'Devin 编程模板',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型',
        competitor: 'Claude 为主',
        ihuiDetail: '跨厂商 + 成本路由',
        competitorDetail: 'Anthropic 优先',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'Web IDE',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web 编辑器',
      },
      {
        dimension: 'MCP 工具',
        ihui: '原生 + 100+ 预置',
        competitor: '基础',
        ihuiDetail: '完整 MCP 生态',
        competitorDetail: '编程工具为主',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布 + 触发器',
        competitor: '自主执行',
        ihuiDetail: '业务人员可上手',
        competitorDetail: '需 Devin 自己决策',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '基础',
        ihuiDetail: '多角色企业级',
        competitorDetail: '开发协作',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0 + 完整私有化',
        competitor: '闭源',
        ihuiDetail: '代码自有',
        competitorDetail: '数据过 Cognition',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$500/月起',
        ihuiDetail: '性价比高',
        competitorDetail: '较贵',
      },
    ],
  },
  // 2026-07-26 阶段 7 新增:5 个长尾对比页(开源生态扩展)
  autogen: {
    id: 'autogen',
    name: 'Microsoft AutoGen',
    tagline: 'AutoGen 是多 Agent 代码框架;IHUI AI 是完整生产就绪操作系统',
    verdict:
      '如果你是研究员/工程师想精细控制多 Agent 对话,AutoGen 灵活;如果需要生产就绪 UI、Agent 市场、跨端分发、私有化,IHUI AI 是更优选择。',
    rows: [
      {
        dimension: '产品形态',
        ihui: '完整 OS(UI + 后端 + DB)',
        competitor: 'Python SDK',
        ihuiDetail: '开箱即用',
        competitorDetail: '需自建前后端',
      },
      {
        dimension: '多 Agent 协作',
        ihui: '可视化 + 代码双模式',
        competitor: '代码编排(GroupChat',
        ihuiDetail: '业务人员也能用',
        competitorDetail: 'AssistantAgent 编程式',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: '无',
        ihuiDetail: '一键 fork 商用',
        competitorDetail: '需自己写',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 30+ 数据源',
        competitor: '需自己接',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '配 LlamaIndex 等',
      },
      {
        dimension: '客户端',
        ihui: '6 端同源',
        competitor: 'SDK 调用',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '自己写前端',
      },
      {
        dimension: 'MCP 协议',
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
        dimension: '私有化',
        ihui: 'Apache 2.0 + 完整文档',
        competitor: 'MIT + 自托管',
        ihuiDetail: 'Docker/K8s 一键部署',
        competitorDetail: '需自己搭',
      },
      {
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: '代码对话',
        ihuiDetail: '触发器 + 条件分支',
        competitorDetail: 'Agent 间消息传递',
      },
      {
        dimension: '监控',
        ihui: '内置 + 仪表盘',
        competitor: '基础日志',
        ihuiDetail: 'Agent 性能 + 成本',
        competitorDetail: '需自己接',
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
  crewai: {
    id: 'crewai',
    name: 'CrewAI',
    tagline: 'CrewAI 是角色扮演多 Agent 框架;IHUI AI 是全栈 AI 操作系统',
    verdict:
      '如果你喜欢"角色分工"模式快速原型,CrewAI 简洁;如果需要生产级 UI、Agent 市场、跨端、团队协作,IHUI AI 更完整。',
    rows: [
      {
        dimension: '产品形态',
        ihui: '完整 OS(UI + 后端 + DB)',
        competitor: 'Python SDK',
        ihuiDetail: '开箱即用',
        competitorDetail: '需自建前后端',
      },
      {
        dimension: 'Agent 协作模式',
        ihui: '可视化 + 代码 + 角色',
        competitor: '角色扮演(Role-Playing',
        ihuiDetail: '多种编排方式',
        competitorDetail: 'Agent 角色分工',
      },
      {
        dimension: 'Agent 市场',
        ihui: '200+ 模板 + 创作者分成',
        competitor: '无',
        ihuiDetail: '一键 fork 商用',
        competitorDetail: '需自己写',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需自己接',
        ihuiDetail: '向量 + BM25',
        competitorDetail: '配外部工具',
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
        dimension: '工作流',
        ihui: '可视化画布',
        competitor: '代码流程',
        ihuiDetail: '触发器 + 条件分支',
        competitorDetail: 'Process 编程式',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '无',
        ihuiDetail: '多租户企业级',
        competitorDetail: '需自建',
      },
      {
        dimension: '监控',
        ihui: '内置 + 仪表盘',
        competitor: '基础',
        ihuiDetail: 'Agent 性能 + 成本',
        competitorDetail: '需自己接',
      },
      {
        dimension: '私有化',
        ihui: 'Apache 2.0 + 完整文档',
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
  // 2026-07-26 阶段 8 新增:国内 AI 平台 8 个(高频搜索长尾)
  ernie: {
    id: 'ernie',
    name: 'ERNIE Bot / 文心一言',
    tagline: '文心一言是百度 C 端 AI 助手;IHUI AI 是企业级 Agent 操作系统',
    verdict:
      '如果只是个人问答对话,文心一言够用;如果企业需要构建专属 Agent + 私有知识库 + 跨端分发 + 团队协作,IHUI AI 是更系统化的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '企业级 Agent 操作系统',
        competitor: 'C 端通用 AI 助手',
        ihuiDetail: 'Agent 市场 + 知识库 + 工作流 + 六端分发',
        competitorDetail: '问答对话 + 百度生态集成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + APP + 小程序',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '百度系 APP 为主',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可商用可审计',
        competitorDetail: '闭源 SaaS,无法自托管',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '不支持',
        ihuiDetail: 'Docker Compose + K8s 离线部署',
        competitorDetail: '仅百度云端',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化拖拽 + 200+ 模板',
        competitor: '基础对话 + 插件',
        ihuiDetail: 'Agent 市场 + 一键 fork + 创作者分成',
        competitorDetail: '插件生态,无 Agent 市场',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 向量/BM25/知识图谱',
        competitor: '百度搜索集成',
        ihuiDetail: '企业私有知识库,数据不出域',
        competitorDetail: '依赖百度搜索,无私有知识库',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '仅 ERNIE 系列',
        ihuiDetail: 'GPT/Claude/Gemini/Qwen/DeepSeek/ERNIE 等',
        competitorDetail: 'ERNIE 4.0 / Speed / Lite',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '个人账号',
        ihuiDetail: '多租户 + 积分共享 + 审计日志',
        competitorDetail: '无企业协作功能',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费 + Pro ¥49.9/月',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按 token 计费,无自托管',
      },
    ],
  },
  'qwen-platform': {
    id: 'qwen-platform',
    name: 'Tongyi Qianwen / 通义千问',
    tagline: '通义千问是阿里大模型平台;IHUI AI 跨 30+ 模型中立 + Agent 市场化',
    verdict:
      '如果只用通义千问模型 API,阿里平台够用;如果需要跨模型调度 + Agent 编排 + 六端分发 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '阿里大模型平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '模型 API + 阿里云集成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + API',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '需自行开发客户端',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '部分开源(Qwen 模型)',
        ihuiDetail: '平台完全开源',
        competitorDetail: '模型开源,平台闭源',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '受限',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '需阿里云灵积 API 或自部署 Qwen',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: 'API 调用',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需自己写编排逻辑',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需自建',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需对接阿里云向量检索',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '仅通义系列',
        ihuiDetail: '跨厂商 + 自动 fallback',
        competitorDetail: 'Qwen-Max/Plus/Turbo',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '阿里云 RAM',
        ihuiDetail: '多租户工作区',
        competitorDetail: '依赖阿里云权限',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '按 token 计费',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '云版按量,无统一积分',
      },
    ],
  },
  'kimi-platform': {
    id: 'kimi-platform',
    name: 'Kimi / 月之暗面',
    tagline: 'Kimi 在长文本对话方面有特色;IHUI AI 是全栈 Agent 操作系统(含 Kimi 模型)',
    verdict:
      '如果只需要长文本阅读/对话,Kimi 体验较好;如果需要构建 Agent 产品 + 知识库 + 跨端分发 + 团队协作,IHUI AI 是更完整方案(且可接入 Kimi 模型)。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '长文本 AI 助手',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '200 万字长文本对话',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + APP',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + 移动 APP',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源 SaaS',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '不支持',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '仅 Kimi 云端',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '基础对话',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '无 Agent 编排',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '文件上传对话',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '临时文件解析,无持久化知识库',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型(含 Kimi)',
        competitor: '仅 Kimi',
        ihuiDetail: '可接入 Kimi + GPT + Claude 等',
        competitorDetail: '锁定 Moonshot 模型',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '个人账号',
        ihuiDetail: '多租户企业级',
        competitorDetail: '无企业协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费 + Pro ¥X/月',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按 token 计费',
      },
    ],
  },
  doubao: {
    id: 'doubao',
    name: 'Doubao / 豆包',
    tagline: '豆包是字节 C 端 AI 助手;IHUI AI 是企业级开源 Agent 平台',
    verdict:
      '如果个人日常问答/创作,豆包免费好用;如果企业需要私有化部署 + 数据主权 + Agent 编排 + 跨端分发,IHUI AI 是更合适的选择。',
    rows: [
      {
        dimension: '定位',
        ihui: '企业级 Agent 操作系统',
        competitor: 'C 端 AI 助手',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '日常对话 + 创作 + 抖音生态',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + APP',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '字节系 APP 为主',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源 SaaS',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '不支持',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '仅字节云',
      },
      {
        dimension: '数据主权',
        ihui: '自托管 100% 数据自有',
        competitor: '字节云托管',
        ihuiDetail: '数据不出域',
        competitorDetail: '数据由字节掌控',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '基础对话 + 扣子集成',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需配合扣子平台',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '仅豆包系列',
        ihuiDetail: '跨厂商 + 自动 fallback',
        competitorDetail: '豆包 Pro/Lite/Function call',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '个人账号',
        ihuiDetail: '多租户企业级',
        competitorDetail: '无企业协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '免费但有调用上限',
      },
    ],
  },
  'deepseek-platform': {
    id: 'deepseek-platform',
    name: 'DeepSeek Platform',
    tagline: 'DeepSeek 是推理模型 API;IHUI AI 含 DeepSeek + 30+ 模型 + Agent 编排',
    verdict:
      '如果只需调用 DeepSeek API,官方平台较直接;如果需要 Agent 编排 + 知识库 + 工作流 + 六端分发 + 团队协作,IHUI AI 是更完整方案(且原生支持 DeepSeek 模型)。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '大模型 API 平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: 'V3/R1/Reasoner API',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'API only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '需自行开发客户端',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '模型 MIT(平台闭源)',
        ihuiDetail: '平台完全开源',
        competitorDetail: '模型权重开源,平台闭源',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '模型可自部署',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '需自部署 DeepSeek 模型 + 自建平台',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: 'API 调用',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需自己写编排',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需自建',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需对接外部向量库',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型(含 DeepSeek)',
        competitor: '仅 DeepSeek',
        ihuiDetail: 'DeepSeek + GPT + Claude + Qwen 等',
        competitorDetail: 'V3 / R1 / Reasoner',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: 'API Key 管理',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础 Key 管理',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '按 token 计费(极低)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: 'API 极低价,但需自建平台',
      },
    ],
  },
  zhipu: {
    id: 'zhipu',
    name: 'Zhipu Qingyan / 智谱清言',
    tagline: '智谱清言是 GLM 模型应用;IHUI AI 跨模型 + Agent 市场 + 六端分发',
    verdict:
      '如果只用 GLM 系列模型,智谱清言够用;如果需要跨模型调度 + Agent 编排 + 六端分发 + 团队协作,IHUI AI 是更完整方案(且原生支持 GLM 模型)。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: 'GLM 模型应用平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: 'GLM-4 + 智能体 + 阿里云集成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + APP',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web + 移动 APP',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '部分开源(GLM 模型)',
        ihuiDetail: '平台完全开源',
        competitorDetail: 'GLM 模型部分开源,平台闭源',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '受限',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '需自部署 GLM 模型 + 自建平台',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '智谱智能体',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '智谱智能体平台',
      },
      {
        dimension: '知识库 RAG',
        ihui: '内置 + 多格式',
        competitor: '需自建',
        ihuiDetail: '向量 + BM25 + 知识图谱',
        competitorDetail: '需对接外部向量库',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型(含 GLM)',
        competitor: '仅 GLM 系列',
        ihuiDetail: 'GLM + GPT + Claude + Qwen 等',
        competitorDetail: 'GLM-4 / GLM-4-Plus / GLM-4V',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '个人 + 团队空间',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础团队功能',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费 + 按量',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: 'GLM-4 按量计费',
      },
    ],
  },
  spark: {
    id: 'spark',
    name: 'iFlytek Spark / 讯飞星火',
    tagline: '星火偏教育/语音 AI;IHUI AI 是全栈 Agent 操作系统跨行业',
    verdict:
      '如果业务聚焦教育/语音交互,讯飞星火生态成熟;如果需要跨行业 Agent 编排 + 六端分发 + 私有化 + 团队协作,IHUI AI 是更通用方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '教育/语音 AI 平台',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: '星火大模型 + 讯飞语音 + 教育',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + APP + 硬件',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '讯飞硬件 + APP',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源 SaaS',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '企业版支持',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '讯飞企业版(付费)',
      },
      {
        dimension: '语音能力',
        ihui: '可对接讯飞/百度/Whisper',
        competitor: '原生支持(TTS/ASR) 较完善',
        ihuiDetail: '灵活对接多家语音',
        competitorDetail: '讯飞语音原生集成',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: '基础智能体',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '讯飞 AIUI 平台',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型中立',
        competitor: '仅星火系列',
        ihuiDetail: '星火 + GPT + Claude + Qwen 等',
        competitorDetail: 'Spark Max/Pro/Mini',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: '企业版',
        ihuiDetail: '多租户企业级',
        competitorDetail: '讯飞企业版协作',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '免费 + 企业版',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '企业版按席位',
      },
    ],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    tagline: 'MiniMax 是多模态大模型 API;IHUI AI 含 MiniMax + Agent 编排 + 六端',
    verdict:
      '如果只需多模态模型 API(文本/语音/视频),MiniMax 直接够用;如果需要 Agent 编排 + 知识库 + 工作流 + 六端分发 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '全栈 AI 操作系统',
        competitor: '多模态大模型 API',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端',
        competitorDetail: 'abab 系列 + 语音/视频',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'API + 海螺 AI',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'API + 海螺 APP',
      },
      {
        dimension: '开源协议',
        ihui: 'Apache 2.0',
        competitor: '闭源',
        ihuiDetail: '完全开源可商用',
        competitorDetail: '闭源 API',
      },
      {
        dimension: '私有化部署',
        ihui: '完整支持',
        competitor: '不支持',
        ihuiDetail: 'Docker Compose + K8s',
        competitorDetail: '仅 MiniMax 云端',
      },
      {
        dimension: '多模态',
        ihui: '可对接 MiniMax/百度/字节',
        competitor: '原生支持',
        ihuiDetail: '灵活对接多家',
        competitorDetail: '文本/语音/视频原生',
      },
      {
        dimension: 'Agent 编排',
        ihui: '可视化 + 200+ 模板',
        competitor: 'API 调用',
        ihuiDetail: 'Agent 市场 + 一键 fork',
        competitorDetail: '需自己写编排',
      },
      {
        dimension: '多模型',
        ihui: '30+ 模型(含 MiniMax)',
        competitor: '仅 MiniMax',
        ihuiDetail: 'MiniMax + GPT + Claude + Qwen',
        competitorDetail: 'abab6 / abab5.5 / 语音',
      },
      {
        dimension: '团队协作',
        ihui: '完整 RBAC + 审计 + SSO',
        competitor: 'API Key',
        ihuiDetail: '多租户企业级',
        competitorDetail: '基础 Key 管理',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '按 token 计费',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按量计费',
      },
    ],
  },
  // 2026-07-26 阶段 8 新增:国际 SaaS 6 个(海外 AI 检索长尾)
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
  // 2026-07-26 阶段 9 新增:AI 编程助手 8 个(2025-2026 现象级,搜索量极高)
  'claude-code': {
    id: 'claude-code',
    name: 'Claude Code',
    tagline: 'Claude Code 是终端内 AI 编程助手;IHUI AI 是含代码 Agent 的全栈 AI 操作系统',
    verdict:
      '如果你的团队主要在终端写代码且只用 Claude 模型,Claude Code 体验流畅;如果你需要 Agent 市场 + 知识库 RAG + 六端分发 + 多模型调度 + 团队协作 + 私有化部署,IHUI AI 是更完整的企业级方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '终端内 AI 编程助手',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注 CLI 内代码生成与编辑',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'CLI only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '仅命令行,无 GUI 客户端',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: '代码上下文为主',
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '依赖本地代码仓库上下文',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: false,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback + 成本路由',
        competitorDetail: '仅 Claude 系列模型(Anthropic)',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: true,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: 'Claude Code 原生支持 MCP',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: '个人 API Key,无企业协作',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Anthropic',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: '多语言(主流)',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: 'Python/JS/TS/Go/Rust 等主流语言',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '终端 + IDE 适配',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: '通过 MCP 与 VS Code/JetBrains 联动',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$20/月起(Pro)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按订阅计费,无自托管',
      },
    ],
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    tagline: 'Cursor 是 AI IDE(代码补全 + Chat);IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你是个人开发者专注写代码,Cursor IDE 体验优秀;如果企业需要 Agent 市场 + 知识库 RAG + 六端分发 + 团队协作 + 私有化,IHUI AI 是更完整方案(且 IHUI CLI 端同样支持代码生成)。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'AI 优先 IDE(VS Code fork)',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注代码补全 + Chat + Agent',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: '桌面 IDE only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'macOS/Windows/Linux 桌面应用',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: '代码库索引',
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '专注本地代码索引(@codebase)',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback + 成本路由',
        competitorDetail: '支持 Claude/GPT/Gemini 等主流模型',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: true,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: 'Cursor 0.42+ 原生支持 MCP',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: 'Cursor Pro/Teams 基础团队功能',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Cursor 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: '多语言(全栈)',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: 'Python/JS/TS/Go/Rust/Java 等',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '原生 IDE',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'Cursor 本身即 IDE,体验较为完善',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$20/月起(Pro)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按订阅计费,无自托管',
      },
    ],
  },
  'github-copilot': {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    tagline: 'GitHub Copilot 是老牌 AI 编程助手;IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你的团队已深度使用 GitHub + VS Code 生态,GitHub Copilot 集成较自然;如果需要 Agent 编排 + 知识库 + 工作流 + 六端分发 + 私有化部署,IHUI AI 是更完整的企业级方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'AI 编程助手(IDE 插件)',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注代码补全 + Chat + Workspace',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'IDE 插件 only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'VS Code/JetBrains/Visual Studio/Neovim',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: '代码库 + GitHub 仓库',
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '@workspace 索引 GitHub 仓库',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: '部分',
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: 'GPT/Claude/Gemini 有限选择',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: true,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: 'Copilot 2025 起支持 MCP',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: 'Copilot Business/Enterprise 席位',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 GitHub 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: '多语言(全栈)',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: '20+ 主流编程语言',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '原生 IDE 集成',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'VS Code/JetBrains 深度集成',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$10/月起(Business)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按席位计费,无自托管',
      },
    ],
  },
  windsurf: {
    id: 'windsurf',
    name: 'Windsurf',
    tagline: 'Windsurf 是 Codeium 出品 AI IDE;IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你喜欢 Codeium 风格的 AI IDE 体验,Windsurf 流畅;如果企业需要 Agent 市场 + 知识库 + 工作流 + 六端分发 + 私有化部署,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'AI 优先 IDE(Codeium 出品)',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注代码补全 + Cascade Agent',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: '桌面 IDE only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'macOS/Windows/Linux 桌面应用',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: '代码库索引',
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '专注本地代码索引',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: '支持 Claude/GPT/Gemini 等',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: true,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: 'Windsurf 原生支持 MCP',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: 'Windsurf Teams 基础团队功能',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Codeium 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: '多语言(全栈)',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: '40+ 编程语言',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '原生 IDE',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'Windsurf 本身即 IDE',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$15/月起(Pro)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按订阅计费,无自托管',
      },
    ],
  },
  'bolt-new': {
    id: 'bolt-new',
    name: 'Bolt.new',
    tagline: 'Bolt.new 是浏览器内全栈应用生成;IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你需要快速原型生成全栈 Web 应用,Bolt.new 体验流畅;如果企业需要 Agent 市场 + 知识库 + 工作流 + 六端分发 + 团队协作 + 私有化,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '浏览器内全栈应用生成',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注 prompt → 全栈应用一键生成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '仅 Web 应用(StackBlitz WebContainer)',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: false,
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '无知识库 RAG 能力',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: '支持 Claude/GPT 等(有限选择)',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: '不支持 MCP 协议',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: '基础项目分享,无企业协作',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 StackBlitz 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: 'JS/TS 全栈为主',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: '专注 JavaScript/TypeScript 全栈',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '浏览器内 IDE',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'StackBlitz WebContainer 在线 IDE',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$20/月起(Pro)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按 token + 订阅计费',
      },
    ],
  },
  'replit-agent': {
    id: 'replit-agent',
    name: 'Replit Agent',
    tagline: 'Replit Agent 是云端 IDE + AI Agent;IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你需要云端协作开发 + 一键部署,Replit Agent 体验流畅;如果企业需要 Agent 市场 + 知识库 + 工作流 + 六端分发 + 私有化 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '云端 IDE + AI Agent',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注云端开发 + 部署 + AI Agent',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web + 移动 APP',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: 'Web IDE + iOS/Android APP',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: false,
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '无知识库 RAG 能力',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: '支持 Claude/GPT 等(有限选择)',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: '部分',
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: '通过工具调用支持有限 MCP',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: 'Replit Teams 基础协作',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Replit 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: '多语言(全栈)',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: '50+ 编程语言',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '云端 IDE',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'Replit 云端 IDE 原生体验',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$25/月起(Core)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按订阅 + 计算资源计费',
      },
    ],
  },
  lovable: {
    id: 'lovable',
    name: 'Lovable',
    tagline: 'Lovable 是全栈应用生成(prompt → 应用);IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你需要快速生成全栈 Web 应用(类似 Bolt.new),Lovable 体验流畅;如果企业需要 Agent 市场 + 知识库 + 工作流 + 六端分发 + 私有化 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: '全栈应用生成(prompt → 应用)',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注 prompt → 全栈 Web 应用一键生成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '仅 Web 应用生成',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: false,
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '无知识库 RAG 能力',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: true,
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: '支持 Claude/GPT 等(有限选择)',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: '不支持 MCP 协议',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: '基础项目分享,无企业协作',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Lovable 云',
      },
      {
        dimension: '编程语言支持',
        ihui: '全栈代码 Agent(多语言)',
        competitor: 'JS/TS 全栈为主',
        ihuiDetail: '代码 Agent 是六端之一,支持多语言',
        competitorDetail: '专注 JavaScript/TypeScript 全栈',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '在线编辑器',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'Web IDE + GitHub 集成',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$25/月起(Pro)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按 token + 订阅计费',
      },
    ],
  },
  'v0-dev': {
    id: 'v0-dev',
    name: 'v0.dev',
    tagline: 'v0.dev 是 Vercel UI 组件生成;IHUI AI 是含代码 Agent 的全栈操作系统',
    verdict:
      '如果你只需要生成 Next.js + Tailwind UI 组件,v0.dev 体验流畅;如果企业需要后端 + Agent 市场 + 知识库 + 工作流 + 六端分发 + 团队协作,IHUI AI 是更完整方案。',
    rows: [
      {
        dimension: '定位',
        ihui: '六端同源全栈 AI 操作系统',
        competitor: 'UI 组件生成(Next.js + Tailwind)',
        ihuiDetail: 'Agent + 知识库 + 工作流 + 六端分发',
        competitorDetail: '专注前端 UI 组件生成',
      },
      {
        dimension: '客户端覆盖',
        ihui: '6 端同源',
        competitor: 'Web only',
        ihuiDetail: 'Web/桌面/小程序/扩展/移动/CLI',
        competitorDetail: '仅 Web UI 生成',
      },
      {
        dimension: 'Agent 市场',
        ihui: true,
        competitor: false,
        ihuiDetail: '200+ 模板 + 创作者分成 + 一键 fork',
        competitorDetail: '无 Agent 市场概念',
      },
      {
        dimension: '知识库 RAG',
        ihui: true,
        competitor: false,
        ihuiDetail: '向量 + BM25 + 知识图谱,企业私有知识库',
        competitorDetail: '无知识库 RAG 能力',
      },
      {
        dimension: '多模型调度',
        ihui: true,
        competitor: '部分',
        ihuiDetail: '30+ 模型统一调度 + 自动 fallback',
        competitorDetail: '主要使用 OpenAI + Anthropic',
      },
      {
        dimension: 'MCP 工具协议',
        ihui: true,
        competitor: false,
        ihuiDetail: '原生 MCP,100+ 预置 Server',
        competitorDetail: '不支持 MCP 协议',
      },
      {
        dimension: '工作流编排',
        ihui: true,
        competitor: false,
        ihuiDetail: 'n8n 风格节点画布 + 触发器 + 条件分支',
        competitorDetail: '无工作流编排能力',
      },
      {
        dimension: '团队协作',
        ihui: true,
        competitor: '基础',
        ihuiDetail: '多租户 + RBAC + 审计日志 + SSO',
        competitorDetail: 'Vercel 账户基础协作',
      },
      {
        dimension: '私有化部署',
        ihui: true,
        competitor: false,
        ihuiDetail: 'Apache 2.0 + Docker Compose + K8s',
        competitorDetail: '闭源 SaaS,数据过 Vercel 云',
      },
      {
        dimension: '后端能力',
        ihui: '完整后端 + 数据库 + API',
        competitor: '仅前端 UI',
        ihuiDetail: 'Fastify 5 + Drizzle ORM + PostgreSQL',
        competitorDetail: '只生成 React/Next.js 前端组件',
      },
      {
        dimension: 'IDE 集成',
        ihui: '六端含 CLI + 扩展',
        competitor: '在线编辑器 + Vercel',
        ihuiDetail: 'CLI 端 + 浏览器扩展端原生集成',
        competitorDetail: 'Web 编辑器 + Vercel 平台部署',
      },
      {
        dimension: '定价',
        ihui: '个人免费 + Pro ¥49/月',
        competitor: '$20/月起(Premium)',
        ihuiDetail: '开源自托管零费用',
        competitorDetail: '按订阅 + credit 计费',
      },
    ],
  },
}

function Cell({ value, isIhui, dimension }: { value: CellValue; dimension: string; isIhui: boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-primary" aria-label={`${isIhui ? 'IHUI AI' : '竞品'}支持 ${dimension}`} />
    ) : (
      <X className="mx-auto h-5 w-5 text-muted-foreground/40" aria-label={`${isIhui ? 'IHUI AI' : '竞品'}不支持 ${dimension}`} />
    )
  }
  return <span className="text-sm font-medium">{value}</span>
}

export function CompareContent({ competitor }: { competitor: CompetitorConfig['id'] }): React.JSX.Element {
  const config = COMPETITORS[competitor]
  const yesCount = config.rows.filter((r) => r.ihui === true).length
  const competitorYesCount = config.rows.filter((r) => r.competitor === true).length
  const competitorLimitedCount = config.rows.filter((r) => r.competitor === '基础' || r.competitor === '有限' || r.competitor === '受限' || r.competitor === '部分' || (typeof r.competitor === 'string' && r.competitor.includes('only'))).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          深度对比
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          IHUI AI vs {config.name}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          {config.tagline}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>IHUI AI: {yesCount}/{config.rows.length} 项支持</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {config.name}: {competitorYesCount}/{config.rows.length} 项完全支持
              {competitorLimitedCount > 0 && ` + ${competitorLimitedCount} 项有限`}
            </span>
          </div>
        </div>
      </section>

      {/* 对比表格 */}
      <section className="mt-12 overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-4 text-left text-sm font-semibold min-[768px]:px-6">对比维度</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-primary min-[768px]:px-6">IHUI AI</th>
              <th className="px-4 py-4 text-center text-sm font-semibold min-[768px]:px-6">{config.name}</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, idx) => (
              <tr key={row.dimension} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-4 py-4 min-[768px]:px-6">
                  <div className="text-sm font-medium">{row.dimension}</div>
                  {(row.ihuiDetail || row.competitorDetail) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.ihuiDetail && (
                        <div>
                          <span className="text-primary">IHUI:</span> {row.ihuiDetail}
                        </div>
                      )}
                      {row.competitorDetail && (
                        <div className="mt-0.5">
                          <span>{config.name}:</span> {row.competitorDetail}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center min-[768px]:px-6">
                  <Cell value={row.ihui} dimension={row.dimension} isIhui={true} />
                </td>
                <td className="px-4 py-4 text-center min-[768px]:px-6">
                  <Cell value={row.competitor} dimension={row.dimension} isIhui={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 总结 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
        <div className="flex items-start gap-3">
          <Rocket className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">结论</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base">
              {config.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          30 分钟体验 IHUI AI
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          注册即得 1000 积分,所有模型、所有 6 端免费试用。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sso/register">免费注册</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/compare">查看其他对比</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
