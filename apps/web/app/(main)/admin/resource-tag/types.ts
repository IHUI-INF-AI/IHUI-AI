// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface ResourceTag {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface ResourceTagListData {
  list: ResourceTag[]
  total: number
  page: number
  pageSize: number
}

export interface ResourceTagForm {
  pid: string
  name: string
  sort: string
  status: boolean
}
