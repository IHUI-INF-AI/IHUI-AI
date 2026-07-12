export interface ContactItem {
  id: string
  introduction: string
  corporateCulture: string
}

export interface ContactList {
  list: ContactItem[]
  total: number
}
