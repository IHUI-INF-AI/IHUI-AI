// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Organization {
  id: string
  uuid: string
  platformId: string
  name: string
  remark?: string
  filePath?: string
  binding?: string
  creator?: string
  createdAt: string
  updator?: string
}

export interface OrganizationForm {
  uuid: string
  platformId: string
  name: string
  remark: string
  filePath: string
  binding: string
}

export interface OrganizationSearch {
  platformId: string
  name: string
}
