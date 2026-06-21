import { t } from '@/utils/i18n'

/**
 * OpenClaw / Clawdbot 配置文件
 * 
 * 集中管理 OpenClaw AI Agent 系统的所有配置
 */

/**
 * 支持的渠道类型
 */
export const SUPPORTED_CHANNELS = {
  // 核心渠道
  webchat: { name: 'Web Chat', icon: 'globe', description: t('text.openclaw_config.网页聊天') },
  telegram: { name: 'Telegram', icon: 'send', description: t('text.openclaw_config.Telegram1') },
  discord: { name: 'Discord', icon: 'discord', description: t('text.openclaw_config.Discord服2') },
  slack: { name: 'Slack', icon: 'slack', description: t('text.openclaw_config.Slack工作区3') },
  whatsapp: { name: 'WhatsApp', icon: 'phone', description: t('text.openclaw_config.WhatsApp4') },
  wechat: { name: '微信', icon: 'wechat', description: t('text.openclaw_config.微信公众号企业微5') },
  
  // 扩展渠道
  teams: { name: 'Microsoft Teams', icon: 'microsoft', description: t('text.openclaw_config.Teams消息6') },
  line: { name: 'LINE', icon: 'line', description: t('text.openclaw_config.LINE消息7') },
  matrix: { name: 'Matrix', icon: 'matrix', description: t('text.openclaw_config.Matrix协议8') },
  signal: { name: 'Signal', icon: 'signal', description: t('text.openclaw_config.Signal消息9') },
  imessage: { name: 'iMessage', icon: 'apple', description: 'Apple iMessage' },
  googlechat: { name: 'Google Chat', icon: 'google', description: 'Google Chat' },
  mattermost: { name: 'Mattermost', icon: 'mattermost', description: t('text.openclaw_config.Mattermo10') },
} as const

export type SupportedChannelType = keyof typeof SUPPORTED_CHANNELS

/**
 * 工具类别配置
 */
export const TOOL_CATEGORIES = {
  browser: { name: '浏览器', icon: 'globe', color: 'var(--el-text-color-primary)' },
  filesystem: { name: '文件系统', icon: 'folder', color: 'var(--color-emerald-500)' },
  shell: { name: 'Shell', icon: 'terminal', color: 'var(--color-amber-500)' },
  api: { name: 'API', icon: 'cloud', color: 'var(--el-text-color-primary)' },
  data: { name: '数据', icon: 'database', color: 'var(--el-text-color-primary)' },
  email: { name: '邮件', icon: 'mail', color: 'var(--el-text-color-primary)' },
  calendar: { name: '日历', icon: 'calendar', color: 'var(--color-cyan-06b6d4)' },
  code: { name: '代码', icon: 'code', color: 'var(--color-indigo-600)' },
  custom: { name: '自定义', icon: 'puzzle', color: 'var(--el-text-color-primary)' },
} as const

export type ToolCategory = keyof typeof TOOL_CATEGORIES

/**
 * 内置工具列表
 */
export const BUILTIN_TOOLS = [
  // 浏览器工具
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_screenshot',
  'browser_scroll',
  'browser_wait',
  
  // 文件系统工具
  'read_file',
  'write_file',
  'list_directory',
  'search_files',
  'copy_file',
  'move_file',
  'delete_file',
  
  // Shell 工具
  'execute_command',
  'execute_script',
  
  // API 工具
  'http_request',
  
  // 扩展工具
  'lobster',
  'llm_task',
  'apply_patch',
  'elevated_exec',
  'canvas',
  'voice_call',
  'camera_capture',
  'location',
  'agent_send',
  'create_subagent',
  'react',
  
  // 通用工具
  'wait',
] as const

/**
 * 危险操作工具列表（需要用户确认）
 */
export const DANGEROUS_TOOLS = [
  'write_file',
  'delete_file',
  'execute_command',
  'execute_script',
  'apply_patch',
  'elevated_exec',
] as const

/**
 * Hook 类型
 */
export const HOOK_TYPES = {
  beforeMessage: '消息处理前',
  afterMessage: '消息处理后',
  beforeToolExec: '工具执行前',
  afterToolExec: '工具执行后',
  onError: '错误发生时',
  onConnect: '连接建立时',
  onDisconnect: '连接断开时',
  onStartup: '启动时',
  onShutdown: '关闭时',
} as const

export type HookType = keyof typeof HOOK_TYPES

/**
 * 任务状态
 */
export const TASK_STATUS = {
  pending: { label: t('text.openclaw_config.待处理11'), color: 'info' },
  planning: { label: t('text.openclaw_config.规划中12'), color: 'warning' },
  executing: { label: t('text.openclaw_config.执行中13'), color: 'primary' },
  paused: { label: t('text.openclaw_config.已暂停14'), color: 'warning' },
  completed: { label: t('text.openclaw_config.已完成15'), color: 'success' },
  failed: { label: t('text.openclaw_config.失败16'), color: 'danger' },
  cancelled: { label: t('text.openclaw_config.已取消17'), color: 'info' },
} as const

