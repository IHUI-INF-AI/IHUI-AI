export interface Permission {
  id: string
  name: string
  displayName: string
  resource: string
  action: string
  description: string | null
  createdAt: string
}
