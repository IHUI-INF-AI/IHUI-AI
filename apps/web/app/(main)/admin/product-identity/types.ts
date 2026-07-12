export interface ProductIdentity {
  id: string
  productName: string | null
  amount: string | null
  beginTime: string | null
  endTime: string | null
  defAmount: string | null
  status: number
  remark: string | null
}

export interface ListData {
  list: ProductIdentity[]
  total: number
}

export interface ProductIdentityForm {
  productName: string
  amount: string
  beginTime: string
  endTime: string
  defAmount: string
  status: boolean
  remark: string
}
