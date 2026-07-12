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
