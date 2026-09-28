// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface EduPlatform {
  id: string
  code: string
  name: string
  domain?: string
  remark?: string
  binding?: string
  filePath?: string
  type?: number
  status: number
  sort?: number
  creator?: string
  createdAt: string
  updator?: string
  field1?: string
  field2?: string
}

export interface CForm {
  code: string
  name: string
  domain: string
  remark: string
  binding: string
  filePath: string
  type: string
  status: boolean
  sort: string
  field1: string
  field2: string
}
