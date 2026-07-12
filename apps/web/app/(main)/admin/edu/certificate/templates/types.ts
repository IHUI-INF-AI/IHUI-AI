export interface Template {
  id: string
  name: string
  description: string | null
  backgroundImage: string | null
  templateConfig: Record<string, unknown> | null
  status: number
  createdAt: string
}

export interface TForm {
  name: string
  description: string
  backgroundImage: string
  templateConfig: string
  status: boolean
}
