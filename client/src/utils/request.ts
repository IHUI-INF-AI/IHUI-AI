export function getUserToken(): string | null {
  return localStorage.getItem('token') || null
}

export default { getUserToken }
