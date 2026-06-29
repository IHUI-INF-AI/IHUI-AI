import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

export const aiRoutes: Array<RouteRecordRaw> = [
  {
    path: '/agentic-dashboard',
    name: 'agenticDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "agentic-dashboard" */ '@/views/AgenticDashboard.vue'),
      'AgenticDashboard'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiAgenticDashboard',
      description: '智能体管理和监控仪表板',
      keywords: '智能体,仪表板,监控',
    },
  },
  {
    path: '/ai-world',
    name: 'aiWorld',
    alias: '/ai-world/',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-world" */ '@/views/AiWorld.vue'),
      'AiWorld'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aiWorld',
      description: 'seo.aiWorld.desc',
      keywords: 'seo.aiWorld.keywords',
      showFooter: false,
    },
  } as RouteRecordRaw,
  {
    path: '/ai-world/detail/:id',
    name: 'aiWorldDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-world-detail" */ '@/views/AiWorldDetail.vue'),
      'AiWorldDetail'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aiWorldDetail',
      description: 'seo.aiWorld.desc',
      keywords: 'seo.aiWorld.keywords',
      showFooter: false,
    },
  },
  {
    path: '/ai-world/banner-detail/:index',
    name: 'aiWorldBannerDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-world-banner-detail" */ '@/views/AiWorldBannerDetail.vue'),
      'AiWorldBannerDetail'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aiWorldBannerDetail',
      description: 'seo.aiWorld.desc',
      keywords: 'seo.aiWorld.keywords',
      showFooter: false,
    },
  },
  {
    path: '/api-test',
    name: 'apiTest',
    component: safeImport(
      () => import(/* webpackChunkName: "api-test" */ '@/views/ApiTestPage.vue'),
      'ApiTestPage'
    ),
    meta: {
      title: 'routes.aiApiTest',
      description: 'AI接口连通性和参数验证测试',
      keywords: 'API,测试,AI,验证',
      requiresAuth: false,
    },
  },
  {
    path: '/agents',
    name: 'agents',
    component: safeImport(
      () => import(/* webpackChunkName: "agents" */ '@/views/Agents.vue'),
      'Agents'
    ),
    meta: {
      title: 'routes.agents',
      description: 'seo.agents.desc',
      keywords: 'seo.agents.keywords',
    },
  },
  {
    path: '/designer-agent',
    name: 'designerAgent',
    component: safeImport(
      () => import(/* webpackChunkName: "designer-agent" */ '@/views/DesignerAgent.vue'),
      'DesignerAgent'
    ),
    meta: {
      title: 'routes.designerAgent',
      description: 'seo.designerAgent.desc',
      keywords: 'seo.designerAgent.keywords',
      requiresAuth: false,
    },
  },
  {
    path: '/agents/category',
    name: 'agentsCategory',
    component: safeImport(
      () => import(/* webpackChunkName: "agents-category" */ '@/views/AgentsCategoryDetail.vue'),
      'AgentsCategoryDetail'
    ),
    meta: {
      title: 'routes.agentsCategory',
      description: 'seo.agents.desc',
      keywords: 'seo.agents.keywords',
    },
  },
  {
    path: '/agents/create',
    name: 'agentsCreate',
    component: safeImport(
      () => import(/* webpackChunkName: "agents-create" */ '@/views/AgentsCreate.vue'),
      'AgentsCreate'
    ),
    meta: {
      title: 'routes.agentsCreate',
      description: 'seo.agentsCreate.desc',
      keywords: 'seo.agentsCreate.keywords',
      requiresAuth: false,
    },
  },
  {
    path: '/agents/:id',
    name: 'agentDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "agent-detail" */ '@/views/AgentDetail.vue'),
      'AgentDetail'
    ),
    meta: {
      title: 'routes.agentDetail',
      description: 'seo.agentDetail.desc',
      keywords: 'seo.agentDetail.keywords',
    },
  },
  {
    path: '/ai-management',
    name: 'aiManagement',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-management" */ '@/views/AIManagement.vue'),
      'AIManagement'
    ),
    meta: {
      title: 'routes.aiAgentManagement',
      description: '管理和配置AI智能体',
      keywords: 'AI,智能体,管理',
      requiresAuth: false,
    },
  },
  {
    path: '/mcp-manager',
    name: 'mcpManager',
    component: safeImport(
      () => import(/* webpackChunkName: "mcp-manager" */ '@/components/mcp/MCPManager.vue'),
      'MCPManager'
    ),
    meta: {
      title: 'routes.aiMcpServerManager',
      description: '管理和调用 MCP (Model Context Protocol) 服务器',
      keywords: 'MCP,Model Context Protocol,工具调用',
      requiresAuth: false,
    },
  },
  {
    path: '/mcp-use',
    name: 'mcpUse',
    component: safeImport(
      () => import(/* webpackChunkName: "mcp-use" */ '@/components/mcp/MCPUseManager.vue'),
      'MCPUseManager'
    ),
    meta: {
      title: 'routes.aiMcpUseManager',
      description: '6行代码接入MCP服务器，创建和管理Agent',
      keywords: 'mcp-use,MCP,Agent,智能体',
      requiresAuth: false,
    },
  },
  {
    path: '/mcp-use-project',
    name: 'mcpUseProject',
    component: safeImport(
      () => import(/* webpackChunkName: "mcp-use-project" */ '@/views/MCPUseProject.vue'),
      'MCPUseProject'
    ),
    meta: {
      title: 'routes.aiMcpUseProject',
      description: '查看mcp-use项目文档和资源',
      keywords: 'mcp-use,项目,文档,README',
      requiresAuth: false,
    },
  },
  {
    path: '/unified-ai',
    name: 'unifiedAI',
    component: safeImport(
      () => import(/* webpackChunkName: "unified-ai" */ '@/components/ai/UnifiedAIPanel.vue'),
      'UnifiedAIPanel'
    ),
    meta: {
      title: 'routes.aiUnifiedAICenter',
      description: '统一管理和调用所有 AI 能力（模型、智能体、Agentic、MCP）',
      keywords: 'AI,统一能力,模型,智能体,Agentic,MCP',
      requiresAuth: false,
    },
  },
  {
    path: '/models-management',
    name: 'modelManager',
    component: safeImport(
      () => import(/* webpackChunkName: "model-manager" */ '@/views/ModelManager.vue'),
      'ModelManager'
    ),
    meta: {
      title: 'models.title',
      description: '统一管理所有大模型配置',
      keywords: 'AI,模型管理,大模型配置',
      requiresAuth: false,
    },
  },
  {
    path: '/agentic-ai',
    name: 'agenticAI',
    component: safeImport(
      () => import(/* webpackChunkName: "agentic-ai" */ '@/views/AgenticAIPage.vue'),
      'AgenticAIPage'
    ),
    meta: {
      title: 'Agentic AI智能体系统',
      description: '创建和管理Agent Swarm',
      keywords: 'Agentic AI,智能体集群,Agent Swarm',
      requiresAuth: false,
    },
  },
  {
    path: '/conversation',
    name: 'conversation',
    component: safeImport(
      () => import(/* webpackChunkName: "conversation" */ '@/components/chat/conversation.vue'),
      'Conversation'
    ),
    meta: {
      title: 'routes.conversation',
      description: 'seo.conversation.desc',
      keywords: 'seo.conversation.keywords',
      requiresAuth: false,
    },
  },
  {
    path: '/chat-history',
    name: 'chatHistory',
    component: safeImport(
      () => import(/* webpackChunkName: "chat-history" */ '@/views/ChatHistory.vue'),
      'ChatHistory'
    ),
    meta: {
      title: 'routes.chatHistory',
      description: 'seo.chatHistory.desc',
      keywords: 'seo.chatHistory.keywords',
      requiresAuth: true,
    },
  },
  {
    path: '/knowledge',
    name: 'knowledgeBase',
    component: safeImport(
      () => import(/* webpackChunkName: "knowledge-base" */ '@/views/KnowledgeBase.vue'),
      'KnowledgeBase'
    ),
    meta: {
      title: 'routes.aiKnowledgeBase',
      description: '管理和组织您的知识库文档',
      keywords: '知识库,文档管理,RAG',
      requiresAuth: false,
    },
  },
  {
    path: '/knowledge/:kbId',
    name: 'knowledgeDetail',
    component: safeImport(
      () => import(/* webpackChunkName: "knowledge-detail" */ '@/views/KnowledgeDetail.vue'),
      'KnowledgeDetail'
    ),
    meta: {
      title: '知识库详情',
      description: '查看和管理知识库文档',
      keywords: '知识库,文档,详情',
      requiresAuth: true,
    },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: safeImport(
      () => import(/* webpackChunkName: "tasks" */ '@/views/Tasks.vue'),
      'Tasks'
    ),
    meta: {
      title: 'routes.aiTaskManagement',
      description: '查看和管理任务执行状态',
      keywords: '任务,管理,状态',
      requiresAuth: true,
    },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: safeImport(
      () => import(/* webpackChunkName: "favorites" */ '@/views/Favorites.vue'),
      'Favorites'
    ),
    meta: {
      title: 'routes.aiMyFavorites',
      description: '查看和管理收藏的内容',
      keywords: '收藏,管理',
      requiresAuth: true,
    },
  },
  {
    path: '/ai-assistant',
    name: 'aiAssistant',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-assistant" */ '@/views/AIAssistant.vue'),
      'AIAssistant'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiAssistant',
      description: '与AI智能体进行对话交流',
      keywords: 'AI助手,对话,智能体',
    },
  },
  {
    path: '/n8n-assistant',
    name: 'n8nAssistant',
    component: safeImport(
      () => import(/* webpackChunkName: "n8n-assistant" */ '@/views/N8NAssistant.vue'),
      'N8NAssistant'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiN8NAssistant',
      description: '使用N8N工作流自动化工具',
      keywords: 'N8N,工作流,自动化',
    },
  },
  {
    path: '/ai-team',
    name: 'aiTeam',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-team" */ '@/views/AITeam.vue'),
      'AITeam'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiTeam',
      description: '查看和管理您的智能体团队',
      keywords: 'AI团队,智能体,团队管理',
    },
  },
  {
    path: '/agent-income',
    name: 'agentIncome',
    component: safeImport(
      () => import(/* webpackChunkName: "agent-income" */ '@/views/AgentIncome.vue'),
      'AgentIncome'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiAgentIncome',
      description: '查看您的智能体收入统计和结算记录',
      keywords: '智能体,收入,结算',
    },
  },
  {
    path: '/n8n-agents',
    name: 'n8nAgents',
    component: safeImport(
      () => import(/* webpackChunkName: "n8n-agents" */ '@/views/N8NAgents.vue'),
      'N8NAgents'
    ),
    meta: {
      requiresAuth: true,
      title: 'routes.aiN8NAgents',
      description: '创建和管理基于N8N的智能体',
      keywords: 'N8N,智能体,工作流',
    },
  },
  {
    path: '/variables',
    name: 'variables',
    component: safeImport(
      () => import(/* webpackChunkName: "variables" */ '@/views/Variables.vue'),
      'Variables'
    ),
    meta: {
      title: 'routes.aiVariableManagement',
      description: '管理机器人的变量配置',
      keywords: '变量,配置,管理',
      requiresAuth: true,
    },
  },
  {
    path: '/oauth-apps',
    name: 'oauthApps',
    component: safeImport(
      () => import(/* webpackChunkName: "oauth-apps" */ '@/views/OAuthApps.vue'),
      'OAuthApps'
    ),
    meta: {
      title: 'routes.aiOAuthApps',
      description: '创建和管理OAuth应用，用于API认证',
      keywords: 'OAuth,应用,认证,管理',
      requiresAuth: true,
    },
  },
  {
    path: '/ai-generation',
    name: 'aiGeneration',
    component: safeImport(
      () => import(/* webpackChunkName: "ai-generation" */ '@/views/AIGeneration.vue'),
      'AIGeneration'
    ),
    meta: {
      title: 'routes.aiGeneration',
      description: 'AI图像、视频、3D模型生成平台',
      keywords: 'AI生成,图像生成,视频生成,3D模型',
      requiresAuth: false,
    },
  },
  {
    path: '/chat',
    name: 'chat',
    component: safeImport(
      () => import(/* webpackChunkName: "chat" */ '@/views/Chat.vue'),
      'Chat'
    ),
    meta: {
      title: 'routes.chat',
      description: 'AI智能对话',
      keywords: 'AI聊天,智能对话',
      requiresAuth: false,
    },
  },
  {
    path: '/tools',
    name: 'tools',
    component: safeImport(
      () => import(/* webpackChunkName: "tools" */ '@/views/Tools.vue'),
      'Tools'
    ),
    meta: {
      title: 'routes.tools',
      description: 'AI工具集合',
      keywords: 'AI工具,工具集合',
      requiresAuth: false,
    },
  },
]
