export interface Topic {
  id: string
  title: string
  image: string
  status: string
  description: string
  price: string | null
  originalPrice: string | null
  createdAt: string
  updatedAt: string
}

export interface TForm {
  title: string
  image: string
  description: string
  price: string
  originalPrice: string
  status: string
}
