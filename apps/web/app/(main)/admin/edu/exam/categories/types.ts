export interface Category {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
}

export interface CForm {
  name: string
  sort: string
  status: boolean
}
