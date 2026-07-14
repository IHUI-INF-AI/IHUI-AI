export interface Member {
  id: string
  userId: string
  userName: string | null
  joinedAt: string
  status: string
  role: string
}

export interface MForm {
  userId: string
}
