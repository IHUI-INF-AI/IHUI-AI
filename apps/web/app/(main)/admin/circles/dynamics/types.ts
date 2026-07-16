export interface CirclePostAuthor {
  id: string
  nickname: string
  avatar: string | null
}

export interface CirclePostCircle {
  id: string
  name: string
}

export type CirclePostStatus = 'published' | 'deleted' | 'pending' | 'rejected'

export interface CirclePost {
  id: string
  content: string
  images: string[]
  status: CirclePostStatus
  author: CirclePostAuthor
  circle: CirclePostCircle
  viewCount: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  createdAt: string
}

export type PostStatusFilter = 'all' | CirclePostStatus

export interface PostFilter {
  keyword: string
  status: PostStatusFilter
  page: number
  pageSize: number
}

export const EMPTY_FILTER: PostFilter = {
  keyword: '',
  status: 'all',
  page: 1,
  pageSize: 20,
}

export interface CirclePostComment {
  id: string
  content: string
  status: number
  likeCount: number
  createdAt: string
  pid: string | null
  replyUserId: string | null
  author: CirclePostAuthor
}
