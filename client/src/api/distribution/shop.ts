/**
 * 商城相关 API
 * 迁移自 Ai-WXMiniVue/src/service/shop.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 选择商品
 */
export function selectsGoods(type: string) {
  return request({
    url: `/resource/selectsGoods?type=${type}`,
    method: 'GET',
  })
}

/**
 * 获取充值活动
 */
export function getactivity() {
  return request({
    url: `/zhs_activity/get`,
    method: 'GET',
  })
}
