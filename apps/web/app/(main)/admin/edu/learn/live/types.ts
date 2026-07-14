export interface Live {
  id: string
  title: string
  lecturerName: string | null
  startTime: string
  status: string
  coverImage: string | null
}

export interface LForm {
  title: string
  lecturerName: string
  startTime: string
  status: string
}
