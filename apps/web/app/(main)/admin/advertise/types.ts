export interface Advertise {
  id: string
  title: string
  position: string
  imageUrl: string | null
  linkUrl: string | null
  sort: number
  status: number
  createdAt: string
}

export interface ListData {
  list: Advertise[]
  total: number
}

export interface AdvertiseForm {
  title: string
  position: string
  imageUrl: string
  linkUrl: string
  sort: string
  status: boolean
}
