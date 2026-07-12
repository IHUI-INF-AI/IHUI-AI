export interface Paper {
  id: string
  paperTitle: string
  paperUrl: string | null
  courseId: string | null
  status: number
  createdAt: string
}

export interface PaperForm {
  paperTitle: string
  paperUrl: string
}
