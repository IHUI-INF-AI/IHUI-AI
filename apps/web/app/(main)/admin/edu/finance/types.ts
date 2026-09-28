// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface PayLog {
  id: string
  userUuid: string
  courseId?: string
  videoId?: string
  outBillOn?: string
  payWay?: string
  amount?: string
  realAmount?: string
  type?: number
  createdAt?: string
}

export interface CForm {
  userUuid: string
  courseId: string
  videoId: string
  outBillOn: string
  payWay: string
  amount: string
  realAmount: string
}
