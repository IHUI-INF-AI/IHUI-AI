export interface AboutUsItem {
  id: string
  network: string
  phone: string
  socialMedia: string
  experience: string
  description: string
}

export interface AboutUsList {
  list: AboutUsItem[]
  total: number
}
