export interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  status: string
  price: number
  isFree: boolean
  isVipExclusive?: boolean | null
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
}

export interface AgentsData {
  list: Agent[]
  total: number
  page: number
  pageSize: number
}

export interface CategoriesData {
  list: Category[]
  total: number
  page: number
  pageSize: number
}
