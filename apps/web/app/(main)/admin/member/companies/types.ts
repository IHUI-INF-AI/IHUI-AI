// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Company {
  id: string
  name: string
  contactName: string | null
  contactPhone: string | null
  address: string | null
  remark: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface CompaniesData {
  list: Company[]
  total: number
  page: number
  pageSize: number
}

export interface CompanyForm {
  name: string
  contactName: string
  contactPhone: string
  address: string
  remark: string
  sort: string
  status: boolean
}
