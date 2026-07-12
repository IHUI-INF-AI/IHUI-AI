export interface OAuthApp {
  id: string
  name: string
  clientId: string
  ownerId: string
  ownerName: string
  redirectUris: string[]
  scopes: string[]
  status: 'active' | 'disabled' | 'pending'
  createdAt: string
}

export interface OAuthAppForm {
  name: string
  redirectUris: string
  scopes: string
  ownerId: string
}

export interface ListData {
  list: OAuthApp[]
}
