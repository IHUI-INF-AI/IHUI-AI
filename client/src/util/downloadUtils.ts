// @ts-nocheck
// 用户端 downloadUtils shim —— 文件下载（走当前项目 request 实例，前缀 /api/v1/edu）
import request from '@/utils/request'
import { getToken } from './tokenUtils'
import { error } from './tipsUtils'

const PREFIX = '/api/v1/edu'

export function download(url: string, data: any, title: string, success?: any, failed?: any) {
  const token = getToken()
  return request({
    method: 'post',
    url: PREFIX + url,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? 'Bearer ' + token : ''
    },
    data,
    responseType: 'blob'
  })
    .then((res: any) => {
      const respData = res && res.data !== undefined ? res.data : res
      if (!respData) return
      const blob = new Blob([respData])
      const objectUrl = window.URL.createObjectURL(blob)
      const aLink = document.createElement('a')
      aLink.style.display = 'none'
      aLink.href = objectUrl
      aLink.setAttribute('download', title)
      document.body.appendChild(aLink)
      aLink.click()
      document.body.removeChild(aLink)
      window.URL.revokeObjectURL(objectUrl)
      success && success()
    })
    .catch((e: any) => {
      console.log(e)
      failed && failed()
    })
}

// 兼容旧项目对 axios 全局拦截器的依赖（此处仅 no-op，错误已在 request 拦截器中处理）
export default { download }
