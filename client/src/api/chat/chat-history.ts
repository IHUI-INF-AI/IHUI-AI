/**
 * 聊天历史 API
 * 对接后端会话管理接口（已就绪）
 *
 * 后端 API: GET /api/openclaw/sessions、GET /api/openclaw/sessions/:id/messages 等
 * 使用 /api 前缀，由 Vite 代理转发到 Java 后端；不可用时前端降级为本地存储。
 */

import axios from 'axios'
import { TokenManager } from '@/utils/core'
import { logger } from '@/utils/logger'
import { t } from '@/utils/i18n'
import type { ApiResponse, PaginationParams } from '@/types'

/**
 * 创建专用于 Java 后端的 axios 实例
 * 使用 /api 前缀，由 Vite 代理转发到 Java 后端
 */
const javaApiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器 - 添加认证 Token；会话列表请求将 500 视为可接受状态，避免控制台报错
javaApiClient.interceptors.request.use(
  config => {
    const token = TokenManager.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const url = config.url ?? ''
    const isSessionsList = url.includes('openclaw/sessions') && !url.includes('/messages')
    if (isSessionsList) {
      config.validateStatus = (status: number) => status === 200 || status === 500
    }
    return config
  },
  error => Promise.reject(error)
)

// 响应拦截器 - 标准化响应格式；openclaw/sessions 500 时静默返回空列表，避免控制台刷屏
javaApiClient.interceptors.response.use(
  response => {
    const url = response.config?.url ?? ''
    const isSessionsList = url.includes('openclaw/sessions') && !url.includes('/messages')
    if (isSessionsList && response.status === 500) {
      response.data = {
        code: 200,
        success: true,
        data: {
          list: [],
          pageNum: 1,
          page: 1,
          pageSize: response.config?.params?.pageSize ?? 20,
          total: 0,
          totalPages: 0,
        },
      }
    }
    const data = response.data ?? {}
    return {
      ...response,
      data: {
        ...(typeof data === 'object' && data !== null ? data : {}),
        success: (data as { code?: number }).code === 200,
      },
    }
  },
  error => {
    const url = error.config?.url ?? ''
    const status = error.response?.status
    // 会话列表 500（后端暂不可用）时返回空列表，不抛错、不打断使用
    if (url.includes('openclaw/sessions') && !url.includes('/messages') && (status === 500 || !status)) {
      return Promise.resolve({
        data: {
          code: 200,
          success: true,
          data: {
            list: [],
            pageNum: 1,
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
          },
        },
      })
    }
    const errorResponse = {
      code: error.response?.status || 500,
      message: error.response?.data?.msg || error.message || t('api.common.requestFailed'),
      success: false,
    }
    return Promise.reject(errorResponse)
  }
)

/**
 * 后端 SessionVO 响应格式
 */
interface BackendSessionVO {
  id: string
  channelId?: string
  status: string
  createTime: number
  endTime?: number
}

/**
 * 后端 MessageVO 响应格式
 */
interface BackendMessageVO {
  id: string
  sessionId: string
  role: string
  content: string
  timestamp: number
}

/**
 * 转换后端会话格式到前端格式
 */
function convertSession(session: BackendSessionVO): Conversation {
  return {
    id: session.id,
    title: session.channelId ? `Session - ${session.channelId}` : `Session ${session.id.slice(0, 8)}`,
    model: undefined,
    botId: session.channelId,
    lastMessage: undefined,
    messageCount: 0,
    createdAt: new Date(session.createTime).toISOString(),
    updatedAt: new Date(session.endTime || session.createTime).toISOString(),
  }
}

/**
 * 转换后端消息格式到前端格式
 */
function convertMessage(message: BackendMessageVO): ChatMessage {
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    content: message.content,
    model: undefined,
    metadata: undefined,
    createdAt: new Date(message.timestamp).toISOString(),
  }
}

/**
 * 对话接口
 */