export type TaskStatus = keyof typeof TASK_STATUS

/**
 * 技能类别
 */
export const SKILL_CATEGORIES = {
  utility: { name: '实用工具', icon: 'tools' },
  automation: { name: '自动化', icon: 'robot' },
  integration: { name: '集成', icon: 'link' },
  analysis: { name: '分析', icon: 'chart' },
  communication: { name: '通信', icon: 'message' },
  creative: { name: '创意', icon: 'palette' },
  development: { name: '开发', icon: 'code' },
  productivity: { name: '生产力', icon: 'clock' },
} as const

export type SkillCategory = keyof typeof SKILL_CATEGORIES

/**
 * 记忆类型
 */
export const MEMORY_TYPES = {
  fact: { name: '事实', icon: 'book', description: t('text.openclaw_config.客观事实信息18') },
  event: { name: '事件', icon: 'calendar', description: t('text.openclaw_config.发生过的事件19') },
  conversation: { name: '对话', icon: 'message', description: t('text.openclaw_config.历史对话内容20') },
  skill: { name: '技能', icon: 'code', description: t('text.openclaw_config.学习到的技能21') },
  preference: { name: '偏好', icon: 'heart', description: t('text.openclaw_config.用户偏好设置22') },
} as const

export type MemoryType = keyof typeof MEMORY_TYPES

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  // 网关配置
  gateway: {
    port: 18789,
    bindAddress: '127.0.0.1',
    verbose: false,
    authEnabled: true,
  },
  
  // AI 配置
  ai: {
    provider: 'openai' as const,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
  },
  
  // 自动化配置
  automation: {
    maxCronJobs: 50,
    maxWebhooks: 20,
    cronTimezone: 'Asia/Shanghai',
  },
  
  // 任务配置
  task: {
    defaultTimeout: 300000, // 5分钟
    maxRetries: 3,
    maxConcurrentTasks: 5,
  },
  
  // 记忆配置
  memory: {
    maxItems: 1000,
    embeddingModel: 'text-embedding-ada-002',
  },
}

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  base: '/api/openclaw',
  
  // Gateway
  gateway: {
    status: '/gateway/status',
    health: '/gateway/health',
    config: '/gateway/config',
  },
  
  // Channels
  channels: {
    types: '/channels/types',
    list: '/channels',
    create: '/channels',
    status: (id: string) => `/channels/${id}/status`,
    connect: (id: string) => `/channels/${id}/connect`,
    disconnect: (id: string) => `/channels/${id}/disconnect`,
    send: (id: string) => `/channels/${id}/messages`,
  },
  
  // Tools
  tools: {
    list: '/tools',
    register: '/tools',
    execute: (name: string) => `/tools/${name}/execute`,
  },
  
  // Skills
  skills: {
    list: '/skills',
    available: '/skills/available',
    install: (id: string) => `/skills/${id}/install`,
    uninstall: (id: string) => `/skills/${id}/uninstall`,
    publish: '/skills/publish',
  },
  
  // Tasks
  tasks: {
    list: '/tasks',
    create: '/tasks',
    detail: (id: string) => `/tasks/${id}`,
    execute: (id: string) => `/tasks/${id}/execute`,
    cancel: (id: string) => `/tasks/${id}/cancel`,
    pause: (id: string) => `/tasks/${id}/pause`,
    resume: (id: string) => `/tasks/${id}/resume`,
  },
  
  // Automation
  automation: {
    cronJobs: '/automation/cron-jobs',
    webhooks: '/automation/webhooks',
    hooks: '/automation/hooks',
  },
  
  // Sessions
  sessions: {
    list: '/sessions',
    detail: (id: string) => `/sessions/${id}`,
    messages: (id: string) => `/sessions/${id}/messages`,
  },
  
  // Agents
  agents: {
    message: '/agents/message',
    status: '/agents/status',
    subAgents: '/agents/sub-agents',
  },
  
  // Memory
  memory: {
    save: '/memory',
    search: '/memory/search',
    context: '/memory/context',
    clear: '/memory/clear',
  },
  
  // Evolution
  evolution: {
    analyze: '/evolution/analyze',
    generate: '/evolution/generate-skill',
    history: '/evolution/history',
  },
  
  // Nodes
  nodes: {
    list: '/nodes',
    pair: '/nodes/pair',
    invoke: (id: string) => `/nodes/${id}/invoke`,
    status: (id: string) => `/nodes/${id}/status`,
  },
  
  // Statistics
  stats: {
    usage: '/stats/usage',
    tokens: '/stats/tokens',
  },
}

export default {
  SUPPORTED_CHANNELS,
  TOOL_CATEGORIES,
  BUILTIN_TOOLS,
  DANGEROUS_TOOLS,
  HOOK_TYPES,
  TASK_STATUS,
  SKILL_CATEGORIES,
  MEMORY_TYPES,
  DEFAULT_CONFIG,
  API_ENDPOINTS,
}
