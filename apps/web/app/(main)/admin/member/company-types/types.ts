export interface CompanyType {
  id: string
  name: string
  description: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface CompanyTypesData {
  list: CompanyType[]
  total: number
}

export interface CompanyTypeForm {
  name: string
  description: string
  sort: string
  status: boolean
}
