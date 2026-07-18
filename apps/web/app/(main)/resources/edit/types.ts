export interface Category {
  id: string
  name: string
  pid?: string | null
}

export type ResourceType = 'other' | 'word' | 'excel' | 'ppt' | 'pdf' | 'image' | 'txt' | 'file'

export interface ResourceDetail {
  id?: string
  title: string
  intro: string
  categoryId?: string
  cidList?: string[]
  fileUrl?: string
  type?: ResourceType
  productId?: string
  tagIdList?: string[]
  image?: string
  introduction?: string
}
