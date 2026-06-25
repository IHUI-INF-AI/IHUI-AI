/**
 * AI 首页相关 API
 * 迁移自 Ai-WXMiniVue/src/service/ai_index.js
 * 转换：JS -> TS, uni.request -> axios
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request-compat'

/**
 * 模型聊天查询参数
 */
export interface ModelChatQueryParams {
  userUuid?: string
  modelName?: string
  page?: number
  pageSize?: number
  [key: string]: any
}

/**
 * 获取 AI团队 智能体 列表
 */
export function getModelChat(data: ModelChatQueryParams) {
  return request({
    url: COZE_PATHS.userModelChat.query,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 3,
  })
}

/**
 * 创建模型聊天参数
 */
export interface CreateModelChatParams {
  userUuid: string
  modelName: string
  mark?: string
  [key: string]: any
}

/**
 * 创建模型聊天
 */
export function createModelChat(data: CreateModelChatParams) {
  return request({
    url: COZE_PATHS.userModelChat.create,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 3,
  })
}

/**
 * 智能体上下文查询参数
 */
export interface AgentContextQueryParams {
  userUuid?: string
  agentId?: string
  contextId?: string
  [key: string]: any
}

/**
 * 查询智能体上下文
 */
export function queryAgentContext(data: AgentContextQueryParams) {
  return request({
    url: COZE_PATHS.userAgentContextQuery,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 3,
  })
}

/**
 * 更新标记参数
 */
export interface UpdateMarkParams {
  id: string
  mark: string
  [key: string]: any
}

/**
 * 更新标记
 */
export function updateMark(data: UpdateMarkParams) {
  return request({
    url: COZE_PATHS.userModelChat.updateMark,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 3,
  })
}

/**
 * 删除模型聊天
 */
export function removeModelChat(id: string) {
  return request({
    url: COZE_PATHS.userModelChat.byId(id),
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
    },
    base: 3,
  })
}

/**
 * 检查首次分享状态
 */
export function checkFirstShareStatus() {
  return request({
    url: `/resource/first/share/show`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    base: 1,
  })
}

/**
 * 首次分享领智汇值
 */
export function firstShare() {
  return request({
    url: `/resource/first/share`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    base: 1,
  })
}
