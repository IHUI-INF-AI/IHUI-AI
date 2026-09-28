// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface ZhsIdentity {
  id: string
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId?: string
  remark?: string
  binding?: string
  isCross?: number
  creator?: string
  createdAt: string
  updator?: string
}

export interface CForm {
  uuid: string
  name: string
  platformId: string
  organizationId: string
  parentId: string
  remark: string
  binding: string
  isCross: string
}

export interface Search {
  uuid: string
  name: string
  platformId: string
  organizationId: string
}
