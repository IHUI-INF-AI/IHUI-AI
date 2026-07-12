export interface Item {
  id: string
  [k: string]: unknown
}

export type FormState = Record<string, string>
