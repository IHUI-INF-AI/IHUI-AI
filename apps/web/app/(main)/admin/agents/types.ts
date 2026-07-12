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
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  categoryId: string
  name: string
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

export interface AgentForm {
  name: string
  description: string
  avatar: string
  cover: string
  categoryId: string
  status: string
  price: string
  isFree: boolean
  sort: string
  remark: string
}
