/**
 * 聊天房间API
 * 对应UniApp的 message.js 服务
 * 提供房间历史消息、标记已读等功能
 */

import request from '@/utils/request'
import { getBaseUrl } from '@/config/api-config'
import { logger } from '@/utils/logger'
import type { ApiResponse } from '@/types'

const baseUrl3 = getBaseUrl(3)

/**
 * 聊天房间原始消息（后端返回结构）
 */
export interface ChatRoomMessage {
  id: string | number
  type?: number
  content?: string
  user_uuid?: string
  receiver_uuid?: string
  send_time?: string
  source?: string
  is_del?: number
  sender_avatar?: string
  sender_name?: string
  [key: string]: unknown
}

/**
 * 房间历史消息响应数据
 */
export interface ChatRoomHistoryData {
  messages?: ChatRoomMessage[]
  [key: string]: unknown
}

/**
 * 获取房间历史消息
 */
export async function getRoomHistory(
  userUuid: string,
  roomId: string
): Promise<ApiResponse<ChatRoomHistoryData> | ChatRoomMessage[] | ChatRoomHistoryData> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/history?user_uuid=${encodeURIComponent(userUuid)}&room_id=${encodeURIComponent(roomId)}`
  logger.info('[ChatRoom] Fetching room history messages', { userUuid, roomId })
  try {
    const response = await request.get(url)
    return response.data as ApiResponse<ChatRoomHistoryData> | ChatRoomMessage[] | ChatRoomHistoryData
  } catch (error) {
    logger.error('[ChatRoom] Failed to fetch room history messages:', error)
    throw error
  }
}

/**
 * 标记房间消息为已读
 */
export async function markRoomAsRead(
  userUuid: string,
  roomId: string
): Promise<ApiResponse<unknown>> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/messages/mark-read?user_uuid=${userUuid}&room_id=${roomId}`
  logger.info('[ChatRoom] Marking room as read', { userUuid, roomId })
  try {
    const response = await request.put(url)
    return response.data as ApiResponse<unknown>
  } catch (error) {
    logger.error('[ChatRoom] Failed to mark as read:', error)
    throw error
  }
}

/**
 * 获取用户聊天房间列表
 */
export async function getUserRooms(
  userUuid: string
): Promise<ApiResponse<unknown>> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/users/${userUuid}/rooms`
  logger.info('[ChatRoom] Fetching user room list', { userUuid })
  try {
    const response = await request.get(url)
    return response.data as ApiResponse<unknown>
  } catch (error) {
    logger.error('[ChatRoom] Failed to fetch user room list:', error)
    throw error
  }
}
