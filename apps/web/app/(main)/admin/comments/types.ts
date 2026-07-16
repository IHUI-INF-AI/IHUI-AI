export interface CommentUser {
  userNickname?: string | null
  userAvatar?: string | null
}

export interface CommentItem {
  id: string
  userId: string
  resourceType: string
  resourceId: string
  parentId: string | null
  content: string
  mentions: string[] | null
  isDeleted: boolean
  createdAt: string
  updatedAt?: string
  userNickname?: string | null
  userAvatar?: string | null
}

export type CommentDetail = CommentItem

export interface CommentsListData {
  list: CommentItem[]
  total: number
  page: number
  pageSize: number
}

export interface CommentDetailData {
  comment: CommentDetail
  replies: CommentItem[]
}

export type TopicType =
  | 'article'
  | 'ask'
  | 'answer'
  | 'resource'
  | 'circle_post'
  | 'lesson'
  | 'live_channel'
  | 'topic'
  | 'comment'
  | 'project'
  | 'file'
  | 'doc'
  | 'post'

export type StatusFilter = 'normal' | 'deleted' | 'all'
