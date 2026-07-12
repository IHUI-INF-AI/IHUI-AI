export interface Lesson {
  id: string
  title: string
  isPublished: boolean
}

export interface Chapter {
  id: string
  lessonId: string
  title: string
  sortOrder: number
  createdAt: string
}

export interface LessonsData {
  list: Lesson[]
  total: number
}

export interface ChaptersData {
  list: Chapter[]
}

export interface ChapterForm {
  title: string
  sortOrder: string
}
