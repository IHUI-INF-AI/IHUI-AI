/** 请求服务类型声明（对应 service/index.js） */

export const baseUrl: string
export const baseUrl2: string
export const baseUrl3: string

export interface RequestOptions {
  url: string
  method?: string
  data?: unknown
  header?: Record<string, string>
  timeout?: number
  base?: number
}

declare function request(options: RequestOptions): Promise<unknown>
export default request
