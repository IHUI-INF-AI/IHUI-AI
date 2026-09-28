// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
