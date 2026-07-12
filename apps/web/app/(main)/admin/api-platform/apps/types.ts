export interface ApiApp {
  id: string
  name: string
  appId: string
  appSecret?: string
  permissions: string[]
  status: number
  createdAt: string
}

export interface ApiAppForm {
  name: string
  permissions: string
}
