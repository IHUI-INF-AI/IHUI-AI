import request from '@/utils/request'

/**
 * 根据分享code获取分享内容
 * @param {String} code - 分享码
 */
export function getShareContentByCode(code) {
  return request({
    url: `/agent/creation/share/third/${encodeURIComponent(code || '')}`,
    method: 'GET',
    base: 1,
    header: {
      'content-type': 'application/json'
    },
    data: {}
  })
}
