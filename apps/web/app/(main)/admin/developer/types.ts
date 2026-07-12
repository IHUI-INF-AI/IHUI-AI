export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsedAt?: string
}

export interface WebhookConfig {
  id: string
  url: string
  events: string[]
  isEnabled: boolean
}

export interface SdkItem {
  id: string
  name: string
  language: string
  version: string
  url: string
}

export interface CozeAccount {
  id: string
  cozeId: string
  signAccount: string
  signPassword: string
  signNickname: string
  platform: string
  address: string
  status: number
  isDel: number
  creator: string | null
  createdAt: string
}

export interface CozeListData {
  list: CozeAccount[]
  total: number
}

export interface CozeForm {
  cozeId: string
  signAccount: string
  signPassword: string
  signNickname: string
  platform: string
  address: string
  status: string
}
