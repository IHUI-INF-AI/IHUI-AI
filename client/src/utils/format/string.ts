export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return true
  return false
}
