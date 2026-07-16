export interface CirclePostAuthor {
  id: string
  nickname: string
  avatar: string | null
}

export interface CirclePostCircle {
  id: string
  name: string
}

export interface CirclePost {
  id: string
  content: string
  images: string[]
  status: 'published' | 'deleted'
  author: CirclePostAuthor
  circle: CirclePostCircle
  viewCount: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  createdAt: string
}

export interface PostFilter {
  keyword: string
  status: 'all' | 'published' | 'deleted'
  page: number
  pageSize: number
}

export const EMPTY_FILTER: PostFilter = {
  keyword: '',
  status: 'all',
  page: 1,
  pageSize: 20,
}
