export const CODE_LENGTH = 6
export const COUNTDOWN_SECONDS = 60

export function maskPhone(phone: string): string {
  const p = (phone || '').trim()
  if (!p || p.length < 11) return '未绑定'
  return p.slice(0, 3) + '****' + p.slice(-4)
}
