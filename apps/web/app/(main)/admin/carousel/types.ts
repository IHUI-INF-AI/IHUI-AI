export interface Carousel {
  id: string
  title: string
  imageUrl: string | null
  linkUrl: string | null
  sort: number
  status: number
  createdAt: string
}

export interface ListData {
  list: Carousel[]
  total: number
}

export interface CarouselForm {
  title: string
  imageUrl: string
  linkUrl: string
  sort: string
  status: boolean
}
