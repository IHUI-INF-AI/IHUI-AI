// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export type Range = 'today' | '7d' | '30d' | 'custom'

export const PAGE_SIZE = 10

export const RANGES: { key: Range; labelKey: string }[] = [
  { key: 'today', labelKey: 'rangeToday' },
  { key: '7d', labelKey: 'range7d' },
  { key: '30d', labelKey: 'range30d' },
  { key: 'custom', labelKey: 'rangeCustom' },
]
