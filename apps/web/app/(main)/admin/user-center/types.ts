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
