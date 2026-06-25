/**
 * 聊天房间API
 * 对应UniApp的 message.js 服务
 * 提供房间历史消息、标记已读等功能
 */

import request from '@/utils/request'
import { getBaseUrl } from '@/config/api-config'
import { logger } from '@/utils/logger'

const baseUrl3 = getBaseUrl(3)

/**
 * 获取房间历史消息
 */
export async function getRoomHistory(userUuid: string, roomId: string): Promise<any> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/history?user_uuid=${encodeURIComponent(userUuid)}&room_id=${encodeURIComponent(roomId)}`
  logger.info('[ChatRoom] Fetching room history messages', { userUuid, roomId })
  try {
    const response = await request.get(url)
    return response.data
  } catch (error) {
    logger.error('[ChatRoom] Failed to fetch room history messages:', error)
    throw error
  }
}

/**
 * 标记房间消息为已读
 */
export async function markRoomAsRead(userUuid: string, roomId: string): Promise<any> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/messages/mark-read?user_uuid=${userUuid}&room_id=${roomId}`
  logger.info('[ChatRoom] Marking room as read', { userUuid, roomId })
  try {
    const response = await request.put(url)
    return response.data
  } catch (error) {
    logger.error('[ChatRoom] Failed to mark as read:', error)
    throw error
  }
}

/**
 * 获取用户聊天房间列表
 */
export async function getUserRooms(userUuid: string): Promise<any> {
  const url = `${baseUrl3}/cozeZhsApi/chat-room/users/${userUuid}/rooms`
  logger.info('[ChatRoom] Fetching user room list', { userUuid })
  try {
    const response = await request.get(url)
    return response.data
  } catch (error) {
    logger.error('[ChatRoom] Failed to fetch user room list:', error)
    throw error
  }
}
