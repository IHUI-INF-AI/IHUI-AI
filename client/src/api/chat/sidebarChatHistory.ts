/**
 * 会话历史 API（侧边栏用）
 *
 * 对接后端 FastAPI 接口：
 *   POST /api/v1/chat/history/create  - 创建会话
 *   POST /api/v1/chat/history/query   - 查询会话列表（按 user + 可选 model）
 *   PUT  /api/v1/chat/history/{id}/mark - 更新会话标题
 *   DELETE /api/v1/chat/history/{id}  - 删除会话
 *
 * 失败时降级到 localStorage，保留已创建的本地会话。
 * 该模块独立于 chat-history.ts（后者对接 OpenClaw Java 后端），
 * 用于左侧侧边栏的"对话历史"区域。
 */

import axios from 'axios'
import { TokenManager } from '@/utils/core'
import { logger } from '@/utils/logger'
import { t } from '@/utils/i18n'

/** 侧边栏展示的会话项（轻量：仅 id/title/model/createTime） */
export interface SidebarConversation {
  id: string
  title: string
  model?: string
  createTime: string
  /** 兼容：消息数（后端 zhs_user_model_chat 表不存储，从本地统计） */
  messageCount?: number
}

interface BackendChatItem {
  id: number | string
  user_uuid?: string
  model_name?: string
  mark?: string | null
  create_time?: string
  source?: string | null
  icon?: string | null
}

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(
  config => {
    const token = TokenManager.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error),
)

const isAuthError = (status?: number) => status === 401 || status === 403

const errorResponse = (status: number | undefined, msg: string) => ({
  code: status ?? 500,
  success: false,
  message: msg || t('api.common.requestFailed'),
  data: null,
})

const LOCAL_STORAGE_KEY = 'floating-chat-history'

/** 从本地存储读取会话列表（降级 fallback） */
const readLocalConversations = (): SidebarConversation[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Array<{
      id: string
      title?: string
      model?: string
      createTime?: string
      messages?: unknown[]
    }>
    return list.map(c => ({
      id: String(c.id),
      title: c.title || t('floatingChat.newConversation'),
      model: c.model,
      createTime: c.createTime || new Date().toISOString(),
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
    }))
  } catch (e) {
    logger.warn('[sidebarChatHistory] read localStorage failed:', e)
    return []
  }
}

const convert = (item: BackendChatItem): SidebarConversation => ({
  id: String(item.id),
  title: item.mark || t('floatingChat.newConversation'),
  model: item.model_name,
  createTime: item.create_time || new Date().toISOString(),
  messageCount: 0,
})

/**
 * 拉取当前用户最近的会话列表
 * 优先调用后端，失败/未登录时降级为本地存储
 */
export async function fetchSidebarConversations(params?: {
  modelName?: string
  page?: number
  limit?: number
}): Promise<SidebarConversation[]> {
  const fallback = (): SidebarConversation[] => {
    const list = readLocalConversations()
    if (params?.modelName) {
      return list.filter(c => c.model === params.modelName)
    }
    return list
  }

  try {
    const response = await apiClient.post('/chat/history/query', {
      model_name: params?.modelName || undefined,
    }, {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 50,
      },
    })
    const data = response?.data
    if (isAuthError(response.status)) {
      return fallback()
    }
    // 后端格式: { code: "0", msg, data: { items: [...], total: n } }
    // (部分老版本可能用 code:200 / data 直接为数组)
    const code = (data as { code?: number | string })?.code
    const isOk = code === 0 || code === '0' || code === 200
    if (!isOk) {
      logger.warn('[sidebarChatHistory] query returned non-ok code:', code)
      return fallback()
    }
    const payload = (data as { data?: unknown })?.data
    let items: BackendChatItem[] = []
    if (Array.isArray(payload)) {
      items = payload as BackendChatItem[]
    } else if (payload && typeof payload === 'object') {
      const obj = payload as { items?: BackendChatItem[]; list?: BackendChatItem[]; rows?: BackendChatItem[] }
      items = obj.items || obj.list || obj.rows || []
    }
    return items.map(convert)
  } catch (e: any) {
    const status = e?.response?.status
    if (isAuthError(status)) {
      // 未登录：直接走本地 fallback
      return fallback()
    }
    logger.warn('[sidebarChatHistory] query failed, fallback to localStorage:', e?.message || e)
    return fallback()
  }
}

/**
 * 创建一个新的会话记录
 * 后端要求传 model_name + 可选 mark
 */
export async function createSidebarConversation(payload: {
  modelName: string
  mark?: string
}): Promise<SidebarConversation | null> {
  try {
    const response = await apiClient.post('/chat/history/create', {
      model_name: payload.modelName,
      mark: payload.mark || t('floatingChat.newConversation'),
    })
    if (isAuthError(response.status)) return null
    const data = response?.data
    const code = (data as { code?: number | string })?.code
    if (code !== 0 && code !== '0' && code !== 200) {
      logger.warn('[sidebarChatHistory] create returned non-ok code:', code)
      return null
    }
    const item = (data as { data?: BackendChatItem })?.data
    if (!item) return null
    return convert(item)
  } catch (e: any) {
    logger.warn('[sidebarChatHistory] create failed:', e?.message || e)
    return null
  }
}

/**
 * 更新会话标题（mark）
 */
export async function renameSidebarConversation(
  id: string,
  newTitle: string,
): Promise<boolean> {
  try {
    const response = await apiClient.put(`/chat/history/${id}/mark`, {
      mark: newTitle,
    })
    if (isAuthError(response.status)) return false
    const code = (response?.data as { code?: number | string })?.code
    return code === 0 || code === '0' || code === 200
  } catch (e: any) {
    logger.warn('[sidebarChatHistory] rename failed:', e?.message || e)
    return false
  }
}

/**
 * 删除会话
 */
export async function deleteSidebarConversation(id: string): Promise<boolean> {
  try {
    const response = await apiClient.delete(`/chat/history/${id}`)
    if (isAuthError(response.status)) return false
    const code = (response?.data as { code?: number | string })?.code
    if (code === 0 || code === '0' || code === 200) return true
    return false
  } catch (e: any) {
    logger.warn('[sidebarChatHistory] delete failed:', e?.message || e)
    return false
  }
}
