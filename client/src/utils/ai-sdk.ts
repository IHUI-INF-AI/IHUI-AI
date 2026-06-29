/**
 * AI SDK 封装
 * 提供AI对话功能
 */

import type { ApiResponse } from '@/types/api'
import { logger } from './logger'

/**
 * AI SDK 对象
 */
const AISDK = {
  /**
   * 普通对话
   */
  async chat(params: {
    message: string
    agentId?: string
    [key: string]: unknown
  }): Promise<ApiResponse<unknown>> {
    // 这里应该调用实际的AI API
    logger.info('[AISDK] chat:', params)
    return {
      code: 200,
      message: 'success',
      data: {
        content: 'AI响应内容',
      },
    }
  },

  /**
   * 流式对话
   */
  streamChat(
    request: {
      agentId?: string
      message: string
      [key: string]: unknown
    },
    onChunk: (content: string) => void
  ): void {
    // 这里应该调用实际的AI流式API
    logger.info('[AISDK] streamChat:', request)
    // 模拟流式响应
    setTimeout(() => {
      onChunk(JSON.stringify({ stage: 'result', content: 'AI流式响应内容' }))
    }, 100)
  },

  /**
   * 创建智能体
   */
  async createAgent(params: {
    name: string
    type: string
    prompt: {
      system: string
    }
  }): Promise<ApiResponse<unknown>> {
    // 这里应该调用实际的API
    logger.info('[AISDK] createAgent:', params)
    return {
      code: 200,
      message: 'success',
      data: {
        id: 'agent_' + Date.now(),
        name: params.name,
        type: params.type,
      },
    }
  },
}

export default AISDK
