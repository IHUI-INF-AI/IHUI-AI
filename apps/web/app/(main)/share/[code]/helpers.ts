// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export const MINI_PROGRAM_LINK = '/share'

export function formatAudioTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining < 10 ? '0' + remaining : remaining}`
}

export function formatTokens(value: number): string {
  if (!value) return '0'
  return value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)
}
