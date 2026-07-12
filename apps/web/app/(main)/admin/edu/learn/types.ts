export interface Lesson {
  id: string
  title: string
  intro: string | null
  categoryId: string | null
  categoryName: string | null
  lecturerName: string | null
  price: string
  isFree: boolean
  isPublished: boolean
  sort: number
  signupCount: number
  viewCount: number
}

export interface Category {
  id: string
  name: string
  sort: number
  status: number
}

export interface LForm {
  title: string
  categoryId: string
  intro: string
  lecturerName: string
  price: string
  isFree: boolean
  isPublished: boolean
  sort: string
}
