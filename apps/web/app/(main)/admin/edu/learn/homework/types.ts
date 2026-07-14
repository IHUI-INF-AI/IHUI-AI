export interface Homework {
  id: string
  title: string
  description: string | null
  lessonTitle: string | null
  dueDate: string | null
  status: string
  submitCount: number
}

export interface HForm {
  title: string
  description: string
  lessonId: string
  dueDate: string
  status: string
}
