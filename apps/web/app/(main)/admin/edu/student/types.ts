export interface Student {
  id: string
  nickname: string | null
  phone: string | null
  email: string | null
  level: number
  status: number
  signupCount: number
  learnHours: number
  createdAt: string
}

export interface SForm {
  nickname: string
  phone: string
  email: string
  password: string
  level: string
  status: number
}
