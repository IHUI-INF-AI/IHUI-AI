export interface Post {
  id: string
  postCode: string
  postName: string
  postSort: number
  status: number
  remark: string
  createdAt: string
}

export interface ListResp {
  list: Post[]
  total: number
}

export interface PostForm {
  postCode: string
  postName: string
  postSort: number
  status: number
  remark: string
}

export interface PostSearch {
  postCode: string
  postName: string
  status: string
}
