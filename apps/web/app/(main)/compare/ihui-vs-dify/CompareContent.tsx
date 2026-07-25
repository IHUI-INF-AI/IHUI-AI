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
  id: 'dify' | 'coze' | 'fastgpt' | 'n8n' | 'openai-agent' | 'langchain' | 'copilot-studio' | 'manus' | 'devin'
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

export function CompareContent({ competitor }: { competitor: 'dify' | 'coze' | 'fastgpt' | 'n8n' | 'openai-agent' | 'langchain' | 'copilot-studio' | 'manus' | 'devin' }): React.JSX.Element {
  const config = COMPETITORS[competitor]
  const yesCount = config.rows.filter((r) => r.ihui === true).length
  const competitorYesCount = config.rows.filter((r) => r.competitor === true).length
  const competitorLimitedCount = config.rows.filter((r) => r.competitor === '基础' || r.competitor === '有限' || r.competitor === '受限' || r.competitor === '部分' || (typeof r.competitor === 'string' && r.competitor.includes('only'))).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          深度对比
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          IHUI AI vs {config.name}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
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
              <th className="px-4 py-4 text-left text-sm font-semibold md:px-6">对比维度</th>
              <th className="px-4 py-4 text-center text-sm font-semibold text-primary md:px-6">IHUI AI</th>
              <th className="px-4 py-4 text-center text-sm font-semibold md:px-6">{config.name}</th>
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, idx) => (
              <tr key={row.dimension} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                <td className="px-4 py-4 md:px-6">
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
                <td className="px-4 py-4 text-center md:px-6">
                  <Cell value={row.ihui} dimension={row.dimension} isIhui={true} />
                </td>
                <td className="px-4 py-4 text-center md:px-6">
                  <Cell value={row.competitor} dimension={row.dimension} isIhui={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 总结 */}
      <section className="mt-12 rounded-2xl border bg-primary/5 p-8 md:p-12">
        <div className="flex items-start gap-3">
          <Rocket className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">结论</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
              {config.verdict}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-12 rounded-2xl border bg-card p-8 text-center md:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
          30 分钟体验 IHUI AI
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
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
