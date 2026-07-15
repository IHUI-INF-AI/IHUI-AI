export const MINI_PROGRAM_LINK = 'https://aizhs.top/share'

export function formatAudioTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining < 10 ? '0' + remaining : remaining}`
}

export function formatTokens(value: number): string {
  if (!value) return '0'
  return value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)
}
