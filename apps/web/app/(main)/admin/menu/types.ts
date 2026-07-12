export interface MenuItem {
  id: string
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
  [key: string]: unknown
}

export interface MenuForm {
  name: string
  icon: string
  path: string
  sort: number
  parentId: string | null
  visible: boolean
}

export interface ListData {
  list: MenuItem[]
  total: number
}
