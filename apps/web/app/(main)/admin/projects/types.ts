export interface AdminProject {
  id: string
  userId: string
  name: string
  description: string | null
  status: number
  createdAt: string
  updatedAt: string
  ownerNickname: string | null
  ownerAvatar: string | null
  ownerPhone: string | null
  ownerEmail: string | null
}

export interface PageData {
  list: AdminProject[]
  total: number
  page: number
  pageSize: number
}

export interface ProjectForm {
  userId: string
  name: string
  description: string
  status: number
}
