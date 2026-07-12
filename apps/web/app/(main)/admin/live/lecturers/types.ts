export interface Lecturer {
  id: string
  name: string
  avatar: string | null
  title: string | null
  intro: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface LecturersData {
  list: Lecturer[]
  total: number
  page: number
  pageSize: number
}

export interface LecturerForm {
  name: string
  title: string
  avatar: string
  intro: string
  sort: string
  status: boolean
}
