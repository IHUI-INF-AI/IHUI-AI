export interface Item {
  id: string
  [k: string]: unknown
}

export interface ListData {
  list: Item[]
  total: number
}

export type FormState = Record<string, string>

export interface FieldDef {
  key: string
  label: string
  required?: boolean
}

export interface SearchFieldDef {
  key: string
  label: string
}
