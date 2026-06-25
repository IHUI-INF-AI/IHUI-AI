/**
 * AIGC 相关 API
 * 迁移自 Ai-WXMiniVue/src/service/aigc.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 获取AIGC列表
 */
export function getList(pageNum: number = 1, pageSize: number = 6, fileType: string = '') {
  return request({
    url: `/general/ai_gc/list`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    data: {
      pageNum,
      pageSize,
      fileType,
    },
    base: 4,
  })
}
