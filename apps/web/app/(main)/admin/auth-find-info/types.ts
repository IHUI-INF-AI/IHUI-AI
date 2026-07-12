export interface AuthFindInfo {
  id: string
  userUuid: string
  card: string
  belong?: string
  title?: string
  message?: string
  createdAt?: string
}

export interface ListData {
  list: AuthFindInfo[]
  total: number
}

export interface AuthFindInfoForm {
  userUuid: string
  card: string
  belong: string
  title: string
  message: string
  createdAt: string
}

export interface AuthFindInfoSearch {
  userUuid: string
  card: string
}
