export interface Skill {
  id: string
  name: string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  metadata?: Record<string, unknown> | null
  isPublic: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface SkillForm {
  name: string
  description: string
  version: string
  tags: string
  metadata: string
}

export interface MarketSkill {
  id: string
  name: string
  description?: string | null
  version?: string | null
  tags?: string[] | null
  author?: string | null
  rating?: number | null
  installCount?: number | null
  isInstalled: boolean
  isOwner: boolean
  createdAt: string
}

export interface MarketListResponse {
  list: MarketSkill[]
  total: number
  page: number
  pageSize: number
}
