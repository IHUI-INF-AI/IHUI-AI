export interface Category {
  id: string
  code: string
  name: string
  prentId?: string
  typeId?: string
  img?: string
  butImg?: string
  isInvalid?: number
  sort?: number
  creator?: string
  createdTime?: string
}

export interface CForm {
  code: string
  name: string
  prentId: string
  typeId: string
  img: string
  butImg: string
  isInvalid: string
  sort: string
}
