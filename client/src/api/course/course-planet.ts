/**
 * 课程星球相关 API
 * 迁移自 Ai-WXMiniVue/src/service/coursePlanet.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

/**
 * 获取课程星球
 */
export function getCoursePlanet() {
  return request({
    url: '/resource/getCoursePlanet',
    method: 'GET',
    data: {},
  })
}
