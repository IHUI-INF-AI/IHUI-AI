export interface ResourceTag {
  id: string
  name: string
  pid: string | null
  sort: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface ResourceTagListData {
  list: ResourceTag[]
  total: number
  page: number
  pageSize: number
}

export interface ResourceTagForm {
  pid: string
  name: string
  sort: string
  status: boolean
}
