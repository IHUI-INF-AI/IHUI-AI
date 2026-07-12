export interface MemberItem {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  gender: number
  status: number
  levelId: string | null
  growthValue: number
  createdAt: string | null
}

export interface MembersData {
  list: MemberItem[]
  total: number
  page: number
  pageSize: number
}

export interface LevelItem {
  id: string
  name: string
}
