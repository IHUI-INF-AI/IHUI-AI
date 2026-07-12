export interface OperLog {
  id: string
  title: string
  businessType: number
  operName: string
  operUrl: string
  requestMethod: string
  operParam: string
  jsonResult: string
  status: number
  errorMsg: string
  costTime: number
  operTime: string
  operIp: string
  operLocation: string
}

export interface ListResp {
  list: OperLog[]
  total: number
}
