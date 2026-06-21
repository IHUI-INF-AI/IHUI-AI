/**
 * 模拟数据
 * 用于开发和演示模式
 * ⚠️ 生产环境不应使用此文件中的数据
 */

import type { UserInfo } from '@/types'
import { isMockEnabled, isProd } from '@/utils/envUtils'
import { logger } from '@/utils/logger'

const MOCK_ENABLED = isMockEnabled()
const IS_PRODUCTION = isProd()

if (IS_PRODUCTION && MOCK_ENABLED) {
  logger.warn('[Mock Data] Warning: Mock data enabled in production, please check environment config')
}

export const canUseMockData = (): boolean => {
  if (IS_PRODUCTION) {
    logger.warn('[Mock Data] Mock data forbidden in production')
    return false
  }
  return MOCK_ENABLED
}

/**
 * 模拟用户 UUID
 */
export const MOCK_USER_UUID = 'demo-user-uuid-12345'

/**
 * 模拟用户基本信息
 */
export const MOCK_USER_BASIC_INFO: UserInfo & { uuid: string } = {
  uuid: MOCK_USER_UUID,
  nickname: '演示用户',
  avatar: 'https://file.aizhs.top/sys-mini/daixaodiming.png',
  phone: '13800138000',
  email: 'demo@example.com',
}

/**
 * 模拟用户 Token
 */
export const MOCK_ACCESS_TOKEN = 'demo-access-token-12345'
export const MOCK_REFRESH_TOKEN = 'demo-refresh-token-67890'

/**
 * 模拟智能体列表
 */
export const MOCK_AGENTS = [
  {
    id: '1',
    name: '示例写作助手',
    description: '辅助写作与润色，提供创意写作建议',
    category: 'assistant',
    status: 1,
    icon: 'Write',
  },
  {
    id: '2',
    name: '示例客服助手',
    description: '智能客服与问答，快速解决常见问题',
    category: 'business',
    status: 1,
    icon: 'Chat',
  },
  {
    id: '3',
    name: '示例代码助手',
    description: '编程辅助与代码审查',
    category: 'developer',
    status: 1,
    icon: 'Code',
  },
]

/**
 * 模拟统计数据
 */
export const MOCK_STATISTICS = {
  chat: {
    totalSessions: 156,
    totalMessages: 3420,
    totalTokens: 125680,
  },
  usage: {
    today: 45,
    thisWeek: 280,
    thisMonth: 1200,
  },
}

/**
 * 模拟对话历史
 */
export const MOCK_CONVERSATIONS = [
  {
    id: 'conv-1',
    title: '关于人工智能的讨论',
    lastMessage: 'AI 技术正在快速发展...',
    timestamp: Date.now() - 3600000,
    messageCount: 12,
  },
  {
    id: 'conv-2',
    title: '代码优化建议',
    lastMessage: '你可以尝试使用更高效的数据结构...',
    timestamp: Date.now() - 86400000,
    messageCount: 8,
  },
]

/**
 * 模拟模型列表
 */
export const MOCK_MODELS = [
  {
    id: 'gpt-4-demo',
    name: 'GPT-4 (演示)',
    description: '强大的多模态大语言模型',
    provider: 'OpenAI',
    isFree: false,
  },
  {
    id: 'gpt-3.5-demo',
    name: 'GPT-3.5 (演示)',
    description: '快速且经济的语言模型',
    provider: 'OpenAI',
    isFree: true,
  },
]
