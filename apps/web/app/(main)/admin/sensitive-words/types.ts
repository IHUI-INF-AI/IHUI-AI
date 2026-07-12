export interface SensitiveWord {
  id: string
  word: string
  category: string
  level: number
  replacement: string | null
  status: number
}

export interface SensitiveWordForm {
  word: string
  category: string
  level: number
  replacement: string
  status: number
}
