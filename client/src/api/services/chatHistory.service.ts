import { COZE_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'
import { logger } from '@/utils/logger'

/**
 * 对话历史服务
 * 用于管理用户与AI模型的对话记录
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'

/**
 * 对话记录
 */
export interface ChatRecord {
  id: number | string
  user_uuid: string
  model_name: string
  mark?: string
  create_time: string
  chatId?: string
  title?: string
  question?: string
  createdAt?: string
  createTime?: string
}

/**
 * 创建对话记录请求
 */
export interface CreateChatRecordRequest {
  user_uuid: string
  model_name: string
  mark?: string
}

/**
 * 查询对话记录请求
 */
export interface QueryChatRecordsRequest {
  user_uuid?: string
  model_name?: string
  limit?: number
  page?: number
  size?: number
}

/**
 * 更新对话标记请求
 */
export interface UpdateChatMarkRequest {
  id: number
  mark: string
}

/**
 * 创建对话记录
 */
export async function createChatRecord(
  data: CreateChatRecordRequest
): Promise<ApiResponse<ChatRecord>> {
  try {
    const response = await request({
      url: COZE_PATHS.userModelChat.create,
      method: 'POST',
      data,
      base: 3,
    })
    return {
      code: 200,
      success: true,
      message: t('api.chat_history_service.创建成功'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建对话记录失败',
      data: {} as ChatRecord,
      timestamp: Date.now(),
    }
  }
}

/**
 * 查询对话记录
 */
export async function queryChatRecords(
  data: QueryChatRecordsRequest
): Promise<ApiResponse<ChatRecord[]>> {
  try {
    const response = await request({
      url: COZE_PATHS.userModelChat.query,
      method: 'POST',
      data,
      base: 3,
    })
    const raw = (response as { data?: any }).data ?? response
    const list: ChatRecord[] = Array.isArray(raw)
      ? (raw as ChatRecord[])
      : Array.isArray((raw as { list?: ChatRecord[] }).list)
        ? ((raw as { list?: ChatRecord[] }).list as ChatRecord[])
        : Array.isArray((raw as { data?: ChatRecord[] }).data)
          ? ((raw as { data?: ChatRecord[] }).data as ChatRecord[])
          : []

    let finalList = list

    // 如果没有任何历史对话，自动创建一条默认「新对话」记录
    if (!finalList.length && data.user_uuid && data.model_name) {
      try {
        const mark = t('llmChatCenter.newConversation') || '新对话'
        const created = await createChatRecord({
          user_uuid: data.user_uuid,
          model_name: data.model_name,
          mark,
        })
        if (created.success && created.data) {
          finalList = [created.data]
        }
      } catch (e) {
        logger.debug('[chatHistory] Creating conversation failed, keeping empty list', e)
        // 创建失败时保持为空列表，避免影响主流程
        finalList = []
      }
    }

    return {
      code: 200,
      success: true,
      message: t('api.chat_history_service.查询成功1'),
      data: finalList,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '查询对话记录失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

/**
 * 更新对话标记
 */
export async function updateChatMark(
  chatId: number,
  mark: string
): Promise<ApiResponse<ChatRecord>> {
  try {
    const response = await request({
      url: COZE_PATHS.userModelChat.updateMark,
      method: 'POST',
      data: {
        id: chatId,
        mark,
      },
      base: 3,
    })
    return {
      code: 200,
      success: true,
      message: t('api.chat_history_service.更新成功2'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新对话标记失败',
      data: {} as ChatRecord,
      timestamp: Date.now(),
    }
  }
}

/**
 * 删除对话记录
 * chatId 可以是数字或字符串（与后端 user-model-chat 的 id 一致）
 */
export async function deleteChatRecord(chatId: number | string): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const _response = await request({
      url: COZE_PATHS.userModelChat.byId(String(chatId)),
      method: 'DELETE',
      base: 3,
    })
    return {
      code: 200,
      success: true,
      message: t('api.chat_history_service.删除成功3'),
      data: { success: true },
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除对话记录失败',
      data: { success: false },
      timestamp: Date.now(),
    }
  }
}

/**
 * 对话消息（用于历史对话）
 */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  chat_id?: string
  agent_url?: string
  total_tokens?: number
  video_ratio?: number
}

/**
 * 获取对话消息请求
 */
export interface GetChatMessagesRequest {
  user_uuid: string
  model_name: string
  chat_id: string
  limit?: number
}

/**
 * 获取对话消息响应
 */
export interface GetChatMessagesResponse {
  messages: ChatHistoryMessage[]
  count: number
}

/**
 * 获取对话消息
 */
export async function getChatHistoryMessages(
  data: GetChatMessagesRequest
): Promise<ApiResponse<GetChatMessagesResponse>> {
  try {
    const response = await request({
      url: COZE_PATHS.userAgentContextQuery,
      method: 'POST',
      data,
      base: 3,
    })

    // 检查响应格式
    const responseData = response.data || response
    if (responseData && typeof responseData === 'object' && 'code' in responseData) {
      if (responseData.code === 0) {
        return {
          code: 200,
          success: true,
          message: t('api.chat_history_service.获取成功4'),
          data: responseData.data || { messages: [], count: 0 },
          timestamp: Date.now(),
        }
      }

      return {
        code: responseData.code || 500,
        success: false,
        message: (responseData as { message?: string }).message || '获取对话消息失败',
        data: { messages: [], count: 0 },
        timestamp: Date.now(),
      }
    }

    // 如果响应格式不符合预期，尝试直接使用
    return {
      code: 200,
      success: true,
      message: t('api.chat_history_service.获取成功5'),
      data: responseData?.data || responseData || { messages: [], count: 0 },
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取对话消息失败',
      data: { messages: [], count: 0 },
      timestamp: Date.now(),
    }
  }
}
