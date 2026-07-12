export interface Item {
  id: string
  [k: string]: unknown
}

export interface ListData {
  list: Item[]
  total: number
}

export type FormState = Record<string, string>
