/**
 * 知识星球相关 API
 * 迁移自 Ai-WXMiniVue/src/service/knowledgePlanet.js
 * 转换：JS -> TS, uni.request -> axios
 */

import request from '@/utils/request-compat'

// 资讯相关接口统一通过本地 /api-kou 代理到 Python 后端，避免浏览器直连产生 CORS
const KOU_PROXY_BASE = '/api-kou'

/**
 * 获取知识星球信息
 * @param type 1->官方资讯 2->社区资讯 3->ai圈
 */
export function getKnowledgePlanetInfo(type: string) {
  return request({
    url: '/resource/getKnowledgePlanet',
    method: 'GET',
    data: { type },
  })
}

/**
 * 获取资讯分类列表
 */
export function information() {
  return request({
    url: '/information/dictionary',
    method: 'GET',
  })
}

/**
 * 获取每日资讯列表
 * 标记 silent500=true：后端不稳定时不打扰用户，使用默认数据回退
 */
export function getinformationListnews(_insertTime?: string, _informationType?: string, _type?: string) {
  return request({
    url: `${KOU_PROXY_BASE}/information/list`,
    method: 'GET',
    base: 0,
    silent500: true,
  } as never)
}

/**
 * 获取资讯列表
 */
export function getinformationList(type: string) {
  return request({
    url: `${KOU_PROXY_BASE}/information/list`,
    method: 'GET',
    data: { type },
    base: 0,
  })
}
