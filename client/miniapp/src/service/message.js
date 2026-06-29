import { request } from "@/service/shared-request.ts";
import jsRequest from "@/utils/service/index.js";

/**
 * 获取用户聊天房间列表
 * @param {string} userUuid - 用户UUID
 * @returns {Promise}
 */
export function getUserRooms(userUuid) {
  return request({
    url: `/cozeZhsApi/chat-room/users/${userUuid}/rooms`,
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 3 // 使用 baseUrl3
  });
}

/**
 * 获取房间历史消息
 * @param {string} userUuid - 用户UUID
 * @param {string} roomId - 房间ID
 * @returns {Promise}
 */
export function getRoomHistory(userUuid, roomId) {
  // GET 请求的参数应该通过 URL 查询字符串传递
  const url = `/cozeZhsApi/chat-room/history?user_uuid=${encodeURIComponent(userUuid)}&room_id=${encodeURIComponent(roomId)}`
  console.log('getRoomHistory - 请求URL:', url)
  return request({
    url: url,
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 3 // 使用 baseUrl3
  });
}

/**
 * 标记房间消息为已读
 * @param {string} userUuid - 用户UUID
 * @param {string} roomId - 房间ID
 * @returns {Promise}
 */
export function markRoomAsRead(userUuid, roomId) {
  return request({
    url: `/cozeZhsApi/chat-room/messages/mark-read?user_uuid=${userUuid}&room_id=${roomId}`,
    method: "PUT",
    header: {
      "content-type": "application/json",
    },
    base: 3 // 使用 baseUrl3
  });
}

/**
 * 获取私聊会话列表
 * 响应：{code:0, data:[{id, name, avatar, lastMessage, time, unreadCount, ...}]}
 * @returns {Promise}
 */
export function getConversationList() {
  return jsRequest({
    url: `/message/private/conversation/list`,
    method: "GET",
    header: {
      "content-type": "application/json",
    },
    base: 1
  });
}
