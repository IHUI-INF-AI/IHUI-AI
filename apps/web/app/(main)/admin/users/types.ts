// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface AdminUser {
  id: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  roleId: number | null
  status: number | null
  deptId: number | null
  createdAt: string | null
}

export interface UsersData {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
}

export interface DeptItem {
  deptId: number
  parentId: number
  deptName: string
  orderNum: number | null
  leader: string | null
  phone: string | null
  email: string | null
  status: string | null
}
