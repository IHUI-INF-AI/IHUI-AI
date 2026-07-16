export interface Topic {
  id: string
  title: string
  slug: string | null
  sort: number | null
  image: string
  cidList: string[] | null
  lidList: string[] | null
  status: string
  description: string
  price: string | null
  originalPrice: string | null
  isShowIndex: boolean
  createdAt: string
  updatedAt: string
}

export interface TForm {
  title: string
  slug: string
  sort: number
  image: string
  cidList: string[]
  lidList: string[]
  description: string
  price: string
  originalPrice: string
  status: string
  isShowIndex: boolean
}
