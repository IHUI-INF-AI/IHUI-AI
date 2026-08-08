// 私信系统类型定义（对应 apps/api/src/routes/private-letters.ts）

/** 私信（letter）记录 */
export interface PrivateLetter {
  id: number
  senderId: string
  receiverId: string
  content: string
  readTime?: string | null
  isRead: boolean
  status?: string
  createdAt: string
  updatedAt?: string
}

/** 会话列表项：与某位联系人的最新一条私信 + 联系人信息 */
export interface LetterMember {
  letter: PrivateLetter
  /** 聊天对象的 userId */
  counterpartId: string
  /** 聊天对象的昵称 */
  counterpartName: string
}

/** GET /members 响应 data */
export interface LetterMembersData {
  list: LetterMember[]
  total: number
  page: number
  pageSize: number
}

/** GET /list 响应 data */
export interface LetterListData {
  list: PrivateLetter[]
  currentUserId: string
  page: number
  pageSize: number
}
