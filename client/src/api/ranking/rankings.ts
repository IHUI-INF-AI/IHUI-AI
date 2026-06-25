/**
 * 排行榜相关 API
 * 迁移自 Ai-WXMiniVue/src/service/rankings.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 获取群组列表（排行榜）
 */
export function getGroupList(_id: string, _token: string) {
  return request({
    url: `/general/remote/third/group/list`,
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
    base: 4,
  })
}
