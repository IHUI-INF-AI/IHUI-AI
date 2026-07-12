export interface TagItem {
  id: string
  name: string
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
  name: string
  sort: string
  status: boolean
}
