export interface Teacher {
  id: string
  nickname: string
  phone: string | null
  title: string
  intro: string | null
  courseCount: number
  studentCount: number
  rating: number
  status: number
}

export interface TForm {
  nickname: string
  phone: string
  title: string
  intro: string
  status: number
}
