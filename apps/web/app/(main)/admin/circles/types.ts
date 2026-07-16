export interface CircleUser {
  nickname?: string | null
  avatar?: string | null
}

export interface Circle {
  id: string
  name: string
  slug: string
  description: string | null
  coverImage: string | null
  categoryId: string | null
  cidList?: string[] | null
  memberCount: number
  postCount: number
  isPublished: boolean
  createdBy: string | null
  creator?: CircleUser | null
  creatorName?: string | null
  createdAt: string
  updatedAt?: string
}

export interface CircleForm {
  name: string
  slug: string
  description: string
  coverImage: string
  cidList: string
  isPublished: boolean
}
