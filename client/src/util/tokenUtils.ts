// 管理端 token 工具 shim（与当前项目 localStorage 约定对齐）
const TOKEN_KEY = 'token'
const ADMIN_TOKEN_KEY = 'admin_token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ADMIN_TOKEN_KEY) || ''
}

export function setToken(data: any) {
  const value = data && data.accessToken ? data.accessToken.value : data
  if (value) {
    localStorage.setItem(TOKEN_KEY, value)
    localStorage.setItem(ADMIN_TOKEN_KEY, value)
  }
  return value
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}
