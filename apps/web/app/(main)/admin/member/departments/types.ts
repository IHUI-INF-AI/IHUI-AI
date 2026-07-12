export interface Department {
  id: string
  [k: string]: unknown
}

export interface ListData {
  list: Department[]
  total: number
}

export type FormState = Record<string, string>
