export type MenuPermissionStatus = 'draft' | 'pending' | 'published' | 'rejected'

export type MenuType = 'menu' | 'button' | 'group'

export interface MenuPermission {
  id: string
  name: string
  code: string | null
  path: string | null
  type: MenuType
  status: MenuPermissionStatus
}

export interface MenuPermissionListData {
  list: MenuPermission[]
  total: number
}
