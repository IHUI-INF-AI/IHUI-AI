// @ts-nocheck
// 用户端 requestUtils shim —— 旧项目部分页面直接 import request from '@/util/requestUtils'
// 这里 re-export 当前项目的 request 实例（已含拦截器），并在路径前补 /api/v1/edu
import request from '@/utils/request'

const PREFIX = '/api/v1/edu'

const service: any = (config: any) => {
  if (config && config.url && config.url.indexOf(PREFIX) !== 0 && config.url.indexOf('http') !== 0) {
    config.url = PREFIX + config.url
  }
  return request(config)
}
;(['get', 'delete', 'head', 'options', 'post', 'put', 'patch'] as const).forEach((method) => {
  service[method] = (url: string, ...args: any[]) => {
    const finalUrl = url && url.indexOf(PREFIX) !== 0 && url.indexOf('http') !== 0 ? PREFIX + url : url
    return (request as any)[method](finalUrl, ...args)
  }
})

export default service
