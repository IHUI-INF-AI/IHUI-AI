// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface UserCenter {
  id: string
  uuid: string
  nickname?: string
  avatar?: string
  gender?: string | number
  birthday?: string
  inviteCode?: string
  parentId?: string
  createdAt?: string
  authInfo?: { phone?: string }
  userMargin?: { tokenQuantity?: number }
  vipLevelVO?: { title?: string }
  isVip?: number
}

export interface AssignUser {
  userId: string
  userName?: string
  nickname?: string
  roles?: string
}

export interface UserForm {
  nickname: string
  avatar: string
  gender: string
  birthday: string
  inviteCode: string
  parentId: string
  createdAt: string
}
