export interface TagItem {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
}

export interface TagsData {
  list: TagItem[]
  total: number
  page: number
  pageSize: number
}

export interface TagForm {
  pid: string
  name: string
  sort: string
  status: boolean
}
