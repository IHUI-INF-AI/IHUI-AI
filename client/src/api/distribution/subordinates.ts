/**
 * 获取下级用户相关 API
 * 迁移自 Ai-WXMiniVue/src/service/getSubordinates.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 获取操盘手的下家列表
 */
export function getSubordinates(open_id: string, page: number, quantity: number) {
  return request({
    url: '/distribution/getSubordinates',
    method: 'POST',
    data: { open_id, page, quantity },
  })
}

/**
 * 操盘手获取自己以及下家订单
 */
export function getUserAndChildrenOrders(id: string, page: number, quantity: number) {
  return request({
    url: '/distribution/getUserAndChildrenOrders',
    method: 'POST',
    data: {
      id,
      page,
      quantity,
    },
  })
}
