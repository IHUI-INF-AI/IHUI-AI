export interface Material {
  id: string
  title: string
  type: string
  fileUrl: string | null
  fileSize: number
  downloadCount: number
  lessonTitle: string | null
}

export interface MForm {
  title: string
  type: string
  fileUrl: string
  lessonId: string
}
