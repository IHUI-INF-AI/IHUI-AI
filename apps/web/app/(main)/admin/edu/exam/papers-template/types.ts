export { type PageData } from '@ihui/api-client'

export interface Template {
  id: string
  name: string
  description: string | null
  config: unknown
  createdAt: string
}

export interface TForm {
  name: string
  description: string
  config: string
}
