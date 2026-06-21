/**
 * N8N 相关 API
 * 迁移自 Ai-WXMiniVue/src/service/n8n.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * N8N智能体上传参数
 */
export interface N8nAgentUploadParams {
  name: string
  workflowId: string
  description?: string
  [key: string]: any
}

/**
 * 添加n8n智能体
 */
export function addN8nAgent(data: N8nAgentUploadParams) {
  return request({
    url: '/api/agent/upload',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 1,
  })
}

/**
 * N8N智能体处理参数
 */
export interface N8nAgentProcessParams {
  agentId: string
  input: string | Record<string, unknown>
  [key: string]: any
}

/**
 * 调用n8n智能体
 */
export function processN8nAgent(data: N8nAgentProcessParams) {
  return request({
    url: '/api/agent/process',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 1,
    // responseType: 'arraybuffer' // axios 中应该使用 responseType 配置
  })
}
