// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 首页 7 天复盘用的纯函数。
 * 只做两件容易出错的事:从平台分布里挑主阵地、把 0..1 的 successRate 转成人话百分比。
 */

export interface PlatformSlice {
  readonly platform: string
  readonly count: number
}

export function pickTopPlatform(distribution: ReadonlyArray<PlatformSlice>): PlatformSlice | null {
  let best: PlatformSlice | null = null
  for (const item of distribution) {
    if (!item.platform || item.count <= 0) continue
    if (!best || item.count > best.count) best = item
  }
  return best
}

export function formatSuccessRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return '-'
  const percent = Math.min(rate, 1) * 100
  const rounded = Math.round(percent * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}
