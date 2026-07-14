export interface Lesson {
  id: string
  title: string
}

export interface Section {
  id: string
  title: string
  duration: number
  isFree: boolean
}

export interface Chapter {
  id: string
  title: string
  sortOrder: number
  sections?: Section[]
}

export interface ChForm {
  title: string
  sortOrder: string
}