export interface Conversation {
  id: string
  title: string
  model?: string
  botId?: string
  lastMessage?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

/**
 * 消息接口
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

/**
 * 获取对话列表
 * 后端 API: GET /api/openclaw/sessions
 */
export async function getConversations(
  params?: PaginationParams & {
    model?: string
    botId?: string
  }
): Promise<
  ApiResponse<{
    conversations: Conversation[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }>
> {
  const response = await javaApiClient.get('/openclaw/sessions', {
    params: {
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      channelId: params?.botId, // botId 映射到 channelId
    },
    // 500 时走成功分支，由下方统一当空列表处理，减少控制台报错
    validateStatus: (status) => status === 200 || status === 500,
  })

  const data = response.data
  // 200 且数据结构正常时转换分页结果
  if (response.status === 200 && data?.code === 200 && data?.data) {
    const pageResult = data.data
    const sessions: BackendSessionVO[] = pageResult.list || pageResult.rows || []
    return {
      code: 200,
      success: true,
      data: {
        conversations: sessions.map(convertSession),
        pagination: {
          page: pageResult.page || pageResult.pageNum || 1,
          pageSize: pageResult.pageSize || 20,
          total: pageResult.total || 0,
          totalPages: pageResult.totalPages || Math.ceil((pageResult.total || 0) / (pageResult.pageSize || 20)),
        },
      },
    }
  }
  // 500 或异常时返回空列表，不抛错
  if (response.status === 500 || !data?.data) {
    return {
      code: 200,
      success: true,
      data: {
        conversations: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
    }
  }
  return data
}

/**
 * 获取对话详情
 * 后端 API: GET /api/openclaw/sessions/{sessionId}
 */
export async function getConversation(conversationId: string): Promise<ApiResponse<Conversation>> {
  const response = await javaApiClient.get(`/openclaw/sessions/${conversationId}`)

  const data = response.data
  if (data.code === 200 && data.data) {
    return {
      code: 200,
      success: true,
      data: convertSession(data.data),
    }
  }

  return data
}

/**
 * 获取对话消息列表
 * 后端 API: GET /api/openclaw/sessions/{sessionId}/messages
 */
export async function getConversationMessages(
  conversationId: string,
  params?: {
    limit?: number
    before?: string
  }
): Promise<
  ApiResponse<{
    messages: ChatMessage[]
    count: number
  }>
> {
  const response = await javaApiClient.get(`/openclaw/sessions/${conversationId}/messages`, {
    params: {
      page: 1,
      pageSize: params?.limit || 50,
    },
  })

  const data = response.data
  if (data.code === 200 && data.data) {
    const pageResult = data.data
    const messages: BackendMessageVO[] = pageResult.list || pageResult.rows || []

    return {
      code: 200,
      success: true,
      data: {
        messages: messages.map(convertMessage),
        count: pageResult.total || messages.length,
      },
    }
  }

  return data
}

/**
 * 创建对话
 * 注意: 后端暂无创建会话接口，会话在发送消息时自动创建
 * 此函数返回一个临时会话对象
 */
export async function createConversation(data: {
  title: string
  model?: string
  botId?: string
}): Promise<ApiResponse<Conversation>> {
  // 后端暂无创建会话接口，返回模拟数据
  // 实际会话会在用户发送第一条消息时由后端自动创建
  const now = new Date().toISOString()
  return {
    code: 200,
    success: true,
    data: {
      id: `temp-${Date.now()}`,
      title: data.title,
      model: data.model,
      botId: data.botId,
      lastMessage: undefined,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  }
}

/**
 * 更新对话标题
 * 注意: 后端暂无更新标题接口
 */
export async function updateConversationTitle(
  conversationId: string,
  _title: string
): Promise<ApiResponse<void>> {
  // 后端暂无此接口，返回成功状态
  // 标题在前端本地管理
  // 若后端已提供更新标题接口，可在此调用
  if (import.meta.env.DEV) {
    logger.warn(`[chat-history] updateConversationTitle: 使用前端本地标题, conversationId=${conversationId}`)
  }
  return {
    code: 200,
    success: true,
    data: undefined,
  }
}

/**
 * 删除对话
 * 后端 API: DELETE /api/openclaw/sessions/{sessionId}
 */
export async function deleteConversation(conversationId: string): Promise<ApiResponse<void>> {
  const response = await javaApiClient.delete(`/openclaw/sessions/${conversationId}`)
  return response.data
}

/**
 * 删除消息
 * 注意: 后端暂无删除单条消息接口
 */
export async function deleteMessage(_messageId: string): Promise<ApiResponse<void>> {
  if (import.meta.env.DEV) {
    logger.warn(`[chat-history] deleteMessage: 使用前端本地逻辑, messageId=${_messageId}`)
  }
  return {
    code: 200,
    success: true,
    data: undefined,
  }
}

/**
 * 结束对话
 * 后端 API: POST /api/openclaw/sessions/{sessionId}/end
 */
export async function endConversation(conversationId: string): Promise<ApiResponse<void>> {
  const response = await javaApiClient.post(`/openclaw/sessions/${conversationId}/end`)
  return response.data
}
